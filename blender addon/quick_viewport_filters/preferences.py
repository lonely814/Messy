import bpy


FILTER_TYPES = (
    ("mesh", "Mesh", "MESH_DATA"),
    ("curve", "Curve", "CURVE_DATA"),
    ("light", "Light", "LIGHT_DATA"),
    ("empty", "Empty", "EMPTY_DATA"),
    ("camera", "Camera", "CAMERA_DATA"),
    ("armature", "Armature", "ARMATURE_DATA"),
    ("font", "Font", "FONT_DATA"),
    ("grease_pencil", "Grease Pencil", "GREASEPENCIL"),
    ("volume", "Volume", "VOLUME_DATA"),
    ("lattice", "Lattice", "LATTICE_DATA"),
    ("metaball", "Metaball", "META_DATA"),
    ("light_probe", "Light Probe", "LIGHTPROBE_PLANAR"),
)


class QUICK_VIEWPORT_FILTERS_PG_settings(bpy.types.PropertyGroup):
    show_mesh: bpy.props.BoolProperty(name="Mesh", default=True)
    show_curve: bpy.props.BoolProperty(name="Curve", default=True)
    show_light: bpy.props.BoolProperty(name="Light", default=True)
    show_empty: bpy.props.BoolProperty(name="Empty", default=True)
    show_camera: bpy.props.BoolProperty(name="Camera", default=True)
    show_armature: bpy.props.BoolProperty(name="Armature", default=False)
    show_font: bpy.props.BoolProperty(name="Font", default=False)
    show_grease_pencil: bpy.props.BoolProperty(name="Grease Pencil", default=False)
    show_volume: bpy.props.BoolProperty(name="Volume", default=False)
    show_lattice: bpy.props.BoolProperty(name="Lattice", default=False)
    show_metaball: bpy.props.BoolProperty(name="Metaball", default=False)
    show_light_probe: bpy.props.BoolProperty(name="Light Probe", default=False)

    solo_target: bpy.props.StringProperty(name="Solo Target", default="")
    snapshot_mesh: bpy.props.BoolProperty(name="Snapshot Mesh", default=True)
    snapshot_curve: bpy.props.BoolProperty(name="Snapshot Curve", default=True)
    snapshot_light: bpy.props.BoolProperty(name="Snapshot Light", default=True)
    snapshot_empty: bpy.props.BoolProperty(name="Snapshot Empty", default=True)
    snapshot_camera: bpy.props.BoolProperty(name="Snapshot Camera", default=True)
    snapshot_armature: bpy.props.BoolProperty(name="Snapshot Armature", default=True)
    snapshot_font: bpy.props.BoolProperty(name="Snapshot Font", default=True)
    snapshot_grease_pencil: bpy.props.BoolProperty(name="Snapshot Grease Pencil", default=True)
    snapshot_volume: bpy.props.BoolProperty(name="Snapshot Volume", default=True)
    snapshot_lattice: bpy.props.BoolProperty(name="Snapshot Lattice", default=True)
    snapshot_metaball: bpy.props.BoolProperty(name="Snapshot Metaball", default=True)
    snapshot_light_probe: bpy.props.BoolProperty(name="Snapshot Light Probe", default=True)

    def is_enabled(self, key: str) -> bool:
        return getattr(self, f"show_{key}", False)

    def get_snapshot(self, key: str) -> bool:
        return getattr(self, f"snapshot_{key}", True)

    def set_snapshot(self, key: str, value: bool):
        setattr(self, f"snapshot_{key}", value)

    def clear_solo(self):
        self.solo_target = ""


class QUICK_VIEWPORT_FILTERS_preferences(bpy.types.AddonPreferences):
    bl_idname = "quick_viewport_filters"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.quick_viewport_filters

        layout.label(text="Object types shown in the 3D view header:")
        col = layout.column(align=True)
        for key, name, _ in FILTER_TYPES:
            col.prop(settings, f"show_{key}", text=name)
