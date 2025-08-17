---
title: CS143-PA2：Lexical Analysis
date: 2025-08-01 11:03:29
categories: CS143
description: CS143 PA2：实现 Cool 语言的词法分析器。
tags: [编译原理, Linux, CS143, 词法分析, 正则表达式]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。

# 词法分析
## 准备工作
本次作业的目标是：使用 Flex 实现一个可以将 Cool 源代码转换为 Token 序列的词法分析器。

在 `assignments/PA2` 目录下执行命令：

```bash
make lexer
```

会生成一个名为 `lexer` 的可执行文件，可以通过运行 `./lexer test.cl` 来对指定文件进行词法分析。

在编译过程中，`cool-lex.cc` 是由 Flex 根据 `cool.flex` 自动生成的，包含词法分析的主要实现；`lextest.cc` 提供程序入口（`main` 函数），主要负责命令行输出；其余文件都是辅助代码。

这里所用到的 **Flex** 是一种工具，它能够根据正则表达式规则自动生成词法分析器。其作用是将 `.flex` 文件转换为 C 语言代码（如 `cool-lex.cc`），并作为库函数与其他源码一起编译。目前我们通过 `lextest.cc` 来调用生成的词法分析器代码，后续我们可能会通过其它模块（如语法分析器）来调用。

Flex 的使用可以通过阅读 **Flex 的官方文档** 以及 `handouts` 目录下的相关 PDF 来了解，比如 PA2 的作业说明里面就有相关介绍。

回到 PA2，我们的核心任务是完善 `cool.flex` 文件，使其能够正确地进行词法分析。

项目提供了一个名为 `test.cl` 的测试用例，以及一个功能完整的、能够正确进行词法分析的标准 `lexer`。标准 `lexer` 位于 `bin` 目录下，其输出格式与我们希望实现的目标一致，我们的目标就是让自己的 `lexer` 输出与标准 `lexer` 的输出完全一致。

找了一圈在知乎找到了评分脚本……只需将 `<num>` 替换成对应的作业编号，然后用 wget 就可以下载对应的 Perl 评分脚本：
```
wget https://courses.edx.org/asset-v1:StanfordOnline+SOE.YCSCS1+3T2020+type@asset+block@pa<num>-grading.pl
```

## Flex 简单介绍
### 文件结构概述
Flex 文件由三部分组成，每个部分之间用 `%%` 隔开：

```flex
definitions
%%
rules
%%
user code
```

#### 1. definitions（定义区）

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

#### 2. rules（规则区）

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

#### 3. user code（用户代码区）

这一部分对应于 C 文件中定义函数的部分。可以在这里定义：

- 工具函数
- 重复使用的逻辑
- 比较完整的功能

总而言之，就是方便进行封装的地方。

### 状态量（Start Condition）
Flex 提供了一种非常方便的机制，被称作**状态量（Start Condition）**，它允许词法分析器根据上下文动态改变行为。简单来说，状态量使词法分析器在不同状态下对相同代码执行不同的匹配，只匹配与当前状态相关的正则表达式，忽略其他规则。这种机制极大增强了灵活性，使得处理多行注释、字符串，甚至在单一文件中混合多种语言（如 HTML 中的 JavaScript）等复杂场景变得轻松。利用状态量，词法分析器能够根据上下文智能调整解析策略，从而优雅地解决复杂的词法分析问题。

#### 状态量的声明

在 Flex 的定义区用 `%s` 或 `%x` 声明状态量：

- `%s` 表示**inclusive（包含）状态**，当前状态及 `INITIAL` 状态下的规则都有效。
- `%x` 表示**exclusive（排他）状态**，只有在该状态时，定义的规则才有效。

例如：

```flex
%x COMMENT
%s STRING
```

#### 状态量的使用

##### 1. 在规则中限定状态

状态量用尖括号 `<>` 包裹，放在正则表达式前，表示该规则只在对应状态时生效：

```flex
<COMMENT>"*)"    { BEGIN(INITIAL); }
```

表示：只有在 `COMMENT` 状态下，遇到 `*)`，才执行该动作。

##### 2. 状态切换

用 `BEGIN(STATE_NAME)` 切换状态：

