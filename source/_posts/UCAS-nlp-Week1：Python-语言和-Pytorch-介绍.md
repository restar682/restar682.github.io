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

<div style="display: flex; justify-content: center; gap: 1em;">
<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/1.png" alt="test_module.py 作为模块" width="100%">
  <figcaption>`test_module.py` 作为模块</figcaption>
</figure>

<figure style="text-align: center; margin-top: 1em;">
  <img src="/illustrations/UCAS-nlp-Week1/2.png" alt="test_module_main.py 能够导入并使用" width="100%">
  <figcaption>`test_module_main.py` 能够导入并使用</figcaption>
</figure>
</div>

## Python 包（Package）
包其实就是一个**文件夹**，但该文件夹下必须存在 `__init__.py` 文件，用于标识当前文件夹是一个 Python 包，这个文件的内容可以为空。

<div style="display: flex; justify-content: center; gap: 1em;">
  <figure style="text-align: center; width: 45%;">
    <img src="/illustrations/UCAS-nlp-Week1/3.png" alt="test-package 作为包" style="width: 74%;">
    <figcaption><code>test-package</code> 作为包</figcaption>
  </figure>

  <figure style="text-align: center; width: 45%;">
    <img src="/illustrations/UCAS-nlp-Week1/4.png" alt="test_module_main.py 能够导入包内的模块并使用" style="width: 100%;">
    <figcaption><code>test_module_main.py</code> 能够导入包内的模块并使用</figcaption>
  </figure>
</div>


# Pytorch 简介
好的，这个我是真没用过（笑

PyTorch 是由 Facebook 开发的开源深度学习框架，可以自动并行加速和自动求导。其核心数据结构是 **Tensor**，类似于 NumPy 的 `ndarray`，但可在 GPU 上加速计算。

## Tensor
**Tensor（张量）** 是一个多维数组，可以表示标量、向量、矩阵等，其创建方式有：
- `torch.tensor(data, dtype, device)`：由已有数据创建，`dtype`用于选择数据类型，`device`用于选择设备
- `torch.zeros(size)`：全 0 张量  
- `torch.ones(size)`：全 1 张量  
- `torch.randn(size)`：随机正态分布  
- `torch.rand(size)`：生成 均匀分布 $[0,1)$ 的随机张量
- `torch.randint(low, high, size)`：生成 整数随机张量，元素在 $[low, high)$ 之间
- `torch.stack(tensors, dim=0)`：沿指定维度将多个张量**拼接成一个新张量**（要求每个张量形状相同）
- `torch.cat(tensors, dim=0)`：沿指定维度将多个张量**拼接成一个新张量**（要求除拼接维度外其他维度相同）  
- `torch.flatten(x, start_dim=1)`：将多维张量展平成一维向量（保留 `start_dim` 之前的维度，如 batch 维）

Tensor 支持多种 PyTorch 的数据类型：

| PyTorch 类型      | 含义             | NumPy 对应     |
| ---------------- | ---------------- | -------------- |
| `torch.float32`  | 32 位浮点数       | `np.float32`  |
| `torch.float64`  | 64 位浮点数（双精度） | `np.float64`  |
| `torch.int32`    | 32 位整数         | `np.int32`    |
| `torch.int64`    | 64 位整数（常用于索引） | `np.int64`    |
| `torch.bool`     | 布尔类型          | `np.bool_`    |

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
- `torch.mul(x, y)`：逐元素乘法
- `x.T`：转置  

Tensor 也可以进行统计运算，常用函数包括：
- `x.sum()`：求和  
- `x.mean()`：均值  
- `x.max()` / `x.min()`：最大/最小值  
- `x.argmax()` / `x.argmin()`：最大/最小值索引  

Tensor 也提供了设备转换方法，常用的函数包括：

- `x.cpu()`：将张量从 GPU 移动到 CPU。
- `x.cuda()`：将张量从 CPU 移动到 GPU（如果有可用的 GPU）。
- `x.numpy()`：将张量转换为 NumPy 数组（只支持 CPU 张量）。
- `x.to(device)`：将张量移动到指定的设备（如 'cuda' 或 'cpu'）。

## 自动求导（Autograd）
PyTorch 的 `autograd` 能自动计算模型参数的梯度，不需要手动推导。

- `loss.backward()`：执行反向传播，计算所有参数的梯度
- `x.grad`：访问张量的梯度值
- `optimizer.zero_grad()`：清空参数梯度，防止累积
- `with torch.no_grad():`：上下文中不记录梯度，用于推理
- `x.detach()`：返回不参与梯度计算的张量副本

## 神经网络（torch.nn）

`torch.nn` 是用来构建神经网络模型的模块，提供了常用层和损失函数。

### 嵌入层
- `nn.Embedding(num_embeddings, embedding_dim, padding_idx=None)`：  
  将离散的整数索引（如词 ID 或类别标签）映射为稠密的连续向量。
  - `num_embeddings`：词表大小；  
  - `embedding_dim`：嵌入向量的维度；  
  - `padding_idx`（可选）：指定一个索引（如 `0`），其对应的嵌入向量在训练中**始终保持为全零**，常用于填充（padding）。
- `vec = embedding.weight[i]`：获取索引 $i$ 对应的嵌入向量 
- `embedded = embedding(indices)`：批量获取对应索引的嵌入向量

### 常用层
- `nn.Linear(in_features, out_features)`：全连接层
- `nn.Conv2d(in_channels, out_channels, kernel_size, padding)`：二维卷积层
- `nn.BatchNorm2d(num_features)`：批归一化层
- `nn.MaxPool2d(kernel_size, stride)`：二维最大池化层
- `nn.Dropout(p)`：Dropout 层，防止过拟合，`p` 是随机丢弃的概率
- `nn.Sequential(...)`：顺序容器，将多个层按定义顺序组合
- `nn.ModuleList(modules)`：用于存放多个子层的列表，这些子层会被自动注册为模型参数，适合在网络结构中动态组合多个卷积层或全连接层（例如多尺度卷积核）。

### 激活函数
- `nn.ReLU(inplace=True)`：ReLU 函数，`inplace=True` 表示直接在原张量上修改，节省显存
- `nn.Sigmoid()`：Sigmoid 函数，不支持直接修改
- `nn.Softmax(dim)`：Softmax 函数，同样不支持直接修改

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
- `model.eval()`：切换为评估模式，停止训练，不再更新参数，并且会关闭诸如 Dropout 和 Batch Normalization 动态更新等训练特有的操作。