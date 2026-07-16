"""【用途】插件信息工具 - 文件路径、类型检测、版本格式化"""

import os
import json
import urllib.request
import bpy

from .cache import get_github_cache, set_github_cache, is_github_cache_expired


def get_module_file_path(mod, cache: dict = None) -> str:
    """获取插件真实文件路径（带缓存）"""
    mod_name = getattr(mod, "__name__", "")
    if cache and mod_name in cache:
        return cache[mod_name]

    candidates = []

    try:
        value = getattr(mod, "__file__", "")
        if value:
            candidates.append(value)
    except Exception:
        pass

    try:
        paths = getattr(mod, "__path__", None)
        if paths:
            for value in paths:
                if value:
                    candidates.append(value)
    except Exception:
        pass

    try:
        spec = getattr(mod, "__spec__", None)
        origin = getattr(spec, "origin", "") if spec else ""
        if origin and origin not in {"built-in", "namespace"}:
            candidates.append(origin)
        locations = getattr(spec, "submodule_search_locations", None) if spec else None
        if locations:
            for value in locations:
                if value:
                    candidates.append(value)
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
        for value in candidates:
            if value:
                result_path = str(value)
                break

    if cache is not None and mod_name:
        cache[mod_name] = result_path
    return result_path


def is_extension_addon(module_name: str) -> bool:
    """判断是否为扩展插件"""
    parts = (module_name or "").split(".")
    if len(parts) >= 3 and parts[0] == "bl_ext":
        return bool(parts[1] and parts[2])
    return False


def is_core_addon_from_file(module_file: str) -> bool:
    """判断是否为内置核心插件"""
    if not module_file:
        return False
    try:
        parts = os.path.normpath(module_file).replace("\\", "/").split("/")
        return "addons_core" in parts
    except Exception:
        return False


def addon_type_text(module_name: str, module_file: str, user_addon: bool) -> str:
    """获取插件类型文本"""
    if is_extension_addon(module_name):
        return "Extension"
    if is_core_addon_from_file(module_file):
        return "Built-in"
    return "Local"


def format_version_text(value) -> str:
    """格式化版本文本"""
    if not value:
        return ""
    if isinstance(value, (list, tuple)):
        return ".".join(str(x) for x in value)
    return str(value)


def domain_from_url(url: str) -> str:
    """从 URL 提取域名"""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc
        return domain or "打开链接"
    except Exception:
        return "打开链接"


def is_user_addon_fallback(mod, user_addon_paths: list) -> bool:
    """判断是否为用户插件（后备方案）"""
    if not user_addon_paths:
        for path in (
            bpy.utils.script_path_user(),
            bpy.utils.script_path_pref(),
        ):
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


def get_extension_repo_info(context, module_name: str, module_file: str = "") -> dict:
    """获取扩展仓库信息"""
    parts = (module_name or "").split(".")
    repo_module = parts[1] if len(parts) >= 3 and parts[0] == "bl_ext" else ""
    pkg_id = parts[2] if len(parts) >= 3 and parts[0] == "bl_ext" else ""

    result = {
        "repo_module": repo_module,
        "pkg_id": pkg_id,
        "repo_index": -1,
        "repo_directory": "",
    }

    if not repo_module or not pkg_id:
        return result

    try:
        prefs = context.preferences
        extensions = getattr(prefs, "extensions", None)
        repos = getattr(extensions, "repos", None) if extensions else None
    except Exception:
        repos = None

    if not repos:
        return result

    abs_file = ""
    try:
        abs_file = bpy.path.abspath(module_file) if module_file else ""
    except Exception:
        abs_file = module_file or ""

    for index, repo in enumerate(repos):
        repo_dir = getattr(repo, "directory", "") or ""
        repo_dir_abs = ""
        try:
            repo_dir_abs = bpy.path.abspath(repo_dir) if repo_dir else ""
        except Exception:
            repo_dir_abs = repo_dir

        names = {
            getattr(repo, "module", "") or "",
            getattr(repo, "name", "") or "",
            getattr(repo, "id", "") or "",
        }

        by_name = repo_module in names
        by_path = False
        if abs_file and repo_dir_abs:
            try:
                by_path = bpy.path.is_subdir(abs_file, repo_dir_abs)
            except Exception:
                by_path = False

        if by_name or by_path:
            result["repo_index"] = index
            result["repo_directory"] = repo_dir_abs or repo_dir
            return result

    return result


def extract_github_repo(info: dict) -> str:
    """从插件的 bl_info 中提取 GitHub owner/repo。

    依次检查 doc_url → tracker_url，提取 github.com/{owner}/{repo} 部分。
    """
    for key in ("doc_url", "tracker_url"):
        url = info.get(key, "")
        if url:
            try:
                from urllib.parse import urlparse
                parsed = urlparse(str(url))
                if parsed.netloc.lower() == "github.com":
                    parts = parsed.path.strip("/").split("/")
                    if len(parts) >= 2:
                        return f"{parts[0]}/{parts[1]}"
            except Exception:
                pass
    return ""


def fetch_github_stats(repo: str) -> dict | None:
    """查询 GitHub API 获取仓库星标数和 Releases 下载量。

    使用公共 API (https://api.github.com/repos/{repo})。
    注意: 未认证限制 60 req/h。使用内存缓存避免超出限制。
    """
    if not repo:
        return None

    if not is_github_cache_expired(repo):
        cache = get_github_cache()
        return cache.get(repo)

    try:
        url = f"https://api.github.com/repos/{repo}"
        req = urllib.request.Request(url, headers={"User-Agent": "Blender-DualAddonSearch/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        stars = data.get("stargazers_count", 0)

        downloads = 0
        try:
            releases_url = f"https://api.github.com/repos/{repo}/releases"
            req2 = urllib.request.Request(releases_url, headers={"User-Agent": "Blender-DualAddonSearch/1.0"})
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                releases = json.loads(resp2.read().decode("utf-8"))
            for release in releases:
                for asset in release.get("assets", []):
                    downloads += asset.get("download_count", 0)
        except Exception:
            pass

        result = {"stars": stars, "downloads": downloads}
        set_github_cache(repo, stars, downloads)
        return result
    except Exception:
        return None
