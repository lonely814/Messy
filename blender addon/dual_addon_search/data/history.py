"""搜索历史管理：输入稳定后持久化最近搜索。"""

import os
import time
import bpy

from .json_store import load_json, save_json

_HISTORY: list[str] = []
_HISTORY_MAX = 20
_PENDING: tuple[str, ...] = ()
_PENDING_AT = 0.0
_TIMER_RUNNING = False
_DEBOUNCE_SECONDS = 0.8


def _history_path() -> str:
    try:
        return os.path.join(bpy.utils.user_resource("SCRIPTS"), "dual_addon_search_history.json")
    except Exception:
        return ""


def history_load() -> list[str]:
    data = load_json(_history_path(), [])
    return [item for item in data if isinstance(item, str) and item.strip()][:_HISTORY_MAX]


def history_save(history: list[str] | None = None) -> None:
    save_json(_history_path(), (history if history is not None else _HISTORY)[:_HISTORY_MAX])


def history_record(text: str) -> None:
    text = text.strip()
    if not text:
        return
    if text in _HISTORY:
        _HISTORY.remove(text)
    _HISTORY.insert(0, text)
    del _HISTORY[_HISTORY_MAX:]


def _flush_pending() -> None:
    global _PENDING
    pending, _PENDING = _PENDING, ()
    for text in pending:
        history_record(text)
    if pending:
        history_save()


def _timer_callback():
    global _TIMER_RUNNING
    remaining = _DEBOUNCE_SECONDS - (time.monotonic() - _PENDING_AT)
    if remaining > 0:
        return remaining
    try:
        _flush_pending()
    except OSError as ex:
        print(f"[Dual Add-on Search] 保存搜索历史失败: {ex}")
    _TIMER_RUNNING = False
    return None


def history_schedule(*texts: str) -> None:
    """防抖记录当前搜索词，避免逐键写盘和保存中间词。"""
    global _PENDING, _PENDING_AT, _TIMER_RUNNING
    _PENDING = tuple(text.strip() for text in texts if text and text.strip())
    _PENDING_AT = time.monotonic()
    if _PENDING and not _TIMER_RUNNING:
        bpy.app.timers.register(_timer_callback, first_interval=_DEBOUNCE_SECONDS)
        _TIMER_RUNNING = True


def history_flush() -> None:
    """注销前保存尚未到防抖时间的搜索。"""
    global _TIMER_RUNNING
    if _TIMER_RUNNING and bpy.app.timers.is_registered(_timer_callback):
        bpy.app.timers.unregister(_timer_callback)
    _TIMER_RUNNING = False
    _flush_pending()


def history_clear() -> None:
    global _PENDING, _TIMER_RUNNING
    _HISTORY.clear()
    _PENDING = ()
    if _TIMER_RUNNING and bpy.app.timers.is_registered(_timer_callback):
        bpy.app.timers.unregister(_timer_callback)
    _TIMER_RUNNING = False
    path = _history_path()
    if path and os.path.exists(path):
        os.remove(path)


def history_get() -> list[str]:
    return _HISTORY


def history_init() -> None:
    global _HISTORY, _PENDING, _TIMER_RUNNING
    _HISTORY = history_load()
    _PENDING = ()
    _TIMER_RUNNING = False
