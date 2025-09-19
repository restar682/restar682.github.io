---
title: 'MIT-6-S081-Lab2: System call'
date: 2025-03-03 18:04:36
categories: 6.s081
tags: [操作系统, 系统调用, Linux, 6.s081]
---
# 知识点
我们从操作系统的具体行为出发，先分析操作系统的硬件支持和进程的实现机制，再通过实例加深印象，最后简略地了解内核的编译过程和QEMU的仿真原理。

## 操作系统的硬件支持
操作系统必须满足三个要求：多路复用、隔离和交互。

尽管我们可以将系统调用实现为一个库，以此来让应用程序直接与硬件交互并且以最佳方式使用资源，但这要求所有应用程序相互信任并且没有错误，这很难做到。因此我们需要禁止应用程序直接访问硬件资源，而是将资源抽象为服务。文件系统抽象磁盘，进程调度抽象 CPU，`exec` 构建的内存映像抽象物理内存，文件描述符抽象数据交互。这样既简化了应用程序的开发，也保护了系统安全。

这就要求处理器可以实现两个功能：支持不同模式、支持虚拟内存

RISC-V有三种 CPU 可以执行指令的模式：机器模式(Machine Mode)、用户模式(User Mode)和管理模式(Supervisor Mode)。机器模式用于配置计算机，程序在用户模式下只能执行有限的指令，某些特权指令必须在管理模式下进行。

不过管理模式拥有的特权也并不多，一是可以读写控制寄存器（Lab4），一是可以使用 PTE_U 标志位为0的PTE（Lab3），仅此而已。它也没办法直接读写任意物理地址。

想要调动内核函数的应用程序必须过渡到内核，通过 CPU 提供的 `ecall` 指令可以从指定的入口点切换到管理模式，经过参数验证后就能决定是否执行应用程序请求的操作。

所以一个关键问题就在于操作系统的哪些部分以管理模式运行。操作系统全部在内核中的组织称作宏内核，大部分操作系统在用户模式下执行的组织称作微内核。

宏内核不同部分之间的接口通常很复杂，因此开发人员容易犯错误，微内核减少了这一点。但宏内核不必考虑硬件权限的问题，操作系统的不同部分也更加容易合作，性能也更好，这也是大多数Unix（如 XV6）操作系统采用宏内核的原因。

进程自己看到的地址被称作虚拟地址，而实际内存芯片上的位置被称作物理地址，通过三级页表结构（Sv39）完成虚拟地址到物理地址的转换。物理地址空间都在 `0x80000000` 到 `0x86400000` 之间（实际储存在物理内存 DRAM 中），但是虚拟地址范围有所不同，这使得内核和用户进程可以使用同一块物理内存而保持虚拟地址隔离。

XV6 为每个进程维护两个独立的页表：

<ul>
  <li>
    <strong>用户页表</strong>（<code>p->pagetable</code>）：
    <ul>
      <li><strong>用户地址空间</strong>：<code>0x0</code> 到 <code>PLIC</code>（<code>0x0C000000</code>），结构如图所示：
        <pre>
0x3FFFFFF000 (MAXVA)
┌─────────────┐ ← trampoline（用户和内核共享）
├─────────────┤ ← trapframe（用户页表映射）
├─────────────┤ ← 堆区域（通过 malloc 向上扩展）
├─────────────┤ ← 栈区域（向下扩展）
├─────────────┤ ← 全局变量
├─────────────┤ ← 程序代码（指令）
0x0</pre>
      </li>
      <li><strong>保护区域</strong>：<code>PLIC</code> 到 <code>TRAMPOLINE</code>（<code>0x3FFFFFFF000</code>），禁止用户访问。</li>
      <li><strong>无内核映射</strong>：用户页表不包含内核代码或设备地址。</li>
    </ul>
  </li>
  <li>
    <strong>内核页表</strong>（<code>kernel_pagetable</code>）：
    <ul>
      <li><strong>全局唯一</strong>：所有进程在内核态共享此页表。</li>
      <li><strong>内核地址空间</strong>：<code>KERNBASE</code>（<code>0x80000000</code>）到 <code>PHYSTOP</code>（<code>0x86400000</code>），包含：
        <pre>
0xFFFFFFFFFF (MAXVA)
┌─────────────┐ ← trampoline（共享）
├─────────────┤ ← 内核栈（每个进程独立）
├─────────────┤ ← 设备内存（如 UART、磁盘）
├─────────────┤ ← 内核代码与数据（恒等映射）
0x80000000 (KERNBASE)</pre>
      </li>
    </ul>
  </li>
