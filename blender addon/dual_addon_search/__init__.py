"""【用途】Dual Addon Search v3.0 - 插件注册入口
【5.1 与 4.5 兼容性】
- 5.1: 使用 register_classes_factory 模式
- 4.5: 完全兼容，所有 API 均为 4.5+ 可用
【运行方式】安装为 Blender 扩展或传统插件
"""

bl_info = {
    "name": "插件双搜索",
    "author": "lonely",
    "version": (3, 0, 0),
    "blender": (4, 2, 0),
    "location": "编辑 > 偏好设置 > 插件",
    "description": "插件双搜索 & 快捷键搜索 & Profile & 健康概览",
    "category": "Interface",
}

VERSION = (3, 0, 0)

import bpy
from bpy.utils import register_classes_factory

from .utils.cache import clear_search_caches
from .utils.i18n import _T, update_lang_cache
from .utils.ui_helpers import redraw_preferences
from .data import history
from .data import boot_profiler as boot

# --- 操作器 ---
from .operators.search import (
    DUAL_FIRSTROW_OT_clear_search,
    DUAL_FIRSTROW_OT_toggle_search_mode,
    DUAL_FIRSTROW_OT_search_history_clear,
    DUAL_FIRSTROW_OT_search_history_apply,
    DUAL_FIRSTROW_MT_search_history,
)
from .operators.addon_ops import (
    DUAL_FIRSTROW_OT_open_addon_folder,
    DUAL_FIRSTROW_OT_google_search,
    DUAL_FIRSTROW_OT_context_menu,
    DUAL_FIRSTROW_OT_copy_text,
    DUAL_FIRSTROW_OT_link_github,
    DUAL_FIRSTROW_OT_remove_addon,
    DUAL_FIRSTROW_MT_addon_actions,
)
from .operators.tags import (
    DUAL_FIRSTROW_OT_tag_toggle,
    DUAL_FIRSTROW_OT_tag_add_new,
    DUAL_FIRSTROW_OT_tag_remove_global,
    DUAL_FIRSTROW_OT_tag_set_filter,
    DUAL_FIRSTROW_MT_tag_menu,
    DUAL_FIRSTROW_MT_tag_filter_menu,
)
from .operators.star import DUAL_FIRSTROW_OT_star_toggle
from .operators.profile import (
    DUAL_FIRSTROW_OT_profile_save,
    DUAL_FIRSTROW_OT_profile_load,
    DUAL_FIRSTROW_OT_profile_delete,
    DUAL_FIRSTROW_OT_disable_non_starred,
    DUAL_FIRSTROW_MT_profile_menu,
)
from .operators.export import (
    DUAL_FIRSTROW_OT_export_snapshot_markdown,
    DUAL_FIRSTROW_OT_export_snapshot_json,
    DUAL_FIRSTROW_MT_export_menu,
)
from .operators.keymap import DUAL_FIRSTROW_OT_keymap_capture

# --- 面板 ---
from .panels.addon_list import patch_addons_panel, unpatch_addons_panel


# ==============================
# AddonPreferences
# ==============================

