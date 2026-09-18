#!/usr/bin/env python3
"""【用途】Dual Addon Search 发布脚本 — 版本号单一来源 + 一致性校验 + 打包

用法（在插件目录下运行）：
  python build.py             # 校验版本一致性（不修改任何文件）
  python build.py --sync      # 把 VERSION 同步到 __init__.py / blender_manifest.toml / DEVELOPMENT.md
  python build.py --package   # 校验 + 清理 __pycache__ + 打 zip 到 dist/（校验不过则拒绝打包）

版本号只需修改本文件顶部 VERSION 一处。
"""

import os
import re
import sys
import shutil
import tomllib
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")

# ==================== 唯一版本号来源 ====================
VERSION = (3, 3, 0)
# ========================================================

VER_STR = ".".join(str(v) for v in VERSION)
VER_TUPLE = ", ".join(str(v) for v in VERSION)
PKG_ID = "dual_addon_search"


def _ver_of(text, pattern, flags):
    """提取匹配文本中的版本号（取所有数字段拼接）"""
    m = re.search(pattern, text, flags)
    if not m:
        return None
    return ".".join(re.findall(r"\d+", m.group(0)))


# 各位置：文件名, 正则, 生成新匹配文本, 标志
# 注意：替换文本只覆盖正则匹配的部分，不要带行首缩进/行尾逗号（原文件会保留）
CHECKS = [
    ("__init__.py",
     r'"version": \([\d, ]+\)',
     lambda: '"version": (%s)' % VER_TUPLE, 0),
    ("__init__.py",
     r'VERSION = \([\d, ]+\)',
     lambda: 'VERSION = (%s)' % VER_TUPLE, 0),
    ("blender_manifest.toml",
     r'^version = "[\d.]+"',
     lambda: 'version = "%s"' % VER_STR, re.M),
    (os.path.join(".doc", "DEVELOPMENT.md"),
     r'> 版本：[\d.]+',
     lambda: "> 版本：" + VER_STR, 0),
    (os.path.join(".doc", "DEVELOPMENT.md"),
     r'^\| [\d.]+ \|',  # 版本历史表最新一行（新→旧排列）
     lambda: "| %s |" % VER_STR, re.M),
]


def _read(rel):
    with open(os.path.join(ROOT, rel), "r", encoding="utf-8", newline="") as f:
        return f.read()


def _write(rel, text):
    with open(os.path.join(ROOT, rel), "w", encoding="utf-8", newline="") as f:
        f.write(text)


def check(verbose=True):
    """返回 (是否全部一致, 报告行列表)"""
    ok = True
    report = []

    for base, _dirs, files in os.walk(ROOT):
        if "__pycache__" in base or os.path.commonpath([base, DIST]) == DIST:
            continue
        for name in files:
            if not name.endswith(".py"):
                continue
            path = os.path.join(base, name)
            rel = os.path.relpath(path, ROOT)
            try:
                compile(_read(rel), rel, "exec")
            except (OSError, SyntaxError) as ex:
                ok = False
                report.append("[XX] %s: Python 校验失败 (%s)" % (rel, ex))

    try:
        with open(os.path.join(ROOT, "blender_manifest.toml"), "rb") as file:
            manifest = tomllib.load(file)
        unknown_permissions = set(manifest.get("permissions", {})) - {
            "camera", "clipboard", "network", "microphone", "files"
        }
        if unknown_permissions:
            ok = False
            report.append("[XX] blender_manifest.toml: 未知权限 %s" % sorted(unknown_permissions))
    except (OSError, tomllib.TOMLDecodeError) as ex:
        ok = False
        report.append("[XX] blender_manifest.toml: TOML 校验失败 (%s)" % ex)
    for rel, pattern, _make, flags in CHECKS:
        try:
            text = _read(rel)
        except OSError as ex:
            ok = False
            report.append("[XX] %s: 无法读取 (%s)" % (rel, ex))
            continue
        if rel.endswith(".py"):
            # 语法校验：防版本同步把 py 文件改坏（如尾逗号重复）
            try:
                compile(text, rel, "exec")
            except SyntaxError as ex:
                ok = False
                report.append("[XX] %s: 语法错误 (%s)" % (rel, ex))
                continue
        cur = _ver_of(text, pattern, flags)
        if cur is None:
            ok = False
            report.append("[XX] %s: 未找到版本位置" % rel)
        elif cur != VER_STR:
            ok = False
            report.append("[XX] %s: 版本 %s != 期望 %s" % (rel, cur, VER_STR))
        elif verbose:
            report.append("[OK] %s: %s" % (rel, cur))
    return ok, report


def sync():
    changed = []
    for rel, pattern, make, flags in CHECKS:
        text = _read(rel)
        new_text, n = re.subn(pattern, make(), text, count=1, flags=flags)
        if n:
            _write(rel, new_text)
            changed.append(rel)
    return changed


def package():
    """校验 + 清理 pycache + 打 zip"""
    ok, report = check(verbose=False)
    if not ok:
        print("打包前校验未通过，拒绝打包：")
        for line in report:
            print("  " + line)
        return False
    # 清理 __pycache__
    removed = 0
    for base, _dirs, _files in os.walk(ROOT):
        if "__pycache__" in base:
            shutil.rmtree(base)
            removed += 1
    # 收集要打包的文件（相对路径，跳过 build.py / dist / __pycache__）
    files_to_pack = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "dist")]
        for name in files:
            if name == "build.py":
                continue
            rel = os.path.relpath(os.path.join(base, name), ROOT)
            files_to_pack.append(rel)
    # 保留单层目录，Blender 扩展校验兼容根目录和单层目录两种结构。
    os.makedirs(DIST, exist_ok=True)
    zip_name = "%s-%s.zip" % (PKG_ID, VER_STR)
    zip_path = os.path.join(DIST, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for rel in sorted(files_to_pack):
            zf.write(os.path.join(ROOT, rel), os.path.join(PKG_ID, rel))
    print("[OK] 已清理 __pycache__（%d 处）" % removed)
    print("[OK] 已打包: %s (%d 个文件)" % (zip_path, len(files_to_pack)))
    return True


def main():
    args = sys.argv[1:]
    if "--sync" in args:
        changed = sync()
        print("已同步版本 %s 到: %s" % (VER_STR, ", ".join(changed) if changed else "(无变化)"))
        ok, report = check()
    elif "--package" in args:
        if not package():
            sys.exit(1)
        return
    else:
        ok, report = check()
        print("版本号单一来源: VERSION = %s" % (VERSION,))
        for line in report:
            print("  " + line)
        if not ok:
            print("\n不一致！运行 `python build.py --sync` 同步，或直接修改 build.py 顶部 VERSION。")
            sys.exit(1)
        print("\n[OK] 全部一致")


if __name__ == "__main__":
    main()
