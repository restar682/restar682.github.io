---
title: 'MIT-6-S081-Lab4: Traps'
date: 2025-03-19 16:15:57
categories: 6.s081
tags: [操作系统, 陷阱指令, Linux, 6.s081]
---

# 知识点
## 陷入机制
有三类事件会迫使 CPU 中断指令的正常执行，并将控制权转交给处理该事件的特定代码。

<ul>
<li>第一类是<strong>系统调用</strong>：当用户程序执行 <code>ecall</code> 指令，向内核请求某些服务时，CPU 便会中断当前执行的程序。</li>
<li>第二类是<strong>异常</strong>：当指令（无论是用户还是内核态）出现非法操作，例如除以零或访问无效虚拟地址时，会触发异常。</li>
<li>第三类是<strong>设备中断</strong>：当设备发出信号需要处理，例如磁盘硬件完成读写操作时，CPU 会响应设备中断。</li>
</ul>

我们将这三种情况统称为“陷阱”，一般而言，发生陷阱时，我们希望后续代码能恢复执行，而不必让人察觉到特殊情况，即保持陷阱的透明性。**典型处理流程为**：陷阱强制将控制权移交内核，内核保存寄存器与状态后执行处理程序（如系统调用实现或设备驱动），处理完成后恢复状态并返回到中断点继续执行。在 XV6 中，这一流程细化为四步：CPU 硬件操作完成初步上下文切换，汇编代码设置陷阱向量入口，C语言陷阱处理程序根据类型（用户态陷阱、内核态陷阱、定时器中断）分发逻辑，最终由系统调用或设备驱动完成具体操作。其中，系统调用由内核直接提供服务，设备中断由内核统一处理以隔离硬件细节，而异常（如非法指令）则通过终止用户进程确保系统安全，三者共同体现了内核作为资源管控者的核心角色。

每个RISC-V CPU都有一组控制寄存器，内核写入这些寄存器来告诉 CPU 如何处理陷阱，内核也可以读取这些寄存器来了解已经发生的陷阱。`riscv.h` 里包含了所有的寄存器作用，以下是一些常用的寄存器：

<ul>
  <li><strong><code>stvec</code></strong>：内核在此寄存器中写入其陷阱处理程序的地址；RISC-V 遇到陷阱时会跳转到这个地址进行处理。</li>
  <li><strong><code>sepc</code></strong>：当陷阱发生时，RISC-V 会在该寄存器中保存程序计数器（PC）的内容，因为处理陷阱时要将 <code>stvec</code> 中储存的地址加载到 PC 中。<code>sret</code>（从陷阱返回）指令会将 <code>sepc</code> 的值复制回 PC，内核还可以通过写入 <code>sepc</code> 来控制 <code>sret</code> 的返回位置。</li>
  <li><strong><code>scause</code></strong>：RISC-V 会在此寄存器中存放一个描述陷阱原因的数字。</li>
  <li><strong><code>sscratch</code></strong>：用作内核的临时存储，在陷阱处理程序中最初阶段被使用。</li>
  <li><strong><code>sstatus</code></strong>：用于控制并反映当前管理模式下的状态信息，如中断使能（SIE）以及模式信息（SPP）等。SIE 控制设备中断的启用状态。如果内核清除 SIE，RISC-V 将延迟设备中断，直到内核重新设置 SIE。SPP 指示陷阱源于用户模式还是管理模式，并控制 <code>sret</code> 返回时的模式。</li>
  <li><strong><code>sie</code></strong>：用于控制管理模式（S态）下中断的使能，决定具体哪些S态中断（软件、定时器、外部）可以触发异常处理。<li><strong><code>sip</code></strong>：管理内核态中断状态的寄存器，实时反映哪些中断事件已触发但尚未被 CPU 处理。  
</ul>

上述寄存器都用于在管理模式下处理陷阱，在用户模式下不能读取或写入。在机器模式下处理陷阱有一组等效的控制寄存器，XV6 仅在定时器中断的特殊情况下使用它们。

