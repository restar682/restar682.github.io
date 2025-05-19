---
title: MIT-6-S081-Lab7：Multithreading
date: 2025-04-10 15:47:40
categories: 6.s081
tags: [操作系统, 线程, 自旋锁, Linux, 6.s081]
---
# 知识点
调度是操作系统中的关键机制，负责在多个进程或线程之间分时共享 CPU。它与线程密切相关，决定了哪个线程获得执行权。虽然调度逻辑常常在陷阱、时钟中断等机制触发下执行，但从功能上看，它与系统调用、页表等模块相对独立，通常隐藏在内核的幕后，协调整个系统的运行秩序。

但为了完成实验，我们还需要Lab8的知识（事实上课程也是先讲的锁），锁的知识就放在Lab8的笔记里了。
## 多路复用
XV6 通过在两种情况下将每个 CPU 从一个进程切换到另一个进程，实现了 CPU 的多路复用（multiplexing）：

<ol>
<li><strong>阻塞等待时</strong>：当进程因等待设备或管道 I/O 完成、等待子进程退出，或在 <code>sleep</code> 系统调用中主动等待时，XV6 使用 <code>sleep</code> / <code>wakeup</code> 机制切换到其他可运行的进程。</li>
<li><strong>周期抢占时</strong>：为了防止计算密集型进程长时间占用 CPU，XV6 使用定时中断（timer interrupt）周期性地强制进程让出 CPU，实现抢占式调度。</li>
</ol>

这种切换机制让每个进程看起来像是独占了一个 CPU，就像 XV6 利用内存分配器和硬件页表机制，使每个进程看起来拥有独立的内存空间一样。

实现多路复用时，我们将面临一系列挑战：

<ol>
  <li><strong>上下文切换的实现</strong>：从一个进程切换到另一个进程，虽然在思想上很简单，但其实现细节却是 XV6 中最晦涩难懂的部分之一。</li>
  <li><strong>对用户透明的强制切换</strong>：XV6 采用标准技术，通过定时器中断驱动上下文切换，以实现对用户进程透明的抢占。</li>
  <li><strong>多核并发下的争用控制</strong>：在多核系统中，多个 CPU 可能同时在进行进程切换，因此必须使用加锁等同步机制来避免争用和数据竞争。</li>
  <li><strong>资源回收的限制</strong>：进程退出时需要释放内存和其他资源，但它不能自行完成所有清理操作，例如它不能在仍然在使用内核栈的时候释放它。</li>
  <li><strong>核心状态的隔离</strong>：每个 CPU 核心必须独立记录当前运行的进程，以确保系统调用正确作用于对应进程的内核状态。</li>
  <li><strong>睡眠与唤醒的同步</strong>：<code>sleep</code> 让进程主动放弃 CPU，<code>wakeup</code> 则让其他进程唤醒它。实现这对机制时必须格外小心，防止竞态条件导致唤醒信号丢失。</li>
</ol>

虽然 XV6 力求用尽量简单的方式解决这些问题，但相关代码依然复杂且难以掌握。

## 上下文切换
<img src="/illustrations/MIT-6-S081-Lab7/1.png" alt="上下文切换流程">

上图展现了用户进程切换的流程：首先，旧进程通过系统调用或中断从用户态进入内核态；接着，内核将当前 CPU 从旧进程的内核线程切换到调度器线程；然后，调度器选择一个新进程并切换到其内核线程；最后，控制流从新进程的内核态返回到用户态。

调度器不能运行在旧进程的内核栈上，因为其他内核可能会唤醒该进程并使其在另一个 CPU 上运行——这将导致多个内核同时使用同一个栈，后果是灾难性的。为了解决这个问题，XV6 为每个 CPU 分配了一个专用的调度器线程（包含独立的寄存器上下文和栈空间）。

从一个线程切换到另一个线程时，操作系统需要保存旧线程的 CPU 寄存器状态，并恢复新线程之前保存的寄存器状态。这其中最关键的是 **SP 和 RA**，因为它们决定了线程的执行位置和调用栈。也就是说，线程切换时不仅切换了执行的代码位置，还切换了它使用的栈空间。

函数 `swtch` 实现了内核线程之间的切换，通过保存和恢复一组寄存器（即“上下文”）来完成这个过程。`swtch` 本身对线程并没有具体了解；它只是简单地处理上下文的保存与恢复。

当某个进程需要放弃 CPU 时，它的内核线程会调用 `swtch`，将当前的上下文保存下来，并跳转到调度器的上下文。每个上下文由一个 `struct context`表示，该结构体通常嵌套在一个进程的 `struct proc` 或一个 CPU 的 `struct cpu` 中。`context` 主要保存进程的内核态寄存器（如寄存器、栈指针等），而 `trapframe` 则保存用户态的寄存器（如程序计数器和堆栈指针）。它们都与进程绑定，确保在上下文切换时能够恢复该进程的状态。

