---
title: 'MIT-6.S081-Lab1: XV6 and Unix utilities'
date: 2025-02-27 21:28:25
categories: 6.s081
tags: [操作系统, 系统调用, Linux, 6.s081]
---
# 知识点

这个Lab跟后面的Lab都不一样，其核心任务在于开发调用系统系统调用的应用程序，而非聚焦课程的核心目标——实现操作系统内核功能与扩展开发（如最终实验的网络协议栈实现）。

但是我们应当注意，尽管我们正在编写C语言程序，然后用 shell 去运行它，但这并不意味着 shell 更加底层。事实上，反而C更加底层，shell 也常常是采用c编写的，内核也用C来编写。
尽管编写 shell 是编写操作系统的一部分，但 shell 并不属于内核，而是一个用户态程序，通过调用系统调用来启动其他程序。

XV6 基于 RISC-V 指令集架构设计，在 6.S081 课程中通过 QEMU 模拟硬件,以实现完整的指令集级仿真运行环境。
## 常见系统调用

这些是常见的系统调用，当我们在 shell 里面运行程序的时候，比如 `ls`，它会依次调用 `fork`,`exec`,`wait`,`exit`，而 `cd` 则是直接调用 `chdir`。

- 进程和内存
    ### `fork()`
    - **参数**：无  
    - **返回值**：  
        - 父进程返回子进程 PID（正整数）  
        - 子进程返回 0  
    - **作用**：复制当前进程内存空间创建新进程  
    - **注意事项**：  
        - 单次调用双重返回（父/子进程各执行一次后续代码）  
        - 父子进程执行流异步，控制台输出可能交错，这也是共享文件偏移量带来的结果  
    - **特点**：  
        - 新进程与原进程拥有相同的内存副本  
        - 通过返回值区分父子进程执行环境  
    - **改进**
        后续我们将在Lab6实现写时复制分支（COW）之类的技巧，在我们 `fork`后面紧跟着 `exec` 之类的操作的时候不进行复制。

    ### `exit(int status)`
    - **参数**：进程终止状态码（整型）  
    - **返回值**：无（进程直接终止）  
    - **作用**：立即终止调用进程并释放资源  
    - **注意事项**：  
        - 自动回收内存、关闭文件描述符等内核资源  
        - 终止状态可通过 `wait` 系统调用被父进程获取  
    - **特点**：  
        - 状态码遵循 UNIX 规范（0 表示成功）

    ### `wait(int *status)`
    - **参数**：存储子进程退出状态的地址指针（可为 `NULL`）  
    - **返回值**：被回收子进程的 PID（失败返回 -1）  
    - **作用**：等待任意子进程终止  
    - **注意事项**：  
        - 若无已终止子进程，将阻塞直到子进程退出  
        - 当多个子进程存在时，按终止顺序处理  

    ### `exec(const char *filename, char *const argv[])`
    - **参数**：  
        - 可执行文件路径（字符串）  
        - 参数指针数组（以空指针结尾）  
    - **返回值**：成功时不返回，失败返回 -1  
    - **作用**：允许一个进程在执行过程中被另一个程序完全替换，并从头开始执行新程序。原有进程的代码、数据、堆栈等（内存）被完全替换而进程的标识符和文件描述符表保持不变。
    - **注意事项**：  
        - 文件必须符合 ELF 格式规范（详见第2章说明）  
        - 成功执行后从 ELF 入口地址开始运行  
    - **特点**：  
        - 保留原进程 PID 和**文件描述符表**
        - 参数数组需包含程序名作为首个元素（`argv[0]`），并且最后需要以 `NULL` 终止符结尾，`NULL` 终止符不会被c语言自动补充。

    ### `kill(int pid)`
    - **参数**：目标进程 PID（正整数）  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：向指定进程发送终止信号（默认 SIGTERM）  
    - **注意事项**：  
        - 需具备目标进程的操作权限  
        - 实际终止可能因信号处理程序延迟  

    ### `sleep(int n)`
    - **参数**：休眠秒数（整型）  
    - **返回值**：剩余未休眠秒数（通常为 0）  
    - **作用**：使进程暂停执行指定时长  
    - **注意事项**：  
        - 实际休眠时间可能因信号中断缩短  
        - 精度通常为秒级  
    - **特点**：  
        - 不占用 CPU 资源  
        - 常用于定时任务调度

    ### `getpid()`
    - **参数**：无  
    - **返回值**：当前进程 PID（正整数）  
    - **作用**：获取调用进程的进程标识符  
    - **注意事项**：  
        - PID在进程生命周期内唯一且不变  

