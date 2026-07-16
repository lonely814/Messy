"""【用途】Profile 管理 - 保存/加载/删除插件启用状态快照"""

import os
import json
import bpy

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
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def profile_save_all(data: dict) -> None:
    """保存所有 profile"""
    path = _profile_file_path()
    if not path:
        return
    try:
        d = os.path.dirname(path)
        if d and not os.path.exists(d):
            os.makedirs(d, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


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


def profile_delete(name: str) -> None:
    """删除一个 profile"""
    data = profile_load_all()
    data.pop(name, None)
    profile_save_all(data)
