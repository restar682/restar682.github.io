---
title: CS143-PA4：Semantic Analysis
date: 2025-08-17 12:26:16
categories: CS143
description: CS143 PA4：实现 Cool 语言的语义分析器。
tags: [编译原理, Linux, CS143, 语义分析, 类型检查]
---
> 前排提醒：本文采用 C++ 实现，如果使用 java 建议参考其他文章。

# 语义分析
## 准备工作
本次作业的目标是：实现一个可以给正确的 AST 添加类型注释的语义分析器。

在 `assignments/PA4` 目录下执行命令：

```bash
make semant
```

会生成一个名为 `semant` 的可执行文件，可以通过运行 `./mysemant test.cl` 来对指定文件进行词法分析。这里的 `mysemant` 同样也是一个 `csh` 脚本，如果用的是 `bash` 的话也需要将开头的 `csh` 改成 `bash`，或者直接运行

```bash
./lexer test.cl | ./parser | ./semant
```

在语义分析过程中，`semant-phase.cc` 提供程序入口，负责驱动并测试语义分析器；`cool-tree.aps` 定义 AST 结构，并自动生成 `cool-tree.h` 与 `cool-tree.cc` 以支持树节点的构造与处理；`symtab.h` 提供了一个符号表的实现，剩下的 `ast-lex.cc` 和 `ast-parse.cc` 等文件为辅助代码，不需要修改。

回到 PA4，我们的核心任务是完善 `semant.h` 和 `semant.cc` 文件，实现正确的类型检查逻辑，并为 AST 节点添加相应的类型注释，同时使用作业提供的方法来报告错误。此外，我们还需要在 `cool-tree.h` 中为 AST 类添加必要的方法，以支持类型信息的存储、查询与计算。

需要注意的是，`cool-tree.cc` 包含了已提供方法的定义以及列表处理函数模板的实例化，但我们**不得修改**该文件，在 `cool-tree.h` 中新增的方法，其具体实现必须放在 `semant.cc` 中。

同时，还要注意 `cool-tree.handcode.h` 与 PA3 中提供的版本相比已有调整，应以当前版本为准。
## 实现
> 在开始之前，建议先阅读 `handouts/cool-manual` 的第三、八节和第十二节，分别详细介绍了 Cool 的类型和类型规则。同时，推荐仔细阅读所有用到的文件，以便理解程序逻辑。

### 类的继承关系
在进行类型检查之前，我们需要先对类的继承关系进行初步的分析和处理，我们采用两个类来实现这一点。

`ClassNode` 用于表示单个类节点，而 `ClassTable` 负责收集所有类声明，构建全局符号表。在此基础上，它依据继承关系构造类继承树，并进行继承合法性检查，包括检测循环继承和对未定义类的继承等错误。
```cpp
class ClassNode : public class__class{
  private:
    Inheritable inherit_status;
    Basicness basic_status;
    Reachable reach_status;
    ClassNodeP parent_class;
    LClassNodeP children;
    EnvironmentP environment;

  public:
    ClassNode(Class_ nd, Inheritable inherit, Basicness basic);
    Symbol get_name();
    Symbol get_parent();
    Symbol get_filename();
    void check_main_method();
    void set_parent(ClassNodeP par);
    void add_children(ClassNodeP now);
    void reach_children();
    void build_self_feature_tables();
    void init_env(ClassTableP table);
    void copy_env(EnvironmentP env);
    void check_type();
    int basic() {return basic_status == Basic;}
    int inherit() {return inherit_status == CanInherit;}
    int reach() {return reach_status == CanReach;}
    ClassNodeP get_parent_class_nd();
    method_class* method_lookup(Symbol sym);

};

// 继承单纯为了嫖那个查找功能
// 呃，我也不知道为什么我不用 map
class ClassTable : public SymbolTable<Symbol, ClassNode>{
  private:
    int semant_errors;
    LClassNodeP node_head; // 遍历入口
    void install_basic_classes();
    void install_class(ClassNodeP nd);
    void install_classes(Classes classes);
    void check_main();
    void handle_inherit();
    void check_inherit();
    void build_inherit_tree();
    void check_class_loop();
    void build_all_feature_tables();
    ostream& error_stream;

  public:
    ClassTable(Classes);
    int errors() { return semant_errors; }
    ClassNodeP root();
    ostream& semant_error();
    ostream& semant_error(Class_ c);
    ostream& semant_error(Symbol filename, tree_node *t);
};
```

