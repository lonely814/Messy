"""USE全局翻译 - 一键式 Blender UI 全局汉化插件
【用途】翻译 Blender 界面、插件列表、雕刻笔刷资产
【5.1 与 4.5 兼容性】manifest 格式 + temp_override + 注解 props，双版本兼容
【运行方式】放入 scripts/addons/ 目录，在偏好设置中启用
"""

# 保留 bl_info 以兼容 scripts/addons/ 下的 legacy 加载路径。
# blender_manifest.toml 供 extension 系统使用，二者共存。
bl_info = {
    "name": "USE全局翻译",
    "author": "布的[微信bude6688],Shuimeng,别人Скучно,666",
    "version": (2, 3, 0),
    "blender": (4, 5, 0),
    "location": "偏好设置 > Add-ons",
    "description": "一键式全局翻译,心无旁骛,你只管专心的创作!",
}

import bpy, os, threading, sys
from bpy.app.handlers import persistent
from bpy.utils import register_classes_factory

# ═══════════════════════════════════════════════════════════
# 自引用 — 子模块通过 `from .. import _root` 获取本模块对象
# 然后通过 _root.up_ok = True 写回共享状态，避免不可变类型值拷贝问题
# ═══════════════════════════════════════════════════════════
_root = sys.modules[__name__]

# ═══════════════════════════════════════════════════════════
# 全局状态变量（子模块通过 from .. import ... 引用或 _root.var = val 修改）
# ═══════════════════════════════════════════════════════════
up_ok = False; z_file = ""; z_time = None
who_mo = None; mo_date = None
down_jd = 0; down_msg = ""; down_ac = False; down_err = False

zh = 'zh_CN' if bpy.app.version < (4, 0, 0) else 'zh_HANS'
mo_path = os.path.join(bpy.utils.user_resource('DATAFILES'), 'locale', zh, 'LC_MESSAGES', 'blender.mo')
mo_dir = os.path.join(bpy.utils.user_resource('DATAFILES'), 'locale', zh, 'LC_MESSAGES')
lo9 = os.path.join(os.path.dirname(__file__), "update.ini")
pmo = os.path.join(os.path.dirname(__file__), 'patch.mo')
core_bl = os.path.join(bpy.utils.resource_path('LOCAL'), 'scripts', 'addons_core', 'bl_pkg')
pyexe = 'python.exe' if sys.platform == "win32" else 'python3.11'
pywork = os.path.join(bpy.utils.resource_path('LOCAL'), 'python', 'bin', pyexe)
lsbak = os.path.join(core_bl, 'bl_extension_ui.py.bak')
ls666 = os.path.join(core_bl, 'bl_extension_ui.py.666')
lscn = os.path.join(core_bl, 'bl_extension_ui.py')
tang = os.path.join(bpy.utils.user_resource('DATAFILES'), 'locale', 'languages')

if bpy.app.version >= (4, 3):
    Brus_you = os.path.join(
        bpy.utils.resource_path('LOCAL'), 'datafiles', 'assets',
        'brushes', 'essentials_brushes-mesh_sculpt.blend.bak')
    ASSET_CONFIGS = [
        {
            'dir': os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'assets', 'brushes'),
            'pattern': ".blend",
            'data_type': 'brushes',
            'collection': 'brushes',
            'name': '笔刷',
        },
        {
            'dir': os.path.join(bpy.utils.resource_path('LOCAL'), 'datafiles', 'assets', 'nodes'),
            'pattern': ".blend",
            'data_type': 'node_groups',
            'collection': 'node_groups',
            'name': '头发节点',
        },
    ]
else:
    Brus_you = None
    ASSET_CONFIGS = []

_translation_stats = {
    "mo_entries": 0,
    "brush_entries": 0,
    "last_update": "",
}

AI_CACHE_FILE = os.path.join(os.path.dirname(__file__), "ai_translate_cache.json")
AI_TRANSLATIONS_ID = "use_cn_ai"

# 初始化时检查 .mo 版本信息
from .core.utils import check_mo as _check_mo
who_mo, mo_date = _check_mo(mo_path)