多核芯片上的每个 CPU 都拥有独立的一组这些寄存器，并且在任何时间点上，多个 CPU 可能同时处理陷阱。

当 RISC-V 硬件需要强制执行陷阱时，除了定时器中断以外，它对所有类型的陷阱执行以下操作：
<ul>
  <li>如果陷阱是设备中断且状态寄存器中的 SIE 位被清除，就不响应。</li>
  <li>清除 SIE 以禁用中断。</li>
  <li>将 PC 的值复制到 <code>sepc</code>。</li>
  <li>将当前运行模式（用户或管理模式）保存到 <code>sstatus</code> 的 SPP 位中。</li>
  <li>设置 <code>scause</code> 以反映触发陷阱的原因。</li>
  <li>将运行模式切换为管理模式。</li>
  <li>将 <code>stvec</code> 的值复制到 PC。</li>
  <li>开始在新的 PC 上执行。</li>
</ul>

需要注意的是，CPU 硬件不会自动切换内核页表和内核栈，也不会保存除 PC 以外的寄存器，处理程序必须完成上述工作。这样设计可以给软件更好的灵活性。而设置 PC 的工作必须由硬件完成，因为当切换到内核态时，用户指令可能会破坏隔离性。

## 从用户空间陷入
如果用户程序发出系统调用（`ecall` 指令），或者做了一些非法的事情，或者设备中断，那么在用户空间中执行时就可能会产生陷阱。用户态陷阱处理流程如下：

```
ecall -> uservec -> usertrap -> syscall等中间处理 -> usertrapret -> userret
```

### `uservec`

由于 CPU 不会进行页表切换，因此用户页表必须包含 `uservec` 函数（`stvec` 所指向的函数）的映射。该函数要将 `satp` 切换为内核页表，为了切换后的指令能继续执行，该函数必须在用户页表和内核页表中有相同的地址。为了满足上述要求，XV6 使用包含 `uservec` 的蹦床页面（trampoline page）来满足这些约束。它将一个叫 `trampoline` 的页映射到内核页表和每个用户页表中相同的虚拟地址 `TRAMPOLINE` ，其中包含了 `trampoline.S` 的指令，并设置 `stvec` 为 `uservec`。不过尽管 `TRAMPOLINE` 在用户页表中，但他们的 PTE_U 未设置，因此用户程序无法修改，保证了隔离性。

当 `uservec` 启动时，CPU 的所有 32 个通用寄存器中的值仍保留着中断发生时用户代码的状态。但是，`uservec` 函数作为内核的陷阱处理程序，需要使用这些寄存器来执行指令。为了不丢失这些寄存器中保存的用户程序的状态， `uservec` 必须直接用汇编语言操作寄存器，而不能使用高级语言。内核需要先保存其中一些寄存器的内容。RISC-V 提供了 `sscratch` 寄存器来存储这些临时数据。通过 `csrrw a0, sscratch, a0` 指令，保存 `a0`，之后就可以使用 `a0` 寄存器了。

接下来，函数将所有用户寄存器保存到 `trapframe` 结构体中，该结构体的地址在进入用户模式之前，被保存在 `sscratch` 寄存器中，因此经过之前的 `csrrw` 操作后，就被保存在 `a0` 中。每当创建一个进程时，XV6 都会为该进程的陷阱帧分配一个页面，并安排它始终映射在用户虚拟地址 `TRAPFRAME` ，该地址就在 `TRAMPOLINE` 下面，进程的 `p->trapframe` 也指向该页面。

最后，函数从 `trapframe` 中取出之前存储在蹦床页面上的、陷阱处理期间需要使用的内核栈指针（`kernel_sp`）、`kernel_hartid`、`usertrap` 的地址以及内核页表地址，切换页表后跳转到 `usertrap`。

### `usertrap`

