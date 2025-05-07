---
title: gdb命令简述
date: 2025-03-23 15:14:52
categories: 工具
tags: [gdb, 命令]
---
# gdb（GNU 调试器）

## 基本用法
gdb 是一个强大的调试工具，允许用户调试 C、C++ 等程序。使用 gdb 可以让你在程序运行时检查和修改程序状态、查看变量值、设置断点、单步执行等。

```bash
gdb [选项] [可执行文件]
```
[选项]：可选的 gdb 命令行选项。  
[可执行文件]：要调试的程序的可执行文件。

当不输入任何内容按下回车键时，会再次执行上一次输入的调试指令。

### 常见操作
- **1. `quit`**：
  - **功能**：退出 gdb。
  - **用法**：
    ```bash
    (gdb) quit
    ```
  - **示例**：
    ```bash
    (gdb) quit
    ```

- **2. `run`**：
  - **功能**：启动调试的程序。
  - **用法**：
    ```bash
    (gdb) run
    ```
  - **示例**：
    ```bash
    (gdb) run
    ```
- **3. `watch`**：
  - **功能**：设置监视点，当指定的表达式值发生变化时，程序会暂停。
  - **用法**：
    ```bash
    (gdb) watch <表达式>
    ```
  - **示例**：
    ```bash
    (gdb) watch x
    ```
    当变量 `x` 的值发生变化时，程序会暂停。

- **4. `break系列`**：
  - **功能**：
    - `break`

      在指定行或函数设置断点，程序执行到断点处会暂停。
    - `tbreak`

      设置临时断点，仅在第一次执行时暂停，之后自动删除。

    -  `break + if`
 
        设置带条件的断点，只有在条件满足时才暂停。
  - **用法**：
    ```bash
    (gdb) break <位置>
    (gdb) tbreak <位置>
    (gdb) break <位置> if <条件>
    ```
  - **示例**：
    ```bash
    (gdb) break main.c:10  # 在 main.c 的第 10 行设置断点
    (gdb) break foo        # 在函数 foo 开始处设置断点
    (gdb) tbreak main  # 在函数 main 入口处设置一个临时断点，执行到达时暂停一次，之后断点自动移除
    (gdb) break foo if x > 10  # 只有 x > 10 时才在 foo 函数暂停
    ```
- **5. `ignore`**：
  - **功能**：忽略断点的命中次数，直到达到指定次数时才暂停。
  - **用法**：
    ```bash
    (gdb) ignore <断点编号> <次数>
    ```
  - **示例**：
    ```bash
    (gdb) ignore 1 5
    ```
    忽略编号为 `1` 的断点前 5 次的命中，之后再暂停。
- **6. `delete`**：
  - **功能**：删除指定的断点或监视点。
  - **用法**：
    ```bash
    (gdb) delete <断点编号>
    ```
  - **示例**：
    ```bash
    (gdb) delete 1  # 删除编号为 1 的断点
    (gdb) delete    # 删除所有断点
    ```
    该命令可以用来删除一个或多个断点，也可以删除所有设置的断点。
- **7. `next/ni`**：
  - **功能**：单步执行源代码行/单步执行汇编指令，但是不进入函数。
  - **用法**：
    ```bash
    (gdb) next
    ```

- **8. `step/si`**：
  - **功能**：单步执行源代码行/单步执行汇编指令，如果遇到函数会进入函数内部。
  - **用法**：
    ```bash
    (gdb) step
    ```

- **9. `continue`**：
  - **功能**：继续程序的执行，直到下一个断点。
  - **用法**：
    ```bash
    (gdb) continue
    ```
- **10. `until`**：
  - **功能**：继续执行程序，直到到达指定行或返回调用函数。
  - **用法**：
    ```bash
    (gdb) until <行号>
    ```
  - **示例**：
    ```bash
    (gdb) until 25
    ```
    继续执行，直到程序执行到第 25 行时暂停。

- **11. `print`**：
  - **功能**：查看指定变量的值。
  - **用法**：
    ```bash
    (gdb) print <变量名>
    ```
  - **示例**：
    ```bash
    (gdb) print x
    (gdb) p/x *argv@2   # 十六进制格式打印argv的两个指针的内容
    ```

