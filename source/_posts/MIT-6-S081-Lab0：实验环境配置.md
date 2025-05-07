---
title: MIT-6.S081-Lab0：实验环境配置
date: 2025-02-27 20:27:08
categories: 6.s081
tags: [操作系统, 环境配置, Linux, 6.s081]
---
想学学操作系统，准备开坑6.s081。
# 准备工作
## 换源

下载软件有点慢，所以我们换一个源，操作方法如下：
1.备份源列表
    ```bash
    # 首先备份源列表
sudo cp /etc/apt/sources.list /etc/apt/sources.list_backup
    ```

2.打开sources.list文件修改
    ```bash
    # 打开sources.list文件
sudo gedit /etc/apt/sources.list
    ```
    然后在文件最前面添加阿里云镜像源：
    ```
    # 这是阿里源
    deb http://mirrors.aliyun.com/ubuntu/ bionic main restricted universe multiverse
    deb http://mirrors.aliyun.com/ubuntu/ bionic-security main restricted universe multiverse
    deb http://mirrors.aliyun.com/ubuntu/ bionic-updates main restricted universe multiverse
    deb http://mirrors.aliyun.com/ubuntu/ bionic-proposed main restricted universe multiverse
    deb http://mirrors.aliyun.com/ubuntu/ bionic-backports main restricted universe multiverse
    deb-src http://mirrors.aliyun.com/ubuntu/ bionic main restricted universe multiverse
    deb-src http://mirrors.aliyun.com/ubuntu/ bionic-security main restricted universe multiverse
    deb-src http://mirrors.aliyun.com/ubuntu/ bionic-updates main restricted universe multiverse
    deb-src http://mirrors.aliyun.com/ubuntu/ bionic-proposed main restricted universe multiverse
    deb-src http://mirrors.aliyun.com/ubuntu/ bionic-backports main restricted universe multiverse
    ```

3.最后记得刷新列表
    ```bash
    sudo apt-get update
    sudo apt-get upgrade
    sudo apt-get install build-essential
    ```

# 配置环境

## 环境
这里环境使用wsl2 + ubuntu20.04，据说18.04会比较麻烦。

## 安装指令
使用官网的指令即可
    ```bash
    sudo apt-get install git build-essential gdb-multiarch qemu-system-misc gcc-riscv64-linux-gnu binutils-riscv64-linux-gnu 
    sudo apt-get remove qemu-system-misc
    sudo apt-get install qemu-system-misc=1:4.2-3ubuntu6
    ```

至此环境配置完毕。

