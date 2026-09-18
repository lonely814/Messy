import bpy
import os

##############################################
#    USER PREFERENCES
##############################################

# Nicer labels for the codecs Blender can report. Anything not listed here is
# shown by its identifier, so a Blender build with extra codecs still works.
CODEC_LABELS = {
    'NONE': "不指定（由封装决定）",
    'H264': "H264",
    'H265': "H265 / HEVC",
    'AV1': "AV1",
    'WEBM': "VP8 / VP9 (WebM)",
    'MPEG4': "MPEG-4",
    'MPEG2': "MPEG-2",
    'MPEG1': "MPEG-1",
    'PRORES': "ProRes",
    'DNXHD': "DNxHD",
    'QTRLE': "QT RLE / Animation",
    'FFV1': "FFV1（无损）",
    'HUFFYUV': "HuffYUV（无损）",
    'THEORA': "Theora",
    'DV': "DV",
    'FLASH': "Flash",
    'PNG': "PNG（无损）",
}

# Used only when the codec list cannot be read from Blender at all.
FALLBACK_CODECS = (
    ('H264', "H264", ''),
    ('H265', "H265 / HEVC", ''),
)


def get_codec_items(self=None, context=None):
    """Video codecs offered by the Blender build in use.

    Read from Blender's own RNA rather than a hard-coded list, so the addon
    follows whatever this Blender can encode. Note this is a property of the
    Blender build, not of the operating system: Blender links its own FFmpeg,
    so installing codecs in Windows does not add them here.

    H264 is placed first so the property's numeric default lands on it. NONE is
    dropped: a playblast always wants a video codec, and leaving the choice to
    the container only produces confusing output.
    """
    ctx = context or bpy.context
    try:
        codec_prop = ctx.scene.render.ffmpeg.bl_rna.properties['codec']
        names = [item.identifier for item in codec_prop.enum_items]
    except Exception:
        return list(FALLBACK_CODECS)

    names = [n for n in names if n != 'NONE']
    if not names:
        return list(FALLBACK_CODECS)

    preferred = ['H264', 'H265']
    ordered = [n for n in preferred if n in names]
    ordered += sorted(n for n in names if n not in preferred)
    return [(name, CODEC_LABELS.get(name, name), '') for name in ordered]

def get_format_items():
    """Container formats.

    AVI_JPEG and AVI_RAW were dropped from image_settings.file_format in
    Blender 5.0, and the 5.x render path drives FFmpeg through media_type
    instead, so those options are only meaningful on older versions.
    """
    if bpy.app.version >= (5, 0, 0):
        return [('FFMPEG', 'FFmpeg Video', '')]
    return [
        ('AVI_JPEG', 'AVI JPEG', ''),
        ('AVI_RAW', 'AVI RAW', ''),
        ('FFMPEG', 'FFmpeg Video', '')]


def get_container_items():
    return [
        ('MPEG4', 'MPEG-4', ''),
        ('AVI', 'AVI', ''),
        ('QUICKTIME', 'Quicktime', ''),
        ('MKV', 'Matroska', ''),
        ('WEBM', 'WebM', ''),
        ('MPEG2', 'MPEG-2', ''),
        ('OGG', 'Ogg', '')]


# Metadata fields a playblast can print over the image, as (suffix, label, tip).
# The suffix maps to render.use_stamp_<suffix>, so both sides stay in step.
# Only the frame number defaults to on: Blender turns most of these on, which
# buries the image under a block of text.
STAMP_FIELDS = (
    ('frame', "帧号", "当前帧"),
    ('frame_range', "帧范围", "场景或预览范围"),
    ('camera', "相机", "相机名称"),
    ('scene', "场景", "场景名称"),
    ('filename', "文件名", "blend 文件名"),
    ('note', "备注", "自定义文字"),
)


