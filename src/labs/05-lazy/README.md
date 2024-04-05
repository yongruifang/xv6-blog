---
title: lab05-xv6 lazy page allocation
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/lazy.html)

## 1. Eliminate allocation from sbrk()
:::code-tabs #shell
@tab k\sysproc.c 
```c
uint64
sys_sbrk(void) {
---
  if(growproc(n) < 0)
    return -1;
---

+++
  myproc()->sz += n;
+++
}

```
:::


## 2. Lazy allocation 

:::code-tabs #shell 
@tab k\vm.c 
```c
void
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free)
{
  ..
  ..
  for(a = va; a < va + npages * PGSIZE; a += PGSIZE) {

    if((pte = walk(pagetable, a, 0)) == 0)
      panic("uvmunmap: walk");
    if((*pte & PTE_V) == 0)
---     
      panic("uvmunmap: not mapped");
---
+++
      continue;
+++
  }
}
```
@tab:active k\trap.c 
```c

void
usertrap(void)
{
..
..
  else if((which_dev = devintr()) != 0) {
    // ok
  } 
+++
  else if(r_scause() == 13 || r_scause() == 15) {
    uint64 fault_va = r_stval(); 
    char *mem = kalloc();
    if(mem == 0) {
      p->killed = 1; 
    }
    else{
      memset(mem, 0 , PGSIZE);
      if(mappages(p->pagetable, PGROUNDDOWN(fault_va), PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0) {
        p->killed = 1;
      }
    }
  }
+++
  else ...
}
```
:::


## 3. Lazytests and Usertests 
:::code-tabs #shell 
@tab k\vm.c 
```c
+++
#include "spinlock.h"
#include "proc.h"
+++

void
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free)
{
...
  for(a = va; a < va + npages * PGSIZE; a += PGSIZE) {
    if((pte = walk(pagetable, a, 0)) == 0)
----
      panic("uvmunmap: walk");
--- >>> continue;
}

/******************************************/

int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
..
  for(i = 0; i < sz; i += PGSIZE) {
    if((pte = walk(old, i, 0)) == 0)
---
      panic("uvmcopy: pte should exist");
--- >>> continue;
    if((*pte & PTE_V) == 0)
---
      panic("uvmcopy: page not present");
--->>> continue;
}
/******************************************/
int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0) {
    va0 = PGROUNDDOWN(dstva);
    pa0 = walkaddr(pagetable, va0);
  
  ---
  if(pa0 == 0) return -1;
  --->>>
  if(pa0 == 0) {
      if(dstva >= myproc()->sz) {
        return -1;
      }
      char *mem = kalloc();
      pa0 = (uint64) mem;
      memset(mem, 0, PGSIZE);
      mappages(pagetable, va0, PGSIZE, pa0, PTE_W | PTE_X | PTE_R | PTE_U);
    }
>>>
  n = PGSIZE - (dstva - va0);
  ...
  }
}
/******************************************/
int
copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0) {
    va0 = PGROUNDDOWN(srcva);
    pa0 = walkaddr(pagetable, va0);
---
    if(pa0 == 0) return -1;
--- >>>
    if(pa0 == 0) {
      if(srcva >= myproc()->sz)
        return -1;
      char *mem = kalloc();
      pa0 = (uint64) mem;
      memset(mem, 0, PGSIZE);
      mappages(pagetable, va0, PGSIZE, pa0, PTE_W | PTE_X | PTE_R | PTE_U);
    }
>>>
    n = PGSIZE - (srcva - va0);
    ...
  }
}

```
@tab:active k\trap.c 
```c
void
usertrap(void)
{
...
  else if(r_scause() == 13 || r_scause() == 15) {
    uint64 fault_va = r_stval();
+++
    if(fault_va >= p->sz) {
      p->killed = 1;
    } else {
      uint64 protectTop = PGROUNDDOWN(p->trapframe->sp); 
      uint64 stvalTop = PGROUNDUP(fault_va);
      if(protectTop != stvalTop) {
      else {
<<< < the part filled just now >>>>
        char *mem = kalloc();
        if(mem == 0) {
          p->killed = 1;
        }
        else{ 
          memset(mem, 0 , PGSIZE);
          if(mappages(p->pagetable, PGROUNDDOWN(fault_va), PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0) {
            p->killed = 1;
          }
        }
        ...
<<< < / the part filled just now >>>>
      }
    }
+++

  } else {
    ...
  }

}
```
@tab k\sysproc.c
```c
uint64
sys_sbrk(void)
{
uint64
sys_sbrk(void)
{

  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;

  addr = myproc()->sz;
+++
  struct proc *p = myproc();
  uint64 new_size = addr + n;
  if(new_size >= MAXVA) {
    return addr;
  }
  if(n < 0) {
    if(new_size > addr) {
      new_size = 0;
      uvmunmap(p->pagetable, 0, PGROUNDUP(addr) / PGSIZE, 1);
    }
    else {
      uvmunmap(p->pagetable, PGROUNDUP(new_size),
          (PGROUNDUP(addr) - PGROUNDUP(new_size)) / PGSIZE, 1);
    }
  }
  p->sz = new_size;
+++
  // if(growproc(n) < 0)
  //   return -1;

  // lazy allocation
---
  myproc()->sz += n;
---
  return addr;
}
}
```
:::

