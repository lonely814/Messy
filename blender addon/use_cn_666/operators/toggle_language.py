"""语言切换算子"""
import bpy
from bpy.types import Operator


class OT_toggle_cn(Operator):
    bl_idname = "ui.toggle_cn"
    bl_label = "中英切换"
    bl_options = {'REGISTER', 'UNDO'}
    bl_description = "点击切换中英文，按住ALT点击可进行更新!"

    workspace_en = {
        "Animation": "动画", "Compositing": "合成", "Geometry Nodes": "几何节点",
        "Layout": "布局", "Modeling": "建模", "Rendering": "渲染",
        "Scripting": "脚本", "Sculpting": "雕刻", "Shading": "着色",
        "Texture Paint": "纹理绘制", "UV Editing": "UV编辑",
    }
    workspace_cn = {v: k for k, v in workspace_en.items()}

    def invoke(self, context, event):
        from .. import _root
        if event.alt:
            msg, op = ("开始更新汉化包...", 'INVOKE_DEFAULT') if _root.up_ok else ("当前没有可用更新", None)
            if op:
                bpy.ops.ftp.u_a()
            self.report({'INFO'}, msg)
            return {'FINISHED'}
        return self.execute(context)

    def execute(self, context):
        prefs = context.preferences
        current = prefs.view.use_translate_interface
        prefs.view.use_translate_interface = not current
        prefs.view.use_translate_tooltips = not current
        name_map = self.workspace_cn if current else self.workspace_en
        for workspace in bpy.data.workspaces:
            for old_name, new_name in name_map.items():
                if old_name in workspace.name:
                    workspace.name = workspace.name.replace(old_name, new_name)
                    break
        return {'FINISHED'}


def draw_language_menu(self, context):
    """在 TOPBAR 菜单中绘制语言切换入口"""
    from .. import _root
    layout = self.layout
    prefs = context.preferences
    c_e = prefs.view.use_translate_interface
    z_str = str(_root.z_time) if _root.z_time else ""
    xi = _root.up_ok and len(z_str) == 7
    big = _root.up_ok and len(z_str) == 8
    split = layout.split(factor=0.0001)
    split.column()
    col = split.column(align=True)
    col.scale_x, col.scale_y = 0.82, 0.85
    col.separator(factor=0.5)
    col.alert = big
    if c_e:
        col.operator("ui.toggle_cn", text="F5切英文", depress=xi)
    else:
        col.operator("ui.toggle_cn", text="F5切中文", depress=xi)


language_keymap_items = []


def _toggle_interface_language():
    """直接切换界面语言（避免 bpy.ops.ui.toggle_cn 在非算子上下文的调用）"""
    prefs = bpy.context.preferences if bpy.context else None
    if not prefs or not prefs.view:
        return
    current = prefs.view.use_translate_interface
    prefs.view.use_translate_interface = not current
    prefs.view.use_translate_tooltips = not current
    name_map = OT_toggle_cn.workspace_cn if current else OT_toggle_cn.workspace_en
    for workspace in bpy.data.workspaces:
        for old_name, new_name in name_map.items():
            if old_name in workspace.name:
                workspace.name = workspace.name.replace(old_name, new_name)
                break


def register_keymap():
    """注册 F5 快捷键"""
    wm = bpy.context.window_manager if bpy.context else None
    if not wm:
        return []
    kc = wm.keyconfigs.addon
    if not kc:
        return []
    km = kc.keymaps.new(name="Window", space_type='EMPTY')
    kmi = km.keymap_items.new("ui.toggle_cn", type='F5', value='PRESS')
    return [(km, kmi)]
