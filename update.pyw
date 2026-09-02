import os
import re
import shutil
import subprocess
import sys

# Git 仓库的根目录
gitRoot = r"F:\myBlog\restar682.github.io"

# 获取 commit 信息（支持命令行传入）
commitMsg = "update"
if len(sys.argv) > 1:
    commitMsg = " ".join(sys.argv[1:])

# 在 Git 根目录下执行 Git 操作
os.chdir(gitRoot)

def run(cmd):
    print(f"\n>> 正在执行: {' '.join(cmd)}", flush=True)
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"\n执行失败（退出码 {result.returncode}），已停止。", flush=True)
        sys.exit(result.returncode)


def run_hexo(npx, command):
    cmd = [npx, "hexo", command]
    print(f"\n>> 正在执行: {' '.join(cmd)}", flush=True)
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace"
    )
    saw_error = False
    for line in process.stdout:
        print(line, end="", flush=True)
        if re.match(r"^\s*ERROR(?:\s|$)", line):
            saw_error = True

    returncode = process.wait()
    if returncode != 0 or saw_error:
        reason = f"退出码 {returncode}" if returncode != 0 else "Hexo 输出了 ERROR"
        print(f"\n执行失败（{reason}），已停止，未部署半成品。", flush=True)
        sys.exit(returncode or 1)


run(["git", "add", "--all"])

# git commit 在没有改动时会返回 1，这不是部署失败。
staged = subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode
if staged == 1:
    run(["git", "commit", "-m", commitMsg])
    run(["git", "push"])
elif staged == 0:
    print("\n>> 没有新的源码改动，继续重新生成并部署。", flush=True)
else:
    print("\n检查 Git 改动失败，已停止。", flush=True)
    sys.exit(staged)

npx = shutil.which("npx.cmd") or shutil.which("npx")
if not npx:
    print("\n找不到 npx，请确认 Node.js 已安装并已加入 PATH。", flush=True)
    sys.exit(1)

run_hexo(npx, "clean")
run_hexo(npx, "generate")
run_hexo(npx, "deploy")

print("\n全部完成！", flush=True)
