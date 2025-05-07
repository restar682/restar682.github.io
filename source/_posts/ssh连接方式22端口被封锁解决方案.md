---
title: ssh连接方式22端口被封锁解决方案
date: 2025-03-29 16:35:59
tags: [DEBUG, ssh]
categories: DEBUG
---
# 方案1：切换为 HTTP 连接

在当前仓库的 `.git/config` 文件中，将以下行：
```ini
url = git@github.com:username/repo.git
```
修改为：
```ini
url = https://github.com/username/repo.git
```
这样我们就可以让 Git 通过 HTTPS 连接 GitHub 仓库。

# 方案2：切换 SSH 端口

在 `~/.ssh` 目录下创建或编辑 `config` 文件，添加以下配置：
```ini
Host github.com
User git
Hostname ssh.github.com
PreferredAuthentications publickey
IdentityFile ~/.ssh/id_rsa
Port 443
```
这样 SSH 就会通过端口 `443` 连接 GitHub。