`swtch` 接收两个参数：`struct context *old` 和 `struct context *new`。它会将当前寄存器状态保存到 `*old` 指向的结构体中，再从 `*new` 中恢复寄存器状态，并跳转执行到新上下文中。

在Lab4中我们看到，中断结束时的一种情况是 `usertrap` 调用了 `yield`，`yield` 进一步调用 `sched`，而 `sched` 又调用 `swtch`，将当前进程的上下文保存在 `p->context` 中，并切换到之前保存在 `cpu->scheduler` 中的调度器上下文。

通过这种方式，当前进程的状态被妥善保存，而 CPU 进入调度器以选择新的进程运行，实现了多进程之间的协作式切换。

`swtch` 只保存**被调用者保存的寄存器**（callee-saved registers），而**调用者保存的寄存器**（caller-saved registers）通常由调用它的 C 代码在必要时显式保存到栈上。`swtch` 知道 `struct context` 中每个寄存器字段的偏移量，因此可以直接读写对应位置的值。注意，这里是在内核中**主动**发起的上下文切换，它属于正常的函数调用，而不是中断或陷阱，因此硬件不会自动帮你保存 `pc`。`swtch` 程序会保存 `ra` 寄存器——也就是调用 `swtch` 时的返回地址——来间接实现对程序执行位置的恢复。接下来，`swtch` 会从新线程的上下文中恢复寄存器，这些值正是之前某次 `swtch` 所保存的内容。此时，`ra` 中保存的是新线程先前调用 `swtch` 时的返回地址，因此 `swtch` 返回时会跳回到新线程原先执行的那条指令上，并且在新线程的栈上继续执行。

## 调度器与进程锁
调度器（scheduler）以每个 CPU 上一个特殊线程的形式存在，每个线程都运行 `scheduler` 函数。该函数的主要任务是选择下一个要运行的进程。当一个进程希望放弃 CPU 时，它必须先获得自己的进程锁 `p->lock`，并释放它持有的任何其他锁，接着更新自己的状态（`p->state`），然后调用 `sched`。`yield`、`sleep` 和 `exit` 都遵循这一约定，后续我们将进一步探讨。`sched` 会再次检查这些条件，并确保在持有锁的情况下禁用中断，以避免竞争条件。

最终，`sched` 调用 `swtch`，将当前进程的上下文保存到 `p->context` 中，并切换到 `cpu->scheduler` 中保存的调度程序上下文。`swtch` 会在调度程序的栈上返回，就像 `scheduler` 的 `swtch` 返回一样。然后，`scheduler` 会继续其 `for` 循环，找到下一个 `RUNNABLE` 状态的进程，并切换到该进程，循环执行直到所有任务完成。

这样，调度程序通过不断的上下文切换，实现了进程的多路复用和高效的 CPU 调度。

XV6 在调用 `swtch` 时会持有 `p->lock`：调用 `swtch` 的进程必须首先获取该锁，并将锁的控制权传递给切换后的代码。这种做法在锁的使用上是较为不寻常的；通常，获取锁的线程也负责释放锁，这样有助于推理和确保操作的正确性。然而，在上下文切换的过程中，有必要打破这一惯例，因为 `p->lock` 用于保护进程的状态（`p->state`）和上下文（`p->context`）字段上的不变量，而这些不变量在 `swtch` 执行时并不成立。如果在 `swtch` 执行期间没有保持 `p->lock`，可能会出现问题：当进程在调用 `yield` 后将状态设置为 `RUNNABLE`，但尚未通过 `swtch` 停止使用自己的内核栈时，另一个 CPU 可能会决定运行该进程。结果将是两个 CPU 在同一栈上运行，这将导致错误。

内核线程总是在 `sched` 中放弃其 CPU，并始终切换到调度程序中的同一位置，而调度程序（几乎）总是切换回之前调用 `sched` 的某个内核线程。因此，如果打印出切换线程时的行号，你将观察到一个简单而固定的模式：切换在相同的位置来回发生。这种在两个线程之间进行固定位置切换的过程通常被称为协程（coroutines）。

有一种特殊情况下调度程序对 `swtch` 的调用不会以 `sched` 结束。当一个新进程第一次被调度时，它会从 `forkret` 开始执行。`forkret` 的作用是释放 `p->lock`，随后调用 `usertrapret`。虽然新进程此时尚未经历一次真正的陷阱，但它仍然可以从 `usertrapret` 开始“返回”到用户态。这是因为在 `fork` 过程中，已经手动设置好了新进程的 `trapframe` 和进入 `usertrapret` 所需的上下文。

`scheduler` 执行一个简单的循环：它不断查找可以运行的进程，运行该进程直到它主动让出 CPU，然后重复这一过程。具体来说，`scheduler` 会在进程表中遍历，查找状态为 `RUNNABLE` 的进程。一旦找到，它就会将当前 CPU 的 `proc` 指针设置为该进程，将进程状态设置为 `RUNNING`，然后调用 `swtch` 切换到该进程，开始执行。