```flex
"(*"     { BEGIN(COMMENT); }
<COMMENT>"*)" { BEGIN(INITIAL); }
```

这样当遇到 `(*` 时进入 `COMMENT` 状态，遇到 `*)` 时回到初始状态。

## 任务目标
> 在开始之前，建议先阅读 `handouts/cool-manual` 的第十节，详细介绍了 Cool 的词法结构。同时，推荐仔细阅读 .flex 程序所用到的头文件，从 `include/PA2/cool-parse.h` 文件中可以了解需要使用的 token 类型以及用于传递语义值的变量定义，`include/PA2/stringtab.h` 则展现了符号表的结构。

在词法分析中，我们需要处理 Cool 语言的以下几类成分，并根据它们的特性进行不同的处理：

### 1. 固定关键字
这些是 Cool 语言中预定义的、由固定字符串组成的词汇，例如：
* `if`
* `fi`
* `else`

当词法分析器匹配到这些字符串时，应直接生成对应的 **token**（例如 `IF`、`FI`、`ELSE`），通常不需要记录额外信息，可以在 `handouts/cool-manual` 的第十节找到所有关键字。唯一需要特殊处理的是 `true` 和 `false`，需要记录其值。

### 2. 各种符号
在 Cool 中，存在多种符号，包括运算符（如 `+`、`-`）和标点符号（如 `;`、`{`）等。其中，一些符号由两个字符组成，如 `<=`，这类符号通常会被定义为单独的 token 类型。而其他单字符符号则直接使用它们的 ASCII 值作为 token 类型（这也解释了为什么 Bison 的 token 编号不是从 0 开始）。对于不属于 Cool 语言规范的非法字符（如 `[`、`]`、`>` 等），词法分析器需要将其识别并报告为错误。

### 3. 可忽略的成分
这些成分在词法分析阶段会被识别，但不会生成任何 token，即需要被忽略。
* **空白字符**（包括空格、制表符等）
* **注释**（包括单行注释和多行注释）
* **换行符**：虽然不生成 token，但需要用于更新当前的行号。我们使用全局变量 `curr_lineno`，在每次匹配到 `\n` 时计数，方便后续的错误报告与调试。

### 4. 类型名与变量名
这类成分需要根据其模式和上下文进行识别：
* **类型名（Type ID）**：例如类名 `CellularAutomaton`，通常以大写字母开头。
* **变量名（Object ID）**：例如属性名 `population_map`，通常以小写字母开头。

### 5. 字面量
这类词汇不仅需要生成 token，还需要记录其具体内容或数值。
* **整数**：需要记录其整数值。
* **字符串**：需要记录字符串的具体内容。

> 详细规范请参考 `handouts/PA2.pdf` 和 `handouts/cool-manual.pdf`，这些文档提供了完整的语言描述和词法规则。

## 实现
### 固定关键字
根据 `include/PA2/cool-parse.h` 中的定义，我们可以直接返回对应关键字的大写形式。需要注意的是，`true` 和 `false` 必须以小写字母开头进行匹配；其他关键字则对大小写不敏感。另外，`true` 和 `false`，需要记录其值，返回 `BOOL_CONST` 类型。
```
CLASS         [Cc][Ll][Aa][Ss][Ss]
ELSE          [Ee][Ll][Ss][Ee]
FI            [Ff][Ii]
IF            [Ii][Ff]
IN            [Ii][Nn]
INHERITS      [Ii][Nn][Hh][Ee][Rr][Ii][Tt][Ss]
ISVOID        [Ii][Ss][Vv][Oo][Ii][Dd]
LET           [Ll][Ee][Tt]
LOOP          [Ll][Oo][Oo][Pp]
POOL          [Pp][Oo][Oo][Ll]
THEN          [Tt][Hh][Ee][Nn]
WHILE         [Ww][Hh][Ii][Ll][Ee]
CASE          [Cc][Aa][Ss][Ee]
ESAC          [Ee][Ss][Aa][Cc]
NEW           [Nn][Ee][Ww]
OF            [Oo][Ff]
NOT           [Nn][Oo][Tt]

 /* true 和 false 的宏定义，首字母必须是小写 */
TRUE_KW       t[Rr][Uu][Ee]
FALSE_KW      f[Aa][Ll][Ss][Ee]
```

