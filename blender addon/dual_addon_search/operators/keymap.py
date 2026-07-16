"""【用途】快捷键捕获 modal 操作器 - 点击搜索框后按快捷键自动搜索"""

import bpy

from ..utils.ui_helpers import redraw_preferences


def _is_pure_modifier_event(event_type: str) -> bool:
    """判断是否为纯修饰键"""
    return event_type in {
        "LEFT_CTRL", "RIGHT_CTRL",
        "LEFT_SHIFT", "RIGHT_SHIFT",
        "LEFT_ALT", "RIGHT_ALT",
        "OSKEY", "LEFT_OSKEY", "RIGHT_OSKEY",
        "HYPER",
    }


def _event_type_to_search_token(event_type: str) -> str:
    """事件类型转搜索文本"""
    mouse_alias = {
        "LEFTMOUSE": "LMB",
        "RIGHTMOUSE": "RMB",
        "MIDDLEMOUSE": "MMB",
    }
    return mouse_alias.get(event_type, event_type)


def _event_to_dual_keymap_text(event) -> str:
    """把用户按下的快捷键事件转成 Key-Binding 搜索文本"""
    import sys
    event_type = getattr(event, "type", "")
    if not event_type:
        return ""

    parts = []

    if not _is_pure_modifier_event(event_type):
        if getattr(event, "ctrl", False):
            parts.append("Ctrl")
        if getattr(event, "shift", False):
            parts.append("Shift")
        if getattr(event, "alt", False):
            parts.append("Alt")
        if getattr(event, "oskey", False):
            parts.append("Cmd" if sys.platform == "darwin" else "OSKey")
        if getattr(event, "hyper", False):
            parts.append("Hyper")

    parts.append(_event_type_to_search_token(event_type))
    return " ".join(parts).strip()


def _normalize_event_type(event_type: str) -> str:
    """事件名统一格式"""
    value = (event_type or "").upper().strip()
    aliases = {
        "LMB": "LEFTMOUSE",
        "RMB": "RIGHTMOUSE",
        "MMB": "MIDDLEMOUSE",
        "CMD": "OSKEY",
        "COMMAND": "OSKEY",
        "WINDOWS": "OSKEY",
        "WIN": "OSKEY",
    }
    return aliases.get(value, value)


def _bool_attr(value) -> bool:
    """兼容不同 Blender 版本里修饰键属性"""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value > 0
    if isinstance(value, str):
        return value.upper() in {"TRUE", "ON", "PRESS", "PRESSED", "1", "YES"}
    return bool(value)


def _modifier_state(value):
    """返回修饰键状态：True / False / None"""
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        if value < 0:
            return None
        return value > 0
    if isinstance(value, str):
        upper = value.upper()
        if upper in {"ANY", "ANY_MOD", "-1"}:
            return None
        return upper in {"TRUE", "ON", "PRESS", "PRESSED", "1", "YES"}
    return bool(value)


def _shortcut_signature(event_type: str, ctrl=False, shift=False, alt=False, oskey=False, hyper=False) -> str:
    """生成快捷键签名"""
    return "|".join((
        _normalize_event_type(event_type),
        "C%d" % bool(ctrl),
        "S%d" % bool(shift),
        "A%d" % bool(alt),
        "O%d" % bool(oskey),
        "H%d" % bool(hyper),
    ))


def _event_to_exact_signature(event) -> str:
    """记录捕获到的完整快捷键签名"""
    return _shortcut_signature(
        getattr(event, "type", ""),
        getattr(event, "ctrl", False),
        getattr(event, "shift", False),
        getattr(event, "alt", False),
        getattr(event, "oskey", False),
        getattr(event, "hyper", False),
    )


