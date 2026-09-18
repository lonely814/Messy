import bpy

###################
## POPOVER CLASS ##
###################


def override_row(parent, scene, toggle, label, value_prop):
    """Checkbox for an override, then its always-visible label and value.

    The label stays put and only the value grays out when the override is off,
    so the panel keeps reading as a list of settings.

    Module-level on purpose: a @staticmethod on a bpy.types subclass is not
    preserved, and would be bound as a method when called from draw().
    """
    row = parent.row(align=True)
    row.prop(scene, toggle, text="")
    sub = row.row(align=True)
    sub.enabled = getattr(scene, toggle)
    sub.label(text=label)
    sub.prop(scene, value_prop, text="")


class PL_PT_popover(bpy.types.Panel):
    """Playblast Popover Panel"""
    bl_label = "快照选项"
    bl_idname = "PLAYBLAST_PULS_PT_popover"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'WINDOW'

    def draw(self, context):
        layout = self.layout
        scene = context.scene

        # --- Render and playback ------------------------------------------
        col = layout.column(align=True)
        col.scale_y = 1.4
        col.operator("playblast_puls.playblast", icon='FILE_MOVIE')

        col = layout.column(align=True)
        row = col.row(align=True)
        row.operator("playblast_puls.player", icon='PLAY')
        row.operator("playblast_puls.open_filebrowser",
                     icon='FILEBROWSER', text="打开文件夹")

        row = layout.row(align=True)
        row.prop(scene, "enable_overrides", icon='FILE_CACHE')
        row.operator("playblast_puls.open_preferences", icon='PREFERENCES')

        # Tell the user which range will actually be rendered
        if scene.use_preview_range:
            row = layout.row(align=True)
            row.label(
                text=f"渲染预览范围 {scene.frame_preview_start}-{scene.frame_preview_end}",
                icon='PREVIEW_RANGE')

        if not scene.enable_overrides:
            layout.operator("playblast_puls.turnaround_camera", icon='CON_CAMERASOLVER')
            return

        # --- Per-scene overrides ------------------------------------------
        box = layout.box()
        box.label(text="输出", icon='FILE_FOLDER')
        override_row(box, scene, "enable_filename", "文件名",
                          "custom_playblast_name")
        override_row(box, scene, "enable_folder", "输出文件夹",
                          "custom_folder")

        # Version needs its extra stepper buttons, so it draws inline
        row = box.row(align=True)
        row.prop(scene, "enable_version", text="")
        sub = row.row(align=True)
        sub.enabled = scene.enable_version
        sub.label(text="版本")
        sub.label(text=f"v{scene.version_number:0>3}")
        sub.operator("playblast_puls.recover_version", icon='RECOVER_LAST', text="")
        sub.operator("playblast_puls.decrease_version", icon='REMOVE', text="")
        sub.operator("playblast_puls.increase_version", icon='ADD', text="")

        box = layout.box()
        box.label(text="画面", icon='IMAGE_DATA')
        row = box.row(align=True)
        row.prop(scene, "enable_resolution", text="")
        sub = row.row(align=True)
        sub.enabled = scene.enable_resolution
        sub.label(text="分辨率")
        sub.prop(scene, "override_resize_method", text="")
        if scene.override_resize_method == 'PERCENTAGE':
            sub.prop(scene, "override_resolution_percentage", text="")
        elif scene.override_resize_method == 'MAX_HEIGHT':
            sub.prop(scene, "override_resolution_max_height", text="px")

        override_row(box, scene, "enable_overlays", "覆盖层",
                          "hide_overlays")
        box.prop(scene, "enable_color_mgmt", text="标准颜色管理", icon='COLOR')

        box = layout.box()
        box.label(text="行为", icon='AUTO')
        box.prop(scene, "enable_markers", text="按标记切分", icon='MARKER_HLT')
        box.prop(scene, "enable_auto_version", text="自动增加版本", icon='AUTO')

        layout.separator()
        layout.operator("playblast_puls.turnaround_camera", icon='CON_CAMERASOLVER')


# Main Menu popover
def popover_mainmenu(self, context):
    prefs = context.preferences.addons[__package__].preferences
    if prefs.pb_enable_3dview_menu:
        if context.area.show_menus:
            self.layout.popover("PLAYBLAST_PULS_PT_popover",
                                text="", icon='FILE_MOVIE')
            # progress bar for future updates
            # self.layout.progress(text='', text_ctxt='', translate=True, factor=0.5, type='RING')
        else:
            self.layout.popover("PLAYBLAST_PULS_PT_popover", icon='FILE_MOVIE')



# Context menu popover
def popover_contextmenu(self, context):
    prefs = context.preferences.addons[__package__].preferences
    if prefs.pb_enable_context_menu:
        layout = self.layout
        layout.popover("PLAYBLAST_PULS_PT_popover", icon='FILE_MOVIE')
        layout.separator()


