---
title: 'MIT-6-S081-Lab3: Page tables'
date: 2025-03-07 13:44:44
categories: 6.s081
tags: [操作系统, 页表, Linux, 6.s081]
---
# 知识点
到Lab3啦，这个Lab涉及到对页表的理解分析，我们需要探索页表并对其进行修改。

## 分页硬件的结构

正如在Lab2之中我们提到的，页表负责将虚拟地址映射到真实地址。在我们基于Sv39 RISC-V的 XV6 中，我们只使用 64 位地址的低 39 位。

页表实际上是一个由（$2^{27}$）个页表条目（Page Table Entries/PTE）组成的数组，每个PTE包含一个 44 位的物理页码（Physical Page Number/PPN）和 10 位的标志。分页硬件通过利用虚拟地址的前 39 位中的 27 位来索引页表，从而找到与该虚拟地址对应的 PTE。接着，它生成一个 56 位的物理地址，其中前 44 位取自 PTE 中的 PPN，后 12 位则直接来自原始虚拟地址。页表使操作系统能够以 4096（$2^{12}$）字节的对齐块的粒度控制虚拟地址到物理地址的转换，这样的块称为页（page）。

在Sv39 RISC-V中，前 25 位不用于转换，纯粹是用于符号扩展，保证地址的正确性，因为 39 位已经足够多（但我们设计操作系统的时候实际只使用38位，单纯是为了简单）。如果需要更多，RISC-V 设计人员也定义了具有 48 位虚拟地址的 Sv48。

实际的页表索引分三个步骤进行。页表以三级的树型结构存储在物理内存中。该树的根是一个 4096 字节的页表页，其中包含 512 个 PTE，每个 PTE 中包含该树下一级页表页的物理地址。每一级页表页都包含 512 个 PTE。分页硬件使用虚拟地址的 27 位进行三级索引：前 9 位选择根页表中的 PTE，中间 9 位选择下一级页表中的 PTE，最后 9 位选择最终的 PTE。如果转换地址所需的三个 PTE 中的任何一个不存在，页式硬件就会引发缺页异常（page-fault exception），并让内核来处理该异常。

三级结构对储存结构做了优化。当进程被实际访问的虚拟内存比较少时（可能是在虚拟地址空间中分配的地址范围比较小，也可能是分配的多但实际使用的虚拟内存较少），只有一部分虚拟地址会被实际映射到物理内存。事实上，只有实际使用的 PTE 所在的页才会被分配。

因为 CPU 在执行转换时会在硬件中遍历三级结构，所以 CPU 必须从内存中加载三个 PTE 以将虚拟地址转换为物理地址，这无疑是非常耗时的。为了减少从物理内存加载 PTE 的开销，RISC-V CPU 将页表条目缓存在 Translation Look-aside Buffer (TLB) 中，它是一个专门存储页表项的高速缓存。TLB 被用来缓存最近使用的页表项，使得 CPU 在大多数情况下能够快速完成地址转换。

每个 PTE 包含若干标志位，这些标志位用于告知分页硬件如何处理与该 PTE 关联的虚拟地址。PTE_V 表示 PTE 是否有效：如果未设置此位，对页面的访问将引发异常（即禁止访问）。PTE_R 控制是否允许读取页面内容。PTE_W 决定是否允许写入页面。PTE_X 指示 CPU 是否可以将页面内容当作指令来执行。PTE_U 决定用户模式下是否允许访问该页面；如果未设置 PTE_U，页面只能在管理模式下访问。标志和所有其他与页面硬件相关的结构在（`kernel/riscv.h`）中定义。

我们自然会好奇根页表页如何确定。事实上，内核会将根页表页的物理地址写入到 `satp` 寄存器中。`satp` 寄存器用于指示当前进程的页表位置，当 CPU 访问虚拟地址时，硬件自动以 `satp` 指向的页表为根进行转换。又因为每个 CPU 都有自己的 `satp` 寄存器，所以不同的 CPU 可以运行不同的进程，且地址空间存在隔离。

在 XV6 中，每个进程的用户页表仅管理用户地址空间（`0x0` 到 PLIC），而内核页表（`kernel_pagetable`）是全局唯一的，独立于所有用户页表。内核页表在系统启动时初始化，并通过恒等映射直接访问物理内存和硬件设备。当进程通过系统调用或中断陷入内核态时，硬件执行位于共享的 `trampoline` 页中的代码（`uservec`），该代码会显式修改 `satp` 寄存器以切换到内核页表，而非继续使用用户页表。内核栈作为进程私有的数据结构，通过内核页表映射到内核地址空间的高端区域，用户页表中不存在内核栈的映射，从而完全隔离用户与内核的地址访问。这一设计通过强制页表切换和地址空间隔离，确保内核代码始终运行在受保护的环境中，即使用户程序存在内存错误或恶意行为，也不会影响内核的稳定性。

