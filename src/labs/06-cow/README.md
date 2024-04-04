---
title: lab6-copy on write
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/cow.html)

## 1. Implement copy-on write

:::code-tabs #shell
@tab k\defs.h 
```c 
// vm.c
+++
int cowpage(pagetable_t pagetable, uint64 va);
void *cowalloc(pagetable_t pagetable, uint64 va);
int krefcnt(void *pa);
int kaddrefcnt(void *pa);
pte_t *walk(pagetable_t pagetable, uint64 va, int alloc);
+++
```
@tab k\kalloc.c 
```c
+++
struct ref_stru {
  struct spinlock lock;
  int cnt[PHYSTOP / PGSIZE]; // 引用计数
} ref;
+++

void
kinit()
{
  initlock(&kmem.lock, "kmem");
+++
  initlock(&ref.lock, "ref");
+++
  freerange(end, (void *) PHYSTOP);
}

void
freerange(void *pa_start, void *pa_end)
{
  char *p;
  p = (char *) PGROUNDUP((uint64) pa_start);
  for(; p + PGSIZE <= (char*)pa_end; p += PGSIZE) {
+++
    ref.cnt[(uint64) p / PGSIZE] = 1;
+++
    kfree(p);
  }
}

void
kfree(void *pa)
{
  struct run *r;

  if(((uint64) pa % PGSIZE) != 0 || (char *) pa < end || (uint64) pa >= PHYSTOP)
    panic("kfree");
+++
  acquire(&ref.lock);
  if(--ref.cnt[(uint64) pa / PGSIZE] == 0) {
    release(&ref.lock);
+++
// Fill with junk to catch dangling refs.
    memset(pa, 1, PGSIZE);
    r = (struct run*)pa;
    acquire(&kmem.lock);
    r->next = kmem.freelist;
    kmem.freelist = r;
    release(&kmem.lock);
  } else {
+++
  release(&ref.lock);
+++
  }
acquire(&kmem.lock);
  r = kmem.freelist;
  if(r) {
    kmem.freelist = r->next;
+++
    acquire(&ref.lock);
    ref.cnt[(uint64) r / PGSIZE] = 1; // 将引用计数初始化为1
    release(&ref.lock);
+++
  }
  release(&kmem.lock);

  if(r)
    memset((char *) r, 5, PGSIZE); // fill with junk
  return (void *) r;
```
@tab k\riscv.h 
```c

#define PTE_W (1L << 2)
#define PTE_X (1L << 3)
#define PTE_U (1L << 4) // 1 -> user can access
+++
#define PTE_F (1L << 8) //
+++
```
@tab k\trap.c 
```c
void
usertrap(void)
{
... 
if(r_scause() == 8) {
 ...
}else if((which_dev = devintr()) != 0) {
    // ok
} 
+++
  else if(r_scause() == 13 || r_scause() == 15) {
    uint64 fault_va = r_stval(); // 获取出错的虚拟地址
    if(fault_va >= p->sz || cowpage(p->pagetable, fault_va) != 0 ||
        cowalloc(p->pagetable, PGROUNDDOWN(fault_va)) == 0) {
      p->killed = 1;
    }
  }
+++
  else ...
}
```
@tab k\vm.c
```c
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
---
  char *mem;
---
  for(i = 0; i < sz; i += PGSIZE) {
    if((pte = walk(old, i, 0)) == 0)
      panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      panic("uvmcopy: page not present");
    pa = PTE2PA(*pte);
    flags = PTE_FLAGS(*pte);
---
    if((mem = kalloc()) == 0)
      goto err;
    memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)mem, flags) != 0){
      kfree(mem);
      goto err;
    }
--- >>>
    // 仅对可写页面设置COW标记
    if(flags & PTE_W) {
      // 禁用写并设置COW Fork标记
      flags = (flags | PTE_F) & ~PTE_W;
      *pte = PA2PTE(pa) | flags;

    }
    if(mappages(new, i, PGSIZE, pa, flags) != 0) {
      uvmunmap(new, 0, i / PGSIZE, 1);
      return -1;
    }
    kaddrefcnt((char *) pa);
  }
>>>
  return 0;
}

int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0) {
    va0 = PGROUNDDOWN(dstva);
    pa0 = walkaddr(pagetable, va0);
+++
    if(cowpage(pagetable, va0) == 0) {
      // 更换目标物理地址
      pa0 = (uint64) cowalloc(pagetable, va0);
    }
+++
    if(pa0 == 0)
      return -1;
}

+++
/**
 * @brief cowpage 判断一个页面是否为COW页面
 * @param pagetable 指定查询的页表
 * @param va 虚拟地址
 * @return 0 是 -1 不是
 */
int
cowpage(pagetable_t pagetable, uint64 va)
{
  if(va >= MAXVA)
    return -1;
  pte_t *pte = walk(pagetable, va, 0);
  if(pte == 0)
    return -1;
  if((*pte & PTE_V) == 0)
    return -1;
  return (*pte & PTE_F ? 0 : -1);
}

/**
 * @brief cowalloc copy-on-write分配器
 * @param pagetable 指定页表
 * @param va 指定的虚拟地址,必须页面对齐
 * @return 分配后va对应的物理地址，如果返回0则分配失败
 */
void *
cowalloc(pagetable_t pagetable, uint64 va)
{
  if(va % PGSIZE != 0)
    return 0;

  uint64 pa = walkaddr(pagetable, va); // 获取对应的物理地址
  if(pa == 0)
    return 0;

  pte_t *pte = walk(pagetable, va, 0); // 获取对应的PTE

  if(krefcnt((char *) pa) == 1) {
    // 只剩一个进程对此物理地址存在引用
    // 则直接修改对应的PTE即可
    *pte |= PTE_W;
    *pte &= ~PTE_F;
    return (void *) pa;
  }
  else {
    // 多个进程对物理内存存在引用
    // 需要分配新的页面，并拷贝旧页面的内容
    char *mem = kalloc();
    if(mem == 0)
      return 0;

    // 复制旧页面内容到新页
    memmove(mem, (char *) pa, PGSIZE);

    // 清除PTE_V，否则在mappagges中会判定为remap
    *pte &= ~PTE_V;

    // 为新页面添加映射
    if(mappages(pagetable, va, PGSIZE, (uint64) mem,
           (PTE_FLAGS(*pte) | PTE_W) & ~PTE_F) != 0) {
      kfree(mem);
      *pte |= PTE_V;
      return 0;
    }

    // 将原来的物理内存引用计数减1
    kfree((char *) PGROUNDDOWN(pa));
    return mem;
  }
}

/**
 * @brief krefcnt 获取内存的引用计数
 * @param pa 指定的内存地址
 * @return 引用计数
 */
int
krefcnt(void *pa)
{
  return ref.cnt[(uint64) pa / PGSIZE];
}

/**
 * @brief kaddrefcnt 增加内存的引用计数
 * @param pa 指定的内存地址
 * @return 0:成功 -1:失败
 */
int
kaddrefcnt(void *pa)
{
  if(((uint64) pa % PGSIZE) != 0 || (char *) pa < end || (uint64) pa >= PHYSTOP)
    return -1;
  acquire(&ref.lock);
  ++ref.cnt[(uint64) pa / PGSIZE];
  release(&ref.lock);
  return 0;
}

+++
```
:::

