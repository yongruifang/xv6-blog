---
title: lab8-Locks
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/lock.html)

## 1. Memory allocator 
**k\kalloc.c**
:::code-tabs #shell
@tab :kmem
```c
---
struct {
...
} kmem;
--->>>
struct kmem {
...
} kmemArray[NCPU];
>>>>

```
@tab :kinit 
```c
void
kinit()
{
---
  initlock(&kmem.lock, "kmem");
--->>> 
  for(int i = 0; i < NCPU; i++) {
    initlock(&(kmemArray[i].lock), "kmem");
  }
>>>
  // initlock(&kmem.lock, "kmem");
  freerange(end, (void *) PHYSTOP);
   r = (struct run *) pa;
---
  acquire(&kmem.lock);
  r->next = kmem.freelist;
  kmem.freelist = r;
  release(&kmem.lock);
--->>>
  push_off();
  int cpu_id = cpuid();
  acquire(&(kmemArray[cpu_id].lock));
  r->next = kmemArray[cpu_id].freelist;
  kmemArray[cpu_id].freelist = r;
  release(&(kmemArray[cpu_id].lock));
  pop_off();
>>>
}
```
@tab :kfree
```c 
void
kfree(void *pa)
{
...
  r = (struct run *) pa;
---
  acquire(&kmem.lock);
  r->next = kmem.freelist;
  kmem.freelist = r;
  release(&kmem.lock);
--->>>
  push_off();
  int cpu_id = cpuid();
  acquire(&(kmemArray[cpu_id].lock));
  r->next = kmemArray[cpu_id].freelist;
  kmemArray[cpu_id].freelist = r;
  release(&(kmemArray[cpu_id].lock));
  pop_off();
>>>
}
```
@tab :kalloc
```c 

void *
kalloc(void)
{
    struct run *r;
---
  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r)
    kmem.freelist = r->next;
  release(&kmem.lock);
--->>>
  push_off();
  int cpu_id = cpuid();
  acquire(&(kmemArray[cpu_id].lock));
  r = kmemArray[cpu_id].freelist;
  if(r) {
    kmemArray[cpu_id].freelist = r->next;
  }
  else {
    int i, j = 0;
    for(i = (cpu_id + 1) % NCPU; j < NCPU - 1; i = (i + 1) % NCPU, j++) {
      if(kmemArray[i].freelist) {
        acquire(&(kmemArray[i].lock));
        r = kmemArray[i].freelist;
        kmemArray[i].freelist = r->next;
        release(&(kmemArray[i].lock));
        break;
      }
    }
  }
  release(&(kmemArray[cpu_id].lock));
  pop_off();
>>>
}
```
:::

## 2. Buffer cache 
**k/bio.c**
:::code-tabs #shell
@tab struct 
```c
+++
#define NBUCKET 13
#define HASH(id) (id % NBUCKET)
+++

---
struct {
  struct spinlock lock;
  struct buf buf[NBUF];
  struct buf head;
} bcache; 
--->>> 
struct bMem {
  struct spinlock lock;
  struct buf head;
};
struct {
  struct buf buf[NBUF];
  struct bMem buckets[NBUCKET];
} bcache;
>>>
```

