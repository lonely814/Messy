"""插件搜索：普通关键词与轻量字段语法。"""

import shlex

from .ui_helpers import safe_text, safe_get

_FIELD_NAMES = {"name", "author", "tag", "status", "type", "path", "category", "description", "location", "module"}


def module_haystack(mod, info, cache: dict = None) -> str:
    mod_name = getattr(mod, "__name__", "")
    if cache is not None and mod_name in cache:
        return cache[mod_name]

    parts = [
        safe_get(info, "name"),
        safe_get(info, "author"),
        safe_get(info, "description"),
        safe_get(info, "location"),
        safe_get(info, "category"),
        safe_text(mod_name),
    ]
    result = " ".join(safe_text(part) for part in parts).lower()
    if cache is not None and mod_name:
        cache[mod_name] = result
    return result


def _tokens(query: str) -> list[str]:
    try:
        return shlex.split(query, posix=True)
    except ValueError:
        return query.split()


def _field_value(field: str, mod, info, *, tags, module_file, is_enabled, addon_type) -> str:
    values = {
        "name": safe_get(info, "name"),
        "author": safe_get(info, "author"),
        "category": safe_get(info, "category"),
        "description": safe_get(info, "description"),
        "location": safe_get(info, "location"),
        "module": getattr(mod, "__name__", ""),
        "path": module_file,
        "tag": " ".join(tags),
        "status": "enabled" if is_enabled else "disabled",
        "type": addon_type,
    }
    return safe_text(values.get(field, "")).lower()


def match_search_query(
    mod,
    info,
    query: str,
    *,
    tags=(),
    module_file="",
    is_enabled=False,
    addon_type="local",
    haystack_cache=None,
) -> bool:
    """匹配一个查询。词之间为 AND，支持 field:value 和 -排除。"""
    if not query:
        return True

    haystack = module_haystack(mod, info, haystack_cache)
    for token in _tokens(query.lower()):
        if not token:
            continue
        negative = token.startswith("-") and len(token) > 1
        if negative:
            token = token[1:]

        field = ""
        value = token
        if ":" in token:
            candidate, candidate_value = token.split(":", 1)
            if candidate in _FIELD_NAMES and candidate_value:
                field, value = candidate, candidate_value

        if field:
            actual = _field_value(
                field, mod, info, tags=tags, module_file=module_file,
                is_enabled=is_enabled, addon_type=addon_type,
            )
            hit = value in actual
        else:
            hit = value in haystack

        if negative and hit:
            return False
        if not negative and not hit:
            return False
    return True


def match_dual_search(
    mod,
    info,
    search_a_lower: str,
    search_b_lower: str,
    mode: str,
    haystack_cache: dict = None,
    **kwargs,
) -> bool:
    """匹配两个查询框；框内 AND，框间按 mode 组合。"""
    hit_a = match_search_query(mod, info, search_a_lower, haystack_cache=haystack_cache, **kwargs)
    hit_b = match_search_query(mod, info, search_b_lower, haystack_cache=haystack_cache, **kwargs)
    if search_a_lower and search_b_lower:
        return hit_a and hit_b if mode == "AND" else hit_a or hit_b
    return hit_a and hit_b
