#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HexHub 专业版补丁（可重复使用 / 更新后重新运行即可）
====================================================
原理：HexHub 的会员校验是纯前端时间检查
      isMemberValid() -> member.endTime > now
本补丁对内嵌 JS 做等长字节替换（文件大小不变，不破坏 Go 内嵌资源）：
  1. isMemberValid()  -> 强制注入一个【假用户】会员并返回 true（永久有效）
  2. isLogin()        -> 恒为 true（让顶部会员面板显示出来）
  3. logout()         -> 空操作（防止服务端会话失效时清空假会员）
假用户不使用任何真实账户，仅本地生效，不联网校验。

用法（更新 HexHub 后重新运行一次即可）：
    python hexhub_pro_patch.py
还原（恢复原文件）：
    python hexhub_pro_patch.py --revert
"""

import json, os, re, shutil, subprocess, sys, time

HEXHUB_EXE = r"C:\Program Files\HexHub\HexHub.exe"
RUNTIME = os.path.expandvars(r"%APPDATA%\HexHub\.hexhub-cn\runtime")

# ===== 假用户（改这里可以自定义，勿填真实账户）=====
FAKE_NAME = "User"                       # 必须与下面 FAKE 里的 name 一致
FAKE = '{endTime:25245792e5,name:"%s",email:"u@x"}' % FAKE_NAME
# endTime:25245792e5 = 2050 年 -> 显示“专业终身版”
# isPlus 不写 -> 默认 false -> 显示 “Pro / 专业版”


def find_backend():
    cur = os.path.join(RUNTIME, "current.json")
    with open(cur, encoding="utf-8") as f:
        rp = json.load(f)["runtimePath"]           # e.g. "versions/255-xxxx"
    be = os.path.join(RUNTIME, *rp.split("/"), "hexhub-backend.exe")
    if not os.path.exists(be):
        sys.exit("找不到后端: %s" % be)
    return be


def pad(core: bytes, total: int) -> bytes:
    """core 形如 b'xxx(){...'（不含右花括号），补空格到 total 长度再补 '}'。"""
    n = total - len(core) - 1
    if n < 0:
        sys.exit("替换串过长（新版本函数变短了？）请缩短 FAKE。超 %d 字节" % (-n))
    return core + b" " * n + b"}"


def patch(backend: str):
    orig = backend + ".orig"
    if not os.path.exists(orig):
        shutil.copy2(backend, orig)
        print("已备份原文件 ->", orig)
    else:
        shutil.copy2(orig, backend)   # 从原文件重新打补丁，保证幂等
        print("已从备份还原，重新打补丁")

    s = open(backend, "rb").read()
    size = len(s)

    # 强制假用户：只要当前 member 的 name 不是 FAKE_NAME 就整体替换掉。
    # 用 name 做标记（而不是 endTime），这样无论 localStorage 里残留了什么
    # （包括以前注入过的带未来 endTime 的真实账户）都会被换成假用户；且首个
    # 赋值后 name 稳定，不会造成 Vue 无限重渲染。
    check = ('this.member?.name==="%s"?this.member:' % FAKE_NAME).encode()

    repls = [
        # (正则, 替换体左半部)  逐个匹配、等长替换
        (rb"isLogin\(\)\{[^}]*\}",        b'isLogin(){return!0'),
        (rb"isMemberValid\(\)\{[^}]*\}",
         b'isMemberValid(){return this.member=' + check + FAKE.encode() + b',!0'),
        (rb"logout\(\)\{[^}]*\}",         b'logout(){'),
    ]

    for pat, core in repls:
        ms = list(re.finditer(pat, s))
        if not ms:
            sys.exit("未找到模式（新版本代码结构变了？）: %s" % pat.decode())
        for m in reversed(ms):                     # 从后往前替换，偏移不失效
            s = s[:m.start()] + pad(core, m.end() - m.start()) + s[m.end():]
        print("  已替换 %d 处: %s" % (len(ms), pat.decode()))

    if len(s) != size:
        sys.exit("文件大小变化，已中止（未写入）")
    open(backend, "wb").write(s)
    print("完成，文件大小不变 (%d 字节)" % size)


def revert(backend: str):
    orig = backend + ".orig"
    if not os.path.exists(orig):
        sys.exit("没有备份文件: %s" % orig)
    shutil.copy2(orig, backend)
    print("已还原原始文件:", backend)


def kill():
    for im in ("HexHub.exe", "hexhub-backend.exe"):
        subprocess.run(["taskkill", "/F", "/IM", im],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)


def launch():
    subprocess.run([
        "powershell", "-NoProfile", "-Command",
        "Start-Process -FilePath '%s' -WorkingDirectory '%s'" % (
            HEXHUB_EXE, os.path.dirname(HEXHUB_EXE))
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("已启动 HexHub")


def main():
    backend = find_backend()
    print("后端:", backend)
    if "--revert" in sys.argv:
        revert(backend)
        return
    kill()
    patch(backend)
    launch()
    print("\n提示：假用户显示为 “User”。若面板仍显示旧账户，"
          "点一下顶部会员图标刷新，或重启一次应用。")


if __name__ == "__main__":
    main()
