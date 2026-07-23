import bpy
import os 
import bmesh 
import mathutils
from bpy.types import GizmoGroup
from mathutils import Matrix, Vector
from math import radians
import bpy.utils.previews

from .CAMERA_active_tool import but_gizmo_active


class GIZMO_GGT_camera(GizmoGroup):
    bl_idname = "gizmo.camera"
    bl_label = "Gizmo Camera"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'WINDOW'
    bl_options = {'PERSISTENT','SHOW_MODAL_ALL', 'SCALE'} #'DEPTH_3D' , 'TOOL_INIT', 'SELECT', 


    @classmethod
    def poll(cls, context):
        return but_gizmo_active()
     

    def setup(self, context):
        pcoll = preview_collections["main"]
        roll = pcoll["roll"]
        ### translate
        truck = self.gizmos.new("GIZMO_GT_button_2d")
        truck_op = truck.target_set_operator("transform.translate")
        truck_op.constraint_axis = (True, False, False)
        truck_op.orient_type='LOCAL'
        truck.icon = 'ARROW_LEFTRIGHT'
        truck.draw_options = {'BACKDROP', 'HELPLINE'}
        truck.color = 0.15, 0.15, 0.15
        truck.alpha = 0.8
        truck.color_highlight = 0.8, 0.8, 0.8
        truck.alpha_highlight = 0.2
        truck.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2  # Same as buttons defined in C
        
        pedestal = self.gizmos.new("GIZMO_GT_button_2d")
        pedestal_op = pedestal.target_set_operator("transform.translate")
        pedestal_op.constraint_axis = (False, False, True)
        pedestal_op.orient_type='GLOBAL'
        pedestal.icon = 'SORT_ASC'
        pedestal.draw_options = {'BACKDROP', 'HELPLINE'}
        pedestal.color = 0.15, 0.15, 0.15
        pedestal.alpha = 0.8
        pedestal.color_highlight = 0.8, 0.8, 0.8
        pedestal.alpha_highlight = 0.2
        pedestal.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2  

        dolly = self.gizmos.new("GIZMO_GT_button_2d")
        dolly_op = dolly.target_set_operator("transform.translate")
        dolly_op.constraint_axis = (False, False, True)
        dolly_op.orient_type='LOCAL'
        dolly.icon = 'UV_SYNC_SELECT'
        dolly.draw_options = {'BACKDROP', 'HELPLINE'}
        dolly.color = 0.15, 0.15, 0.15
        dolly.alpha = 0.8
        dolly.color_highlight = 0.8, 0.8, 0.8
        dolly.alpha_highlight = 0.2
        dolly.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2 


        ### rotate
        roll = self.gizmos.new("GIZMO_GT_button_2d")
        roll_op = roll.target_set_operator("transform.rotate")
        roll_op.constraint_axis=(False, False, True)
        roll_op.orient_type = 'LOCAL'
        roll.icon = 'FILE_REFRESH'
        #roll.icon = roll

        roll.draw_options = {'BACKDROP', 'HELPLINE'}
        roll.color = 0.15, 0.15, 0.15
        roll.alpha = 0.8
        roll.color_highlight = 0.8, 0.8, 0.8
        roll.alpha_highlight = 0.2
        roll.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2 
        
        tilt = self.gizmos.new("GIZMO_GT_button_2d")
        tilt_op = tilt.target_set_operator("transform.rotate")
        tilt_op.constraint_axis=(True, False, False)
        tilt_op.orient_type = 'LOCAL'
        tilt.icon = 'LOOP_BACK'
        tilt.draw_options = {'BACKDROP', 'HELPLINE'}
        tilt.color = 0.15, 0.15, 0.15
        tilt.alpha = 0.8
        tilt.color_highlight = 0.8, 0.8, 0.8
        tilt.alpha_highlight = 0.2
        tilt.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2

        pan = self.gizmos.new("GIZMO_GT_button_2d")
        pan_op = pan.target_set_operator("transform.rotate")
        pan_op.constraint_axis=(False, False, True)
        pan_op.orient_type = 'GLOBAL'
        pan.icon = 'FORCE_MAGNETIC' #
        pan.draw_options = {'BACKDROP', 'HELPLINE'}
        pan.color = 0.15, 0.15, 0.15
        pan.alpha = 0.8
        pan.color_highlight = 0.8, 0.8, 0.8
        pan.alpha_highlight = 0.2
        pan.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2
        
        orbit = self.gizmos.new("GIZMO_GT_button_2d")
        orbit.target_set_operator("rotate.orbit")
        orbit.icon = 'ORIENTATION_CURSOR'
        orbit.draw_options = {'BACKDROP', 'HELPLINE'}
        orbit.color = 0.15, 0.15, 0.15
        orbit.alpha = 0.8
        orbit.color_highlight = 0.8, 0.8, 0.8
        orbit.alpha_highlight = 0.2
        orbit.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2

        track = self.gizmos.new("GIZMO_GT_button_2d")
        track.target_set_operator("rotate.trackball_two")
        track.icon = 'VIEW_PAN'
        track.draw_options = {'BACKDROP', 'HELPLINE'}
        track.color = 0.15, 0.15, 0.15
        track.alpha = 0.8
        track.color_highlight = 0.8, 0.8, 0.8
        track.alpha_highlight = 0.2
        track.scale_basis = (80 * 0.5 * _prefs().button_scale) / 2


        self.truck = truck 
        self.pedestal = pedestal
        self.dolly = dolly

        self.roll = roll
        self.tilt = tilt
        self.pan = pan
        self.orbit = orbit
        
        self.track = track

        # Drag handle button
        drag = self.gizmos.new("GIZMO_GT_button_2d")
        drag.target_set_operator("camera.drag_panel")
        drag.icon = 'GRIP'
        drag.draw_options = {'BACKDROP', 'HELPLINE'}
        drag.color = 0.25, 0.25, 0.30
        drag.alpha = 0.8
        drag.color_highlight = 0.8, 0.8, 0.8
        drag.alpha_highlight = 0.5
        self.drag = drag


    def draw_prepare(self, context):
        prefs = context.preferences.addons[__package__.split(".")[0]].preferences
        sp = prefs.button_spacing
        y = prefs.button_y
        cx = context.area.width / 2
        ox = prefs.panel_offset_x

        self.truck.matrix_basis[0][3] = cx + ox - sp * 3
        self.truck.matrix_basis[1][3] = y

        self.pedestal.matrix_basis[0][3] = cx + ox - sp * 2
        self.pedestal.matrix_basis[1][3] = y

        self.dolly.matrix_basis[0][3] = cx + ox - sp * 1
        self.dolly.matrix_basis[1][3] = y

        self.roll.matrix_basis[0][3] = cx + ox
        self.roll.matrix_basis[1][3] = y

        self.tilt.matrix_basis[0][3] = cx + ox + sp * 1
        self.tilt.matrix_basis[1][3] = y

        self.pan.matrix_basis[0][3] = cx + ox + sp * 2
        self.pan.matrix_basis[1][3] = y

        self.orbit.matrix_basis[0][3] = cx + ox + sp * 3
        self.orbit.matrix_basis[1][3] = y

        self.track.matrix_basis[0][3] = cx + ox + sp * 4
        self.track.matrix_basis[1][3] = y

        self.drag.matrix_basis[0][3] = cx + ox - sp * 4
        self.drag.matrix_basis[1][3] = y
        #-------------------------------ORIENTATIONS-------------------------------------------------------------------------------------------------------------------------------------
        """ ob = context.object.matrix_world
        orient_slots = context.window.scene.transform_orientation_slots[0].type
        orig_loc, orig_rot, orig_scale = ob.decompose() 

      
        orig_loc_mat = Matrix.Translation(orig_loc)
        orig_scale_mat = Matrix.Scale(orig_scale[0], 4, (1, 0, 0)) @ Matrix.Scale(orig_scale[1], 4, (0, 1, 0)) @ Matrix.Scale(orig_scale[2], 4, (0, 0, 1))
        
        x_rot_mat = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(90), 4, 'Y') 
        y_rot_mat = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(-90), 4, 'X') 
        z_rot_mat = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(-90), 4, 'Z') 

        x_rot_mat_dial = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(-90), 4, 'Y')  
        y_rot_mat_dial = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(90), 4, 'X')  
        z_rot_mat_dial = orig_rot.to_matrix().to_4x4() 
            
        #-------------NEW MATRIX WORLD
        x_matrix_world = orig_loc_mat @ x_rot_mat @ orig_scale_mat  
        y_matrix_world = orig_loc_mat @ y_rot_mat @ orig_scale_mat  
        z_matrix_world = orig_loc_mat @ z_rot_mat @ orig_scale_mat 
        
        x_matrix_world_dial = orig_loc_mat @ x_rot_mat_dial @ orig_scale_mat 
        y_matrix_world_dial = orig_loc_mat @ y_rot_mat_dial @ orig_scale_mat  
        z_matrix_world_dial = orig_loc_mat @ z_rot_mat_dial @ orig_scale_mat """




        

        
