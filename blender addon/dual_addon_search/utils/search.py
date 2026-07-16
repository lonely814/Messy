"""【用途】双搜索匹配逻辑 - 支持 AND/OR 模式"""

from .ui_helpers import safe_text, safe_get


def module_haystack(mod, info, cache: dict = None) -> str:
    """提取插件信息用于搜索匹配"""
    mod_name = getattr(mod, "__name__", "")
    if cache and mod_name in cache:
        return cache[mod_name]

    parts = [
        safe_get(info, "name"),
        safe_get(info, "author"),
        safe_get(info, "description"),
        safe_get(info, "location"),
        safe_get(info, "category"),
        safe_text(getattr(mod, "__name__", "")),
    ]
    result = " ".join(safe_text(p) for p in parts).lower()

    if cache is not None and mod_name:
        cache[mod_name] = result
    return result


def match_dual_search(
    mod,
    info,
    search_a_lower: str,
    search_b_lower: str,
    mode: str,
    haystack_cache: dict = None,
) -> bool:
    """双搜索匹配"""
    if not search_a_lower and not search_b_lower:
        return True

    hay = module_haystack(mod, info, haystack_cache)

    hit_a = (not search_a_lower) or (search_a_lower in hay)
    hit_b = (not search_b_lower) or (search_b_lower in hay)

    if search_a_lower and search_b_lower:
        if mode == "AND":
            return hit_a and hit_b
        return hit_a or hit_b

    return hit_a and hit_b
