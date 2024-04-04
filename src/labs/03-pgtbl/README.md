---
title: lab3-Page tables
icon: lightbulb
---

## 介绍
[实验说明](https://pdos.csail.mit.edu/6.828/2020/labs/pgtbl.html)

## 1. Print a page table 
:::code-tabs #shell
@tab:active k\defs.h 
```c 
+++
void vmprint(pagetable_t);
+++
```
@tab k\vm.c 
```c
+++
void _vmprint(pagetable_t pagetable, int level) {
    for (int i = 0; i < 512; i++) {
        pte_t pte = pagetable[i];
        if (pte & PTE_V) {
            for (int j = 0; j < level; j++) {
                if (j) printf(" ");
                printf("..");
            }
            uint64 child = PTE2PA(pte);
            printf("%d: pte %p pa %p\n", i, pte, child);
            if ((pte & (PTE_R | PTE_W | PTE_X)) == 0) {
                _vmprint((pagetable_t)child, level + 1);
            }
        }
    }
}
void vmprint(pagetable_t pagetable) {
    printf("page table %p\n", pagetable);
    _vmprint(pagetable, 1);
}
+++

```
@tab k\exec.c 
```c
int
exec(char *path, char **argv){
.
.
.
    p->trapframe->sp = sp;         // initial stack pointer
    proc_freepagetable(oldpagetable, oldsz);
+++
    if (p->pid == 1) { vmprint(p->pagetable); }
+++
    p->trapframe->sp = sp;         // initial stack pointer
    proc_freepagetable(oldpagetable, oldsz);
```

:::


## 2. A kernel page table per process 

:::code-tabs #shell
@tab:active k\defs.h 
```c 
+++
void uvmmap(pagetable_t, uint64, uint64, uint64, int);
void proc_inithart(pagetable_t kpt);
pagetable_t proc_kpt_init();
+++
```
@tab k\vm.c 
```c
+++
#include "spinlock.h"
#include "proc.h"
+++

void 
kvminit(){
---
kernel_pagetable = (pagetable_t)kalloc();
--- >>> 
    kernel_pagetable = proc_kpt_init();
    mappages(kernel_pagetable, CLINT, 0x10000, CLINT, PTE_R | PTE_W);
>>>
}

+++
void proc_inithart(pagetable_t kpt) {
    w_satp(MAKE_SATP(kpt));
    sfence_vma();
}
+++

+++
void uvmmap(pagetable_t pagetable, uint64 va, uint64 pa, uint64 sz, int perm) {
    if (mappages(pagetable, va, sz, pa, perm) != 0) { panic("uvmmap"); }
}

pagetable_t proc_kpt_init() {
    pagetable_t kernelpt = uvmcreate();
    if (kernelpt == 0) return 0;
    uvmmap(kernelpt, UART0, UART0, PGSIZE, PTE_R | PTE_W);
    uvmmap(kernelpt, VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);
    // uvmmap(kernelpt, CLINT, CLINT, 0x10000, PTE_R | PTE_W);
    uvmmap(kernelpt, PLIC, PLIC, 0x400000, PTE_R | PTE_W);
    uvmmap(kernelpt, KERNBASE, KERNBASE, (uint64)etext - KERNBASE,
           PTE_R | PTE_X);
    uvmmap(kernelpt, (uint64)etext, (uint64)etext, PHYSTOP - (uint64)etext,
           PTE_R | PTE_W);
    uvmmap(kernelpt, TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);
    return kernelpt;
}
+++
```
@tab k\proc.c 
```c
void procinit(void) {
---
    char *pa = kalloc();
    if(pa == 0)
    panic("kalloc");
    uint64 va = KSTACK((int) (p - proc));
    kvmmap(va, (uint64)pa, PGSIZE, PTE_R | PTE_W);
    p->kstack = va;
---
}
static struct proc*
allocproc(void)
{
.
.
    if (p->pagetable == 0) {
        freeproc(p);
        release(&p->lock);
        return 0;
    }
+++
    // init the kernel page table
    p->kernelpt = proc_kpt_init();
    if (p->kernelpt == 0) {
        freeproc(p);
        release(&p->lock);
        return 0;
    }
    char *pa = kalloc();
    if (pa == 0) { panic("kalloc"); }
    uint64 va = KSTACK((int)(p - proc));
    uvmmap(p->kernelpt, va, (uint64)pa, PGSIZE, PTE_R | PTE_W);
    p->kstack = va;
+++
}

+++
void proc_free_kernelpt(pagetable_t kernelpt) {
    for (int i = 0; i < 512; i++) {
        pte_t pte = kernelpt[i];
        if (pte & PTE_V) {
            kernelpt[i] = 0;
            if ((pte & (PTE_R | PTE_W | PTE_X)) == 0) {
                uint64 child = PTE2PA(pte);
                proc_free_kernelpt((pagetable_t)child);
            }
        }
    }
    kfree((void *)kernelpt);
}
+++

static void
freeproc(struct proc *p)
{
  if(p->trapframe)
    kfree((void*)p->trapframe);
  p->trapframe = 0;
+++
  uvmunmap(p->kernelpt, p->kstack, 1, 1);
  p->kstack = 0;
  if (p->kernelpt) { proc_free_kernelpt(p->kernelpt); }
  p->kernelpt = 0;
+++
  if(p->pagetable)
    proc_freepagetable(p->pagetable, p->sz);

}
```
@tab k\proc.h 
```c
struct proc {
+++
    pagetable_t kernelpt;        // 进程的内核页表
+++
}
```
:::

## 3. Simplify copyin/copyinstr 
:::code-tabs #shell
@tab:active k/defs.h 
```c
+++
void u2kvmcopy(pagetable_t, pagetable_t, uint64, uint64);
int copyin_new(pagetable_t, char*, uint64, uint64);
int copyinstr_new(pagetable_t, char*, uint64, uint64);
+++
```
@tab k/vm.c 
```c
+++
void u2kvmcopy(pagetable_t userpt, pagetable_t kernelpt, uint64 usersz,
               uint64 kernelsz) {
    pte_t *pte_from, *pte_to;
    usersz = PGROUNDUP(usersz);
    for (uint64 i = usersz; i < kernelsz; i += PGSIZE) {
        if ((pte_from = walk(userpt, i, 0)) == 0) {
            panic("u2kvmcopy: user pte does not exist.");
        }
        if ((pte_to = walk(kernelpt, i, 1)) == 0) {
            panic("u2kvmcopy: pte walk failed.");
        }
        uint64 pa = PTE2PA(*pte_from);
        uint flags = (PTE_FLAGS(*pte_from)) & (~PTE_U);
        *pte_to = PA2PTE(pa) | flags;
    }
}
+++

int copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len) {
--- 
***
--->>>
  return copyin_new(pagetable, dst, srcva, len);
>>>
}

int copyinstr(pagetable_t pagetable, char *dst, uint64 srcva, uint64 max) {
--- 
***
--->>>
  return copyin_new(pagetable, dst, srcva, len);
>>>

}
```

@tab k/proc.c 
```c
void userinit(void) {
... 
    // allocate one user page and copy init's instructions
    // and data into it.
    uvminit(p->pagetable, initcode, sizeof(initcode));
    p->sz = PGSIZE;
+++
    u2kvmcopy(p->pagetable, p->kernelpt, 0, 1);
+++
}

int growproc(int n) {
...
    sz = p->sz;
    if (n > 0) {
    if ((sz = uvmalloc(p->pagetable, sz, sz + n)) == 0) { return -1; }
+++
      // limit PLIC
      if (PGROUNDUP(sz + n) >= PLIC) { return -1; }
      u2kvmcopy(p->pagetable, p->kernelpt, sz - n, sz);
+++
}
int fork(void) {
..
    // copy saved user registers.
    *(np->trapframe) = *(p->trapframe);
    // Cause fork to return 0 in the child.
    np->trapframe->a0 = 0;
+++
    u2kvmcopy(np->pagetable, np->kernelpt, 0, np->sz);
+++
}
```
@tab k\exec.c 
```c
int exec(char *path, char **argv) {
...
    if ((sz1 = uvmalloc(pagetable, sz, sz + 2 * PGSIZE)) == 0) goto bad;
    sz = sz1;
    uvmclear(pagetable, sz - 2 * PGSIZE);
    sp = sz;
    stackbase = sp - PGSIZE;
+++
      u2kvmcopy(pagetable, p->kernelpt, 0, sz);
+++
    // Push argument strings, prepare rest of stack in ustack.
    for (argc = 0; argv[argc]; argc++) {
        if (argc >= MAXARG) goto bad;
        sp -= strlen(argv[argc]) + 1;
        sp -= sp % 16; // riscv sp must be 16-byte aligned
        if (sp < stackbase) goto bad;
        if (copyout(pagetable, sp, argv[argc], strlen(argv[argc]) + 1) < 0)
            goto bad;
        ustack[argc] = sp;
    }
}
```
:::