`usertrap` 函数的主要任务是判断陷阱类型并进行处理，然后返回。首先，函数将 `stvec` 设置为 `kernelvec` 的地址，以确保在内核态发生中断时 `kernelvec` 函数处理。接着，函数将 `sepc` 寄存器的内容保存到 `trapframe` 中，以防在处理过程中被覆盖。根据不同的陷阱类型，函数采取相应的操作：如果是系统调用，则将 `trapframe` 中储存的 PC 更新为 `ecall` 指令后的下一条（即当前 PC+4），然后由 `syscall` 函数处理系统调用；如果是设备中断，则交由 `devintr` 处理；如果是异常，则会终止该进程。最后，`usertrap` 会检查进程状态，决定是否终止进程或在定时器中断时将控制权交还给 CPU。

### `usertrapret`

返回用户空间的第一步是调用 `usertrapret`。该函数首先将 `stvec` 设置为 `uservec` 的地址，然后设置 `trapframe` 中的一些关键字段（如 `kernel_satp`、`kernel_sp`、`kernel_trap` 和 `kernel_hartid`），这些将在下一次 `uservec` 的调用中被使用。接着，将 `trapframe` 中保存的用户态程序计数器值赋给 `sepc` 寄存器。最后，调用 `userret` 函数，完成从内核态返回用户态的准备工作。

### `userret`

反向操作 `uservec` 即可，最后用 `sret` 返回。

## 从内核空间陷入

内核态陷阱的处理路径为：
```
  kernelvec -> kerneltrap -> kernelvec
```

### `kernelvec`

由于此时已经处于内核空间，因此即使发生陷阱，我们也不需要修改 `satp` 和栈指针。内核页表和内核堆栈可以继续使用，只需保存所有的通用寄存器即可。`kernelvec` 会将寄存器保存在被中断的内核线程的栈上，因为这些寄存器属于该线程。保存寄存器后，程序会跳转到 `kerneltrap` 进行后续处理。

### `kerneltrap`

`kerneltrap` 只处理两种陷阱：设备中断和异常。它通过调用 `devintr` 判断是否为设备中断，如果不是设备中断，则视为异常，且该异常发生在内核态，内核会调用 `panic` 函数终止执行。如果是定时器中断，则调用 `yield` 函数让出 CPU。由于 `yield` 会修改 `sepc` 和 `sstatus` 寄存器，因此在 `kerneltrap` 中需要保存和恢复这两个寄存器的值。

## 缺页异常的利用

在 XV6 中，并没有对异常进行处理，仅仅是简单地终止故障程序或内核崩溃。而在真实操作系统中，我们会对异常进行具体的处理，来达到许多目的。

在 RISC-V 中，有三种不同的缺页异常，说明了执行何种操作时虚拟地址转换失败：加载页异常（load page fault，当 `load` 指令转换虚拟地址时发生）、存储页异常（store page fault，当 `store` 指令转换虚拟地址时发生）和指令页异常（instruction page fault，当指令地址转换时发生）。在 `scause` 寄存器中保存异常原因，`stval` 寄存器中保存转换失败的地址。

一种技术是延迟分配（lazy allocation）（Lab5）。当应用调用 `sbrk` 增加地址空间时，新的地址在页表中被标记为无效。只有当访问新地址时发生缺页异常，操作系统才会为进程分配物理页面。

COW（Copy-On-Write）fork 技术（Lab6）使子进程和父进程共享相同的物理页面，但将页面标记为只读。当子进程或父进程执行 `store` 指令时，会触发异常，此时操作系统会将页面进行拷贝，并以读写模式同时映射到父子进程的地址空间。我们通过 PTE 中**为操作系统内核保留的位**（RSW, Reserved for Supervisor）来区分是 COW 导致的只读还是单纯的只读。