- I/O 和文件描述符

    文件描述符是操作系统中的一个核心概念，它本质上是一个非负整数，用于标识进程可访问的内核管理对象。这些对象包括文件、目录、设备、管道等。进程通过文件描述符与这些资源交互，而无需关心其底层差异——无论是写入文件、控制台，还是通过管道传输数据，都可以抽象为对字节流的读写操作。

    进程获取文件描述符的常见方式包括：打开文件或设备（如调用 `open()`）、创建管道（`pipe()`）、复制现有描述符（`dup()` 或 `fork()` 继承）。其中，0、1、2 号描述符是系统预定义的：0 对应标准输入（stdin，默认从键盘读取），1 对应标准输出（stdout，默认输出到屏幕），2 对应标准错误（stderr，默认输出错误信息到屏幕）。

    每个指向文件的文件描述符都会关联一个文件偏移量，表示当前读写位置。例如，调用 `read()` 会从偏移量处读取数据，读取后偏移量自动增加相应的字节数；`write()` 同理，写入后偏移量向后移动。偏移量的共享规则是关键：若多个描述符是通过 `fork()` 或 `dup()` 系列调用从同一原始描述符派生而来（例如复制或继承），它们会共享同一偏移量；但如果是独立打开同一文件（如两次调用 `open()`），即使目标文件相同，各自的描述符也会维护独立的偏移量。

    这种设计使得文件描述符成为强大的抽象工具。无论底层是文件、管道还是设备，进程只需通过描述符的读写接口操作字节流即可。例如，向描述符 1 写入数据时，可能是输出到屏幕、重定向到文件，或是通过管道传递给其他进程，但进程代码无需为此修改。这种抽象简化了编程，同时为资源复用（如 dup2() 重定向）和进程间通信（如管道）提供了统一的基础。

    ### `open(const char *filename, int flags)`
    - **参数**：  
        - 文件路径（字符串）  
        - 打开模式标志（如 O_RDONLY）  
    - **返回值**：文件描述符 fd（失败返回 -1）  
    - **作用**：建立文件访问通道  
    - **特点**：  
        - 返回当前最小可用文件描述符  
        - 标志模式如下
            #### 一、基础访问模式（必选其一，互斥使用）
            | 标志          | 值    | 说明                          |
            |---------------|-------|-------------------------------|
            | `O_RDONLY`    | 0x000 | 只读模式                      |
            | `O_WRONLY`    | 0x001 | 只写模式                      |
            | `O_RDWR`      | 0x002 | 读写模式                      |

            #### 二、文件创建控制（可组合使用）
            | 标志          | 说明                          | 典型应用场景               |
            |---------------|-------------------------------|--------------------------|
            | `O_CREAT`     | 文件不存在时创建新文件          | 需要配合权限参数使用       |
            | `O_TRUNC`     | 打开时清空文件内容（需写权限）  | 覆盖写操作初始化           |
            | `O_EXCL`      | 与 O_CREAT 联用确保独占创建     | 防止文件覆盖的原子操作     |

            #### 三、文件操作行为（可组合使用）
            | 标志          | 说明                          | 系统支持情况              |
            |---------------|-------------------------------|-------------------------|
            | `O_APPEND`    | 强制追加写入（原子操作）        | 通用支持                 |
            | `O_NONBLOCK`  | 非阻塞模式打开文件              | 管道/设备文件专用         |
            | `O_SYNC`      | 同步写入保证数据落盘            | 高可靠性存储场景         |

    ### `read(int fd, void *buf, size_t n)`
    - **参数**：  
        - 文件描述符  
        - 数据缓冲区地址  
        - 读取字节数  
    - **返回值**：实际读取字节数（0 表示 EOF，-1 表示错误）  
    - **作用**：从打开文件读取数据  
    - **注意事项**：  
        - 缓冲区需预先分配足够空间  
    - **特点**：  
        - 自动更新文件偏移量  
        - 支持管道/设备等特殊文件读取  

    ### `write(int fd, const void *buf, size_t n)`
    - **参数**：  
        - 文件描述符  
        - 数据缓冲区地址  
        - 写入字节数  
    - **返回值**：实际写入字节数（-1 表示错误）  
    - **作用**：向打开文件写入数据  

    ### `close(int fd)`
    - **参数**：文件描述符  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：释放文件访问资源  
    - **注意事项**：  
        - 重复关闭已关闭的 fd 会导致错误  
        - 进程终止时自动关闭所有 fd  
    - **特点**：  
        - 释放的文件描述符可被后续 open 重用  
        - 关闭管道影响相关进程读写  

    ### `dup(int fd)`
    - **参数**：源文件描述符  
    - **返回值**：一个指向同一个输入/输出对象的新描述符（失败返回 -1）  
    - **作用**：复制现有文件描述符  
    - **注意事项**：  
        - 新 fd 共享原 fd 的文件偏移量  
        - 保证返回当前最小可用 fd  
    - **特点**：  
        - 用于实现输出重定向  
        - 配合 `close` 实现 fd 定向替换

