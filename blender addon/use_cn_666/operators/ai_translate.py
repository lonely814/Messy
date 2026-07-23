"""AI 翻译算子"""
import bpy, os, threading
from bpy.types import Operator
from ..core.utils import log, _redraw_preferences
from ..core.i18n import (_collect_untranslated_addon_names, _load_ai_cache,
                         _save_ai_cache, _register_ai_translations,
                         _ai_translate_batch, AI_CACHE_FILE, AI_TRANSLATIONS_ID)


class OT_ai_translate(Operator):
    bl_idname = "ai.translate_names"
    bl_label = "AI 翻译未覆盖名称"
    bl_description = "调用 AI API 翻译尚未覆盖的插件名称（需要配置 API Key）"

    _timer = None
    _thread = None
    _progress: int = 0
    _total: int = 0
    _message: str = ""
    _error: str = ""

    def execute(self, context):
        prefs = context.preferences.addons[__package__.split('.')[0]].preferences
        if not prefs.ai_api_key:
            self.report({'ERROR'}, "请先在偏好设置中配置 AI API Key")
            return {'CANCELLED'}
        self._progress = 0
        self._total = 0
        self._message = "正在扫描插件名称..."
        self._error = ""
        context.window_manager.modal_handler_add(self)
        self._timer = context.window_manager.event_timer_add(0.3, window=context.window)
        self._thread = threading.Thread(target=self._run_translate, args=(prefs,), daemon=True)
        self._thread.start()
        return {'RUNNING_MODAL'}

    def modal(self, context, event):
        if event.type == 'TIMER':
            if self._error:
                context.window_manager.event_timer_remove(self._timer)
                self.report({'ERROR'}, self._error)
                log(self._error)
                return {'CANCELLED'}
            if self._message:
                self.report({'INFO'}, self._message)
                self._message = ""
            if self._thread and not self._thread.is_alive():
                context.window_manager.event_timer_remove(self._timer)
                self._thread = None
                if self._progress > 0:
                    _redraw_preferences()
                    self.report({'INFO'}, f"AI 翻译完成: {self._progress} 个名称")
                return {'FINISHED'}
            for win in context.window_manager.windows:
                for area in win.screen.areas if win.screen else []:
                    if area.type == 'PREFERENCES':
                        area.tag_redraw()
        return {'PASS_THROUGH'}

    def _run_translate(self, prefs):
        try:
            names = _collect_untranslated_addon_names()
            if not names:
                self._message = "所有插件名称已翻译，无需 AI 补充"
                self._progress = 0
                return
            batch_size = 20
            total = len(names)
            self._total = total
            translated = 0
            cache = _load_ai_cache()
            for start in range(0, total, batch_size):
                batch = names[start:start + batch_size]
                self._message = f"正在翻译 ({start+1}-{min(start+batch_size, total)}/{total})..."
                results = _ai_translate_batch(batch, prefs.ai_api_key, prefs.ai_provider)
                for src, tgt in zip(batch, results):
                    if tgt:
                        cache[src] = tgt
                        translated += 1
            _save_ai_cache(cache)
            _register_ai_translations(cache)
            self._progress = translated
            self._message = ""
        except RuntimeError as e:
            self._error = str(e)
        except Exception as e:
            self._error = f"翻译过程出错: {e}"


class OT_ai_clear_cache(Operator):
    bl_idname = "ai.clear_cache"
    bl_label = "清除 AI 翻译缓存"

    def execute(self, context):
        try:
            bpy.app.translations.unregister(AI_TRANSLATIONS_ID)
        except RuntimeError:
            pass  # 尚未注册，忽略
        if os.path.exists(AI_CACHE_FILE):
            os.remove(AI_CACHE_FILE)
        _redraw_preferences()
        self.report({'INFO'}, "AI 翻译缓存已清除")
        return {'FINISHED'}
