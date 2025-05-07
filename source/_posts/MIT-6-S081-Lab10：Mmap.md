---
title: MIT-6-S081-Lab10：Mmap
date: 2025-05-06 14:22:28
categories: 6.s081
tags: [操作系统, 文件系统, 陷阱指令, 缺页异常, Linux, 6.s081]
---
# 实验内容
## mmap(hard)
最后的实验要求我们实现最基础的 `mmap` 功能，也就是将一个文件直接映射到内存中，之后通过直接读写内存来读写文件，可以大大提升需要频繁读写的文件的处理效率。

首先照例注册 `mmap` 和 `munmap` 系统调用，接下来定义用于保存内存映射信息的结构体 `struct vma`，每个进程分配 NVMA 个结构体。
```c
struct vma
{
  uint64 addr;
  uint64 length;
  int prot;
  int flags;
  int fd;
  int offset;
  struct file *file;
};
struct proc
{
    ···
    struct vma vmas[NVMA];         // Virtual memory areas
}
```

接下来处理 `mmap` 函数，对于权限要求不合法的情况进行拒绝。在我的 vma 中默认 `length = 0` 代表 vma 无效，找到一个空位后就可以进行初始化了。在这里我们并不会分配内存，而是在触发缺页异常的时候才进行分配。我们给用户程序提供用户空间中的虚拟地址 `v->addr` 作为文件的起始位置，记得要增长 `p->sz` 和对文件进行引用，而且 `length`, `addr` 和 `p->sz` 都要对齐。
```c
uint64
sys_mmap(void)
{
  uint64 addr;
  int length, prot, flags, fd, offset;
  struct file* f;
  if (argaddr(0, &addr) < 0 || argint(1, &length) < 0 || argint(2, &prot) < 0
      || argint(3, &flags) < 0 || argfd(4, &fd, &f) < 0 || argint(5, &offset) < 0)
    return -1;
  
  if(addr != 0)
    panic("mmap: addr not 0");
  if(offset != 0)
    panic("mmap: offset not 0"); // required by xv6

  struct proc *p = myproc();
  struct file *file = p->ofile[fd];

  if ((prot & PROT_READ) && !f->readable)
    return -1; // can't read from write-only file
  if ((prot & PROT_WRITE) && !f->writable && flags == MAP_SHARED)
    return -1; // can't write to read-only file

  for(int i = 0; i < NVMA; i++)
  {
    if (p->vmas[i].length == 0)
    {
      struct vma *v = &p->vmas[i];
      v->addr = p->sz;
      v->length = PGROUNDUP(length);
      v->prot = prot;
      v->flags = flags;
      v->fd = fd;
      v->offset = offset;
      v->file = file;

      filedup(file);
      p->sz += v->length;
      return v->addr;
    }
  }
  return -1;
}
```

然后在触发缺页异常时进行页面分配，这里的处理逻辑一定要严谨，不然就算过了 `mmaptest` 也有可能在 `usertest` 里面遇到访问非法地址导致缺页但不需要分配页面的情况，这时候会卡死。大致思路是先判掉本身就不可能触发缺页异常的地址，然后搜索 `vmas`，如果找不到同样得判掉。找到了就进行常规的页面分配，然后用 `readi` 从文件中读入一页。这里我们处理了偏移量非零的情况，实际上因为实验要求也可以不管。
```c
···
  else if(r_scause() == 13 || r_scause() == 15)
  {
    //panic("here");
    uint64 va = r_stval();
    struct proc *p = myproc();
    if(va >= MAXVA || va > p->sz)
      p->killed = 1;
    else
    {
      va = PGROUNDDOWN(va);
      int found = 0;
      for(int i = 0; i < NVMA; i++)
      {
        struct vma *vma = &p->vmas[i];
        if (vma->length == 0)
          continue;
        if (va >= vma->addr && va < vma->addr + vma->length)
        {
          found = 1;
          uint64 pa = (uint64)kalloc();
          if (pa == 0)
          {
            p->killed = 1;
            break;
          }
          memset((void*)pa, 0, PGSIZE);
          int flag = (vma->prot << 1) | PTE_U | PTE_V;
          if (mappages(p->pagetable, va, PGSIZE, pa, flag) != 0)
          {
            //printf("???");
            kfree((void*)pa);
            p->killed = 1;
            break;
          }

          struct inode *ip = vma->file->ip;
          ilock(ip);
          readi(ip, 0, pa, vma->offset + (va - vma->addr), PGSIZE);
          iunlock(ip);
          break;
        }
      }
      if (!found)
        p->killed = 1;
    }
  }
···
```