进程陷入内核态后，CPU 通过 `satp` 寄存器使用内核页表访问物理内存，此时用户页表已被完全替换。内核栈的独立性和内核页表的全局性使得所有进程在内核态共享同一份内核代码和数据结构，但各自维护**独立的**内核栈以防止数据冲突。用户页表从未包含内核地址空间的映射，所有内核资源的访问均依赖显式的页表切换机制，而非通过用户页表直接访问。这种严格的隔离机制是 XV6 实现特权级保护和系统安全的核心基础。

## 内核地址空间

内核通过独立的全局页表（`kernel_pagetable`）管理所有内核资源，该页表在系统启动时初始化，采用恒等映射（虚拟地址 `KERNBASE = 0x80000000` 起直接对应物理地址，刚好对应顶级页目录的条目2）。当进程通过陷阱（如系统调用或中断）进入内核态时，硬件执行 `trampoline` 页中的代码（`uservec`），显式将 `satp` 寄存器切换到内核页表，使 CPU 能够访问内核代码、设备和进程独立的内核栈。内核通过内核页表直接读写物理内存和硬件寄存器，例如设备接口（UART、磁盘）被映射到固定的内核虚拟地址，而每个进程的内核栈则通过内核页表映射到独立的高端地址，用户页表无法访问这些区域。这种设计通过硬件级页表切换和严格的内核/用户地址空间隔离，确保内核始终在受控环境中执行，用户程序的错误或恶意行为不会影响内核稳定性。

<img src="/illustrations/MIT-6-S081-Lab3/1.png" alt="映射示意图">

在QEMU中，0~0x80000000用于映射设备接口，而0x80000000(KERNBASE) ~ 0x86400000(PHYSTOP)为RAM。对0~0x80000000内的物理地址进行读写可以与设备交互，具体内容将在后面的课程中介绍。

内核中有很多地址是“直接映射”，比如内核本身在内核虚拟地址空间和物理内存中都位于 `KERNBASE=0x80000000`，这种设计使得在内核读取或写入物理内存非常方便。

但要注意，也存在几个内核虚拟地址不是直接映射：
- 蹦床页面（trampoline page）：它映射在虚拟地址空间的顶部，用户页表也具有相同的映射，用于特权级切换。
- 内核栈页面：在 XV6 中，每个进程的内核栈通过内核页表映射到虚拟地址空间的高端区域（如 `KSTACK` 宏计算的位置），其下方设有未映射的保护页（PTE不存在）。这种保护页仅占据虚拟地址空间而不消耗物理内存，确保内核栈溢出时触发页错误并引发 `panic`，避免破坏相邻内核数据。内核栈的物理内存通过`kalloc`独立分配，并借助内核页表的**恒等映射特性**实现双重地址访问：既可通过进程专属的高端虚拟地址访问，也可通过物理地址直接操作。这种设计既保证了内核栈的隔离性与安全性，又为内核提供了灵活的内存管理手段，展现了页表机制在地址空间抽象与硬件交互中的巧妙平衡。

## 内核初始化代码

与地址空间和页表有关的 XV6 代码主要在 `vm.c` (`kernel/vm.c`) 中，最核心的数据结构是 `pagetable_t` ，它实际上是指向 RISC-V 根页表页的指针。一个 `pagetable_t` 可以是内核页表，也可以是进程页表。XV6 页表管理的核心函数是 `mappages` 和 `walk`，其中：

<ul>
    <li> <code>mappages</code> 用于在页表中为新的映射装载 PTE，确保虚拟地址与物理地址之间的映射关系得到正确建立。</li>
    <li> <code>walk</code> 通过虚拟地址操作内存，配置页表内容。</li>
</ul>

命名上，以 `kvm` 开头的函数操作**内核页表**，以 `uvm` 开头的函数操作**用户页表**，其他函数则用于操作这两者。例如，`copyout` 和 `copyin` 分别用于将数据复制到用户虚拟地址或从用户虚拟地址复制数据，这些虚拟地址通常作为系统调用的参数提供。由于需要显式翻译这些虚拟地址来找到相应的物理内存，因此相关代码也位于 `vm.c` 中。

