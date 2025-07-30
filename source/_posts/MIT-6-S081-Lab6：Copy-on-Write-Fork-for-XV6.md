---
title: MIT-6-S081-Lab6：Copy-on-Write Fork for XV6
date: 2025-03-31 08:02:10
categories: 6.s081
tags: [操作系统, 缺页异常, 写时复制分支, Linux, 6.s081]
---
# 知识点
这里补充一些之前用到但没有深究的内容——中断和设备驱动。

## 设备驱动程序
驱动是操作系统中用于管理特定设备的代码：驱动控制设备硬件，通知硬件执行操作，处理由此产生的中断，与等待该设备IO的进程进行交互。编写驱动是很棘手的事情，因为驱动程序与它管理的设备同时运行。此外，驱动程序必须理解设备的硬件接口才能准确地将内核需要的操作翻译成硬件专属的控制序列，这可能很复杂，而且缺乏文档。

当设备需要与操作系统交互时，会触发硬件中断（属于异步陷阱）。在 RISC-V 架构中：
1. **中断触发**：设备通过中断线向 PLIC（Platform-Level Interrupt Controller）发出中断请求。
2. **中断分发**：PLIC 对多个设备的中断进行优先级仲裁，**将最高优先级的使能中断**发送给某个 CPU（通过 `meip` 外部中断信号）。
3. **CPU 响应**：CPU 检测到中断后，**保存上下文并跳转到统一的陷阱处理入口**（如 `trap_handler`），此时仍**不知道中断来源**。
4. **中断识别**：在陷阱处理流程中，内核代码（如 XV6 的 `devintr()`）会**查询 PLIC 的 `claim` 寄存器**，获取中断号并确认是设备中断（而非定时器中断等）。
5. **驱动处理**：根据中断号映射到具体设备（如 UART/磁盘），调用对应驱动的中断处理例程。
6. **中断完成**：驱动处理完成后，**必须向 PLIC 的 `complete` 寄存器写入相同中断号**，PLIC 才会清除该中断的 pending 状态。

大多数设备驱动在两个上下文中执行代码：上半部分运行在进程的内核线程中，下半部分则在中断处理时执行。上半部分由系统调用触发，如 `read` 和 `write`，用于请求硬件执行操作（例如请求硬盘读取数据块）。在这时，进程会进入等待状态，等待操作完成。一旦设备完成操作并触发中断，驱动程序的中断处理部分（下半部分）会识别已完成的操作，唤醒对应的等待进程，并通知硬件执行下一个操作。  

## 控制台输入代码
`console.c` 作为控制台（这玩意是模拟的终端设备，不是硬件）的驱动程序，在 XV6 中提供了一个简单的设备驱动抽象。控制台驱动程序通过连接到 RISC-V 的为通用异步接收/发送器（Universal Asynchronous Receiver/Transmitter, UART）串口硬件，接收用户输入的字符。它会累积一行输入，并处理如 Backspace 和 Ctrl-U 等特殊按键。用户进程（如 Shell）通过 `read` 系统调用从控制台获取完整的输入行。在 QEMU 中通过键盘输入时，按键信号会先经过 QEMU 模拟的16550芯片，再传递给 XV6 进行处理。在真正的计算机上，16550将管理连接到终端或其他计算机的RS232串行链路。运行 QEMU 时，它连接到键盘和显示器。

在软件中看来，UART 硬件是一组映射到内存的控制寄存器，对其控制可以直接通过对特定内存地址执行 `load` 和 `store` 操作来完成。但要注意，我们的操作并不会改变硬件内部的固有逻辑，写入内存地址实质上是通过预设的接口与硬件交互，而硬件驱动则相当于翻译器。

UART 的内存映射基地址为 `0x10000000`，即 `UART0`（在 `memlayout.h` 中定义）。每个控制寄存器的大小为 1 字节，其具体偏移量在 `uart.c` 中定义。

在 XV6 的 `main` 函数中，`consoleinit` 用于初始化 UART 设备。它配置 UART 设备，使其在每接收到一个字节时触发接收中断，并在每次完成一个字节的输出传输时触发传输完成中断。