- **12. `examine`**：  
  - **功能**：查看内存地址或寄存器中的原始数据（二进制、数值、字符串或汇编指令）。  
  - **语法**：  
    ```bash  
    (gdb) x/[数量][格式][单位] <地址表达式>  
    ```
    - **参数详解**：  
<table>
  <tr>
    <th>参数</th>
    <th>可选值</th>
    <th>说明</th>
  </tr>
  <tr>
    <td><strong>数量</strong></td>
    <td>正整数（默认为1）</td>
    <td>指定显示的数据项数量</td>
  </tr>
  <tr>
    <td><strong>格式</strong></td>
    <td><code>x</code>(十六进制)、<code>d</code>(十进制)、<code>s</code>(字符串)、<code>i</code>(指令)、<code>c</code>(字符) 等</td>
    <td>控制数据显示形式</td>
  </tr>
  <tr>
    <td><strong>单位</strong></td>
    <td><code>b</code>(1字节)、<code>h</code>(2字节)、<code>w</code>(4字节)、<code>g</code>(8字节)</td>
    <td>定义每个数据项的大小</td>
  </tr>
  <tr>
    <td><strong>地址</strong></td>
    <td>寄存器（如 <code>$a1</code>）、绝对地址（如 <code>0xde4</code>）、符号（如 <code>main</code>）</td>
    <td>要查看的地址或表达式</td>
  </tr>
</table>

  - **示例**：  
    1. **查看寄存器指向的字符串**：  
       ```bash  
       (gdb) x/2c $a1          # 从寄存器 a1 的地址读取 2 个字符  
       # 输出示例：0x7ffff0: 65 'A' 66 'B'  
       ```
    2. **反汇编代码**：  
       ```bash  
       (gdb) x/3i 0x8048000    # 查看地址 0x8048000 处的 3 条汇编指令  
       # 输出示例：  
       # 0x8048000: addi a0, zero, 42  
       # 0x8048004: jal ra, 0x8048020  
       # 0x8048008: lw t0, 0(sp)  
       ```
    3. **混合参数查看内存**：  
       ```bash  
       (gdb) x/4xw main+0x10   # 查看 main 函数偏移 0x10 处的 4 个字（4字节一组），十六进制显示  
       # 输出示例：  
       # 0x8048010: 0x12345678 0x9abcdef0  
       # 0x8048018: 0xdeadbeef 0xcafebabe  
       ```
  - **注意事项**：  
    - 默认沿用上次参数（如上次用 `x/4xw`，直接输入 `x 0x1000` 等效于 `x/4xw 0x1000`）。  
    - 查看指令时地址需按架构对齐（如 RISC-V 指令需 4 字节对齐）。  
    - 字符串格式（`s`）会持续输出直到遇到 `0x00` 终止符。  

- **13. `backtrace`**：
  - **功能**：显示程序的调用栈帧。
  - **用法**：
    ```bash
    (gdb) backtrace
    ```
  - **示例**：
    ```bash
    (gdb) backtrace
    ```

- **14. `list`**：
  - **功能**：查看当前执行位置附近的源代码。
  - **用法**：
    ```bash
    (gdb) list
    ```
  - **示例**：
    ```bash
    (gdb) list 10 # 显示第 10 行及其附近的代码
    (gdb) list main # 显示 main 函数中的代码
    ```

- **15. `finish`**：
  - **功能**：让当前函数执行到结束，然后暂停并返回到调用该函数的地方。
  - **用法**：
    ```bash
    (gdb) finish
    ```
  - **说明**：如果你正在函数内部调试，而不想逐步跟踪整个函数，可以使用 `finish` 跳过该函数。

- **16. `tui`**：  
  - **功能**：TUI（文本用户界面）模式允许在调试过程中同时查看源代码、汇编代码和寄存器等调试信息，提供更直观的调试体验。  
  - **相关命令**：  
    - `tui enable`：启用 `gdb` 的文本用户界面（TUI）模式。  
    - `tui disable`：关闭 TUI 模式，返回普通的命令行界面。  
    - `tui status`：查看 TUI 模式的当前状态（启用或禁用）。  

