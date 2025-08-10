---
title: CS143-PA3：Parsing
date: 2025-08-10 12:14:47
categories: CS143
description: CS143 PA3：实现 Cool 语言的语法分析器。
tags: [编译原理, Linux, CS143, 语法分析, 抽象语法树]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。

# 语法分析
## 准备工作
本次作业的目标是：使用 Bison 实现一个可以将 Token 序列转换为 AST 的语法分析器。

在 `assignments/PA3` 目录下执行命令：

```bash
make parser
```

会生成一个名为 `parser` 的可执行文件，可以通过运行 `./myparser test.cl` 来对指定文件进行词法分析。这里的 `myparser` 是一个 `csh` 脚本，如果用的是 `bash` 的话需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser
```

在编译过程中，Bison 生成的 `cool-parse.cc` 负责语法分析的主要实现；`parser-phase.cc` 提供程序入口，负责驱动并测试语法分析器；`cool-tree.aps` 定义 AST 结构，并自动生成 `cool-tree.h` 与 `cool-tree.cc` 以支持树节点的构造与处理，剩下的 `tokens-lex.cc`、`dumptype.cc` 和 `handle_flags.cc` 等文件为辅助代码，不需要修改。

这里所用到的 **Bison** 是一种语法分析器生成工具，它能够根据上下文无关文法规则自动生成语法分析器。其作用是将 `.y` 文件转换为 C/C++ 源码（如 `cool-parse.cc`），并作为库函数与其他源码一起编译。目前我们通过 `parser-phase.cc` 来调用生成的语法分析器代码，后续可能会通过编译器的其他阶段（如语义分析器）来调用。

Bison 的使用可以通过阅读 **Bison 的官方文档** 以及 `handouts` 目录下的相关 PDF 来了解，比如 PA3 的作业说明里面有相关介绍。

回到 PA3，我们的核心任务是完善 `cool.y` 文件，使其能够正确地进行语法分析。