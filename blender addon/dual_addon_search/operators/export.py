"""【用途】导出操作器 - 快照导出 Markdown/JSON"""

import json
import datetime
import bpy
from bpy.props import StringProperty

from ..utils.search import safe_get


def _iter_addon_data():
    """迭代所有插件数据"""
    import addon_utils
    for mod in addon_utils.modules(refresh=False):
        info = addon_utils.module_bl_info(mod)
        mod_name = getattr(mod, "__name__", "")
        info_name = info.get("name", mod_name) if info else mod_name
        info_author = info.get("author", "") if info else ""
        info_ver = info.get("version", "")
        ver_str = ".".join(str(v) for v in info_ver) if isinstance(info_ver, (list, tuple)) else str(info_ver)
        yield (mod, info, mod_name, info_name, info_author, info_ver, ver_str)


class DUAL_FIRSTROW_OT_export_snapshot_markdown(bpy.types.Operator):
    """导出快照 (Markdown)"""
    bl_idname = "dual_firstrow_addon_search.export_snapshot_md"
    bl_label = "导出快照 (Markdown)"
    bl_description = "将插件列表以 Markdown 格式导出到剪贴板"
    bl_options = {"INTERNAL"}

    def execute(self, context):
        import addon_utils
        lines = []
        lines.append("# Blender Add-on Snapshot")
        lines.append("")
        lines.append(f"- Blender: {bpy.app.version_string}")
        lines.append(f"- Total: {len(context.preferences.addons)} enabled / {len(list(addon_utils.modules(refresh=False)))} installed")
        lines.append("")
        lines.append("## Enabled Add-ons")
        lines.append("")
        lines.append("| Name | Author | Version | Module |")
        lines.append("|------|--------|---------|--------|")
        enabled_modules = {ext.module for ext in context.preferences.addons}
        for _mod, _info, mod_name, info_name, info_author, _info_ver, ver_str in _iter_addon_data():
            if mod_name in enabled_modules:
                lines.append(f"| {info_name} | {info_author} | {ver_str} | `{mod_name}` |")
        lines.append("")
        lines.append("## Disabled Add-ons")
        lines.append("")
        lines.append("| Name | Author | Version | Module |")
        lines.append("|------|--------|---------|--------|")
        for _mod, _info, mod_name, info_name, info_author, _info_ver, ver_str in _iter_addon_data():
            if mod_name not in enabled_modules:
                lines.append(f"| {info_name} | {info_author} | {ver_str} | `{mod_name}` |")
        result = "\n".join(lines)

        context.window_manager.clipboard = result
        self.report({"INFO"}, f"已复制 {len(lines)} 行 Markdown 快照到剪贴板")
        return {"FINISHED"}


class DUAL_FIRSTROW_OT_export_snapshot_json(bpy.types.Operator):
    """导出快照 (JSON)"""
    bl_idname = "dual_firstrow_addon_search.export_snapshot_json"
    bl_label = "导出快照 (JSON)"
    bl_description = "将插件列表以 JSON 格式导出到文件"
    bl_options = {"INTERNAL"}

    filepath: StringProperty(subtype="FILE_PATH", default="")

    def invoke(self, context, event):
        now = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filepath = f"//addon_snapshot_{now}.json"
        context.window_manager.fileselect_add(self)
        return {"RUNNING_MODAL"}

    def execute(self, context):
        now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        data = {
            "export_time": now,
            "blender_version": bpy.app.version_string,
            "addons": [],
        }
        enabled_modules = {ext.module for ext in context.preferences.addons}
        for _mod, _info, mod_name, info_name, info_author, info_ver, _ver_str in _iter_addon_data():
            data["addons"].append({
                "name": info_name,
                "module": mod_name,
                "author": info_author,
                "version": info_ver,
                "description": safe_get(_info, "description", "") if _info else "",
                "enabled": mod_name in enabled_modules,
            })
        path = bpy.path.abspath(self.filepath)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        self.report({"INFO"}, f"快照已导出: {path}")
        return {"FINISHED"}


class DUAL_FIRSTROW_MT_export_menu(bpy.types.Menu):
    """导出菜单"""
    bl_label = "导出快照"
    bl_idname = "DUAL_FIRSTROW_MT_export_menu"

    def draw(self, context):
        layout = self.layout
        layout.label(text="导出插件快照", icon="EXPORT")
        layout.separator()
        layout.operator("dual_firstrow_addon_search.export_snapshot_md", text="Markdown (剪贴板)", icon="COPYDOWN")
        layout.operator("dual_firstrow_addon_search.export_snapshot_json", text="JSON (文件)", icon="FILE_TEXT")
