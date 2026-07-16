"""【用途】核心绘制逻辑 - 替换 Blender 原生插件面板的 draw 方法"""

import os
import time
import bpy

from ..utils.cache import (
    _CACHE_MODULE_FILE, _CACHE_HAYSTACK, _ADDONS_CACHE, _ADDONS_CACHE_TIME,
    _TAG_CACHE, _TAG_CACHE_DIRTY,
    get_module_file_cache, get_haystack_cache, get_addons_cache, set_addons_cache
)
from ..utils.i18n import _T, update_lang_cache
from ..utils.ui_helpers import redraw_preferences, safe_separator, safe_text, safe_get, warn_once
from ..utils.search import match_dual_search
from ..utils.addon_info import (
    get_module_file_path, is_extension_addon, is_core_addon_from_file,
    addon_type_text, format_version_text, domain_from_url, is_user_addon_fallback,
    extract_github_repo, fetch_github_stats,
)
from ..data.tags import tag_get, tag_addons_with_tag, starred_has, starred_load
from ..data.history import history_record
from ..data import boot_profiler as boot

def _get_panel_class():
    """获取原生插件面板类"""
    try:
        import bl_ui.space_userpref as space_userpref
        return getattr(space_userpref, "USERPREF_PT_addons", None)
    except Exception:
        return None

def _sort_addons(addons, sort_mode: str, used_ext: set) -> list:
    """排序插件列表"""
    if sort_mode == "STAR":
        stars = starred_load(_TAG_CACHE, _TAG_CACHE_DIRTY)
        starred = [x for x in addons if getattr(x[0], "__name__", "") in stars]
        others = [x for x in addons if getattr(x[0], "__name__", "") not in stars]
        return starred + others
    if sort_mode == "NAME":
        return sorted(addons, key=lambda x: safe_get(x[1], "name", getattr(x[0], "__name__", "")).lower())
    elif sort_mode == "ENAME":
        return sorted(addons, key=lambda x: safe_get(x[1], "name", getattr(x[0], "__name__", "")).lower(), reverse=True)
    elif sort_mode == "ENABLED":
        enabled = [x for x in addons if getattr(x[0], "__name__", "") in used_ext]
        disabled = [x for x in addons if getattr(x[0], "__name__", "") not in used_ext]
        return enabled + disabled
    elif sort_mode == "DISABLED":
        enabled = [x for x in addons if getattr(x[0], "__name__", "") in used_ext]
        disabled = [x for x in addons if getattr(x[0], "__name__", "") not in used_ext]
        return disabled + enabled
    elif sort_mode == "VERSION":
        def _ver_key(x):
            v = safe_get(x[1], "version", ()) if x[1] else ()
            if isinstance(v, (list, tuple)):
                return tuple(int(p) if str(p).isdigit() else 0 for p in v) + (0, 0, 0)
            return (0, 0, 0)
        return sorted(addons, key=_ver_key, reverse=True)
    return addons

def _draw_addon_expand_button(row, module_name: str, expanded: bool):
    """绘制展开/折叠按钮"""
    icons = (
        "DOWNARROW_HLT" if expanded else "RIGHTARROW",
        "DISCLOSURE_TRI_DOWN" if expanded else "DISCLOSURE_TRI_RIGHT",
    )
    for icon in icons:
        try:
            row.operator(
                "preferences.addon_expand",
                icon=icon,
                emboss=False,
            ).module = module_name
            return
        except Exception as ex:
            warn_once("_draw_addon_expand_button", f"icon {icon!r} failed: {ex}")
    row.label(text="", icon="DISCLOSURE_TRI_DOWN" if expanded else "DISCLOSURE_TRI_RIGHT")

def _draw_addon_source_icon(layout, module_name: str, module_file: str = ""):
    """绘制插件来源图标"""
    if is_core_addon_from_file(module_file):
        icons = ("BLENDER", "APP", "FILE_BLEND", "FILE_FOLDER")
    elif is_extension_addon(module_name):
        icons = ("COMMUNITY", "PLUGIN", "FILE_FOLDER")
    else:
        icons = ("FILE_FOLDER",)

    for icon in icons:
        try:
            layout.label(icon=icon)
            return
        except Exception as ex:
            warn_once("_draw_addon_source_icon", f"icon {icon!r} failed: {ex}")
    layout.label(icon="QUESTION")


