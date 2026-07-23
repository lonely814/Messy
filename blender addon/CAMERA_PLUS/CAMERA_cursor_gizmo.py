import bpy
from bpy.types import GizmoGroup, Gizmo, Operator

import mathutils
from mathutils import Matrix, Vector
from math import radians

from bpy.props import IntProperty, FloatProperty

from .CAMERA_active_tool import cursor_gizmo_active



class MOVE_OT_3d_cursor(Operator):
    bl_idname = "move.3d_cursor"
    bl_label = "Simple Modal Operator"

    __slots__ = (
        "axis_set",
        )


    axis: bpy.props.EnumProperty(
        name='Axis',
        description='Axis',
        items=[
            ('X', 'x', '', '', 0),
            ('Y', 'y', '', '', 1),
            ('Z', 'z', '', '', 2),
            ('ALL', 'All', '', '', 3)],
            default='ALL')


    def modal(self, context, event):
        if event.value == 'PRESS':
            if self.axis == 'ALL':
                bpy.ops.transform.translate('INVOKE_DEFAULT',release_confirm = True, cursor_transform=True, orient_type='LOCAL')
            else:
                bpy.ops.transform.translate('INVOKE_DEFAULT',constraint_axis=self.axis_set, release_confirm = True, cursor_transform=True,orient_type='LOCAL')
            return {'FINISHED'}
       
        if event.type in {'RIGHTMOUSE', 'ESC'}:
            return {'CANCELLED'}

        return {'RUNNING_MODAL'}


    def invoke(self, context, event):
        if self.axis == 'X':
            self.axis_set = (True, False, False)
        elif self.axis == 'Y':
            self.axis_set = (False, True, False)
        elif self.axis == 'Z':
            self.axis_set = (False, False, True)
        else:
            self.axis_set = (False, False, False)

        context.window_manager.modal_handler_add(self)
        return {'RUNNING_MODAL'}



#===========================GIZMO===================================
class GIZMO_GGT_3d_cursor(GizmoGroup):
    bl_idname = "gizmo.3d_cursor"
    bl_label = "Gizmo for 3d Cursor"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'WINDOW'
    bl_options = {'3D', 'PERSISTENT', 'SHOW_MODAL_ALL'}



    @classmethod
    def poll(cls, context):
        return cursor_gizmo_active()
            
 
    def setup(self, context):
        #move x
        arrow_x = self.gizmos.new("GIZMO_GT_arrow_3d")
        ar_x = arrow_x.target_set_operator("move.3d_cursor")
        ar_x.axis = 'X'
        arrow_x.line_width = 2
        arrow_x.color = 1.0, 0.1, 0.2
        arrow_x.alpha = 0.6
        arrow_x.color_highlight = 1.0, 0.5, 0.0
        arrow_x.alpha_highlight = 1.0
        arrow_x.scale_basis = 1.3
        arrow_x.use_draw_modal = True
        
        #move Y
        arrow_y = self.gizmos.new("GIZMO_GT_arrow_3d")
        ar_y = arrow_y.target_set_operator("move.3d_cursor")
        ar_y.axis = 'Y'
        arrow_y.color = 0.6, 1.0, 0.3
        arrow_y.alpha = 0.6
        arrow_y.color_highlight = 1.0, 0.5, 0.0
        arrow_y.alpha_highlight = 1.0
        arrow_y.scale_basis = 1.3
        arrow_y.use_draw_modal = True
         
        #move z
        arrow_z = self.gizmos.new("GIZMO_GT_arrow_3d")
        ar_z = arrow_z.target_set_operator("move.3d_cursor")
        ar_z.axis = 'Z'
        arrow_z.line_width = 2
        arrow_z.color = 0.0, 0.4, 1.0
        arrow_z.alpha = 0.6
        arrow_z.color_highlight = 1.0, 0.5, 0.0
        arrow_z.alpha_highlight = 1.0
        arrow_z.scale_basis = 1.3
        arrow_z.use_draw_modal = True
        
        
        
        self.arrow_x = arrow_x
        self.arrow_y = arrow_y
        self.arrow_z = arrow_z

    
    def draw_prepare(self, context):  
        cursor = context.scene.cursor
        
        #this is rotate arrow
        orig_loc, orig_rot, orig_scale = cursor.matrix.decompose()
        orig_loc_mat = Matrix.Translation(orig_loc)
        #vec = Vector((0.0, 0.0, 1.0))
        x_rot_mat = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(90), 4, 'Y') #@ Matrix.Translation(vec)
        y_rot_mat = orig_rot.to_matrix().to_4x4() @ Matrix.Rotation(radians(-90), 4, 'X') 
        
        #view_rot_mat = orig_rot.to_matrix().to_4x4() #@ Matrix.Rotation(radians(-90), 4, 'X')
        
        #new matrix world
        x_matrix = orig_loc_mat @ x_rot_mat 
        y_matrix = orig_loc_mat @ y_rot_mat 
        
      

        #move
        arrow_x = self.arrow_x
        arrow_x.matrix_basis = x_matrix.normalized()
        
        arrow_y = self.arrow_y
        arrow_y.matrix_basis = y_matrix.normalized()
        
        arrow_z = self.arrow_z
        arrow_z.matrix_basis = cursor.matrix.normalized()

        del orig_scale


classes = [
    MOVE_OT_3d_cursor,
    GIZMO_GGT_3d_cursor,    
]


def register():
    for c in classes:
        bpy.utils.register_class(c)     


def unregister():
    for c in classes:
        bpy.utils.unregister_class(c)