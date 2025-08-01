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

这里所用到的 Flex 是一种工具，它能够根据正则表达式规则自动生成词法分析器。

在 `assignments/PA2` 目录下执行命令：

```bash
make lexer
```

会生成一个名为 `lexer` 的可执行文件，可以通过运行 `./lexer test.cl` 来对指定文件进行词法分析。

我们的核心任务是完善 `cool.flex` 文件，使其能够正确地进行词法分析。

在开始完善 `cool.flex` 之前，首先肯定要了解 Flex 的使用，可以阅读 **Flex 的官方文档** 以及 `handouts` 目录下的相关 PDF，比如 PA2 的作业说明里面就有相关介绍。

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