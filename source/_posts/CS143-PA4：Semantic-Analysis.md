---
title: CS143-PA4：Semantic Analysis
date: 2025-08-17 12:26:16
categories: CS143
description: CS143 PA4：实现 Cool 语言的语义分析器。
tags: [编译原理, Linux, CS143, 语义分析, 类型检查]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。

# 语义分析
## 准备工作
本次作业的目标是：实现一个可以给正确的 AST 添加类型注释的语义分析器。

在 `assignments/PA4` 目录下执行命令：

```bash
make semant
```

会生成一个名为 `semant` 的可执行文件，可以通过运行 `./mysemant test.cl` 来对指定文件进行词法分析。这里的 `mysemant` 同样也是一个 `csh` 脚本，如果用的是 `bash` 的话也需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser | ./semant
```

在语义分析过程中，`semant-phase.cc` 提供程序入口，负责驱动并测试语义分析器；`cool-tree.aps` 定义 AST 结构，并自动生成 `cool-tree.h` 与 `cool-tree.cc` 以支持树节点的构造与处理；`symtab.h` 提供了一个符号表的实现，剩下的 `ast-lex.cc` 和 `ast-parse.cc` 等文件为辅助代码，不需要修改。

回到 PA4，我们的核心任务是完善 `semant.h` 和 `semant.cc` 文件，实现正确的类型检查逻辑，并为 AST 节点添加相应的类型注释，同时使用作业提供的方法来报告错误。此外，我们还需要在 `cool-tree.h` 和 `cool-tree.handcode.h` 中为 AST 类添加必要的方法，以支持类型信息的存储、查询与计算。

需要注意的是，`cool-tree.cc` 包含了已提供方法的定义以及列表处理函数模板的实例化，但我们**不得修改**该文件，在 `cool-tree.h` 或 `cool-tree.handcode.h` 中新增的方法，其具体实现必须放在 `semant.cc` 中。

同时，请注意 `cool-tree.handcode.h` 与 PA3 中提供的版本相比已有调整，应以当前版本为准。