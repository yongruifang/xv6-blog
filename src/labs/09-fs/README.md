---
title: lab9-file system
icon: lightbulb
---

## 介绍
[实验介绍](https://pdos.csail.mit.edu/6.828/2020/labs/fs.html)

## 1. Large files 
:::code-tabs #shell
@tab k\fs.h 
```c
---
#define NDIRECT 12
--->>> #define NDIRECT 11 
---
#define MAXFILE (NDIRECT + NINDIRECT)
--->>> #define MAXFILE (NDIRECT + NINDIRECT + NINDIRECT * NINDIRECT)

struct dinode {
...
---
  uint addrs[NDIRECT+1];
--->>>  uint addrs[NDIRECT + 2];
}
```
@tab k\file.h 
```c
struct inode {
...
---
  uint addrs[NDIRECT+1];
--->>> uint addrs[NDIRECT + 2];
}
```
@tab k\fs.c:bmap
```c 
static uint
bmap(struct inode *ip, uint bn)
{
...
  if(bn < NINDIRECT) {
    ...
  }
+++
  bn -= NINDIRECT;

  if(bn < NINDIRECT * NINDIRECT) { // doubly-indirect
    // Load indirect block, allocating if necessary.
    if((addr = ip->addrs[NDIRECT + 1]) == 0)
      ip->addrs[NDIRECT + 1] = addr = balloc(ip->dev);
    bp = bread(ip->dev, addr);
    a = (uint *) bp->data;
    if((addr = a[bn / NINDIRECT]) == 0) {
      a[bn / NINDIRECT] = addr = balloc(ip->dev);
      log_write(bp);
    }
    brelse(bp);
    bn %= NINDIRECT;
    bp = bread(ip->dev, addr);
    a = (uint *) bp->data;
    if((addr = a[bn]) == 0) {
      a[bn] = addr = balloc(ip->dev);
      log_write(bp);
    }
    brelse(bp);
    return addr;
  }
+++
  panic("bmap: out of range");
}
```

@tab k\fs.c :itrunc
```c 

void
itrunc(struct inode *ip)
{
...
  if(ip->addrs[NDIRECT]) {
    ...
  }
+++
  if(ip->addrs[NDIRECT + 1]) {
    bp = bread(ip->dev, ip->addrs[NDIRECT + 1]);
    a = (uint *) bp->data;
    for(j = 0; j < NINDIRECT; j++) {
      if(a[j]) {
        struct buf *bp2 = bread(ip->dev, a[j]);
        uint *a2 = (uint *) bp2->data;
        for(int k = 0; k < NINDIRECT; k++) {
          if(a2[k])
            bfree(ip->dev, a2[k]);
        }
        brelse(bp2);
        bfree(ip->dev, a[j]);
      }
    }
    brelse(bp);
    bfree(ip->dev, ip->addrs[NDIRECT + 1]);
    ip->addrs[NDIRECT + 1] = 0;
  }
+++
  ip->size = 0;
  iupdate(ip);
}
```
:::

## 2. Symbolic links 
:::code-tabs #shell 
@tab Makefile 
```Makefile 
UPROGS=\
...
+++
	$U/_symlinktest\
+++
```
@tab k\fcntl.h 
```c
#define O_RDONLY 0x000
#define O_WRONLY 0x001
#define O_RDWR 0x002
#define O_CREATE 0x200
+++
#define O_TRUNC 0x400
+++
```
@tab k\stat.h 
```c
#define T_DIR 1    // Directory
#define T_FILE 2   // File
#define T_DEVICE 3 // T_DEVICE 
+++
#define T_SYMLINK 4 
+++
```
@tab k\syscall.h 
```c
#define SYS_link 19
#define SYS_mkdir 20
#define SYS_close 21
+++
#define SYS_symlink 22 
+++
```
@tab k\syscall.c 
```c
+++
extern uint64 sys_symlink(void);
+++


static uint64 (*syscalls[])(void) = {
+++
    [SYS_symlink] sys_symlink,
+++
}
```
@tab u\user.h 
```c
+++
int symlink(char *, char *);
+++
```

@tab u\usys.pl 
```perl
+++
entry("symlink");
+++
```
:::

**k\sysfile.c** 

:::code-tabs #shell 
@tab sys_symlink 
```c
uint64
sys_symlink(void)
{
  struct inode *ip;
  char target[MAXPATH], path[MAXPATH];
  if(argstr(0, target, MAXPATH) < 0 || argstr(1, path, MAXPATH) < 0)
    return -1;

  begin_op();

  ip = create(path, T_SYMLINK, 0, 0);
  if(ip == 0) {
    end_op();
    return -1;
  }

  // use the first data block to store target path.
  if(writei(ip, 0, (uint64) target, 0, strlen(target)) < 0) {
    end_op();
    return -1;
  }

  iunlockput(ip);

  end_op();
  return 0;
}
```
@tab sys_open
```c
uint64
sys_open(void)
{
...
  if(omode & O_CREATE) {
    ip = create(path, T_FILE, 0, 0);
    if(ip == 0) {
      end_op();
      return -1;
    }
    else {
---
      if((ip = namei(path)) == 0) {
        end_op();
        return -1;
      }
      ilock(ip);
--->>>
    int symlink_depth = 0;
    while(1) {
      if((ip = namei(path)) == 0) {
        end_op();
        return -1;
      }
      ilock(ip);
      if(ip->type == T_SYMLINK && (omode & O_NOFOLLOW) == 0) {
        if(++symlink_depth > 10) {
          iunlockput(ip);
          end_op();
          return -1;
        }
        if(readi(ip, 0, (uint64) path, 0, MAXPATH) < 0) {
          iunlockput(ip);
          end_op();
          return -1;
        }
        iunlockput(ip);
      }
      else {
        break;
      }
>>>>>
    }

}
```
:::

