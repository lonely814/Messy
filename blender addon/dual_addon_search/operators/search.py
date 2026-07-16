"""【用途】搜索相关操作器 - 清空搜索、切换模式、搜索历史"""

import bpy
from bpy.props import StringProperty, IntProperty

from ..utils.ui_helpers import redraw_preferences
from ..data import history


class DUAL_FIRSTROW_OT_clear_search(bpy.types.Operator):
    """清空插件搜索"""
    bl_idname = "dual_firstrow_addon_search.clear"
    bl_label = "清空插件搜索"
    bl_description = "清空第一搜索框和第二搜索框"

    def execute(self, context):
        wm = context.window_manager
        if hasattr(wm, "addon_search"):
            wm.addon_search = ""
        if hasattr(wm, "dual_addon_search_second"):
            wm.dual_addon_search_second = ""
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_toggle_search_mode(bpy.types.Operator):
    """切换搜索模式"""
    bl_idname = "dual_firstrow_addon_search.toggle_mode"
    bl_label = "切换搜索模式"
    bl_description = "在「且」(AND) 和「或」(OR) 之间切换"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        wm = context.window_manager
        current = getattr(wm, "dual_addon_search_mode", "OR")
        wm.dual_addon_search_mode = "AND" if current == "OR" else "OR"
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_search_history_clear(bpy.types.Operator):
    """清除搜索历史"""
    bl_idname = "dual_firstrow_addon_search.search_history_clear"
    bl_label = "清除搜索历史"
    bl_description = "清除所有搜索历史记录"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        history.history_clear()
        self.report({"INFO"}, "搜索历史已清除")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_search_history_apply(bpy.types.Operator):
    """应用搜索历史"""
    bl_idname = "dual_firstrow_addon_search.search_history_apply"
    bl_label = "应用搜索历史"
    bl_description = "将搜索历史填入搜索框"
    bl_options = {"INTERNAL"}

    search_text: StringProperty(options={"HIDDEN"})
    search_index: IntProperty(default=0, options={"HIDDEN"})

    def execute(self, context):
        wm = context.window_manager
        wm.addon_search = self.search_text
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_MT_search_history(bpy.types.Menu):
    """搜索历史菜单"""
    bl_label = "搜索历史"
    bl_idname = "DUAL_FIRSTROW_MT_search_history"

    def draw(self, context):
        from ..utils.i18n import _T
        layout = self.layout
        layout.label(text=_T("搜索历史", "Search History"), icon="TIME")
        layout.separator()
        history_list = history.history_get()
        if not history_list:
            layout.label(text=_T("暂无搜索记录", "No recent searches"), icon="INFO")
            return
        for i, text in enumerate(history_list):
            op = layout.operator("dual_firstrow_addon_search.search_history_apply", text=text, icon="VIEWZOOM")
            op.search_text = text
            op.search_index = i
        layout.separator()
        layout.operator("dual_firstrow_addon_search.search_history_clear", icon="X")
