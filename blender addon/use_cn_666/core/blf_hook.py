"""BLF 绘制 Hook — smart_blf monkey-patch 实时翻译"""
import bpy, blf, re
from functools import lru_cache


class smart_blf:
    """monkey-patch blf.draw 实现实时文本翻译（逐帧拦截绘制文本）"""
    nd_r1 = re.compile(r"^([^:]+?)(\s*\[[A-Za-z0-9]+\])?:\s*(.+)$")
    ops_r2 = re.compile(r"^(\W*)(.+?)(\W*)$")
    fh_r3 = re.compile(r"^(.+?)\s+(\(.+?\))$")
    lw_r4 = re.compile(r"^([a-zA-Z][a-zA-Z\s]*)\s+([^a-zA-Z\s].*|.*\d.*)$")

    def __init__(self):
        self._original_blf_draw = None
        self._active = False
        self._processors = (
            self._p_s_t, self._p_l_v, self._p_d_w,
            self._p_s_w, self._p_l_w, self._p_f_f,
        )

    def _p_s_t(self, text):
        return self._pgettext(text)

    def _p_l_v(self, text):
        match = self.nd_r1.match(text)
        if match:
            return f"{self._pgettext(match.group(1).strip())}{match.group(2) or ''}: {self._pgettext(match.group(3).strip())}"
        return text

    def _p_d_w(self, text):
        match = self.fh_r3.match(text)
        return f"{self._pgettext(match.group(1))} {self._pgettext(match.group(2))}" if match else text

    def _p_l_w(self, text):
        match = self.lw_r4.match(text)
        return f"{self._pgettext(match.group(1).strip())} {match.group(2)}" if match else text

    def _p_s_w(self, text):
        match = self.ops_r2.match(text)
        return f"{match.group(1)}{self._pgettext(match.group(2))}{match.group(3)}" if match else text

    def _p_f_f(self, text):
        return self._pgettext(text)

    def _pgettext(self, text):
        return bpy.app.translations.pgettext(text)

    @lru_cache(maxsize=2048)
    def _pipeline_translate(self, text):
        if not text or not text.strip():
            return text
        current_text = text
        for processor in self._processors:
            processed_text = processor(current_text)
            if processed_text != current_text:
                current_text = processed_text
        return current_text

    def _translated_draw(self, font_id, text, *args, **kwargs):
        prefs = bpy.context.preferences if bpy.context else None
        if prefs and prefs.view and prefs.view.use_translate_interface:
            return self._original_blf_draw(
                font_id, self._pipeline_translate(text) if text else text,
                *args, **kwargs)
        return self._original_blf_draw(font_id, text, *args, **kwargs)

    def register(self):
        if not self._active:
            self._original_blf_draw = blf.draw
            blf.draw = self._translated_draw
            self._active = True

    def unregister(self):
        if self._active and self._original_blf_draw:
            blf.draw = self._original_blf_draw
        self._active = False
        self._pipeline_translate.cache_clear()


smart_hud = smart_blf()
