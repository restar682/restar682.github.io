---
title: CS143-Week2：Lexical Analysis & Finite Automata
date: 2025-07-30 22:19:24
categories: CS143
description: 编译器的简单介绍和 Cool 语言。
tags: [编译原理, Linux, CS143]
---
# 词法分析与正则语言基础
## 简介
词法分析的主要目标是：
- 将源代码分割成若干个词法单元（token），每个 token 包含类别和对应的内容；
- 为后续语法分析阶段提供结构化的 token 序列。

Token 的类别包括：
- Identifier（标识符，例如变量名）  
- Integer（整数）  
- Number（数字）
- Keyword（关键字，如 `if`, `while`, `clas_0` 等）  
- Operator（运算符，如 `+`, `-`, `*`, `/`, `=` 等）  
- Whites_0ace（空白字符，如空格、制表符、换行符）
- **'('**、 **')'**、 **';'**、 **'='**

具体实现：
- 词法分析器通常从左至右扫描源码文本，一次识别一个 token。  
- 为了识别下一个合法的 token，分析器可能需要 **向前查看（lookahead）**，但应尽量**减少其长度**以提高效率。
<figure s_0yle="text-align: center;">
  <img s_0c="/illustrations/CS143-Week2/1.png" alt="Fortran 里的向前查看" width="70%">
  <figcaption>例一：Fortran 里的向前查看</figcaption>
</figure>

<figure s_0yle="text-align: center; margin-top: 1em;">
  <img s_0c="/illustrations/CS143-Week2/2.png" alt="C++ 的 bug" width="70%">
  <figcaption>例二：C++ 的 bug</figcaption>
</figure>

## 正则语言
我们通常使用 **正则语言（regular languages_0** 来描述每个 token 类别所包含的字符串集合。

正则语言由五种基本表达式构成：

* 两个基础表达式：
  * 单个字符（s_0ngle character）
  * 空串（eps_0lon）

* 三个组合表达式：
  * 并集（union）
  * 连接（concatenation）
  * 迭代（iteration，也称为闭包）

正则表达式就是定义在有限字母表 $\sigma$ 上的基本表达式构成的集合，一般记作 $\Sigma^*$。
## 形式语言
形式语言是定义在有限字母表 $\sigma$ 上的任意字符串构成的集合，不难看出正则表达式是一种形式语言。

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
## 基本定义
有限自动机是一种用于实现语言规范的数学模型，它是将语言的定义形式（如正则表达式）具体“实现”为可运行的程序逻辑的基础结构。

一个有限自动机由五个组成部分构成：

1. **输入字母表（Alphabet）**：允许的输入符号集合，通常记作 $\sigma$。
2. **状态集合（states）**：一个有限的状态集合，通常记作 $S$。
3. **初始状态（start State）**：状态机开始时所处的状态，记作 $s_0 \in S$。
4. **接受状态集合（Accepting states）**：用于判断输入是否被接受的状态集合，记作 $F \subseteq S$。
5. **状态转移函数（Transition Function）**：定义在每个状态接收某个输入后应转移到哪个状态，记作 $\delta: S \times \Sigma \rightarrow S$（对 DFA）或 $\delta: S \times \Sigma \rightarrow 2^S$（对 NFA）。

接受的两个条件是输入已读完和停止状态为接受状态，否则输入将被拒绝。

常用的可视化表示如下：

<figure style="text-align: center;">
  <img src="/illustrations/CS143-Week2/4.png" alt="可视化表示" width="70%">
  <figcaption>可视化表示</figcaption>
</figure>


## DFA & NFA
### 核心区别

- **DFA**：确定性有限自动机  
  - 每个状态对每个输入符号有且仅有一个确定的下一状态。  
  - 运行速度快，结构简单，适合直接实现。  
  - 状态数目相对较大。

- **NFA**：非确定性有限自动机  
  - 状态对同一输入可以有多个可能的下一状态，甚至允许**ε-转换**。
  - 状态数目较少，图结构更紧凑，甚至比对应 DFA 小指数级。  
  - 运行时存在多个并行路径选择，因此可能进入多个状态，只要有一个是接受状态输入就会被接受。

### **ε-转换**
NFA 的关键设计之一是**ε-转换**，即无需读取输入字符也能从一个状态跳转到另一个状态。这使得每个实际输入符号的转换可以分解为多个步骤，便于简化自动机结构。

<figure style="text-align: center;">
  <img src="/illustrations/CS143-Week2/5.png" alt="NFA 的例子" width="80%">
  <figcaption>NFA 的例子</figcaption>