总而言之，可以将调度代码的结构看作是：它强制每个进程维持一组不变量，并在这些不变量不成立时保持对 `p->lock` 的持有。其中一个关键不变量是：**当进程处于 `RUNNING` 状态时，计时器中断触发的 `yield` 必须能够安全地将其切换出去**。这意味着，CPU 的寄存器中仍需保存进程的现场（也就是说，还没有通过 `swtch` 转移到 `p->context` 中），并且 `c->proc` 必须指向当前进程。另一个关键不变量是：**当进程处于 `RUNNABLE` 状态时，空闲的调度器必须能够安全地运行它**。这要求 `p->context` 中已经保存好了进程的寄存器状态（即寄存器现场不在真实寄存器中），没有任何 CPU 正在该进程的内核栈上运行，也没有任何 CPU 的 `c->proc` 指向这个进程。

需要注意的是：在持有 `p->lock` 的期间，这些不变量通常**不成立**，因为进程状态正在发生改变，调度器正处于中间状态。因此，`p->lock` 的存在就是为了在这些中间状态下保护这些关键字段的正确性，防止并发干扰。

维护上述不变量正是 XV6 经常在一个线程中获取 `p->lock`，却在另一个线程中释放它的原因。例如，`yield` 中获取锁，而在 `scheduler` 中释放。一旦 `yield` 开始将一个处于 `RUNNING` 状态的进程修改为 `RUNNABLE`，必须持续持有锁，直到相关不变量得以恢复。最早可以安全释放锁的时机，是 `scheduler`（运行在自己的内核栈上）将 `c->proc` 清空之后。同理，当 `scheduler` 开始将一个 `RUNNABLE` 的进程切换为 `RUNNING` 状态时，也必须一直持有 `p->lock`，直到该进程真正开始执行（即 `swtch` 之后，例如在 `yield` 中）。在此之前，绝不能释放锁。

除了维持调度相关的不变量之外，`p->lock` 还用于保护其他关键操作。例如，它协调 `exit` 和 `wait` 之间的配合，防止唤醒信号的丢失（详见后续内容），并避免进程退出期间与其他进程对其状态的访问产生竞争——例如，`exit` 可能会读取 `p->pid` 并设置 `p->killed`。

出于代码清晰性考虑，也出于性能优化的需求，我们有必要考虑是否有可能将 `p->lock` 所承担的多种职责拆分开来，使每种用途拥有更明确的边界和更细粒度的控制。

## `mycpu` 和 `myproc`
XV6 为每个 CPU 维护一个 `struct cpu`，用于记录当前在该 CPU 上运行的进程（如果有），保存调度线程的寄存器状态，并管理中断禁用所需的自旋锁嵌套计数。函数 `mycpu` 返回一个指向当前 CPU 所对应 `struct cpu` 的指针。事实上，RISC-V 为每个 CPU 分配了一个唯一的硬件线程编号（`hartid`），XV6 将每个 CPU 的 `hartid` 存储在对应 CPU 的 `tp` 寄存器中。这使得 `mycpu` 可以通过 `tp` 寄存器对全局 `cpus` 数组进行索引，从而获取当前 CPU 的 `struct cpu`。

确保每个 CPU 的 `tp` 寄存器始终保存其对应的 `hartid` 并不容易。在 CPU 启动的早期阶段（仍处于机器模式），XV6 通过 `mstart` 设置了 `tp`。由于 `tp` 是通用寄存器，用户进程可能会修改它，因此我们将其保存在蹦床页面上，并仅在进入内核时临时借用 `tp`。RISC-V 编译器保证永远不会使用 `tp` 寄存器，这为 XV6 的实现提供了便利。若 RISC-V 在管理模式下允许直接读取当前的 `hartid`，这一实现将更加简洁——但遗憾的是，只有在机器模式下才能读取。

`cpuid` 和 `mycpu` 的返回值是脆弱的：如果定时器中断导致线程让步并切换到另一个 CPU，那么之前返回的值将不再准确。为避免此问题，XV6 要求调用者在获取返回的 `struct cpu` 后禁用中断，并且仅在使用完返回的 `struct cpu` 后才重新启用中断。因为这里是只读，所以禁用中断即可，不需要上锁。

函数 `myproc` 返回当前 CPU 上运行进程的 `struct proc` 指针。`myproc` 禁用中断后，调用 `mycpu`，从 `struct cpu` 中获取当前进程的指针（`c->proc`），然后再启用中断。即使中断被启用，`myproc` 返回的值仍然是安全的：如果计时器中断导致进程切换到另一个 CPU，`struct proc` 指针不会改变，因为 `struct proc` 始终与当前 CPU 上的进程保持一致。

## `sleep` 与 `wakeup`
至此我们已经能让进程彼此切换，但我们还不能帮助进程进行有意的交互。XV6 使用了一种名为 `sleep` 和 `wakeup` 的机制，它允许进程在等待某个事件时进入休眠状态，并在事件发生后由另一个进程将其唤醒。这个机制通常被称为 **序列协调**（sequence coordination）或 **条件同步**（conditional synchronization）机制。