</ul>


在 XV6 操作系统中，`trampoline` 页被同时映射到了用户地址空间和内核地址空间的顶端。当从用户态切换到内核态时，它执行 `uservec` 保存用户寄存器并切换至内核页表；当从内核态返回到用户态时，它执行 `userret` 恢复用户页表和环境。具体内容见Lab4笔记。还要注意进程地址空间有最大范围，RISC-V上的指针有64位，硬件在页表中查找虚拟地址时只使用39位，而 XV6 只使用其中的38位。

## 实现进程的具体机制

内核用proc结构体记录进程的所有信息，其中最为重要的信息是进程的用户页表，内核栈，当前运行状态：
```c
struct proc
{
    enum proc_state state;   // 状态：新建/就绪/运行/阻塞/退出等
    struct proc *parent;     // 父进程指针
    // ...其他字段
    int pid;                 // 进程ID
    void *kstack;            // 内核栈地址
    uint64 sz;               // 进程的虚拟地址空间的大小
    pagetable_t pagetable;   // 用户页表指针
    struct trapframe *trapframe; // 用户态上下文保存区域
    struct context context;  // 用于保存进程的内核寄存器状态 
    // ...其他字段
};
```

在 XV6 中，每个进程拥有独立的用户页表和专属的内核栈。用户页表仅映射用户地址空间（从 `0x0` 到 PLIC），负责管理进程的用户态内存隔离与安全；内核态执行时则使用全局共享的内核页表（`kernel_pagetable`），通过硬件页表切换机制（由 `trampoline` 代码实现）从用户页表切换到内核页表。每个进程在内核态运行时使用独立的内核栈，该栈位于内核地址空间的高端区域，通过内核页表映射且带有保护页，用户代码无法直接访问。当进程通过陷阱进入内核时，CPU 自动切换到内核页表和内核栈，确保即使用户栈损坏，内核仍能安全执行系统调用或处理中断。这种设计通过物理隔离用户与内核地址空间，实现了权限分离和操作系统的稳定性。

当进行系统调用时，它并不是直接调用操作系统中对应的函数，而是先通过调用 `ecall` 指令（要调用的系统调用的编号作为参数）从指定的入口点进入管理模式，保存用户态上下文到陷阱帧后切换到内核态，`syscall` 函数对参数进行检查后进行调用，最后通过 `sret` 指令恢复用户态上下文并返回用户态。整个切换过程如图：

```c
用户代码 → ecall → 保存用户态上下文到陷阱帧 → syscall函数分发系统调用 → 使用内核栈执行系统调用（包括对参数进行检查） → sret → 返回用户栈
```

下面我们一步步进行分析：

1. 参数准备

    用户程序根据用户态的头文件`user/user.h`找到跳板函数（如`fork()`，在`usys.pl`文件中被定义），并通过寄存器传递参数：

    - a0-a6：存放系统调用参数

    - a7：存放系统调用编号（如`SYS_exec`）

2. 触发内核入口

    跳板函数调用 `ecall` 指令，硬件会自动触发一个陷阱，此时，硬件会：
    - 切换特权级
    - 将 PC 的值保存在 `sepc` 寄存器中
    - 跳转到预设的内核入口地址
    - 注意硬件不负责上下文保存，进入内核后上下文保存由内核处理程序负责