在 XV6 中，Shell 通过 `init.c` 中打开的文件描述符来读取控制台。`read` 系统调用会触发调用 `consoleread` 函数，该函数会等待输入的到达（通过中断），并将数据保存在 `cons.buf` 中。当一整行输入接收完成后，`consoleread` 函数将数据拷贝到用户空间，并返回给用户进程。如果输入尚未完整到达，`read` 进程会在 `sleep` 调用中等待，直到收到完整的输入行。

每当用户输入一个字符时，UART 设备都会触发一个中断，激活 XV6 的陷阱处理程序。陷阱处理程序将调用 `devintr`，通过读取 `scause` 来判断中断是否由外部设备触发。接着，程序通过 PLIC 判断中断的设备类型。如果是 UART 设备，便会调用 `uartintr` 函数进行处理。

`uartintr` 从 UART 设备中读取所有输入字符，并将其交给 `consoleintr` 进行处理。该函数不会等待字符的输入，因为新的输入会触发新的中断。`consoleintr` 将输入字符保存在缓冲区中，直到接收到完整的一行输入，并在此过程中处理一些特殊字符（如 backspace 或 Ctrl-U）。当一整行输入到达后，`consoleintr` 会唤醒一个正在等待的 `consoleread`，以便将输入传递给用户进程。

当 `consoleread` 被唤醒时，缓冲区中已经保存了完整的一行输入。此时，`consoleread` 会将这一行输入从缓冲区拷贝到用户空间，并将数据返回给用户进程。

## 控制台输出代码
在连接到控制台的文件描述符上执行 `write` 系统调用时，最终会调用 `uartputc`。设备驱动程序维护一个输出缓冲区（`uart_tx_buf`），因此写入的进程无需等待 UART 完成数据发送。相反，`uartputc` 会将每个字符添加到缓冲区，并调用 `uartstart` 来启动设备传输（如果尚未启动），然后立即返回。唯一会导致 `uartputc` 阻塞的情况是缓冲区已满。

每当 UART 发送一个字节时，就会触发一次中断。`uartintr` 函数会调用 `uartstart` 来检查传输是否完成，如果未完成，则会开始传输下一个缓冲区中的字符。因此，当进程写入多个字符时，第一个字节会通过 `uartputc` 调用 `uartstart` 进行传输，而后续的字节则通过 `uartintr` 调用的 `uartstart` 继续传输。

对于设备活动和进程活动，常见的解耦方式是通过缓冲和中断。控制台驱动程序能够处理输入，即使没有进程在等待读取，稍后到来的 `read` 操作依然可以读取到输入。类似地，进程可以进行输出而无需等待设备响应。这样的解耦方式允许进程并行执行设备 I/O，从而提高性能，特别是在设备速度较慢或需要立即响应（如输入一个字符）的情况下。这种思想被称为 I/O 并行。

## 驱动中的并发
在 `consoleread` 和 `consoleintr` 中，都会调用 `acquire` 函数。这些调用用于申请一个锁，目的是在并发访问时保护驱动程序的数据结构。在这些操作中，有三种并行风险需要考虑：

1. **多个进程在不同 CPU 上同时调用 `consoleread`**：这可能导致多个进程并发访问共享资源，进而引发数据一致性问题。
   
2. **在 CPU 执行 `consoleread` 时，硬件触发了一个中断**：硬件中断可能会在 `consoleread` 执行过程中打断当前进程，从而引发并行访问的冲突。
   
3. **在 `consoleread` 执行时，硬件在其他 CPU 上触发了一个中断**：即使当前 CPU 正在执行 `consoleread`，其他 CPU 上的硬件中断也可能影响共享数据结构，导致并发访问的问题。

通过自旋锁的使用，驱动程序能够保证在并行环境中数据的一致性和安全性，避免上述并发风险的发生。

另一个需要关注的并发场景是：一个进程可能在等待设备输入，而此时中断信号却在另一个进程执行时异步产生。为了解决这一问题，中断处理程序必须是上下文无关的，即不能依赖于特定的进程上下文或执行代码。

