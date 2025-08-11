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

常用声明语法：

- **`%union`**：定义所有可能的属性类型（通常是语法树节点指针）：
  ```bison
  %union {
      int           int_val;
      char*         string_val;
      Program       program;
      Expression    expr;
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
#### 基本原理
- **特殊 token `error`**
  - 由 Bison 自动定义，用于错误处理，不需要在文法中声明。
  - 当出现语法错误时，解析器会生成该 token。
  - 如果当前上下文有匹配 `error` 的规则，解析器就能继续工作。

- **错误恢复流程**
  1. 发生语法错误 → 生成 `error` token。
  2. 弹出状态栈（丢弃部分语义上下文）直到找到可接受 `error` 的状态。
  3. 移入 `error` token。
  4. 如果下一个 token 解释器无法接受 → 丢弃输入 token，直到找到可接受的 token。
  5. 继续按照匹配的错误规则执行。

- **常见恢复策略**
  - **跳过当前语句**
    ```bison
    stmt: error ';'  /* 错误时跳过直到 ';' */
    ```
  - **跳过到匹配的闭合符**
    ```bison
    primary:
      '(' expr ')'
    | '(' error ')'
    ;
    ```

#### 注意事项
- **规则动作**  
  错误规则和普通规则一样，可以有动作代码。
  
- **错误消息抑制**
  - 避免错误雪崩：恢复后，如果连续 3 个 token 没有被成功移入，不会输出新错误。
  - 宏 `yyerrok;`：立即恢复错误消息输出。
  - 宏 `yyclearin;`：清除当前 lookahead token，让扫描器重新提供一个 token。
  
- **状态检测**
  - `YYRECOVERING()`：判断当前是否在错误恢复状态（1 表示正在恢复）。

## Cool 语言的 AST 包
为了将 Token 序列转换成 AST，我们肯定要了解 Cool 语言的 AST 的定义。（~~怎么这么多要了解的东西~~）

Cool 语言的 AST 代码由 `cool-tree.aps` 文件中的规范自动生成。虽然这些代码结构简单、规则统一，但由于缺乏注释，阅读和理解起来并不直观。接下来，我们将参考 `handouts/cool-tour` 第六节的内容，对其结构进行分析和理解。
### APS 简介
Cool 语言的抽象语法在 APS 中定义。在 APS 术语中，抽象语法树的各种节点（如 let、`+` 等）被称为构造器。AST 的格式由一组 **门类（phyla）** 描述，每个门类包含一个或多个构造器，用于表示特定类型的语法结构。

门类本质上就是类型，它是我们根据功能对构造器进行分组后确定的。例如，将表达式 AST 的构造器与类 AST 的构造器区分开来。门类的定义位于 `cool-tree.aps` 文件的开头。
```aps
module COOL[] begin
  phylum Program;
  phylum Class_;
  phylum Classes = LIST [Class_];
  phylum Feature;
  phylum Features = LIST [Feature];
  phylum Formal;
  ···
```

从定义可以看出，门类分为两种类型：“正常”门类和“列表”门类。正常门类关联有构造器，列表门类则定义有一组固定的列表操作。

每个构造器都接受带有明确类型的参数，并返回带有明确类型的结果。参数类型可以是先前定义的门类或任何普通的 C++ 类型。实际上，门类的声明会被 APS 编译器转换成对应的 **C++** 类声明。例如：

```aps
constructor class_(name : Symbol; parent: Symbol; features : Features; filename : Symbol) : Class_;
```

此声明指定 `class_` 构造函数接受四个参数：
1. `Symbol`（类型标识符）用于类名  
2. `Symbol`（类型标识符）用于父类  
3. `Features`（由 `Feature` 构成的列表）  
4. `Symbol` 用于存放类定义的文件名

`class_` 构造函数返回类型为 `Class_` 的 AST 节点。在 `cool.y` 中，使用示例如下：

```bison
class : CLASS TYPEID INHERITS TYPEID IS optional_feature_list END ';'
    { $$ = class_($2, $4, $6, stringtable.add_string(curr_filename)); }
```

该构造函数会用四个参数作为子节点构建一个 `Class_` 树节点。由于参数类型已声明，**C++** 类型检查器会强制确保仅将构造函数用于适当类型的参数。

在阅读代码时需要注意：相同的名称在不同上下文中可能表示不同实体。例如：
- `CLASS`：终端符号  
- `class`：非终端符号  
- `class_`：构造器  
- `Class_`：门类

它们的含义完全不同。此外，在 `cool.y` 的联合声明中还有 `class_` 成员，含义又不同。大多数情况可通过大小写区分，但并非总是如此，因此阅读代码时需特别注意每个符号的角色。

### AST 列表
对每个普通门类 `X`，APS 都会对应地定义一个列表门类 `Xs`，其类型为 `List [X]`（除了 `Classes` 是 `Class_` 的列表）。APS 为列表型门类提供了一组专用的操作，用于构建和访问列表结构。常用列表操作函数有：
| 函数名                | 功能说明                     |
|---------------------|---------------------------|
| `nil_Classes()`       | 返回一个空的 `Classes` 列表         |
| `single_Classes(Class_)` | 根据单个 `Class_` 元素创建长度为1的列表 |
| `append_Classes(Classes, Classes)` | 拼接两个 `Classes` 列表             |
| `Class_ nth(int index)`    | 选取列表中第 `index` 个元素          |
| `int len()`           | 返回列表长度                   |

列表还提供了一个简单的迭代器，包含以下方法：

- `first()`：返回列表第一个元素的索引  
- `more(index)`：当 `index` 不是最后一个元素时返回 `true`，否则返回 `false`  
- `next(index)`：返回列表中 `index` 的下一个元素的索引

### AST 类层次结构
Cool 的 AST 采用面向对象的类继承机制组织节点类型，整体结构如下：
- 除列表外，所有 AST 类均派生自基类 `tree_node`。  
- 所有列表都是 `tree_node` 类型的列表。  
- `tree_node` 类及 AST 列表模板定义在 `tree.h` 中。

#### `tree_node` 类
- 定义了抽象语法树节点所需的基本信息，除去特定构造函数特有的数据。  
- 包含受保护成员 `line_number`，表示该 AST 节点对应的源代码行号，用于编译器生成精准的错误提示信息。  
- 提供的重要成员函数包括：  
  - `dump`：以 pret 格式打印 AST。  
  - `get_line_number`：访问节点对应的行号。

#### 门类
- 每个门类是直接从 `tree_node` 派生的类。  
- 门类的主要作用是将相关构造函数归类，不增加额外功能。

#### 构造器类
- 每个构造器类都派生自对应的门类。  
- 每个构造器类定义了一个同名函数，用于构建对应的 AST 节点。  
- 构造器类自动定义了 `dump` 函数，用于打印节点信息。

### AST 构造器类属性
tree 包中每个类定义都包含若干属性。每个构造器类都会为其组成部分定义对应的属性，属性名称与构造器中的字段名一致，且仅对该构造器类及其派生类的成员函数可见。例如，`class_constructor` 类具有以下四个属性：

* `Symbol name;`
* `Symbol parent;`
* `Features features;`
* `Symbol filename;`

为 AST 类添加成员函数能够有效提升代码可读性和开发效率。所有扩展均可通过直接编辑 `cool-tree.h` 等头文件完成，无需修改自动生成的 APS 定义。