3. 内核态处理流程

    1. 上下文保存

        将用户程序的当前状态保存到陷阱帧中。其中陷阱帧（trapframe）是保存用户寄存器等的内存区域。保存的内容包括用户寄存器（如a0-a7）等，以便后续恢复用户态时能够正确继续执行。

    2. 系统调用分发
        内核通过`syscall()`函数分发系统调用：

        ```c
        void syscall(void) {
            int num = p->trapframe->a7; // 从陷阱帧获取系统调用号
            if(num > 0 && num < NELEM(syscalls)) {
                p->trapframe->a0 = syscalls[num](); // 调用对应函数并保存返回值
            } else {
                p->trapframe->a0 = -1; // 错误处理
            }
        }
        ```
        - 注：`syscalls`数组：函数指针表，通过系统调用号索引（如`syscalls[SYS_exec] = sys_exec`）

    3. 系统调用参数的安全处理
        内核通过专用函数`argint`、`argaddr`和`argfd`从陷阱帧中检索第n个系统调用参数并以整数、指针或文件描述符的形式保存获取用户参数。他们都调用`argraw`来检索相应的保存的用户寄存器：

        ```c
        // 示例：从陷阱帧获取第n个整数参数
        int argint(int n, int *ip) {
            *ip = p->trapframe->a0 + n*4; // 假设参数为32位整型
            return 0;
        }
        ```

        有些系统调用传递指针作为参数，内核必须使用这些指针来读取或写入用户内存。然而，这会有两个问题，一是用户程序可能并不完善或者有恶意，二是因为内核和用户态程序的页表是不同的，所以内核无法直接通过普通指令从用户提供的地址读取或写入。

        因此内核实现了安全地将数据传输到用户提供的地址和从用户提供的地址传输数据的功能。

        1. 安全访问函数族

        <table style="width: 100%; border-collapse: collapse; text-align: center;">
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">函数</th>
            <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">方向</th>
            <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">作用</th>
            <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">底层实现</th>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><code>copyin(pg, dst, srcva, len)</code></td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">用户 → 内核</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">从用户空间复制数据到内核缓冲区</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">调用 <code>walkaddr</code> 验证地址</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><code>copyout(pg, dstva, src, len)</code></td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">内核 → 用户</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">从内核复制数据到用户空间</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">同上</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;"><code>fetchstr(addr, buf, max)</code></td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">用户 → 内核</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">从地址 addr 中安全提取用户空间字符串</td>
            <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">封装 <code>copyinstr</code></td>
          </tr>
        </table>

        2. 页表遍历验证 (`walkaddr`)

        ```c
        // kernel/vm.c
        uint64 walkaddr(pagetable_t pagetable, uint64 va) {
            pte_t *pte = walk(pagetable, va, 0);  // 遍历页表获取页表项
            if(!pte || !(*pte & PTE_V)) return 0;  // 检查有效位
            if(!(*pte & PTE_U)) return 0;          // 检查用户权限位
            return PTE2PA(*pte);                   // 返回物理地址
        }
        ```

        3. 字符串安全提取示例 (copyinstr)
        ```c
        // kernel/vm.c
        int copyinstr(pagetable_t pagetable, char *dst, uint64 srcva, uint64 max) {
            uint64 n, va0, pa0;
            while(got_null == 0 && max > 0) {
                va0 = PGROUNDDOWN(srcva);
                pa0 = walkaddr(pagetable, va0);    // 安全验证
                if(pa0 == 0) return -1;            // 非法地址
                // 从pa0复制数据到dst...
                srcva++;
                max--;
            }
            return 0;
        }
        ```

        4. 返回值储存
          系统调用结果存入`p->trapframe->a0`陷阱帧中。

        5. 恢复寄存器

          将存储在 `trapframe` 里的内容恢复。

4. 返回用户态
    运行`sret`指令：
    - 恢复S状态寄存器和程序计数器
    - 切换回用户特权级
    - 跳转到陷阱帧中的`epc`（异常程序计数器）指向的下一条指令，继续用户态程序的运行

每个进程都有一个执行线程（或简称线程）来执行进程的指令。一个线程可以挂起并且稍后再恢复。为了透明地在进程之间切换，内核会挂起当前运行的线程，并恢复另一个进程的线程。线程的大部分状态（本地变量、函数调用返回地址）存储在栈区域上。

切换过程：
```c
挂起当前线程 → 保存当前状态到陷阱帧 → 选择下一个就绪线程 → 加载新线程的陷阱帧 → 恢复执行
```

## 实例：内核的启动与第一个进程的运行

1. 上电与引导加载

    RISC-V上电后，引导加载程序从只读内存启动，将 XV6 内核载入物理地址 `0x80000000`（避开I/O设备地址0x0:0x80000000）。

2. 机器模式初始化

    入口函数 `_entry` 设置初始栈 stack0，调用C代码 `start()`，完成仅机器模式允许的配置：

    - 时钟芯片编程：初始化计时器中断。

    - 模式切换：通过 `mret` 指令切换到管理模式（设置 `mstatus` 寄存器，`main` 函数地址写入 `mepc`）。

3. 内核主初始化

    `main()` 函数初始化设备及子系统（如内存管理、进程控制），调用 `userinit()` 创建首个进程。具体实现见Lab3笔记。

4. 首个进程启动

    - 进程执行汇编程序 `initcode.S`
        - 触发 `exec` 系统调用加载 `/init` 程序。

    - `/init`完成用户环境搭建：
        - 创建控制台设备
        - 打开标准文件描述符（0/1/2）
        - 启动shell，完成系统启动。

