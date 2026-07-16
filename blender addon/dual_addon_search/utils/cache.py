"""【用途】全局缓存管理 - 统一管理插件搜索、标签等缓存"""

# 搜索缓存
_CACHE_MODULE_FILE: dict = {}
_CACHE_HAYSTACK: dict = {}

# 插件列表缓存
_ADDONS_CACHE: list = []
_ADDONS_CACHE_TIME: float = 0.0

# 标签缓存
_TAG_CACHE: dict = {}
_TAG_CACHE_DIRTY: list = [True]  # 使用列表以便在函数间共享引用


def clear_search_caches() -> None:
    """清空搜索相关缓存"""
    _CACHE_MODULE_FILE.clear()
    _CACHE_HAYSTACK.clear()


def clear_all_caches() -> None:
    """清空所有缓存"""
    clear_search_caches()
    global _ADDONS_CACHE, _ADDONS_CACHE_TIME, _TAG_CACHE, _TAG_CACHE_DIRTY
    _ADDONS_CACHE = []
    _ADDONS_CACHE_TIME = 0.0
    _TAG_CACHE = {}
    _TAG_CACHE_DIRTY[0] = True
    _GITHUB_CACHE.clear()


def get_module_file_cache() -> dict:
    """获取模块文件路径缓存"""
    return _CACHE_MODULE_FILE


def get_haystack_cache() -> dict:
    """获取搜索关键词缓存"""
    return _CACHE_HAYSTACK


def get_addons_cache() -> tuple:
    """获取插件列表缓存 (cache, time)"""
    return _ADDONS_CACHE, _ADDONS_CACHE_TIME


def set_addons_cache(cache: list, time: float) -> None:
    """设置插件列表缓存"""
    global _ADDONS_CACHE, _ADDONS_CACHE_TIME
    _ADDONS_CACHE = cache
    _ADDONS_CACHE_TIME = time


def get_tag_cache() -> tuple:
    """获取标签缓存 (cache, dirty_ref)"""
    return _TAG_CACHE, _TAG_CACHE_DIRTY


# ---- GitHub API 缓存 ----
_GITHUB_CACHE: dict = {}
_GITHUB_CACHE_TTL = 3600  # 1 小时


def get_github_cache() -> dict:
    """获取 GitHub 缓存"""
    return _GITHUB_CACHE


def set_github_cache(repo: str, stars: int, downloads: int) -> None:
    """设置单条 GitHub 缓存"""
    import time
    _GITHUB_CACHE[repo] = {
        "stars": stars,
        "downloads": downloads,
        "cached_at": int(time.time()),
    }


def is_github_cache_expired(repo: str) -> bool:
    """检查单条缓存是否过期"""
    import time
    entry = _GITHUB_CACHE.get(repo)
    if not entry:
        return True
    now = time.time()
    cached_at = entry.get("cached_at", 0)
    return (now - cached_at) > _GITHUB_CACHE_TTL
