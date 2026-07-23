"""【用途】星标操作器 - 切换星标收藏状态"""

import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences
from ..utils.cache import _TAG_CACHE, _TAG_CACHE_DIRTY
from ..data.tags import starred_toggle, starred_has


class DUAL_FIRSTROW_OT_star_toggle(bpy.types.Operator):
    """切换星标"""
    bl_idname = "dual_firstrow_addon_search.star_toggle"
    bl_label = "星标"
    bl_description = "切换星标收藏（星标插件置顶显示）"
    bl_options = {"REGISTER", "INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})

    def invoke(self, context, event):
        """如果是取消星标，弹出二次确认"""
        if starred_has(self.module_name, _TAG_CACHE, _TAG_CACHE_DIRTY):
            return context.window_manager.invoke_confirm(self, event)
        return self.execute(context)

    def execute(self, context):
        _TAG_CACHE_DIRTY[0] = True
        starred_toggle(self.module_name)
        redraw_preferences()
        return {"FINISHED"}