## 内核的编译过程
1. 源码编译

    - Makefile 调用 GCC 将C文件（如`proc.c`）编译为 RISC-V 汇编文件（`proc.S`）。

    - 汇编器生成二进制目标文件（`proc.o`）。

2. 链接与生成内核

    - 系统加载器（Loader）收集所有 .o 文件，生成内核可执行文件。

    - 生成调试文件 `kernel.asm`，包含完整汇编代码（用于定位指令级Bug）。

    - 示例指令格式：

        ```asm
        0000000080000000 <_entry>:
            80000000:   0000a117            auipc   sp,0xa  // 指令机器码与汇编对应
        ```

3. 编译参数

    - -m 参数：指定RISC-V虚拟机的内存容量（如 -m 128M 表示128MB内存）。

## 通过QEMU运行内核
1. QEMU仿真原理

    - QEMU模拟RISC-V硬件平台（“虚拟主板”）。

    - 指令执行流程：

        - 每个虚拟CPU核循环读取指令（4/8字节）。

        - 解析RISC-V指令，转换为宿主机指令执行。

        - 维护虚拟寄存器和内存状态。

2. 权限指令仿真

    - 普通权限指令：用户态指令（如加法、跳转）。

    - 特殊权限指令：内核态指令（如`mret`、`ecall`），由QEMU严格模拟权限检查。

3. 调试支持

    - 结合 `kernel.asm` 可追踪指令执行路径，定位异常行为。

# 实验任务
## XV6 System Calls
实际上要修改的部分就是按之前系统调用的切换过程的流程来的。

添加系统调用步骤如下：
1. **在 `user/user.h` 中添加声明**  
    在该头文件中定义新系统调用函数的原型。

2. **在 `user/usys.pl` 中添加入口**  
    在出口列表中添加新条目。

3. **在 `kernel/syscall.h` 中定义系统调用号**
    添加新的系统调用号定义。

4. **在 `kernel/syscall.c` 中添加处理函数**

    - 用 `extern` 全局声明新的内核调用函数。
    
    - 将对应的处理函数添加到 `syscalls` 函数指针数组中。

5. **在合适的位置写好新调用函数具体实现**

## System call tracing（moderate）
这个Lab选题简直神了，愣是带着你把所有流程过了一遍，写完这个题感觉学到了很多。

要求我们实现对某些系统调用的追踪，因为我们在整个进程中都要进行追踪，所以追踪名单要写进进程的 proc 结构体。

```c
struct proc {
  struct spinlock lock;

  // p->lock must be held when using these:
  enum procstate state;        // Process state
  struct proc *parent;         // Parent process
  void *chan;                  // If non-zero, sleeping on chan
  int killed;                  // If non-zero, have been killed
  int xstate;                  // Exit status to be returned to parent's wait
  int pid;                     // Process ID
  uint64 trace_mask;           // Instructions need to be monitored

  // these are private to the process, so p->lock need not be held.
  uint64 kstack;               // Virtual address of kernel stack
  uint64 sz;                   // Size of process memory (bytes)
  pagetable_t pagetable;       // User page table
  struct trapframe *trapframe; // data page for trampoline.S
  struct context context;      // swtch() here to run process
  struct file *ofile[NOFILE];  // Open files
  struct inode *cwd;           // Current directory
  char name[16];               // Process name (debugging)
};
```

创建进程的时候需要清空追踪名单，我们修改 `proc.c` 中的 `allocproc` 函数

```c
static struct proc*
allocproc(void)
{
  ······
  // Set up new context to start executing at forkret,
  // which returns to user space.
  memset(&p->context, 0, sizeof(p->context));
  p->context.ra = (uint64)forkret;
  p->context.sp = p->kstack + PGSIZE;
  p->trace_mask = 0;

  return p;
}
```

然后就是在 `sysproc.c` 里面实现更新追踪名单的具体代码，`argint` 接受寄存器的参数。
```c
uint64
sys_trace(void)
{
  int mask;

  if(argint(0, &mask) < 0) 
    return -1;
  myproc()->trace_mask = mask;
  return 0;
}
```

接下来实现追踪，在参数检查通过后判断该系统调用是否被追踪，如果被追踪就输出信息。

```c
void
syscall(void)
{
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]) {
    p->trapframe->a0 = syscalls[num]();
    if(p->trace_mask & (1<<num))
    {
      printf("%d: syscall %s -> %d\n", p->pid, syscall_names[num], p->trapframe->a0);
    }
  } else {
    printf("%d %s: unknown sys call %d\n",
            p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}

```

注意输出的名称需要自己定义。

