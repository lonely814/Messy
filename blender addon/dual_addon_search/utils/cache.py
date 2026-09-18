"""全局缓存管理。"""

_CACHE_MODULE_FILE: dict = {}
_CACHE_HAYSTACK: dict = {}
_ADDONS_CACHE: list = []
_ADDONS_CACHE_TIME = 0.0
_TAG_CACHE: dict = {}
_TAG_CACHE_DIRTY = [True]


def clear_search_caches() -> None:
    _CACHE_MODULE_FILE.clear()
    _CACHE_HAYSTACK.clear()


def clear_all_caches() -> None:
    global _ADDONS_CACHE, _ADDONS_CACHE_TIME
    clear_search_caches()
    _ADDONS_CACHE = []
    _ADDONS_CACHE_TIME = 0.0
    _TAG_CACHE.clear()
    _TAG_CACHE_DIRTY[0] = True


def get_module_file_cache() -> dict:
    return _CACHE_MODULE_FILE


def get_haystack_cache() -> dict:
    return _CACHE_HAYSTACK


def get_addons_cache() -> tuple:
    return _ADDONS_CACHE, _ADDONS_CACHE_TIME


def set_addons_cache(cache: list, timestamp: float) -> None:
    global _ADDONS_CACHE, _ADDONS_CACHE_TIME
    _ADDONS_CACHE = cache
    _ADDONS_CACHE_TIME = timestamp


def get_tag_cache() -> tuple:
    return _TAG_CACHE, _TAG_CACHE_DIRTY