在系统启动时，`main` 调用 `kvminit`，其中 `kvminit` 通过调用 `kvmmake` 来创建内核页表。`kvmmake` 首先分配一页物理内存来存放根页表，然后调用 `kvmmap` 装载内核所需的地址映射，这些映射包括内核指令和数据、物理内存上限（PHYSTOP）以及设备内存。最后，它将 `trampoline` 映射到内核虚拟地址空间的最顶端。

下面来看两个核心函数。

`mappages` 的输入是一个页表，用于建立虚拟地址 `va` 和物理地址 `pa` 之间的映射关系。这个映射包括指定映射的大小 `size` 以及 PTE 的权限 `perm`。`PGROUNDDOWN` 负责将给定的地址向下对齐到页边界，确保地址符合页对齐的要求。

`mappages` 函数会调用 `walk` 为虚拟地址 `va` 查找最后一级页表的 PTE 的指针，如果该 PTE 有效，意味着该虚拟地址已经被使用，因而需要重新建立映射。映射的过程包括将物理地址 `pa`、权限 `perm` 以及 PTE 的有效位写入相应的页表条目。其中 `PA2PTE` 负责将物理地址转化为页表项格式。这里的 `PA2PTE(pa)` 是一个宏，用于将物理地址 `pa` 转换为 `pte_t` 的格式。

```c
// Create PTEs for virtual addresses starting at va that refer to
// physical addresses starting at pa. va and size might not
// be page-aligned. Returns 0 on success, -1 if walk() couldn't
// allocate a needed page-table page.
int
mappages(pagetable_t pagetable, uint64 va, uint64 size, uint64 pa, int perm)
{
    uint64 a, last;
    pte_t *pte;

    a = PGROUNDDOWN(va);
    last = PGROUNDDOWN(va + size - 1);
    for(;;){
        if((pte = walk(pagetable, a, 1)) == 0)
            return -1;
        if(*pte & PTE_V)
            panic("remap");
        *pte = PA2PTE(pa) | perm | PTE_V;
        if(a == last)
            break;
        a += PGSIZE;
        pa += PGSIZE;
    }
    return 0;
}
```

`walk` 函数在每一级页表查找时，首先通过当前级别的 9 位索引找到对应的 PTE（页表项）。如果该 PTE 有效，则从 PTE 的高 44 位提取出下一级页表的**物理地址**，并更新 `pagetable` 指针指向该地址；如果 PTE 无效且允许分配页表（即 `alloc = 1`），则调用 `kalloc` 分配一个新的页表（`kalloc` 返回一个虚拟地址，但其实跟物理地址是一样的，毕竟这里是直接映射），并将该虚拟地址更新到当前 PTE 中。其中，`PTE2PA` 是一个宏，用于从页表项 `pte_t` 中提取存储的**物理地址**，`PX` 则是用于从虚拟地址中计算在多级页表中的索引（例如三级页表中的某一级的索引）。

```c
pte_t *
walk(pagetable_t pagetable, uint64 va, int alloc)
{
if(va >= MAXVA)
    panic("walk");

for(int level = 2; level > 0; level--) {
    pte_t *pte = &pagetable[PX(level, va)];
    if(*pte & PTE_V) {
    pagetable = (pagetable_t)PTE2PA(*pte);
    } else {
    if(!alloc || (pagetable = (pde_t*)kalloc()) == 0)
        return 0;
    memset(pagetable, 0, PGSIZE);
    *pte = PA2PTE(pagetable) | PTE_V;
    }
}
return &pagetable[PX(0, va)];
}
```
`walk` 函数通过虚拟地址操作内存，负责配置页表的内容，它实现了内存管理单元（Memory Management Unit, MMU）相同的功能。当分页未启用时，虚拟地址通常直接映射为物理地址，硬件不进行地址转换。启用分页后，虚拟地址必须通过硬件的 MMU 通过页表转换为物理地址。不过，启用分页后的内核虚拟地址空间中，部分地址（比如内核代码和数据）内核虚拟地址与物理地址是恒等映射，这样内核仍然可以方便地访问物理内存。`pagetable[]` 是内核为虚拟地址管理而构建的结构，它不仅是内核的数据结构，也在一定程度上充当硬件接口，符合 RISC-V 规范，硬件依赖它来完成地址转换。

在 `kvminit` 调用完成后，内核页表初始化完毕。接着，在 `main` 函数中，会调用 `kvminithart` 来加载内核页表。该函数通过 `w_satp` 将内核根页表 `pagetable` 的物理地址写入 `satp` 寄存器中并清除所有的 TLB 条目，之后 CPU 将使用该内核页表来完成虚拟地址到物理地址的转换。

