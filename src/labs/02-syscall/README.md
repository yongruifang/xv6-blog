---
title: lab02-system calls
icon: lightbulb
---

## 介绍
[实验说明](https://pdos.csail.mit.edu/6.828/2020/labs/syscall.html)

## 1. System calling tracking
:::code-tabs #shell
@tab Makefile
```Makefile
UPROGS = 
+++
$U/_trace\
+++
```

@tab u\user.h  
```c 
++
int trace(int);
++
```
@tab u\usys.pl 
```pl
++
entry("trace");
++
```
:::

:::code-tabs #shell 
@tab k\proc.c 
```c
int 
fork(void){
...
    safestrcpy(np->name, p->name, sizeof(p->name));
  +++
    np->trace_mask = p->trace_mask;
  +++
    pid = np->pid;
...
}
```
@tab k\proc.h 
```c
struct proc {
  +++
   int track_mask;
  +++
}
```
@tab k\syscall.c 
```c
+++
extern uint64 sys_trace(void);
+++
static uint64 (*syscalls[])(void) = {
  +++
   [SYS_trace] sys_trace,
  +++
}

+++
static char *syscalls_name[] = {
    [SYS_fork] "fork",   [SYS_exit] "exit",     [SYS_wait] "wait",
    [SYS_pipe] "pipe",   [SYS_read] "read",     [SYS_kill] "kill",
    [SYS_exec] "exec",   [SYS_fstat] "fstat",   [SYS_chdir] "chdir",
    [SYS_dup] "dup",     [SYS_getpid] "getpid", [SYS_sbrk] "sbrk",
    [SYS_sleep] "sleep", [SYS_uptime] "uptime", [SYS_open] "open",
    [SYS_write] "write", [SYS_mknod] "mknod",   [SYS_unlink] "unlink",
    [SYS_link] "link",   [SYS_mkdir] "mkdir",   [SYS_close] "close",
    [SYS_trace] "trace",
};
+++
void 
syscall(void) {
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]){
    p->trapframe->a0 = syscall[num]();
    +++
      if (1 << num & p->trace_mask) {
         printf("%d: syscall %s -> %d\n", p->pid, syscalls_name[num],
                   p->trapframe->a0);
      }
    +++
  }
}
```
@tab k\syscall.h 
```c
+++
#define SYS_trace 22 
+++
```

@tab k\sysproc.c 
```c
uint64 sys_trace(void) {
    argint(0, &(myproc()->trace_mask));
    return 0;
}
```
:::

## 2. Sysinfo 

:::code-tabs #shell
@tab Makefile
```Makefile
UPROGS = 
+++
$U/_sysinfo\
$U/_sysinfotest\
+++
```
@tab u\sysinfo.c 
```c 
#include "kernel/param.h"
#include "kernel/types.h"
#include "user/user.h"
#include "kernel/sysinfo.h"

int main(int argc, char* argv[]) {
    if (argc != 1) {
        fprintf(2, "sysinfo need not param\n", argv[0]);
        exit(1);
    }
    struct sysinfo info;
    sysinfo(&info);
    printf("free space:%d, used process num:%d\n", info.freemem, info.nproc);
    exit(0);
}
```

@tab u\user.h  
```c 
++
struct sysinfo;
++
++
int sysinfo(struct sysinfo*);
++
```
@tab u\usys.pl 
```pl
++
entry("sysinfo");
++
```
:::

:::code-tabs #shell 
@tab k\proc.c 
```c
+++
int proc_num(void) {
    struct proc *p;
    uint64 num = 0;
    for (p = proc; p < &proc[NPROC]; p++) {
        if (p->state != UNUSED) { num++; }
    }
    return num;
}
+++
```


@tab k\proc.h 
```c
struct proc {
  +++
   int track_mask;
  +++
}
```
@tab k\syscall.c 
```c
+++
extern uint64 sys_sysinfo(void);
+++


static uint64 (*syscalls[])(void) = {
+++
   [SYS_sysinfo] sys_sysinfo,
+++
}

static char *syscalls_name[] = {
+++
    [SYS_sysinfo] "sysinfo",
+++
};
```
@tab k\syscall.h 
```c
+++
#define SYS_sysinfo 23 
+++
```

@tab k\sysproc.c 
```c
+++
#include "sysinfo.h"
+++

+++
uint64 sys_sysinfo(void) {
    struct sysinfo info;
    uint64 addr;
    struct proc *p = myproc();
    if (argaddr(0, &addr) < 0) { return -1; }
    info.freemem = freemem_size();
    info.nproc = proc_num();
    if (copyout(p->pagetable, addr, (char *)&info, sizeof(info)) < 0) {
        return -1;
    }
    return 0;
}
+++
```
@tab k\kalloc.c 
```c 
+++
int freemem_size(void) {
    struct run *r;
    int num = 0;
    for (r = kmem.freelist; r; r = r->next) { num++; }
    return num * PGSIZE;
}
+++
```
@tab k\defs.h 
```c
// kalloc.c 
+++
int freemem_size(void);
+++

// proc.c 
+++
int proc_num(void); 
+++
```
:::


