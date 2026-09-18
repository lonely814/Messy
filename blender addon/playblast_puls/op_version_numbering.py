import bpy

class PL_OT_recover_version(bpy.types.Operator):
    """重置版本号"""
    bl_idname = "playblast_puls.recover_version"
    bl_label = "重置版本号"
    bl_options = {'REGISTER', 'UNDO'}

    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):
        context.scene.version_number = 1
        return{'FINISHED'}

class PL_OT_increase_version(bpy.types.Operator):
    """增加版本号"""
    bl_idname = "playblast_puls.increase_version"
    bl_label = "增加版本"
    bl_options = {'REGISTER', 'UNDO'}

    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):
        context.scene.version_number += 1
        return{'FINISHED'}

class PL_OT_decrease_version(bpy.types.Operator):
    """减少版本号"""
    bl_idname = "playblast_puls.decrease_version"
    bl_label = "减少版本"
    bl_options = {'REGISTER', 'UNDO'}

    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):
        if context.scene.version_number > 0:
            context.scene.version_number -= 1
        return{'FINISHED'}

##############################################
# REGISTER/UNREGISTER
##############################################
def register():
    bpy.utils.register_class(PL_OT_recover_version)
    bpy.utils.register_class(PL_OT_increase_version)
    bpy.utils.register_class(PL_OT_decrease_version)


def unregister():
    bpy.utils.unregister_class(PL_OT_recover_version)
    bpy.utils.unregister_class(PL_OT_increase_version)
    bpy.utils.unregister_class(PL_OT_decrease_version)