例如，中断处理程序不能安全地在当前进程的页表上调用 `copyout` 函数，因为这涉及到当前进程的内存空间，而中断可能会打断进程的执行并切换到另一个上下文。在中断处理程序中，应该仅执行与进程无关的工作，例如将输入字符拷贝到缓冲区中，并且应尽早唤醒顶层部分（例如 `consoleread`）来处理剩余的任务。这种设计可以确保中断处理程序快速而高效地完成工作，避免复杂的上下文切换和对进程状态的依赖，从而减少潜在的并发问题。

## 定时器中断
XV6 通过定时器中断来维护系统时钟并执行进程切换。在 `usertrap` 和 `kerneltrap` 函数中的 `yield` 会触发进程切换。定时器中断由RISC-V CPU内部的时钟硬件生成，XV6 通过对该时钟硬件进行编程，使其定期触发中断，确保每个 CPU 能够周期性地进行操作。

RISC-V 要求定时器中断必须在机器模式下执行，而不是在管理模式下。机器模式是 RISC-V 的最低权限模式，在无分页环境下运行，且具有一系列专用的控制寄存器。因此，在机器模式下运行普通的 XV6 内核代码并不现实。为了应对这一限制，XV6 的定时器中断处理程序与陷阱机制完全分离。

在 `start.c` 中的代码执行于机器模式下，且位于 `main` 函数之前，它设置了接收定时器中断。在 `timerinit` 函数中，定时器中断被初始化。具体过程包括：

1. **编程 CLINT 硬件**：通过对本地核心中断控制器（CLINT, Core Local Interruptor）硬件进行编程，设置定时器在一定时间后产生中断信号。
   
2. **设置 Scratch 区域**：类似于 `trapframe`，`scratch` 区域用于帮助定时器中断处理程序保存寄存器的值，以及 CLINT 寄存器的地址，确保在处理中断时能够恢复相关状态。

3. **设置 mtvec**：将 `mtvec` 寄存器的值设置为 `timervec` 函数的地址，确保当定时器中断发生时，RISC-V CPU 会跳转到 `timervec` 进行中断处理。

4. **使能定时器中断**：最后，定时器中断被允许触发，使其能够按照预定的时间间隔产生中断请求。

这个过程确保了定时器中断能够正确地触发，并且为中断处理程序提供了必要的上下文信息。

定时器中断可以在任何时刻触发，因此内核在执行关键操作时无法禁用定时器中断。因此，定时器中断处理程序必须设计得足够简洁，以确保不会干扰正在执行的内核代码。最基本的策略是，定时器中断处理程序在收到中断后立即生成一个软件中断并返回。这样做的目的是将定时器中断的处理工作推迟到后续的某个合适时机进行。

生成的软件中断会通过通用的陷阱机制进行处理，从而确保能够在适当的时机执行实际的中断处理。这种设计的关键点在于，软件中断的处理可以与其他类型的中断（如设备中断）一样，进行关闭、排队或者延迟处理。

在 XV6 中，软件中断的处理程序位于 `devintr` 函数中。`devintr` 负责处理中断后的具体任务，包括从中断队列中取出待处理的任务并执行。通过这种方式，内核确保定时器中断不会干扰到正在执行的关键操作，并且能够有效地进行进程调度、时钟维护等操作。

机器模式的时钟中断向量为 `timervec`，该函数的作用是处理定时器中断。在中断发生时，`timervec` 会首先保存必要的寄存器状态到 `start` 函数准备的 scratch 区域中，这样可以确保在处理中断时不会丢失正在执行的上下文。

接下来，`timervec` 会通知 CLINT 硬件，指示下一个定时器中断的时刻。这是通过设置 CLINT 寄存器来完成的，通常是将定时器的下次中断时间设置到一个未来的时刻，确保定时器中断会按计划触发。

然后，`timervec` 要求RISC-V发出“软件中断”并立即返回。通过这种方式，定时器中断处理程序会将进一步的处理中断任务交给软件中断进行，这样就可以避免在定时器中断处理过程中执行过多的工作，保证及时返回。

