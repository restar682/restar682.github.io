---
title: UCAS-nlp-Week1：Python 语言和 Pytorch 介绍
date: 2025-09-23 15:37:57
categories: UCAS-nlp
description: Python 语言和 Pytorch 的基本介绍
tags: [自然语言处理, Python, Pytorch]
---
# Python 简介
果然野路子选手还是有些知识点不晓得……

## Python 模块（Module）
模块类似于 C 语言中的头文件和 Java 中的包，其实质是 Python 程序，事实上任何 Python 程序都可以作为模块使用。

Python 的模块分为标准库的模块、第三方模块和自定义模块，有两种方式导入：
- `import 模块名1 [as 别名1], 模块名2 [as 别名2]`  
- `from 模块名 import 成员名1 [as 别名1], 成员名2 [as 别名2]`

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/1.png" alt="test_module.py 作为模块" width="55%">
  <figcaption>`test_module.py` 作为模块</figcaption>
</figure>

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/1.png" alt="test_module_main.py 能够导入并使用" width="55%">
  <figcaption>`test_module_main.py` 能够导入并使用</figcaption>
</figure>

## Python 包（Package）
包其实就是一个**文件夹**，但该文件夹下必须存在 `__init__.py` 文件，用于标识当前文件夹是一个Python包，这个文件的内容可以为空。

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/3.png" alt="test-package 作为包" width="55%">
  <figcaption>`test-package` 作为包</figcaption>
</figure>

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/3.png" alt="test_module_main.py 能够导入包内的模块并使用" width="55%">
  <figcaption>`test_module_main.py` 能够导入包内的模块并使用</figcaption>
</figure>

# Pytorch 简介
好的，这个我是真没用过（笑

PyTorch 是由 Facebook 开发的开源深度学习框架，可以自动并行加速和自动求导。其核心数据结构是 **Tensor**，类似于 NumPy 的 `ndarray`，但可在 GPU 上加速计算。

## Tensor
**Tensor（张量）** 是一个多维数组，可以表示标量、向量、矩阵等，其创建方式有：
- `torch.tensor(data)`：由已有数据创建
- `torch.zeros(size)`：全 0 张量  
- `torch.ones(size)`：全 1 张量  
- `torch.randn(size)`：随机正态分布  

Tensor 作为张量，可以轻松地改变形状，常用函数包括：
- `x.shape`：查看形状  
- `x.view(new_shape)`：改变形状（共享内存）  
- `x.reshape(new_shape)`：改变形状（可能复制数据）  
- `x.unsqueeze(dim)`：增加维度  
- `x.squeeze(dim)`：去掉维度  

Tensor 可以通过索引与切片来查看其中一部分数据，常用方式包括：
- `x[i]`：取第 i 行  
- `x[:, j]`：取第 j 列  
- `x[1:3, :]`：切片  

Tensor 可以进行数学运算，常用方式包括：
- `x + y`，`x - y`，`x * y`，`x / y`：逐元素数学运算  
- `torch.matmul(x, y)` 或 `x @ y`：矩阵乘法  
- `x.T`：转置  

Tensor 也可以进行统计运算，常用函数包括：
- `x.sum()`：求和  
- `x.mean()`：均值  
- `x.max()` / `x.min()`：最大/最小值  
- `x.argmax()` / `x.argmin()`：最大/最小值索引  

## 自动求导（Autograd）
PyTorch 的 `autograd` 能自动计算模型参数的梯度，不需要手动推导。

- `loss.backward()`：执行反向传播，计算所有参数的梯度
- `x.grad`：访问张量的梯度值
- `optimizer.zero_grad()`：清空参数梯度，防止累积
- `with torch.no_grad():`：上下文中不记录梯度，用于推理
- `x.detach()`：返回不参与梯度计算的张量副本

## 神经网络（torch.nn）

`torch.nn` 是用来构建神经网络模型的模块，提供了常用层和损失函数。

### 常用层
- `nn.Linear(in_features, out_features)`：全连接层
- `nn.Conv2d(in_channels, out_channels, kernel_size)`：二维卷积层
- `nn.BatchNorm2d(num_features)`：批归一化层
- `nn.Dropout(p)`：Dropout 层，防止过拟合

### 激活函数
- `nn.ReLU()`：ReLU 函数
- `nn.Sigmoid()`：Sigmoid 函数
- `nn.Softmax(dim)`：Softmax 函数

### 损失函数
- `nn.MSELoss()`：均方误差，用于回归
- `nn.CrossEntropyLoss()`：交叉熵损失，用于多分类
- `nn.BCELoss()`：二分类交叉熵损失

## 优化器（torch.optim）
`torch.optim` 被用于更新模型参数，实现梯度下降。

- `optim.SGD(params, lr)`：随机梯度下降优化器
- `optim.Adam(params, lr)`：Adam 优化器，常用且收敛快
- `optimizer.step()`：根据梯度更新参数
- `optimizer.zero_grad()`：清空参数梯度，防止梯度累积

## 设备管理

Pytorch 可以控制模型和数据在 CPU 或 GPU 上运行。

- `torch.device("cuda")` 或 `torch.device("cpu")`：指定设备
- `x.to(device)`：将张量移动到指定设备
- `torch.cuda.is_available()`：检查 GPU 是否可用

## 模型保存与加载
Pytorch 同样支持保存和加载训练好的模型。

- `torch.save(model.state_dict(), path)`：保存模型参数
- `model.load_state_dict(torch.load(path))`：加载模型参数
- `model.train()`：切换为训练模式
- `model.eval()`：切换为评估模式，停止训练