####################################
# REGISTER/UNREGISTER
####################################
def register():
    bpy.utils.register_class(PL_PT_popover)
    bpy.types.VIEW3D_MT_editor_menus.append(popover_mainmenu)
    bpy.types.VIEW3D_MT_object_context_menu.prepend(popover_contextmenu)

    bpy.types.Scene.enable_overrides = bpy.props.BoolProperty(
        name="快速设置",
        description="启用对预设的超级设置",
        default=False,
    )
    bpy.types.Scene.enable_resolution = bpy.props.BoolProperty(
        name="分辨率比例",
        description="启用分辨率比例覆盖",
        default=False,
    )
    bpy.types.Scene.override_resize_method = bpy.props.EnumProperty(
        name="缩放方法",
        description="Method for resize the current file resolution",
        items=[
            ('PERCENTAGE', 'Percentage',
             'Scale resolution based on Percentage multiplier'),
            ('MAX_HEIGHT', 'Max height',
             'Scale resolution based on Max Height (Y Resolution)'),
            ('NONE', 'Keep project resolution', "不缩放分辨率，保持项目设置")],
        default='PERCENTAGE',
    )
    bpy.types.Scene.override_resolution_percentage = bpy.props.IntProperty(
        name="分辨率百分比",
        description="H.264/H.265 编码要求宽和高都是偶数",
        default=50,
        min=0, soft_min=10, soft_max=100, max=200,
        subtype='PERCENTAGE',
    )
    bpy.types.Scene.override_resolution_max_height = bpy.props.IntProperty(
        name="分辨率 Y（最大高度）像素值",
        description="分辨率 Y 的最大像素值，X 会自动调整",
        min=128, max=4096,
        default=540,
    )
    bpy.types.Scene.enable_overlays = bpy.props.BoolProperty(
        name="覆盖层",
        description="启用覆盖层覆盖",
        default=False,
    )
    bpy.types.Scene.hide_overlays = bpy.props.EnumProperty(
        name="覆盖层",
        description="隐藏覆盖层",
        items=[
            ('ALL', 'Hide all overlays', ''),
            ('BONES', 'Hide only bones', ''),
            ('ALL_EXCEPT_BACKGROUND_IMAGES',
             'Hide all, except camera background images', ''),
            ('NONE', "不覆盖场景设置", '')],
        default="ALL",
    )
    bpy.types.Scene.enable_folder = bpy.props.BoolProperty(
        name="输出文件夹",
        description="启用自定义输出文件夹",
        default=False,
    )
    bpy.types.Scene.custom_folder = bpy.props.StringProperty(
        name="自定义文件夹",
        description="快照文件的输出路径",
        default="//",
        subtype='FILE_PATH',
    )
    bpy.types.Scene.enable_filename = bpy.props.BoolProperty(
        name="文件名",
        description="启用自定义快照文件名",
        default=False,
    )
    bpy.types.Scene.custom_playblast_name = bpy.props.StringProperty(
        name="自定义文件名",
        description="覆盖偏好设置中的文件名",
        default="",
    )
    bpy.types.Scene.enable_version = bpy.props.BoolProperty(
        name="启用版本",
        description="启用自定义版本",
        default=False,
    )
    bpy.types.Scene.version_number = bpy.props.IntProperty(
        name="自定义版本",
        description="快照文件的版本号",
        default=1,
        min=0
    )
    
    # New properties for enhanced features
    bpy.types.Scene.enable_markers = bpy.props.BoolProperty(
        name="按标记切分",
        description="按时间轴标记切分为多个视频",
        default=False,
    )
    bpy.types.Scene.enable_auto_version = bpy.props.BoolProperty(
        name="自动增加版本",
        description="渲染成功后自动增加版本号",
        default=False,
    )
    bpy.types.Scene.enable_color_mgmt = bpy.props.BoolProperty(
        name="标准颜色管理",
        description="覆盖颜色管理为 Standard 视图变换",
        default=False,
    )


def unregister():
    bpy.utils.unregister_class(PL_PT_popover)
    bpy.types.VIEW3D_MT_editor_menus.remove(popover_mainmenu)
    bpy.types.VIEW3D_MT_object_context_menu.remove(popover_contextmenu)

    for prop in (
        'enable_overrides',
        'enable_resolution',
        'override_resize_method',
        'override_resolution_percentage',
        'override_resolution_max_height',
        'enable_overlays',
        'hide_overlays',
        'enable_folder',
        'custom_folder',
        'enable_filename',
        'custom_playblast_name',
        'enable_version',
        'version_number',
        'enable_markers',
        'enable_auto_version',
        'enable_color_mgmt',
    ):
        try:
            delattr(bpy.types.Scene, prop)
        except AttributeError:
            pass