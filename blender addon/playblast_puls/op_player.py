import bpy

from . import op_playblast

# All pb_ variables come from user prefs, don't overwrite them

##############################################
#   MAIN OPERATOR
##############################################

def warning(self, context):
    self.layout.label(text="请先保存当前 blend 文件")
###### PLAYER COMMENTED CODE ######
# def codecs_error(self, context):
#     self.layout.label(
#         text="Set resolution divisible by 2, or choose another container/codec combination")

def videoplayer_error(self, context):
    self.layout.label(text="请检查系统视频播放器设置")

class PL_OT_player(bpy.types.Operator):
    """回放上次 Playblast 生成的视频文件"""
    bl_idname = "playblast_puls.player"
    bl_label = "回放"
    bl_options = {'REGISTER', 'UNDO'}

    # Prevents operator appearing in unsupported editors
    @classmethod
    def poll(cls, context):
        if context.area != None:
            if context.area.ui_type == 'VIEW_3D':
                return True

    ##############################################
    #   Playblast functionality
    ##############################################
    def execute(self, context):

        # If file is not saved, show warning message
        if bpy.data.is_saved:
            self.playblast(context)
        else:
            context.window_manager.popup_menu(
                warning, title="文件未保存", icon='ERROR')
        return{'FINISHED'}

    def playblast(self, context):

        prefs = context.preferences.addons[__package__].preferences

        # Snapshot everything this replay changes; restore_render_state undoes it
        state = op_playblast.save_render_state(context)
        file_resolution_x = state['resolution'][0]
        file_resolution_y = state['resolution'][1]

        # Prevent Blender from appending a second extension
        context.scene.render.use_file_extension = False

        # Replay the file the last playblast actually wrote. Rebuilding the
        # name from preferences gets it wrong whenever scene/action name or
        # marker suffixes were in play (or when splitting by markers), so fall
        # back to the name rules only when nothing has been rendered yet.
        if op_playblast.last_output:
            output = op_playblast.last_output
            name = ""
        else:
            name = op_playblast.generate_filename(context, prefs)
            output = op_playblast.get_output_dir(context, prefs) + name

        # Override Resolution Scale Method
        # A percentage of 0 is settable in the UI; treat it as 100 to avoid
        # dividing by zero
        if context.scene.enable_resolution and context.scene.enable_overrides:
            percentage = context.scene.override_resolution_percentage
            if context.scene.override_resize_method == 'PERCENTAGE':
                divisor = 100 / percentage if percentage > 0 else 1
            elif context.scene.override_resize_method == 'MAX_HEIGHT':
                divisor = file_resolution_y / context.scene.override_resolution_max_height
            else:
                divisor = 1
        else:
            if prefs.pb_resize_method == 'PERCENTAGE':
                divisor = 100 / prefs.pb_resize_percentage if prefs.pb_resize_percentage > 0 else 1
            elif prefs.pb_resize_method == 'MAX_HEIGHT':
                divisor = file_resolution_y / prefs.pb_resize_max_height
            else:
                divisor = 1

        # Asign new resolution
        resolution_x = int(file_resolution_x // divisor)
        resolution_y = int(file_resolution_y // divisor)
        resolution_x = self.force_divisible(resolution_x)
        resolution_y = self.force_divisible(resolution_y)
        
        #################################
        # Overwrite file settings
        #################################
        context.scene.render.filepath = output

        if bpy.app.version >= (5, 0, 0):
            # media_type must be set before container/codec: switching to VIDEO
            # resets codec and gopsize to their defaults.
            context.scene.render.image_settings.media_type = 'VIDEO'
            context.scene.render.ffmpeg.format = prefs.pb_container
            context.scene.render.ffmpeg.codec = prefs.pb_video_codec
            context.scene.render.ffmpeg.gopsize = prefs.pb_gop
        else:
            # Pre-Blender 5.0
            context.scene.render.image_settings.file_format = prefs.pb_format
            if prefs.pb_format == 'FFMPEG':
                context.scene.render.ffmpeg.format = prefs.pb_container
                context.scene.render.ffmpeg.codec = prefs.pb_video_codec
                context.scene.render.ffmpeg.gopsize = prefs.pb_gop

        # if prefs.pb_resize_method == 'PERCENTAGE' or prefs.pb_resize_method == 'MAX_HEIGHT':
        context.scene.render.resolution_x = resolution_x
        context.scene.render.resolution_y = resolution_y
        # Prevents unwanted resizing
        context.scene.render.resolution_percentage = 100

        context.scene.render.use_stamp = prefs.pb_stamp
        if prefs.pb_stamp:
            context.scene.render.stamp_font_size = prefs.pb_stamp_font_size
            for suffix in op_playblast.get_stamp_fields(context.scene.render):
                setattr(context.scene.render, 'use_stamp_' + suffix,
                        getattr(prefs, 'pb_stamp_' + suffix, False))

        if prefs.pb_show_environment:
            context.scene.render.film_transparent = False

        # Override Overlays
        if context.scene.enable_overlays and context.scene.enable_overrides:
            overlays = context.scene.hide_overlays
        else:
            overlays = prefs.pb_overlays

        # Overlays settings
        if overlays == 'ALL':
            context.space_data.overlay.show_overlays = False

        elif overlays == 'BONES':
            context.space_data.overlay.show_bones = False

        elif overlays == 'ALL_EXCEPT_BACKGROUND_IMAGES':         
            context.space_data.overlay.show_floor = False
            context.space_data.overlay.show_axis_x = False
            context.space_data.overlay.show_axis_y = False
            context.space_data.overlay.show_axis_z = False
            context.space_data.overlay.show_text = False
            if bpy.app.version >= (2, 90, 0):
                context.space_data.overlay.show_stats = False
            context.space_data.overlay.show_cursor = False
            context.space_data.overlay.show_annotation = False
            context.space_data.overlay.show_bones = False
            context.space_data.overlay.show_relationship_lines = False
            context.space_data.overlay.show_outline_selected = False
            context.space_data.overlay.show_extras = False
            context.space_data.overlay.show_motion_paths = False
            context.space_data.overlay.show_object_origins = False 
            context.space_data.overlay.show_wireframes = False
            context.space_data.overlay.show_face_orientation = False
            context.space_data.show_reconstruction = False     
        ###### PLAYER COMMENTED CODE ######
        # Try to create the video, but mainly protect the user's data
        # try:
        #     bpy.ops.render.opengl(animation=True)
        #     if prefs.pb_autoplay:
        #         try:
        #             bpy.ops.render.play_rendered_anim()
        #         except:
        #             context.window_manager.popup_menu(
        #                 videoplayer_error, title="视频播放器错误", icon='ERROR')
        # except:
        #     context.window_manager.popup_menu(
        #         codecs_error, title="Codecs error", icon='ERROR')
        ##############################################################
        #### Try to replay video, but mainly protect the user's data
        try:
            bpy.ops.render.play_rendered_anim()
        except Exception:
            context.window_manager.popup_menu(
                videoplayer_error, title="视频播放器错误", icon='ERROR')
        finally:
            op_playblast.restore_render_state(state)

    def force_divisible(self, number):
        if number % 2 != 0:
            print("Resolution value", number, "不能被 2 整除")
            self.report({'INFO'}, "分辨率值 " +
                        str(number) + " is not divisible by 2")
            number += 1
            self.report(
                {'INFO'}, "Playblast 插件已将值改为 " + str(number))
            print("Playblast addon changed that value to", number)
        else:
            pass

        return number


##############################################
# Register/unregister classes and functions
##############################################
def register():
    bpy.utils.register_class(PL_OT_player)

def unregister():
    bpy.utils.unregister_class(PL_OT_player)