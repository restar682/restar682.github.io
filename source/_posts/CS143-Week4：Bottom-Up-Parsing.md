---
title: CS143-Week4：Bottom-Up Parsing
date: 2025-08-06 09:19:37
categories: CS143
description: 
tags: [编译原理, Linux, CS143, 语法分析, 预测解析]
---
# 预测解析
## 简介
**预测解析**是一种无需回溯的自顶向下的语法分析算法。

- **核心思想**：为文法的每个非终结符设计一个确定的解析过程，根据当前输入的 Token **预测**应使用的产生式规则，从而直接选择正确的分支进行匹配，避免回溯。
- **解析过程**：
    - 构建预测分析表
        - 对每个非终结符，预先计算其 **FIRST** 集（所有产生式右部能推导出的第一个终结符的集合）和 **FOLLOW** 集（在某些句型中可能紧跟该非终结符的终结符集合）。
        - 对于每个产生式 $S \to \alpha$：
            - 对每一个 $a \in \text{FIRST}(\alpha)$ 且 $a \neq \varepsilon$，将产生式 $S \to \alpha$ 填入分析表的 $M[S, a]$ 位置。
            - 如果 $\varepsilon \in \text{FIRST}(\alpha)$，则对每一个 $b \in \text{FOLLOW}(S)$，将产生式 $S \to \alpha$ 填入分析表的 $M[S, b]$ 位置。
        <figure style="text-align: center; margin-top: 1em;">
          <img src="/illustrations/CS143-Week4/1.png" alt="预测分析表的例子" width="80%">
          <figcaption>预测分析表的例子</figcaption>
        </figure>
    - 解析输入串
        - 初始化分析栈，栈底为 $ {\$} $，其上为文法起始符号；
        - 每次查看栈顶符号 $X$ 和当前输入符号 $a$：
            - 若 $X$ 是终结符且 $X = a$，则弹出栈顶，读取下一个输入符号；
            - 若 $X$ 是非终结符，查找分析表 $M[X, a]$：
                - 若存在对应产生式 $X \to \alpha$，则弹出 $X$，并将 $\alpha$ 的符号从右到左依次压入栈；
                - 若查表为空或无定义，则报错（语法错误）；
            - 重复上述过程，直到栈为空且输入符号流结束（即均到达 $ {\$} $），表示解析成功。
- **构建结果**：成功时构建出一棵**语法分析树**，所有 Token 位于叶节点，且解析过程是线性的，无回溯开销。
- **要求**：文法必须是 **LL(1)** 文法。

## LL(1)文法
### 概念
LL(1) 文法是一种适用于自顶向下语法分析的 CFG，其名称中的“LL”表示从左到右扫描输入并构造最左推导，“1”表示分析时只需查看一个输入符号即可确定使用哪个产生式。这类文法要求无左递归、无二义性，并且每个非终结符的所有候选产生式的 FIRST 集互不相交，若某产生式可推出空串，则其 FIRST 集与 FOLLOW 集也不相交。

由于 LL(1) 文法具有确定性，可以构造无冲突的预测分析表，使得语法分析过程高效且无需回溯，因此广泛被应用于编译器设计中，尤其适合处理结构清晰的语言构造。但并非所有文法都能转化为 LL(1) 文法，复杂语言可能需要更强的分析方法。
### 左因子分解
若 $S \to \alpha\beta_1 \mid \alpha\beta_2$，且 $\alpha$ 是非空终结符串，则 $\text{FIRST}(\alpha\beta_1) \cap \text{FIRST}(\alpha\beta_2) \neq \emptyset$，无法通过下一个输入符号唯一确定使用哪个产生式。我们可以通过提取公共左因子来解决这个问题。

设公共左因子为 $\alpha$，引入新非终结符 $S'$：
- 原式：$ S \to \alpha\beta_1 \mid \alpha\beta_2 \mid \cdots \mid \alpha\beta_n $
- 改写为：
    $ S \to \alpha S' $  
    $ S' \to \beta_1 \mid \beta_2 \mid \cdots \mid \beta_n $

改写后的形式消除了原非终结符 $S$ 所带来的预测冲突。此时，$\text{FIRST}(\beta_1), \text{FIRST}(\beta_2), \dots$ 应两两不相交；如果某个 $\beta_i$ 可导出空串（即 $\beta_i \Rightarrow^* \varepsilon$），则还必须确保 $\text{FOLLOW}(S')$ 与其他各 $\text{FIRST}(\beta_j)$ 也无交集，从而满足 LL(1) 文法的判定条件。

## FIRST & FOLLOW 集
### FIRST 集的确定

- **定义**：对于一个符号串 $\alpha$（可以是非终结符、终结符或它们的组合），$FIRST(\alpha)$ 是所有可以从 $\alpha$ 开始推导出的字符串的第一个终结符的集合。如果 $\alpha$ 能够推导出空串 $\varepsilon$，则 $\varepsilon$ 也属于 $FIRST(\alpha)$。

- **算法步骤**：

  1. 如果 $x$ 是终结符，则 $FIRST(x) = {x}$。
  2. 对于非终结符 $A$ 的每个产生式 $A \to \alpha\_1 \alpha\_2 \dots \alpha\_n$：
    - 将 $FIRST(\alpha\_1)$ 中除去 $\varepsilon$ 的元素加入 $FIRST(A)$；
    - 如果 $\varepsilon \in FIRST(\alpha\_1)$，则继续将 $FIRST(\alpha\_2)$ 中除 $\varepsilon$ 的元素加入 $FIRST(A)$，依此类推；
    - 如果所有 $\alpha\_i\ (i=1,2,\dots,n)$ 都满足 $\varepsilon \in FIRST(\alpha\_i)$，则将 $\varepsilon$ 加入 $FIRST(A)$。

### FOLLOW 集的确定

- **定义**：$FOLLOW(A)$ 是所有在某个句型中紧跟在非终结符 $A$ 后面的终结符的集合。如果 $A$ 可以出现在句子的末尾，则输入结束符号 ${\$}$（表示输入结束）也属于 $FOLLOW(A)$。

- **算法步骤**：

  1. 初始化： $ FOLLOW(S) = \\{ \\$ \\} $ ，其中 $S$ 是文法的开始符号。
  2. 对于每个产生式 $A \to \alpha B \beta$：

    - 将 $FIRST(\beta)$ 中除 $\varepsilon$ 的元素加入 $FOLLOW(B)$；
    - 如果 $\varepsilon \in FIRST(\beta)$ 或 $\beta \Rightarrow^\* \varepsilon$，则将 $FOLLOW(A)$ 中的所有元素加入 $FOLLOW(B)$。
  3. 如果存在产生式 $A \to \alpha B$ 或 $A \to \alpha B \beta$ 且 $\beta \Rightarrow^\* \varepsilon$，重复步骤 2，直到所有 $FOLLOW$ 集稳定为止（不再变化）。