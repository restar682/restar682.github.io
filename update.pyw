import subprocess
import sys

# 获取 commit message（默认为 "update"）
commit_msg = "update"
if len(sys.argv) > 1:
    commit_msg = " ".join(sys.argv[1:])

# 定义要执行的命令
commands = [
    ["git", "add", "."],
    ["git", "commit", "-m", commit_msg],
    ["git", "push"],
    ["hexo", "g", "-d"]
]

# 执行每条命令
for cmd in commands:
    print(f"\n>> 正在执行: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print("出错，停止执行。")
        break
