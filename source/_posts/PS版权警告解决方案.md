---
title: PS版权警告解决方案
description: PS有的时候真的很烦……
date: 2025-04-22 00:04:46
tags: [DEBUG, 网络, PS, 绘画]
categories: DEBUG
---
> 本文所述内容仅用于学术研究和网络协议分析之目的。所有操作和技术实现都旨在增加对网络协议、流量管理和相关技术的理解，且不应被用于任何非法或未经授权的行为。使用本文中提到的技术和方法，用户需遵守所在地区的相关法律法规，并对使用结果承担全部责任。本文中的任何技术或方法均不针对特定用户或设备，而是作为网络研究的一部分进行展示。

拦截 PS 流量的方法可以从两大类角度进行：设置防火墙的出入站规则和使用网络代理工具拦截流量。以下是详细的总结：

## 一、设置防火墙出入站规则
通过配置防火墙的出入站规则，可以有效地阻止不需要的流量。常见的防火墙配置方法包括：

1. **出站规则**：控制从内部网络发出的流量。例如，禁止 Photoshop 连接到 Adobe 的服务器，防止自动更新或未经授权的网络访问。

2. **入站规则**：可以阻止外部对Photoshop相关服务的访问，或者防止Photoshop连接到外部恶意站点。

3. **配置流程**：
   - **Windows防火墙**：在 Windows 安全中心-防火墙和网络保护-高级设置里，添加出入站规则，在“程序”中选中 PS.exe 的位置，阻止其网络连接。
   - **Linux防火墙（iptables）**：通过命令行设置规则，来拦截Photoshop相关的流量。
     ```bash
     iptables -A INPUT -s <Adobe服务器的IP地址> -j DROP   # 禁止Photoshop连接Adobe服务器
     iptables -A OUTPUT -d <Adobe服务器的IP地址> -j REJECT  # 禁止Photoshop发送请求到Adobe服务器
     ```

## 二、通过网络代理解决流量拦截（以Clash为例）
在许多情况下，我们需要使用网络代理工具，那么我们也要拦截代理的流量。

1. **打开配置规则**：
   在“配置”里右键点击你的代理，点击“编辑”进行规则配置

2. **（可选）选择代理**
   我们可以在 Proxies 里面新增一个专门过 Adobe 的代理，在 `proxies` 里面选择想用的节点。
   ```yaml
      - { name: AdobeProxy, type: select, proxies: ['日本01 -NF/GPT']}
   ```
   这里因为我们是要拦截，所以不需要选择代理。

3. **配置规则**：
   配置中可以使用多种规则，如 `DOMAIN-SUFFIX`, `DOMAIN-KEYWORD` 等，来精确控制拦截的流量。拦截规则根据代理的不同有所差别，需要根据自己的代理进行合适的调整。
   - `DOMAIN-SUFFIX`：根据域名后缀进行拦截，如 `.com`、`.org` 等。
   - `DOMAIN-KEYWORD`：根据域名中的关键词进行拦截，如拦截包含 `adobe` 字样的域名。
   - 示例配置：
      ```yaml
      rules:
      - "DOMAIN-KEYWORD, adobe, REJECT"    # 拦截所有包含 'adobe' 的域名
      - "DOMAIN-SUFFIX, adobe.com, REJECT" # 拦截所有访问 adobe.com 的请求
      ```
   - **注意**：yaml是按顺序匹配的，有可能你的代理之前就设置了adobe相关的规则，不要忘了搜索一下进行同样的拦截。

4. **匹配解析器**
   你可能还会发现如果代理进行更新，那么你的配置文件会被覆盖，这个问题相当难解决。一个思路是利用 `proxy_providers` ，这种方法需要自己写配置文件，然后找自己的代理的更新 yaml 配置文件的 url，挂载到自己的配置文件里面即可。但是，并不是所有的代理都会提供有 yaml 文件的 url，一个比较通用的解法是利用“配置文件预处理”，匹配所有配置文件后，添加 yaml 文件要插入的规则。
   ```yaml
   parsers: # array
    - reg: ^.*$
      yaml:
        # 添加规则
        prepend-rules: # 规则由上往下遍历，如上面规则已经命中，则不再往下处理
          - "DOMAIN-KEYWORD, adobe, REJECT"          # 拦截所有包含 'adobe' 的域名
          - "DOMAIN-SUFFIX, adobe.com, REJECT"       # 拦截所有访问 adobe.com 的请求
   ```
5. **流量拦截和日志查看**：
   - 在 Clash 的日志中可以看到拦截到的流量。例如，当访问包含 `adobe.com` 的流量被拦截时，日志中会记录 `REJECT` 的信息，表示该请求被拒绝：
     ```
        [TCP] connected
        cc-cdn.adobe.com:443
        FROM -- 127.0.0.1:51885 RULE -- DOMAIN-SUFFIX(adobe.com) PROXY -- REJECT
     ```
     通过这种方式，Clash不仅能够实现拦截流量，还能通过代理分流，让合规的流量走代理，其他流量被拒绝或处理，从而实现对不同流量的灵活管理。

## 总结
- **防火墙**主要通过控制进出网络的流量来进行拦截。通过配置出入站规则，可以精准地拦截特定的IP、域名或端口流量。
- **Clash**和类似的网络代理工具，通过自定义规则（如 `DOMAIN-SUFFIX` 和 `DOMAIN-KEYWORD`）来拦截特定的网络流量。这种方法更加灵活，可以根据流量的特征（如域名、关键词等）进行精细化拦截。