- 管道
    管道是一个小的内核缓冲区，它以文件描述符对的形式提供给进程，一个用于写操作，一个用于读操作。从管道的一端写的数据可以从管道的另一端读取。管道提供了一种进程间交互的方式。

    尽管管道似乎可以用临时文件+重定向代替，但实际上管道和临时文件之间至少有三个关键的不同点。
    首先，管道会自动清理，而对于 shell 重定向，我们必须在任务完成后手动删除临时文件（如`/tmp/xyz`）。
    第二，管道可以传输任意长度的数据。
    第三，管道支持同步操作：两个进程可以通过一对管道进行信息传递，每次读操作都会阻塞调用进程，直到另一个进程通过写操作完成数据发送。
    ### `pipe(int p[2])`
    - **参数**：包含两个整数的数组  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：创建进程间(`p[0]`到`p[1]`的)通信管道  
    - **注意事项**：  
        - `p[0]` 为读端，`p[1]` 为写端  
        - 数据采用先进先出机制  
    - **特点**：  
        - 默认阻塞式 I/O 操作  
        - 写入端关闭后读取返回 EOF 
- 文件系统
    XV6 文件系统以树状结构组织数据，文件作为字节数组存储，而目录则是一种特殊文件，通过包含指向其他文件或目录的引用构建层级关系。
    根目录`/`是树的起点，绝对路径（如`/a/b/c`）从根开始逐级解析，而相对路径基于进程的当前目录（可通过`chdir`修改）。

    例如，无论通过分步切换目录（chdir("/a"); chdir("b")）、直接跳转（chdir("/a/b")）、绝对路径访问（open("/a/b/c", ...)）还是相对路径组合操作（从根目录逐步进入子目录），
    所有路径最终会被解析为相同的目标文件`/a/b/c`。这种设计通过维护进程的当前目录状态和统一的递归路径解析机制，既允许了有丰富的操作方式，又保证了不同操作方式在文件系统底层的一致性。
    
    文件名和这个文件本身也有很大的区别。同一个文件（称为 inode）可能有多个名字，称为连接 (links)。而每一个 inode 都由一个唯一的 inode 号 直接确定。系统可以通过调用 link 创建另一个文件系统的名称，它指向同一个 inode。
    ### `chdir(const char *dirname)`
    - **参数**：目标目录路径  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：修改进程工作目录  
    - **注意事项**：  
        - 需具备目录访问权限  

    ### `mkdir(const char *dirname)`
    - **参数**：目录创建路径  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：创建新目录  
    - **注意事项**：  
        - 需父目录写权限  

    ### `mknod(const char *name, int major, int minor)`
    - **参数**：  
        - 设备文件路径  
        - 主设备号  
        - 辅设备号  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：创建设备特殊文件  
    - **注意事项**：  
        - 通常需要超级用户权限  
        - 当一个进程之后打开这个文件的时候，内核将读、写的系统调用转发到内核设备的实现上，而不是传递给文件系统。
    - **特点**：  
        - 实现设备文件抽象  
        - 支持字符/块设备创建  

    ### `fstat(struct file *f, struct stat *st);`
    - **参数**：
        - f: 指向 `struct file` 的文件指针，通过文件描述符（如通过 `open`、`dup` 等系统调用获取）找到。
        - st: 指向 `struct stat` 结构体的指针，用于存储文件元信息（必须由调用者预先分配内存）
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：获取文件元信息  
    - **注意事项**：  
        - 信息存储于 struct stat 结构体，而非返回值
        - struct stat如下：
            ```c
            struct stat
            {
                int dev;     // File system’s disk device
                uint ino;    // Inode number
                short type;  // Type of file
                short nlink; // Number of links to file
                uint size;   // Size of file in bytes 
            } 
            ```
    - **特点**：  
        - 支持所有文件类型（普通文件、目录等）的元信息查询。
        - 不依赖于文件名进行操作，直接通过文件描述符及其指针操作。

    ### `link(const char *f1, const char *f2)`
    - **参数**：  
        - 现有文件路径  
        - 新链接路径  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：创建文件链接  
    - **注意事项**：  
        - 不适用于目录链接  
    - **特点**：  
        - 增加文件链接计数  
        - 多路径共享相同 inode  

    ### `unlink(const char *filename)`
    - **参数**：文件路径  
    - **返回值**：成功返回 0，失败返回 -1  
    - **作用**：删除一个文件名  
    - **注意事项**：  
        - 一个文件的 inode 和磁盘空间只有当它的链接数和文件描述符同时变为 0 的时候才会被清空，也就是没有一个文件再指向它，也没有一个程序使用它。
    - **特点**：  
        - 常用于临时文件清理  
        - 配合 open 实现原子文件替换