最后，`timervec` 会恢复之前保存的寄存器状态，并返回中断处理程序的控制流，确保内核继续正常执行。

这种方法可以让定时器中断处理保持简单、快速，并将复杂的工作推迟到合适的时间（比如通过软件中断的机制进行处理）。

## 另一种交互方式：轮询
用中断来进行处理的方式固然很好，但如果是高速设备，需要频繁交互，那么进出中断就会浪费很多时间。因此，对于这样的设备，我们往往会采用轮询的方式。

轮询的核心思路是：  
1. **CPU 进入循环**，不断检查设备状态寄存器（Status Register）。
2. **设备未准备好**：CPU 继续循环，浪费计算资源。
3. **设备准备好**：CPU 读取/写入数据，完成处理后继续轮询。

在实际应用中，我们通常会根据具体需求进行权衡。例如，对于某些高速设备，可以采用**轮询 + 中断**的混合策略——在设备高负载运行时使用轮询，而在低负载或关键事件发生时触发中断，以兼顾性能和响应速度。

# 实验任务
## Implement copy-on write (hard)
某种意义上来说，我感觉这个Lab给我的感觉像是期中测试，运用到的知识很杂很全面，所以我也基本上没看前人的代码，跟着提示自己实现了一遍。总体来说并不算难，基本上没出过什么bug，一路非常丝滑的就做完了。我真厉害hhhhhh。

我们要实现写时复制分支，首先要修改 `fork` 函数，在复制的时候不进行物理内容的复制而只复制页表，同时清除 PTE_W 权限并添加 PTE_COW 权限（利用 PTE 的保留位 RSW），另外还要添加引用计数，如果对页表比较熟悉的话会比较简单。
```c
int
uvmcopy(pagetable_t old, pagetable_t new, uint64 sz)
{
  pte_t *pte;
  uint64 pa, i;
  uint flags;

  for(i = 0; i < sz; i += PGSIZE){
    if((pte = walk(old, i, 0)) == 0)
      panic("uvmcopy: pte should exist");
    if((*pte & PTE_V) == 0)
      panic("uvmcopy: page not present");
    pa = PTE2PA(*pte);
    flags = PTE_FLAGS(*pte);
    *pte = PA2PTE(pa) | (flags & (~PTE_W)) | PTE_COW;
    if(mappages(new, i, PGSIZE, pa, (flags & (~PTE_W)) | PTE_COW) != 0){
      goto err;
    }
    add_pincount(pa, 1);
  }
  return 0;

 err:
  uvmunmap(new, 0, i / PGSIZE, 1);
  return -1;
}
```

然后修改 `usertrap`，在触发写异常时进行懒分配。
```c
...
else if(r_scause() == 15)
{
    uint64 va = r_stval();
    if(cow_copy(va) == -1)
        p->killed = 1;
}
...
```

其中 `cow_copy` 函数如下，有许多的异常判断。我写完后看了看别人的代码，这里的部分是最为百花齐放的。有些人通过引用计数是否为1来判断是直接修改还是建立新界面。这样的确可以节约一些时间，而且因为往往会进行 `exec` 导致引用计数变回1，所以优化幅度并不小。我采用的则是把两种情况合并，无论是否为1，都先分配新页面，再删除老页面。因为我们会修改 `kfree` 的逻辑，所以页面会保留，达到了我们的目的。还有，有人在这里并不会返回0或1来表示是否成功复制，而是返回复制的物理地址，这会让后面的其他部分（`copyout` 函数的修改）更加方便，我认为也是很不错的优化，果然大佬还是多啊。
```c
int
cow_copy(uint64 va)
{
  if(va >= MAXVA)
    return -1;
  struct proc * p = myproc();
  pte_t * old;
  if((old = walk(p->pagetable, va, 0)) == 0)
    return -1;
  if((*old & PTE_V) == 0 || (*old & PTE_U) == 0 || (*old & PTE_COW) == 0)
    return -1;
  uint flags = PTE_FLAGS(*old);
  uint64 pa = PTE2PA(*old);
  char * mem;
  mem = kalloc();
  if(mem == 0)
    return -1;
  memmove(mem, (char *)pa, PGSIZE);
  *old = PA2PTE(mem) | flags | PTE_W;
  kfree((void *)pa);
  return 0;
}
```

