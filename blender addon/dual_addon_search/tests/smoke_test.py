"""Blender 后台 smoke test。运行方式见 DEVELOPMENT.md。"""

import os
import sys
import tempfile
import traceback

PROJECT_PARENT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_PARENT not in sys.path:
    sys.path.insert(0, PROJECT_PARENT)

import bpy

import dual_addon_search as addon
from dual_addon_search.data import history
from dual_addon_search.data.json_store import load_json, restore_json, save_json
from dual_addon_search.data.tags import tag_purge_modules
from dual_addon_search.data.profiles import profile_purge_module, profile_save
from dual_addon_search.operators import batch
from dual_addon_search.panels import addon_list
from dual_addon_search.utils.addon_info import is_user_addon_fallback
from dual_addon_search.utils.search import match_search_query


class _FakeMod:
    def __init__(self, name):
        self.__name__ = name


class _Layout:
    """最小 layout 替身：任意链式调用都返回自身，永不抛错。"""

    def __getattr__(self, name):
        return _Layout()

    def __call__(self, *args, **kwargs):
        return _Layout()


class _Panel:
    def __init__(self):
        self.layout = _Layout()


def _check_search():
    mod = _FakeMod("fast_boolean")
    info = {"name": "Fast Boolean", "author": "loNely", "category": "Object"}
    common = {"tags": ["建模"], "module_file": "C:/addons/fast_boolean.py",
              "is_enabled": True, "addon_type": "local"}
    assert match_search_query(mod, info, "boolean", **common)
    assert match_search_query(mod, info, "name:boolean", **common)
    assert match_search_query(mod, info, "author:lonely", **common)
    assert match_search_query(mod, info, "status:enabled", **common)
    assert match_search_query(mod, info, "tag:建模", **common)
    assert match_search_query(mod, info, "type:local", **common)
    assert match_search_query(mod, info, "name:boolean status:enabled", **common)
    assert not match_search_query(mod, info, "-name:boolean", **common)
    assert not match_search_query(mod, info, "status:disabled", **common)
    assert not match_search_query(mod, info, "name:missing", **common)


def _check_user_addon_paths():
    """空路径列表会走内部构造分支，必须使用存在的 bpy.utils API。"""
    assert is_user_addon_fallback(_FakeMod("ghost"), []) is False


def _check_draw(context):
    """真实执行面板绘制逻辑。

    smoke_test 曾经只做注册/注销，导致 draw 内的 AttributeError
    直到用户打开面板才暴露。这里必须真正调用一次 draw。
    """
    panel = _Panel()
    try:
        addon_list._patched_addons_draw(panel, context)
    except Exception:
        traceback.print_exc()
        raise AssertionError("_patched_addons_draw 抛出异常，见上方 traceback")

    # 常见过滤组合也要能安全绘制
    wm = context.window_manager
    original = {
        "addon_search": getattr(wm, "addon_search", ""),
        "second": getattr(wm, "dual_addon_search_second", ""),
        "mode": getattr(wm, "dual_addon_search_mode", "OR"),
        "show_desc": getattr(wm, "dual_show_description", False),
    }
    try:
        wm.addon_search = "name:boolean status:enabled"
        wm.dual_addon_search_second = "-author:test"
        wm.dual_addon_search_mode = "AND"
        wm.dual_show_description = True
        addon_list._patched_addons_draw(_Panel(), context)
    finally:
        wm.addon_search = original["addon_search"]
        wm.dual_addon_search_second = original["second"]
        wm.dual_addon_search_mode = original["mode"]
        wm.dual_show_description = original["show_desc"]


def _check_purge():
    tag_purge_modules({"ghost_addon"})
    profile_save("purge_probe", ["ghost_addon", "keep_addon"])
    assert profile_purge_module("ghost_addon") == 1
    from dual_addon_search.data.profiles import profile_load, profile_delete
    assert profile_load("purge_probe") == {"keep_addon"}
    profile_delete("purge_probe")


