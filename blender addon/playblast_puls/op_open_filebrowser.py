import bpy
import os
import pathlib

from . import op_playblast


def not_saved(self, context):
    self.layout.label(text="请先保存当前 blend 文件。")
def folder_popup(self, context):
    self.layout.label(text="请先执行一次 Playblast 以生成输出文件夹。")

class PL_OT_open_filebrowser(bpy.types.Operator):
    """打开 Playblast 输出文件夹"""
    bl_idname = "playblast_puls.open_filebrowser"
    bl_label = "打开 Playblast 文件夹"
    bl_options = {'REGISTER', 'UNDO'}

    # Prevents operator appearing in unsupported editors
    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):

        if not bpy.data.is_saved:
            context.window_manager.popup_menu(not_saved, title="文件未保存", icon='ERROR')
        else:
            prefs = context.preferences.addons[__package__].preferences

            # Same folder rule as the render, so this opens where the video went
            output_dir = op_playblast.get_output_dir(context, prefs)

            # Absolute path
            sane_path = lambda p: os.path.abspath(bpy.path.abspath(p))
            abs_output_dir = sane_path(output_dir)

            try:
                bpy.ops.wm.path_open(filepath=str(pathlib.Path(abs_output_dir)))
            except Exception:
                title = f"文件夹不存在: {abs_output_dir}"
                context.window_manager.popup_menu(folder_popup, title=title, icon='ERROR')

        return{'FINISHED'}

    
##############################################
# REGISTER/UNREGISTER
##############################################
def register():
    bpy.utils.register_class(PL_OT_open_filebrowser)

def unregister():
    bpy.utils.unregister_class(PL_OT_open_filebrowser)