class DUAL_FIRSTROW_AP_addon_prefs(bpy.types.AddonPreferences):
    bl_idname = __name__

    dual_enable_keymap: bpy.props.BoolProperty(
        name=_T("启用键位映射快捷键搜索", "Enable Keymap Shortcut Search"),
        default=True,
    )
    def draw(self, context):
        layout = self.layout

        # --- 标题区域 ---
        box = layout.box()
        header = box.column(align=True)
        row = header.row(align=True)
        row.label(text=_T("插件双搜索", "Dual Addon Search"), icon="PLUGIN")
        row.label(text="v" + ".".join(str(v) for v in VERSION), translate=False)
        header.separator(factor=0.3)
        header.label(text=_T(
            "增强 Blender 插件管理面板：双搜索、星标、标签、批量、Profile、健康概览",
            "Supercharge Blender addon management: dual search, star, tags, batch, profiles, health"
        ), icon="INFO")

        layout.separator(factor=0.5)

        # --- 功能概览（四列） ---
        main = layout.row(align=True)

        # 第一列：搜索与浏览
        col1 = main.column()
        box1 = col1.box()
        box1.label(text=_T("搜索与浏览", "Search & Browse"), icon="VIEWZOOM")
        box1.separator(factor=0.3)
        tips1 = [
            ("①", _T("双搜索框：同时搜索名称+作者/分类+描述", "Dual search: name + author / category + desc")),
            ("②", _T("搜索框中间 [且/或] 切换匹配模式", "Toggle AND/OR mode between search boxes")),
            ("③", _T("底部显示匹配结果计数", "Result count shown at the bottom")),
            ("④", _T("排序下拉：星标优先 / 名称 / 版本 / 启用状态", "Sort by: star, name, version, enabled")),
        ]
        for num, tip in tips1:
            r = box1.row(align=True)
            r.label(text=num, translate=False)
            r.label(text=tip)

        # 第二列：管理与批量
        col2 = main.column()
        box2 = col2.box()
        box2.label(text=_T("管理与批量", "Manage & Batch"), icon="TOOL_SETTINGS")
        box2.separator(factor=0.3)
        tips2 = [
            ("①", _T("行首 ☆ 星标按钮：收藏常用插件自动置顶", "Star button to pin favorite addons")),
            ("②", _T("☑ 批量勾选 + 底部批量启用/禁用", "Batch select + batch enable/disable")),
            ("③", _T("▼ 右键菜单：复制名称/模块/作者", "Right-click: copy name/module/author")),
            ("④", _T("❖ 标签管理：自定义标签 + 按标签筛选", "Tags: custom labels + filter by tag")),
        ]
        for num, tip in tips2:
            r = box2.row(align=True)
            r.label(text=num, translate=False)
            r.label(text=tip)

        # 第三列：快捷键与导出
        col3 = main.column()
        box3 = col3.box()
        box3.label(text=_T("快捷键与导出", "Shortcut & Export"), icon="KEYINGSET")
        box3.separator(factor=0.3)
        tips3 = [
            ("①", _T("键位映射页：点击搜索框后直接按快捷键", "Keymap page: press shortcut to search")),
            ("②", _T("支持精确匹配：严格区分 Ctrl/Shift/Alt", "Exact match: distinguishes modifiers")),
            ("③", _T("右键菜单：Google 搜索 / 打开文件夹/网站", "Right-click: Google / Open folder/website")),
            ("④", _T("导出快照：Markdown(剪贴板) / JSON(文件)", "Export snapshot: MD(clipboard) / JSON(file)")),
        ]
        for num, tip in tips3:
            r = box3.row(align=True)
            r.label(text=num, translate=False)
            r.label(text=tip)

        # 第四列：其他功能
        col4 = main.column()
        box4 = col4.box()
        box4.label(text=_T("其他功能", "Other Features"), icon="ADD")
        box4.separator(factor=0.3)
        tips4 = [
            ("①", _T("Profile 快照：保存/加载插件启用状态", "Profiles: save/load addon enable state")),
            ("②", _T("搜索历史：最近搜索快速回退", "Search history: recent searches")),
            ("③", _T("一键关闭非收藏插件", "One-click disable non-starred addons")),
            ("④", _T("批量勾选：底部批量启用/禁用选中插件", "Batch select + batch enable/disable")),
        ]
        for num, tip in tips4:
            r = box4.row(align=True)
            r.label(text=num, translate=False)
            r.label(text=tip)

        layout.separator(factor=0.5)

        # --- 展开详情说明 ---
        box = layout.box()
        box.label(text=_T("展开详情", "Expanded Details"), icon="DISCLOSURE_TRI_RIGHT")
        box.separator(factor=0.3)
        box.label(text=_T(
            "点击插件左侧 ▶ 展开，可查看：描述、类型标记(Local/Extension/Built-in)、文件大小与修改时间、Google 搜索、右键菜单",
            "Click ▶ to expand: description, source icon, file size & date, Google search, right-click menu"
        ))

        layout.separator(factor=0.5)

        # --- 数据存储说明 ---
        box = layout.box()
        box.label(text=_T("数据存储", "Data Storage"), icon="FILE_TEXT")
        box.separator(factor=0.3)
        box.label(text=_T(
            "标签/星标 → dual_addon_tags.json  |  搜索历史 → dual_addon_search_history.json  |  Profile → dual_addon_profiles.json",
            "Tags/stars: dual_addon_tags.json  |  Search history: dual_addon_search_history.json  |  Profiles: dual_addon_profiles.json"
        ))

        layout.separator(factor=0.5)

        # --- 功能设置 ---
        box = layout.box()
        box.label(text=_T("功能设置", "Feature Settings"), icon="SETTINGS")
        box.separator(factor=0.3)
        box.prop(self, "dual_enable_keymap", text=_T("启用键位映射快捷键搜索", "Enable Keymap Shortcut Search"))
        # --- 版权 ---
        row = layout.row(align=True)
        row.label(text=_T(
            "作者: lonely  |  兼容 Blender 4.2+",
            "Author: lonely  |  Compatible: Blender 4.2+"
        ), icon="BLENDER")


