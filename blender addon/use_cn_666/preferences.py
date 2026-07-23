"""偏好设置面板"""
import bpy, os
from bpy.types import AddonPreferences
from .core.utils import read_log, _redraw_preferences, adminx
from .core.i18n import _load_ai_cache, _collect_untranslated_addon_names
try:
    from . import Brus_you
except ImportError:
    Brus_you = None
from . import _root
from . import lo9, pmo, tang, __package__ as addon_pkg


class T_Preferences(AddonPreferences):
    bl_idname = addon_pkg

    ai_provider: bpy.props.EnumProperty(
        name="AI 提供商",
        items=[
            ('deepseek', 'DeepSeek', 'DeepSeek API（推荐，中文友好）'),
            ('openai', 'OpenAI', 'OpenAI API（GPT 兼容）'),
        ],
        default='deepseek',
    )
    ai_api_key: bpy.props.StringProperty(
        name="API Key",
        description="输入 AI 提供商的 API Key，仅保存在本地 Blender 配置中",
        subtype='PASSWORD',
        default="",
    )

    def draw(self, context):
        layout = self.layout
        prefs = context.preferences
        c_e = prefs.view.use_translate_interface

        # ── 主开关 ──
        big_row = layout.row(align=True)
        big_row.scale_y = 1.6
        icon = 'CHECKBOX_HLT' if c_e else 'CHECKBOX_DEHLT'
        big_row.operator("ui.toggle_cn", text=" 中/英切换" if c_e else " 点击启用中文",
                         icon=icon, depress=c_e)

        # ── 更新区块 ──
        box = layout.box()
        col = box.column(align=True)
        col.label(text="翻译更新", icon='URL')

        main_8, pack_7 = read_log(lo9)
        z_str = str(_root.z_time) if _root.z_time else ""

        row = col.row(align=True)
        row.label(text=f"当前版本: 主包 {main_8}  补丁 {pack_7}")

        if _root.up_ok and not _root.down_ac:
            row = col.row(align=True)
            is_big = len(z_str) == 8
            if is_big:
                row.alert = True
                row.operator("ftp.u_a", text="立即更新汉化包", icon='IMPORT')
                row.label(text=f"新版本: {_root.z_time}")
            else:
                row.operator("ftp.u_a", text="立即更新补丁包", icon='IMPORT', depress=True)
                row.label(text=f"新版本: {_root.z_time}")
        elif not _root.down_ac:
            row = col.row(align=True)
            row.operator("ftp.f_c", text="检查更新", icon='FILE_REFRESH')
            row.label(text="当前已是最新")

        if _root.down_ac:
            row = col.row(align=True)
            row.alert = _root.down_err
            row.label(text=str(_root.down_msg), icon='ERROR' if _root.down_err else 'INFO')
            if not _root.down_err:
                row = col.row()
                row.progress(factor=_root.down_jd / 100.0, text=f"{_root.down_jd}%")

        row = col.row(align=True)
        row.operator("mo.in_m", text="手动导入汉化包", icon='IMPORT')
        row.operator("wm.re_translation", text="恢复官方翻译", icon='LOOP_BACK')

        # ── 翻译范围区块 ──
        box = layout.box()
        col = box.column(align=True)
        col.label(text="翻译范围", icon='SHADERFX')

        row = col.row(align=True)
        row.label(text="插件和扩展列表", icon='PLUGIN')
        sub = row.row(align=True)
        sub.scale_x = 0.8
        lsbak = os.path.join(
            bpy.utils.resource_path('LOCAL'), 'scripts', 'addons_core',
            'bl_pkg', 'bl_extension_ui.py.bak')
        if os.path.exists(lsbak):
            sub.operator_context = 'EXEC_DEFAULT'
            sub.operator("wm.r_all", text="恢复英文")
        else:
            sub.operator_context = 'INVOKE_DEFAULT'
            sub.operator("list.d_cn", text="汉化名称")
        sub.enabled = not adminx

        row = col.row(align=True)
        row.label(text="雕刻笔刷资产", icon='BRUSHES_ALL')
        sub = row.row(align=True)
        sub.scale_x = 0.8
        brush_bak_exists = 'Brus_you' in globals() and os.path.exists(Brus_you)
        if brush_bak_exists:
            sub.operator("brush_image.re", text="恢复笔刷")
        else:
            sub.operator("brush_image.cn", text="汉化笔刷")
        sub.enabled = not adminx

        # ── 翻译统计区块 ──
        from . import _translation_stats
        box = layout.box()
        col = box.column(align=True)
        col.label(text="翻译统计", icon='INFO')
        stats = _translation_stats

        row = col.row(align=True)
        row.label(text=f"已翻译插件条目: {stats['mo_entries']}")
        row = col.row(align=True)
        row.label(text=f"已翻译笔刷名称: {stats['brush_entries']}")
        row = col.row(align=True)
        last_up = stats["last_update"] if stats["last_update"] else "未知"
        row.label(text=f"最后更新: {last_up}")

        # ── AI 翻译区块 ──
        box = layout.box()
        col = box.column(align=True)
        col.label(text="AI 翻译补充", icon='NETWORK_DRIVE')
        row = col.row(align=True)
        row.prop(self, "ai_provider", text="")
        row.prop(self, "ai_api_key", text="Key")

        ai_cache = _load_ai_cache()
        pending = len(_collect_untranslated_addon_names())
        row = col.row(align=True)
        row.label(text=f"已缓存: {len(ai_cache)} 条  待翻译: {pending} 个")
        row = col.row(align=True)
        row.operator("ai.translate_names", text="AI 翻译未覆盖名称", icon='CONSOLE')
        row.operator("ai.clear_cache", text="清除缓存", icon='X')
        info_box = col.box()
        info_box.scale_y = 0.7
        info_box.label(text="API Key 仅保存在本地配置中，不会上传", icon='INFO')

        # ── 底部链接 ──
        row = layout.row(align=True)
        row.separator(factor=0.5)
        row.operator("wm.url_open", text="问题与技巧", icon='HELP',
                     depress=True).url = "https://www.bilibili.com/video/BV1JaaZzbEpc"
        row.separator(factor=0.3)
        row.label(text="QQ群: 386107819", icon='GROUP')