def _format_count(num) -> str:
    """格式化大数字：1500 → '1.5k'、2300000 → '2.3m'"""
    if not num:
        return "0"
    try:
        n = int(num)
    except (ValueError, TypeError):
        return str(num)
    if n >= 1000000:
        return f"{n / 1000000:.1f}m"
    if n >= 1000:
        return f"{n / 1000:.1f}k"
    return str(n)


def _draw_github_stats(layout, info: dict):
    """在插件展开详情中显示 GitHub 星标和下载量"""
    repo = extract_github_repo(info)
    if not repo:
        return

    stats = fetch_github_stats(repo)
    if not stats:
        return

    stars = _format_count(stats.get("stars", 0))
    downloads = _format_count(stats.get("downloads", 0))

    try:
        row = layout.row(align=True)
        row.scale_y = 0.85
        row.label(text=f"Star: {stars}", icon="SOLO_ON")
        row.label(text=f"DL: {downloads}")
    except Exception:
        pass


def _draw_modern_addon_expanded(box, context, mod, info, module_name: str, module_file: str, is_enabled: bool, user_addon: bool):
    """绘制展开的插件详情"""
    info_name = safe_get(info, "name", module_name)
    info_author = safe_get(info, "author")
    info_description = safe_get(info, "description")
    info_location = safe_get(info, "location")
    info_version = safe_get(info, "version")
    info_warning = safe_get(info, "warning")
    info_doc_url = safe_get(info, "doc_url")
    info_tracker_url = safe_get(info, "tracker_url")

    # 卸载按钮
    show_uninstall = is_extension_addon(module_name) or bool(module_file) or user_addon

    split = box.split(factor=0.8)
    col_a = split.column()
    col_b = split.column()

    if info_description:
        desc = str(info_description).rstrip("。.")
        col_a.label(text=" " + desc + "。", translate=False)

    # 显示 GitHub 统计信息
    _draw_github_stats(col_a, info)

    action_row = col_b.row()
    action_row.alignment = "RIGHT"

    if show_uninstall:
        try:
            props = action_row.operator(
                "dual_firstrow_addon_search.remove",
                text="卸载",
            )
            props.module = module_name
            props.filepath = module_file
        except Exception:
            pass
    else:
        action_row.active = False
        action_row.label(text="Built-in")

    # Google 搜索按钮
    try:
        props = action_row.operator(
            "dual_firstrow_addon_search.google_search",
            text="",
            icon="URL",
        )
        props.module_name = module_name
        props.addon_name = info_name
        props.addon_author = info_author or ""
    except Exception:
        pass

    # 文件信息
    if module_file:
        try:
            import datetime
            fpath = bpy.path.abspath(module_file) if hasattr(module_file, "__iter__") else module_file
            if not isinstance(fpath, str):
                fpath = str(fpath)
            fpath = os.path.realpath(fpath) if os.path.exists(fpath) else fpath
            if os.path.exists(fpath):
                size_bytes = os.path.getsize(fpath)
                if size_bytes < 1024:
                    size_str = f"{size_bytes} B"
                elif size_bytes < 1024 * 1024:
                    size_str = f"{size_bytes / 1024:.1f} KB"
                else:
                    size_str = f"{size_bytes / 1024 / 1024:.1f} MB"
                mtime = os.path.getmtime(fpath)
                time_str = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")
                info_line = col_a.row()
                info_line.label(
                    text=f"{size_str}  ·  {time_str}",
                    translate=False,
                )
        except Exception:
            pass

    safe_separator(box, "LINE")

    sub = box.column()
    sub.active = is_enabled
    split = sub.split(factor=0.15)
    col_l = split.column()
    col_r = split.column()
    col_l.alignment = "RIGHT"

    if info_doc_url:
        col_l.label(text="Website")
        try:
            col_r.split(factor=0.5).operator(
                "wm.url_open",
                text=domain_from_url(info_doc_url),
                icon="URL" if is_extension_addon(module_name) else "HELP",
            ).url = info_doc_url
        except Exception:
            row = col_r.row()
            row.operator("wm.url_open", text="打开链接", icon="URL").url = info_doc_url

    if info_tracker_url:
        col_l.label(text="Feedback")
        try:
            col_r.split(factor=0.5).operator(
                "wm.url_open",
                text="Report a Bug",
                icon="URL",
            ).url = info_tracker_url
        except Exception:
            pass

    col_l.label(text="Type")
    col_r.label(text=addon_type_text(module_name, module_file, user_addon), translate=False)

    if info_author:
        col_l.label(text="Maintainer")
        col_r.label(text=info_author, translate=False)

    version_text = format_version_text(info_version)
    if version_text:
        col_l.label(text="Version")
        col_r.label(text=version_text, translate=False)

    if info_warning:
        col_l.label(text="Warning")
        col_r.label(text=" " + str(info_warning), icon="ERROR", translate=False)

    if module_name:
        col_l.label(text="Module")
        col_r.label(text=module_name, translate=False)

    if info_location:
        col_l.label(text="Location")
        col_r.label(text=info_location, translate=False)

    if module_file:
        col_l.label(text="File")
        row = col_r.row(align=True)
        row.label(text=module_file, translate=False)
        try:
            row.operator(
                "dual_firstrow_addon_search.open_folder",
                text="",
                icon="FILE_FOLDER",
            ).filepath = module_file
        except Exception:
            pass

    # --- 嵌入插件自身的 AddonPreferences 绘制 ---
    if is_enabled:
        try:
            addon_prefs = context.preferences.addons.get(module_name)
            if addon_prefs is not None:
                addon_preferences = addon_prefs.preferences
                draw = getattr(addon_preferences, "draw", None)
                if draw is not None:
                    safe_separator(box, "LINE")
                    box.label(text="Preferences")
                    box_prefs = box.box()
                    addon_prefs_class = type(addon_preferences)
                    # 临时注入 layout 属性供插件偏好设置 draw 使用
                    addon_preferences.layout = box_prefs
                    try:
                        draw(context)
                    except Exception:
                        import traceback
                        traceback.print_exc()
                        box_prefs.label(text=_T("绘制偏好设置出错，详见控制台", "Error drawing preferences"), icon="ERROR")
                    finally:
                        try:
                            del addon_prefs_class.layout
                        except Exception:
                            pass
        except Exception:
            pass