为了说明这一点，让我们考虑一个名为信号量（semaphore）的同步机制，它用于协调生产者和消费者。信号量维护一个计数，并提供两个操作：**“V”操作**（对于生产者）增加计数，**“P”操作**（对于消费者）等待计数为非零，然后递减并返回。如果只有一个生产者线程和一个消费者线程，并且它们在不同的 CPU 上执行，且编译器没有进行过过于积极的优化，那么这个实现将是正确的：

```c
struct semaphore {
    struct spinlock lock;
    int count;
};

void V(struct semaphore* s) {
    acquire(&s->lock);
    s->count += 1;
    release(&s->lock);
}

void P(struct semaphore* s) {
    while (s->count == 0)
        ;
    acquire(&s->lock);
    s->count -= 1;
    release(&s->lock);
}
```
这样的实现代价是相当昂贵的。如果生产者很少行动，消费者就会将大部分时间花在 `while` 循环中，反复等待计数为非零。这样，消费者的 CPU 就无法从等待中解脱出来，导致浪费时间。

为了避免这种情况，我们需要一种机制来让消费者能够释放 CPU，只有在 `V` 操作增加计数后才恢复执行。可以设想一组配对使用的调用：`sleep` 和 `wakeup`，其工作机制如下所示。`sleep(chan)` 会使调用它的进程在某个值为 `chan` 的等待通道（wait channel）上进入睡眠状态，从而让出 CPU，用于执行其他任务。与之对应的 `wakeup(chan)` 则会唤醒所有在该通道上休眠的进程（如果存在），使它们从 `sleep` 调用中返回。若当前没有进程在该通道上等待，`wakeup` 调用不会产生任何效果。

我们可以借助这两个函数将原来的信号量实现进行修改，以避免繁忙等待。下面是修改后的版本，添加了注释说明变更的部分：
```c
void V(struct semaphore* s) {
    acquire(&s->lock);
    s->count += 1;
    wakeup(s);  // !pay attention
    release(&s->lock);
}

void P(struct semaphore* s) {
    while (s->count == 0)
        sleep(s);  // !pay attention
    acquire(&s->lock);
    s->count -= 1;
    release(&s->lock);
}
```

在引入 `sleep` 和 `wakeup` 之后，消费者不再浪费 CPU 去自旋等待，而是主动通过 `sleep` 放弃 CPU，这显然是一种改进。但这也引入了经典的并发问题 —— **丢失唤醒（lost wake-up）**。

`sleep` 必须在持锁的情况下调用，因为它不仅要修改进程自身的状态，还要在进入休眠前检查某个条件（例如资源是否可用）。这一检查与休眠必须是原子的，否则可能在检查后、进入睡眠前的一瞬间错过唤醒信号。

相比之下，`wakeup` 的逻辑就简单得多。它只是遍历进程表，查找那些在给定 `chan` 上睡眠的进程，并将它们标记为 `RUNNABLE`。它并不依赖或访问 `chan` 代表的共享数据，只是把 `chan` 当作一个标签来匹配对应的进程，因此不需要外部持锁。

设想如下情况：消费者线程执行 `P` 操作，在第 9 行检查发现 `s->count == 0`。就在它即将进入休眠（也就是在第 9 行和第 10 行之间的时间窗口内），生产者线程在另一个 CPU 上运行，它执行了 `V` 操作，将 `s->count` 增加为非零，并调用了 `wakeup`。由于此时消费者还未正式进入睡眠状态，`wakeup` 发现没有进程在等待通道上，因而什么也没做。接着，消费者继续执行第 10 行，调用 `sleep` 并进入睡眠状态。结果就出现了问题：消费者正在等待一个已经发生过的事件，而 `wakeup` 已经错过了唤醒它的时机。除非生产者再次调用 `V`，否则消费者将永远休眠，即使此时 `count` 已为非零。

这个场景揭示了 `sleep` 和 `wakeup` 原始接口在缺乏原子性保护时容易引发竞态条件，因此必须借助一把锁来同步。然而，这里的竞态问题不同于常规的资源冲突：我们不能让 P 在持有锁的情况下直接进入睡眠，否则会造成死锁。

为解决这一问题，`sleep` 被设计为支持带锁进入。它在调用进程被标记为 `asleep` 并挂载到睡眠通道后，会自动释放锁，允许其他线程修改它关心的数据。一旦进程被唤醒，`sleep` 会重新获取这把锁，从而保证让调用 `sleep` 的线程可以继续安全地访问它之前关心的数据。

```c
void V(struct semaphore* s) {
    acquire(&s->lock);
    s->count += 1;
    wakeup(s);
    release(&s->lock);
}

void P(struct semaphore* s) {
    acquire(&s->lock);

    while (s->count == 0)
        sleep(s, &s->lock);  // !pay attention
    s->count -= 1;
    release(&s->lock);
}
```

下面我们来了解一下 `sleep` 和 `wakeup` 的具体实现。