@tab :binit
```c
void
binit(void)
{
  struct buf *b;
  char lock_name[16];

  for(int i = 0; i < NBUCKET; i++) {
    initlock(&(bcache.buckets[i].lock), lock_name);
    bcache.buckets[i].head.prev = &bcache.buckets[i].head;
    bcache.buckets[i].head.next = &bcache.buckets[i].head;
  }

  // Create linked list of buffers
  // bcache.head.prev = &bcache.head;
  // bcache.head.next = &bcache.head;
  for(b = bcache.buf; b < bcache.buf + NBUF; b++) {
    b->next = bcache.buckets[0].head.next;
    b->prev = &bcache.buckets[0].head;
    initsleeplock(&b->lock, "buffer");
    bcache.buckets[0].head.next->prev = b;
    bcache.buckets[0].head.next = b;
  }
}
```
@tab bget
```c
bget(uint dev, uint blockno)
{
  struct buf *b;
  struct buf *lru_buf;

  uint64 bid = HASH(blockno);

  // acquire(&bcache.lock);
  acquire(&(bcache.buckets[bid].lock));

  // Is the block already cached?
  for(b = bcache.buckets[bid].head.next; b != &bcache.buckets[bid].head;
      b = b->next) {
    if(b->dev == dev && b->blockno == blockno) {
      b->refcnt++;
      acquire(&tickslock);
      b->timestamp = ticks;
      release(&tickslock);
      release(&(bcache.buckets[bid].lock));
      acquiresleep(&b->lock);
      return b;
    }
  }

  // Not cached.
  // Recycle the least recently used (LRU) unused buffer.
  // for(b = bcache.head.prev; b != &bcache.head; b = b->prev) {
  //   if(b->refcnt == 0) {
  //     b->dev = dev;
  //     b->blockno = blockno;
  //     b->valid = 0;
  //     b->refcnt = 1;
  //     release(&bcache.lock);
  //     acquiresleep(&b->lock);
  //     return b;
  //   }
  // }

  lru_buf = 0;
  for(int i = bid, cycle = 1; cycle <= NBUCKET;
      i = (i + 1) % NBUCKET, cycle++) {
    if(i != bid) {
      if(!holding(&bcache.buckets[i].lock)) {
        acquire(&bcache.buckets[i].lock);
      }
      else
        continue;
    }
    for(b = bcache.buckets[i].head.next; b != &bcache.buckets[i].head;
        b = b->next) {
      if(b->refcnt == 0 &&
          (lru_buf == 0 || b->timestamp < lru_buf->timestamp)) {
        lru_buf = b;
      }
    }
    if(lru_buf) {
      if(i != bid) {
        lru_buf->next->prev = lru_buf->prev;
        lru_buf->prev->next = lru_buf->next;
        release(&bcache.buckets[i].lock);
        lru_buf->next = bcache.buckets[bid].head.next;
        lru_buf->prev = &bcache.buckets[bid].head;
        bcache.buckets[bid].head.next->prev = lru_buf;
        bcache.buckets[bid].head.next = lru_buf;
      }
      lru_buf->dev = dev;
      lru_buf->blockno = blockno;
      lru_buf->valid = 0;
      lru_buf->refcnt = 1;
      acquire(&tickslock);
      lru_buf->timestamp = ticks;
      release(&tickslock);

      release(&bcache.buckets[bid].lock);
      acquiresleep(&lru_buf->lock);
      return lru_buf;
    }
    else {
      if(i != bid) {
        release(&bcache.buckets[i].lock);
      }
    }
  }
  panic("bget: no buffers");

@@ -101,53 +175,64 @@
  }
  return b;
}
```
@tab brelse
```c
void
brelse(struct buf *b)
{
  if(!holdingsleep(&b->lock))
    panic("brelse");
  releasesleep(&b->lock);

  // acquire(&bcache.lock);
  // b->refcnt--;
  // if(b->refcnt == 0) {
  //   // no one is waiting for it.
  //   b->next->prev = b->prev;
  //   b->prev->next = b->next;
  //   b->next = bcache.head.next;
  //   b->prev = &bcache.head;
  //   bcache.head.next->prev = b;
  //   bcache.head.next = b;
  // }
  //
  // release(&bcache.lock);
  int bid = HASH(b->blockno);
  acquire(&(bcache.buckets[bid].lock));
  b->refcnt--;
  acquire(&tickslock);
  b->timestamp = ticks;
  release(&tickslock);
  release(&(bcache.buckets[bid].lock));
}
```
@tab pin 
```c
void
bpin(struct buf *b)
{
  int bid = HASH(b->blockno);
  // acquire(&bcache.lock);
  acquire(&(bcache.buckets[bid].lock));
  b->refcnt++;
  release(&(bcache.buckets[bid].lock));
  // release(&bcache.lock);
}

void
bunpin(struct buf *b)
{
  int bid = HASH(b->blockno);
  acquire(&(bcache.buckets[bid].lock));
  b->refcnt--;
  release(&(bcache.buckets[bid].lock));
}
```
:::
**k/buf.h**
```c
struct buf {
+++
  uint timestamp;
+++
};
```
