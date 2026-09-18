import bpy

class PL_OT_open_preferences(bpy.types.Operator):
    """打开插件偏好设置"""
    bl_idname = "playblast_puls.open_preferences"
    bl_label = "偏好设置"
    bl_options = {'REGISTER', 'UNDO'}


    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):
        bpy.ops.screen.userpref_show('INVOKE_DEFAULT')
        context.preferences.active_section = 'ADDONS'
        context.window_manager.addon_search = "Puls"
        return{'FINISHED'}

##############################################
# REGISTER/UNREGISTER
##############################################
def register():
    bpy.utils.register_class(PL_OT_open_preferences)


def unregister():
    bpy.utils.unregister_class(PL_OT_open_preferences)