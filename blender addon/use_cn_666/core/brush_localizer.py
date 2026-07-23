"""雕刻笔刷资产本地化 — 图片合成中文名称"""
import bpy, os, sys, shutil, numpy as np, subprocess
from .utils import log


def pil_work(image, text, font, fs=60, fc=(255, 255, 255, 255),
             bg=(50, 50, 50, 150), oc=(10, 10, 10, 255), ow=2):
    """在笔刷预览图上叠加中文名称"""
    from PIL import Image, ImageDraw, ImageFont
    w, h = image.size
    r = w / 255
    f = ImageFont.truetype(font, int(fs * r))
    bg_img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(bg_img, "RGBA").rectangle(((0, h * 2 / 3), (w, h)), fill=bg)
    image.paste(Image.alpha_composite(image, bg_img))
    d = ImageDraw.Draw(image)
    fw = d.textlength(text, font=f)
    d.multiline_text((w / 2 - fw / 2, h * 2 / 3), text, font=f,
                     fill=fc, stroke_width=int(ow * r), stroke_fill=oc)
    return image


class BrushProcessor:
    """处理笔刷资产文件中的预览图和名称翻译"""

    def __init__(self):
        try:
            from .. import zh_CN
            self.zh_HANS = zh_CN.BRUSH_DICT.copy()
        except ImportError:
            self.zh_HANS = {}
            print("未找到字典,请确认zh_CN.py文件是否存在")

    @staticmethod
    def clear_work():
        """清理笔刷备份和缓存"""
        from .. import ASSET_CONFIGS
        try:
            path = (
                (sys.platform == "win32" and os.path.join(
                    os.environ.get('LOCALAPPDATA', ''), 'Blender Foundation',
                    'Blender', 'Cache'))
                or (sys.platform == "darwin" and os.path.join(
                    os.path.expanduser("~"), 'Library', 'Caches', 'Blender'))
                or (sys.platform.startswith("linux") and os.path.join(
                    os.environ.get('XDG_CACHE_HOME',
                                   os.path.join(os.path.expanduser("~"), '.cache')),
                    'blender'))
            )
            if path and os.path.exists(path):
                shutil.rmtree(path)
        except Exception as e:
            log(f"清理笔刷缓存失败: {e}")
        for config in ASSET_CONFIGS:
            dir_path = config['dir']
            if os.path.exists(dir_path):
                backups = [os.path.join(dir_path, f)
                           for f in os.listdir(dir_path) if f.endswith('.bak')]
                if backups:
                    blend_files = [os.path.join(dir_path, f)
                                   for f in os.listdir(dir_path) if f.endswith('.blend')]
                    for f in blend_files:
                        if os.path.exists(f):
                            os.remove(f)
                    for b in backups:
                        os.rename(b, b[:-4])

    def _clean_scene(self, context=None):
        """清理场景中的临时数据"""
        win = context.window if (context and context.window) else bpy.context.window
        if win is None:
            return
        for ws_name in ["脚本", "Scripting"]:
            if ws_name in bpy.data.workspaces:
                win.workspace = bpy.data.workspaces[ws_name]
                break
        scene_types = ['objects', 'collections', 'meshes', 'curves', 'cameras',
                       'lights', 'materials', 'images', 'worlds', 'brushes',
                       'node_groups']
        for scene_type in scene_types:
            if hasattr(bpy.data, scene_type):
                collection = getattr(bpy.data, scene_type)
                for item in list(collection):
                    try:
                        collection.remove(item)
                    except Exception as e:
                        log(f"清理场景元素失败: {e}")

    def process_assets(self, font, context=None):
        """处理资产汉化：加载 blend → 翻译笔刷预览图 → 保存"""
        from .. import ASSET_CONFIGS, pywork
        try:
            from PIL import Image
        except ImportError:
            subprocess.run([pywork, "-m", "pip", "install", "pillow==11.0.0"])
            from PIL import Image

        for config in ASSET_CONFIGS:
            if not os.path.exists(config['dir']):
                continue
            blend_files = [os.path.join(config['dir'], f)
                           for f in os.listdir(config['dir'])
                           if f.endswith(config['pattern'])]
            for blend_file in blend_files:
                with bpy.data.libraries.load(blend_file) as (data_from, data_to):
                    setattr(data_to, config['data_type'],
                            getattr(data_from, config['data_type']))
                asset_collection = getattr(bpy.data, config['collection'])
                for asset in list(asset_collection):
                    if asset.asset_data is None:
                        asset_collection.remove(asset)
                        continue
                    asset_name_en = asset.name.strip()
                    asset_name_cn = self.zh_HANS.get(asset_name_en, '')
                    if asset_name_cn:
                        pic_width, pic_height = asset.preview.image_size
                        pixels = np.array(asset.preview.image_pixels_float)
                        pixels_uint8 = (pixels * 255).astype(np.uint8)
                        pixels_uint8_size = pixels_uint8.reshape(pic_height, pic_width, 4)
                        pixels_uint8_size = np.flipud(pixels_uint8_size)
                        preview_pic = Image.fromarray(pixels_uint8_size, "RGBA")
                        composite_pic = pil_work(preview_pic, asset_name_cn, font=font)
                        image_arr = np.array(composite_pic, dtype=np.uint8)
                        arr = np.flipud(image_arr)
                        arr = arr.astype(np.float32) / 255.0
                        flat = arr.ravel()
                        asset.preview.image_pixels_float = flat
                    try:
                        if asset.asset_data.description:
                            des_en = asset.asset_data.description.strip()
                            des_cn = self.zh_HANS.get(des_en, '')
                            if des_cn:
                                asset.asset_data.description = des_cn
                            elif asset_name_cn:
                                asset.asset_data.description = asset_name_cn
                    except AttributeError:
                        pass
                for library in bpy.data.libraries:
                    bpy.data.libraries.remove(library)
                os.rename(blend_file, blend_file + ".bak")
                if context and context.window and context.window.screen:
                    with context.temp_override(window=context.window,
                                                screen=context.window.screen):
                        bpy.ops.wm.save_as_mainfile(filepath=blend_file)
                else:
                    bpy.ops.wm.save_as_mainfile(filepath=blend_file)
                for asset in asset_collection:
                    asset_collection.remove(asset)
                self._clean_scene(context=context)
