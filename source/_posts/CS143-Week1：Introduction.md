---
title: CS143-Week1：Introduction
date: 2025-07-27 19:53:51
categories: CS143
description: 编译器的简单介绍和 Cool 语言。
tags: [编译原理, Linux, CS143]
---
# 知识点
## 解释器与编码器
解释器是实时运行的：它在程序执行过程中逐行读取输入、进行处理，所有操作都是程序运行的一部分。而编译器则不同，它在程序运行前将源代码转换为可执行文件，程序运行时由这个可执行文件读取数据并处理得到结果。某种意义上来说，编译器在这个流程中是离线的。

最早出现的解释器是一种“快速编码器”，它能够显著提高程序员的编写效率。然而，这种方式会降低程序的运行速度，并占用一定的内存资源——在当时看来，这种开销是相当可观的。随后，人们提出了“公式翻译”的思路，即将数学公式翻译成机器能够处理的形式，从而解决效率与资源占用之间的矛盾。由此诞生了著名的“公式翻译计划”，也就是后来的 Fortran 计划，Fortran 计划大获成功。

## Compiler 5 个部分的简单介绍

<table>
  <thead>
    <tr>
        <th width="20%">编译阶段</th>
        <th width="13%">输入<br>（Input）</th>
        <th width="25%">输出<br>（Output）</th>
        <th width="42%">备注</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center">词法分析<br>（Lexical Analysis）</td>
      <td align="center">源代码文本</td>
      <td align="center">词法单元<br>（tokens）</td>
      <td align="center">将源代码切分为 tokens，并标注其类别。</td>
    </tr>
    <tr>
      <td align="center">语法分析<br>（Parsing）</td>
      <td align="center">token 序列</td>
      <td align="center">抽象语法树<br>（AST，Abstract Syntax Tree）</td>
      <td align="center">用树结构表示程序的语法结构。</td>
    </tr>
    <tr>
      <td align="center">语义分析<br>（Semantic Analysis）</td>
      <td align="center">AST</td>
      <td align="center">带注解的语法树</td>
      <td align="center">由于完整的语义理解过于困难，编译器通常只在 AST 上进行有限的语义检查，如检查类型不一致等错误。</td>
    </tr>
    <tr>
      <td align="center">优化<br>（Optimization）</td>
      <td align="center">中间表示<br>（IR）</td>
      <td align="center">优化后的 IR</td>
      <td align="center">如常量折叠、死代码删除等，提升程序效率。</td>
    </tr>
    <tr>
      <td align="center">代码生成<br>（Code Generation）</td>
      <td align="center">IR</td>
      <td align="center">汇编代码或其他目标代码</td>
      <td align="center">也可以生成高级语言或自然语言，视编译器设计而定。</td>
    </tr>
  </tbody>
</table>

如表中所言，语义分析可能非常困难。比如在下面 “even worse” 的例子中，最多可能存在三个不同的 `Jack`。这也同样是编译器在分析 `for` 循环中的变量绑定（variable binding）时常见的语义难题之一 —— 同名变量最多可能对应多个不同的实体，给准确理解程序含义带来了巨大挑战。因此，编程语言一般会设定非常严格的规则来避免这个问题。
<img src="/illustrations/CS143-Week1/1.png" alt="语义分析很困难的例子" width = "80%">

优化也是一个相当棘手的问题。为了提升性能或减少内存使用，我们通常会尝试对中间表示进行优化。但这件事远没有看起来那么简单。例如，我们可能认为 `X = Y * 0` 可以简单地优化为 `X = 0`。这在 `X` 和 `Y` 都是整数的情况下确实成立，但如果是浮点数，且 `Y = NaN`，根据浮点数运算标准，`X` 的值应为 `NaN`，此时这种优化就会引入错误。

其他部分与人类对翻译的理解大致一致，但对编译器而言，实现这些部分依然并非易事。

在 Fortran 时代，词法分析、语法分析、优化和代码生成都被视为较为复杂的任务，而语义分析相对简单。如今，得益于自动化工具的支持，词法分析和语法分析已变得相当成熟；相比之下，语义分析的复杂度显著上升，优化过程则日益庞大且精细，而代码生成反而成为编译流程中相对较小的一部分。不难看出，随着时代的发展，编译器各阶段的复杂性发生了显著变化。