---
title: CS143-PA2：Lexical
date: 2025-08-01 11:03:29
categories: CS143
description: CS143 PA2：实现 Cool 语言的词法分析器。
tags: [编译原理, Linux, CS143, 词法分析, 正则表达式]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。
## 准备工作
本次作业的目标是：使用 Flex 实现一个可以将 Cool 源代码转换为 token 序列的词法分析器。

在 `assignments/PA2` 目录下执行命令：

```bash
make lexer
```

会生成一个名为 `lexer` 的可执行文件，可以通过运行 `./lexer test.cl` 来对指定文件进行词法分析。

在编译过程中，`cool-lex.cc` 是由 Flex 根据 `cool.flex` 自动生成的，包含词法分析的主要实现；`lextest.cc` 提供程序入口（`main` 函数），主要负责命令行输出；其余文件都是辅助代码。

这里所用到的 Flex 是一种工具，它能够根据正则表达式规则自动生成词法分析器。其作用是将 `.flex` 文件转换为 C 语言代码（如 `cool-lex.cc`），并作为库函数与其他源码一起编译。目前我们通过 `lextest.cc` 来调用生成的词法分析器代码，后续我们可能会通过其它模块（如语法分析器）来调用。

Flex 的使用可以通过阅读 **Flex 的官方文档** 以及 `handouts` 目录下的相关 PDF 来了解，比如 PA2 的作业说明里面就有相关介绍。

回到 PA2，我们的核心任务是完善 `cool.flex` 文件，使其能够正确地进行词法分析。

项目提供了一个名为 `test.cl` 的测试用例，以及一个功能完整的、能够正确进行词法分析的标准 `lexer`。标准 `lexer` 位于 `bin` 目录下，其输出格式与我们希望实现的目标一致，我们的目标就是让自己的 `lexer` 输出与标准 `lexer` 的输出完全一致。

为了方便测试，从<a href="https://zhuanlan.zhihu.com/p/258385544">大佬的文章</a>里 COPY 了一个简单的 Python 脚本 `test_compare.py`，它可以比较自己的 `lexer` 输出和标准 `lexer` 输出之间的差异。

```python
#!/usr/bin/python3
# test_compare.py
import os

# 运行我们自己的 lexer 并获取输出
myOutput = os.popen("make dotest").read()
# 运行标准 lexer 并获取输出
stdOutput = os.popen("lexer test.cl").read()

beginIndex = myOutput.index("#name")
myOutput = myOutput[beginIndex:]

while True:
    myEnd = myOutput.index("\n")
    stdEnd = stdOutput.index("\n")

    # 比较两行输出是否相同
    if myOutput[0:myEnd] != stdOutput[0:stdEnd]:
        print("my flex ", myOutput[0:myEnd])
        print("std flex", stdOutput[0:stdEnd])
        print("")

    # 如果有任何一方输出结束，则退出循环
    if myEnd == -1 or stdEnd == -1:
        break

    # 移动到下一行
    myOutput = myOutput[myEnd + 1:]
    stdOutput = stdOutput[stdEnd + 1:]
```

## Flex 简单介绍
Flex 文件由三部分组成，每个部分之间用 `%%` 隔开：

```flex
definitions
%%
rules
%%
user code
```

### 1. definitions（定义区）

这一部分的作用类似于 C 文件的头部。在这里可以：

- **包含头文件**（如 `#include <stdio.h>` 等），为后续 C 代码或动作代码做准备；
- **定义全局变量**、**结构体** 或 **宏**（如 `#define`），以便在整个词法分析器中使用；
- **定义正则表达式别名**，这是 Flex 特有的功能，可以通过简单的名字表示复杂的正则表达式，提高可读性和复用性，例如：

  ```flex
  DIGIT   [0-9]
  ID      [a-zA-Z_][a-zA-Z_0-9]*
  ```

C 语言的部分可以用 `%{` 和 `%}` 包裹，或者让代码缩进，但缩进的格式很难控制，所以最好还是写在 `%{` 和 `%}` 内部。

下面是一个简单的例子：

```flex
%{
#include <stdio.h>
int lineno = 1;
#define MAX_ID_LEN 256
%}

DIGIT     [0-9]
LETTER    [a-zA-Z]
ID        {LETTER}({LETTER}|{DIGIT})*
```

定义区的内容对后续的规则区和用户子程序区都可以起作用。

### 2. rules（规则区）

这是我们主要实现的地方，我们在这里编写正则表达式，用于识别源代码中的各种 token，例如标识符、关键字、数字、注释等。

每个正则表达式后面跟一个用 `{}` 括起来的代码块：

```flex
正则表达式    { 动作代码 }
```

Flex 会在输入文本中查找匹配的模式，当匹配到某个正则表达式时，就执行其对应的代码。

Flex 的格式比较严格，需要注意：
- 正则表达式必须写在**新的一行的行首**，前面不能有空格或制表符，否则这些空格会被当作正则表达式的一部分；
- 正则表达式与后面的代码块之间必须有**至少一个空格**，否则大括号 `{` 会被当作正则表达式的一部分，导致识别错误；
- 多行注释在开头应添加缩进。

### 3. user code（用户代码区）

这一部分对应于 C 文件中定义函数的部分。可以在这里定义：

- 工具函数
- 重复使用的逻辑
- 比较完整的功能

总而言之，就是方便进行封装的地方。

## 任务目标
> 在开始之前，强烈建议阅读 `handouts/cool-manual` 的第十节，里面介绍了 Cool 的词法结构。

在词法分析中，我们需要处理 Cool 语言的以下几类成分，并根据它们的特性进行不同的处理：

### 1. 固定关键字
这些是 Cool 语言中预定义的、由固定字符串组成的词汇，例如：
* `if`
* `fi`
* `else`

当词法分析器匹配到这些字符串时，应直接生成对应的 **token**（例如 `IF`、`FI`、`ELSE`），通常不需要记录额外信息，可以在 `include/PA2/cool-parse.h` 找到所有关键字。

### 2. 字面量
这类词汇不仅需要生成 token，还需要记录其具体内容或数值。
* **整数**：需要记录其整数值。
* **字符串**：需要记录字符串的具体内容。

### 3. 可忽略的成分
这些成分在词法分析阶段会被识别，但不会生成任何 token，即需要被忽略。
* **注释**
* **空格**

### 4. 特殊符号与标识符
这类成分需要根据其模式和上下文进行识别：
* **各种符号**：如运算符（`+`、`-`）和标点符号（`;`、`{`）。
* **类型名（Type ID）**：例如类名 `CellularAutomaton`，通常以大写字母开头。
* **变量名（Object ID）**：例如属性名 `population_map`，通常以小写字母开头。

### 5. 非法字符
对于不符合 COOL 语言规范的字符，如 `[`、`]`、`>` 等，词法分析器需要识别并报告错误。

### 6. 换行符
换行符（`\n`）虽然不会生成 token，但它的出现至关重要。你需要使用一个全局变量（例如 `curr_lineno`）来跟踪当前的行号，并在每次匹配到换行符时更新这个变量。

> 详细规范请参考 `handouts/PA2.pdf` 和 `handouts/cool-manual.pdf`，这些文档提供了完整的语言描述和词法规则。

## 实现
### 固定关键字
根据 `include/PA2/cool-parse.h` 里面的内容，我们直接返回相应的