```c
const char *syscall_names[] = {
[SYS_fork]   "fork",
[SYS_exit]   "exit",
[SYS_wait]   "wait",
[SYS_pipe]   "pipe",
[SYS_read]   "read",
[SYS_kill]   "kill",
[SYS_exec]   "exec",
[SYS_fstat]  "fstat",
[SYS_chdir]  "chdir",
[SYS_dup]    "dup",
[SYS_getpid] "getpid",
[SYS_sbrk]   "sbrk",
[SYS_sleep]  "sleep",
[SYS_uptime] "uptime",
[SYS_open]   "open",
[SYS_write]  "write",
[SYS_mknod]  "mknod",
[SYS_unlink] "unlink",
[SYS_link]   "link",
[SYS_mkdir]  "mkdir",
[SYS_close]  "close",
[SYS_trace]  "trace",
};
```

至此trace系统调用已经基本实现，还有常规的添加声明、添加入口什么的不再赘述。

## Sysinfo（moderate）
这一个系统调用主要就是要实现 `count_free_mem` 和 `count_process` 两个函数来统计内存和进程，注意新添加的函数要在 `defs.h` 里声明。
```c
uint64
sys_sysinfo(void)
{
  uint64 addr;
  if(argaddr(0, &addr) < 0)
  {
    return -1;
  }
  struct sysinfo sinfo;
  sinfo.freemem = count_free_mem();
  sinfo.nproc = count_process();
  if(copyout(myproc()->pagetable, addr, (char *)&sinfo, sizeof(sinfo)) < 0)
  {
    return -1;
  }
  return 0;
} 
```
主要困扰我的点在于自旋锁(spinlock)的理解，稍微整理一点锁的机制，具体细节后面的课应该会讨论。

1. 锁的核心作用
    在多核 CPU 环境下，锁用于保护共享数据的原子性访问。XV6 中主要使用自旋锁（Spinlock），其核心规则为：

    - 互斥访问：同一时间只有一个 CPU 能持有锁

    - 临界区保护：任何访问共享资源的代码必须持有对应的锁

    - 避免死锁：按固定顺序获取锁，禁止在持有锁时触发调度

2. 内存管理（kalloc.c）中的锁
    - 共享资源：空闲内存链表

    ```c
    // kernel/kalloc.c
    struct {
        struct spinlock lock;
        struct run *freelist;
    } kmem;
    ```

    - 锁的使用场景

    | 操作         | 加锁必要性                                               | 代码示例                           |
    |--------------|----------------------------------------------------------|------------------------------------|
    | 分配内存     | 防止多核同时修改空闲链表，导致链表断裂或重复分配         | kalloc() 中的 `acquire(&kmem.lock)` |
    | 释放内存     | 同上，保证链表插入操作的原子性                           | kfree() 中的 `acquire(&kmem.lock)`  |
    | 统计空闲内存 | 遍历链表时若不加锁，可能读到其他 CPU 正在修改的中间状态，导致计数错误/崩溃 | count_free_mem() 中的锁保护        |

回到程序的实现，关于记录空闲页的方法，XV6 采用的是空闲链表法，直接遍历即可。
```c
uint64
count_free_mem(void)
{
  uint64 num = 0;
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  while(r)
  {
    r = r->next;
    num++;
  }
  release(&kmem.lock);

  return num * PGSIZE;
}
```
通过阅读 `procdump` 及相关代码可以发现，XV6 的进程结构体被保存在 `proc[NPROC]` 数组中。`proc->state` 字段记录了进程控制块(PCB)的当前状态，因此我们只需遍历该数组，统计状态不是 UNUSED 的条目即可。
```c
uint64
count_process(void)
{
  uint64 num = 0;
  struct proc *p;

  for(p = proc; p < &proc[NPROC]; p++){
    if(p->state != UNUSED)
      num++;
  }
  return num;
}
```

# 小结
至此Lab2宣告结束，我们理解了实现多路复用和隔离的硬件要求，对系统调用的全流程有了比较清晰的了解。同时，我们简略地了解了 XV6 系统的启动、内核的编译过程以及QEMU仿真的原理，对更底层的部分进行了初步探索。在实现Lab的时候，大致思路也是根据系统调用的流程，但具体实现则需要对需要实现的功能有一定的了解，比如 `sysinfo` 程序中我们需要知道记录空闲页的方法，还需要知道进程储存的位置，以及自旋锁的使用方法，这些需要通过阅读源码去寻找，也颇具挑战性。总之，至此我们已经大致熟悉了系统调用的流程，继续加油吧。