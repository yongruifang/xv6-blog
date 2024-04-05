---
title: lab7-Multithreding
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/thread.html)

## 1. Uthread: switching between threads
**u\uthread.c** 
:::code-tabs #shell 
@tab :struct 
```c
+++
// 用户线程的上下文结构体
struct tcontext {
  uint64 ra;
  uint64 sp;

  // callee-saved
  uint64 s0;
  uint64 s1;
  uint64 s2;
  uint64 s3;
  uint64 s4;
  uint64 s5;
  uint64 s6;
  uint64 s7;
  uint64 s8;
  uint64 s9;
  uint64 s10;
  uint64 s11;
};
+++

struct thread {
+++
  struct tcontext context;
+++
}
```
@tab thread_schedule
```c
void
thread_schedule(void)
{
...
if(current_thread != next_thread) { /* switch threads?  */
    next_thread->state = RUNNING;
    t = current_thread;
    current_thread = next_thread;
    /* YOUR CODE HERE
     * Invoke thread_switch to switch from t to next_thread:
     * thread_switch(??, ??);
     */
+++
    thread_switch((uint64) &t->context, (uint64) &current_thread->context);
+++
  }else ...
}
```
@tab thread_create 
```c

void
thread_create(void (*func)())
{
...
  t->state = RUNNABLE;
  // YOUR CODE HERE
+++
  t->context.ra = (uint64) func;                  // 设定函数返回地址
  t->context.sp = (uint64) t->stack + STACK_SIZE; // 设定栈指针
+++
}
```
:::

**u\thread_switch.S**
:::code-tabs #shell
@tab u\thread_switch.S 
```S
thread_switch:
	/* YOUR CODE HERE */
+++
        sd ra, 0(a0)
        sd sp, 8(a0)
        sd s0, 16(a0)
        sd s1, 24(a0)
        sd s2, 32(a0)
        sd s3, 40(a0)
        sd s4, 48(a0)
        sd s5, 56(a0)
        sd s6, 64(a0)
        sd s7, 72(a0)
        sd s8, 80(a0)
        sd s9, 88(a0)
        sd s10, 96(a0)
        sd s11, 104(a0)

        ld ra, 0(a1)
        ld sp, 8(a1)
        ld s0, 16(a1)
        ld s1, 24(a1)
        ld s2, 32(a1)
        ld s3, 40(a1)
        ld s4, 48(a1)
        ld s5, 56(a1)
        ld s6, 64(a1)
        ld s7, 72(a1)
        ld s8, 80(a1)
        ld s9, 88(a1)
        ld s10, 96(a1)
        ld s11, 104(a1)
+++
	      ret    /* return to ra */
```
:::

## 2. Using threads 
:::code-tabs #shell 
@tab notxv6\ph.c 
```c
+++
pthread_mutex_t lock[NBUCKET] = {PTHREAD_MUTEX_INITIALIZER};
+++

static 
void put(int key, int value)
{
  int i = key % NBUCKET;
  ...

  if(e) {
    // update the existing key.
    e->value = value;
  }
  else {
    // the new is new.
+++
    pthread_mutex_lock(&lock[i]);
+++
    insert(key, value, &table[i], table[i]);
+++
    pthread_mutex_unlock(&lock[i]);
+++
  }
}
```
:::
## 3. Barrier
:::code-tabs #shell 
@tab notxv6\barrier.c  
```c
static void
barrier()
{
+++
  pthread_mutex_lock(&bstate.barrier_mutex);
  if(++bstate.nthread < nthread) {
    pthread_cond_wait(&bstate.barrier_cond, &bstate.barrier_mutex);
  }
  else {
    bstate.nthread = 0;
    bstate.round++;
    pthread_cond_broadcast(&bstate.barrier_cond);
  }
  pthread_mutex_unlock(&bstate.barrier_mutex);
+++
}
```
:::


