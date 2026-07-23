"""FTP 更新算子"""
import bpy, threading
from bpy.types import Operator
from ..core.utils import log, _redraw_preferences
from ..core.update_manager import update_a, download_worker
from .. import _root


class FTP_Update(Operator):
    bl_idname = "ftp.u_a"
    bl_label = "下载并应用更新"

    progress: bpy.props.IntProperty(default=0)
    message: bpy.props.StringProperty(default="")
    _timer = None

    def execute(self, context):
        context.window_manager.modal_handler_add(self)
        self._timer = context.window_manager.event_timer_add(0.1, window=context.window)
        thread = threading.Thread(target=download_worker,
                                  args=(_root.z_file, _root.z_time, self), daemon=True)
        thread.start()
        return {'RUNNING_MODAL'}

    def modal(self, context, event):
        if event.type == 'TIMER':
            _root.down_ac = True
            _root.down_jd = self.progress
            _root.down_msg = self.message
            _root.down_err = False
            for window in context.window_manager.windows:
                for area in window.screen.areas:
                    if area.type == 'PREFERENCES':
                        area.tag_redraw()
            if self.progress >= 100 or "完成" in str(self.message) or "错误" in str(self.message):
                context.window_manager.event_timer_remove(self._timer)
                _root.down_ac = False
                if "完成" in self.message:
                    self.report({'INFO'}, "汉化包更新完成,将自动重启blender!")
                    from ..core.update_manager import update_p
                    update_p()
                elif "错误" in str(self.message):
                    self.report({'ERROR'}, self.message)
                return {'FINISHED'}
        return {'PASS_THROUGH'}


class FTP_check(Operator):
    bl_idname = "ftp.f_c"
    bl_label = "检查汉化包更新"

    def execute(self, context):
        update_a()
        return {'FINISHED'}
