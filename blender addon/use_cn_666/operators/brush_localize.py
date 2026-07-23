"""笔刷资产汉化 / 恢复算子"""
import bpy, os
from bpy.types import Operator
from ..core.utils import re_bl
from ..core.brush_localizer import BrushProcessor


class BRUSH_cn(bpy.types.Operator):
    bl_idname = "brush_image.cn"
    bl_label = "笔刷资产汉化"
    bl_description = ("按钮灰色表示权限不足\n请以管理员身份运行blender\n"
                      "Mac和Linux报错多半是权限问题\n需自行解决权限问题")

    def execute(self, context):
        try:
            font_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "Font.ttf")
            if not os.path.exists(font_path):
                self.report({"ERROR"}, "未找到系统字体，请确保 Font.ttf 存在")
                return {"CANCELLED"}
            brush_do = BrushProcessor()
            brush_do.clear_work()
            brush_do.process_assets(font=font_path, context=context)
            self.report({"INFO"}, "笔刷已翻译, 请重启 Blender")
            bpy.app.timers.register(re_bl, first_interval=0.5)
        except Exception as e:
            self.report({"ERROR"}, f"笔刷翻译失败 {e}")
        return {"FINISHED"}


class BRUSH_re(bpy.types.Operator):
    bl_idname = "brush_image.re"
    bl_label = "笔刷资产恢复"

    def execute(self, context):
        try:
            BrushProcessor.clear_work()
            self.report({"INFO"}, "笔刷已恢复默认, 重启 Blender")
            bpy.app.timers.register(re_bl, first_interval=0.5)
        except Exception as e:
            self.report({"ERROR"}, f"笔刷恢复失败 {e}")
        return {"FINISHED"}
