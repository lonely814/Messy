"""当前搜索结果批量启用/禁用。"""

import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences

_ADDON_MODULE = __package__.rsplit(".operators", 1)[0]
_VISIBLE_MODULES: list[str] = []


def set_visible_modules(names) -> None:
    _VISIBLE_MODULES[:] = (name for name in names if name != _ADDON_MODULE)


def _names(raw: str) -> list[str]:
    return [name for name in raw.split("\n") if name and name != _ADDON_MODULE]


def _save(wm, names: list[str]) -> None:
    wm.dual_batch_selected = "\n".join(sorted(set(names)))


def _selected(wm) -> list[str]:
    return _names(getattr(wm, "dual_batch_selected", ""))


class DUAL_FIRSTROW_OT_batch_toggle_select(bpy.types.Operator):
    bl_idname = "dual_firstrow_addon_search.batch_toggle_select"
    bl_label = "选择插件"
    bl_description = "选择或取消选择当前插件"
    bl_options = {"INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        names = _selected(context.window_manager)
        if self.module_name in names:
            names.remove(self.module_name)
        else:
            names.append(self.module_name)
        _save(context.window_manager, names)
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_batch_select_all(bpy.types.Operator):
    bl_idname = "dual_firstrow_addon_search.batch_select_all"
    bl_label = "全选当前结果"
    bl_description = "选择当前搜索和筛选结果中的全部插件"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        wm = context.window_manager
        _save(wm, _VISIBLE_MODULES)
        redraw_preferences()
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_batch_clear(bpy.types.Operator):
    bl_idname = "dual_firstrow_addon_search.batch_clear"
    bl_label = "清空选择"
    bl_description = "清空批量选择"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        _save(context.window_manager, [])
        redraw_preferences()
        return {"FINISHED"}


class _BatchAddonOperator(bpy.types.Operator):
    bl_options = {"REGISTER", "INTERNAL"}
    enable = True

    def invoke(self, context, event):
        return context.window_manager.invoke_confirm(self, event)

    def execute(self, context):
        wm = context.window_manager
        selected = _selected(wm)
        failed = []
        changed = 0
        op = bpy.ops.preferences.addon_enable if self.enable else bpy.ops.preferences.addon_disable
        for module_name in selected:
            try:
                result = op(module=module_name)
                if "FINISHED" in result:
                    changed += 1
                else:
                    failed.append(module_name)
            except Exception:
                failed.append(module_name)
        _save(wm, [])
        redraw_preferences()
        action = "启用" if self.enable else "禁用"
        if failed:
            self.report({"WARNING"}, f"{action} {changed} 个，失败 {len(failed)} 个: {', '.join(failed[:5])}")
        else:
            self.report({"INFO"}, f"{action} {changed} 个插件")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_batch_enable(_BatchAddonOperator):
    bl_idname = "dual_firstrow_addon_search.batch_enable"
    bl_label = "批量启用"
    bl_description = "启用选中的插件"
    enable = True


class DUAL_FIRSTROW_OT_batch_disable(_BatchAddonOperator):
    bl_idname = "dual_firstrow_addon_search.batch_disable"
    bl_label = "批量禁用"
    bl_description = "禁用选中的插件"
    enable = False
