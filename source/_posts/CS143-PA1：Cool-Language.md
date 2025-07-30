---
title: CS143-PA1：Cool-Language
date: 2025-07-30 00:04:38
categories: CS143
description: CS143 PA1：实现 Cool 语言的一个栈机器
tags: [编译原理, Linux, CS143]
---
## 代码实现
Cool 语言跟 Java 相当相似，语法简单清晰，强调类型和类结构。PA1 要求实现一个简单的栈机器，目的是熟悉语言，但有几个需要注意的地方：

1. 每个类方法都由表达式定义，求值结果即为方法的返回值。因此，常见的写法是在大括号中嵌套代码块，代码块内部用 `;` 分隔表达式。类方法定义结束后，需在闭合大括号 `}` 之后添加分号 `;`。

2. `if`、`while` 等控制结构本质上也是表达式，具有返回值，并且结构比较严格。如果要包含多个表达式作为分支体或循环体，需使用代码块 `{}` 包裹，写法上与类方法类似。

3. 局部变量必须使用 `let` 关键字进行定义，不能直接赋值给未声明的变量。

实现比较简单，我们用 `StackNode` 类来实现栈，每个节点储存命令信息和下一个节点的地址。注意 Cool 语言强制属性为 private，方法为 public，因此只能通过方法来访问属性。

```cool
class StackNode{
   command: StackCommand;
   next: StackNode;

   init(co:StackCommand, ne:StackNode): StackNode{
      {
         command <- co;
         next <- ne;
         self;
      }
   };

   getCommand(): StackCommand {
      command
   };

   getNext(): StackNode {
      next
   };

   setNext(node: StackNode): StackNode {
      next <- node
   };

   putOnTop(co: StackCommand): StackNode {
      let newNode: StackNode in {
         newNode <- (new StackNode).init(co, self);
         newNode;
      }
   };
};
```

然后实现命令，用 `StackCommand` 作为模板，每个命令或是返回数字，或是返回符号，或是执行命令。
```cool
class StackCommand{
   execute(node:StackNode): StackNode{
      let err: StackNode in{
         (new IO).out_string("Undefined Execution!");
         err;
      }
   };

   getNumber(): Int {
      0
   };

   getChar(): String {
      "Called from base class"
   };
};
```

分别实现三种命令，注意 `if` 指令要完整。

```class IntCommand inherits StackCommand {
   number: Int;

   init(num: Int): SELF_TYPE{
      {
         number <- num;
         self;
      }
   };

   execute(node:StackNode): StackNode{
      node
   };

   getNumber(): Int {
      number
   };

   getChar(): String {
      (new A2I).i2a(number)
   };
};

class PlusCommand inherits StackCommand {
   init(): SELF_TYPE{
      self
   };

   execute(node:StackNode): StackNode{
      let n1: StackNode <- node.getNext(),
         n2: StackNode <- n1.getNext(),
         sum: Int,
         ret: StackNode in{
            if (not (isVoid n1)) then
               if (not (isVoid n2)) then{
                  sum <- n1.getCommand().getNumber() + n2.getCommand().getNumber();
                  ret <- (new StackNode).init((new IntCommand).init(sum), n2.getNext());
               }
               else
                  0
               fi
            else
               0
            fi;
            ret;
      }
   };

   getChar(): String {
      "+"
   };
};

class SwapCommand inherits StackCommand {
   init(): SELF_TYPE{
      self
   };

   execute(node:StackNode): StackNode{
      let n1: StackNode <- node.getNext(),
         n2: StackNode <- n1.getNext(),
         ret: StackNode in{
            node <- n1;
            node.setNext(n2.getNext());
            n2.setNext(node);
            n2;
      }
   };

   getChar(): String {
      "s"
   };
};
```

最后实现 `main` 函数，根据要求进行调用即可：
```
class Main inherits A2I {
   stackTop: StackNode;

   printStack(): Object {
      let node: StackNode <- stackTop in {
         while (not (isvoid node)) loop
         {
            (new IO).out_string(node.getCommand().getChar());
            (new IO).out_string("\n");
            node <- node.getNext();
         }
         pool;
      }
   };

   pushCommand(command: StackCommand): StackCommand {
      {
         if (isvoid stackTop) then {
            let nil: StackNode in {
               stackTop <- (new StackNode).init(command, nil);
            };
         } else {
            stackTop <- stackTop.putOnTop(command);
         } fi;
         command;
      }
   };

   executeStack(inString: String): Object {
      {
         if (inString = "+") then
         {
            pushCommand((new PlusCommand).init());
         }
         else
            if (inString = "s") then
               pushCommand((new SwapCommand).init())
            else
               if (inString = "d") then
                  printStack()
               else
                  if (inString = "x") then
                     -- stop
                     {
                        (new IO).out_string("stop!\n");
                        abort();
                     }
                  else
                     if (inString = "e") then
                        let node: StackNode <- stackTop in {
                           if (not (isvoid node)) then
                              stackTop <- node.getCommand().execute(node)
                           else
                              0
                           fi;
                        }
                     else
                        pushCommand((new IntCommand).init((new A2I).a2i(inString)))
                     fi
                  fi
               fi
            fi
         fi;
      }
   };

   main() : Object {
      let inString: String in {
         while (true) loop
         {
            (new IO).out_string(">");
            inString <- (new IO).in_string();
            executeStack(inString);
         }
         pool;
      }
   };
};
```

## 小结
代码没啥复杂度，写的目的单纯是为了属性 Cool 语言