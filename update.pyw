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
    result = subprocess.run(cmd, capture_output=True, text=True)

    # 打印命令输出（可选）
    print(result.stdout)
    print(result.stderr)

    # 检查 commit 是否没有内容
    if cmd[1] == "commit" and "nothing to commit" in result.stdout:
        print("没有要提交的内容，停止执行。")
        sys.exit(0)

    if result.returncode != 0:
        print("出错，停止执行。")
        break

# 切换到 Hexo 文章目录，并执行 Hexo 命令
os.chdir(hexoPostDir)
# print(os.getcwd())

hexoCommands = [
    ["hexo", "g", "-d"]
]

for cmd in hexoCommands:
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8')
    print(f"\n>> 正在执行: {' '.join(cmd)}")

print("\n✅ 全部完成！")