def _draw_boot_profiler(layout):
    """绘制启动耗时板块"""
    total_boot = boot.read_total_boot_time()
    if total_boot <= 0:
        return

    col = layout.column()
    box = col.box()
    header = box.row(align=True)
    header.label(text=_T("⏱ 启动耗时", "⏱ Boot Profiler"), icon="TIME")
    header.label(text=f"{total_boot:.1f}s", translate=False)

    avg_boot = boot.average_boot_time()
    if avg_boot > 0:
        box.separator(factor=0.3)
        row = box.row(align=True)
        row.label(text=_T("历史平均:", "Avg (last 5):"), translate=False)
        row.label(text=f"{avg_boot:.1f}s", translate=False)

    diff_val, cur_time = boot.trend_diff()
    if abs(diff_val) > 0.1:
        row = box.row(align=True)
        if diff_val < 0:
            row.label(text=_T(f"⬇ 比上次快 {abs(diff_val):.1f}s", f"⬇ {abs(diff_val):.1f}s faster"), icon="SORT_ASC", translate=False)
        else:
            row.label(text=_T(f"⬆ 比上次慢 {diff_val:.1f}s", f"⬆ {diff_val:.1f}s slower"), icon="SORT_DESC", translate=False)
def _patched_addons_draw(self, context):
    """核心绘制逻辑 - 替换原生 USERPREF_PT_addons.draw"""
    update_lang_cache()
    import addon_utils

    layout = self.layout
    wm = context.window_manager
    prefs = context.preferences

    used_ext = {ext.module for ext in prefs.addons}

    # 加载插件列表（缓存 1 秒）
    addons_cache, addons_time = get_addons_cache()
    now = time.time()
    if now - addons_time > 3.0:
        _CACHE_MODULE_FILE.clear()
        _CACHE_HAYSTACK.clear()
        try:
            addons_cache = [
                (mod, addon_utils.module_bl_info(mod))
                for mod in addon_utils.modules(refresh=False)
            ]
            set_addons_cache(addons_cache, now)
        except Exception:
            addons_cache = []
            set_addons_cache(addons_cache, now)
    addons = addons_cache

    # --- 搜索行 ---
    split = layout.split(factor=0.55)
    row_search = split.row(align=True)
    row_actions = split.row(align=True)

    if hasattr(wm, "addon_search"):
        try:
            row_search.prop(wm, "addon_search", text="", icon="VIEWZOOM", placeholder="")
        except TypeError:
            row_search.prop(wm, "addon_search", text="", icon="VIEWZOOM")
    else:
        row_search.label(text="当前 Blender 没有 wm.addon_search", icon="ERROR")

    try:
        mode = getattr(wm, "dual_addon_search_mode", "OR")
        mode_text = "且" if mode == "AND" else "或"
        sub = row_search.row(align=True)
        sub.scale_x = 0.7
        sub.operator(
            "dual_firstrow_addon_search.toggle_mode",
            text=mode_text,
            translate=False,
            depress=mode == "AND",
        )
    except Exception:
        pass

    try:
        row_search.prop(wm, "dual_addon_search_second", text="", icon="VIEWZOOM", placeholder="")
    except TypeError:
        row_search.prop(wm, "dual_addon_search_second", text="", icon="VIEWZOOM")

    try:
        row_search.menu("DUAL_FIRSTROW_MT_search_history", text="", icon="TIME")
    except Exception:
        pass

    # 右侧操作栏
    if hasattr(prefs.view, "show_addons_enabled_only"):
        row_actions.prop(prefs.view, "show_addons_enabled_only", text="Enabled Only")

    try:
        row_actions.prop(wm, "addon_filter", text="")
    except Exception:
        pass

    try:
        row_actions.prop(wm, "dual_addon_sort_mode", text="", icon="SORTALPHA")
    except Exception:
        pass
    try:
        row_actions.prop(wm, "dual_show_description", text="", icon="ALIGN_JUSTIFY")
    except Exception:
        pass
    try:
        row_actions.menu("DUAL_FIRSTROW_MT_tag_filter_menu", text="", icon="TAG")
    except Exception:
        pass
    row_actions.separator()
    try:
        row_actions.menu("DUAL_FIRSTROW_MT_export_menu", text="", icon="EXPORT")
    except Exception:
        pass
    try:
        row_actions.menu("DUAL_FIRSTROW_MT_profile_menu", text="", icon="FILE_TEXT")
    except Exception:
        pass
    row_actions.separator()
    try:
        row_actions.operator("dual_firstrow_addon_search.disable_non_starred", text="", icon="SOLO_ON")
    except Exception:
        pass

    # 尝试原生设置菜单（5.1 不存在则回退 Install/Refresh）
    _drawn_new_menu = False
    try:
        row_actions.separator()
        row_actions.menu("USERPREF_MT_addons_settings", text="", icon="DOWNARROW_HLT")
        _drawn_new_menu = True
    except Exception:
        pass

    if not _drawn_new_menu:
        row_actions.separator()
        try:
            row_actions.operator("preferences.addon_install", icon="IMPORT", text="")
        except Exception:
            pass
        try:
            row_actions.operator("preferences.addon_refresh", icon="FILE_REFRESH", text="")
        except Exception:
            pass

    # 搜索和过滤
    show_enabled_only = getattr(prefs.view, "show_addons_enabled_only", False)
    search_a = getattr(wm, "addon_search", "").strip().lower()
    search_b = getattr(wm, "dual_addon_search_second", "").strip().lower()
    # --- 搜索历史自动记录（仅内存，不写磁盘，避免每按键都 IO） ---
    _prev_a = getattr(_patched_addons_draw, "_prev_search_a", "")
    if search_a and search_a != _prev_a:
        history_record(search_a)
    _patched_addons_draw._prev_search_a = search_a
    _prev_b = getattr(_patched_addons_draw, "_prev_search_b", "")
    if search_b and search_b != _prev_b:
        history_record(search_b)
    _patched_addons_draw._prev_search_b = search_b
    # ---

    mode = getattr(wm, "dual_addon_search_mode", "OR")
    sort_mode = getattr(wm, "dual_addon_sort_mode", "NAME")
    native_filter = getattr(wm, "addon_filter", "All")
    native_support = getattr(wm, "addon_support", {"OFFICIAL", "COMMUNITY", "TESTING"})

    col = layout.column()
    visible_count = 0
    user_addon_paths = []

    for mod, info in _sort_addons(addons, sort_mode, used_ext):
        module_name = getattr(mod, "__name__", "")
        is_enabled = module_name in used_ext
        info_support = safe_get(info, "support", "COMMUNITY")

        if info_support not in {"OFFICIAL", "COMMUNITY", "TESTING"}:
            continue
        # 原生支持级别过滤
        if info_support not in native_support:
            continue

        # 原生分类过滤
        if native_filter != "All":
            info_category = safe_get(info, "category", "")
            if native_filter == "User":
                if not user_addon_paths:
                    try:
                        import os
                        pref_p = bpy.utils.script_paths_pref()
                        user_addon_paths = [
                            os.path.join(p, "addons") for p in pref_p
                        ]
                        user_addon_paths.append(
                            bpy.utils.user_resource("SCRIPTS", path="addons")
                        )
                        user_addon_paths = [p for p in user_addon_paths if p]
                    except Exception:
                        user_addon_paths = []
                mod_file = getattr(mod, "__file__", "")
                if not any(mod_file.startswith(p) for p in user_addon_paths):
                    continue
            elif info_category != native_filter:
                continue

        is_visible = True

        if show_enabled_only:
            is_visible = is_visible and is_enabled

        if is_visible:
            if not match_dual_search(mod, info, search_a, search_b, mode, _CACHE_HAYSTACK):
                continue

        # 标签筛选
        tag_filter = getattr(wm, "dual_tag_filter", "")
        if is_visible and tag_filter:
            if module_name not in tag_addons_with_tag(tag_filter, _TAG_CACHE, _TAG_CACHE_DIRTY):
                is_visible = False

        if not is_visible:
            continue

        visible_count += 1
        module_file = get_module_file_path(mod, _CACHE_MODULE_FILE)
        info_name = safe_get(info, "name", module_name)
        info_author = safe_get(info, "author")
        info_description = safe_get(info, "description")
        info_warning = safe_get(info, "warning")
        info_doc_url = safe_get(info, "doc_url")

        try:
            user_addon = is_user_addon_fallback(mod, user_addon_paths)
        except Exception:
            user_addon = False

        col.separator(factor=0.15)
        col_box = col.column()
        box = col_box.box()
        colsub = box.column()

        row = colsub.row(align=True)

        # 星标按钮
        try:
            is_starred = starred_has(module_name, _TAG_CACHE, _TAG_CACHE_DIRTY)
            p = row.operator(
                "dual_firstrow_addon_search.star_toggle",
                text="",
                icon="SOLO_ON" if is_starred else "SOLO_OFF",
                emboss=False,
            )
            p.module_name = module_name
        except Exception:
            pass

        _draw_addon_expand_button(row, module_name, bool(info.get("show_expanded", False)))

        try:
            row.operator(
                "preferences.addon_disable" if is_enabled else "preferences.addon_enable",
                icon="CHECKBOX_HLT" if is_enabled else "CHECKBOX_DEHLT",
                text="",
                emboss=False,
            ).module = module_name
        except Exception:
            row.label(text="", icon="CHECKBOX_HLT" if is_enabled else "CHECKBOX_DEHLT")

        sub = row.row()
        sub.active = is_enabled

        # 名称 + 标签
        tags = tag_get(module_name, _TAG_CACHE, _TAG_CACHE_DIRTY)
        if tags:
            split = sub.split(factor=0.6)
            split.active = is_enabled
            left = split.row()
            left.label(text=info_name)
            right = split.row()
            right.alignment = "RIGHT"
            for tag in tags[:3]:
                right.label(text=tag, icon="DOT", translate=False)
            if len(tags) > 3:
                right.label(text=f"+{len(tags)-3}", icon="DOT", translate=False)
        else:
            sub.label(text=info_name)

        # 右键菜单按钮
        try:
            p = row.operator(
                "dual_firstrow_addon_search.context_menu",
                text="",
                icon="DOWNARROW_HLT",
                emboss=False,
            )
            p.module_name = module_name
            p.addon_name = info_name
            p.addon_author = info_author or ""
            p.addon_file = module_file
            p.addon_doc_url = info_doc_url or ""
        except Exception:
            pass

        if info_warning:
            sub.label(icon="ERROR")

        _draw_addon_source_icon(sub, module_name, module_file)

        # 双行显示
        if getattr(wm, "dual_show_description", False) and info_description:
            colsub.separator(factor=0.15)
            row2 = colsub.row(align=True)
            row2.scale_y = 0.75
            indent = row2.split(factor=0.03)
            indent.separator()
            desc_row = indent.row()
            desc_text = str(info_description).strip()
            if len(desc_text) > 200:
                desc_text = desc_text[:197] + "..."
            desc_row.label(text=desc_text, translate=False)

        if info.get("show_expanded", False):
            _draw_modern_addon_expanded(
                box, context, mod, info, module_name, module_file, is_enabled, user_addon
            )

    # 搜索结果计数
    info_line = col.row()
    info_line.scale_y = 0.7
    enabled_count = len(used_ext)
    total_count = len(addons)
    info_line.label(
        text=f"显示 {visible_count} / 共 {total_count} 个插件  (已启用 {enabled_count})",
        icon="INFO",
        translate=False,
    )

    if visible_count == 0:
        info_box = col.box()
        info_box.label(text=_T("没有找到匹配插件。", "No matching add-ons found."), icon="INFO")

    # --- 启动耗时板块 ---
    _draw_boot_profiler(col)