在规则区直接返回即可：
```
{CLASS}       { return (CLASS); }
{ELSE}        { return (ELSE); }
{FI}          { return (FI); }
{IF}          { return (IF); }
{IN}          { return (IN); }
{INHERITS}    { return (INHERITS); }
{ISVOID}      { return (ISVOID); }
{LET}         { return (LET); }
{LOOP}        { return (LOOP); }
{POOL}        { return (POOL); }
{THEN}        { return (THEN); }
{WHILE}       { return (WHILE); }
{CASE}        { return (CASE); }
{ESAC}        { return (ESAC); }
{NEW}         { return (NEW); }
{OF}          { return (OF); }
{NOT}         { return (NOT); }

/* true 和 false 的规则，使用专门的宏 */
{TRUE_KW}     {
  yylval.boolean = 1;
  return BOOL_CONST;
}
{FALSE_KW}    {
  yylval.boolean = 0;
  return BOOL_CONST;
}
```

### 各种符号
首先处理三个两个字符组成的符号，跟关键字一样地传递即可：
```
DARROW          =>
ASSIGN          <-
LE              <=
%%
{DARROW}		{ return (DARROW); }
{ASSIGN}        { return (ASSIGN); }
{LE}            { return (LE); }
```

然后处理非法字符和控制字符，记录字符，返回 ERROR：
```
[\[\]\'>_\0\\!#$%^&\|`?] {
    // invalid chars
    yylval.error_msg = yytext;
    return (ERROR);
}
[\x00-\x1F\x7F] {
  // unprintable
  yylval.error_msg = yytext;
  return (ERROR);
}
```

接着处理空白字符，直接忽略即可，注意换行虽然属于空白字符但不能忽略：
```
[ \t\f\r\v]     {}
```

换行要更新 `curr_lineno`：
```
\n              {++curr_lineno;}
```

最后处理剩下的合法字符，直接返回字符的 ASCII 码即可：
```
.               {
    return yytext[0];
}
```

### 注释
空白字符已经在上一部分解决，这里主要解决注释的问题。单行注释容易解决，直接进行匹配就行，注意.不会匹配换行符和 EOF：
```
--.*           {}
```

多行注释会复杂一些，特别是允许嵌套的情况下，无法使用单个正则表达式完成匹配（否则可以用 `\(\*([^*]|\*+[^*)])*\*+\)` 进行匹配）。因此，我们需要借助 Flex 提供的状态量（Start Condition）语法糖，来处理这种上下文无关的语言结构。

我们定义一个排他状态 COMMENT，用 `now_status` 来计数注释的嵌套，注意注释内部碰到换行要计数，碰到终止符要报错：
```
\(\*          {
  now_status = 1;
  BEGIN(COMMENT);
}

\*\)          {
  yylval.error_msg = "Unmatched *)";
  return (ERROR);
}

<COMMENT>\(\* {
  now_status++;
}

<COMMENT>\*\) {
  now_status--;
  if(now_status == 0)
    BEGIN(INITIAL);
}

<COMMENT>\n   {
  ++curr_lineno;
}

<COMMENT><<EOF>> {
  BEGIN(INITIAL);
  yylval.error_msg = "EOF in comment";
  return (ERROR);
}

