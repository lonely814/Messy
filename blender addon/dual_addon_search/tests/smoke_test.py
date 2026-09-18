"""Blender 后台 smoke test。运行方式见 DEVELOPMENT.md。"""

import os
import sys
import tempfile

PROJECT_PARENT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_PARENT not in sys.path:
    sys.path.insert(0, PROJECT_PARENT)

import dual_addon_search as addon
from dual_addon_search.data import history
from dual_addon_search.data.json_store import load_json, save_json
from dual_addon_search.data.tags import tag_purge_modules
from dual_addon_search.data.profiles import profile_purge_module, profile_save
from dual_addon_search.operators import batch
from dual_addon_search.panels import addon_list
from dual_addon_search.utils.search import match_search_query


class _FakeMod:
    def __init__(self, name):
        self.__name__ = name


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


def _check_purge():
    tag_purge_modules({"ghost_addon"})
    profile_save("purge_probe", ["ghost_addon", "keep_addon"])
    assert profile_purge_module("ghost_addon") == 1
    from dual_addon_search.data.profiles import profile_load
    assert profile_load("purge_probe") == {"keep_addon"}
    from dual_addon_search.data.profiles import profile_delete
    profile_delete("purge_probe")


def main():
    _check_search()
    addon.register()
    assert addon._IS_REGISTERED
    assert addon_list._IS_PATCHED
    assert addon_list._on_load_post_self_heal in __import__("bpy").app.handlers.load_post

    # 可选 Keymap patch 必须能在当前会话即时开关。
    assert addon._patch_keymap_ui()
    assert addon._IS_KEYMAP_PATCHED
    addon._unpatch_keymap_ui()
    assert not addon._IS_KEYMAP_PATCHED

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

    addon.unregister()
    assert not addon._IS_REGISTERED
    assert not addon_list._IS_PATCHED
    assert addon_list._on_load_post_self_heal not in __import__("bpy").app.handlers.load_post

    batch.set_visible_modules(["a", "b"])
    assert batch._VISIBLE_MODULES == ["a", "b"]
    print("DUAL_ADDON_SEARCH_SMOKE_OK")


if __name__ == "__main__":
    main()
