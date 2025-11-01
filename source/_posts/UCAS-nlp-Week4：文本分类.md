---
title: UCAS-nlp-Week4：文本分类
date: 2025-10-31 15:46:16
categories: UCAS-nlp
description: 文本分类模型的实现基础。
tags: [自然语言处理, 文本分类]
---
# 可变参数与参数解包
Python 支持在函数定义中接收任意数量的位置或关键字参数，并可在调用时对序列或字典进行解包，极大提升了函数的灵活性。

- `*args`：在函数定义中用于接收任意数量的**位置参数**，所有未被显式形参捕获的额外位置参数会被自动打包为一个**元组**。
- `**kwargs`：在函数定义中用于接收任意数量的**关键字参数**，所有未被显式形参声明的关键字参数会被自动打包为一个**字典**。
- `func(*iterable, **dict)`：在函数调用时，`*` 可将序列（如列表、元组）**解包为位置参数**，`**` 可将字典**解包为关键字参数**。  
  例如，若 `nums = (1, 2, 3)`，则 `f(*nums)` 等价于 `f(1, 2, 3)`；若 `params = {'x': 10, 'y': 20}`，则 `f(**params)` 等价于 `f(x=10, y=20)`。

# 命令行解析
虽然 Python 也可通过 `sys.argv` 直接获取命令行参数，但标准库中的 `argparse` 模块提供了更方便的解析方式。其核心类 `argparse.ArgumentParser` 能自动处理参数定义、类型转换等任务，很适合用来配置参数。

- `parser = argparse.ArgumentParser(description)`：创建命令行参数解析器对象，用于管理和解析命令行输入。 `description` 参数用于指定程序的整体说明文字，在执行 `-h` 或 `--help` 时显示在帮助信息顶部，以简要介绍脚本的用途或功能。
- `parser.add_argument(name, **kwargs)`：向解析器添加一个命令行参数，其中 `name` 是参数名（如 `"--lr"` 或 `"-e"`），`**kwargs` 表示一组可选关键字参数，用于设置该参数的行为和属性，例如：
  - `type`：参数类型（如 `int`、`float`、`str`）
  - `default`：参数的默认值
  - `help`：提供参数的说明文本
  - `choices`：限定参数的可选值范围
  - `action`：定义解析行为（如 `"store_true"` 表示布尔开关）
- `arg = parser.parse_args()`：解析运行脚本时实际传入的命令行参数，将每个参数的值按名称存入一个 `Namespace` 对象（通常命名为 `args`）。可以通过 `args.参数名` 的方式访问各参数的值。

# 数据加载
在 PyTorch 中，常用 `torch.utils.data` 中的 `Dataset` 和 `DataLoader` 来处理数据，其中 `Dataset` 用于封装数据及其标签，定义“如何获取单个样本”，而 `DataLoader` 负责批量加载、打乱顺序、并行预取等，定义“如何高效地将数据送入模型”。
- `torch.utils.data.Dataset`类：
  自定义数据集必须继承此类并实现两个方法：  
  - `__len__(self)`：返回数据集总样本数；  
  - `__getitem__(self, idx)`：根据索引 `idx` 返回一个样本（通常为 `(data, label)` 元组）。  
  PyTorch 也提供了内置数据集（如 `torchvision.datasets.MNIST`），可直接使用。
- `dataloader = torch.utils.data.DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0, ...)`：  
  将 `Dataset` 对象包装为可迭代的批量数据加载器。常用参数包括：  
  - `batch_size`：每个 batch 的样本数量；  
  - `shuffle`：是否在每个 epoch 开始时打乱数据顺序；  
  - `num_workers`：用于数据加载的子进程数（设为 `0` 表示主进程加载）；  
  - `drop_last`：若最后一批样本数不足 `batch_size`，是否丢弃；
  - `collate_fn`：自定义批处理函数，用于定义如何将单个样本列表组合成一个 batch。
  使用时，可通过 `for data,label in dataloader:` 直接遍历批量数据。