接着，`main` 函数调用 `procinit`，为每个用户进程分配一个内核栈。该内核栈被映射到内核虚拟地址空间的高地址部分，位于 `trampoline` 下方，并被保护页包围。通过调用 `KSTACK` 宏，可以获得每个进程的内核栈虚拟地址 `va`。接着，调用 `kvmmap` 将虚拟地址 `va` 和 `kalloc` 返回的物理地址 `pa` 进行映射，最后通过 `kvminithart` 更新 `satp` 寄存器。

```c
// initialize the proc table at boot time.
void
procinit(void)
{
struct proc *p;

initlock(&pid_lock, "nextpid");
for(p = proc; p < &proc[NPROC]; p++) {
    initlock(&p->lock, "proc");

    // Allocate a page for the process's kernel stack.
    // Map it high in memory, followed by an invalid
    // guard page.
    char *pa = kalloc();
    if(pa == 0)
        panic("kalloc");
    uint64 va = KSTACK((int) (p - proc));
    kvmmap(va, (uint64)pa, PGSIZE, PTE_R | PTE_W);
    p->kstack = va;
}
kvminithart();
}
```

每个RISC-V CPU将页表条目缓存在 TLB 中。当 XV6 更改页表时，它必须通知 CPU 使相应的 TLB 条目失效。如果没有及时失效，那么在后续操作中，TLB 可能会使用旧的缓存映射，这些映射可能指向已经被重新分配给其他进程的物理页面。这将导致一个进程能够在另一个进程的内存区域进行非法写操作，从而引发安全问题。

为了解决这个问题，RISC-V提供了一条指令 `sfence.vma`，用于刷新当前 CPU 的 TLB 。在 XV6 中，当重新加载 `satp` 寄存器后，会在 `kvminithart` 中执行 `sfence.vma` 。同样，在切换到用户页表并返回用户空间之前，`sfence.vma` 也会在 `trampoline` 代码中执行。

接下来，`main` 会调用 `userinit` 函数创建初始进程。`initproc` 是一个指向初始进程（通常是 `init` 进程）的指针，用于在内核中追踪这个进程。初始进程负责创建其他用户进程并提供基础系统服务。对于孤立进程（即失去父进程的进程），会重新分配其父进程为 `initproc`。由于在 `procinit` 函数中已经为每个进程分配了内核栈，因此只需找到对应的内核栈并建立映射，无需重新分配新的内核栈。代码如下：

```c
// Set up first user process.
void
userinit(void)
{
    struct proc *p;

    p = allocproc();
    initproc = p;
    
    // allocate one user page and copy init's instructions
    // and data into it.
    uvminit(p->pagetable, initcode, sizeof(initcode));
    p->sz = PGSIZE;

    // prepare for the very first "return" from kernel to user.
    p->trapframe->epc = 0;      // user program counter
    p->trapframe->sp = PGSIZE;  // user stack pointer

    safestrcpy(p->name, "initcode", sizeof(p->name));
    p->cwd = namei("/");

    p->state = RUNNABLE;

    release(&p->lock);
}
```

这里我们调用了 `allocproc` 函数，首先通过 `allocpid` 为当前进程分配了一个唯一的 `pid`，接着调用 `proc_pagetable` 为该进程创建了一个空的页表。在这个页表中，只有顶部的 `trampoline` 和 `trapframe` 区域被映射。`proc_pagetable` 内部调用了 `uvmcreate`，而 `uvmcreate` 则通过 `kalloc` 分配页表所需的内存。

```c
static struct proc*
allocproc(void)
{
    struct proc *p;

    for(p = proc; p < &proc[NPROC]; p++) {
        acquire(&p->lock);
        if(p->state == UNUSED) {
        goto found;
        } else {
        release(&p->lock);
        }
    }
    return 0;

    found:
    p->pid = allocpid();

    // Allocate a trapframe page.
    if((p->trapframe = (struct trapframe *)kalloc()) == 0){
        release(&p->lock);
        return 0;
    }

    // An empty user page table.
    p->pagetable = proc_pagetable(p);
    if(p->pagetable == 0){
        freeproc(p);
        release(&p->lock);
        return 0;
    }

    // Set up new context to start executing at forkret,
    // which returns to user space.
    memset(&p->context, 0, sizeof(p->context));
    p->context.ra = (uint64)forkret;
    p->context.sp = p->kstack + PGSIZE;

    return p;
}
```
## 物理内存分配