# ==============================
# 类注册列表（按依赖顺序排列）
# ==============================

classes = (
    # Preferences
    DUAL_FIRSTROW_AP_addon_prefs,
    # Operators
    DUAL_FIRSTROW_OT_clear_search,
    DUAL_FIRSTROW_OT_toggle_search_mode,
    DUAL_FIRSTROW_OT_search_history_clear,
    DUAL_FIRSTROW_OT_search_history_apply,
    DUAL_FIRSTROW_OT_open_addon_folder,
    DUAL_FIRSTROW_OT_google_search,
    DUAL_FIRSTROW_OT_context_menu,
    DUAL_FIRSTROW_OT_copy_text,
    DUAL_FIRSTROW_OT_link_github,
    DUAL_FIRSTROW_OT_remove_addon,
    DUAL_FIRSTROW_OT_tag_toggle,
    DUAL_FIRSTROW_OT_tag_add_new,
    DUAL_FIRSTROW_OT_tag_remove_global,
    DUAL_FIRSTROW_OT_tag_set_filter,
    DUAL_FIRSTROW_OT_star_toggle,
    DUAL_FIRSTROW_OT_profile_save,
    DUAL_FIRSTROW_OT_profile_load,
    DUAL_FIRSTROW_OT_profile_delete,
    DUAL_FIRSTROW_OT_disable_non_starred,
    DUAL_FIRSTROW_OT_export_snapshot_markdown,
    DUAL_FIRSTROW_OT_export_snapshot_json,
    DUAL_FIRSTROW_OT_keymap_capture,
    # Menus
    DUAL_FIRSTROW_MT_search_history,
    DUAL_FIRSTROW_MT_addon_actions,
    DUAL_FIRSTROW_MT_tag_menu,
    DUAL_FIRSTROW_MT_tag_filter_menu,
    DUAL_FIRSTROW_MT_profile_menu,
    DUAL_FIRSTROW_MT_export_menu,
)

_register_classes, _unregister_classes = register_classes_factory(classes)


# ==============================
# WindowManager 属性注册（5.1 兼容）
# ==============================

