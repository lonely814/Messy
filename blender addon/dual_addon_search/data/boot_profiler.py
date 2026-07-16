"""【用途】启动耗时统计 - 使用 load_post handler 测量总体启动时间"""

import os
import json
import time
import bpy

BOOT_START = time.time()
BOOT_HISTORY_FILE: str = ""
_SNAPSHOT_SAVED = False
_HANDLER_REGISTERED = False


def _history_path() -> str:
    global BOOT_HISTORY_FILE
    if not BOOT_HISTORY_FILE:
        try:
            BOOT_HISTORY_FILE = os.path.join(bpy.utils.user_resource("SCRIPTS"), "dual_addon_boot_records.json")
        except Exception:
            BOOT_HISTORY_FILE = ""
    return BOOT_HISTORY_FILE


def _on_scene_loaded(dummy):
    """场景加载完成时记录总启动时间"""
    global _SNAPSHOT_SAVED, _HANDLER_REGISTERED
    elapsed = time.time() - BOOT_START
    save_snapshot(elapsed)
    try:
        if _on_scene_loaded in bpy.app.handlers.load_post:
            bpy.app.handlers.load_post.remove(_on_scene_loaded)
    except Exception:
        pass
    _HANDLER_REGISTERED = False


def register_handler():
    """注册 load_post handler"""
    global _HANDLER_REGISTERED
    if not _HANDLER_REGISTERED:
        if _on_scene_loaded not in bpy.app.handlers.load_post:
            bpy.app.handlers.load_post.append(_on_scene_loaded)
        _HANDLER_REGISTERED = True


def unregister_handler():
    """移除 load_post handler"""
    global _HANDLER_REGISTERED
    try:
        if _on_scene_loaded in bpy.app.handlers.load_post:
            bpy.app.handlers.load_post.remove(_on_scene_loaded)
    except Exception:
        pass
    _HANDLER_REGISTERED = False


def load_history() -> list:
    """加载历史启动记录"""
    path = _history_path()
    if not path or not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f).get("history", [])
    except Exception:
        return []


def save_snapshot(total_time: float):
    """保存本次启动快照"""
    global _SNAPSHOT_SAVED
    if _SNAPSHOT_SAVED:
        return
    history = load_history()
    sn = {
        "date": time.strftime("%Y-%m-%d %H:%M"),
        "blender": ".".join(str(v) for v in bpy.app.version),
        "total_boot_time": round(total_time, 4),
    }
    history.insert(0, sn)
    history = history[:20]
    path = _history_path()
    if not path:
        return
    try:
        d = os.path.dirname(path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"history": history}, f, indent=2, ensure_ascii=False)
    except Exception:
        pass
    _SNAPSHOT_SAVED = True


def read_total_boot_time() -> float:
    """读取最近一次的启动耗时"""
    history = load_history()
    if history:
        return history[0].get("total_boot_time", 0.0)
    return 0.0


def average_boot_time() -> float:
    """历史平均启动耗时"""
    history = load_history()
    times = [h.get("total_boot_time", 0) for h in history[:5] if h.get("total_boot_time")]
    return sum(times) / len(times) if times else 0.0


def trend_diff() -> tuple:
    """返回 (diff, current_boot_time)"""
    history = load_history()
    if len(history) < 2:
        return (0.0, 0.0)
    cur = history[0].get("total_boot_time", 0)
    prv = history[1].get("total_boot_time", 0)
    if cur == 0 or prv == 0:
        return (0.0, 0.0)
    return (cur - prv, cur)
