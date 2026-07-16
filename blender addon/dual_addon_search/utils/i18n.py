"""【用途】国际化工具 - 中英文切换"""

_LANG_CACHE: str = ""


def _T(zh: str, en: str) -> str:
    """中英文切换：根据 Blender 界面语言返回对应语言"""
    lang = _LANG_CACHE
    if not lang:
        update_lang_cache()
        lang = _LANG_CACHE
    if not lang or lang.startswith("zh"):
        return zh
    return en


def update_lang_cache() -> None:
    """更新语言缓存"""
    global _LANG_CACHE
    import bpy
    try:
        _LANG_CACHE = bpy.context.preferences.view.language
    except Exception:
        _LANG_CACHE = ""


def get_lang_cache() -> str:
    """获取当前语言缓存"""
    return _LANG_CACHE
