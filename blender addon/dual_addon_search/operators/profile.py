"""【用途】Profile 操作器 - 保存/加载/删除插件启用状态快照"""

import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences
from ..utils.i18n import _T
from ..data.profiles import profile_load_all, profile_save, profile_load, profile_delete


class DUAL_FIRSTROW_OT_profile_save(bpy.types.Operator):
    """保存 Profile"""
    bl_idname = "dual_firstrow_addon_search.profile_save"
    bl_label = "保存 Profile"
    bl_description = "将当前插件启用状态保存为命名快照"
    bl_options = {"INTERNAL"}

    profile_name: StringProperty(name=_T("Profile 名称", "Profile Name"), default="")

    def invoke(self, context, event):
        self.profile_name = ""
        return context.window_manager.invoke_props_dialog(self)

    def execute(self, context):
        name = self.profile_name.strip()
        if not name:
            self.report({"WARNING"}, _T("名称不能为空", "Name cannot be empty"))
            return {"CANCELLED"}
        enabled = [ext.module for ext in context.preferences.addons]
        profile_save(name, enabled)
        self.report({"INFO"}, _T(f'已保存 Profile: {name}', f'Saved profile: {name}'))
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_profile_load(bpy.types.Operator):
    """加载 Profile"""
    bl_idname = "dual_firstrow_addon_search.profile_load"
    bl_label = "加载 Profile"
    bl_description = "加载命名快照，启用/禁用插件匹配快照状态"
    bl_options = {"INTERNAL"}

    profile_name: StringProperty(options={"HIDDEN"})

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        target = profile_load(self.profile_name)
        if not target:
            self.report({"WARNING"}, _T(f'Profile "{self.profile_name}" 为空', f'Profile "{self.profile_name}" is empty'))
            return {"CANCELLED"}
        current = {ext.module for ext in context.preferences.addons}

        # 收集需要操作的插件
        to_enable = sorted(target - current)
        to_disable = sorted(current - target)
        total = len(to_enable) + len(to_disable)

        if total == 0:
            self.report({"INFO"}, _T("无变化", "No changes"))
            return {"FINISHED"}

        # 分批执行，避免循环内 ops 性能问题
        add_count = 0
        remove_count = 0
        batch_size = 10

        for batch_start in range(0, max(len(to_enable), len(to_disable)), batch_size):
            for mod_name in to_enable[batch_start:batch_start + batch_size]:
                try:
                    bpy.ops.preferences.addon_enable(module=mod_name)
                    add_count += 1
                except Exception:
                    pass
            for mod_name in to_disable[batch_start:batch_start + batch_size]:
                try:
                    bpy.ops.preferences.addon_disable(module=mod_name)
                    remove_count += 1
                except Exception:
                    pass

        redraw_preferences()
        self.report({"INFO"}, _T(
            f'已加载 Profile "{self.profile_name}"：启用 {add_count}，禁用 {remove_count}',
            f'Loaded profile "{self.profile_name}": enabled {add_count}, disabled {remove_count}'
        ))
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_profile_delete(bpy.types.Operator):
    """删除 Profile"""
    bl_idname = "dual_firstrow_addon_search.profile_delete"
    bl_label = "删除 Profile"
    bl_description = "删除一个已保存的快照"
    bl_options = {"INTERNAL"}

    profile_name: StringProperty(options={"HIDDEN"})

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        profile_delete(self.profile_name)
        redraw_preferences()
        self.report({"INFO"}, _T(f'已删除 Profile "{self.profile_name}"', f'Deleted profile "{self.profile_name}"'))
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_disable_non_starred(bpy.types.Operator):
    """关闭非收藏插件"""
    bl_idname = "dual_firstrow_addon_search.disable_non_starred"
    bl_label = "关闭非收藏插件"
    bl_description = "停用所有未被星标收藏的插件（星标插件保留）"
    bl_options = {"REGISTER", "INTERNAL"}

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        from ..data.tags import starred_load

        stars = starred_load()
        count = 0

        # 收集需要禁用的插件
        to_disable = [
            ext.module for ext in context.preferences.addons
            if ext.module not in stars
        ]

        if not to_disable:
            self.report({"INFO"}, _T("没有需要关闭的插件", "No addons to disable"))
            return {"FINISHED"}

        # 分批执行，避免循环内 ops 性能问题
        batch_size = 10
        for batch_start in range(0, len(to_disable), batch_size):
            batch = to_disable[batch_start:batch_start + batch_size]
            for mod_name in batch:
                try:
                    bpy.ops.preferences.addon_disable(module=mod_name)
                    count += 1
                except Exception:
                    pass

        redraw_preferences()
        self.report({"INFO"}, f"已关闭 {count} 个非收藏插件")
        return {"FINISHED"}


class DUAL_FIRSTROW_MT_profile_menu(bpy.types.Menu):
    """Profile 菜单"""
    bl_label = "Profile"
    bl_idname = "DUAL_FIRSTROW_MT_profile_menu"

    def draw(self, context):
        from ..data.profiles import profile_load_all
        layout = self.layout
        layout.label(text=_T("插件 Profile", "Addon Profiles"), icon="FILE_TEXT")
        layout.separator()
        layout.operator("dual_firstrow_addon_search.profile_save", icon="ADD")
        layout.separator()
        profiles = profile_load_all()
        if profiles:
            for name in sorted(profiles.keys()):
                count = len(profiles[name])
                row = layout.row(align=True)
                op = row.operator("dual_firstrow_addon_search.profile_load",
                                  text=f"{name} ({count})", icon="IMPORT")
                op.profile_name = name
                op = row.operator("dual_firstrow_addon_search.profile_delete", text="", icon="X")
                op.profile_name = name
        else:
            layout.label(text=_T("暂未保存 Profile", "No profiles saved"), icon="INFO")