此外，**按需调页**（Demand Paging）技术也利用了缺页异常。操作系统将部分内存数据保存在磁盘上，并在页表中将相应页面标记为无效。当应用程序试图访问已被换出的页面时，CPU 会触发**缺页异常**。此时，内核会检查故障地址，若该地址对应于磁盘上的页面，内核会分配一个物理内存页，将数据从磁盘加载到内存中，并更新 PTE，使其标记为有效并指向该内存页。随后，内核恢复应用程序的执行。为了腾出空间，内核可能还需要将另一个页面换出到磁盘，通常根据 PTE_A 位来判断页面的访问情况，并结合**最近最少使用**（LRU）策略选择要换出的页面。这个过程对应用程序是透明的，无需对其进行任何修改。如果应用程序在任何时刻只使用部分内存（即仅访问部分地址），按需调页可以显著提高效率。

自动扩展堆栈（automatically extending stacks）和内存映射文件（memory-mapped files）等技术也利用缺页异常。

## 从C到汇编

RISC-V 是一种能够执行 RISC-V 指令集的 CPU 架构。每个处理器都关联着一个特定的指令集架构（ISA, Instruction Set Architecture），该架构定义了处理器可以执行的指令和支持的功能。每条指令都对应一个二进制编码或操作码。

RISC（精简指令集）与 CISC（复杂指令集）是处理器架构的两大设计范式，前者以 RISC-V 为代表，强调简单、固定的指令格式与高效流水线设计，而后者如 x86 架构则通过复杂指令直接支持高级操作。

汇编语言作为底层编程接口，仅提供基础指令（如 `add`、`mult`）和标签跳转机制，通过标签模拟函数调用逻辑，缺乏C语言中的结构化控制流（如 `if-else`、`for` 循环），其本质是对硬件指令集的直接映射。

高级语言（如C语言）的编译流程需经历多阶段转换：源代码首先被编译为汇编语言（生成 `.s` 或 `.S` 文件），汇编器进一步将其转化为机器码目标文件（`.o`），最终链接器整合多个目标文件及库函数生成可执行的二进制文件。

## 通用寄存器

以下是 XV6 的所有通用寄存器：

<img src="/illustrations/MIT-6-S081-Lab4/1.png" alt="XV6 的通用寄存器">

寄存器是 CPU 内部预定义的超高速存储单元，直接参与执行运算（如加减乘除和逻辑操作）。寄存器的重要性在于，汇编代码的操作不是直接在内存中执行，而是在寄存器上进行。寄存器中的数据可以来自内存，也可以来自其他寄存器。运算完成后，结果可以存储在内存或另一个寄存器中。由于寄存器非常快速，我们往往倾向于用寄存器去运算，只有数据量超过寄存器容量或者需要长期存储数据的时候才会使用内存。

寄存器有两种储存规则：Caller Saved 和 Callee Saved。

<ul>
  <li>Caller Saved（调用者保存）：调用函数前，由调用者（Caller）负责保存这些寄存器的值，因为被调用函数（Callee）可能覆盖它们。</li>

  <li>Callee Saved（被调用者保存）：被调用函数若需修改这些寄存器，必须先保存原值，返回前恢复，确保调用者看到的值不变。</li>
</ul>

一般而言，Caller Saved 寄存器（如 `ra`, `t0-t6`）用于临时数据，允许快速使用而无需保存；Callee Saved 寄存器（如 `s0-s11`, `sp`）用于长期变量，减少频繁保存开销。

## 函数栈帧

栈的基本结构图如下：

<img src="/illustrations/MIT-6-S081-Lab4/2.png" alt="栈的基本结构图">

每个函数调用都会创建一个栈帧（stack frame），每个区域对应一个栈帧。栈帧的分配通过移动堆栈指针（stack pointer, 即 SP）完成。

栈是从高地址向低地址增长的，每当创建一个新的栈帧时，`sp` 会减少。栈的增减最好是16的倍数，这样对齐内存可以提高效率。栈帧的结构如下：

1. 返回地址（return address）总是位于栈帧的开头。
2. 指向前一个栈帧的指针会存放在栈帧中的固定位置。
3. 栈帧中保存了函数的本地变量和寄存器。
4. 如果函数的参数超过 8 个，超出的部分会存放在栈中（即内存中的栈空间）。

两个重要的通用寄存器：

