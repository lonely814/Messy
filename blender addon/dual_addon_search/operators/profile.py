"""Profile 操作器 - 保存/加载/删除插件启用状态快照"""

import bpy
from bpy.props import EnumProperty, StringProperty

from ..utils.ui_helpers import redraw_preferences
from ..utils.i18n import _T
from ..data.profiles import profile_save, profile_load, profile_delete

_ADDON_MODULE = __package__.rsplit(".operators", 1)[0]


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
        try:
            profile_save(name, enabled)
        except OSError as ex:
            self.report({"ERROR"}, _T(f"保存失败: {ex}", f"Save failed: {ex}"))
            return {"CANCELLED"}
        self.report({"INFO"}, _T(f"已保存 Profile: {name}", f"Saved profile: {name}"))
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_profile_load(bpy.types.Operator):
    """加载 Profile"""
    bl_idname = "dual_firstrow_addon_search.profile_load"
    bl_label = "加载 Profile"
    bl_description = "预览并加载插件启用状态快照"
    bl_options = {"INTERNAL"}

    profile_name: StringProperty(options={"HIDDEN"})
    load_mode: EnumProperty(
        name="模式",
        items=[
            ("STRICT", "严格恢复", "启用 Profile 插件并禁用其他插件"),
            ("INCREMENTAL", "增量启用", "只启用 Profile 插件，不改变其他插件"),
        ],
        default="STRICT",
    )
    _target = None
    _current = None
    _missing = None

    def _prepare_preview(self, context):
        self._target = profile_load(self.profile_name)
        self._current = {ext.module for ext in context.preferences.addons}
        try:
            import addon_utils
            installed = {mod.__name__ for mod in addon_utils.modules(refresh=False)}
        except Exception:
            installed = set(self._target)
        self._missing = self._target - installed

    def invoke(self, context, event):
        self._prepare_preview(context)
        return context.window_manager.invoke_props_dialog(self)

    def draw(self, context):
        target = self._target or set()
        current = self._current or set()
        missing = self._missing or set()
        to_enable = target - current
        to_disable = (current - target) - {_ADDON_MODULE}
        layout = self.layout
        layout.label(
            text=f"启用 {len(to_enable)} · 禁用 {len(to_disable)} · 缺失 {len(missing)}",
            icon="INFO",
        )
        layout.prop(self, "load_mode", expand=True)
        if missing:
            layout.label(text="缺失: " + ", ".join(sorted(missing)[:5]), icon="ERROR")

    def execute(self, context):
        target = self._target if self._target is not None else profile_load(self.profile_name)
        if not target:
            self.report({"WARNING"}, _T(
                f'Profile "{self.profile_name}" 为空',
                f'Profile "{self.profile_name}" is empty',
            ))
            return {"CANCELLED"}

        current = {ext.module for ext in context.preferences.addons}
        to_enable = sorted(target - current)
        to_disable = sorted((current - target) - {_ADDON_MODULE}) if self.load_mode == "STRICT" else []
        if not to_enable and not to_disable:
            self.report({"INFO"}, _T("无变化", "No changes"))
            return {"FINISHED"}

        enabled_count = 0
        disabled_count = 0
        failed = []
        batch_size = 10
        for batch_start in range(0, max(len(to_enable), len(to_disable)), batch_size):
            for module_name in to_enable[batch_start:batch_start + batch_size]:
                try:
                    result = bpy.ops.preferences.addon_enable(module=module_name)
                    if "FINISHED" in result:
                        enabled_count += 1
                    else:
                        failed.append(module_name)
                except Exception:
                    failed.append(module_name)
            for module_name in to_disable[batch_start:batch_start + batch_size]:
                try:
                    result = bpy.ops.preferences.addon_disable(module=module_name)
                    if "FINISHED" in result:
                        disabled_count += 1
                    else:
                        failed.append(module_name)
                except Exception:
                    failed.append(module_name)

        redraw_preferences()
        if failed:
            self.report({"WARNING"}, _T(
                f"已加载 Profile：启用 {enabled_count}，禁用 {disabled_count}，失败 {len(failed)}",
                f"Profile loaded: enabled {enabled_count}, disabled {disabled_count}, failed {len(failed)}",
            ))
        else:
            self.report({"INFO"}, _T(
                f"已加载 Profile：启用 {enabled_count}，禁用 {disabled_count}",
                f"Profile loaded: enabled {enabled_count}, disabled {disabled_count}",
            ))
        if failed:
            print("[Dual Add-on Search] Profile operation failed: " + ", ".join(failed))
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
        try:
            profile_delete(self.profile_name)
        except OSError as ex:
            self.report({"ERROR"}, _T(f"删除失败: {ex}", f"Delete failed: {ex}"))
            return {"CANCELLED"}
        redraw_preferences()
        self.report({"INFO"}, _T(
            f'已删除 Profile "{self.profile_name}"',
            f'Deleted profile "{self.profile_name}"',
        ))
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
        to_disable = [
            ext.module for ext in context.preferences.addons
            if ext.module not in stars and ext.module != _ADDON_MODULE
        ]
        if not to_disable:
            self.report({"INFO"}, _T("没有需要关闭的插件", "No addons to disable"))
            return {"FINISHED"}

        count = 0
        failed = []
        for module_name in to_disable:
            try:
                result = bpy.ops.preferences.addon_disable(module=module_name)
                if "FINISHED" in result:
                    count += 1
                else:
                    failed.append(module_name)
            except Exception:
                failed.append(module_name)

        redraw_preferences()
        if failed:
            self.report({"WARNING"}, f"已关闭 {count} 个，失败 {len(failed)} 个")
            print("[Dual Add-on Search] Disable failed: " + ", ".join(failed))
        else:
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
                op = row.operator(
                    "dual_firstrow_addon_search.profile_load",
                    text=f"{name} ({count})",
                    icon="IMPORT",
                )
                op.profile_name = name
                op = row.operator("dual_firstrow_addon_search.profile_delete", text="", icon="X")
                op.profile_name = name
        else:
            layout.label(text=_T("暂未保存 Profile", "No profiles saved"), icon="INFO")
