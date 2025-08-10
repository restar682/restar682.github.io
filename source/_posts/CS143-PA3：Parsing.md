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
