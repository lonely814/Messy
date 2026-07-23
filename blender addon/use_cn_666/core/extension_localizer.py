"""插件列表本地化 — 通过正则修改 bl_extension_ui.py 实现汉化"""
import bpy, os, sys, re, shutil, importlib
from .utils import log, _redraw_preferences
from .. import lscn, lsbak, ls666


def _reload_bl_pkg_and_redraw():
    """重载 bl_pkg 子模块后，重新注册 Panel 绘制函数"""
    if "bl_pkg" not in sys.modules:
        return
    try:
        from bl_ui.space_userpref import USERPREF_PT_addons, USERPREF_PT_extensions
    except ImportError:
        log("无法导入 USERPREF_PT_addons，跳过重绘")
        return
    try:
        from bl_pkg.bl_extension_ui import (
            addons_panel_draw as old_addons,
            extensions_panel_draw as old_extensions,
        )
    except ImportError:
        old_addons = old_extensions = None

    for panel, old_fn in (
        (USERPREF_PT_addons, old_addons),
        (USERPREF_PT_extensions, old_extensions),
    ):
        if old_fn is not None:
            try:
                panel.remove(old_fn)
            except ValueError:
                pass  # 尚未注册，忽略

    for sub in ("bl_extension_ui", "bl_extension_utils", "bl_extension_ops",
                "bl_extension_notify", "bl_extension_cli"):
        mod_name = f"bl_pkg.{sub}"
        if mod_name in sys.modules:
            try:
                importlib.reload(sys.modules[mod_name])
            except Exception as e:
                log(f"reload {mod_name} 失败: {e}")

    try:
        from bl_pkg.bl_extension_ui import (
            addons_panel_draw as new_addons,
            extensions_panel_draw as new_extensions,
        )
    except ImportError:
        log("重新导入 bl_extension_ui 失败")
        return

    for panel, new_fn in (
        (USERPREF_PT_addons, new_addons),
        (USERPREF_PT_extensions, new_extensions),
    ):
        try:
            panel.append(new_fn)
        except Exception as e:
            log(f"panel.append 失败: {e}")


patterns_cn = [
    (r'(col_b\.label\()text=item_maintainer(,\s*)translate=False(\))',
     r'\1text=item_maintainer\2translate=True\3'),
    (r'(sub\.label\()text=" " \+ item_name(,\s*)translate=False(\))',
     r'\1text=item_name\2translate=True\3'),
    (r'(col_a\.label\(\s*)text=" \{:s\}\."\.format\(item_description\)(,\s*)translate=False(,\s*\))',
     r'\1text=item_description\2translate=True\3'),
    (r'(sub\.label\()text=item\.name(,\s*icon=\'ERROR\',\s*)translate=False(\))',
     r'\1text=item.name\2translate=True\3'),
    (r'(sub\.label\()text=item\.name(,\s*)translate=False(\))',
     r'\1text=item.name\2translate=True\3'),
    (r'(row\.label\()text=" \{:s\}\."\.format\(item\.tagline\)(,\s*)translate=False(\))',
     r'\1text=item.tagline\2translate=True\3'),
]
patterns_cnen = [
    (r'(col_b\.label\()text=item_maintainer(,\s*)translate=False(\))',
     r'\1text=item_maintainer\2translate=True\3'),
    (r'(# Draw header\.)',
     r'cn_name = bpy.app.translations.pgettext(item_name)'),
    (r'sub\.label\(text=" "\s*\+\s*item_name,\s*translate=False\)',
     r'sub.label(text=f"{cn_name} ({item_name})")'),
    (r'(col_a\.label\(\s*)text=" \{:s\}\."\.format\(item_description\)(,\s*)translate=False(,\s*\))',
     r'\1text=item_description\2translate=True\3'),
    (r'(# extensions based on them being used or not\.)',
     r'cn_name = bpy.app.translations.pgettext(item.name)'),
    (r'sub\.label\(text=item\.name,\s*icon=\'ERROR\',\s*translate=False\)',
     r'sub.label(text=f"{cn_name} ({item.name})", icon="ERROR")'),
    (r'sub\.label\(text=item\.name,\s*translate=False\)',
     r'sub.label(text=f"{cn_name} ({item.name})")'),
    (r'(row\.label\()text=" \{:s\}\."\.format\(item\.tagline\)(,\s*)translate=False(\))',
     r'\1text=item.tagline\2translate=True\3'),
]