def _normalize_shortcut_text(text: str) -> str:
    """标准化快捷键显示文本（用于 keymap draw 过滤匹配）"""
    if not text:
        return ""
    parts = text.strip().split()
    normalized = []
    for part in parts:
        upper = part.upper()
        alias_map = {
            "LMB": "LEFTMOUSE",
            "RMB": "RIGHTMOUSE",
            "MMB": "MIDDLEMOUSE",
            "CTRL": "CTRL",
            "SHIFT": "SHIFT",
            "ALT": "ALT",
            "CMD": "OSKEY",
            "COMMAND": "OSKEY",
            "WIN": "OSKEY",
            "WINDOWS": "OSKEY",
        }
        normalized.append(alias_map.get(upper, part))
    return " ".join(normalized)


class DUAL_FIRSTROW_OT_keymap_capture(bpy.types.Operator):
    """快捷键搜索输入框"""
    bl_idname = "dual_firstrow_addon_search.keymap_capture"
    bl_label = "快捷键搜索输入框"
    bl_description = "点击 Key-Binding 搜索框后按下快捷键，自动填入并执行搜索"

    def _finish_capture(self, context):
        try:
            context.window_manager.dual_keymap_capture_active = False
        except Exception:
            pass
        redraw_preferences()

    def invoke(self, context, event):
        # 获取偏好设置空间
        spref = None
        try:
            spref = context.space_data
            if spref and spref.type != "PREFERENCES":
                spref = None
        except Exception:
            spref = None

        if spref is None:
            # 尝试查找
            wm = context.window_manager
            for window in wm.windows:
                screen = window.screen
                if not screen:
                    continue
                for area in screen.areas:
                    if area.type == "PREFERENCES":
                        for space in area.spaces:
                            if space.type == "PREFERENCES":
                                spref = space
                                break
                        if spref:
                            break
                if spref:
                    break

        if spref is None:
            self.report({"WARNING"}, "请先打开偏好设置窗口")
            return {"CANCELLED"}

        # 切换到 KEY 过滤模式
        try:
            context.preferences.active_section = "KEYMAP"
        except Exception:
            pass

        try:
            spref.filter_type = "KEY"
        except Exception:
            pass

        try:
            context.window_manager.dual_keymap_capture_active = True
        except Exception:
            pass

        context.window_manager.modal_handler_add(self)
        redraw_preferences()
        self.report({"INFO"}, "请按下要搜索的快捷键，按 Esc 取消")
        return {"RUNNING_MODAL"}

    def modal(self, context, event):
        event_type = getattr(event, "type", "")
        event_value = getattr(event, "value", "")

        if event_type == "ESC" and event_value == "PRESS":
            self._finish_capture(context)
            self.report({"INFO"}, "已取消快捷键搜索")
            return {"CANCELLED"}

        if event_value != "PRESS":
            return {"RUNNING_MODAL"}

        if event_type in {
            "MOUSEMOVE",
            "INBETWEEN_MOUSEMOVE",
            "TIMER",
            "NONE",
            "WINDOW_DEACTIVATE",
        }:
            return {"RUNNING_MODAL"}

        if _is_pure_modifier_event(event_type):
            return {"RUNNING_MODAL"}

        search_text = _event_to_dual_keymap_text(event)
        if not search_text:
            return {"RUNNING_MODAL"}

        exact_signature = _event_to_exact_signature(event)
        try:
            context.window_manager.dual_keymap_exact_text = search_text
            context.window_manager.dual_keymap_exact_signature = exact_signature
        except Exception:
            pass

        # 设置搜索过滤
        spref = None
        try:
            spref = context.space_data
            if spref and spref.type != "PREFERENCES":
                spref = None
        except Exception:
            spref = None

        if spref is None:
            self._finish_capture(context)
            self.report({"WARNING"}, "无法找到偏好设置空间")
            return {"CANCELLED"}

        try:
            spref.filter_text = search_text
        except Exception:
            self._finish_capture(context)
            self.report({"WARNING"}, "写入 Key-Binding 搜索失败")
            return {"CANCELLED"}

        self._finish_capture(context)
        self.report({"INFO"}, "已搜索快捷键: %s" % search_text)
        return {"FINISHED"}

    def cancel(self, context):
        self._finish_capture(context)
