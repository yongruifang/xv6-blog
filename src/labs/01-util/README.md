---
title: lab1-xv6和Unix工具包
icon: lightbulb
---

## 介绍
[实验说明](https://pdos.csail.mit.edu/6.828/2020/labs/util.html)

## 1. Boot xv6 

## 2. sleep
::: code-tabs #shell
@tab user\sleep.c
```c
#include "kernel/types.h"
#include "user/user.h"

int main(int argc, char const *argv[]) {
    if (argc != 2) {
        fprintf(2, "usage: sleep <time>\n");
        exit(1);
    }
    sleep(atoi(argv[1]));
    exit(0);
}
```
@tab:active Makefile 
```Makefile
UPROGS=\
+++
          $U/_sleep
+++

```
:::

## 3. pingpong 
:::code-tabs #shell 
@tab user\pingpong.c 
```c 

#include "kernel/types.h"
#include "user/user.h"

#define RD 0
#define WR 1


int main(int argc, char *argv[]) {
    int p1[2], p2[2];
    char buffer[] = {'X'};
    long length = sizeof(buffer);
    pipe(p1);
    pipe(p2);
    if (fork() == 0) {
        close(p1[1]);
        close(p2[0]);
        if (read(p1[0], buffer, length) != length) {
            printf("a -> b read error!\n");
            exit(1);
        }
        printf("%d: received ping\n", getpid());
        if (write(p2[1], buffer, length) != length) {
            printf("b -> a write error!\n");
            exit(1);
        }
        exit(0);
    }

    close(p1[0]);
    close(p2[1]);
    if (write(p1[1], buffer, length) != length) {
        printf("a -> b write error!\n");
        exit(1);
    }
    printf("%d: received pong\n", getpid());
    if (read(p2[0], buffer, length) != length) {
        printf("b -> a read error!\n");
        exit(1);
    }
    wait(0);
    exit(0);
}
```
@tab:active Makefile
```Makefile
UPROGS=\
+++
          $U/_pingpong
+++

```
:::

## 4. primes
:::code-tabs #shell 
@tab user\primes.c
```c
#include "kernel/types.h"
#include "user/user.h"

void func(int *input, int num) {
    if (num == 1) {
        printf("prime %d\n", *input);
        return;
    }
    int p[2], i;
    int prime = *input;
    int tmp;
    printf("prime %d\n", prime); // 1st element of input is a prime
    pipe(p);
    if (fork() == 0) {
        // creat a process, convey the inputs to the pipe
        for (i = 0; i < num; i++) {
            tmp = *(input + i);
            write(p[1], (char *)(&tmp), 4);
        }
        exit(0);
    }
    // stop write
    close(p[1]);
    if (fork() == 0) {
        // create another process, read data from pipe, and fileter
        int counter = 0;
        char buffer[4];
        while (read(p[0], buffer, 4) != 0) {
            // read one input a time
            tmp = *((int *)buffer);
            // start filter
            if (tmp % prime != 0) {
                // reserve
                *input = tmp;
                input += 1;
                counter++;
            }
        }
        // recurse
        func(input - counter, counter);
        exit(0);
    }
    wait(0);
    wait(0);
}
int main() {
    // expect : output 34 primes starts from 2
    int input[34];
    int i = 0;
    for (; i < 34; i++) {
        // pre-process, 2, 3, 5, 7, 9, ... (filter the 1st prime's multiple)
        input[i] = i + 2;
    }
    func(input, 34);
    exit(0);
}
```
@tab:active Makefile
```Makefile
UPROGS=\
+++
          $U/_primes
+++

```
:::

## 5. find
:::code-tabs #shell 
@tab user\find.c
```c
#include "kernel/types.h"
#include "kernel/fcntl.h"
#include "kernel/stat.h"
#include "kernel/fs.h"
#include "user/user.h"

/*
 * desc: formatting the path to filename
 * @path: with some slash
 * @return: pure file name
 */
char *fmt_name(char *path) {
    static char buf[DIRSIZ + 1];
    char *p;
    // find 1st character after last slash
    for (p = path + strlen(path); p >= path && *p != '/'; p--);
    p++;
    memmove(buf, p, strlen(p) + 1);
    return buf;
}

/*
 * desc: print full filepath if exists
 * @path: the full path of file
 * @file_name: file_name
 */
int eq_print(char *full_path, char *file_name) {
    if (strcmp(fmt_name(full_path), file_name) == 0) {
        printf("%s\n", full_path);
        return 1;
    }
    return 0;
}

/*
 * desc: find file_name in the given path
 * @dir_path: the search path
 * @file_name: the target
 */
int find(char *dir_path, char *file_name) {
    char buf[512], *p;
    int fd;
    struct dirent de;
    struct stat st;
    int count = 0;
    if ((fd = open(dir_path, O_RDONLY)) < 0) {
        fprintf(2, "find: cannot open %s, invalid path\n", dir_path);
        return 0;
    }
    // fstat: from stat, we can read the fd->type
    if (fstat(fd, &st) < 0) {
        fprintf(2, "find: cannot stat %s\n", dir_path);
        close(fd);
        return 0;
    }
    switch (st.type) {
        case T_FILE:
            // the dir_path is just a file , so no find required, match directly
            count += eq_print(dir_path, file_name);
            break;
        case T_DIR:
            if (strlen(dir_path) + 1 + DIRSIZ + 1 > sizeof buf) {
                printf("find: dir_path too long\n");
                break;
            }
            strcpy(buf, dir_path);
            // p -> jump to the end of buf
            p = buf + strlen(buf);
            // append slash to buf
            *p++ = '/';
            // read, continuously fetch the dirent info from fd
            while (read(fd, &de, sizeof(de)) == sizeof(de)) {
                // inum = 0, means empty , inum = 1, means root dir
                if (de.inum == 0) {
                    // empty
                    continue;
                }
                if (strcmp(de.name, ".") == 0 || strcmp(de.name, "..") == 0) {
                    continue;
                }
                memmove(p, de.name, DIRSIZ); // append de.name to buf
                *(p + DIRSIZ) = 0;           // append \0
                // note: p's position no change during loop
                count += find(buf, file_name);
            }
            break;
    }
    close(fd);
    return count;
}

int main(int argc, char *argv[]) {
    int count = 0;
    if (argc < 2 || argc < 3) {
        printf("find: find <path> <file_name> \n");
        exit(0);
    }
    if (argc == 2) {
        // default
        count = find(".", argv[1]);
    }
    if (argc == 3) { count = find(argv[1], argv[2]); }
    if (count == 0) { printf("cannot find %s \n", argv[2]); }
    exit(0);
}
```

@tab:active Makefile
```Makefile
UPROGS=\
+++
          $U/_find
+++

```
:::
## 5. xargs
:::code-tabs #shell 
@tab user\xargs.c 
```c
#include "kernel/types.h"
#include "user/user.h"

int main(int argc, char *argv[]) {
    int i;
    int j = 0;
    int k;
    int l, m = 0;
    char block[32];
    char buf[32];
    char *p = buf;
    char *line_split[32];

    for (i = 1; i < argc; i++) { line_split[j++] = argv[i]; }

    while ((k = read(0, block, sizeof(block))) > 0) {
        for (l = 0; l < k; l++) {
            if (block[l] == '\n') {
                buf[m] = 0;
                m = 0;
                line_split[j++] = p;
                p = buf;
                line_split[j] = 0;
                j = argc - 1;
                if (fork() == 0) { exec(argv[1], line_split); }
                wait(0);
            } else if (block[l] == ' ') {
                buf[m++] = 0;
                line_split[j++] = p;
                p = &buf[m];
            } else {
                buf[m++] = block[l];
            }
        }
    }
    exit(0);
}
```

@tab:active Makefile
```Makefile
UPROGS=\
+++
          $U/_xargs
+++

```

:::