`sleep` 会先获取进程锁并释放持有的锁，然后设置好通道，接着将当前进程标记为 `SLEEPING`，最后调用 `sched` 来释放 CPU，使系统可以调度其他进程运行。而 `wakeup` 则会在获取进程锁之后查找所有在指定等待通道上休眠的进程，并将它们的状态设置为 `RUNNABLE`，使其能够重新进入调度队列。`sleep` 和 `wakeup` 的调用者可以使用任何便于区分的值作为等待通道。XV6 中通常使用相关内核数据结构的地址作为通道，以自然地表示进程在等待的具体资源。

这里有一个可能会令人感到困惑的点：为什么这里就可以释放持有的锁？事实上，这个锁的目的本就是为了确保共享数据 `chan` 的一致性，或者说保证没有其他进程可以启动唤醒程序。那么，在已经持有进程锁的情况下，唤醒程序自然不能启动，因此这个锁的任务已经结束，可以释放。

还有一个细节就是这里的锁如果跟进程锁一样的话就会导致自锁，此时实际上我们不需要做任何事情，在 `wait` 持有 `p->lock` 访问 `sleep`时就属于这种情况。

现在 `sleep` 只持有进程锁，它可以通过记录睡眠通道、将进程状态更改为 `SLEEPING` 并调用 `sched` 将进程置于睡眠状态。

在某个时刻，一个进程会获取条件相关的锁，修改睡眠者正在等待的条件，并调用 `wakeup(chan)`。**在持有锁的情况下调用 `wakeup` 是至关重要的**。`wakeup` 会遍历整个进程表，并为它检查的每一个进程获取该进程的 `p->lock`——这样做不仅是为了可能修改进程状态，更是为了确保 `sleep` 和 `wakeup` 之间不会发生竞态，避免彼此“错过”。

一旦 `wakeup` 发现某个进程处于 `SLEEPING` 状态，且其等待的 `chan` 与传入参数匹配，它就会将该进程的状态改为 `RUNNABLE`。随后，调度器在下一次运行时会注意到该进程已经准备好运行，并适时唤醒它。尽管仍有可能等待的条件还不足以让它醒来，此时该进程会再次陷入沉睡。

通过睡眠与唤醒机制，我们可以实现条件同步，让进程进行合适的交互。

## 管道
一个更复杂的使用睡眠和唤醒机制来同步生产者和消费者的例子是 XV6 的管道实现。

每个管道由一个 `struct pipe` 表示，其中包含一把锁 `lock` 和一个数据缓冲区 `data`。字段 `nread` 和 `nwrite` 分别记录读取和写入缓冲区的总字节数。缓冲区是环形结构：在 `buf[PIPESIZE - 1]` 之后，写入的下一个字节是 `buf[0]`。但 `nread` 和 `nwrite` 本身不是环形的，而是不断递增的计数器。这种设计使得我们可以轻松区分**缓冲区满**（`nwrite == nread + PIPESIZE`）和**缓冲区空**（`nwrite == nread`）的情况。但也因此，访问缓冲区时必须通过取模操作，例如使用 `buf[nread % PIPESIZE]`，而不能直接用 `nread`（`nwrite` 同理）。

假设 `piperead` 和 `pipewrite` 的调用分别在两个不同的 CPU 上同时发生。`pipewrite` 首先获取管道的锁，这把锁用于保护计数器、数据缓冲区及相关的不变量。此时，`piperead` 也尝试获取同一把锁，但由于锁已被持有，它会在 `acquire` 中自旋等待。

在 `piperead` 等待期间，`pipewrite` 会遍历 `addr[0..n-1]` 中的字节，逐个将其写入管道缓冲区。在这个过程中，缓冲区可能被写满。此时，`pipewrite` 会调用 `wakeup`，通知所有在等待数据的读进程：缓冲区已有数据可读。随后，`pipewrite` 在 `&pi->nwrite` 上睡眠，等待读进程从缓冲区中取出一些字节。`pipewrite` 睡眠时，`sleep` 会自动释放 `pi->lock`，以便其他进程可以访问管道。

此时，`pi->lock` 变得可用，`piperead` 成功获取锁并进入临界区。它发现 `pi->nread != pi->nwrite`（即还有数据可读——这是因为 `pipewrite` 进入睡眠时，满足的是 `pi->nwrite == pi->nread + PIPESIZE`，表示缓冲区已满）。于是，`piperead` 进入循环，从管道中复制数据，并按读取的字节数递增 `nread`。这些被读出的字节腾出了空间，因此 `piperead` 在返回前调用 `wakeup` 唤醒所有在 `&pi->nwrite` 上休眠的写进程。`wakeup` 会查找那些在该等待通道上睡眠的进程——它们此前在缓冲区写满时停止在 `pipewrite` 中。找到后，`wakeup` 将这些进程标记为 `RUNNABLE`，使其可以被调度器重新运行。

