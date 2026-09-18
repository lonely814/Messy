import bpy
import os

from .user_prefs import STAMP_FIELDS

# All pb_ variables come from user prefs, don't overwrite them

# Path of the video produced by the most recent render_segment() call.
# The replay operator reads this so it plays the file that was actually
# written, including marker-split segments the filename rules can't rebuild.
last_output = None

##############################################
#   MAIN OPERATOR
##############################################

def warning(self, context):
    self.layout.label(text="请先保存当前 blend 文件")

def codecs_error(self, context):
    self.layout.label(
        text="请将分辨率设为偶数，或选择其他封装/编码组合")

def videoplayer_error(self, context):
    self.layout.label(text="请检查系统视频播放器设置")

def get_action_name(context):
    """Get active action name from armature or objects"""
    # Try active object first
    active_obj = context.active_object
    if active_obj:
        if active_obj.type == 'ARMATURE' and active_obj.animation_data:
            if active_obj.animation_data.action:
                return active_obj.animation_data.action.name
        # Check for shape key animation
        if active_obj.data and hasattr(active_obj.data, 'shape_keys'):
            if active_obj.data.shape_keys and active_obj.data.shape_keys.animation_data:
                if active_obj.data.shape_keys.animation_data.action:
                    return active_obj.data.shape_keys.animation_data.action.name
    
    # Try to find any object with action
    for obj in context.selected_objects:
        if obj.animation_data and obj.animation_data.action:
            return obj.animation_data.action.name
        if obj.type == 'ARMATURE' and obj.animation_data:
            if obj.animation_data.action:
                return obj.animation_data.action.name
    return None

def get_sorted_markers(scene):
    """Get timeline markers sorted by frame"""
    markers = []
    for marker in scene.timeline_markers:
        markers.append((marker.frame, marker.name))
    markers.sort(key=lambda x: x[0])
    return markers

def get_separator(prefs):
    """Separator character chosen in preferences"""
    if prefs.pb_separator == 'UNDERSCORE':
        return "_"
    if prefs.pb_separator == 'DASH':
        return "-"
    if prefs.pb_separator == 'DOT':
        return "."
    return " "


def get_extension(prefs):
    """Video file extension for the selected container"""
    return {
        'MPEG4': ".mp4",
        'QUICKTIME': ".mov",
        'AVI': ".avi",
        'WEBM': ".webm",
        'MPEG2': ".mpg",
        'OGG': ".ogv",
    }.get(prefs.pb_container, ".mkv")


def get_output_dir(context, prefs):
    """Folder (relative or absolute) the playblast is written to"""
    subfolder = prefs.pb_subfolder_name + "/"

    # Override Folder
    if context.scene.enable_folder and context.scene.enable_overrides:
        return context.scene.custom_folder

    if prefs.pb_output_options == 'PROYECT_FOLDER':
        return "//" + subfolder if prefs.pb_subfolder else "//"
    if prefs.pb_output_options == 'SYSTEM_FOLDER':
        if prefs.pb_subfolder:
            return prefs.pb_system_folder + subfolder
        return prefs.pb_system_folder

    # PROYECT_RENDER_SETTINGS: keep whatever the scene render output is
    file_output = context.scene.render.filepath
    if prefs.pb_subfolder:
        return file_output + subfolder
    return file_output


# Viewport overlay flags a playblast switches off; saved and restored so a
# render never permanently changes what the user's viewport shows.
OVERLAY_FLAGS = (
    'show_overlays', 'show_bones', 'show_extras', 'show_floor',
    'show_axis_x', 'show_axis_y', 'show_axis_z', 'show_text',
    'show_cursor', 'show_annotation', 'show_relationship_lines',
    'show_outline_selected', 'show_motion_paths', 'show_object_origins',
    'show_wireframes', 'show_face_orientation',
)


