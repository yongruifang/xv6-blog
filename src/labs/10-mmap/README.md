---
title: lab10-Mmap
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/mmap.html)

## 1. mmap 

:::code-tabs #shell 
@tab Makefile
```Makefile 
OBJS = \
...
  $K/virtio_disk.o \
+++
  $K/vma.o 
+++

 UPROGS=\
...
+++
	$U/_mmaptest\
+++
```

@tab k\defs.h 
```c
// proc.c 
+++
int lazy_grow_proc(int);
+++

+++
// vma.c
void vma_init(void);
struct vm_area_struct *vma_alloc(void);
void vma_free(struct vm_area_struct *);
+++
```
@tab k\main.c 
```c
    fileinit();         // file table
    virtio_disk_init(); // emulated hard disk
    userinit();         // first user process
+++
    vma_init();
+++
    __sync_synchronize();
```
@tab k\proc.h
```c
struct proc {
...
+++
  struct vm_area_struct *areaps[NOFILE];
+++
}
```
@tab k\syscall.h 
```c
+++
#define SYS_mmap 22
#define SYS_munmap 23 
+++
```
@tab k\syscall.c 
```c
+++
extern uint64 sys_mmap(void);
extern uint64 sys_munmap(void);
+++

static uint64 (*syscalls[])(void) = {
+++
    [SYS_mmap] sys_mmap,
    [SYS_munmap] sys_munmap,
+++
}
```
@tab u\user.h 
```c
// system calls
+++
char *mmap(char *addr, int length, int prot, int flags, int fd, int offset);
int munmap(void *addr, int length);
+++
```

@tab u\usys.pl 
```perl
+++
entry("mmap");
entry("munmap");
+++
```
:::


:::code-tabs #shell 
@tab k\vma.h(new) 
```c
+++
struct vm_area_struct {
  char *addr;
  uint64 length;
  char prot;
  char flags;
  struct file *file;
};
+++
```
@tab k\vma.c 
```c
#include "types.h"
#include "riscv.h"
#include "defs.h"
#include "param.h"
#include "fs.h"
#include "spinlock.h"
#include "sleeplock.h"
#include "file.h"
#include "vma.h"

struct {
  struct spinlock lock;
  struct vm_area_struct areas[NOFILE];
} vma_table;

void
vma_init(void)
{
  initlock(&vma_table.lock, "vma table");
}

struct vm_area_struct *
vma_alloc(void)
{
  struct vm_area_struct *vmap;
  acquire(&vma_table.lock);

  for(vmap = vma_table.areas; vmap < vma_table.areas + NOFILE; vmap++) {
    if(vmap->file == 0) {
      release(&vma_table.lock);
      return vmap;
    }
  }
  release(&vma_table.lock);
  return 0;
}

void
vma_free(struct vm_area_struct *vmap)
{
  vmap->file = 0;
}
```
@tab k\proc.c 
```c
#include "spinlock.h"
#include "proc.h"
#include "defs.h"
+++
#include "sleeplock.h"
#include "fs.h"
#include "file.h"
#include "vma.h"
#include "fcntl.h"
+++

fork(void) {
...
  // Copy user memory from parent to child.
  if(uvmcopy(p->pagetable, np->pagetable, p->sz) < 0) {
    freeproc(np);
    release(&np->lock);
    return -1;
  }

+++
  for(i = 0; i < NOFILE; i++) {
    if(p->areaps[i]) {
      np->areaps[i] = vma_alloc();
      np->areaps[i]->addr = p->areaps[i]->addr;
      np->areaps[i]->length = p->areaps[i]->length;
      np->areaps[i]->prot = p->areaps[i]->prot;
      np->areaps[i]->flags = p->areaps[i]->flags;
      np->areaps[i]->file = p->areaps[i]->file;
      filedup(p->areaps[i]->file);
    }
  }
+++

}

exit(int status) {
  struct proc *p = myproc();

  if(p == initproc)
    panic("init exiting");

  // Close all open files.
+++
  for(int i = 0; i < NOFILE; i++) {
    // if(p->ofile[fd]) {
    //   struct file *f = p->ofile[fd];
    //   fileclose(f);
    //   p->ofile[fd] = 0;
    // }
    if(p->areaps[i]) {
      struct vm_area_struct *vmap = p->areaps[i];
      if(vmap->prot & PROT_WRITE && vmap->flags == MAP_SHARED) {
        begin_op();
        ilock(vmap->file->ip);
        writei(vmap->file->ip, 1, (uint64) vmap->addr, 0, vmap->length);
        iunlock(vmap->file->ip);
        end_op();
      }
      fileclose(vmap->file);
      vma_free(vmap);
      p->areaps[i] = 0;
    }
  }
+++
}


+++
int
lazy_grow_proc(int n)
{
  struct proc *p = myproc();
  p->sz = p->sz + n;
  return 0;
}
+++
```

