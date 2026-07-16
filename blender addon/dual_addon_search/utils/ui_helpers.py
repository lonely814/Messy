"""【用途】UI 辅助函数 - 偏好设置重绘、分隔符、错误显示等"""

import bpy


def redraw_preferences() -> None:
    """重绘偏好设置面板"""
    wm = bpy.context.window_manager if bpy.context else None
    if not wm:
        return
    for window in wm.windows:
        screen = window.screen
        if not screen:
            continue
        for area in screen.areas:
            if area.type == "PREFERENCES":
                area.tag_redraw()


def prop_update(self, context) -> None:
    """属性更新回调"""
    redraw_preferences()


def safe_separator(layout, type_name: str = "LINE") -> None:
    """安全的分隔符"""
    try:
        layout.separator(type=type_name)
    except Exception:
        layout.separator()


def draw_error(layout, message: str) -> None:
    """绘制错误信息"""
    lines = message.split("\n")
    box = layout.box()
    sub = box.row()
    sub.label(text=lines[0])
    sub.label(icon="ERROR")
    for line in lines[1:]:
        box.label(text=line)


_WARNED_ONCE: set = set()


def warn_once(tag: str, message: str) -> None:
    """只打印一次警告"""
    if tag not in _WARNED_ONCE:
        _WARNED_ONCE.add(tag)
        print(f"[Dual Add-on Search] ⚠ {tag}: {message}")


def safe_text(value) -> str:
    """安全转换为字符串"""
    return "" if value is None else str(value)


def safe_get(info: dict, key: str, default=""):
    """安全获取字典值"""
    if info is None:
        return default
    return info.get(key, default)