class PB_Prefs(bpy.types.AddonPreferences):
    bl_idname = __package__

    # Define properties
    pb_output_options: bpy.props.EnumProperty(
        name="输出路径文件夹",
        description="选择你偏好的输出文件夹",
        items=[
            ('PROYECT_FOLDER', 'Project folder', ''),
            ('SYSTEM_FOLDER', 'System folder', ''),
            ('PROYECT_RENDER_SETTINGS', "不覆盖文件输出设置", '')],
        default="PROYECT_FOLDER",
    )
    pb_system_folder: bpy.props.StringProperty(
        name="系统文件夹",
        description="系统输出路径",
        default="//",
        subtype='FILE_PATH',
    )
    pb_subfolder: bpy.props.BoolProperty(
        name="子文件夹",
        description="用户自定义的子文件夹",
        default=True,
    )
    pb_subfolder_name: bpy.props.StringProperty(
        name="子文件夹名称",
        description="设置子文件夹名称",
        default="Playblast",
    )
    pb_playblast_name: bpy.props.EnumProperty(
        name="快照文件名",
        description="设置生成视频的文件名",
        items=[
            ('FILENAME', 'Same as filename', ''),
            ('SCENE_NAME', 'Scene name', ''),
            ('CUSTOM_NAME', 'Custom name', '')],
        default="FILENAME",
    )
    pb_custom_name: bpy.props.StringProperty(
        name="自定义名称",
        description="自定义视频文件名",
        default="Playblast",
    )
    pb_use_action_name: bpy.props.BoolProperty(
        name="追加动作名称",
        description="在文件名尾部追加活跃动作名称",
        default=False,
    )
    pb_use_scene_name: bpy.props.BoolProperty(
        name="追加场景名称",
        description="在文件名尾部追加场景名称",
        default=False,
    )
    pb_separator: bpy.props.EnumProperty(
        name="分隔符",
        description="设置自定义分隔符",
        items=[
            ('UNDERSCORE', '_ (下划线)', ''),
            ('DASH', '- (破折号)', ''),
            ('DOT', '. (点)', ''),
            ('SPACE', ' (空格)', '')],
        default='DASH',
    )
    pb_framerange: bpy.props.BoolProperty(
        name="帧范围",
        description="在文件名中包含帧范围",
        default=False,
    )
    pb_use_markers: bpy.props.BoolProperty(
        name="Split by Markers",
        description="按时间轴标记切分为多个视频",
        default=False,
    )
    pb_auto_increment_version: bpy.props.BoolProperty(
        name="自动增加版本",
        description="渲染成功后自动增加版本号",
        default=False,
    )
    pb_format: bpy.props.EnumProperty(
        name="文件格式",
        description="保存快照的文件格式",
        items=get_format_items(),
        default="FFMPEG",
    )
    pb_container: bpy.props.EnumProperty(
        name="封装格式",
        description="快照文件封装格式",
        items=get_container_items(),
        default="MPEG4",
    )

    pb_video_codec: bpy.props.EnumProperty(
        name="视频编码",
        description="视频编码器（列出当前 Blender 支持的编码）",
        items=get_codec_items,
        # items is a callback here, so the default has to be an index.
        # get_codec_items puts H264 first, which this selects.
        default=0,
    )
    pb_gop: bpy.props.IntProperty(
        name="关键帧间隔",
        description="关键帧间隔（GOP），影响文件大小和寻找性能",
        default=18,
    )
    pb_resize_method: bpy.props.EnumProperty(
        name="缩放方法",
        description="缩放当前文件分辨率的方法",
        items=[
            ('PERCENTAGE', 'Resolution Percentage', ''),
            ('MAX_HEIGHT', 'Resolution Y (Max height)', ''),
            ('NONE', 'Keep project resolution', '')],
        default='PERCENTAGE',
    )
    pb_resize_percentage: bpy.props.IntProperty(
        name="分辨率百分比",
        description="编码器要求宽和高都是偶数",
        default=50,
        min=0, soft_min=10, soft_max=100, max=200,
        subtype='PERCENTAGE',
    )
    pb_resize_max_height: bpy.props.IntProperty(
        name="Resolution Y (Max height) in pixels",
        description="分辨率 Y 的最大像素值，X 自动调整",
        min=128, max=4096,
        default=540,
    )
    pb_stamp: bpy.props.BoolProperty(
        name="打印元数据",
        description="在渲染视频中显示元数据文字",
        default=False,
    )
    pb_stamp_font_size: bpy.props.IntProperty(
        name="元数据字体大小",
        description="元数据文字的字体大小",
        default=12,
    )
    pb_stamp_frame: bpy.props.BoolProperty(
        name="帧号", description="当前帧", default=True,
    )
    pb_stamp_frame_range: bpy.props.BoolProperty(
        name="帧范围", description="场景或预览范围", default=False,
    )
    pb_stamp_camera: bpy.props.BoolProperty(
        name="相机", description="相机名称", default=False,
    )
    pb_stamp_scene: bpy.props.BoolProperty(
        name="场景", description="场景名称", default=False,
    )
    pb_stamp_filename: bpy.props.BoolProperty(
        name="文件名", description="blend 文件名", default=False,
    )
    pb_stamp_note: bpy.props.BoolProperty(
        name="备注", description="自定义文字", default=False,
    )
    pb_overlays: bpy.props.EnumProperty(
        name="Overlays",
        description="Hide overlays",
        items=[
            ('ALL', 'Hide all overlays', ''),
            ('BONES', 'Hide only bones', ''),
            ('ALL_EXCEPT_BACKGROUND_IMAGES', 'Hide all, except camera background images', ''),
            ('NONE', "不覆盖场景设置", '')],
        default="ALL",
    )
    pb_color_management: bpy.props.BoolProperty(
        name="覆盖颜色管理",
        description="强制使用 Standard 视图变换",
        default=False,
    )
    pb_show_environment: bpy.props.BoolProperty(
        name="显示环境",
        description="关闭透明胶片渲染设置",
        default=True,
    )
    pb_autoplay: bpy.props.BoolProperty(
        name="自动播放",
        description="渲染完成后自动播放视频",
        default=True,
    )
    # Context Menu options
    pb_enable_context_menu: bpy.props.BoolProperty(
        name="右键菜单显示",
        description="在右键（或 W）对象菜单显示快照按钮",
        default=False,
    )
    # Main Menu Popover
    pb_enable_3dview_menu: bpy.props.BoolProperty(
        name="主菜单显示",
        description="在 3D 视图主菜单显示快照按钮",
        default=True,
    )

    ##############################################
    #    DRAW FUNCTION
    ##############################################

    def draw(self, context):

        layout = self.layout
        layout.use_property_split = True

        prefs = context.preferences.addons[__package__].preferences

        ###### OUTPUT #########################################################
        box = layout.box()
        box.label(text="输出", icon="FILE_FOLDER")

        col = box.column(align=True)
        col.prop(self, "pb_output_options", text="输出文件夹")
        # Only meaningful for a fixed system folder
        if prefs.pb_output_options == 'SYSTEM_FOLDER':
            col.prop(self, "pb_system_folder")

        # The subfolder name only applies when the subfolder is in use, so it
        # grays out rather than disappearing and the row height stays stable
        row = col.row(align=True)
        row.prop(self, "pb_subfolder", text="")
        sub = row.row(align=True)
        sub.enabled = prefs.pb_subfolder
        sub.label(text="子文件夹")
        sub.prop(self, "pb_subfolder_name", text="")

        ###### FILENAME #######################################################
        box = layout.box()
        box.label(text="文件名", icon='FILE_TEXT')

        col = box.column(align=True)
        col.prop(self, "pb_playblast_name", text="命名方式")
        if prefs.pb_playblast_name == 'CUSTOM_NAME':
            col.prop(self, "pb_custom_name")

        box.prop(self, "pb_use_scene_name")
        box.prop(self, "pb_use_action_name")
        box.prop(self, "pb_separator", text="分隔符")
        box.prop(self, "pb_framerange", text="在文件名中包含帧范围")

        ###### VIDEO ##########################################################
        box = layout.box()
        box.label(text="视频设置", icon="FILE_MOVIE")

        col = box.column(align=True)
        col.prop(self, "pb_format")
        # Container, codec and GOP only apply to FFmpeg output
        if prefs.pb_format == 'FFMPEG':
            col.prop(self, "pb_container")
            col.prop(self, "pb_video_codec")
            col.prop(self, "pb_gop")

        col.prop(self, "pb_resize_method")
        if prefs.pb_resize_method == 'PERCENTAGE':
            col.prop(self, "pb_resize_percentage")
        elif prefs.pb_resize_method == 'MAX_HEIGHT':
            col.prop(self, "pb_resize_max_height")

        ###### IMAGE ##########################################################
        box = layout.box()
        box.label(text="画面", icon='IMAGE_DATA')

        box.prop(self, "pb_show_environment")
        box.prop(self, "pb_overlays")
        box.prop(self, "pb_color_management", text="强制 Standard 颜色管理")

        # Stamp settings sit in their own indented box so the fields clearly
        # belong to the toggle above them
        box.prop(self, "pb_stamp")
        if prefs.pb_stamp:
            sub = box.box()
            sub.prop(self, "pb_stamp_font_size")
            fields = sub.grid_flow(row_major=True, columns=2,
                                   even_columns=True, align=True)
            for suffix, label, tip in STAMP_FIELDS:
                fields.prop(self, "pb_stamp_" + suffix, text=label)

        ###### BEHAVIOR AND UI ################################################
        row = layout.row(align=True)

        box = row.box()
        box.label(text="行为", icon='AUTO')
        col = box.column()
        col.prop(self, "pb_use_markers", text="按标记切分导出")
        col.prop(self, "pb_auto_increment_version", text="渲染后自动增加版本")
        col.prop(self, "pb_autoplay")

        box = row.box()
        box.label(text="用户界面", icon='MOD_BUILD')
        col = box.column()
        col.prop(self, "pb_enable_3dview_menu", text="主菜单显示")
        col.prop(self, "pb_enable_context_menu", text="右键菜单显示")


####################################
# REGISTER/UNREGISTER
####################################
def register():
    bpy.utils.register_class(PB_Prefs)

def unregister():
    bpy.utils.unregister_class(PB_Prefs)