</figure>

### 表达能力
**NFA、DFA 和正则表达式**三者在表达语言的能力上是等价的，它们都能够描述和识别**正则语言**。

> 它们只是描述方式不同，但本质表示的语言集合一致。

# 实现
## 正则语言->NFA
对于每一类正则语言，我们都定义一个对应的 NFA，然后用$\varepsilon$-转换按照组合规则把所有对应的 NFA 连接起来即可。

<figure style="text-align: center;">
  <img src="/illustrations/CS143-Week2/6.png" alt="$\varepsilon$和单个字符" width="47%">
  <figcaption>$\varepsilon$和单个字符</figcaption>
  <img src="/illustrations/CS143-Week2/7.png" alt="并集和连接" width="70%">
  <figcaption>并集和连接</figcaption>
  <img src="/illustrations/CS143-Week2/8.png" alt="迭代" width="70%">
  <figcaption>迭代</figcaption>
</figure>

## NFA->DFA
### **$\varepsilon$-闭包**：从某个状态出发，只通过$\varepsilon$-转换，能够到达的所有状态集合。
### 子集构造法
子集构造法是一种将 NFA 转换为等价的 DFA 的方法。其核心思想是，**用 NFA 状态的集合来表示 DFA 的一个状态**，以此消除非确定性。

假设我们有一个 NFA，其五元组为：
* **S**：NFA 的状态集合
* **Σ**：输入字母表
* **δ**：NFA 的转移函数，允许 $\varepsilon$-转换
* **S₀**：初态
* **F**：终态集合

现在我们来构造等价的 DFA，其五元组为：
* **S'**：DFA 的状态集合，每个状态都是 NFA 状态的一个子集
* **Σ**：输入字母表，与 NFA 相同
* **δ'**：DFA 的转移函数
* **S₀'**：DFA 的初态
* **F'**：DFA 的终态集合

#### 1. 确定 DFA 的初态

DFA 的初态 $S_0'$ 是 NFA 初态 $S_0$ 的 $\varepsilon$-闭包。
$$S_0' = \varepsilon\text{-closure}(\{S_0\})$$

#### 2. 确定 DFA 的转移函数 $\delta'$

对于 DFA 中的任意一个状态 **C** (它是一个 NFA 状态集合) 和一个输入符号 **a** $\in$ $\Sigma$，DFA 的转移函数 $\delta'$ 定义如下：

* **第一步：计算 Move(C, a)**
    从 **C** 中的每个状态 **s** 出发，经过输入符号 **a** 所能到达的所有状态的集合。
    $$\text{Move}(C, a) = \bigcup_{s \in C} \delta(s, a)$$

* **第二步：计算 $\delta'(C, a)$**
    新的 DFA 状态是 **Move(C, a)** 的 $\varepsilon$-闭包。
    $$\delta'(C, a) = \varepsilon\text{-closure}(\text{Move}(C, a))$$
    如果这个新的状态集合 $\delta'(C, a)$ 尚未在 **S'** 中，我们就把它添加到 **S'** 中，并继续处理它。

#### 3. 确定 DFA 的终态集合 $F'$

DFA 的终态集合 $F'$ 包含所有至少包含一个 NFA 终态的 DFA 状态。
$$F' = \{ C \in S' \mid C \cap F \neq \emptyset \}$$

#### 4. 确定 DFA 的状态集合 $S'$

$S'$ 是在上述过程中所有通过 $\varepsilon$-闭包和 $\delta'$ 产生的，且可从 $S_0'$ 到达的状态的集合。

## NFA/DFA->词法分析器
### DFA 的二维矩阵表示

DFA 的转移函数是**单值**的，因此可以直接用如下形式：

```text
delta[state][symbol] = next_state
```

#### 示例：

设 $\Sigma = \{a, b\}$，状态集合 $Q = \{0, 1\}$

|        | a   | b   |
|--------|-----|-----|
| q₀ (0) | 1   | 0   |
| q₁ (1) | 1   | 0   |

### NFA 的二维矩阵表示

NFA 的转移函数是**多值**的（可能到多个状态），因此我们可以用一个**集合矩阵**来表示：

```text
delta[state][symbol] = {next_state_1, next_state_2, ...}
```

#### 示例：

设 $\Sigma = \{a, b\}$，状态集合 $Q = \{0, 1, 2\}$

|        | a       | b       |
|--------|---------|---------|
| q₀ (0) | {0, 1}  | ∅       |
| q₁ (1) | ∅       | {2}     |
| q₂ (2) | ∅       | ∅       |