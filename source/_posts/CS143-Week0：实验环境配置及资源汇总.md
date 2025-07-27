---
title: CS143-Week0：实验环境配置及资源汇总
date: 2025-07-26 10:41:21
categories: CS143
description: 环境配置和资源汇总。
tags: [编译原理, Linux, CS143]
---
本来想学 143，找了一通找不到资料，没搞明白到底要干啥，加上压力比较大就打算换南大的编译原理，然后……终于有时间了发现南大的 OJ 炸了……行吧，又打算开始淦 CS143 了。

# 环境配置
配置跟着课程网站上面搞就可以，可以参考<a href="https://zhuanlan.zhihu.com/p/226190284?share_code=1qHZc0tJ3pVWI&utm_psn=1932738134946316767" target="_blank">这位大佬写的教程</a>，截至 2025.07.27 仍可使用。

注意为了使用课程提供的代码，我们需要使用老版本的flex，可以在<a href="https://src.fedoraproject.org/lookaside/pkgs/flex/flex-2.5.35.tar.bz2/" target="_blank">这里</a>下载，然后正常的安装流程即可。

再正常安装 bison，配置环境变量，然后在命令行输入 `coolc`，即可看到 cool 编译器的输出：
```
Class Main is not defined.
Compilation halted due to static semantic errors.
```

至此环境配置完成。