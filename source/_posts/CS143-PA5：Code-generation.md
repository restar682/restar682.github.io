---
title: CS143-PA5：Code generation
date: 2025-09-20 17:43:11
categories: CS143
description: CS143 PA5：实现 Cool 语言的代码生成器。
tags: [编译原理, Linux, CS143, 代码生成]
---
# 代码生成
## 准备工作
本次作业的目标是：实现一个可以将带有类型注释的 AST 翻译为 MIPS 代码的代码生成器。

在 `assignments/PA5` 目录下执行命令：

```bash
make cgen
```

会生成一个名为 `cgen` 的可执行文件，可以通过运行 `./mycoolc test.cl` 来对指定文件进行词法分析。这里的 `mycoolc` 还是个 `csh` 脚本，如果用的是 `bash` 的话也需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser | ./semant | ./cgen
```

在代码生成阶段，`cgen-phase.cc` 提供了编译器驱动，`symtab.h` 提供了符号表实现，`cgen_supp.cc` 提供了一些可以用在代码生成器中的辅助函数，`emit.h` 定义了生成 MIPS 指令时常用的宏（这个文件当然可以修改）。其余文件均为辅助代码，无需改动。

回到 PA5，我们的核心任务是完善 `cgen.h` 和 `cgen.cc` 文件，实现面向对象代码的汇编生成。`cgen.cc` 作为框架，已经事先提供了三个部分：  

- 构建继承图的函数；  
- 输出全局数据和常量的函数；  
- 输出 spim 指令的函数。

~~嗯，框架就有 1000 多行呢。~~不过好在代码生成过程中不需要错误恢复机制，因为所有错误的 Cool 程序都已被编译器前端阶段检测到了。

那么接下来，我们将面对的就是最后一个 Assignment，也是最复杂的一个 Assignment，祝你，也祝我自己好运~