具体来说，我们先将所有的类安装到 `ClassTable` 中，然后再单独处理继承关系。
```cpp
// 无论如何都得先进一层全局作用域才能添加id
enterscope();
// 先安装基本类
install_basic_classes();
// 然后安装用户的类
install_classes(classes);
// 再处理继承关系
handle_inherit();
```

继承关系的处理也并不复杂，在检查完所有类的继承关系是否合法之后，就可以建立继承树，最后判断有没有环即可。因为 Cool 语言中我们有唯一的树根 `Object` 类，所以会简单一些，只要看有没有 `Object` 类到达不了的节点就行了。
```cpp
void ClassTable::handle_inherit() {
    // 先检查一手
    check_inherit();
    // 然后建树
    if(errors()) return;
    build_inherit_tree();
    // 最后判环
    check_class_loop();
}
```

### 构建特性表
特性表的构建需要用到环境，或者说在这个阶段把特性表绑定到环境里面会比较方便。环境包括方法表、属性表、类表和当前类，类表和当前类已经处理完，我们目前需要处理方法表和属性表。

```cpp
class Environment {
  private:
    SymbolTable<Symbol, method_class> method_table;
    SymbolTable<Symbol, Entry> var_table;
    ClassTableP class_table; // 引用类表，方便查找
    ClassNodeP self_class;

  public:
    Environment(SymbolTable<Symbol, method_class> met, SymbolTable<Symbol, Entry> var, ClassTableP table, ClassNodeP now_class);
    Environment(ClassTableP table, ClassNodeP now_class);
    EnvironmentP clone_env(ClassNodeP self);

    ostream& semant_error();
    ostream& semant_error(tree_node* t);
    ClassNodeP lookup_class(Symbol sym);

    void method_add(Symbol sym, method_class* method);
    method_class* method_lookup(Symbol sym);
    method_class* method_probe(Symbol sym); // 嗯，method不需要进出作用域

    void var_add(Symbol sym, Symbol var);
    Symbol var_lookup(Symbol sym);
    Symbol var_probe(Symbol sym);
    void var_enterscope();
    void var_exitscope();

    Symbol get_self_type();

    void check_main_method();

    int type_leq(Symbol type_a, Symbol type_b);
    Symbol type_lub(Symbol type_a, Symbol type_b);
};
```

我们从根开始，先初始化环境，然后沿着继承树向下建立特性表。

```cpp
void ClassTable::build_all_feature_tables() {
    root()->init_env(this);
    root()->build_self_feature_tables();
}
```

我们每个继承树节点都将本节点的特性加入环境中，然后传递到所有子节点中，注意需要构建新环境，不要直接复制指针。
```cpp
void ClassNode::build_self_feature_tables() {
    for(int i = features->first(); features->more(i); i = features->next(i))
        features->nth(i)->add_to_table(environment);
    for(LClassNodeP i = children; i; i = i->tl()) {
        i->hd()->copy_env(environment);
        i->hd()->build_self_feature_tables();
    }
}
```

### 类型检查
重头戏当然是类型检查，不过主要是比较繁琐，加上要处理每种表达式的类型检查，所以写起来比较麻烦。但跟着 Cool 第十二节还是相当清晰的。（~~不过有几个命名跟类名不一样找了我好久~~）
```cpp
void ClassNode::check_type() {
    for(int i = features->first(); features->more(i); i = features->next(i))
        features->nth(i)->tc(environment);   
    for(LClassNodeP i = children; i; i = i->tl())
        i->hd()->check_type();
}
```

# 小结
PA4 难度激增，主要是自由度陡然增大带来的，而且对 C++ 面向对象的要求也比较高（当然可以不面向对象，但那样显然不够工程化，跟接口也不搭）。实现加调试一共花了四天的时间，呃，跟前几个好像没多大差别（~~看来是前几个 PA 太划水了~~）。不过回过头看，这次的实现逻辑其实非常清晰，这很大程度上得益于框架提供的完善接口。此外，我也参考了 GitHub 上一些其他同学的代码，其中一些思路清晰、结构清晰的实现对我帮助很大，用三个类来实现的思想也是从中得到的启发。总之，这个 PA 让我受益匪浅，尤其是面向对象现在熟练了很多。

快乐地贴一个通关截图：

<figure style="text-align: center;">
  <img src="/illustrations/CS143-PA/PA4.png" alt="通关截图" width="100%">
  <figcaption>通关截图</figcaption>
</figure>