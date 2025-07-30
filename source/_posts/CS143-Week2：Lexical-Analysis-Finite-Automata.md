---
title: CS143-Week2：Lexical Analysis & Finite Automata
date: 2025-07-30 22:19:24
categories: CS143
description: 
tags: [编译原理, Linux, CS143, 词法分析, 有限自动机]
---
# 词法分析
## 简介
词法分析的主要目标是：
- 将源代码分割成若干个词法单元（token），每个 token 包含类别和对应的内容；
- 为后续语法分析阶段提供结构化的 token 序列。

Token 的类别包括：
- Identifier（标识符，例如变量名）  
- Integer（整数）  
- Number（数字）
- Keyword（关键字，如 `if`, `while`, `class` 等）  
- Operator（运算符，如 `+`, `-`, `*`, `/`, `=` 等）  
- Whitespace（空白字符，如空格、制表符、换行符）
- **'('**、 **')'**、 **';'**、 **'='**

具体实现：
- 词法分析器通常从左至右扫描源码文本，一次识别一个 token。  
- 为了识别下一个合法的 token，分析器可能需要 **向前查看（lookahead）**，但应尽量**减少其长度**以提高效率。
<figure style="text-align: center;">
  <img src="/illustrations/CS143-Week2/1.png" alt="Fortran 里的向前查看" width="70%">
  <figcaption>例一：Fortran 里的向前查看</figcaption>
</figure>

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/CS143-Week2/2.png" alt="C++ 的 bug" width="70%">
  <figcaption>例二：C++ 的 bug</figcaption>
</figure>

## 正则语言