内核在运行时需要为页表、用户内存、内核栈和管道缓冲区等分配和释放物理内存。XV6 将内核末尾到 `PHYSTOP` 之间的物理内存用于这些运行时分配，这一部分称为free memory，每次分配或释放的内存单位是整个 4096 字节的页面。为了管理这些页面，XV6 使用链表数据结构记录空闲页面。当内核分配页面时，会从链表中移除相应的页面；释放页面时，会将释放的页面重新添加到链表中。

分配器的代码位于 `kalloc.c` 文件中，其整体结构非常简单，采用单链表将所有内存页块串联起来。在 `kinit` 函数中，内存分配器完成了初始化，内存范围从内核数据段结束处开始，到 `PHYSTOP` 为止，并调用 `freerange` 函数。随后，`freerange` 函数逐页调用 `kfree` 来初始化每个内存页。`kfree` 函数回收物理地址 `pa` 处的内存页块，首先使用 `memset` 填入垃圾值，然后采用头插法将该页块挂载到空闲链表（freelist）中。

当需要分配物理页块时，`kalloc` 函数会被调用，并返回一个页的物理地址。它的逻辑非常简单：从 `freelist` 链表的头部取出一页并返回，即通过头部删除法完成分配。因此可以看到，`kalloc` 在分配物理页时，是从高地址的物理内存开始向低地址逐步分配的。

## 进程地址空间

每个进程都有一个单独的页表。进程的用户内存从虚拟地址零开始，可以增长到 `MAXVA`。当进程要求 XV6 提供更多的用户内存时，XV6 首先使用 `kalloc` 来分配物理页面。然后，它将新的 PTE 添加到指向新物理页面的进程的页面表中，XV6在这些 PTE 中设置PTE_W、PTE_X、PTE_R、PTE_U和PTE_V标志。大多数进程不使用整个用户地址空间，XV6 在未使用的 PTE 中清除 PTE_V。

下图更详细地显示了 XV6 中执行进程的用户内存布局。堆栈是一个单独的页面，显示的是exec创建的初始内容，包含命令行参数的字符串以及指向它们的指针数组位于堆栈的最顶端。

<img src="/illustrations/MIT-6-S081-Lab3/2.png" alt="用户地址空间结构图">

和内核栈一样，XV6 会在堆栈正下方放置一个无效的保护页（guard page）。如果用户堆栈溢出，并且进程试图使用堆栈下方的地址，则硬件将生成页面错误异常，因为映射无效。实际操作系统可能会在用户堆栈溢出时自动为其分配更多内存。

## `sbrk`

`sbrk` 是一个用于扩展或收缩进程内存的系统调用，具体由 `kernel/proc.c` 文件中的 `growproc` 函数实现，并返回扩展或收缩之前的堆顶地址。通过 `sbrk`，用户程序可以调整其堆内存的大小。应用程序启动时，`sbrk` 指向堆的最底端，这一地址通过 `proc` 结构体中的 `sz` 字段表示。`growproc` 根据参数 `n` 的正负来决定调用 `uvmalloc` 或 `uvmdealloc`。当 `n` 为正时，`uvmalloc` 通过 `kalloc` 分配物理内存，并使用 `mappages` 将相应的页表项添加到用户页表中；而当 `n` 为负时，`uvmdealloc` 会调用 `uvmunmap`，通过 `walk` 查找相关的页表项，并使用 `kfree` 释放对应的物理内存。

由于 `sbrk` 采用即时分配策略，用户程序通常会申请比实际需求更多的内存，这可能导致内存浪费。此外，如果进程申请很大的内存空间，耗时也会变得不可忽视。为了解决这些问题，我们可以引入懒惰分配（lazy allocation）策略（Lab5）。

```c
uint64
sys_sbrk(void)
{
    int addr;
    int n;

    if(argint(0, &n) < 0)
        return -1;
    addr = myproc()->sz;
    if(growproc(n) < 0)
        return -1;
    return addr;
}
```

`growproc` 函数如下：
```c
// Grow or shrink user memory by n bytes.
// Return 0 on success, -1 on failure.
int
growproc(int n)
{
    uint sz;
    struct proc *p = myproc();

    sz = p->sz;
    if(n > 0){
        if((sz = uvmalloc(p->pagetable, sz, sz + n)) == 0) {
        return -1;
        }
    } else if(n < 0){
        sz = uvmdealloc(p->pagetable, sz, sz + n);
    }
    p->sz = sz;
    return 0;
}
```