- **17. `layout`**：  
  - **功能**：切换或显示不同的 TUI 布局（布局包括源代码、汇编代码、寄存器等）。  
  - **用法**：  
    ```bash  
    (gdb) layout <模式>  
    ```
  - **常见的 layout 模式**：  
    - `src`：显示源代码。  
    - `asm`：显示汇编代码。  
    - `split`：源代码和汇编代码分屏显示。  
    - `reg`：显示寄存器信息。  
  - **示例**：  
    ```bash  
    (gdb) layout src  
    ```
- **18. `focus`**：  
  - **功能**：在 TUI 模式下切换当前焦点窗口（如源代码窗口、寄存器窗口等），用于操作特定窗口（如滚动查看内容）。  
  - **用法**：  
    ```bash  
    (gdb) focus <窗口名>   # 直接切换焦点  
    (gdb) focus next       # 切换到下一个窗口  
    (gdb) focus prev       # 切换到上一个窗口  
    ```
  - **常见窗口名**：  
    - `src`：源代码窗口  
    - `asm`：汇编代码窗口  
    - `reg`：寄存器窗口

- **19. `info`**：  
  - **功能**：查看程序运行时的详细信息（如寄存器值、断点列表、线程状态等），与 TUI 窗口内容互补。  
  - **用法**：  
    ```bash  
    (gdb) info <参数>  
    ```
  - **常用参数**：  
    - `registers`：显示所有寄存器的当前值（即使未启用 `reg` 布局）。  
    - `breakpoints`：列出所有断点及其状态。  
    - `frame`：显示当前函数调用栈帧的详细信息（如寄存器值、局部变量、返回地址等）。  
    - `args`：显示当前函数的参数及其值。  
    - `threads`：列出所有线程及其状态信息。
  - **示例**：  
    ```bash  
    (gdb) info registers   # 查看寄存器内容  
    ```

- **20. `<Ctrl-x>`**：  
  - **功能**：gdb TUI 模式的控制命令前缀。  
  - **常见的组合**：  
    - `Ctrl-x o`：切换 TUI 窗口焦点（等同于 `focus next`）。
    - `Ctrl-x 2`：在 TUI 模式下分屏显示。  
    - `Ctrl-x a`：激活/禁用汇编代码窗口。  

- **21. `refresh`**：  
  - **功能**：刷新 TUI 模式下的显示。  
  - **用法**：  
    ```bash  
    (gdb) refresh  
    ```
  - **说明**：当 TUI 模式下屏幕显示异常（如内容错乱）时，使用 `refresh` 重新绘制界面。  

### 调试常见问题

**符号调试**  
如果编译时没有使用 `-g` 选项生成调试信息，gdb 可能无法显示变量的值和源代码。因此，要在编译时加上 `-g` 选项：

```bash
gcc -g -o program program.c
```

常用选项：
- `-g`：生成调试信息，允许在 gdb 中查看源码。
- `-q`：禁止 gdb 输出启动信息。
- `-tui`：启动 gdb 的文本用户界面模式，提供更好的界面体验。

### 例子：调试一个简单的 C 程序
```bash
gcc -g -o test test.c  # 编译并生成调试信息
gdb test              # 启动 gdb 调试 test 程序
(gdb) break main      # 设置断点
(gdb) run             # 运行程序
(gdb) next            # 单步执行
(gdb) print x         # 打印变量 x 的值
(gdb) quit            # 退出 gdb

```
### 调试大程序的技巧

1. 条件断点

2. 自定义函数查看复杂数据结构
```
void display_2Darray(int a[][len])
{
  int i, j;
  for(i = 0; i < len; i++)
    for(j = 0; j < len; j++)
      printf("%3d", a[i][j]);
}
```
可以用
```bash
(gdb) print display_2Darray
```
来查看输出

3. 对于几十步才会出现的bug的调试

    方法：利用检查点checkpoint

    checkpoint:生成当前状态的快照

    info checkpoint:显示快照信息

    restart checkpoint-id:恢复到某个checkpoint

    delete checkpoint checkpoint-id:删除某个checkpoint