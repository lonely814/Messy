"""【用途】标签存储系统 - 标签 CRUD + 星标管理"""

import os
import bpy

from .json_store import load_json, save_json

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
        result = load_json(path, {})

    if cache is not None and cache is not result:
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
    save_json(path, data, indent=2)
    # 注意：调用方可能把缓存本体当作 data 传入（如 starred_save）。
    # 此时 cache.clear() 会连 data 一起清空，导致 update(data) 写入空字典，
    # 表现为星标/标签写入磁盘正确但内存缓存被抹掉、界面不刷新。
    if cache is not None and cache is not data:
        cache.clear()
        cache.update(data)
    if cache_dirty_ref is not None:
        cache_dirty_ref[0] = False


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


def tag_purge_modules(module_names, cache: dict = None, cache_dirty_ref: list = None) -> list:
    """清除已不存在插件的标签/星标，返回被清理的模块名。"""
    names = {name for name in module_names if name and name != STARRED_KEY}
    if not names:
        return []
    data = tag_load(cache, cache_dirty_ref)
    removed = []
    for name in names:
        if data.pop(name, None) is not None:
            removed.append(name)
        starred = data.get(STARRED_KEY)
        if isinstance(starred, list) and name in starred:
            starred.remove(name)
            if name not in removed:
                removed.append(name)
    if removed:
        tag_save(data, cache, cache_dirty_ref)
    return removed


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