接下来实现 `munmap`，这也是整个实验中最复杂的一部分。我们分三种情况进行处理，只删除一部分的情况是简单的，只需要修改 `v->addr` 和 `v->length` 即可，全部删除的话还需要关闭文件。然后我们用 `uvmunmap` 解除映射关系并且释放物理内存。如果有共享标签，那么就还要对文件进行修改，这一部分比较复杂，我们单独用 `vmafilewrite` 函数来处理。
```c
uint64
sys_munmap(void)
{
  uint64 addr;
  int length, offset;
  if (argaddr(0, &addr) < 0 || argint(1, &length) < 0) {
    return -1;
  }
  struct proc *p = myproc();
  int close = 0;
  for(int i = 0; i < NVMA; i++)
  {
    struct vma *v = &p->vmas[i];
    if (v->length == 0)
      continue;
    if (addr >= v->addr && addr < v->addr + v->length)
    {
      offset = addr - v->addr;
      addr = PGROUNDDOWN(addr);
      // printf("addr: %p, v->addr: %p,length: %d, v->length: %d\n", addr, v->addr, length,v->length);
      if(addr == v->addr)
      {
        if(length >= v->length)
        {
          close = 1;
          length = v->length;
          v->length = 0;
        }
        else
        {
          v->addr += length;
          v->length -= length;
        }
      }
      else
      {
        length = v->length - (addr - v->addr);
        v->length -= length;
      }
      if(v->flags == MAP_SHARED)
      {
        struct file *ip = v->file;
        if(vmafilewrite(ip, addr, length, offset) < 0)
          return -1;
      }
      // printf("addr: %p, v->addr: %p,length: %d, v->length: %d\n", addr, v->addr, length,v->length);
      uvmunmap(p->pagetable, addr, PGROUNDUP(length)/PGSIZE, 1);
      // printf("here2\n");
      if(close)
      {
        fileclose(v->file);
        v->file = 0;
      }
      break;
    }
  }
  return 0;
}
```

`vmawrite` 是要我们对文件进行写入，我们不难发现这个功能跟 `filewrite` 的功能是很像的。但 `filewrite` 不支持从给定偏移量修改，所以我们把写入文件的部分抄过来，再做一点小小的改动。这里其实可以根据页面是否被写入过做一些优化，但我们这里并没有实现这个功能。
```c
int
vmafilewrite(struct file *f, uint64 addr, int n, int offset)
{
  int r;

  if(f->writable == 0)
    return -1;

  int max = ((MAXOPBLOCKS-1-1-2) / 2) * BSIZE;
  // printf("max: %d\n", max);
  int i = 0;
  while(i < n)
  {
    int n1 = n - i;
    if(n1 > max)
      n1 = max;

    begin_op();
    ilock(f->ip);
    if ((r = writei(f->ip, 1, addr + i, offset, n1)) > 0)
      offset += r;
    iunlock(f->ip);
    end_op();

    if(r != n1)
    {
      // error from writei
      break;
    }
    i += r;
  }
  return 0;
}
```

还有一个小的注意点：有缺页异常的时候 `uvmunmap` 和 `uvmcopy` 的逻辑要修改。跟之前写时复制分支的处理一样，在遇到无效页面时不能报错。
```c
···
if((*pte & PTE_V) == 0)
    continue;
···
```

接着修改 `exit`，当进程退出时我们也要对 vma 进行回收。
```c
···
for(int i = 0; i < NVMA; i++)
{
    struct vma *v = &p->vmas[i];
    if (v->length == 0)
        continue;
    if(v->flags == MAP_SHARED)
    {
        struct file *ip = v->file;
        if(vmafilewrite(ip, v->addr, v->length, v->offset) < 0)
        continue;
    }
    uvmunmap(p->pagetable, v->addr, PGROUNDUP(v->length)/PGSIZE, 1);
    fileclose(v->file);
    v->file = 0;
}

begin_op();
iput(p->cwd);
end_op();
p->cwd = 0;
```

最后修改 `fork`，将 vma 的内容复制过来。
```c
···
for(i = 0; i < NVMA; i++)
{
    np->vmas[i].length = 0;
    if(p->vmas[i].length)
    {
        memmove(&np->vmas[i], &p->vmas[i], sizeof(struct vma));
        filedup(np->vmas[i].file);
    }
}
safestrcpy(np->name, p->name, sizeof(p->name));
···
```

至此 `mmap` 和 `munmap` 得以实现，我们实现了简单的内存映射文件。

# 小结
完结撒花！操作系统之旅大概暂时就到这里，花了大概两个月的时间……其实看中间的其他博客你就知道为什么拖了这么久了……这是进大学以来完整（大概）自学的第一门公开课，之前试图学 MIT-Missing-Semester 不知道为啥就咕咕咕了，总之学完了还是相当开心的啦。通过 XV6 这个简单的操作系统，我对操作系统的大致结构有了基本的了解，也学到了一些常见的处理技巧，收获算是相当不错。感觉最方便的调试方式还是直接输出），gdb 什么的真不熟吧（笑）。接下来大概是 cs143？希望自己还能坚持下去，又义无反顾地投向下一个坑了呢。

照例扔一张通关截图在这里。
<img src="/illustrations/MIT-6-S081-Lab10/1.png" alt="通关截图">