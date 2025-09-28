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

我们还需要生成原型对象，开始我觉得跟常量的生成没有太大差别，属性的个数遍历一遍自己的成员表即可。但在 DEBUG 的过程中，我发现原型对象其实并不能简单地全部在属性位置地址赋0，会导致未初始化的属性被使用的情况，此时会报错。我们需要在生成原型的时候就对 Int,String,Bool 三个类型的属性赋初值（0），这样才不会出现初始化调用的方法使用了还未初始化的属性的情况。

```cpp
void CgenNode::code_prototype_table(ostream &str)
{
  if(name == Str)
  {
    str << WORD << "-1" << endl
        << STRINGNAME << PROTOBJ_SUFFIX << LABEL
        << WORD << class_tag << endl
        << WORD << (DEFAULT_OBJFIELDS + STRING_SLOTS + 1) << endl
        << WORD << STRINGNAME << DISPTAB_SUFFIX << endl
        << WORD << INTCONST_PREFIX << 1 << endl;
    emit_string_constant(str,""); 
    str << ALIGN;
  }
  else
  {
    str << WORD << "-1" << endl
        << name << PROTOBJ_SUFFIX << LABEL
        << WORD << class_tag << endl
        << WORD << (DEFAULT_OBJFIELDS + attr_num) << endl
        << WORD << name << DISPTAB_SUFFIX << endl;
    for (LEntryP l = attr_table; l; l = l->tl())
    {
        Symbol type_decl = attr_type_table[l->hd()];
        if(type_decl == Int || type_decl == Str || type_decl == Bool)
          str << WORD << type_decl << PROTOBJ_SUFFIX << endl;
        else
          str << WORD << 0 << endl;
    }
  }
  for(LCgenNodeP l = children; l; l = l->tl())
    l->hd()->code_prototype_table(str);
}
```

### 输出全局表
我们需要输出 `class_nameTab`、`class_objTab`和调度表（dispatch tables），前两个差别不大，关键在于调度表。为此，我们需要整理出每个类的方法，然后拼凑出调度表。我们按照继承树进行前序遍历，那么每个类构建调度表前其父类已构建完，我们可以复制过来，然后进行修改即可。

首先为了之后查找属性和方法方便，我们需要对二者进行分离。我们会先记录属性表，并同时保存每个属性对应的类型，这样在初始化原型对象时，就能更方便地为基本类型赋初值。基本思路是每次复制父类的属性表和类型表，然后直接添加即可。因为属性不能覆写，所以不需要进行额外处理。
```cpp
void CgenNode::build_attr_table(int flag)
{
  if(name != Object)
  {
    LEntryP pa_attr_table = parentnd->get_attr_table();
    attr_type_table = parentnd->get_attr_type_table();
    for(LEntryP l = pa_attr_table; l; l = l->tl())
    {
      attr_table = new_lnode(attr_table, l->hd());
      attr_num++;
    }
  }
  for(int i = features->first(); features->more(i); i = features->next(i))
  {
    Feature curr_feature = features->nth(i);
    attr_type_table[curr_feature->get_name()] = curr_feature->get_type_decl();
    if (curr_feature->attr_flag() == flag) // 我们 PA5 都在 cool-tree.handcode.h 里面定义，不过 PA4 是 cool-tree.h 里面
    {
      attr_table = new_lnode(attr_table, curr_feature->get_name());
      attr_num++;
    }
  }
}
```

我们用 `method_table` 来记录当前类能够使用的所有方法，`pa_method_table` 来记录方法具体来自于哪个类。如果该方法在父类中已经存在则覆写以实现多态，只需修改方法来源即可，否则需要添加进方法表，并且记录方法来源。方法表会稍微麻烦一些，因为允许不加声明地覆写父类的方法，所以我们不得不每次查调度表看有没有这个方法，有就直接覆写，没有就新建。
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

