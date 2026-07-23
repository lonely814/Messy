import bpy


def _scene_has_camera():
    """Check if the current scene has at least one camera object"""
    for obj in bpy.context.scene.objects:
        if obj.type == 'CAMERA':
            return True
    return False


def _prefs():
    return bpy.context.preferences.addons[__package__.split(".")[0]].preferences


def active_tool():
    """Get the active tool for current context"""
    try:
        from bl_ui.space_toolsystem_common import ToolSelectPanelHelper
        return ToolSelectPanelHelper.tool_active_from_context(bpy.context)
    except Exception:
        return None


def cursor_gizmo_active():
    tool = active_tool()
    if tool is None or tool.idname != "tool.gizmo_camera":
        return False
    props = bpy.context.preferences.addons[__package__.split(".")[0]].preferences
    if bpy.context.space_data.show_gizmo == True:
        if bpy.context.space_data.overlay.show_cursor == True:
            return props.show_gizmo == True


def cam_gizmo_active():
    tool = active_tool()
    if tool is None or tool.idname != "tool.gizmo_camera":
        return False
    if _prefs().show_with_scene_camera:
        if bpy.context.space_data.show_gizmo == True:
            if bpy.context.space_data.overlay.show_overlays == True:
                return _scene_has_camera()
        return False
    if bpy.context.active_object != None:
        if bpy.context.active_object.select_get():
            if bpy.context.space_data.show_gizmo == True:
                if bpy.context.space_data.overlay.show_overlays == True:
                    ob = bpy.context.object
                    return ob and ob.type == 'CAMERA'


def but_gizmo_active():
    tool = active_tool()
    if tool is None:
        return False
    props = bpy.context.preferences.addons[__package__.split(".")[0]].preferences
    if props.gizmo_visible == True:
        if bpy.context.space_data.show_gizmo == True:
            if bpy.context.space_data.overlay.show_overlays == True:
                if props.show_with_scene_camera:
                    return _scene_has_camera()
                if bpy.context.active_object != None:
                    if bpy.context.active_object.select_get():
                        ob = bpy.context.object
                        return ob and ob.type == 'CAMERA'


classes = []


def register():
    for cls in classes:
        bpy.utils.register_class(cls)


def unregister():
    for cls in classes:
        bpy.utils.unregister_class(cls)
