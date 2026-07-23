import bpy
import blf
from bpy.types import Operator
from mathutils import Vector, Matrix


class ROTATE_OT_orbit(Operator):
    bl_idname = "rotate.orbit"
    bl_label = "Orbit Rotate"
    bl_options = {'REGISTER', 'UNDO'}

    __slots__ = (
        "axis_orient",
        )

    axis: bpy.props.EnumProperty(
        name='Axis',
        description='Axis',
        items=[
            ('GLOBAL', 'Global', '', '', 0),
            ('CURSOR', 'Cursor', '', '', 1)],
            default='GLOBAL',
            )
            

    def modal(self, context, event):
        user_orient = bpy.context.scene.tool_settings.transform_pivot_point
        if event.value != 'RELEASE': #event.pressure > props.pressure: #
            bpy.context.scene.tool_settings.transform_pivot_point = 'CURSOR'
            bpy.ops.transform.rotate('INVOKE_DEFAULT',constraint_axis=(False, False, True),orient_type=self.axis_orient, release_confirm = True)
            bpy.context.scene.tool_settings.transform_pivot_point = user_orient
            return {'FINISHED'}

        return {'FINISHED'}


    def invoke(self, context, event):
        if self.axis == 'GLOBAL':
            self.axis_orient = 'GLOBAL'
        else: # self.axis == 'CURSOR':
            self.axis_orient = 'CURSOR'
        context.window_manager.modal_handler_add(self)
        return{'RUNNING_MODAL'}



######################################################################################################################################
target_obj = None



class OBJECT_OT_target_object(Operator):
    bl_idname = "object.target_object"
    bl_label = "Add"
    bl_options = {'REGISTER', 'UNDO'}


    def execute(self, context):
        global target_obj
        target_obj = context.active_object
        return {'FINISHED'}



class OBJECT_OT_del_target(Operator):
    bl_idname = "object.del_target"
    bl_label = "Remove"
    bl_options = {'REGISTER', 'UNDO'}

    
    def execute(self, context):
        global target_obj
        target_obj = None
        return {'FINISHED'} 



class ROTATE_OT_track_to(Operator):
    bl_idname = "rotate.track_to"
    bl_label = "Track To Cursor"
    bl_options = {'REGISTER', 'UNDO'}
    
    _timer = None
    camera = None


    def modal(self, context, event):
        global target_obj
        props = bpy.context.preferences.addons[__package__.split(".")[0]].preferences
      
        if props.target_visible == True:
            if event.type == 'TIMER':
                if target_obj == None:
                    target_vec = bpy.context.scene.cursor.location
                else:
                    target_vec = target_obj.location 

                
                obj_vec = self.camera.location
                view_vec = obj_vec - target_vec 
                rot_mat = view_vec.to_track_quat('Z', 'Y').to_matrix().to_4x4()
                loc, rot, sca = self.camera.matrix_world.decompose()
                tra_mat = Matrix.Translation(loc)
                self.camera.matrix_world = tra_mat @ rot_mat

            return {'PASS_THROUGH'}
        else:
            props.target_visible = False
            wm = context.window_manager
            wm.event_timer_remove(self._timer)
            return {'FINISHED'}
        return {'PASS_THROUGH'}


    def invoke(self, context, event):
        self.camera = context.active_object
        self._timer = context.window_manager.event_timer_add(0.1, window=context.window)
        context.window_manager.modal_handler_add(self)
        return{'RUNNING_MODAL'}







class ROTATE_OT_trackball_two(Operator):
    bl_idname = "rotate.trackball_two"
    bl_label = "Trackball"
    bl_options = {'REGISTER', 'UNDO'}
  
    def modal(self, context, event):
        user_lock = bpy.context.object.lock_rotation[1] 

        if event.value != 'RELEASE': 
            bpy.context.object.lock_rotation[1] = True
            bpy.ops.transform.trackball('INVOKE_DEFAULT', release_confirm = True)
            bpy.context.object.lock_rotation[1] = user_lock
            return {'FINISHED'}

        return {'FINISHED'}


    def invoke(self, context, event):
        context.window_manager.modal_handler_add(self)
        return{'RUNNING_MODAL'}



class CURSOR_OT_resetrotation(Operator):
    bl_idname = "cursor.resetrotation"
    bl_label = "Reset Rotation 3d Cursor"
    bl_options = {'REGISTER', 'UNDO'}


    def execute(self, context):
        bpy.context.scene.cursor.rotation_euler[0] = 0.0
        bpy.context.scene.cursor.rotation_euler[1] = 0.0
        bpy.context.scene.cursor.rotation_euler[2] = 0.0
        return {'FINISHED'} 



classes = [
    ROTATE_OT_orbit,

    OBJECT_OT_target_object,
    OBJECT_OT_del_target,
    
    ROTATE_OT_track_to,

    ROTATE_OT_trackball_two,
    CURSOR_OT_resetrotation,
]


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)