def _check_star_roundtrip():
    """回归：tag_save 中 data 与 cache 若为同一对象，cache.clear() 会连 data
    一起清空，导致星标写盘成功但内存缓存被抹掉、界面不刷新。
    3.2.0 把 _TAG_CACHE 传进 star.py 后暴露此问题。
    用临时文件，避免污染真实 tags。
    """
    from dual_addon_search.data import tags as tags_mod
    from dual_addon_search.utils.cache import _TAG_CACHE, _TAG_CACHE_DIRTY

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_file = os.path.join(temp_dir, "tags.json")
        original = tags_mod._tag_file
        tags_mod._tag_file = lambda: temp_file
        try:
            probe = "smoke_star_probe"
            _TAG_CACHE.clear()
            _TAG_CACHE_DIRTY[0] = True
            assert tags_mod.starred_has(probe, _TAG_CACHE, _TAG_CACHE_DIRTY) is False
            tags_mod.starred_toggle(probe, _TAG_CACHE, _TAG_CACHE_DIRTY)
            assert tags_mod.starred_has(probe, _TAG_CACHE, _TAG_CACHE_DIRTY) is True, \
                "星标开启后缓存未更新（tag_save 别名 bug 回归）"
            assert probe in (load_json(temp_file, {}) or {}).get(tags_mod.STARRED_KEY, [])
            tags_mod.starred_toggle(probe, _TAG_CACHE, _TAG_CACHE_DIRTY)
            assert tags_mod.starred_has(probe, _TAG_CACHE, _TAG_CACHE_DIRTY) is False, \
                "星标关闭后缓存未更新"
        finally:
            tags_mod._tag_file = original
            _TAG_CACHE.clear()
            _TAG_CACHE_DIRTY[0] = True


def _check_backup_and_restore():
    """回归：写入前必须留下 .bak，且主文件损坏时可从 .bak 恢复。
    背景：缓存别名 bug 曾把整份标签写成仅含 __starred__ 的一条，
    当时没有任何备份，用户历史星标/标签全部丢失且不可恢复。
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        target = os.path.join(temp_dir, "backup_probe.json")
        save_json(target, {"keep": ["a", "b"]}, indent=2)
        assert not os.path.exists(target + ".bak"), "首次写入不应有 .bak"

        # 第二次写入会先把上一份内容存为 .bak
        save_json(target, {"__starred__": ["gone"]}, indent=2)
        assert os.path.exists(target + ".bak"), "第二次写入未生成 .bak"
        assert load_json(target + ".bak", {}) == {"keep": ["a", "b"]}, ".bak 内容应为上一份"
        assert load_json(target, {}) == {"__starred__": ["gone"]}

        # 模拟主文件损坏 → restore_json 回退到 .bak
        with open(target, "w", encoding="utf-8") as handle:
            handle.write("{ broken")
        assert load_json(target, {}) == {}, "损坏文件应回退默认值"
        assert restore_json(target, {}) == {"keep": ["a", "b"]}, "未从 .bak 恢复"


def main():
    _check_search()
    _check_user_addon_paths()

    addon.register()
    assert addon._IS_REGISTERED
    assert addon_list._IS_PATCHED
    assert addon_list._on_load_post_self_heal in bpy.app.handlers.load_post

    # 可选 Keymap patch 必须能在当前会话即时开关。
    assert addon._patch_keymap_ui()
    assert addon._IS_KEYMAP_PATCHED
    addon._unpatch_keymap_ui()
    assert not addon._IS_KEYMAP_PATCHED

    # draw 必须在注册后真实跑通
    _check_draw(bpy.context)

    # JSON 保存必须替换完成，不能遗留临时文件。
    with tempfile.TemporaryDirectory() as temp_dir:
        path = os.path.join(temp_dir, "state.json")
        save_json(path, {"ok": True}, indent=2)
        assert load_json(path, {}) == {"ok": True}
        assert not os.path.exists(path + ".tmp")

        old_path = history._history_path
        history._history_path = lambda: path
        try:
            history._HISTORY.clear()
            history._PENDING = ("stable search",)
            history.history_flush()
            assert load_json(path, []) == ["stable search"]
        finally:
            history._history_path = old_path

    _check_purge()
    _check_star_roundtrip()
    _check_backup_and_restore()

    addon.unregister()
    assert not addon._IS_REGISTERED
    assert not addon_list._IS_PATCHED
    assert addon_list._on_load_post_self_heal not in bpy.app.handlers.load_post

    batch.set_visible_modules(["a", "b"])
    assert batch._VISIBLE_MODULES == ["a", "b"]
    print("DUAL_ADDON_SEARCH_SMOKE_OK")


if __name__ == "__main__":
    main()