def get_stamp_fields(render):
    """Suffixes of every use_stamp_* toggle this Blender exposes.

    Discovered from RNA rather than hard-coded: Blender has ~15 of them and the
    ones a playblast does not manage (time, date, render time, labels) default
    to on, which would bury the image in text. Everything not offered in the
    preferences panel is forced off while stamping.
    """
    prefix = 'use_stamp_'
    return tuple(
        prop.identifier[len(prefix):]
        for prop in render.bl_rna.properties
        if prop.identifier.startswith(prefix) and prop.identifier != 'use_stamp'
    )


def save_render_state(context):
    """Snapshot every scene and viewport setting a playblast temporarily changes."""
    render = context.scene.render
    overlay = context.space_data.overlay

    state = {
        'scene': context.scene,
        'space_data': context.space_data,
        'overlay': overlay,
        'file_extension': render.use_file_extension,
        'filepath': render.filepath,
        'view_transform': context.scene.view_settings.view_transform,
        'look': context.scene.view_settings.look,
        'color_mode': render.image_settings.color_mode,
        'color_depth': render.image_settings.color_depth,
        'resolution': (render.resolution_x, render.resolution_y,
                       render.resolution_percentage),
        'stamp': render.use_stamp,
        'stamp_fields': {f: getattr(render, 'use_stamp_' + f)
                         for f in get_stamp_fields(render)},
        'stamp_font_size': render.stamp_font_size,
        'film_transparent': render.film_transparent,
        'show_reconstruction': context.space_data.show_reconstruction,
        'gop': render.ffmpeg.gopsize,
        'overlays': {flag: getattr(overlay, flag) for flag in OVERLAY_FLAGS},
    }

    if bpy.app.version >= (2, 90, 0):
        state['overlays']['show_stats'] = overlay.show_stats

    # Format settings differ between versions: 5.0 moved to media_type and
    # dropped AVI from file_format
    if bpy.app.version >= (5, 0, 0):
        state['media_type'] = render.image_settings.media_type
        state['ffmpeg_format'] = render.ffmpeg.format
        state['ffmpeg_codec'] = render.ffmpeg.codec
    else:
        state['file_format'] = render.image_settings.file_format
        if state['file_format'] == 'FFMPEG':
            state['ffmpeg_format'] = render.ffmpeg.format
            state['ffmpeg_codec'] = render.ffmpeg.codec
    return state


def restore_render_state(state):
    """Put back everything save_render_state captured"""
    render = state['scene'].render

    render.use_file_extension = state['file_extension']
    render.filepath = state['filepath']
    state['scene'].view_settings.view_transform = state['view_transform']
    state['scene'].view_settings.look = state['look']

    if bpy.app.version >= (5, 0, 0):
        render.image_settings.media_type = state['media_type']
        render.ffmpeg.format = state['ffmpeg_format']
        render.ffmpeg.codec = state['ffmpeg_codec']
    else:
        render.image_settings.file_format = state['file_format']
        if state['file_format'] == 'FFMPEG':
            render.ffmpeg.format = state['ffmpeg_format']
            render.ffmpeg.codec = state['ffmpeg_codec']
    render.ffmpeg.gopsize = state['gop']

    render.image_settings.color_mode = state['color_mode']
    render.image_settings.color_depth = state['color_depth']
    render.resolution_x = state['resolution'][0]
    render.resolution_y = state['resolution'][1]
    render.resolution_percentage = state['resolution'][2]
    render.use_stamp = state['stamp']
    for field, value in state['stamp_fields'].items():
        setattr(render, 'use_stamp_' + field, value)
    render.stamp_font_size = state['stamp_font_size']
    render.film_transparent = state['film_transparent']

    for flag, value in state['overlays'].items():
        setattr(state['overlay'], flag, value)
    state['space_data'].show_reconstruction = state['show_reconstruction']


def get_frame_range(context):
    """Frame range a playblast covers: the preview range when it is enabled,
    otherwise the scene range."""
    scene = context.scene
    if scene.use_preview_range and scene.frame_preview_end > scene.frame_preview_start:
        return scene.frame_preview_start, scene.frame_preview_end
    return scene.frame_start, scene.frame_end