# 实验任务
## boot XV6（Easy）
获取实验室的XV6源代码并切换到util分支，按照文档执行就行。
```bash
git clone git://g.csail.mit.edu/XV6-labs-2020
cd XV6-labs-2020
git checkout util
make qemu
```
按<C-a>再按x键退出。

## sleep(Easy)
呃啊，注意不要在XV6上面写代码），XV6是操作系统好吗）））。

直接调用 `sleep` 即可，注意不能用 `return 0`。

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
int
main(int argc, char const *argv[])
{
    if(argc < 2)
    {
        fprintf(2, "Usage:sleep [time]\n");
        exit(1);
    }
    int time = atoi(argv[1]);
    sleep(time);
    exit(0);
}

```
## pingpong(Easy)
本题为管道的示例题，需要注意的是，管道是一个小的内存缓冲区，它提供了一对文件描述符，一个用于写操作，另一个用于读操作。记得不需要的文件描述符要 `close`。

```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
int
main(int argc, char const *argv[])
{
    int p_c[2], c_p[2];
    if(pipe(p_c) == -1)
    {
        fprintf(2, "pipe error");
        exit(1);
    }
    if(pipe(c_p) == -1)
    {
        fprintf(2, "pipe error");
        exit(1);
    }
    int pid = fork();
    if(pid)
    {
        write(p_c[1], "p", 2);
        char buf[10];
        read(c_p[0], buf, 10);
        printf("%d: received pong\n", getpid());
    }
    else if(!pid)
    {
        char buf[10];
        read(p_c[0], buf, 10);
        printf("%d: received ping\n", getpid());
        write(c_p[1], "p", 2);
    }
    close(p_c[0]), close(p_c[1]);
    close(c_p[0]), close(c_p[1]);
    exit(0);
}
```

## primes (moderate) / (hard)
挺奇妙的idea的，我一开始被进程和函数绕的有点晕乎，实际上逻辑很清楚。每次切到子进程后要从头开始运行一遍prime函数，只要给一个读入接口就行。还有注意管道传数值要用地址传。

还有父进程必须等待子进程退出以回收资源，不能让子进程变成孤儿进程。
```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
void prime(int fd)
{
    int p, num;
    read(fd, &p, 4);
    printf("prime %d\n", p);
    int pip[2];
    pipe(pip);
    int pid = fork();
    if(pid)
    {
        close(pip[0]);    
        while (read(fd, &num, 4))
        {
            if(num % p != 0)
            {
                write(pip[1], &num, 4);   
            }
        }
        close(pip[1]);
        wait(0);
    }
    else
    {
        close(pip[1]);
        prime(pip[0]);
        close(pip[0]);
        return;
    }
}
int
main(int argc, char *argv[])
{
    int pip[2];
    pipe(pip);
    int pid = fork();
    if(pid)
    {
        close(pip[0]);
        for(int i = 2; i <= 35; i++)
        {
            write(pip[1], &i, 4);
        }
        close(pip[1]);
        wait(0);
    }
    else
    {
        close(pip[1]);
        prime(pip[0]);
        close(pip[0]);
    }
    exit(0);
}
```

## find (moderate)
愈发感觉Lab设计的精巧了，这个题让你对 `ls` 进行不大不小的修改，确实能练到很多东西。包括修改 `fmtname` 函数使得不再补全空格，通过添加文件名改变路径等等。要注意目录文件里是包含本级和上级目录的，不要递归进去造成死循环。

说起来我才发现基本上字符串函数还有管道都是从1往0灌数据……嘶，这么一写感觉好有道理。
```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
#include "kernel/fs.h"

