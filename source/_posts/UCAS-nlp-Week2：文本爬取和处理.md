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

