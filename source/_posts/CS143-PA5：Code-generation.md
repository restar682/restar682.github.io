---
title: CS143-PA5：Code generation
date: 2025-09-20 17:43:11
categories: CS143
description: CS143 PA5：实现 Cool 语言的代码生成器。
tags: [编译原理, Linux, CS143, 代码生成]
---
# 代码生成
## 准备工作
本次作业的目标是：实现一个可以将带有类型注释的 AST 翻译为 MIPS 代码的代码生成器。

在 `assignments/PA5` 目录下执行命令：

```bash
make cgen
```

会生成一个名为 `cgen` 的可执行文件，可以通过运行 `./mycoolc test.cl` 来对指定文件进行代码生成。这里的 `mycoolc` 还是个 `csh` 脚本，如果用的是 `bash` 的话也需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser | ./semant | ./cgen
```

在代码生成阶段，`cgen-phase.cc` 提供了编译器驱动，`symtab.h` 提供了符号表实现，`cgen_supp.cc` 提供了一些可以用在代码生成器中的辅助函数，`emit.h` 定义了生成 MIPS 指令时常用的宏（这个文件当然可以修改）。其余文件均为辅助代码，无需改动。

回到 PA5，我们的核心任务是完善 `cgen.h` 和 `cgen.cc` 文件，实现面向对象代码的汇编生成。`cgen.cc` 作为框架，已经事先提供了三个部分：  

- 构建继承图的函数；  
- 输出全局数据和常量的函数；  
- 输出 MIPS 指令的函数。

~~嗯，框架就有 1000 多行呢。~~不过好在代码生成过程中不需要再检查输入是否错误，因为所有错误的 Cool 程序都已被编译器前端阶段检测到了。但我们仍然需要插入运行时错误检查代码，保证程序在遇到非法操作时能输出错误信息并终止。

那么接下来，我们将面对的就是最后一个 Assignment，也是最复杂的一个 Assignment，祝你，也祝我自己好运~
## 实现
> 在开始之前，建议先阅读 `handouts/cool-tour` 的第七节，详细介绍了 Cool 语言的操作语义和运行时系统。也推荐仔细阅读所有用到的文件，这可能会让你的编码工作简单不少。已经提供的代码或许写法比较奇怪，不过还是建议耐心阅读。

### 输出全局常量
输出常量只需要我们对原有的代码进行一些小的修补即可，参考标准编译器得到的代码我们可以很容易地补全调度指针的信息，比如 Int 的调度指针只需修改 `code_def` 为以下代码：
```cpp
void IntEntry::code_def(ostream &s, int intclasstag)
{
  // Add -1 eye catcher
  s << WORD << "-1" << endl;

  code_ref(s);
  s   << LABEL                                            // label
      << WORD << intclasstag << endl                      // class tag
      << WORD << (DEFAULT_OBJFIELDS + INT_SLOTS) << endl  // object size
      << WORD << INTNAME << DISPTAB_SUFFIX << endl;       // dispatch table
      << WORD << str << endl;                             // integer value
}
```

我们还需要生成原型对象，跟常量的生成没有太大差别，属性的个数遍历一遍自己的成员表即可：
```cpp
void CgenNode::code_prototype_table(ostream &str)
{
  str << WORD << "-1" << endl
      << name->get_string() << PROTOBJ_SUFFIX << LABEL
      << WORD << class_tag << endl
      << WORD << (DEFAULT_OBJFIELDS + get_attr_num()) << endl
      << WORD << name->get_string() << DISPTAB_SUFFIX << endl;
  for(LCgenNodeP l = children; l; l = l->tl())
    l->hd()->code_prototype_table(str);
}
```

### 输出全局表
我们需要输出 `class_nameTab`、`class_objTab`和调度表（dispatch tables），前两个差别不大，关键在于调度表。为此，我们需要整理出每个类的方法，然后拼凑出调度表。我们按照继承树进行前序遍历，那么每个类构建调度表前其父类已构建完，我们可以复制过来，然后进行修改即可。

我们用 `method_table` 来记录当前类能够使用的所有方法，`pa_method_table` 来记录方法具体来自于哪个类。如果该方法在父类中已经存在则覆写以实现多态，只需修改方法来源即可，否则需要添加进方法表，并且记录方法来源。
```cpp
void CgenNode::build_method_table(int flag)
{
  if(name != Object)
  {
    method_symbol_table = parentnd->get_method_symtab();
    LEntryP pa_method_table = parentnd->get_method_table();
    for(LEntryP l = pa_method_table; l; l = l->tl())
    {
      method_table = new_lnode(method_table, l->hd());
      method_num++;
    }
  }
  for(int i = features->first(); features->more(i); i = features->next(i))
  {
    Feature curr_feature = features->nth(i);
    if (curr_feature->attr_flag() == flag) // 这里还是 attr_flag,差点全改了）
    {
      if(method_symbol_table.count(curr_feature->get_name()))
      {
        method_symbol_table[curr_feature->get_name()] = name; // 只要改调度表名字
      }
      else
      {
        method_table = new_lnode(method_table, curr_feature->get_name());
        method_symbol_table[curr_feature->get_name()] = name;
        method_num++;
      }
    }
  }
}
```