def _register_wm_properties():
    """注册 WindowManager 属性"""
    # 第二搜索框
    bpy.types.WindowManager.dual_addon_search_second = bpy.props.StringProperty(
        name="搜索 2",
        description="第二个插件搜索框",
        default="",
        options={"TEXTEDIT_UPDATE"},
        update=lambda self, ctx: redraw_preferences(),
    )

    # 搜索模式
    bpy.types.WindowManager.dual_addon_search_mode = bpy.props.EnumProperty(
        name="匹配",
        description="两个搜索框同时有内容时的匹配方式",
        items=[
            ("OR", "任意", "搜索 1 或搜索 2 命中即可显示"),
            ("AND", "同时", "必须同时命中搜索 1 和搜索 2 才显示"),
        ],
        default="OR",
        update=lambda self, ctx: redraw_preferences(),
    )

    # 右键菜单上下文
    bpy.types.WindowManager.dual_ctx_module = bpy.props.StringProperty(default="")
    bpy.types.WindowManager.dual_ctx_name = bpy.props.StringProperty(default="")
    bpy.types.WindowManager.dual_ctx_author = bpy.props.StringProperty(default="")
    bpy.types.WindowManager.dual_ctx_file = bpy.props.StringProperty(default="")
    bpy.types.WindowManager.dual_ctx_doc_url = bpy.props.StringProperty(default="")

    # 标签筛选
    bpy.types.WindowManager.dual_tag_filter = bpy.props.StringProperty(
        name="标签筛选",
        description="按标签筛选插件列表",
        default="",
    )

    # 双行显示
    bpy.types.WindowManager.dual_show_description = bpy.props.BoolProperty(
        name="双行显示",
        description="每行插件显示两行：名称 + 描述",
        default=False,
        update=lambda self, ctx: redraw_preferences(),
    )

    # 排序模式
    bpy.types.WindowManager.dual_addon_sort_mode = bpy.props.EnumProperty(
        name="排序",
        description="插件列表排序方式",
        items=[
            ("STAR", "星标优先", "星标收藏的插件排在前面"),
            ("NAME", "名称 A-Z", "按名称升序"),
            ("ENAME", "名称 Z-A", "按名称降序"),
            ("ENABLED", "已启用优先", "已启用的插件排在前面"),
            ("DISABLED", "已禁用优先", "已禁用的插件排在前面"),
            ("VERSION", "版本号", "按版本号从高到低"),
        ],
        default="STAR",
        update=lambda self, ctx: redraw_preferences(),
    )

    # 快捷键捕获
    bpy.types.WindowManager.dual_keymap_capture_active = bpy.props.BoolProperty(
        default=False, options={"SKIP_SAVE"},
    )
    bpy.types.WindowManager.dual_keymap_exact_enabled = bpy.props.BoolProperty(
        description="Keybinding search matches modifiers exactly",
        default=False,
        update=lambda self, ctx: redraw_preferences(),
    )
    bpy.types.WindowManager.dual_keymap_exact_text = bpy.props.StringProperty(
        default="", options={"SKIP_SAVE"}
    )
    bpy.types.WindowManager.dual_keymap_exact_signature = bpy.props.StringProperty(
        default="", options={"SKIP_SAVE"}
    )


def _unregister_wm_properties():
    """清理 WindowManager 属性"""
    props_to_delete = [
        "dual_addon_search_second",
        "dual_addon_search_mode",
        "dual_ctx_module",
        "dual_ctx_name",
        "dual_ctx_author",
        "dual_ctx_file",
        "dual_ctx_doc_url",
        "dual_tag_filter",
        "dual_show_description",
        "dual_addon_sort_mode",
        "dual_keymap_capture_active",
        "dual_keymap_exact_enabled",
        "dual_keymap_exact_text",
        "dual_keymap_exact_signature",
    ]
    for prop_name in props_to_delete:
        if hasattr(bpy.types.WindowManager, prop_name):
            try:
                delattr(bpy.types.WindowManager, prop_name)
            except Exception:
                pass


# ==============================
# 注册/注销
# ==============================

_IS_REGISTERED = False


def register():
    global _IS_REGISTERED
    if _IS_REGISTERED:
        print("[Dual Add-on Search] 已注册，跳过重复注册")
        return

    update_lang_cache()
    history.history_init()
    clear_search_caches()

    # 注册类
    _register_classes()

    # 注册 WindowManager 属性
    _register_wm_properties()

    # Patch 面板
    ok = patch_addons_panel()
    if not ok:
        print("[Dual Add-on Search] 没有找到 USERPREF_PT_addons")

    # Patch Keymap
    try:
        prefs = bpy.context.preferences.addons[__name__].preferences
        _ek = prefs.dual_enable_keymap if hasattr(prefs, "dual_enable_keymap") else True
    except Exception:
        _ek = True
    if _ek:
        ok_keymap = _patch_keymap_ui()
        if not ok_keymap:
            print("[Dual Add-on Search] 没有找到 rna_keymap_ui.draw_keymaps")

    # 安装启动补丁
    boot.register_handler()

    _IS_REGISTERED = True
    print(f"[Dual Add-on Search] v{'.'.join(str(v) for v in VERSION)} 已注册")


def unregister():
    global _IS_REGISTERED
    if not _IS_REGISTERED:
        print("[Dual Add-on Search] 尚未注册，跳过注销")
        return

    _IS_REGISTERED = False

    # Unpatch
    unpatch_addons_panel()
    _unpatch_keymap_ui()
    boot.unregister_handler()

    # 清理 WindowManager 属性
    _unregister_wm_properties()

    # 注销类（反向）
    _unregister_classes()

    print(f"[Dual Add-on Search] v{'.'.join(str(v) for v in VERSION)} 已注销")


# ==============================
# Keymap Patch
# ==============================

