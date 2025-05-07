---
title: 用于优化体验的简单启动项py脚本
date: 2025-04-22 13:37:25
tags: [Python, 脚本]
categories: 工具
---
这两天突然觉着开机后的有些操作过于繁琐重复，于是给电脑写了几个脚本来偷懒。

## VMware 强制管理员模式运行
众所周知 VMware 跟 Win11 适配的不是很好，在12代以上的大小核架构中不会使用大核来运行，这会导致在虚拟机中的一些键盘操作变得很慢。解决方法之一就是运用“管理员模式”打开 VMware。但即使从快捷方式设置了每次以管理员模式运行，每次还要关闭提示页面，某种程度上会让人感觉有点烦躁。因此第一个脚本就是让电脑每次以管理员模式运行 VMware。

操作步骤如下：
1. （可选）安装 `pywin32` 宏包
    我们的脚本中可以用到 `win32com.client` 来访问 Windows 的 COM 接口（Office 自动化、任务计划、注册表等），所以可以安装 `pywin32` 宏包。
    使用国内镜像源下载即可。
    ```
        pip install -i https://pypi.tuna.tsinghua.edu.cn/simple pywin32
    ```
    用 `pywin32` 宏包可以设置任务计划程序，不过权限问题很麻烦，我更加倾向于用系统提供的gui界面进行设置。
2. 设置任务计划程序
    在计算机管理——任务计划程序中，新建任务，取一个好听的名字（我取的叫 VMwareAdminLaunch）

    <img src="/illustrations/用于优化体验的简单启动项py脚本/1.png" alt="常规">

    在操作中新建一个动作，打开程序，选择自己程序所在的地址。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/2.png" alt="操作">

    然后在条件中取消“仅在计算机使用交流电源时启动”，否则离电不能运行。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/3.png" alt="条件">
3. py脚本
    最后我们的py脚本内容如下，其实就是调用命令行，`creationflags=subprocess.CREATE_NO_WINDOW`保证了命令行不弹窗：
    ```py
    import subprocess

    def run_silent_task(taskName):
        subprocess.Popen(
            ["schtasks", "/run", "/tn", taskName],
            creationflags=subprocess.CREATE_NO_WINDOW
        )

    if __name__ == "__main__":
        run_silent_task("VMwareAdminLaunch")

    ```

## Clash
我真没想到 Clash 自己的最小化也有bug，会导致鼠标一直闪烁，我不得不自行实现打开并隐藏。

同样主要分为两个操作步骤
1. 设置任务计划程序
    同样新建任务，这里不需要用管理模式运行。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/4.png" alt="常规">

    设置一个触发器，但要注意开机时启动会有一些bug，我们一般采用登录时启动。然后！因为 Clash 在登录时那一会gui界面没加载好的时候跟系统不兼容，所以启动会失败，所以我们要延迟10秒运行。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/5.png" alt="触发器">

    在操作中新建一个动作，打开我们的脚本程序。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/6.png" alt="操作">

    同样在条件中取消“仅在计算机使用交流电源时启动”。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/7.png" alt="条件">
2. py脚本
    我们启动后在gui界面查找名称进行匹配，然后进行隐藏即可，可以根据需求自己设置弹窗提示。
    ```py
    import subprocess
    import time
    import win32gui
    import win32con
    from win10toast import ToastNotifier

    myexe_path = r'"E:\Clash.for.Windows\Clash for Windows.exe"'
    myexe_name = "clash for windows"

    def find_exe(exe_name):
        """查找exe窗口句柄"""
        def callback(hwnd, hwnds):
            if win32gui.IsWindowVisible(hwnd):
                title = win32gui.GetWindowText(hwnd)
                if title.lower() == exe_name: # 匹配程序标题，这里采用完全匹配
                    hwnds.append(hwnd)
            return True
        
        hwnds = []
        win32gui.EnumWindows(callback, hwnds)
        return hwnds

    def hide_window(hwnd):
        for _ in range(10):
            win32gui.ShowWindow(hwnd, win32con.SW_HIDE)
            if not win32gui.IsWindowVisible(hwnd):
                return True
            time.sleep(0.1)
        return False  # 超时未成功

    def main():
        # 启动程序
        toaster = ToastNotifier()
        subprocess.Popen(myexe_path)
        
        # 等待几秒让程序完全启动
        try_num = 500
        for _ in range(try_num):
            time.sleep(0.01) # 查找并隐藏exe窗口
            exe_windows = find_exe(myexe_name)
            if exe_windows:
                for hwnd in exe_windows:
                    hide_window(hwnd)
                    print(f"已隐藏exe窗口 (句柄: {hwnd})")
                toaster.show_toast("Clash 已自动启动！", "愿此生尽兴，赤诚善良", duration = 0.3, icon_path = None, threaded = True)
                break
        else:
            print("未找到exe窗口，请检查程序是否正常启动")

    if __name__ == "__main__":
        main()
    ```

## WallPaper
担心在外面用壁纸会社死？我们在连接电源时才开壁纸引擎即可。

我们只需要在条件中打开“仅在计算机使用交流电源时启动”，其他选项保持不变，因为本来就不会弹窗甚至不需要脚本来执行嘿嘿嘿。

<img src="/illustrations/用于优化体验的简单启动项py脚本/8.png" alt="条件">

## Steam
最近知道了“着色器预缓存”这个设置对游戏的启动速度影响超级大，也有人说是加速器的影响，但我测试下来无论如何关掉这个设置对启动速度的提升都是巨大的。

但是我总是担心可能以后遇到的游戏需要这个功能，所以我写了个脚本在凌晨更新缓存：
1. 设置任务计划程序
    同样新建任务，设置一个触发器，因为目前看来我玩的游戏更新频率不高，所以每周一凌晨3点启动，其余操作不变。

    <img src="/illustrations/用于优化体验的简单启动项py脚本/9.png" alt="触发器">

2. py脚本
    我们修改 steam 启动项的配置文件，用 `re` 库进行匹配替换，然后打开 steam  静置 10min 让其自动更新。
    ```py
    import subprocess
    import time
    import os
    import re

    steamPath = r"E:\steam\steam.exe"
    configPath = r"E:\steam\config\config.vdf"

    def modifyShaderCache(enable: bool):
        if not os.path.exists(configPath):
            print("[ERR] config.vdf 不存在")
            return
        with open(configPath, "r", encoding="utf-8") as f:
            content = f.read()

        newValue = "0" if enable else "1"
        modifiedContent, count = re.subn(
            r'("DisableShaderCache"\s+)"[01]"',
            r'\1"{}"'.format(newValue),
            content
        )

        if count == 0:
            print("[WARN] 未找到 DisableShaderCache 字段，不做修改")
        else:
            with open(configPath, "w", encoding="utf-8") as f:
                f.write(modifiedContent)
            print(f"[OK] 修改 DisableShaderCache = {newValue}")

    def launchSteam():
        subprocess.Popen(steamPath)

    def closeSteam():
        subprocess.call(['taskkill', '/F', '/IM', 'steam.exe'],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL)

    def autoUpdate():
        print("[1] 启用 Shader 缓存")
        modifyShaderCache(enable=True)

        print("[2] 启动 Steam")
        launchSteam()

        print("[3] 等待 10 分钟进行更新")
        time.sleep(600)

        print("[4] 关闭 Steam")
        closeSteam()

        print("[5] 禁用 Shader 缓存")
        modifyShaderCache(enable=False)

        print("[Done] 自动更新流程完成 🎉")

    if __name__ == "__main__":
        autoUpdate()
    ```