bl_info = {
    'name': 'Camera PLUS',
    "author": "Max Derksen",
    'version': (1, 0, 1),
    'blender': (4, 5, 0),
    'location': 'VIEW 3D > Tools',
    #"warning": "This is a test version of the addon. Write in the discord channel(link below) about the errors.",
    "support": "COMMUNITY",
    'category': 'Object',
}

from . import CAMERA_gizmo_group_button
from . import CAMERA_transform_operators
from . import CAMERA_tool
from . import CAMERA_gizmo_group_tool
from . import CAMERA_active_tool
from . import CAMERA_cursor_gizmo



import bpy, sys, os, importlib  
from bpy.types import AddonPreferences

def visible_button(self, context):
    props = context.preferences.addons[__package__.split(".")[0]].preferences
    layout = self.layout
    layout.prop(props,'gizmo_visible',text='Show Button Camera Control')


class GIZMO_preferences(AddonPreferences):
    bl_idname = __package__
    def track_to(self, context):
        if self.target_visible == True:
            bpy.ops.rotate.track_to('INVOKE_DEFAULT')
        return {'FINISHED'}
    tabs : bpy.props.EnumProperty(name="Tabs", items = [("GENERAL", "General", ""), ("KEYMAPS", "Keymaps", ""),], default="GENERAL")

    #theme = bpy.context.preferences.themes[0] 
    
    gizmo_visible: bpy.props.BoolProperty(name="Gizmo Visible", default=True)
    target_visible: bpy.props.BoolProperty(name="Target Visible", default=False, update=track_to)
    show_gizmo: bpy.props.BoolProperty(name="Visible Gizmo Cursor", default=False)
    show_with_scene_camera: bpy.props.BoolProperty(
        name="Show When Camera Exists",
        default=False,
        description="Show controls when any camera exists in the scene, instead of requiring selection")

    # Panel customization
    button_scale: bpy.props.FloatProperty(
        name="Button Scale", default=1.0, min=0.3, max=3.0,
        description="Overall size of camera control buttons")
    button_y: bpy.props.IntProperty(
        name="Button Y Offset", default=50, min=5, max=500,
        description="Vertical position of button panel from bottom edge")
    button_spacing: bpy.props.IntProperty(
        name="Button Spacing", default=40, min=10, max=300,
        description="Horizontal spacing between buttons")
    panel_offset_x: bpy.props.IntProperty(
        name="Panel X Offset", default=0, min=-500, max=500,
        description="Horizontal drag offset for repositioning the button panel")

    # Panel customization
    button_scale: bpy.props.FloatProperty(
        name="Button Scale", default=1.0, min=0.3, max=3.0,
        description="Overall size of control buttons")
    button_y: bpy.props.IntProperty(
        name="Vertical Position", default=50, min=10, max=500,
        description="Y position from bottom of viewport (pixels)")
    button_spacing: bpy.props.IntProperty(
        name="Button Spacing", default=40, min=10, max=300,
        description="Horizontal spacing between buttons (pixels)")
    panel_offset_x: bpy.props.IntProperty(
        name="Panel X Offset", default=0, min=-500, max=500,
        description="Horizontal offset for the entire panel")
    panel_offset_y: bpy.props.IntProperty(
        name="Panel Y Offset", default=0, min=-500, max=500,
        description="Vertical offset for the entire panel")

    
    def draw(self, context):
        layout = self.layout
        layout = self.layout

      
        #row = layout.row()
        #row.prop(self, "tabs", expand=True)

        box = layout.box()

        #if self.tabs == "GENERAL":
        self.draw_pivot_general(box)


        """ elif self.tabs == "KEYMAPS":
            self.draw_pivot_keymaps(context, box) """

    def draw_pivot_general(self, layout):
        # --- Panel customization ---
        box = layout.box()
        box.label(text="Panel Customization", icon='TOOL_SETTINGS')
        flow = box.grid_flow(row_major=True, even_columns=True, even_rows=True, align=True)
        flow.prop(self, "button_scale")
        flow.prop(self, "button_y")
        flow.prop(self, "button_spacing")
        flow.prop(self, "panel_offset_x")
        flow.prop(self, "panel_offset_y")
        flow.prop(self, "show_with_scene_camera")
        layout.separator()

        pcoll = preview_collections["main"]
        market_icon = pcoll["market_icon"]
        gumroad_icon = pcoll["gumroad_icon"]
        artstation_icon = pcoll["artstation_icon"]
        discord_icon = pcoll["discord_icon"]
        #props = bpy.context.scene.props_auto_save

    
        #layout.separator(factor=0.1)
        #layout.label(text="After changing the time settings, restart the AutoSave", icon='ERROR')
        #layout.prop(self, "time", text="Interval (minutes)")


        col = layout.column()
        col.label(text="Links")
        col = layout.column(align=True)
        row = col.row(align=True)
        row.operator("wm.url_open", text="Blender Market", icon_value=market_icon.icon_id).url = "https://blendermarket.com/creators/derksen"
        row.operator("wm.url_open", text="Gumroad", icon_value=gumroad_icon.icon_id).url = "https://gumroad.com/derksenyan"
        row.operator("wm.url_open", text="Artstation", icon_value=artstation_icon.icon_id).url = "https://www.artstation.com/derksen"
        col = layout.column(align=True)
        row = col.row(align=True)
        row.operator("wm.url_open", text="Discord Channel", icon_value=discord_icon.icon_id).url = "https://discord.gg/SBEDbmK"


    def draw_pivot_keymaps(self, context, layout):
        col = layout.column()
        col.label(text="Keymap")
        #col = layout.column()
        
        #keymap = context.window_manager.keyconfigs.user.keymaps['Window']
        #keymap_items = keymap.keymap_items

        #col.prop(keymap_items['auto.auto_save'], 'type', text='Save New Version', full_event=True)
        
        col.label(text="Some hotkeys may not work because of the use of other addons", icon='ERROR')





preview_collections = {}
classes = [
    GIZMO_preferences,
]


 
def register():
    for cls in classes:
        bpy.utils.register_class(cls)


    
    pcoll = bpy.utils.previews.new()
    my_icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    pcoll.load("market_icon", os.path.join(my_icons_dir, "market.png"), 'IMAGE')
    pcoll.load("gumroad_icon", os.path.join(my_icons_dir, "gumroad.png"), 'IMAGE')
    pcoll.load("artstation_icon", os.path.join(my_icons_dir, "artstation.png"), 'IMAGE')
    pcoll.load("discord_icon", os.path.join(my_icons_dir, "discord.png"), 'IMAGE')
    preview_collections["main"] = pcoll

    bpy.types.VIEW3D_PT_overlay.append(visible_button)

    CAMERA_gizmo_group_button.register()
    CAMERA_transform_operators.register()
    CAMERA_tool.register()
    CAMERA_gizmo_group_tool.register()
    CAMERA_active_tool.register()
    CAMERA_cursor_gizmo.register()


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)

    bpy.types.VIEW3D_PT_overlay.remove(visible_button)

    CAMERA_gizmo_group_button.unregister()
    CAMERA_transform_operators.unregister()
    CAMERA_tool.unregister()
    CAMERA_gizmo_group_tool.unregister()
    CAMERA_active_tool.unregister()
    CAMERA_cursor_gizmo.unregister()