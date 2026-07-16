"""【用途】标签存储系统 - 标签 CRUD + 星标管理"""

import os
import json
import bpy

TAG_FILE: str = ""
STARRED_KEY: str = "__starred__"


def _tag_file() -> str:
    """获取标签文件路径"""
    global TAG_FILE
    if not TAG_FILE:
        try:
            TAG_FILE = os.path.join(bpy.utils.user_resource("SCRIPTS"), "dual_addon_tags.json")
        except Exception:
            TAG_FILE = ""
    return TAG_FILE


def tag_load(cache: dict = None, cache_dirty_ref: list = None) -> dict:
    """加载标签数据"""
    if cache is not None and cache_dirty_ref is not None and not cache_dirty_ref[0]:
        return cache

    path = _tag_file()
    if not path or not os.path.exists(path):
        result = {}
    else:
        try:
            with open(path, "r", encoding="utf-8") as f:
                result = json.load(f)
        except Exception:
            result = {}

    if cache is not None:
        cache.clear()
        cache.update(result)
    if cache_dirty_ref is not None:
        cache_dirty_ref[0] = False
    return result


def tag_save(data: dict, cache: dict = None, cache_dirty_ref: list = None) -> None:
    """保存标签数据"""
    path = _tag_file()
    if not path:
        return
    try:
        d = os.path.dirname(path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        if cache is not None:
            cache.clear()
            cache.update(data)
        if cache_dirty_ref is not None:
            cache_dirty_ref[0] = False
    except Exception:
        pass


def tag_get(module_name: str, cache: dict = None, cache_dirty_ref: list = None) -> list:
    """获取插件的标签"""
    data = tag_load(cache, cache_dirty_ref)
    return data.get(module_name, [])


def tag_set(module_name: str, tags: list, cache: dict = None, cache_dirty_ref: list = None) -> None:
    """设置插件的标签"""
    data = tag_load(cache, cache_dirty_ref)
    if tags:
        data[module_name] = tags
    else:
        data.pop(module_name, None)
    tag_save(data, cache, cache_dirty_ref)


def tag_all_names(cache: dict = None, cache_dirty_ref: list = None) -> list:
    """获取所有标签名"""
    data = tag_load(cache, cache_dirty_ref)
    seen = set()
    for mod, tags in data.items():
        if mod == STARRED_KEY:
            continue
        for t in tags:
            seen.add(t)
    return sorted(seen)


def tag_addons_with_tag(tag_name: str, cache: dict = None, cache_dirty_ref: list = None) -> set:
    """获取拥有指定标签的插件"""
    data = tag_load(cache, cache_dirty_ref)
    return {m for m, tags in data.items() if m != STARRED_KEY and tag_name in tags}


def starred_load(cache: dict = None, cache_dirty_ref: list = None) -> set:
    """加载星标列表"""
    data = tag_load(cache, cache_dirty_ref)
    return set(data.get(STARRED_KEY, []))


def starred_save(stars: set, cache: dict = None, cache_dirty_ref: list = None) -> None:
    """保存星标列表"""
    data = tag_load(cache, cache_dirty_ref)
    if stars:
        data[STARRED_KEY] = sorted(stars)
    else:
        data.pop(STARRED_KEY, None)
    tag_save(data, cache, cache_dirty_ref)


def starred_toggle(module_name: str, cache: dict = None, cache_dirty_ref: list = None) -> bool:
    """切换星标状态"""
    stars = starred_load(cache, cache_dirty_ref)
    if module_name in stars:
        stars.remove(module_name)
    else:
        stars.add(module_name)
    starred_save(stars, cache, cache_dirty_ref)
    return module_name in stars


def starred_has(module_name: str, cache: dict = None, cache_dirty_ref: list = None) -> bool:
    """检查是否已星标"""
    stars = starred_load(cache, cache_dirty_ref)
    return module_name in stars
