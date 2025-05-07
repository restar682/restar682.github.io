---
title: git命令速查版
date: 2025-02-27 21:17:51
tags: [git, 命令]
categories: 工具
---
# Git 常用命令速查表

## 仓库初始化
```bash
# 创建新仓库
git init

# 克隆远程仓库
git clone https://github.com/用户名/项目名.git # 克隆整个仓库
git clone -b 分支名 仓库地址 # 克隆指定分支
```

## 文件操作
```bash
# 添加修改到暂存区
git add . # 添加所有修改的文件到暂存区
git add 文件名 # 添加单个文件到暂存区

# 删除
git clean -n # 显示会被删除的文件（只是预览，不实际删除）
git clean -f # 强制删除未追踪的文件（实际执行）
git clean -fd # 强制删除未追踪的文件和目录

# 撤回暂存区文件
git reset # 把暂存区文件，撤回到工作区
git reset HEAD 文件名 # 撤销某个文件的 git add
git reset --soft HEAD^ # 回退到上一个提交，保留修改内容在暂存区（add 过）
git reset --mixed HEAD^ # 回退到上一个提交，修改内容回到工作区（默认行为）
git reset --hard HEAD^ # 回退到上一个提交，彻底删除改动（不可恢复）

# 恢复文件到上次提交状态（不删除本地修改）
git checkout -- 文件名

# 提交更改到本地仓库
git commit -m "提交描述"
```

##  查看信息
```bash
# 查看当前状态（修改/暂存文件）
git status

# 查看提交历史
git log             # 查看提交日志（时间、作者、commit ID）
git log --oneline   # 压缩成一行显示

# 查看未暂存的修改内容
git diff
```

##  分支管理
```bash
# 查看所有分支
git branch

# 创建新分支
git branch feature-login

# 切换分支
git checkout main

# 创建并切换分支
git checkout -b hotfix

# 删除分支
git branch -d old-branch
```

##  远程协作
```bash
# git 配置
git config --global user.name "你的用户名" # 设置全局用户名
git config --global user.email "你的邮箱"  # 设置全局邮箱

git config --global http.proxy "http://127.0.0.1:7890"
git config --global https.proxy "http://127.0.0.1:7890" # 设置代理
git config --global --unset http.proxy
git config --global --unset https.proxy # 取消代理设置

git config --global --list # 查看当前所有全局配置
git config --list # 查看当前仓库和全局的综合配置

# 远程仓库管理
git remote add <name>	# 添加新远程仓库
git remote -v	# 查看所有远程仓库及其 URL
git remote set-url	# 修改已有远程仓库的 URL
git remote remove	# 删除指定远程仓库
git remote rename	# 重命名远程仓库

# 推送
git push # 推送当前分支到远程对应分支
git push -u origin 分支名 # 第一次推送，需要绑定本地分支和远程分支
git push origin 分支名 # 推送到指定远程分支，不设置上游
git push origin --delete 分支名 # 删除远程分支

# 拉取代码
git pull # 拉取远程当前分支并合并
git pull origin 分支名 # 从远程指定分支拉取并合并

```