- **SP (Stack Pointer)**：指向当前栈帧的栈底，表示栈的当前位置。
- **FP (Frame Pointer)**：指向当前栈帧的顶部，用于寻址返回地址和前一个栈帧的指针（这两者在栈帧中的位置是固定的）。 

前一个栈帧的指针用于返回调用方，当需要跳转回去时，将其存储在 FP 中以恢复先前的栈帧。

# 实验任务
## Backtrace(moderate)
这个实验很简单，关键在于理解栈帧。只要注意到返回地址在-8偏移位置，前一个栈指针保存在-16偏移位置，用 `fp` 指针往前跳就行。注意 `PGROUNDUP` 可以用来判断栈页面的顶部位置。
```c
void
backtrace(void)
{
  uint64 fp = r_fp();
  uint64 over = PGROUNDUP(fp);
  while (fp < over)
  {
    printf("%p\n", *((uint64 *)(fp - 8)));
    fp = *((uint64 *)(fp - 16));
  }
}
```

## Alarm(Hard)
理解了第四章的内容和讲座的内容之后整个实验并没有什么难点，整个实验只用到了 XV6 精妙的陷阱系统的很小一部分。我们的目的是实现一个定期报警程序，为此我们需要实现两个系统调用：设定报警程序、返回原函数。

我们需要修改 `proc` 结构体，添加报警间隔、当前间隔时间、报警程序是否正在运行、报警程序地址以及为返回原地址保存的页表。添加系统调用及函数过程不再赘述。
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
  int duaration;               // Alarm duartion
  int alarm_num;               // Times of alarm
  int is_alarming;             // If non-zero, the process is alarming
  uint64 handler;              // Function need to handle
  struct trapframe * alarm_trapframe; // Alarm trapframe

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

然后我们实现设定报警程序的系统调用：
```c
uint64
sys_sigalarm(void)
{
  int ticks;
  uint64 handler;

  if((argint(0, &ticks)) < 0)
    return -1;
  if((argaddr(1, &handler)) < 0)
    return -1;
  struct proc * p = myproc();
  p->duaration = ticks;
  p->handler = handler;
  p->alarm_num = 0;
  p->is_alarming = 0;
  return 0;
}
```

然后修改 `usertrap` 函数，在定时器中断的时候增加间隔时间计数器。时间到了就清空计数器并触发报警程序。需要注意的是，我们要将保存了原本的返回地址的 `trapframe` 保存到 `alarm_trapframe` 里面，因为我们中途可能还有别的系统调用。
```c
...
  // give up the CPU if this is a timer interrupt.
  if(which_dev == 2){
    if(p->duaration)
    {
      p->alarm_num++;
      if(p->alarm_num == p->duaration && p->is_alarming == 0)
      {
        p->alarm_num = 0;
        *p->alarm_trapframe = *p->trapframe;
        p->is_alarming = 1;
        p->trapframe->epc = p->handler;
      }
      yield();
    }
    yield();
  }
...
```

最后实现 `sys_sigreturn` 系统调用。因为我们在报警之后还需要回到原来的函数，所以把陷阱帧复制回来即可。不要忘了还要在 `procalloc` 和 `freeproc` 里面进行初始化和释放。
```c
uint64
sys_sigreturn(void)
{
  struct proc *p = myproc();
  *p->trapframe = *p->alarm_trapframe;
  p->is_alarming = 0;
  return 0;
}
```

# 小结
至此Lab4宣告结束，总体并不算难，跟着hint一步步做如果之前的课程比较扎实做起来还是挺舒服的。最大的感悟是Lab提供的知识真的只是这一块的很小一部分，绝大部分知识都来自于文档和讲座，甚至Lab答疑课都能让人注意到许多遗漏的小地方。然而，这些实验又不可或缺，它能帮助我们梳理之前的知识。总之，重点还是应该放在文档跟讲座的理解上，Lab终究不是重点。最后附上通关截图：

<img src="/illustrations/MIT-6-S081-Lab4/3.png" alt="通关截图">