#!/usr/bin/env python3
"""部署前后数据指纹比对模板（IC-main 部署铁律的脚本化）。

用法（在服务器上跑，或本机经 ssh）：
  python deploy-fingerprint.py /srv/data/Infinite-Canvas-main            # 部署前
  python deploy-fingerprint.py /srv/data/Infinite-Canvas-main --save before.json
  python deploy-fingerprint.py /srv/data/Infinite-Canvas-main --diff before.json

比对内容：画布数 / 资产数 / workflows 数 + 关键 JSON 文件 md5。
铁律：assets 差值先看时间戳分辨是否用户自己生成；rsync 不带 --delete；数据目录只读。
"""
import hashlib
import json
import os
import sys
import time

def md5(path, cap=8 * 1024 * 1024):
    h = hashlib.md5()
    with open(path, "rb") as f:
        h.update(f.read(cap))
    return h.hexdigest()

def fingerprint(root):
    data = os.path.join(root, "data")
    out = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), "counts": {}, "md5": {}}
    # 画布数
    cv = os.path.join(data, "canvases")
    out["counts"]["canvases"] = len([f for f in os.listdir(cv) if f.endswith(".json")]) if os.path.isdir(cv) else -1
    # 资产数
    for key, rel in (("assets", "assets"), ("workflows", "workflows")):
        p = os.path.join(root, rel)
        out["counts"][key] = sum(len(fs) for _, _, fs in os.walk(p)) if os.path.isdir(p) else -1
    # 关键文件 md5（存在才记）
    for name in ("projects.json", "asset_library.json", "prompt_libraries.json", "api_providers.json", "history.json"):
        p = os.path.join(data, name)
        if os.path.isfile(p):
            out["md5"][name] = md5(p)
    return out

def diff(a, b):
    for k in a["counts"]:
        if a["counts"][k] != b["counts"][k]:
            print(f"  counts.{k}: {a['counts'][k]} -> {b['counts'][k]}")
    for k in a["md5"]:
        if a["md5"].get(k) != b["md5"].get(k):
            print(f"  md5.{k}: CHANGED")
    print("（差值均为用户自己生成的属正常，按文件时间戳确认）")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    fp = fingerprint(sys.argv[1])
    print(json.dumps(fp, ensure_ascii=False, indent=2))
    if "--save" in sys.argv:
        dst = sys.argv[sys.argv.index("--save") + 1]
        with open(dst, "w", encoding="utf-8") as f:
            json.dump(fp, f, ensure_ascii=False, indent=2)
        print(f"saved -> {dst}")
    if "--diff" in sys.argv:
        with open(sys.argv[sys.argv.index("--diff") + 1], encoding="utf-8") as f:
            diff(json.load(f), fp)