管道代码为读进程和写进程分别使用独立的睡眠通道（`pi->nread` 和 `pi->nwrite`），这样做的好处是在极少数读者和写者大量并发等待同一管道的情况下，能提高系统的效率。代码总是在检查条件的循环中调用 `sleep`；因此，如果有多个读者或写者在等待，除了第一个被唤醒且条件已满足的进程之外，其余进程醒来后通常仍会发现条件不成立，并再次进入睡眠。

`sleep/wakeup` 的使用，本质是为了“条件同步”，而不是“等待时间长短”。在 `pipe` 中选择使用基本的睡眠/唤醒机制而非睡眠锁是因为它只需要同步，并不需要长时间等待，用基本的睡眠/唤醒机制是为了减小开销。

## wait, exit和kill
`sleep` 和 `wakeup` 可以用于多种类型的等待。另一个有趣的例子出现在第一章的子进程 `exit` 和父进程 `wait` 之间的交互之中。

总体上来看，当子进程退出时，父进程可能正在 `wait` 中休眠，也可能在做其他事情；后者的情况下，随后的 `wait` 调用必须能够察觉到子进程已经退出，即使是在子进程调用 `exit` 很久之后。为了确保这一点，XV6 在子进程退出时将其状态设置为 `ZOMBIE`，并保留该状态直到父进程调用 `wait`。`wait` 会将子进程状态改为 `UNUSED`，复制其退出状态码，并将子进程的 PID 返回给父进程。如果父进程先于子进程退出，XV6 会将该子进程的父进程改为 `init` 进程。而 `init` 进程会不断调用 `wait`，确保所有孤儿进程最终都能被正确清理。

这一机制背后的实现挑战在于：父进程与子进程之间的 `wait` 与 `exit`，以及并发 `exit` 之间可能存在的竞态和死锁问题。

由于 `wait` 关心的资源与进程的所有子进程相关，使用一个与进程本身相关的锁无疑是一个合适的选择，最直接的选择就是进程锁。`wait` 使用调用进程自己的 `p->lock` 作为条件锁，以避免**丢失唤醒**问题，并在开始时获取这把锁。接着它会扫描整个进程表，查找属于自己的子进程。如果它发现某个子进程处于 `ZOMBIE` 状态，说明该子进程已经退出但尚未被清理。此时，`wait` 会回收该子进程占用的资源并释放其 `proc` 结构体；如果调用时传入了非空地址，还会将子进程的退出状态码复制到该地址；最后返回子进程的 PID；如果扫描过程中找到了子进程但没有任何一个已经退出，`wait` 就会调用 `sleep`，等待某个子进程的退出事件，然后再重新扫描一次。此处 `sleep` 所释放的锁就是调用进程自身的 `p->lock`，这是 XV6 中少见的以调用者自己的锁作为条件锁的情形。

当然，在某些版本的实现中，为了简化 `wait()` 的实现并避免复杂的锁依赖，XV6 选择使用一把全局锁 `wait_lock` 来作为 `sleep()` 的条件锁。这种方式避免了对每个进程都使用独立的 `p->lock`，从而绕开了 `wait()` 中需要先持有父进程锁、再访问子进程的锁所带来的潜在死锁风险。由于 `wait()` 需要遍历整个 `proc[]` 表查找其子进程的状态，而每次访问子进程的成员（如 `state`）都必须加锁，因此该实现在进入 `sleep()` 前只需确保自己仍拥有 `wait_lock` 即可。在对应的 `exit()` 中，内核也在唤醒父进程之前加锁 `wait_lock`，从而保证了唤醒不会丢失。这种设计虽然加大了锁的粒度，可能影响并发性，但换来了更清晰的锁结构和更低的死锁风险，更适合教学场景和简单内核结构。

需要特别注意的是，`wait` 过程中可能同时持有两把锁：它首先获取自己的锁 `p->lock`，在此基础上再尝试获取子进程的锁。这就要求整个 XV6 系统在处理父子进程关系时必须遵循一致的加锁顺序（即先父后子），以避免死锁。

`wait` 通过检查每个进程的 `np->parent` 字段来查找其子进程。它在未持有 `np->lock` 的情况下访问该字段，这违反了通常的并发规则：共享变量的访问应受到锁的保护。然而，这么做是出于避免死锁的考虑。`np` 可能是当前进程的祖先，如果在遍历过程中尝试获取 `np->lock`，就可能违反“先锁父、再锁子”的锁获取顺序，从而导致死锁。尽管这种无锁读取看似危险，但这里是安全的：一个进程的 `parent` 字段只会被它的父进程修改。因此，如果 `np->parent == p` 在某一时刻为真，那除非当前进程自己改变它，该值在后续也不会变化。

`exit` 记录退出状态码，释放部分资源，将所有子进程转交给 `init`，如果父进程正在等待，则唤醒它。随后，它将自身标记为僵尸进程（`ZOMBIE`），并永久让出 CPU。  

