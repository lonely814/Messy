"""【用途】星标操作器 - 切换星标收藏状态"""

import bpy
from bpy.props import StringProperty

from ..utils.ui_helpers import redraw_preferences
from ..utils.cache import _TAG_CACHE_DIRTY
from ..data.tags import starred_toggle


class DUAL_FIRSTROW_OT_star_toggle(bpy.types.Operator):
    """切换星标"""
    bl_idname = "dual_firstrow_addon_search.star_toggle"
    bl_label = "星标"
    bl_description = "切换星标收藏（星标插件置顶显示）"
    bl_options = {"INTERNAL"}

    module_name: StringProperty(options={"HIDDEN"})

    def execute(self, context):
        _TAG_CACHE_DIRTY[0] = True
        starred_toggle(self.module_name)
        redraw_preferences()
        return {"FINISHED"}
