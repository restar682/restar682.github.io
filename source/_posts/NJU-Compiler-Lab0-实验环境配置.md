---
title: NJU-Compiler-Lab0:实验环境配置
date: 2025-05-21 11:27:35
categories: NJU-Compiler
description: NJU 编译原理环境配置。
tags: [编译原理, 环境配置, Linux, NJU-Compiler]
---
想学的东西太多了是这样的……时间根本不够用(T_T)所以打算先学南大的编译原理，应该比 cs143 简单一些，中文也更加方便理解。

先整理一下环境配置，我用的 Linux 20.04，跟着老师的教程不是很难：

---
## Java 环境

Java 我装的是 OpenJDK 17 版本。

### 安装

```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

### 设置环境变量（以 Bash 为例）

编辑 `~/.bashrc` 或 `~/.zshrc` 文件，添加以下内容（根据实际路径调整）：

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
```

使配置生效：

```bash
source ~/.bashrc
```

验证是否配置成功：

```bash
java -version
```

---

## ANTLR4 配置

ANTLR 是一个强大的语法分析工具，支持自动生成词法分析器和语法分析器。

使用 IDE 的用户可以直接安装插件，比如 VS Code 直接装 ANTLR4 grammar syntax support 插件即可：

---

## LLVM 配置

LLVM 提供底层中间表示 IR 和工具链，是实验中 IR 优化与生成的重要工具。

### 安装命令：

```bash
sudo apt update
sudo apt install llvm clang
```

### 验证安装：

```bash
clang -v
lli --version
```

若出现版本信息，则安装成功。