这个过程的最后几个步骤顺序较为微妙：退出进程必须在将其状态设为 `ZOMBIE` 并唤醒父进程时，持有父进程的锁——这是因为 `wait` 使用父进程的锁作为条件锁，以避免丢失唤醒。同时，退出进程还必须持有自己的 `p->lock`，否则父进程可能在它仍在运行时就观察到 `ZOMBIE` 状态并开始回收该结构体。锁的获取顺序对避免死锁至关重要：由于 `wait` 总是先获取父锁再获取子锁，因此 `exit` 也必须遵循相同的顺序。

`exit` 会调用一个专门的唤醒函数 `wakeup1`，这是因为我们规定了锁的获取顺序，所以不能用 `wakeup` 函数。该函数只会唤醒当前进程的父进程，且父进程必须正处于 `wait` 中的睡眠状态。虽然子进程在将自身状态设置为 `ZOMBIE` 之前就唤醒了父进程，这看起来可能存在竞态，但实际上是安全的：尽管 `wakeup1` 可能导致父进程立即运行，但 `wait` 中的循环在调度器释放子进程的 `p->lock` 之前，无法观察到子进程的状态。因此，父进程不会在 `exit` 设置状态之前就看到子进程处于 `ZOMBIE` 状态，也就不会提前对其进行回收。

`exit` 允许进程自行终止，而 `kill` 则允许一个进程请求终止另一个进程。直接立即销毁目标进程（即被 kill 的进程）是非常复杂且危险的，因为目标进程可能正运行在另一个 CPU 上，甚至可能正处于修改内核数据结构的关键时刻。因此，`kill` 的实现非常简洁：它仅仅设置目标进程的 `p->killed` 标志，如果目标进程当前处于睡眠状态，还会将其唤醒。

目标进程最终一定会再次进入或离开内核，而在进入内核（如通过系统调用或中断）时，如果发现 `p->killed` 被设置，`usertrap` 中的代码就会触发 `exit`，使进程终止。即使目标进程当时正运行在用户空间，它也很快会因为系统调用或定时器中断等事件重新进入内核，从而触发退出流程。

如果受害进程正在休眠，`kill` 调用中的 `wakeup` 会使其从休眠中返回。这本身是有潜在风险的，因为**唤醒时等待的条件可能尚未满足**。不过，XV6 的所有 `sleep` 调用都**被包裹在一个 while 循环中**，该循环会在 `sleep` 返回后重新检查条件是否成立。

此外，一些 `sleep` 调用还会在循环中检查 `p->killed` 标志。如果发现该标志被设置，则会**中止当前操作**。当然，只有在中止是合理的前提下，才会进行这种检查。比如，在管道的读写代码中，如果检测到进程被 kill，将会立即返回；后续执行路径最终会进入 trap（陷阱处理），在这里系统会再次检查 `killed` 标志并调用 `exit` 退出。

这里不用睡眠锁的理由又有所不同，这里目标并不是保护共享资源，而是让父进程等待子进程的退出。在这个过程中，父进程并不会直接操作共享数据结构，因此不需要使用睡眠锁来同步。只有**等待时间长**且需要**修改共享资源**时，才需要使用睡眠锁来保护数据结构的完整性。

说起来今天才知道 VSCode 的 vim 插件用的寄存器跟系统剪切板不一样，如果要用系统剪切板要开 `set clipboard=unnamedplus`。

## 小总结：XV6 进程状态一览
<table border="1" cellspacing="0" cellpadding="6">
  <thead>
    <tr>
      <th>状态</th>
      <th>含义</th>
      <th>会被调度？</th>
      <th>何时设置？</th>
      <th>会变为？</th>
      <th>举例</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>UNUSED</code></td>
      <td>空槽，未被占用</td>
      <td>❌</td>
      <td><code>proc</code> 被初始化或回收后</td>
      <td>分配后 → <code>EMBRYO</code></td>
      <td>空闲 <code>proc[]</code> 表项</td>
    </tr>
    <tr>
      <td><code>EMBRYO</code></td>
      <td>正在创建</td>
      <td>❌</td>
      <td><code>allocproc()</code> 中</td>
      <td><code>RUNNABLE</code></td>
      <td>刚分配的进程</td>
    </tr>
    <tr>
      <td><code>SLEEPING</code></td>
      <td>睡眠中，等待事件</td>
      <td>❌</td>
      <td><code>sleep(chan, lock)</code></td>
      <td>被 <code>wakeup</code> → <code>RUNNABLE</code></td>
      <td>等待输入、锁资源</td>
    </tr>
    <tr>
      <td><code>RUNNABLE</code></td>
      <td>可运行队列</td>
      <td>✅</td>
      <td>被 <code>wakeup</code> 或刚创建好</td>
      <td><code>RUNNING</code></td>
      <td>等待被调度</td>
    </tr>
    <tr>
      <td><code>RUNNING</code></td>
      <td>正在 CPU 上执行</td>
      <td>✅</td>
      <td>被调度器挑中运行时</td>
      <td>执行结束或主动放弃 CPU</td>
      <td></td>
    </tr>
    <tr>
      <td><code>ZOMBIE</code></td>
      <td>已退出，等待父收尸</td>
      <td>❌</td>
      <td><code>exit()</code> 时</td>
      <td>被 <code>wait()</code> → <code>UNUSED</code></td>
      <td>子进程退出但父未 <code>wait</code></td>
    </tr>
  </tbody>