class List_def(bpy.types.Operator):
    bl_idname = "list.d_cn"
    bl_label = "插件列表汉化"
    bl_description = ("点击翻译插件列表\nCtrl加点击: 双语列表\nAlt加点击: 单汉化\n"
                      "按钮灰色表示权限不足\n请以管理员身份运行blender\n"
                      "Mac和Linux报错多半是权限问题\n需自行解决权限问题")

    def invoke(self, context, event):
        try:
            if event.ctrl:
                log("双语汉化模式")
                return self.execute_translate(context, mode='cnen')
            elif event.alt:
                log("单语汉化列表")
                return self.execute_translate(context, mode='cn')
            else:
                return self.execute_default(context)
        except Exception as e:
            self.report({'ERROR'}, f"错误: {str(e)}")
            return {'CANCELLED'}

    def execute_default(self, context):
        try:
            if os.path.exists(ls666):
                os.rename(lscn, lsbak)
                os.rename(ls666, lscn)
                if "bl_pkg" in sys.modules:
                    importlib.reload(sys.modules["bl_pkg"])
                    _reload_bl_pkg_and_redraw()
                _redraw_preferences()
                return {'FINISHED'}
            else:
                return self.execute_translate(context, mode='cn')
        except Exception as e:
            self.report({'ERROR'}, f"错误: {str(e)}")
            return {'CANCELLED'}

    def execute_translate(self, context, mode='cn'):
        try:
            log("<<<插件列表汉化任务开始>>>")
            if os.path.exists(ls666):
                os.remove(ls666)
            patterns = patterns_cnen if mode == 'cnen' else patterns_cn
            mode_name = "双语" if mode == 'cnen' else "单语"
            log(f"{mode_name}插件列表汉化, 数量: {len(patterns)}")
            with open(lscn, 'r', encoding='utf-8') as f:
                content = f.read()
            imok = False
            for i, (pattern, replacement) in enumerate(patterns, start=1):
                if re.search(pattern, content, re.MULTILINE):
                    log(f"成功匹配模式 {i}")
                    content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
                    imok = True
                else:
                    log(f"未匹配模式 {i}")
            if imok:
                shutil.copy2(lscn, lsbak)
                log("备份原文件完成")
                with open(lscn, 'w', encoding='utf-8') as f:
                    f.write(content)
                    log("写入任务完成")
                if "bl_pkg" in sys.modules:
                    importlib.reload(sys.modules["bl_pkg"])
                    _reload_bl_pkg_and_redraw()
                    log("模块重载入完成")
                mode_name = "中英双语" if mode == 'cnen' else "中文"
                self.report({'INFO'}, f"插件列表已翻译为{mode_name}!")
                _redraw_preferences()
                log("插件列表汉化任务完成")
                return {'FINISHED'}
            else:
                self.report({'INFO'}, "未找到需要修改的内容")
                log("未匹配到需要修改的内容,任务失败")
                return {'CANCELLED'}
        except Exception as e:
            self.report({'ERROR'}, f"翻译失败: {str(e)}")
            log("前期任务失败")
            return {'CANCELLED'}

    def execute(self, context):
        return self.execute_default(context)


class Re_list(bpy.types.Operator):
    bl_idname = "wm.r_all"
    bl_label = "插件列表恢复"

    def execute(self, context):
        try:
            os.rename(lscn, ls666)
            os.rename(lsbak, lscn)
            if "bl_pkg" in sys.modules:
                importlib.reload(sys.modules["bl_pkg"])
                _reload_bl_pkg_and_redraw()
            _redraw_preferences()
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"插件列表恢复失败: {str(e)}")
            return {'CANCELLED'}