接下来实现引用计数，我们需要添加全局数组 `int page_pin[PHYSTOP/PGSIZE]`，用于储存每个页面的被引用次数。然后我们添加函数 `add_pincount` 和 `get_pincount`，前者用于增加引用计数，后者用于查询。
```c
void
add_pincount(uint64 pa, int num)
{
  acquire(&kmem.lock);
  page_pin[pa / PGSIZE] += num;
  release(&kmem.lock);
}

int get_pincount(uint64 pa)
{
  return page_pin[pa / PGSIZE];
}
```

然后修改几个原有的函数，分配页面时增加计数，初始化页面时增加计数，删除时减小计数，计数为0时即刻释放。
```c
void *
kalloc(void)
{
  struct run *r;

  acquire(&kmem.lock);
  r = kmem.freelist;
  if(r)
    kmem.freelist = r->next;
  release(&kmem.lock);

  if(r){
    memset((char*)r, 5, PGSIZE); // fill with junk
    add_pincount((uint64)r, 1);
  }
  return (void*)r;
}

void
freerange(void *pa_start, void *pa_end)
{
  char *p;
  p = (char*)PGROUNDUP((uint64)pa_start);
  for(; p + PGSIZE <= (char*)pa_end; p += PGSIZE)
  {
    page_pin[(uint64)p / PGSIZE] = 1;
    kfree(p);
  }
}

void
kfree(void *pa)
{
  struct run *r;

  if(((uint64)pa % PGSIZE) != 0 || (char*)pa < end || (uint64)pa >= PHYSTOP)
    panic("kfree");

  acquire(&kmem.lock);
  int pin = --page_pin[((uint64)pa) / PGSIZE];
  release(&kmem.lock);
  if(pin > 0)
    return;
  // Fill with junk to catch dangling refs.
  memset(pa, 1, PGSIZE);

  r = (struct run*)pa;

  acquire(&kmem.lock);
  r->next = kmem.freelist;
  kmem.freelist = r;
  release(&kmem.lock);
}
```

最后我们还要修改 `copyout`，因为我们在调用 `write` 的时候可能会出现权限还未恢复的情况（跟Lab5一样），这样就会报错。如果之前采用的是返回物理地址的方式这里会很轻松，我们的方法就还需要复制一遍。
```c
int
copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len)
{
  uint64 n, va0, pa0;

  while(len > 0){
    va0 = PGROUNDDOWN(dstva);
    pa0 = walkaddr(pagetable, va0);
    if(va0 >= MAXVA)
      return -1;
    pte_t * old;
    if((old = walk(pagetable, va0, 0)) == 0)
      return -1;
    if((*old & PTE_V) == 0 || (*old & PTE_U) == 0)
      return -1;
    if(PTE_COW)
    {
      uint flags = PTE_FLAGS(*old);
      pa0 = PTE2PA(*old);
      char * mem;
      mem = kalloc();
      if(mem == 0)
        return -1;
      memmove(mem, (char *)pa0, PGSIZE);
      *old = PA2PTE(mem) | flags | PTE_W;
      kfree((void *)pa0);
      pa0 = (uint64)mem;
    }
    n = PGSIZE - (dstva - va0);
    if(n > len)
      n = len;
    memmove((void *)(pa0 + (dstva - va0)), src, n);

    len -= n;
    src += n;
    dstva = va0 + PGSIZE;
  }
  return 0;
}
```

# 小结
至此 Lab6 宣告结束，这个Lab运用到的知识比较全面，不过并不算难。感觉整个 6.s081 就是每次 Lab 都会涉及到一点点后面的内容，又不具体告诉你原理，可能是想让大家自己探索吧。不过也有可能是操作系统整个浑然一体，不可避免的需要用到其他部分的接口。总之，XV6 确实很精妙啊！

<figure style="text-align: center;">
  <img src="/illustrations/MIT-6-S081-Lab6/1.png" alt="通关截图">
  <figcaption>通关截图</figcaption>
</figure>