char*
fmtname(char *path) // delete all words before the last slash
{
  static char buf[DIRSIZ+1];
  char *p;

  // Find first character after last slash.
  for(p=path+strlen(path); p >= path && *p != '/'; p--)
    ;
  p++;

  // Return name.
  char *dst = buf;
  while (*p != '\0' && dst < buf + DIRSIZ)
  {
    *dst ++ = *p++;
  }
  *dst = '\0';
  return buf;
}

void
find(char *path,char *goal)
{
  char buf[512], *p;
  int fd;
  struct dirent de;
  struct stat st;

  if((fd = open(path, 0)) < 0){
    fprintf(2, "find: cannot open %s\n", path);
    return;
  }

  if(fstat(fd, &st) < 0){
    fprintf(2, "find: cannot stat %s\n", path);
    close(fd);
    return;
  }

  switch(st.type){
  case T_FILE:
    if(strcmp(fmtname(path), goal) == 0)
    {
      printf("%s\n", path);
    }
    break;

  case T_DIR:
    if(strlen(path) + 1 + DIRSIZ + 1 > sizeof buf)
    {
      printf("find: path too long\n");
      break;
    }
    strcpy(buf, path);
    p = buf+strlen(buf);
    *p++ = '/';
    while(read(fd, &de, sizeof(de)) == sizeof(de))
    {
      if(de.inum == 0)
        continue;
      if(strcmp(de.name, ".") == 0 || strcmp(de.name, "..")  == 0 )
        continue;
      int len = strlen(de.name);
      memmove(p, de.name, len);
      p[len] = '\0';
      find(buf, goal);
    }
    break;
  }
  close(fd);
}

int
main(int argc, char *argv[])
{
  if(argc != 3)
  {
    printf("Usage: find [path] [filename]\n");
    exit(1);
  }
  find(argv[1], argv[2]);
  exit(0);
}
```

## xargs (moderate)
关键反而在于输入的处理上，因为没有 `readline` 函数和 `split` 函数，都需要自己写一遍，其余部分倒是挺简单的。

好吧，其实我 `split` 写挂了很久……这个b虚拟机是真的卡……主要是要注意指针数组跟二维数组不一样，指针数组没有初始化的时候里面的指针都是野指针，不能直接++，--操作！如果需要往里面写东西的话需要先用 `malloc` 分配内存！
```c
#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
int
readline(char buf[])
{
    char *p = buf;
    while (read(0, p, 1) != 0)
    {
        if(*p == '\n' || *p == '\0')
        {
            *p = '\0';
            return 0;
        }
        p++;
    }
    if(p != buf)
        return 0;
    return 1;
}

void
run(char *pro, char ** argv)
{
    if(fork() == 0)
    {
        exec(pro, argv);
    }
    else
    {
        wait(0);
    }
}

#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"
int
readline(char buf[])
{
    char *p = buf;
    while (read(0, p, 1) != 0)
    {
        if(*p == '\n' || *p == '\0')
        {
            *p = '\0';
            return 0;
        }
        p++;
    }
    if(p > buf)
        return 0;
    return 1;
}

void
run(char ** argv)
{
    if(fork() == 0)
    {
        exec(argv[0], argv);
        exit(1);
    }
    else
    {
        wait(0);
    }
}

int
main(int argc, char *argv[])
{
    if(argc < 2)
    {
        fprintf(2, "Uasge: xargs [command]\n");
        exit(1);
    }
    char *nargv[16];
    for(int i = 1; i < argc; i++)
    {
        nargv[i - 1] = argv[i];
    }// original parameter
    int base_arges = argc - 1;
    char buf[100];
    while (readline(buf) == 0)
    {
        int arg_count = base_arges;
        char * src = buf;
        while (src && arg_count < 15)
        {
            while(*src == ' ')
                src++;
            if(!*src)
                break;
            nargv[arg_count++] = src;
            while(*src && *src != ' ')
                src++;        
            if(*src)
                *src++ = '\0';
        }
        nargv[arg_count] = 0;
        run(nargv);
    }
    exit(0);
}
```

# 小结
第一个Lab，总体上来说是相当磕磕绊绊了，对环境的不熟悉让我犯了许多现在看来很愚蠢的小错误。
有一说一，操作系统里面真的有很多规范，像是 `argv` 要以 `NULL` 结尾，还有文件描述符的回收，都是很细节又很重要的地方。
最后一个题还把二维数组跟指针数组混用写出了野指针，属实是不应该。
总而言之，希望后面能自己独立写完Lab，这次的Lab参考着许多前辈的代码才勉强写完，而且时间也花了好久……可能是太久没写了吧。