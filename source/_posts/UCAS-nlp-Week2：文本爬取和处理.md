---
title: UCAS-nlp-Week2：文本爬取和处理
date: 2025-09-30 15:35:36
categories: UCAS-nlp
description: 文本爬取和处理的基本介绍。
tags: [自然语言处理, 爬虫, 分词]
---
# 文本爬取和处理
网络爬虫是一种按照一定的规则，自动地抓取网络中信息的程序，其基本流程为：

1. **发送请求**  
   使用 HTTP 客户端库（如 `requests`）向目标网站发起 HTTP 请求。
2. **获取响应内容**  
   若请求的资源存在于服务器上，服务器将返回响应数据，响应内容通常包括 HTML 文档、图片、视频等资源。
3. **内容解析**  
   对返回的 HTML 数据进行解析，从中提取所需的目标信息。  
   常用方法包括：
   - 自行寻找规律使用正则表达式进行模式匹配；
   - 借助专业的 HTML 解析库如 `Beautiful Soup`，可以更可靠、高效地定位和提取结构化数据。
4. **保存数据**  
   将解析得到的结构化数据存储到本地。

## 发送请求和获取响应
对于单个网站，我们可以直接调用 `requests` 库来发送 HTTP 请求并获取响应内容：
```python
import requests

def getHTMLText(url):
    try:
        response = requests.get(url)
        response.encoding = response.apparent_encoding  # 自动识别并设置正确编码
        return response.text
    except:
        print("爬取失败")
```

如果需要获取的数据比较多，我们一是可以利用 URL 的规律，二是可以以某个网页为种子，找到该网站所有的超链接，再去爬取每个网页：
```python
import requests
from bs4 import BeautifulSoup

def getHTML(url):
    try:
        news_list = []  # 空列表
        r = requests.get(url)  # 发送请求
        r.encoding = r.apparent_encoding  # 获取相应内容编码
        soup = BeautifulSoup(r.text, "html.parser")
        tags = soup.find_all('a')  # 找到所有锚/超链接
        for tag in tags:
            href = tag.get('href')
            if href:
                news_list.append(str(href).strip())  # 得到href
        return news_list
    except:
        print("爬取失败")
```

## 解析 HTML 内容
分词是自然语言处理中最基础的步骤，其核心任务是将原始文本切分为一个有意义的**词序列**。事实上，不同语言在词边界标记上存在显著差异：

- **屈折语（如英语、法语、德语等）**：  
  词与词之间通常由**空格等显式分隔符**明确界定，分词比较直接。
- **孤立语与黏着语（如汉语、日语、越南语等）**：  
  词与词之间**没有天然的分隔符**，词边界需依赖语言学规则或统计模型进行推断，分词难度显著更高。

## 中文分词
我们采用的工具是 `jieba`，它是一个基于前缀词典实现的高效中文分词工具，支持四种分词模式：

1. **精确模式**  
   - 目标是将句子最精确地切分，尽可能避免歧义。
2. **全模式**  
   - 扫描句子中所有可能成词的词语组合，穷举所有匹配项。  
   - 速度快，但无法解决歧义问题，可能产生大量冗余或不合理切分。
3. **搜索引擎模式**  
   - 在精确模式的基础上，对较长的词语进一步细粒度切分，以提升召回率。  
   - 专为搜索引擎设计，兼顾准确性和覆盖度，便于后续关键词匹配与索引。
4. **Paddle 模式**  
   - 基于 **PaddlePaddle 深度学习框架**，利用大规模语料训练，分词准确率更高。

## 正则表达式
Python 中的正则表达式通过 `re` 模块来实现，`re` 是 Python 的标准库模块，用于字符串的模式匹配与文本处理，支持搜索、替换、分割等操作。其核心方法包括：

- `re.match(pattern, string)`：从字符串**开头**尝试匹配，成功返回 `Match` 对象，否则返回 `None`。
- `re.search(pattern, string)`：扫描整个字符串，返回**第一个匹配**的 `Match` 对象（无匹配则返回 `None`）。
- `re.findall(pattern, string)`：返回**所有非重叠匹配**的字符串列表。
- `re.finditer(pattern, string)`：返回一个迭代器，每个元素为匹配的 `Match` 对象。
- `re.sub(pattern, repl, string)`：将所有匹配项替换为 `repl`，并返回新字符串。
- `re.split(pattern, string)`：根据匹配的模式将字符串分割为列表。

### `Match` 对象
匹配成功时返回的 `Match` 对象包含详细的匹配信息，常用方法如下：

- `.group()`：获取匹配的文本内容；
- `.start()`：获取匹配的起始索引；
- `.end()`：获取匹配的结束索引；
- `.span()`：返回 `(start, end)` 元组，表示匹配范围。

## 计数器
**Counter（计数器）** 是 Python 标准库 `collections` 模块中的字典子类，用于统计可哈希对象的出现次数，其中键为元素，值为对应的计数。与 `dict` 不同，`Counter` 在显示或迭代时会自动忽略计数为零或负值的元素，但直接访问这些键仍返回原始值。而在访问不存在的键时，`Counter` 会返回 `0`，不会引发 `KeyError`，但也不会新增键值对。其创建方式包括：
- `Counter(iterable)`：从可迭代对象创建计数器
- `Counter(mapping)`：从字典创建计数器
- `Counter(**kwargs)`：通过关键字参数创建计数器
- `Counter()`：创建空计数器，支持后续增量更新

`Counter` 仅提供一种查询与排序方法：
- `.most_common(n=None)`：返回出现次数最多的前 `n` 个元素及其计数，按频率降序排列；若 `n=None`（默认），则返回所有元素  

`Counter` 支持改变一些元素的计数：
- `.update(iterable-or-mapping)`：对现有计数进行增量累加  
- `.subtract(iterable-or-mapping)`：从现有计数中减去指定值，允许结果为负  

`Counter` 还重载了一些简单的运算符，运算结果在显示或迭代时同样会自动忽略计数为零或负值的元素，但直接访问这些键仍返回原始值：
- `+`：对应计数相加
- `-`：对应计数相减
- `&`：交集运算，各键的计数取最小值  
- `|`：并集运算，各键的计数取最大值  

> **注意**：`Counter` 本质上是无序的；尽管在 Python 3.7+ 中因底层 `dict` 有序而可能表现出插入顺序，但不应依赖此行为。