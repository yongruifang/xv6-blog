---
title: lab4-Traps
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/traps.html)

## 1. RISC-V assembly 

## 2. Backtrace 
:::code-tabs #shell 
@tab defs.h 
```c
+++
void backtrace();
+++
```

@tab k/printf.c 
```c

void backtrace() {
    printf("backtrace:\n");
    uint64 *fp = (uint64 *)r_fp();
    uint64 up = PGROUNDUP((uint64)fp);
    uint64 *ra;
    while ((uint64)fp != up) {
        fp = (uint64 *)((uint64)fp - 16);
        ra = (uint64 *)((uint64)fp + 8);
        printf("%p\n", *ra);
        fp = (uint64 *)*fp;
    }
}
```

@tab k\sysproc.c 
```c
uint64
sys_sleep(void)
{
  ...
    release(&tickslock);
+++
    backtrace();
+++

    return 0;
}
```

:::

## 3. Alarm

### test0 : invoke handler 

:::code-tabs #shell 
@tab Makefile
```Makefile
UPROGS=\
...
+++
	$U/_alarmtest\
+++
```

@tab u\usys.pl 
```perl
entry("sigalarm");
entry("sigreturn");
```

@tab u\user.h 
```c
+++
int sigalarm(int ticks, void (*handler)());
int sigreturn(void);
+++
```

@tab k\proc.h 
```c
struct proc {
+++
    uint64 alarm_interval;
    void (*alarm_handler)();
    uint64 ticks_count; // between 2 alarm 
+++
}
```

@tab k\syscall.h 
```c 
+++
#define SYS_sigalarm 22
#define SYS_sigreturn 23 
+++
```
:::

:::code-tabs #shell 
@tab k/syscall.c 
```c
+++
extern uint64 sys_sigalarm(void);
extern uint64 sys_sigreturn(void);
+++
static uint64 (*syscalls[])(void) = {
+++
[SYS_sigalarm] sys_sigalarm,
[SYS_sigreturn] sys_sigreturn,
+++
}
```
@tab k/sysproc.c 
```c 
+++
uint64 sys_sigalarm(void) {
    struct proc* my_proc = myproc();
    int n;
    uint64 handler;
    if (argint(0, &n) < 0) { return -1; }
    my_proc->alarm_interval = n;
    if (argaddr(1, &handler) < 0) { return -1; }
    my_proc->alarm_handler = (void (*)())handler;
    return 0;
}
uint64 sys_sigreturn(void) { return 0; }
+++
```

@tab k/trap.c 
```c
void usertrap(void) {
...
    if (p->killed) exit(-1);

    // give up the CPU if this is a timer interrupt.
    if (which_dev == 2)
  {
+++
      p->ticks_count = p->ticks_count + 1;
      if (p->ticks_count == p->alarm_interval) {
         p->trapframe->epc = (uint64)p->alarm_handler;
         p->ticks_count = 0;
      }
+++
    yield();
  }

}
```
:::
### test1 / test2 : resume interrupted code 

:::code-tabs #shell 
@tab k\proc.h 
```c
struct proc {
+++
    int is_alarming;
    struct trapframe *alarm_trapframe;
+++
}
```
@tab k\proc.c 
```c
static struct proc *allocproc(void) {
...

found:
    p->pid = allocpid();

    // Allocate a trapframe page.
    if ((p->trapframe = (struct trapframe *)kalloc()) == 0) {
        release(&p->lock);
        return 0;
    }

+++
    if ((p->alarm_trapframe = (struct trapframe *)kalloc()) == 0) {
        freeproc(p);
        release(&p->lock);
        return 0;
    }
    p->is_alarming = 0;
    p->alarm_interval = 0;
    p->alarm_handler = 0;
    p->ticks_count = 0;
+++
    // An empty user page table.
  ...
}

static void
freeproc(struct proc *p) {
  if(p->trapframe)
    kfree((void*)p->trapframe);
+++
    if (p->alarm_trapframe) kfree((void *)p->alarm_trapframe);
    p->is_alarming = 0;
    p->alarm_interval = 0;
    p->alarm_handler = 0;
    p->ticks_count = 0;
+++
    p->trapframe = 0;
  if(p->pagetable)
    proc_freepagetable(p->pagetable, p->sz);
}
```

@tab k\sysproc.c 
```c
uint64 sys_sigreturn(void) {
  +++
    memmove(myproc()->trapframe, myproc()->alarm_trapframe,
            sizeof(struct trapframe));
    myproc()->is_alarming = 0;
  +++
    return 0;
}
```
:::