# ═══════════════════════════════════════════════════════════
# 子模块导入（全局变量必须先于此处定义）
# ═══════════════════════════════════════════════════════════
from .core import utils as _utils_module  # noqa: E402
from .core import i18n as _i18n_module    # noqa: E402
from .core import (                      # noqa: E402
    update_manager as _update_module,
    blf_hook as _blf_module,
    extension_localizer as _ext_module,
    brush_localizer as _brush_module,
)

from .preferences import T_Preferences                        # noqa: E402
from .operators.toggle_language import (                      # noqa: E402
    OT_toggle_cn, draw_language_menu,
    register_keymap, _toggle_interface_language,
)
from .operators.ftp_update import FTP_Update, FTP_check        # noqa: E402
from .operators.import_mo import Mo_m_in                       # noqa: E402
from .operators.restore import Re_translation                  # noqa: E402
from .operators.brush_localize import BRUSH_cn, BRUSH_re       # noqa: E402
from .operators.ai_translate import (                          # noqa: E402
    OT_ai_translate, OT_ai_clear_cache,
)
from .core.extension_localizer import List_def, Re_list        # noqa: E402

# ═══════════════════════════════════════════════════════════
# 注册类列表
# ═══════════════════════════════════════════════════════════
classes = (
    T_Preferences,
    Re_translation,
    List_def,
    Re_list,
    BRUSH_cn,
    BRUSH_re,
    FTP_Update,
    FTP_check,
    OT_toggle_cn,
    Mo_m_in,
    OT_ai_translate,
    OT_ai_clear_cache,
)

_register_classes, _unregister_classes = register_classes_factory(classes)

# ═══════════════════════════════════════════════════════════
# 启动处理
# ═══════════════════════════════════════════════════════════
@persistent
def load_handler(dummy):
    prefs = bpy.context.preferences if bpy.context else None
    if not prefs or not prefs.view:
        return
    view = prefs.view
    try:
        if bpy.app.translations.locale != zh:
            view.language = zh
            _toggle_interface_language()
            _toggle_interface_language()
    except Exception as e:
        _utils_module.log(f"启动语言设置失败: {e}")
    if not view.use_translate_interface:
        view.use_translate_interface = True
    if any("Layout" in ws.name for ws in bpy.data.workspaces):
        _toggle_interface_language()
        _toggle_interface_language()
    threading.Thread(target=_update_module.c_updates, daemon=True).start()
    bpy.app.timers.register(
        lambda: (_utils_module._show_update_notification(), None)[1],
        first_interval=6.0,
    )

# ═══════════════════════════════════════════════════════════
# 快捷键
# ═══════════════════════════════════════════════════════════
language_keymap_items = []


def register():
    _register_classes()

    # 加载翻译
    _i18n_module.load_mo()

    # 恢复 AI 缓存
    ai_cache = _i18n_module._load_ai_cache()
    if ai_cache:
        _i18n_module._register_ai_translations(ai_cache)

    # BLF hook
    _blf_module.smart_hud.register()

    # 语言菜单
    bpy.types.TOPBAR_MT_editor_menus.append(draw_language_menu)

    # 快捷键
    global language_keymap_items
    language_keymap_items = register_keymap()

    # 启动处理
    bpy.app.handlers.load_post.append(load_handler)


def unregister():
    if load_handler in bpy.app.handlers.load_post:
        bpy.app.handlers.load_post.remove(load_handler)

    # 快捷键
    global language_keymap_items
    for km, kmi in language_keymap_items:
        km.keymap_items.remove(kmi)
    language_keymap_items = []

    # 语言菜单
    bpy.types.TOPBAR_MT_editor_menus.remove(draw_language_menu)

    # BLF hook
    _blf_module.smart_hud.unregister()

    # AI 翻译
    try:
        bpy.app.translations.unregister(AI_TRANSLATIONS_ID)
    except RuntimeError:
        pass  # 尚未注册，忽略

    # .mo 翻译
    try:
        bpy.app.translations.unregister("mo")
    except RuntimeError:
        pass  # 尚未注册，忽略

    _unregister_classes()