### 初始化各个类
在类的初始化过程中，原型对象的属性已经具备默认初值，因此只需依次调用各属性的初始化代码并将结果保存即可。需要注意的是，如果 Cool 代码中未显式初始化某个属性，编译器会调用 `no_expr_class::code`，其返回地址为 0，此时我们不能用该结果覆盖已有的初值。
```cpp
void CgenNode::code_init_func(ostream &str, CgenClassTableP curr_class_table, int &label_index)
{
  str << name->get_string() << CLASSINIT_SUFFIX << LABEL;
  emit_addiu(SP, SP, -16, str);              // 分配栈空间
  emit_store(FP, 4, SP, str);                // 保存帧指针
  emit_store(SELF, 3, SP, str);              // 保存 self 指针  
  emit_store(S1, 2, SP, str);                // 保存寄存器
  emit_store(RA, 1, SP, str);                // 保存返回地址
  emit_addiu(FP, SP, 4, str);                // 设置新帧指针
  emit_move(SELF, ACC, str);                 // self = 传入的对象指针
  if(name != Object)
  {
    str << JAL << parentnd->get_name() << CLASSINIT_SUFFIX << endl;
    int curr_attr_num = parentnd->get_attr_num() + 3;
    for (int i = features->first(); features->more(i); i = features->next(i))
    {
      Feature curr_feature = features->nth(i);
      if (curr_feature->attr_flag())
      {
        curr_feature->get_init()->code(str, this, curr_class_table, label_index);  // 生成初始化代码
        emit_beqz(ACC, ++label_index, str);
        emit_store(ACC, curr_attr_num++, SELF, str);  // 存储到对象的属性槽
        emit_branch(label_index, str);
        emit_label_def(label_index, str);
      }
    }
  }
  emit_move(ACC, SELF, str);        // 返回值 = self
  emit_load(FP, 4, SP, str);        // 恢复寄存器
  emit_load(SELF, 3, SP, str);
  emit_load(S1, 2, SP, str);
  emit_load(RA, 1, SP, str);
  emit_addiu(SP, SP, 16, str);      // 回收栈空间
  emit_return(str);                 // 返回
  for(LCgenNodeP l = children; l; l = l->tl())
    l->hd()->code_init_func(str, curr_class_table, label_index);
}
```

### 各个方法的代码生成
首先得注意基本类的方法是不需要我们写的，因此我们只需要生成非基本类的方法代码。我们每次把参数压栈，处理完方法的初始化代码后弹栈然后返回即可。
```cpp
void method_class::code_method(ostream& str, CgenNodeP curr_node, CgenClassTableP curr_class_table, int& label_index)
{
  str << curr_node->get_name() << "." << name << LABEL;
  emit_addiu(SP, SP, -16, str);
  emit_store(FP, 4, SP, str);  
  emit_store(SELF, 3, SP, str);
  emit_store(S1, 2, SP, str);
  emit_store(RA, 1, SP, str);  
  emit_addiu(FP, SP, 4, str); 
  emit_move(SELF, ACC, str); 
  for (int i = formals->first(); formals->more(i); i = formals->next(i))
    curr_node->add_formal_node(formals->nth(i)->get_name());
  expr->code(str, curr_node, curr_class_table, label_index);
  emit_load(FP, 4, SP, str);
  emit_load(SELF, 3, SP, str);
  emit_load(S1, 2, SP, str);
  emit_load(RA, 1, SP, str);
  emit_addiu(SP, SP, 16, str);
  for(int i = formals->first(); formals->more(i); i = formals->next(i))  // 这里要弹栈！！！
    emit_addiu(SP, SP, 4, str);
  emit_return(str);  // 弹完再返回！！！
  curr_node->remove_formal_node();
}
```

### 表达式的代码生成
表达式太过复杂，所以我们这里只提一下我在 DEBUG 过程中遇到的一些问题：
1. `type` 是语义分析时得到的静态类型，不要用它去比较两个表达式类型是否相同；
2. `let` 表达式赋值是跟 `assign` 无关的，所以 `let` 里面要单独处理赋值，而且要特别处理 Int,String,Bool 三个类的初始化；
3. 条件判断、求值都得先取数值，要分清数值和地址的区别；
4. 调度的时候要特别处理 SELF_TYPE，不能直接用它去找调度指针；
5. 就算是动态分配也不能通过函数名直接跳到函数，还是得查调度表，不然可能这个函数是继承来的然后没有定义；
6. 方法要先弹栈再返回；
7. 最重要的是时刻要注意 load 的地址有没有可能还是 0，如果我写代码的时候时刻注意这一点，有很多地方本该第一次写对的，DEBUG 确实浪费了挺多时间。

# 小结
至此，5个 PA 全部完成（PA5 我没写垃圾回收，所以可能会爆栈，但已经实现了正确的代码生成），还是蛮不容易的。前三个 PA 就是对着语法规范抄就行，但最后两个 PA 确实相当困难，尤其是 PA5 没参考其他人的代码更显困难，细节相当的多，修改一个地方很可能只多对一个小测试点，这也体现出测试集相当的全面。仅仅是 DEBUG 部分就花了我三天时间，整个 PA 花了一个星期，着实是不容易，不过总算是完成了！这个 PA 让我现在对内存空间有了更加深刻的理解，彻底理解了虚函数和调度，面向对象也熟练了许多，尤其是对汇编的理解大大提升了，从一开始完全不了解到现在能够完成从 AST 到汇编的完整转换，确实是不容易啊o(*￣▽￣*)ブ

照例贴一个通关截图：

<figure style="text-align: center;">
  <img src="/illustrations/CS143-PA/PA5.png" alt="通关截图" width="100%">
  <figcaption>通关截图</figcaption>
</figure>