"""手动导入汉化包算子"""
import bpy, os, lzma, shutil
from bpy.types import Operator
from bpy_extras.io_utils import ImportHelper
from ..core.utils import log, re_bl, install_lang
from ..core.utils import write_log, read_log
from .. import mo_dir, lo9, tang


class Mo_m_in(Operator, ImportHelper):
    """选择你下载回来的XZ文件进行导入"""
    bl_idname = "mo.in_m"
    bl_label = "手动导入汉化包"
    bl_options = {'INTERNAL'}
    filename_ext = ".xz"

    filter_glob: bpy.props.StringProperty(default="*.xz", options={'HIDDEN'})

    def execute(self, context):
        try:
            xz_path = self.filepath
            if not xz_path.endswith('.xz'):
                self.report({'ERROR'}, "请选择有效的.xz文件")
                return {'CANCELLED'}
            filename = os.path.basename(xz_path)
            name_ext = filename[:-3]
            if not name_ext.isdigit() or len(name_ext) != 8:
                self.report({'ERROR'}, "文件名格式\n不正确\n，必须为\n8位数字")
                return {'CANCELLED'}
            ver_num = int(name_ext)
            os.makedirs(mo_dir, exist_ok=True)
            mo_p = os.path.join(mo_dir, 'blender.mo')
            try:
                with lzma.open(xz_path, 'rb') as f:
                    with open(mo_p, 'wb') as target:
                        shutil.copyfileobj(f, target)
            except Exception as e:
                self.report({'ERROR'}, f"解压失败: {str(e)}")
                return {'CANCELLED'}
            write_log(ver_num, lo9)
            if not os.path.exists(tang):
                install_lang()
            main_8, pack_7 = read_log(lo9)
            self.report({'INFO'}, f"本地汉化包导入成功! 版本: {ver_num}")
            bpy.app.timers.register(re_bl, first_interval=0.5)
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"导入失败: {str(e)}")
            return {'CANCELLED'}