def generate_filename(context, prefs, segment_name="", is_marker_segment=False,
                      frame_start=None, frame_end=None):
    """Generate filename based on preferences

    frame_start/frame_end default to the rendered range; render_segment passes the
    segment range so marker-split videos get distinguishable names.
    """
    separator = get_separator(prefs)

    if frame_start is None or frame_end is None:
        frame_start, frame_end = get_frame_range(context)

    # Get filename
    file_name = ""
    blend_path = bpy.data.filepath
    if blend_path:
        file_name = bpy.path.basename(blend_path)
        file_name = os.path.splitext(file_name)[0]
    
    # Define Playblast Name base
    if prefs.pb_playblast_name == 'FILENAME':
        playblast_name = file_name
    elif prefs.pb_playblast_name == 'SCENE_NAME':
        playblast_name = context.scene.name
    elif prefs.pb_playblast_name == 'CUSTOM_NAME':
        playblast_name = prefs.pb_custom_name
    else:
        playblast_name = file_name

    # Quick setting override for this scene, when the user typed a name
    if (context.scene.enable_filename and context.scene.enable_overrides
            and context.scene.custom_playblast_name):
        playblast_name = context.scene.custom_playblast_name
    
    # Add Scene Name suffix if enabled
    if prefs.pb_use_scene_name:
        playblast_name = f"{playblast_name}{separator}{context.scene.name}"
    
    # Add Action Name suffix if enabled
    if prefs.pb_use_action_name:
        action_name = get_action_name(context)
        if action_name:
            playblast_name = f"{playblast_name}{separator}{action_name}"
    
    # Add Marker segment name if splitting by markers
    if is_marker_segment and segment_name:
        playblast_name = f"{playblast_name}{separator}{segment_name}"
    
    # Framerange
    framerange = f'{separator}{frame_start:0>4}{separator}{frame_end:0>4}'
    
    if prefs.pb_framerange:
        name = playblast_name + framerange
    else:
        name = playblast_name
    
    # Custom Version
    if context.scene.enable_version and context.scene.enable_overrides:
        version_number = str(context.scene.version_number)
        version = f'{separator}v{version_number:0>3}'
        name = name + version
    
    name = name + get_extension(prefs)
    return name


