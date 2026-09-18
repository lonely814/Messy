
import bpy
from bpy_extras import anim_utils


def get_fcurves(anim_data):
    """F-curves of the action assigned to anim_data, or None.

    Blender 5.0 moved F-curves behind layers/strips/channelbags; the helpers in
    bpy_extras.anim_utils resolve that for both the old and the new layout.
    Before the first keyframe is inserted there is no slot yet and therefore
    nothing to return.
    """
    action = anim_data.action
    if not action:
        return None

    slot = getattr(anim_data, "action_slot", None)
    if hasattr(action, "layers"):
        if slot is None:
            return None
        channelbag = anim_utils.action_get_channelbag_for_slot(action, slot)
        if channelbag is None:
            channelbag = anim_utils.action_ensure_channelbag_for_slot(action, slot)
        return channelbag.fcurves

    # Pre-4.4 layout: F-curves live directly on the action
    return action.fcurves


class PL_OT_turnaround_camera(bpy.types.Operator):
    """创建建模台相机（会覆盖已有的）"""
    bl_idname = "playblast_puls.turnaround_camera"
    bl_label = "添加建模台相机"
    bl_options = {'REGISTER', 'UNDO'}

    # Creation Settings
    start_frame: bpy.props.IntProperty(
        name="起始帧",
        description="建模台相机动画的起始帧",
        default=1,
        soft_min=0,
    )
    end_frame: bpy.props.IntProperty(
        name="结束帧",
        description="建模台相机动画的结束帧",
        default=200,
        soft_min=0,
    )
    camera_distance: bpy.props.IntProperty(
        name="相机距离",
        description="相机到目标中心的距离（单位：米）",
        default=10,
        soft_min=0,
    )
    active_camera: bpy.props.BoolProperty(
        name="设为活跃相机",
        description="活跃相机，用于渲染场景",
        default=True,
    )
    invert_direction: bpy.props.BoolProperty(
        name="反向旋转",
        description="反向建模台旋转方向",
        default=False,
    )
    interpolation_type: bpy.props.EnumProperty(
        name="插值类型",
        description="关键帧之间的插值类型",
        items=[('LINEAR', 'Linear', ''),
               ('BEZIER', 'Bezier', ''),
               ('BACK', 'Back', ''), ],
        default='LINEAR'
    )

    # Prevents operator appearing in unsupported editors
    @classmethod
    def poll(cls, context):
        if (context.area.ui_type == 'VIEW_3D'):
            return True

    def execute(self, context):
        # Manipulation of variables
        turnaround_rotation = 6.28319  # In radians

        # Invert direction
        if self.invert_direction:
            turnaround_rotation *= -1

        # Set start and end frame of scene
        scene = context.scene
        scene.frame_start = self.start_frame
        scene.frame_end = self.end_frame

        # Create Turnaround Collection and link to main collection
        if not "Turnaround" in bpy.data.collections:
            collection = bpy.data.collections.new("Turnaround")
            context.scene.collection.children.link(collection)
        else:
            collection = bpy.data.collections["Turnaround"]

        # Create Camera
        if not "Turnaround_Cam" in bpy.data.cameras:
            cam = bpy.data.cameras.new("Turnaround_Cam")
        else:
            cam = bpy.data.cameras["Turnaround_Cam"]

        if not "Turnaround_Camera" in bpy.data.objects:
            camera = bpy.data.objects.new("Turnaround_Camera", cam)
            camera.rotation_euler = (1.5708, 0.0, 0.0)
            collection.objects.link(camera)
        else:
            camera = bpy.data.objects["Turnaround_Camera"]

        camera.location = (0, self.camera_distance * -1, 0)

        # Create Empty
        if not "Turnaround_Rotation" in bpy.data.objects:
            empty = bpy.data.objects.new("Turnaround_Rotation", None)
            empty.empty_display_size = 2
            empty.empty_display_type = 'PLAIN_AXES'
            collection.objects.link(empty)
        else:
            empty = bpy.data.objects["Turnaround_Rotation"]

        # Parent camera to empty
        camera.parent = empty

        # Set empty as active
        empty.select_set(True)
        context.view_layer.objects.active = empty

        # Set scene active camera
        if self.active_camera:
            context.scene.camera = camera

        if not "Turnaround_Action" in bpy.data.actions:
            action = bpy.data.actions.new("Turnaround_Action")
        else:
            action = bpy.data.actions["Turnaround_Action"]

        # Set active action
        if empty.animation_data is None:
            empty.animation_data_create()
        empty.animation_data.action = action

        # Remove existing fcurves so re-running replaces the animation
        # instead of appending duplicate keys at the old range
        fcurves = get_fcurves(empty.animation_data)
        if fcurves is not None:
            for fcurve in list(fcurves):
                fcurves.remove(fcurve)

        # Insert start keyframe (0,0,0)
        empty.rotation_euler[2] = 0
        empty.keyframe_insert(data_path="rotation_euler",
                              index=2, frame=self.start_frame)

        # Insert end keyframe (360 degrees in Z axis)
        empty.rotation_euler[2] = turnaround_rotation
        empty.keyframe_insert(data_path="rotation_euler",
                              index=2, frame=self.end_frame)

        # Set interpolation type on every key so the rotation speed is uniform
        for fcurve in get_fcurves(empty.animation_data) or ():
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = self.interpolation_type

        return{'FINISHED'}

    # Popup
    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self)

    # Custom Draw
    def draw(self, context):
        layout = self.layout
        layout.use_property_split = True
        layout.use_property_decorate = False

        box = layout.box()
        box.separator()
        col = box.column(align=True)
        col.prop(self, "start_frame")
        col.prop(self, "end_frame")

        box.prop(self, "camera_distance")
        box.prop(self, "active_camera")
        box.prop(self, "invert_direction")
        box.prop(self, "interpolation_type")
        box.separator()


##############################################
# REGISTER/UNREGISTER
##############################################
def register():
    bpy.utils.register_class(PL_OT_turnaround_camera)


def unregister():
    bpy.utils.unregister_class(PL_OT_turnaround_camera)
