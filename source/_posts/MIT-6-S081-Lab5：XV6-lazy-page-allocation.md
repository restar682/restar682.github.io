---
title: 'MIT-6-S081-Lab5：XV6 lazy page allocation'
date: 2025-03-25 19:50:22
categories: 6.s081
tags: [操作系统, 缺页异常, 延迟页面分配, Linux, 6.s081]
---
# 实验任务
## Eliminate allocation from sbrk() (easy)
呃，真就一行……把
```c
...
if(growproc(n) < 0)
    return -1;
...
```
改成
```c
...
myproc()->sz += n;
...
```
就行了

## Lazy allocation (moderate)
第二部分要我们实现最简单的懒分配，我们在每次出现缺页异常（`scause=13`是读异常，`scause=15`是写异常）的时候，进行分配需要的虚拟地址所在的页面即可。这里不需要修改 `p->trapframe->epc` 是因为我们需要重试原指令。
```c
...
else if(r_scause() == 13 || r_scause() == 15){
    uint64 va = r_stval();
    if(lazy_alloc(va) < 0)
      p->killed = 1;
  }
...
```
`lazy_alloc` 函数如下，因为每次只分配一页所以不需要 `uvmdealloc` 来解决分配很多页时内存不够的情况。
```c
int
lazy_alloc(uint64 addr)
{
  char * mem;
  struct proc * p = myproc();
  //printf("heh1");
  if(addr >= p->sz)
  {
    return -1;
  }
  if(addr < p->trapframe->sp)
  {
    return -2;
  }
  addr = PGROUNDDOWN(addr);
  mem = kalloc();
  if(mem == 0)
  {
    return -3;
  }
  memset(mem, 0, PGSIZE);
  if(mappages(p->pagetable, addr, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0)
  {
    kfree(mem);
    return -4;
  }
  return 0;
}
```
最后我们需要修改 `uvmunmap` 的逻辑，因为我们进行了懒分配，所以会出现未分配页需要释放的可能，这时候我们跳过即可。
```c
uvmunmap(pagetable_t pagetable, uint64 va, uint64 npages, int do_free)
{
  uint64 a;
  pte_t *pte;

  if((va % PGSIZE) != 0)
    panic("uvmunmap: not aligned");

  for(a = va; a < va + npages*PGSIZE; a += PGSIZE){
    if((pte = walk(pagetable, a, 0)) == 0)
      panic("uvmunmap: walk");
    if((*pte & PTE_V) == 0)
      continue; // 需要释放的情况
    if(PTE_FLAGS(*pte) == PTE_V)
      panic("uvmunmap: not a leaf");
    if(do_free){
      uint64 pa = PTE2PA(*pte);
      kfree((void*)pa);
    }
    *pte = 0;
  }
}
```

## Lazytests and Usertests (moderate)
第三部分就是一些没处理的细节。我们首先处理 `sbrk` 为负数的情形，因为之前已经修改了 `uvmdealloc`，所以直接释放就行。
```c
uint64
sys_sbrk(void)
{
  struct proc * p = myproc();
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;
  addr = p->sz;
  if(n > 0)
    p->sz += n;
  else
    p->sz = uvmdealloc(p->pagetable, addr, addr + n);
  return addr;
}
```

`sbrk` 越界的情形已在第二部分解决，接下来修改复制进程需要用到的 `fork`。我们需要修改其调用的 `uvmcopy`，在找不到pte的时候不再报错。
```c
...
for(i = 0; i < sz; i += PGSIZE)
{
    if((pte = walk(old, i, 0)) == 0)
        continue;
    if((*pte & PTE_V) == 0)
        continue;
    pa = PTE2PA(*pte);
    flags = PTE_FLAGS(*pte);
    if((mem = kalloc()) == 0)
        goto err;
    memmove(mem, (char*)pa, PGSIZE);
    if(mappages(new, i, PGSIZE, (uint64)mem, flags) != 0){
        kfree(mem);
        goto err;
    }
}
return 0;
..
```

然后修改 `read` 和 `write` 的系统调用。通过对流程的分析可知，在操作系统中，当用户态程序执行 `read`/`write` 系统调用陷入内核时，RISC-V 架构的 `scause` 寄存器会记录环境调用异常代码8。我们要防止在内核中需要地址时页面未分配的情况。事实上，他们均通过 `walkaddr` 函数解析用户虚拟地址对应的物理地址，此过程需要主动遍历用户页表，其执行路径与硬件自动触发的缺页异常处理机制存在本质差异。所以我们需要修改 `walkaddr` 的逻辑，在找不到pte时分配页面。
```c
uint64
walkaddr(pagetable_t pagetable, uint64 va)
{
  pte_t *pte;
  uint64 pa;

  if(va >= MAXVA)
    return 0;

  pte = walk(pagetable, va, 0);
  if(pte == 0 || (*pte & PTE_V) == 0)
  {
    if(lazy_alloc(va) == 0)
      pte = walk(pagetable, va, 0);
    else  
      return 0;
  }
  if((*pte & PTE_U) == 0)
    return 0;
  pa = PTE2PA(*pte);
  return pa;
}
```

# 小结
至此Lab5宣告结束，总体来说比较轻松（而且没有文档要看真的很爽啊哈哈哈哈！）。通过对懒分配的实现，我们对陷阱的机制有了更深的了解，还了解到 `walkaddr` 通过主动遍历用户页表来定位pte，跟用户态的 `load/store` 指令是独立的逻辑，因此不会触发缺页异常。这种差异性带来的隔离性实在是令人叹为观止。唔，test项目太多了懒得放通过截图了。