## `exec`

`exec` 系统调用通过指定的路径名打开文件，并读取该文件的 ELF 头部信息。XV6 的所有应用程序都使用通用的 ELF 格式，该格式由一个 ELF 头部和一系列的程序段头部组成。每个程序段头部描述需要加载到内存中的一段程序。在 XV6 中，应用程序通常只有一个程序段头部，而在其他操作系统中可能有多个。

当 `exec` 读取文件系统中的文件时，首先检查该文件是否是 ELF 格式的二进制文件，即确认它的开头是否为四字节的幻数 `'0x7F'、'E'、'L'、'F'`。

随后，`exec` 为用户进程调用 `proc_pagetable`，通过 `uvmcreate` 创建一个空的用户页表，并且仅为该页表添加 `trampoline` 和 `trapframe` 的映射，其他的虚拟地址空间暂时为空。

对于每个程序段，`exec` 通过调用 `uvmalloc` 分配足够的物理页面并更新用户页表，接着使用 `loadseg` 将程序段和数据加载到这些物理页面中（然而在真实的操作系统中我们并不会这么做，程序和数据是分开的，这样对权限的设置可以更加精细）。此时，用户程序的各个段已经加载完成，接下来分配用户堆栈。

`exec` 会调用 `uvmalloc` 分配两页物理帧：

<ul>
    <li>第一页作为保护页，使用<code>uvmclear</code>设为无效，防止用户进程访问它；</li>
    <li>第二页用于用户栈，从栈顶开始将命令行参数字符串和指向这些参数的指针数组<code>argv[]</code>推入栈中。</li>
</ul>

当所有程序段加载完成并且用户栈设置完毕后，内核确定这次 `exec` 可以成功执行，此时，`exec` 清除进程的旧内存映像，释放旧页表占用的物理内存，并准备切换到新的页表。

# 实验任务
## Print a page table (easy)
第一个实验还是很简单的，关键是理解页表。类比 `freewalk` 函数，我们知道 `pte & (PTE_R|PTE_W|PTE_X) != 0` 只会在页表最后一层发生，因为最后一层页表中页表项中W位，R位，X位起码有一位会被设置为1。每个页都有512个页表项，每个页表项占4个字节，我们递归一下就行。

```c
void 
vmprint(pagetable_t pagetable, int level)
{
  if(!level)
  {
    printf("page table %p\n", pagetable); 
    level++;
  }
  for(int i = 0; i < 512; i++){
    pte_t pte = pagetable[i];
    if(pte & PTE_V)
    {
      if(level == 1) printf("..%d", i);
      if(level == 2) printf(".. ..%d", i);
      if(level == 3) printf(".. .. ..%d", i);
      printf(": pte %p pa %p\n",pte, PTE2PA(pte));
      if((pte & (PTE_R|PTE_W|PTE_X)) == 0)
        vmprint((pagetable_t)PTE2PA(pte), level + 1);
    }
  }
}
```
观察输出，我们可以注意到仅仅有5个界面被分配：代码页、保护页、用户栈、`trapframe`、`trampoline`。`trampoline` 的页表从255开始，因为我们有1个bit位不使用。

## A kernel page table per process (hard)
通过第二个实验和第三个实验，我们要允许内核直接解引用用户提供的指针而不需要先转成物理地址。在第二个实验中，我们要修改内核来为每个进程分配一个独立的内核页表，而不是使用全局的内核页表。

我们先修改 `kvminit`，用类似的方法在初始化进程的时候给进程创建一个内核页表。

```c
pagetable_t
proc_kpagetable()
{
  pagetable_t pagetable;
  pagetable = (pagetable_t) kalloc();
  if(pagetable == 0)
    return 0;  
  memset(pagetable, 0, PGSIZE);

  uvmmap(pagetable, UART0, UART0, PGSIZE, PTE_R | PTE_W);
  uvmmap(pagetable, VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);
  uvmmap(pagetable, CLINT, CLINT, 0x10000, PTE_R | PTE_W);
  uvmmap(pagetable, PLIC, PLIC, 0x400000, PTE_R | PTE_W);
  uvmmap(pagetable, KERNBASE, KERNBASE, (uint64)etext-KERNBASE, PTE_R | PTE_X);
  uvmmap(pagetable, (uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);
  uvmmap(pagetable, TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);
  return pagetable;
}

void
uvmmap(pagetable_t pagetable, uint64 va, uint64 pa, uint64 sz, int perm)
{
  if(mappages(pagetable, va, sz, pa, perm) != 0)
    panic("uvmmap");
}
```