def _prefs():
    import bpy
    return bpy.context.preferences.addons[__package__.split(".")[0]].preferences


class CAMERA_OT_drag_panel(bpy.types.Operator):
    bl_idname = "camera.drag_panel"
    bl_label = "拖动面板"
    bl_options = {'REGISTER'}

    _start_mouse = (0, 0)
    _start_ox = 0
    _start_oy = 0

    def modal(self, context, event):
        prefs = context.preferences.addons[__package__.split(".")[0]].preferences
        if event.type == 'LEFTMOUSE' and event.value == 'RELEASE':
            return {'FINISHED'}
        if event.type == 'MOUSEMOVE':
            dx = event.mouse_x - self._start_mouse[0]
            dy = event.mouse_y - self._start_mouse[1]
            prefs.panel_offset_x = self._start_ox + dx
            prefs.panel_offset_y = self._start_oy - dy
            return {'RUNNING_MODAL'}
        return {'PASS_THROUGH'}

    def invoke(self, context, event):
        prefs = context.preferences.addons[__package__.split(".")[0]].preferences
        self._start_mouse = (event.mouse_x, event.mouse_y)
        self._start_ox = prefs.panel_offset_x
        self._start_oy = prefs.panel_offset_y
        context.window_manager.modal_handler_add(self)
        return {'RUNNING_MODAL'}


preview_collections = {}
classes = [
    GIZMO_GGT_camera,
    CAMERA_OT_drag_panel,
]


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    pcoll = bpy.utils.previews.new()
    my_icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    pcoll.load("roll", os.path.join(my_icons_dir, "roll.png"), 'IMAGE')
    preview_collections["main"] = pcoll


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)