# --- 错误节流 ---
_DRAW_ERROR_LAST_TIME = 0.0

def _safe_patched_addons_draw(self, context):
    """包装 _patched_addons_draw，异常时回退到原生 draw"""
    global _DRAW_ERROR_LAST_TIME
    try:
        _patched_addons_draw(self, context)
    except Exception:
        import traceback
        now = time.time()
        if now - _DRAW_ERROR_LAST_TIME > 10.0:
            _DRAW_ERROR_LAST_TIME = now
            traceback.print_exc()
            print("[Dual Add-on Search] draw 出错，回退到原生面板")
        if _ORIGINAL_ADDONS_DRAW:
            _ORIGINAL_ADDONS_DRAW(self, context)

# --- Patch 管理 ---
_ORIGINAL_ADDONS_DRAW = None
_IS_PATCHED = False

def patch_addons_panel() -> bool:
    """替换原生插件面板 draw 方法"""
    global _ORIGINAL_ADDONS_DRAW, _IS_PATCHED

    if _IS_PATCHED:
        return True

    panel_cls = _get_panel_class()
    if panel_cls is None:
        return False

    _ORIGINAL_ADDONS_DRAW = getattr(panel_cls, "draw", None)
    panel_cls.draw = _safe_patched_addons_draw
    _IS_PATCHED = True
    redraw_preferences()
    return True

def unpatch_addons_panel() -> None:
    """恢复原生插件面板 draw 方法"""
    global _ORIGINAL_ADDONS_DRAW, _IS_PATCHED

    if not _IS_PATCHED:
        return

    panel_cls = _get_panel_class()
    if panel_cls is not None and _ORIGINAL_ADDONS_DRAW is not None:
        panel_cls.draw = _ORIGINAL_ADDONS_DRAW

    _ORIGINAL_ADDONS_DRAW = None
    _IS_PATCHED = False
    redraw_preferences()