然后在 `kernel/proc.c` 里面的 `allocproc` 调用，还要把 `procinit` 里面进行的内核栈初始化过程移到 `allocproc` 里面。这样我们就将原本唯一的内核页表和预先分配好的内核栈变成了伴随进程创建的内核页表和内核栈。

```c
...
// An empty user page table.
p->pagetable = proc_pagetable(p);
if(p->pagetable == 0){
  freeproc(p);
  release(&p->lock);
  return 0;
}

// Init the kernal page table
p->kpagetable = proc_kpagetable();
if(p->kpagetable == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
}
...
```

接下来修改 `scheduler` 函数，在切换进程的时候，因为内核页表跟进程绑定，所以也要切换内核页表。当进程运行完毕，我们又需要切换回最初的内核页表，防止没有进程运行时内核页表为空。

```c
...
p->state = RUNNING;
c->proc = p;
proc_inithart(p->kpagetable);
swtch(&c->context, &p->context);
c->proc = 0;
kvminithart();
...
```

其中 `proc_inithart` 函数跟 `kvminithart` 一致，负责在调度进程的时候切换内核页表。

```c
void
proc_inithart(pagetable_t kpt)
{
  w_satp(MAKE_SATP(kpt));
  sfence_vma();
}
```

接下来就是进程的释放，此时我们需要把之前的内核页表和内核栈全部释放。内核栈就是普通的页面，用 `kfree` 释放即可，但要注意内核页表的底层的物理页面不能释放，我们可以效仿 `vmprint` 来处理，在 `freeproc` 加上下面的语句。

```c
...
proc_freekstack(p->kpagetable, p->kstack);
p->kstack = 0;                                    
if(p->kpagetable)
    proc_freekpagetable(p->kpagetable);
p->kpagetable = 0;
...
```

用到的函数封装如下：

```c
void
proc_freekstack(pagetable_t kpt,uint64 kst)
{
  pte_t *pte = walk(kpt, kst, 0);
  if(pte == 0)
    panic("freeproc:free stack");
  kfree((void*)PTE2PA(*pte));
}
void
proc_freekpagetable(pagetable_t kpagetable)
{
  for(int i = 0; i < 512; i++){
    pte_t pte = kpagetable[i];
    if(pte & PTE_V)
    {
      kpagetable[i] = 0;
      if((pte & (PTE_R|PTE_W|PTE_X)) == 0)
      {
        proc_freekpagetable((pagetable_t)(PTE2PA(pte)));
      }
    }
  }
  kfree((void *)kpagetable);
}
```

至此你可能快乐地认为做完了，然后发现直接报错 `kvmpa`，我就是碰到这个心态小崩了三个小时。事实上，我们在内核态的时候还要改变地址转换用的页表，选择进程的内核页表。注意有些函数 `vm.c` 里面没有，所以我们还得声明 `proc.h` 和 `spinlock.h` 两个库。
```c
#include "spinlock.h" 
#include "proc.h"

uint64
kvmpa(uint64 va)
{
  uint64 off = va % PGSIZE;
  pte_t *pte;
  uint64 pa;

  pte = walk(myproc()->kpagetable, va, 0); // 修改这里
  if(pte == 0)
    panic("kvmpa");
  if((*pte & PTE_V) == 0)
    panic("kvmpa");
  pa = PTE2PA(*pte);
  return pa+off;
}
```

至此第二个实验完成了，在 qemu 里面运行 `usertests`，出现下面的结果说明成功：

<img src="/illustrations/MIT-6-S081-Lab3/3.png" alt="实验2结果图">

另外，我之前对此时的系统调用流程有些疑问。当进行系统调用的时候， `trampoline.S` 会将页表切换到内核页表，我之前在纠结是不是也要修改这一部分。但实际上并不需要，因为查看汇编代码可以发现，它实际上是交换了用户页表和内核页表，或者说将 `satp` 里的地址与 `myproc()->trapframe->kernel_atp` 里的交换了。那么，只需要在调度进程的时候切换内核页表就行了，无需考虑系统调用的问题。

