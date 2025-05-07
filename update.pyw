import os
import subprocess
import sys

# Git 仓库的根目录
gitRoot = r"F:\myBlog\restar682.github.io"

# Hexo 的源文件目录
hexoPostDir = os.path.join(gitRoot, "source", "_posts")

# 获取 commit 信息（支持命令行传入）
commitMsg = "update"
if len(sys.argv) > 1:
    commitMsg = " ".join(sys.argv[1:])

# 在 Git 根目录下执行 Git 操作
os.chdir(gitRoot)

commands = [
    ["git", "add", "."],
    ["git", "commit", "-m", commitMsg],
    ["git", "push"]
]

for cmd in commands:
    print(f"\n>> 正在执行: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("出错，停止执行。")
        break

# 切换到 Hexo 文章目录，并执行 Hexo 命令
print(hexoPostDir)
os.chdir(hexoPostDir)

hexoCommands = [
    ["hexo", "g", "-d"]
]

for cmd in hexoCommands:
    print(f"\n>> 正在执行: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("出错，停止执行。")
        break