_ORIGINAL_KEYMAP_DRAW_KEYMAPS = None
_IS_KEYMAP_PATCHED = False
_PATCHED_DRAW_KEYMAPS = None


# ==============================
# 精确快捷键匹配辅助
# ==============================

def _kmi_to_exact_signature(kmi):
    """把 KeyMapItem 转为精确快捷键签名"""
    from .operators.keymap import _bool_attr, _modifier_state
    try:
        if _bool_attr(getattr(kmi, "any", False)):
            return ""
    except Exception:
        pass
    try:
        key_modifier = getattr(kmi, "key_modifier", "NONE")
        if key_modifier not in {"", "NONE", None}:
            return ""
    except Exception:
        pass
    ctrl = _modifier_state(getattr(kmi, "ctrl", False))
    shift = _modifier_state(getattr(kmi, "shift", False))
    alt = _modifier_state(getattr(kmi, "alt", False))
    oskey = _modifier_state(getattr(kmi, "oskey", False))
    hyper = _modifier_state(getattr(kmi, "hyper", False))
    if None in {ctrl, shift, alt, oskey, hyper}:
        return ""
    from .operators.keymap import _shortcut_signature
    return _shortcut_signature(
        getattr(kmi, "type", ""),
        ctrl, shift, alt, oskey, hyper,
    )


def _use_exact_keymap_search(context, filter_type, filter_text):
    """判断是否应启用精确快捷键过滤"""
    if filter_type != "KEY" or not filter_text:
        return False
    wm = getattr(context, "window_manager", None)
    if wm is None:
        return False
    if not bool(getattr(wm, "dual_keymap_exact_enabled", False)):
        return False
    exact_text = getattr(wm, "dual_keymap_exact_text", "")
    exact_signature = getattr(wm, "dual_keymap_exact_signature", "")
    if not exact_text or not exact_signature:
        return False
    from .operators.keymap import _normalize_shortcut_text
    return _normalize_shortcut_text(filter_text) == _normalize_shortcut_text(exact_text)


def _iter_display_keymaps(display_keymaps):
    """遍历 keyconfig_merge 返回的 keymap 结构"""
    seen = set()
    def yield_keymap(km):
        if km is None or not hasattr(km, "keymap_items"):
            return None
        key = id(km)
        if key in seen:
            return None
        seen.add(key)
        return km
    keymaps = getattr(display_keymaps, "keymaps", None)
    if keymaps is not None:
        for km in keymaps:
            result = yield_keymap(km)
            if result is not None:
                yield result
        return
    try:
        iterator = iter(display_keymaps)
    except Exception:
        return
    for item in iterator:
        if hasattr(item, "keymap_items"):
            result = yield_keymap(item)
            if result is not None:
                yield result
            continue
        if isinstance(item, (tuple, list)):
            for sub in item:
                if hasattr(sub, "keymap_items"):
                    result = yield_keymap(sub)
                    if result is not None:
                        yield result


def _kmi_pretty_shortcut(kmi):
    """KeyMapItem 的可读快捷键文本"""
    from .operators.keymap import _bool_attr, _event_type_to_search_token
    try:
        text = kmi.to_string()
        if text:
            return text
    except Exception:
        pass
    parts = []
    if _bool_attr(getattr(kmi, "ctrl", False)):
        parts.append("Ctrl")
    if _bool_attr(getattr(kmi, "shift", False)):
        parts.append("Shift")
    if _bool_attr(getattr(kmi, "alt", False)):
        parts.append("Alt")
    if _bool_attr(getattr(kmi, "oskey", False)):
        parts.append("OSKey")
    if _bool_attr(getattr(kmi, "hyper", False)):
        parts.append("Hyper")
    parts.append(_event_type_to_search_token(getattr(kmi, "type", "")))
    return " ".join(p for p in parts if p)


def _draw_keymap_item_fallback(box, kmi):
    """draw_kmi 不兼容时的兜底显示"""
    from .operators.keymap import _bool_attr
    row = box.row(align=True)
    try:
        row.prop(kmi, "active", text="")
    except Exception:
        row.label(text="", icon="CHECKBOX_HLT")
    try:
        name = kmi.name or kmi.idname
    except Exception:
        name = "Keymap Item"
    row.label(text=name, translate=False)
    row.label(text=_kmi_pretty_shortcut(kmi), icon="KEYINGSET", translate=False)


