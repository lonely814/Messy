"""恢复官方翻译算子"""
import bpy, os, shutil
from bpy.types import Operator
from ..core.utils import re_bl
from .. import pmo, lo9


class Re_translation(Operator):
    bl_idname = "wm.re_translation"
    bl_label = "恢复官方语言包"

    def execute(self, context):
        try:
            uu = bpy.utils.user_resource('DATAFILES', path='locale')
            if os.path.exists(uu):
                shutil.rmtree(uu)
            if os.path.exists(pmo):
                os.remove(pmo)
            if os.path.exists(lo9):
                os.remove(lo9)
            self.report({'INFO'}, "官方翻译已恢复,重启blender后生效!")
            bpy.app.timers.register(re_bl, first_interval=0.5)
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"恢复官方翻译失败,请尝试以管理员运行blender - {str(e)}")
            return {'CANCELLED'}