<COMMENT>.    {}
```

### 类名与变量名
从 `include/PA2/stringtab.h` 可以看出，类名和变量名被存储在 `StringTable<IdEntry>` 中。每个这样的符号表都有一个 `add_string` 方法，调用该方法并传入一个字符串时，会尝试将该字符串添加为一个符号。`StringTable` 类的实现保证了不会重复添加相同的字符串。

根据 Cool 语言的语法，我们知道类型标识符以大写字母开头，对象标识符以小写字母开头。

```
[A-Z][A-Za-z0-9_]*  {
  yylval.symbol = idtable.add_string(yytext, yyleng);
  return (TYPEID);
}
[a-z][A-Za-z0-9_]*  {
  yylval.symbol = idtable.add_string(yytext, yyleng);
  return (OBJECTID);
}
```

### 字面量
#### 整数字面量
整数字面量和前面一样匹配即可，没什么区别：
```
[0-9][0-9]* {
  yylval.symbol = inttable.add_string(yytext, yyleng);
  return (INT_CONST);
}
```

#### 字符串字面量
字符串的处理相对比较复杂，我们同样利用状态量。定义状态 STRING，当解析器遇到字符串开始符 `"` 时，会进入 STRING 状态。在这个状态下，它会开始收集字符到缓冲区中。
* **常规处理**：在 **STRING** 状态下，如果遇到普通字符，会直接将其添加到缓冲区。当遇到字符串结束符 `"` 时，则表明一个完整的字符串已经解析完毕，此时会返回一个代表该字符串的 **token**。
* **转义处理**：如果解析器遇到转义符 `\`，我们让它暂时切换到 **ESCAPE** 状态。在这个状态下，它会处理各种转义序列，例如 `\n`（换行）或 `\t`（制表符）。处理完毕后，解析器会返回到 **STRING** 状态，继续收集字符。
* **错误处理**：为了确保词法分析的健壮性，我们需要对字符串常量中的各种错误进行处理：
  - 对于**未闭合的字符串**（如遇到换行符或文件提前结束），应立即报告错误。
  - 对于**字符串中包含空字符（`\0`）**或**字符串长度超过限制（如超过 1024 字节）**的情况，应在整个字符串处理完成后再报告错误。

我们利用宏定义
```
#define STRING_TOO_LONG (string_buf_ptr >= string_buf + MAX_STR_CONST)
```

来判断字符串数组是否过长，如果过长不再继续插入字符。

```
\"          {
  string_buf_ptr = string_buf;
  BEGIN(STRING);
}

<STRING>\" {
  *string_buf_ptr = '\0';
  BEGIN(INITIAL);
  if(string_has_null == 1){
    yylval.error_msg = "String contains null character";
    return (ERROR);
  }
  if(STRING_TOO_LONG){
    yylval.error_msg = "String constant too long";
    return (ERROR);
  }
  yylval.symbol = stringtable.add_string(string_buf);
  return (STR_CONST);
}

<STRING>\\ {
  BEGIN(ESCAPE);
}

<STRING>\n {
  BEGIN(INITIAL);
  curr_lineno++;
  yylval.error_msg = "Unterminated string constant";
  return ERROR;
}

<STRING><<EOF>> {
  BEGIN(INITIAL);
  yylval.error_msg = "EOF in string constant";
  return ERROR;
}

<STRING>[^\n\\\"] {
  if (yytext[0] == '\0')
    string_has_null = 1;
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = yytext[0];
}

<ESCAPE>n {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\n';
  BEGIN(STRING);
}

<ESCAPE>b {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\b';
  BEGIN(STRING);
}

<ESCAPE>t {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\t';
  BEGIN(STRING);
}

<ESCAPE>f {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\f';
  BEGIN(STRING);
}

<ESCAPE>v {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\v';
  BEGIN(STRING);
}

<ESCAPE>\n {
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = '\n';
  ++curr_lineno;
  BEGIN(STRING);
}

<ESCAPE><<EOF>> {
  BEGIN(INITIAL);
  yylval.error_msg = "EOF in string constant";
  return (ERROR);
}

<ESCAPE>. {
  if (yytext[0] == '\0')
    string_has_null = 1;
  if(!STRING_TOO_LONG)
    *string_buf_ptr++ = yytext[0];
  BEGIN(STRING);
}
```

> 注意：以上内容按模块编写，但并不意味着全部按顺序拼接即可，因为规则是有先后顺序的，写的顺序不对可能导致某些规则永远无法匹配上，具体代码见 GitHub。

# 小结
PA2 并不算困难，在 Flex 的帮助下，只需要写正则表达式的我们没有什么需要动脑子的地方，但是细节真的很多，在一大堆信息里面找有用的信息也并不是一件轻松的事情……话说程序里面居然真的会有空字符啊。

顺手贴一个通关截图：

<figure style="text-align: center;">
  <img src="/illustrations/CS143-PA2/1.png" alt="通关截图" width="100%">
  <figcaption>通关截图</figcaption>
</figure>