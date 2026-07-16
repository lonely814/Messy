"""【用途】标签操作器 - 标签 CRUD 和筛选"""

import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences
from ..utils.cache import _TAG_CACHE_DIRTY


def _mark_tag_dirty():
    """标记标签缓存为脏，下次绘制时重读磁盘"""
    _TAG_CACHE_DIRTY[0] = True


from ..data.tags import (
    tag_get, tag_set, tag_all_names, tag_addons_with_tag
)


class DUAL_FIRSTROW_OT_tag_toggle(bpy.types.Operator):
    """切换标签"""
    bl_idname = "dual_firstrow_addon_search.tag_toggle"
    bl_label = "切换标签"
    bl_description = "为插件添加或移除标签"
    bl_options = {"INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})
    tag_name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        tags = tag_get(self.module_name)
        if self.tag_name in tags:
            tags.remove(self.tag_name)
        else:
            tags.append(self.tag_name)
        tag_set(self.module_name, tags)
        _mark_tag_dirty()
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_tag_add_new(bpy.types.Operator):
    """新建标签"""
    bl_idname = "dual_firstrow_addon_search.tag_add_new"
    bl_label = "新建标签"
    bl_description = "创建一个新标签"
    bl_options = {"INTERNAL"}

    new_tag: StringProperty(name="标签名", default="")

    def invoke(self, context, event):
        self.new_tag = ""
        return context.window_manager.invoke_props_dialog(self)

    def execute(self, context):
        name = self.new_tag.strip()
        if not name:
            self.report({"WARNING"}, "标签名不能为空")
            return {"CANCELLED"}
        all_tags = tag_all_names()
        if name in all_tags:
            self.report({"WARNING"}, f'标签"{name}"已存在')
            return {"CANCELLED"}
        ctx_mod = getattr(context.window_manager, "dual_ctx_module", "")
        if ctx_mod:
            tags = tag_get(ctx_mod)
            if name not in tags:
                tags.append(name)
            tag_set(ctx_mod, tags)
        else:
            tag_set("__tags__", list(all_tags) + [name])
        _mark_tag_dirty()
        redraw_preferences()
        self.report({"INFO"}, f'已创建标签"{name}"')
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_tag_remove_global(bpy.types.Operator):
    """删除标签"""
    bl_idname = "dual_firstrow_addon_search.tag_remove_global"
    bl_label = "删除标签"
    bl_description = "从所有插件中移除该标签"
    bl_options = {"INTERNAL"}

    tag_name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        from ..data.tags import tag_load, tag_save, STARRED_KEY
        data = tag_load()
        changed = False
        for mod in list(data.keys()):
            if mod == STARRED_KEY:
                continue
            tags = data[mod]
            if self.tag_name in tags:
                tags.remove(self.tag_name)
                changed = True
            if not tags:
                del data[mod]
                changed = True
        if changed:
            tag_save(data)
        _mark_tag_dirty()
        redraw_preferences()
        self.report({"INFO"}, f'已删除标签"{self.tag_name}"')
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_tag_set_filter(bpy.types.Operator):
    """设置标签筛选"""
    bl_idname = "dual_firstrow_addon_search.tag_set_filter"
    bl_label = "设置标签筛选"
    bl_description = "按标签筛选插件列表"
    bl_options = {"INTERNAL"}

    filter_name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        context.window_manager.dual_tag_filter = self.filter_name
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_MT_tag_menu(bpy.types.Menu):
    """标签管理菜单"""
    bl_label = "标签"
    bl_idname = "DUAL_FIRSTROW_MT_tag_menu"

    def draw(self, context):
        layout = self.layout
        wm = context.window_manager
        ctx_mod = getattr(wm, "dual_ctx_module", "")
        current_tags = tag_get(ctx_mod) if ctx_mod else []
        all_tags = tag_all_names()

        layout.label(text="管理标签", icon="TAG")
        layout.separator()

        if all_tags:
            for tag in all_tags:
                icon = "CHECKBOX_HLT" if tag in current_tags else "CHECKBOX_DEHLT"
                op = layout.operator("dual_firstrow_addon_search.tag_toggle", text=tag, icon=icon)
                op.module_name = ctx_mod
                op.tag_name = tag
            layout.separator()

        layout.operator("dual_firstrow_addon_search.tag_add_new", text="新建标签", icon="ADD")
        if all_tags:
            layout.separator()
            layout.label(text="删除标签（全部移除）")
            for tag in all_tags:
                op = layout.operator("dual_firstrow_addon_search.tag_remove_global", text=tag, icon="X")
                op.tag_name = tag


class DUAL_FIRSTROW_MT_tag_filter_menu(bpy.types.Menu):
    """标签筛选菜单"""
    bl_label = "标签筛选"
    bl_idname = "DUAL_FIRSTROW_MT_tag_filter_menu"

    def draw(self, context):
        layout = self.layout
        wm = context.window_manager
        current = getattr(wm, "dual_tag_filter", "")
        all_tags = tag_all_names()

        layout.label(text="按标签筛选", icon="FILTER")
        layout.separator()

        icon = "CHECKBOX_HLT" if not current else "CHECKBOX_DEHLT"
        op = layout.operator("dual_firstrow_addon_search.tag_set_filter", text="全部", icon=icon)
        op.filter_name = ""

        if all_tags:
            layout.separator()
            for tag in all_tags:
                icon = "CHECKBOX_HLT" if current == tag else "CHECKBOX_DEHLT"
                op = layout.operator("dual_firstrow_addon_search.tag_set_filter", text=tag, icon=icon)
                op.filter_name = tag

        layout.separator()
        layout.operator("dual_firstrow_addon_search.tag_set_filter", text="清除筛选", icon="X").filter_name = ""
