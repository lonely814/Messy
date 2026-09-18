"""【用途】Profile 管理 - 保存/加载/删除插件启用状态快照"""

import os
import bpy

from .json_store import load_json, save_json

_PROFILE_FILE: str = ""


def _profile_file_path() -> str:
    """获取 profile 文件路径"""
    global _PROFILE_FILE
    if not _PROFILE_FILE:
        try:
            _PROFILE_FILE = os.path.join(bpy.utils.user_resource("SCRIPTS"), "dual_addon_profiles.json")
        except Exception:
            _PROFILE_FILE = ""
    return _PROFILE_FILE


def profile_load_all() -> dict:
    """加载所有 profile"""
    path = _profile_file_path()
    if not path or not os.path.exists(path):
        return {}
    return load_json(path, {})


def profile_save_all(data: dict) -> None:
    """保存所有 profile"""
    path = _profile_file_path()
    if not path:
        return
    save_json(path, data, indent=2)


def profile_names() -> list:
    """获取所有 profile 名称"""
    return sorted(profile_load_all().keys())


def profile_save(name: str, enabled_modules: list) -> None:
    """保存一个 profile"""
    data = profile_load_all()
    data[name] = sorted(enabled_modules)
    profile_save_all(data)


def profile_load(name: str) -> set:
    """加载一个 profile"""
    data = profile_load_all()
    return set(data.get(name, []))


def profile_purge_module(module_name: str) -> int:
    """从所有 Profile 中移除已卸载插件，返回受影响 Profile 数量。"""
    if not module_name:
        return 0
    data = profile_load_all()
    touched = 0
    for name, modules in data.items():
        if not isinstance(modules, list) or module_name not in modules:
            continue
        data[name] = [m for m in modules if m != module_name]
        touched += 1
    if touched:
        profile_save_all(data)
    return touched


def profile_delete(name: str) -> None:
    """删除一个 profile"""
    data = profile_load_all()
    data.pop(name, None)
    profile_save_all(data)
