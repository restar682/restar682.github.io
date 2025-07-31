---
title: CS143-Week2：Lexical Analysis & Finite Automata
date: 2025-07-30 22:19:24
categories: CS143
description: 
tags: [编译原理, Linux, CS143, 词法分析, 有限自动机]
---
# 词法分析与正则表达式基础
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
我们通常使用 **正则语言（regular languages）** 来描述每个 token 类别所包含的字符串集合。

正则语言由五种基本表达式构成：

* 两个基础表达式：
  * 单个字符（single character）
  * 空串（epsilon）

* 三个组合表达式：
  * 并集（union）
  * 连接（concatenation）
  * 迭代（iteration，也称为闭包）

正则表达式就是定义在有限字母表 $\Sigma$ 上的基本表达式构成的集合，一般记作 $\Sigma^*$。
## 形式语言
形式语言是定义在有限字母表 $\Sigma$ 上的任意字符串构成的集合，不难看出正则表达式是一种形式语言。

映射函数将句法映射到语义，其优势在于：
1. 便于区分句法和语义两个概念；
2. 可以将概念的表达方式作为一个独立问题处理。例如：罗马数字和阿拉伯数字表达的是同样的数量，但大多数人使用罗马数字做数学运算会感到困难。这说明概念表达方式的选择会影响理解与计算的难易程度；
3. 表达式和意义之间不是一一对应的关系，多个表达式可能对应同一个意义。

## 正则匹配算法
正则表达式非常适合用于词法分析，但单纯的匹配判断还不够。在词法分析中，正则匹配算法不仅需要判断字符串是否符合某个模式，还必须准确识别它具体匹配的是哪一个正则表达式，以支持多模式的区分和识别。

匹配算法如下：
<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/CS143-Week2/3.jpg" alt="匹配算法" width="60%">
  <figcaption>匹配算法</figcaption>
</figure>
但我们可能会面临几个模式都匹配的情况，这时候一般遵循两种原则：

1. 选择匹配长度最长的模式  
2. 根据预设的优先级选择模式

如果没有匹配的模式，解决方法通常是：

1. 编译器一般会直接报错  
2. 但通常不会在词法分析阶段报错，因此会定义一个兜底匹配规则  
3. 注意兜底规则的优先级应设置为最低

# 有限自动机