---
title: CS143-PA3：Parsing
date: 2025-08-10 12:14:47
categories: CS143
description: CS143 PA3：实现 Cool 语言的语法分析器。
tags: [编译原理, Linux, CS143, 语法分析, 抽象语法树]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。

# 语法分析
## 准备工作
本次作业的目标是：使用 Bison 实现一个可以将 Token 序列转换为 AST 的语法分析器。

在 `assignments/PA3` 目录下执行命令：

```bash
make parser
```

会生成一个名为 `parser` 的可执行文件，可以通过运行 `./myparser test.cl` 来对指定文件进行词法分析。这里的 `myparser` 是一个 `csh` 脚本，如果用的是 `bash` 的话需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser
```

在编译过程中，Bison 生成的 `cool-parse.cc` 负责语法分析的主要实现；`parser-phase.cc` 提供程序入口，负责驱动并测试语法分析器；`cool-tree.aps` 定义 AST 结构，并自动生成 `cool-tree.h` 与 `cool-tree.cc` 以支持树节点的构造与处理，剩下的 `tokens-lex.cc`、`dumptype.cc` 和 `handle_flags.cc` 等文件为辅助代码，不需要修改。

这里所用到的 **Bison** 是一种语法分析器生成工具，它能够根据上下文无关文法规则自动生成语法分析器。其作用是将 `.y` 文件转换为 C/C++ 源码（如 `cool-parse.cc`），并作为库函数与其他源码一起编译。目前我们通过 `parser-phase.cc` 来调用生成的语法分析器代码，后续可能会通过编译器的其他阶段（如语义分析器）来调用。

Bison 的使用可以通过阅读 **Bison 的官方文档** 以及 `handouts` 目录下的相关 PDF 来了解，比如 PA3 的作业说明里面有相关介绍。

回到 PA3，我们的核心任务是完善 `cool.y` 文件，使其能够正确地进行语法分析。

## Bison 简单介绍
### 文件结构概述
Bison 文件由三部分组成，每个部分之间用 `%%` 隔开：

```bison
definitions
%%
rules
%%
user code
```

#### 1. definitions（定义区）

这一部分用于声明语法分析器所需的各种信息，类似于 C 文件的头部。在这里可以：

- **声明终结符（tokens）**：告诉 Bison 所有词法单元（由 Flex 提供）；
- **声明非终结符的属性类型**：通过 `%type` 指定每个非终结符使用 `union` 中的哪个成员；
- **定义属性的联合体（union）**：统一表示所有语法树节点或值的类型；
- **指定起始符号**（可选）；
- **包含头文件**、**定义宏**或**声明全局变量**（用 `%{ ... %}` 包裹）。

##### 常用声明语法：

- **`%union`**：定义所有可能的属性类型（通常是语法树节点指针）：
  ```bison
  %union {
      int           int_val;
      char*         string_val;
      Program       program;
      ···
  }
  ```

- **`%token`**：声明终结符（token），可带类型：
  ```bison
  %token <int_val>  INTEGER
  %token <string_val> IDENTIFIER STRING_CONST
  %token IF THEN ELSE FI
  ```

- **`%type`**：声明非终结符的属性类型（即使用 `union` 中的哪个字段）：
  ```bison
  %type <program> program
  %type <expr>    expression if_expr while_expr
  %type <stmt>    statement assign_stmt block_stmt
  ```

- **`%start`**：指定文法的开始符号（默认为第一条规则的左部）：
  ```bison
  %start program
  ```

> 注意：所有带属性的终结符和非终结符都必须用 `%token` 或 `%type` 声明类型，否则 Bison 不知道如何存储它们的值，会导致运行时错误。

#### 2. rules（语法规则区）

这是 Bison 文件的核心部分，我们在这里定义 CFG，描述语言的语法结构。

每条规则的形式如下：

```bison
非终结符: 产生式右部    { 动作代码 }
        | 产生式右部    { 动作代码 }
        ;
```

- `非终结符`：必须在 `%type` 中声明过（如果有属性）；
- `产生式右部`：由终结符、非终结符或其他符号组成；
- `{ 动作代码 }`：当该规则被归约时执行的 C/C++ 代码，通常用于构造语法树节点。

##### 示例：

```bison
expression: expression '+' expression
          { $$ = plus($1, $3); }  // $1 是左 expression，$3 是右 expression，$$ 是当前 expression
        | IDENTIFIER
          { $$ = identifier($1); }
        | INTEGER
          { $$ = integer_const($1); }
        ;
```

##### 重要规则：

- 每条规则必须以 `;` 结尾；
- `$1`, `$2`, ..., `$n` 表示右部第 1 到第 n 个符号的属性值；
- `$$` 表示当前非终结符的属性值（即归约后的结果）；
- 动作代码必须用 `{}` 括起来，且不能与规则在同一行（除非缩进，一般另起一行）；
- 多条规则可以用 `|` 连接，表示“或”的关系。

#### 3. user code（用户代码区）

这一部分用于编写辅助函数、语法树构造函数、错误处理函数等 C/C++ 代码。

可以在这里定义：

- 语法树节点的构造函数（如 `plus()`, `identifier()`）；
- 错误报告函数（如 `yyerror(const char *msg)`）；
- 工具函数、内存管理逻辑等。

例如：

```c
void yyerror(const char *msg) {
    fprintf(stderr, "Parse error at line %d: %s\n", lineno, msg);
}

int main() {
    yyparse();
    return 0;
}
```

> 注意：`yyerror` 是 Bison 自动生成调用的错误处理函数，必须实现。

### 属性与语义值

Bison 支持**带属性的文法符号**，用于 AST 或传递信息。

- 所有属性通过 `%union` 统一管理；
- 每个符号的属性值通过 `$$`, `$1`, `$2` 等访问；
- 属性类型必须与 `%token` 或 `%type` 声明一致，否则会导致类型错误或程序崩溃。

> 类型错误可能导致程序在运行时崩溃（如把指针存到整数字段）。

### 错误处理

Bison 内置支持语法错误处理：

- 使用特殊符号 `error` 可以定义错误恢复规则：
  ```bison
  statement: expression ';'
           | error ';' { yyerrok; }  // 遇到错误，跳过直到 ';'，然后恢复
           ;
  ```
- `yyerrok`：表示错误已处理，恢复正常解析；
- `yyclearin`：清除当前输入符号，常与 `yyerrok` 一起使用。

---

### 运行与调试

- 用 `bison -d parser.y` 生成 `parser.tab.c` 和 `parser.tab.h`；
- `parser.tab.h` 应被 Flex 文件包含，以共享 token 定义；
- 编译时链接 Flex 和 Bison 生成的文件；
- 可使用 `-v` 选项生成 `parser.output` 文件，查看状态机、冲突等信息。