@tab k\sysfile.c : sys_mmap 
```c
+++
#include "vma.h"
+++

+++
uint64
sys_mmap(void)
{
  struct vm_area_struct *vmap;
  struct proc *p;
  int length, prot, flags, fd, i;
  uint64 sz;
  if(argint(1, &length) < 0 || argint(2, &prot) < 0 || argint(3, &flags) < 0 ||
      argint(4, &fd) < 0) {
    return 0xffffffffffffffff; // 0x ffff_ffff_ffff_ffff
  }
  p = myproc();
  if(!p->ofile[fd]->readable) {
    if(prot & PROT_READ) {
      return 0xffffffffffffffff;
    }
  }
  if(!p->ofile[fd]->writable) {
    if(prot & PROT_WRITE && flags == MAP_SHARED) {
      return 0xffffffffffffffff;
    }
  }
  if((vmap = vma_alloc()) == 0) {
    return 0xffffffffffffffff;
  }
  acquire(&p->lock);

  for(i = 0; i < NOFILE; i++) {
    if(p->areaps[i] == 0) {
      p->areaps[i] = vmap;
      release(&p->lock);
      break;
    }
  }
  if(i == NOFILE) {
    return 0xffffffffffffffff;
  }
  sz = p->sz;
  if(lazy_grow_proc(length) < 0) {
    return 0xffffffffffffffff;
  }
  vmap->addr = (char *) sz;
  vmap->length = length;
  vmap->prot = (prot & PROT_READ) | (prot & PROT_WRITE);
  vmap->flags = flags;
  vmap->file = p->ofile[fd];
  filedup(p->ofile[fd]);
  return sz;
}
+++

```

@tab k\sysfile.c :sys_munmap 
```c
+++
uint64
sys_munmap(void)
{
  struct proc *p = myproc();
  int start_addr, length;
  if(argint(0, &start_addr) < 0 || argint(1, &length) < 0) {
    return -1;
  }
  for(int i = 0; i < NOFILE; i++) {
    if(p->areaps[i] == 0) {
      continue;
    }
    if((uint64) p->areaps[i]->addr == start_addr) {
      if(length >= p->areaps[i]->length) {
        length = p->areaps[i]->length;
      }
      if(p->areaps[i]->prot & PROT_WRITE && p->areaps[i]->flags == MAP_SHARED) {
        begin_op();
        ilock(p->areaps[i]->file->ip);
        writei(p->areaps[i]->file->ip, 1, (uint64) start_addr, 0, length);
        iunlock(p->areaps[i]->file->ip);
        end_op();
      }
      uvmunmap(p->pagetable, (uint64) start_addr, length / PGSIZE, 1);
      if(length == p->areaps[i]->length) {
        fileclose(p->areaps[i]->file);
        vma_free(p->areaps[i]);
        p->areaps[i] = 0;
        return 0;
      }
      else {
        p->areaps[i]->addr += length;
        p->areaps[i]->length -= length;
        return 0;
      }
    }
  }
  return -1;
}
+++
```

:::

:::code-tabs #shell 
@tab k\vm.c 
```c
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free) {
...
    if((*pte & PTE_V) == 0)
---
      panic("uvmunmap: not mapped");
--- >>> continue;
}

uvmcopy(pagetable_t old, pagetable_t new, uint64 sz) {
...
    if((*pte & PTE_V) == 0)
---
      panic("uvmcopy: page not present");
--- >>> continue;
}

```
@tab k\trap.c 
```c
// #include "riscv.h"
// +++
//   #include "fs.h"
// +++
//
// #include "spinlock.h"
// +++
//   #include "sleeplock.h"
// +++
//
// #include "proc.h"
// #include "defs.h"
//
// +++
//   #include "file.h"
//   #include "vma.h"
//   #include "fcntl.h"
// +++
//
+++
  #include "fs.h"
  #include "sleeplock.h"
  #include "file.h"
  #include "vma.h"
  #include "fcntl.h"
+++
void
usertrap(void)
{
...
  else if((which_dev = devintr()) != 0) {
    // ok
  }
+++
          addr = (uint64) (p->areaps[i]->addr);
          if(addr <= stval && stval < addr + p->areaps[i]->length) {
            vmap = p->areaps[i];
            break;
          }
        }
        if(i != NOFILE) {
          char *mem = kalloc();
          int prot = PTE_U;
          if(mem == 0) {
            p->killed = 1;
          }
          else {
            memset(mem, 0, PGSIZE);
            ilock(vmap->file->ip);
            readi(vmap->file->ip, 0, (uint64) mem, PGROUNDDOWN(stval - addr),
                PGSIZE);
            iunlock(vmap->file->ip);
            if(vmap->prot & PROT_READ) {
              prot |= PTE_R;
            }
            if(vmap->prot & PROT_WRITE) {
              prot |= PTE_W;
            }
            if(mappages(p->pagetable, PGROUNDDOWN(stval), PGSIZE, (uint64) mem,
                   prot) != 0) {
              kfree(mem);
              p->killed = 1;
            }
          }
        }
        else {
          p->killed = 1;
        }
      }
    }
  }
+++
else ...

}
```

:::