</table>

# 实验内容
## Uthread: switching between threads (moderate)
第一个小实验要求我们实现简单的“用户级线程”，也就是说我们完全在用户态自己管理、创建、切换一些小线程。它切换快，控制透明，对内核透明，而且可移植性高，适合轻量、可控的任务模型。

这个实验很简单，我们参考内核中的 `proc.h`,`proc.c` 以及 `swtch.S` 即可。类似进程的结构体，我们用一个 `thread_context` 保存上下文。
```c
struct thread_context
{
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
struct thread {
  char       stack[STACK_SIZE]; /* the thread's stack */
  int        state;             /* FREE, RUNNING, RUNNABLE */
  struct thread_context context;/* the thread's context*/

};
```

然后完善 `thread_create` 函数。参考 `procinit` 函数，我们知道初始时进程只要保存 `ra` 和 `sp` 寄存器，也即返回地址和栈指针。这里的返回地址就是我们的函数所在位置，我们假装自己是调用了 `func` 准备返回。
```c
void 
thread_create(void (*func)())
{
  struct thread *t;

  for (t = all_thread; t < all_thread + MAX_THREAD; t++) {
    if (t->state == FREE) break;
  }
  t->state = RUNNABLE;
  // YOUR CODE HERE

  t->context.ra = (uint64)func;
  t->context.sp = (uint64)&t->stack[STACK_SIZE - 1];
}
```

然后在 `thread_schedule` 里面调用 `thread_switch` 函数来切换进程上下文。
```c
  if (current_thread != next_thread) {         /* switch threads?  */
    next_thread->state = RUNNING;
    t = current_thread;
    current_thread = next_thread;
    /* YOUR CODE HERE
     * Invoke thread_switch to switch from t to next_thread:
     * thread_switch(??, ??);
     */
    thread_switch((uint64)&t->context, (uint64)&next_thread->context);
  } else
    next_thread = 0;
```

最后完善 `thread_swtch` 函数，把 `swtch.S` 里面的上下文切换函数抄过来即可。
```asm
thread_switch:
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
	
	ret    /* return to ra */
```

## Using threads (moderate)
这个实验也很简单，要我们解决并发时候的竞态问题。我们可以发现是插入桶的时候可能有并发问题，那么最简单的解决方法就是给整个表上一个锁。但这样就将所有的操作都串行化了，没有利用多线程的性能，加上额外开销导致性能甚至比单线程要低。

<img src="/illustrations/MIT-6-S081-Lab7/1.png" alt="表级锁结果">

更好的方法是给每个桶加一个锁，如果需要插入修改，就给对应的桶上锁。不要忘了测试前要 `make ph`。

```c
pthread_mutex_t lock[NBUCKET];

static 
void put(int key, int value)
{
  int i = key % NBUCKET;

  // is the key already present?
  struct entry *e = 0;
  for (e = table[i]; e != 0; e = e->next) {
    if (e->key == key)
      break;
  }
  if(e){
    // update the existing key.
    e->value = value;
  } else {
    // the new is new.
    pthread_mutex_lock(&lock[i]);
    insert(key, value, &table[i], table[i]);
    pthread_mutex_unlock(&lock[i]);
  }
}

int
main(int argc, char *argv[])
{
  ...
  // 初始化锁
  for (int i = 0; i < NBUCKET; i++)
    pthread_mutex_init(&lock[i], NULL);
  ...
}
```
<img src="/illustrations/MIT-6-S081-Lab7/2.png" alt="桶级锁结果">

## Barrier(moderate)
最后一个实验是实现一个屏障，让所有线程同步。不难看出这个就是 `sleep` 和 `wakeup` 机制的最简单利用。我们在睡眠前获取锁，带锁进入睡眠，被唤醒后再释放锁即可。

```c
static void 
barrier()
{
  // YOUR CODE HERE
  pthread_mutex_lock(&bstate.barrier_mutex);
  bstate.nthread++;
  if (bstate.nthread == nthread)
  {
    bstate.round++;
    bstate.nthread = 0;
    pthread_cond_broadcast(&bstate.barrier_cond);
  }
  else
    pthread_cond_wait(&bstate.barrier_cond, &bstate.barrier_mutex);
  pthread_mutex_unlock(&bstate.barrier_mutex);
}
```
# 小结
Lab7 慢慢悠悠地完结了，这Lab难度跟手册上的例子难度差的不是一点半点，简单的过头了。如果对比较难的手册内容都理解了的话，稍微简化一些就可以搬到Lab中用了。总之，进程是操作系统中相当有趣的一部分。通过多个进程、线程的切换，可以很好地协调整个系统，提高效率。

<img src="/illustrations/MIT-6-S081-Lab7/3.png" alt="通关截图">