def _draw_keymap_item_exact(context, rna_keymap_ui, display_keymaps, km, kmi, box, level=0):
    """精确模式绘制单个快捷键项"""
    wm = context.window_manager
    kc_active = getattr(wm.keyconfigs, "active", None)
    kc_user = getattr(wm.keyconfigs, "user", None)
    for args in (
        (display_keymaps, kc_user, km, kmi, box, level),
        ([], kc_user, km, kmi, box, level),
        (display_keymaps, kc_active, km, kmi, box, level),
        ([], kc_active, km, kmi, box, level),
        (kc_user, km, kmi, box, level),
        (km, kmi, box, level),
    ):
        try:
            rna_keymap_ui.draw_kmi(*args)
            return
        except Exception:
            pass
    _draw_keymap_item_fallback(box, kmi)


def _draw_exact_keymap_filtered(context, display_keymaps, filter_text, exact_signature, layout):
    """精确绘制 Key-Binding 搜索结果（必须完整签名匹配）"""
    import rna_keymap_ui
    col = layout.column()
    found = False
    for km in _iter_display_keymaps(display_keymaps):
        try:
            keymap_items = list(km.keymap_items)
        except Exception:
            continue
        matched_items = []
        for kmi in keymap_items:
            try:
                if _kmi_to_exact_signature(kmi) == exact_signature:
                    matched_items.append(kmi)
            except Exception:
                pass
        if not matched_items:
            continue
        found = True
        box = col.box()
        header = box.row(align=True)
        try:
            km_name = km.name
        except Exception:
            km_name = "?"
        try:
            header.label(text=km_name)
        except Exception:
            pass
        for kmi in matched_items:
            _draw_keymap_item_exact(context, rna_keymap_ui, display_keymaps, km, kmi, box)
    if not found:
        col.label(text=_T("没有找到精确匹配的快捷键组合", "No exact shortcut match found"), icon="INFO")