class PL_OT_playblast(bpy.types.Operator):
    """快速视口渲染动画帧范围，使用插件独立设置"""
    bl_idname = "playblast_puls.playblast"
    bl_label = "快照"
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
            self.playblast_master(context)
        else:
            context.window_manager.popup_menu(
                warning, title="文件未保存", icon='ERROR')
        return{'FINISHED'}

    def playblast_master(self, context):
        """Main entry point for playblast with marker support"""
        prefs = context.preferences.addons[__package__].preferences

        # Quick settings override the preferences for this render
        use_markers = prefs.pb_use_markers
        if context.scene.enable_markers and context.scene.enable_overrides:
            use_markers = True

        # Check if we should split by markers
        if use_markers and len(context.scene.timeline_markers) > 0:
            success = self.render_by_markers(context)
        else:
            # Normal single render
            success = self.render_segment(context, "", *get_frame_range(context))

        # Auto increment version if enabled, but only when the render worked:
        # a failed attempt should not burn a version number
        if not success:
            self.report({'WARNING'}, "版本号未增加：渲染未成功")
            return

        auto_version = prefs.pb_auto_increment_version
        if context.scene.enable_auto_version and context.scene.enable_overrides:
            auto_version = True

        if auto_version and context.scene.enable_version and context.scene.enable_overrides:
            context.scene.version_number += 1
            self.report({'INFO'}, f"Version incremented to {context.scene.version_number:03d}")

    def render_by_markers(self, context):
        """Render separate videos for each marker segment. Returns True on success."""
        range_start, range_end = get_frame_range(context)

        # A segment is named after the marker that starts it. Markers outside the
        # range are ignored; the range start opens the first segment and the range
        # end closes the last one, so every frame is covered exactly once.
        boundaries = [(range_start, "")]
        for frame, marker_name in get_sorted_markers(context.scene):
            if range_start < frame < range_end:
                boundaries.append((frame, marker_name))
        boundaries.append((range_end, "END"))

        for i in range(len(boundaries) - 1):
            name = boundaries[i][1]
            start_frame = boundaries[i][0]
            end_frame = boundaries[i + 1][0]

            # Frames are inclusive, so stop one short of the next segment to
            # avoid rendering the boundary frame twice
            if i < len(boundaries) - 2:
                end_frame -= 1

            if end_frame < start_frame:
                continue

            self.report({'INFO'}, f"Rendering segment: {name or 'start'} ({start_frame}-{end_frame})")
            if not self.render_segment(context, name, start_frame, end_frame):
                # Stop instead of rendering the rest of a job that is already failing
                return False
        return True

    def render_segment(self, context, segment_name, frame_start, frame_end):
        """Render a specific frame range"""
        prefs = context.preferences.addons[__package__].preferences
        
        # Snapshot everything this render changes; restore_render_state undoes it
        state = save_render_state(context)
        file_resolution_x = state['resolution'][0]
        file_resolution_y = state['resolution'][1]
        overlay = state['overlay']

        failed = False

        try:
            # Generate filename
            is_marker = bool(segment_name)
            name = generate_filename(context, prefs, segment_name, is_marker,
                                     frame_start, frame_end)
            
            # Define Output Path
            output = get_output_dir(context, prefs) + name

            # Calculate Resolution
            if context.scene.enable_resolution and context.scene.enable_overrides:
                if context.scene.override_resize_method == 'PERCENTAGE':
                    divisor = self.get_divisor(context.scene.override_resolution_percentage)
                elif context.scene.override_resize_method == 'MAX_HEIGHT':
                    divisor = file_resolution_y / context.scene.override_resolution_max_height
                else:
                    divisor = 1
            else:
                if prefs.pb_resize_method == 'PERCENTAGE':
                    divisor = self.get_divisor(prefs.pb_resize_percentage)
                elif prefs.pb_resize_method == 'MAX_HEIGHT':
                    divisor = file_resolution_y / prefs.pb_resize_max_height
                else:
                    divisor = 1

            resolution_x = int(file_resolution_x // divisor)
            resolution_y = int(file_resolution_y // divisor)
            resolution_x = self.force_divisible(resolution_x)
            resolution_y = self.force_divisible(resolution_y)

            # Apply settings
            context.scene.render.filepath = output
            
            # Color management override: quick setting first, then preferences
            if (context.scene.enable_color_mgmt and context.scene.enable_overrides) \
                    or prefs.pb_color_management:
                context.scene.view_settings.view_transform = 'Standard'
                context.scene.view_settings.look = 'None'

            # Format settings
            if bpy.app.version >= (5, 0, 0):
                # media_type must be set before container/codec: switching to
                # VIDEO resets codec and gopsize to their defaults.
                context.scene.render.image_settings.media_type = 'VIDEO'
                context.scene.render.ffmpeg.format = prefs.pb_container
                context.scene.render.ffmpeg.codec = prefs.pb_video_codec
                context.scene.render.ffmpeg.gopsize = prefs.pb_gop
            else:
                context.scene.render.image_settings.file_format = prefs.pb_format
                if prefs.pb_format == 'FFMPEG':
                    context.scene.render.ffmpeg.format = prefs.pb_container
                    context.scene.render.ffmpeg.codec = prefs.pb_video_codec
                    context.scene.render.ffmpeg.gopsize = prefs.pb_gop

            # Resolution
            context.scene.render.resolution_x = resolution_x
            context.scene.render.resolution_y = resolution_y
            context.scene.render.resolution_percentage = 100

            # Stamp. Blender enables most stamp fields by default, so set
            # each one explicitly rather than inheriting whatever the user's
            # scene happens to have.
            context.scene.render.use_stamp = prefs.pb_stamp
            if prefs.pb_stamp:
                context.scene.render.stamp_font_size = prefs.pb_stamp_font_size
                for suffix in get_stamp_fields(context.scene.render):
                    setattr(context.scene.render, 'use_stamp_' + suffix,
                            getattr(prefs, 'pb_stamp_' + suffix, False))

            # Environment
            if prefs.pb_show_environment:
                context.scene.render.film_transparent = False

            # Overlays
            if context.scene.enable_overlays and context.scene.enable_overrides:
                overlays = context.scene.hide_overlays
            else:
                overlays = prefs.pb_overlays

            # Apply overlay settings
            if overlays == 'ALL':
                overlay.show_overlays = False
            elif overlays == 'BONES':
                overlay.show_bones = False
            elif overlays == 'ALL_EXCEPT_BACKGROUND_IMAGES':
                overlay.show_floor = False
                overlay.show_axis_x = False
                overlay.show_axis_y = False
                overlay.show_axis_z = False
                overlay.show_text = False
                overlay.show_cursor = False
                overlay.show_annotation = False
                overlay.show_bones = False
                overlay.show_relationship_lines = False
                overlay.show_outline_selected = False
                overlay.show_extras = False
                overlay.show_motion_paths = False
                overlay.show_object_origins = False
                overlay.show_wireframes = False
                overlay.show_face_orientation = False
                context.space_data.show_reconstruction = False
                if bpy.app.version >= (2, 90, 0):
                    overlay.show_stats = False

            # Set frame range for this segment
            original_start = context.scene.frame_start
            original_end = context.scene.frame_end
            # The OpenGL render honors the preview range, which would override the
            # explicit range set below (and break marker segments entirely)
            file_use_preview = context.scene.use_preview_range
            context.scene.use_preview_range = False
            context.scene.frame_start = frame_start
            context.scene.frame_end = frame_end

            # Render
            context.scene.render.use_file_extension = False
            
            # Progress tracking
            total_frames = frame_end - frame_start + 1
            wm = context.window_manager
            wm.progress_begin(0, total_frames)
            self.report({'INFO'}, f"Rendering {total_frames} frames ({frame_start}-{frame_end})")

            try:
                bpy.ops.render.opengl(animation=True)
                wm.progress_update(total_frames)
                # Report the resolved path, not just the filename: it is what the
                # user needs to find or copy the file
                self.report({'INFO'}, f"渲染完成: {bpy.path.abspath(output)}")

                # Remember the written file so the replay operator can play it
                global last_output
                last_output = output

                # Autoplay is pointless for marker splits: the last segment
                # would play while the others are still queued
                split = prefs.pb_use_markers or (
                    context.scene.enable_markers and context.scene.enable_overrides)
                if prefs.pb_autoplay and not split:
                    try:
                        bpy.ops.render.play_rendered_anim()
                    except Exception:
                        context.window_manager.popup_menu(
                            videoplayer_error, title="视频播放器错误", icon='ERROR')
            except Exception as error:
                # Report the reason instead of a generic popup: a silently
                # swallowed failure makes the caller increment the version and
                # keep rendering further segments of a doomed job.
                self.report({'ERROR'}, f"渲染失败 {name}: {error}")
                context.window_manager.popup_menu(
                    codecs_error, title="视频编码器错误", icon='ERROR')
                failed = True
            finally:
                wm.progress_end()
                
            # Restore frame range
            context.scene.frame_start = original_start
            context.scene.frame_end = original_end
            context.scene.use_preview_range = file_use_preview

            return not failed

        finally:
            restore_render_state(state)

    def get_divisor(self, percentage):
        """Divisor for percentage-based resolution scaling.

        Percentage 0 is settable in the UI and would divide by zero; treat it as
        100 so the render still runs at the full project resolution.
        """
        if percentage <= 0:
            self.report({'WARNING'}, "分辨率百分比为 0，按 100% 渲染")
            return 1
        return 100 / percentage

    def force_divisible(self, number):
        if number % 2 != 0:
            print("Resolution value", number, "不能被 2 整除")
            self.report({'INFO'}, "分辨率值 " +
                        str(number) + " is not divisible by 2")
            number += 1
            self.report(
                {'INFO'}, "Playblast 插件已将值改为 " + str(number))
            print("Playblast addon changed that value to", number)
        return number


##############################################
# Register/unregister classes and functions
##############################################
def register():
    bpy.utils.register_class(PL_OT_playblast)

def unregister():
    bpy.utils.unregister_class(PL_OT_playblast)