## Simplify copyin/copyinstr（hard）
这个实验不是很难，但有挺多细节的，我也卡了一段时间，然后发现是写挂了一些奇怪的地方……主要就是要实现每次用户页表改变的时候都将用户页表的内容复制到内核页表里，复制的函数如下：
```c
void
ukvmcopy(pagetable_t old, pagetable_t new, uint64 oldsz, uint64 newsz)
{
  pte_t *pte_from, *pte_to;
  if(oldsz > newsz)
    return;  
  oldsz = PGROUNDUP(oldsz);
  for(uint64 i = oldsz; i < newsz; i += PGSIZE)
  {
    if((pte_from = walk(old, i, 0)) == 0)
      panic("ukvmcopy:src pte does not exist");
    if((pte_to = walk(new, i, 1)) == 0)
      panic("ukvmcopy:dst pte can not alloc");
    uint64 pa = PTE2PA(*pte_from);
    uint flags = (PTE_FLAGS(*pte_from) & (~PTE_U));
    *pte_to = PA2PTE(pa) | flags;
  }
}
```

然后就是在四个需要改变的地方进行改动，先是 `fork` 
```c
...
np->sz = p->sz;

np->parent = p;

ukvmcopy(np->pagetable, np->kpagetable, 0, np->sz);
// copy saved user registers.
*(np->trapframe) = *(p->trapframe);
...
```
再是 `exec`
```c
...
p->trapframe->epc = elf.entry;  // initial program counter = main
p->trapframe->sp = sp; // initial stack pointer
ukvmcopy(p->pagetable, p->kpagetable, 0, p->sz);
proc_freepagetable(oldpagetable, oldsz);
...
```
`sbrk`稍有不同，我们需要修改它调用的 `growproc`，还要判断是否超过 PLIC 的范围。不过听答疑课发现好像应该是 CLINT，这很合理，因为 CLINT 地址比 PLIC 要低。

如果要让它增长上限达到 KERNBASE，我们可以把 CLINT 啥的映射到 PHYSTOP 后面，也就是内核栈比较下面的位置。因为栈是从高往低增长的所以下面会有比较多的空闲位置。
```c
int
growproc(int n)
{
  uint sz;
  struct proc *p = myproc();

  sz = p->sz;
  if(n > 0){
    if(PGROUNDUP(sz + n) >= PLIC)
      return -1;
    if((sz = uvmalloc(p->pagetable, sz, sz + n)) == 0)
      return -1;
    ukvmcopy(p->pagetable, p->kpagetable, sz - n, sz);
  } else if(n < 0)
  {
    sz = uvmdealloc(p->pagetable, sz, sz + n);
  }
  p->sz = sz;
  return 0;
}
```
最后是`userinit`
```c
...
uvminit(p->pagetable, initcode, sizeof(initcode));
p->sz = PGSIZE;

ukvmcopy(p->pagetable, p->kpagetable, 0, p->sz);
// prepare for the very first "return" from kernel to user.
p->trapframe->epc = 0;      // user program counter
...
```

至此差不多就解决了，但还要记得把 `copyin` 和 `copyinstr` 换成 `copyin_new` 和 `copyinstr_new`，并且在 `defs.h` 中进行声明。

不过说起来……这玩意过不了 `make grade`，因为电脑太卡会超时……

老师的方法跟讲义的不同，采取的方式是共享内核页表中不用修改的部分，只修改Kernel顶级目录的底部条目（刚好1GB），这会让内存的分配和回收复杂一些，但大致上的思路是一样的。不过这确实对性能有很大的提升。而且老师对权限的控制更加精确，通过禁用 PTE_U 和 PTE_W，让开发者在进行不恰当的操作时内核能及时报错，这显然是有利于开发的。

# 调试指南

做第二个实验的时候破防了，调gdb的时候又破防了，写一下调试方法。

大概是以下几步：

1. **启动 QEMU 调试模式**：
   在项目目录下运行：
   ```bash
   make qemu-gdb
   ```

2. **启动 GDB**：
   在另一个终端中，进入同样的目录，运行：
   ```bash
   gdb-multiarch
   ```

3. **载入符号表**：
   在 GDB 中载入要调试的程序（例如 `ls`）的符号表：
   ```bash
   file user/_ls
   ```

4. **设置断点**：
   在主函数或指定行号处设置断点：
   ```bash
   b main
   ```

5. **开始调试**：
   运行命令继续执行：
   ```bash
   continue
   ```

6. **调试交互**：
   在 GDB 终端中查看变量，继续执行，或在源代码中打更多断点，之后就跟正常gdb一样了。

注意，`.gdbinit`文件会有安全问题，所以要在文件里面加上`add-auto-load-safe-path YOUR_PATH/XV6-labs-2020/.gdbinit`，否则程序无法正常运行。