def _patch_keymap_ui() -> bool:
    """替换原生 keymap draw"""
    global _ORIGINAL_KEYMAP_DRAW_KEYMAPS, _IS_KEYMAP_PATCHED, _PATCHED_DRAW_KEYMAPS

    if _IS_KEYMAP_PATCHED:
        return True

    try:
        import rna_keymap_ui
    except Exception as ex:
        print("[Dual Add-on Search] 无法导入 rna_keymap_ui:", ex)
        return False

    _ORIGINAL_KEYMAP_DRAW_KEYMAPS = getattr(rna_keymap_ui, "draw_keymaps", None)
    if _ORIGINAL_KEYMAP_DRAW_KEYMAPS is None:
        print("[Dual Add-on Search] 没有找到 rna_keymap_ui.draw_keymaps")
        return False

    # 简化的 keymap draw（保留原生功能，仅添加精确匹配）
    from .operators.keymap import (
        _is_pure_modifier_event, _normalize_shortcut_text, _bool_attr,
        _modifier_state, _shortcut_signature, _event_to_exact_signature,
        _event_type_to_search_token
    )

    def _patched_draw_keymaps(context, layout):
        from bl_keymap_utils.io import keyconfig_merge
        import rna_keymap_ui

        wm = context.window_manager
        kc_user = wm.keyconfigs.user
        kc_active = wm.keyconfigs.active
        spref = context.space_data

        # Keymap 预设行
        text = bpy.path.display_name(kc_active.name, has_ext=False)
        if not text:
            text = "Blender (default)"

        split = layout.split(factor=0.6)
        row = split.row()
        rowsub = row.row(align=True)
        rowsub.menu("USERPREF_MT_keyconfigs", text=text)
        rowsub.operator("wm.keyconfig_preset_add", text="", icon="ADD")
        rowsub.operator("wm.keyconfig_preset_remove", text="", icon="REMOVE")

        rowsub = split.row(align=True)
        rowsub.operator("preferences.keyconfig_import", text="Import...", icon="IMPORT")
        rowsub.operator("preferences.keyconfig_export", text="Export...", icon="EXPORT")

        row = layout.row()
        col = layout.column()

        rowsub = row.split(factor=0.4, align=True)
        layout.separator()

        display_keymaps = keyconfig_merge(kc_user, kc_user)
        filter_type = getattr(spref, "filter_type", "NAME")
        filter_text = getattr(spref, "filter_text", "").strip()

        if filter_text:
            if _use_exact_keymap_search(context, filter_type, filter_text):
                exact_signature = getattr(wm, "dual_keymap_exact_signature", "")
                ok = _draw_exact_keymap_filtered(context, display_keymaps, filter_text, exact_signature, layout)
            else:
                ok = rna_keymap_ui.draw_filtered(display_keymaps, filter_type, filter_text.lower(), layout)
        else:
            rna_keymap_ui.draw_hierarchy(display_keymaps, layout)
            ok = True

        # 搜索行
        rowsubsub = rowsub.row(align=True)
        rowsubsub.prop(spref, "filter_type", expand=True)

        exact_row = rowsubsub.row(align=True)
        exact_row.prop(wm, "dual_keymap_exact_enabled", text="精确匹配", toggle=True)

        rowsubsub = rowsub.row(align=True)

        capture_active = bool(getattr(wm, "dual_keymap_capture_active", False))
        if (not ok) or capture_active:
            rowsubsub.alert = True

        current_filter_type = getattr(spref, "filter_type", "NAME")
        search_placeholder = ""
        if current_filter_type == "NAME":
            search_placeholder = "Search by Name"
        elif current_filter_type == "KEY":
            search_placeholder = "Search by Key-Binding"

        if current_filter_type == "KEY":
            field_text = filter_text if filter_text else search_placeholder
            if capture_active:
                field_text = "按下快捷键..."
            if not field_text:
                field_text = "按快捷键搜索"
            try:
                rowsubsub.operator(
                    "dual_firstrow_addon_search.keymap_capture",
                    text=field_text,
                    icon="VIEWZOOM",
                )
            except TypeError:
                rowsubsub.operator("dual_firstrow_addon_search.keymap_capture", text=field_text)
        else:
            try:
                rowsubsub.prop(
                    spref,
                    "filter_text",
                    text="",
                    icon="VIEWZOOM",
                    placeholder=search_placeholder,
                )
            except TypeError:
                rowsubsub.prop(spref, "filter_text", text="", icon="VIEWZOOM")

        # Keymap 偏好设置
        if not filter_text:
            kc_prefs = kc_active.preferences
            if kc_prefs is not None:
                box = col.box()
                row = box.row(align=True)
                pref = context.preferences
                keymappref = pref.keymap
                show_ui_keyconfig = keymappref.show_ui_keyconfig
                row.prop(
                    keymappref,
                    "show_ui_keyconfig",
                    text="",
                    icon="DISCLOSURE_TRI_DOWN" if show_ui_keyconfig else "DISCLOSURE_TRI_RIGHT",
                    emboss=False,
                )
                row.label(text="Preferences")
                if show_ui_keyconfig:
                    try:
                        kc_prefs.draw(box)
                    except Exception:
                        import traceback
                        traceback.print_exc()

    _PATCHED_DRAW_KEYMAPS = _patched_draw_keymaps
    rna_keymap_ui.draw_keymaps = _PATCHED_DRAW_KEYMAPS
    _IS_KEYMAP_PATCHED = True
    redraw_preferences()
    return True


def _unpatch_keymap_ui():
    """恢复原生 keymap draw"""
    global _ORIGINAL_KEYMAP_DRAW_KEYMAPS, _IS_KEYMAP_PATCHED, _PATCHED_DRAW_KEYMAPS

    if not _IS_KEYMAP_PATCHED:
        return

    try:
        import rna_keymap_ui
        # 仅在当前 patched 函数恰好是自己时才恢复，避免覆盖其他插件
        if getattr(rna_keymap_ui, "draw_keymaps", None) is _PATCHED_DRAW_KEYMAPS:
            if _ORIGINAL_KEYMAP_DRAW_KEYMAPS is not None:
                rna_keymap_ui.draw_keymaps = _ORIGINAL_KEYMAP_DRAW_KEYMAPS
    except Exception:
        pass

    _ORIGINAL_KEYMAP_DRAW_KEYMAPS = None
    _IS_KEYMAP_PATCHED = False
    _PATCHED_DRAW_KEYMAPS = None
    redraw_preferences()


if __name__ == "__main__":
    register()
