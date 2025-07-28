---
title: CS143-Week1：Introduction
date: 2025-07-27 19:53:51
categories: CS143
description: 编译器的简单介绍和 Cool 语言。
tags: [编译原理, Linux, CS143]
---
# 知识点
解释器是实时运行的：它在程序执行过程中逐行读取输入、进行处理，所有操作都是程序运行的一部分。而编译器则不同，它在程序运行前将源代码转换为可执行文件，程序运行时由这个可执行文件读取数据并处理得到结果。某种意义上来说，编译器在这个流程中是离线的。

最早出现的解释器是一种“快速编码器”，它能够显著提高程序员的编写效率。然而，这种方式会降低程序的运行速度，并占用一定的内存资源——在当时看来，这种开销是相当可观的。随后，人们提出了“公式翻译”的思路，即将数学公式翻译成机器能够处理的形式，从而解决效率与资源占用之间的矛盾。由此诞生了著名的“公式翻译计划”，也就是后来的 Fortran 计划，Fortran 计划大获成功。

## Compiler 的 5 个部分

<table>
  <thead>
    <tr>
        <th width="20%">编译阶段</th>
        <th width="13%">输入（Input）</th>
        <th width="25%">输出（Output）</th>
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
      <td align="center">语法分析（Parsing）</td>
      <td align="center">token 序列</td>
      <td align="center">抽象语法树<br>（AST，Abstract Syntax Tree）</td>
      <td align="center">用树结构表示程序的语法结构。</td>
    </tr>
    <tr>
      <td align="center">语义分析<br>（Semantic Analysis）</td>
      <td align="center">AST</td>
      <td align="center">带注解的语法树</td>
      <td align="center">在 AST 上补充语义信息，用于检查类型不一致等错误。</td>
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
