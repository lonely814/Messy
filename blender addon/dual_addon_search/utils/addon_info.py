"""插件信息工具：文件路径、类型检测、版本格式化。"""

import os
import bpy


def get_module_file_path(mod, cache: dict = None) -> str:
    """获取插件真实文件路径（带缓存）。"""
    mod_name = getattr(mod, "__name__", "")
    if cache is not None and mod_name in cache:
        return cache[mod_name]

    candidates = []
    try:
        value = getattr(mod, "__file__", "")
        if value:
            candidates.append(value)
    except Exception:
        pass
    try:
        candidates.extend(value for value in (getattr(mod, "__path__", None) or ()) if value)
    except Exception:
        pass
    try:
        spec = getattr(mod, "__spec__", None)
        origin = getattr(spec, "origin", "") if spec else ""
        if origin and origin not in {"built-in", "namespace"}:
            candidates.append(origin)
        candidates.extend(
            value for value in (getattr(spec, "submodule_search_locations", None) or ()) if value
        )
    except Exception:
        pass

    result_path = ""
    for value in candidates:
        try:
            path = bpy.path.abspath(str(value))
            if path and os.path.exists(path):
                result_path = path
                break
        except Exception:
            pass
    if not result_path:
        result_path = next((str(value) for value in candidates if value), "")

    if cache is not None and mod_name:
        cache[mod_name] = result_path
    return result_path


def is_extension_addon(module_name: str) -> bool:
    parts = (module_name or "").split(".")
    return len(parts) >= 3 and parts[0] == "bl_ext" and bool(parts[1] and parts[2])


def is_core_addon_from_file(module_file: str) -> bool:
    if not module_file:
        return False
    try:
        return "addons_core" in os.path.normpath(module_file).replace("\\", "/").split("/")
    except Exception:
        return False


def addon_type_text(module_name: str, module_file: str, user_addon: bool) -> str:
    if is_extension_addon(module_name):
        return "Extension"
    if is_core_addon_from_file(module_file):
        return "Built-in"
    return "Local"


def format_version_text(value) -> str:
    if not value:
        return ""
    if isinstance(value, (list, tuple)):
        return ".".join(str(item) for item in value)
    return str(value)


def domain_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc or "打开链接"
    except Exception:
        return "打开链接"


def is_user_addon_fallback(mod, user_addon_paths: list) -> bool:
    if not user_addon_paths:
        for path in [bpy.utils.script_path_user(), *bpy.utils.script_paths_pref()]:
            if path is not None:
                user_addon_paths.append(os.path.join(path, "addons"))

    filepath = getattr(mod, "__file__", "")
    for path in user_addon_paths:
        try:
            if filepath and bpy.path.is_subdir(filepath, path):
                return True
        except Exception:
            pass
    return False
