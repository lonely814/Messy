"""【用途】搜索历史管理 - 记录和回溯最近搜索"""

import os
import json
import bpy

_HISTORY: list = []
_HISTORY_MAX: int = 20


def _history_path() -> str:
    """获取历史文件路径"""
    try:
        return os.path.join(bpy.utils.user_resource("SCRIPTS"), "dual_addon_search_history.json")
    except Exception:
        return ""


def history_load() -> list:
    """加载搜索历史"""
    path = _history_path()
    if not path or not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)[:_HISTORY_MAX]
    except Exception:
        return []


def history_save(history: list) -> None:
    """保存搜索历史"""
    path = _history_path()
    if not path:
        return
    try:
        d = os.path.dirname(path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(history[:_HISTORY_MAX], f, ensure_ascii=False)
    except Exception:
        pass


def history_append_save(text: str, history: list = None) -> None:
    """添加搜索历史并保存到磁盘"""
    text = text.strip()
    if not text:
        return
    if history is None:
        history = _HISTORY
    if text in history:
        history.remove(text)
    history.insert(0, text)
    history[:] = history[:_HISTORY_MAX]
    history_save(history)


def history_record(text: str) -> None:
    """仅记录到内存，不写磁盘（供 draw 高频调用）"""
    text = text.strip()
    if not text:
        return
    if text in _HISTORY:
        _HISTORY.remove(text)
    _HISTORY.insert(0, text)
    _HISTORY[:] = _HISTORY[:_HISTORY_MAX]


def history_append(text: str, history: list = None) -> None:
    """添加搜索历史"""
    text = text.strip()
    if not text:
        return
    if history is None:
        history = _HISTORY
    if text in history:
        history.remove(text)
    history.insert(0, text)
    history[:] = history[:_HISTORY_MAX]
    history_save(history)


def history_clear() -> None:
    """清空搜索历史"""
    global _HISTORY
    _HISTORY.clear()
    path = _history_path()
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass


def history_get() -> list:
    """获取当前历史列表"""
    return _HISTORY


def history_init() -> None:
    """初始化历史（启动时调用）"""
    global _HISTORY
    _HISTORY = history_load()
