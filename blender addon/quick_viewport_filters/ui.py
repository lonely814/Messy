import bpy

from .preferences import FILTER_TYPES

_HEADER_DRAW_HANDLE = None


def _is_viewport(space) -> bool:
    return space is not None and space.type == 'VIEW_3D'


def _draw_filter_button(layout, context, key, icon):
    try:
        space = context.space_data
        attr = f"show_object_viewport_{key}"
        value = getattr(space, attr, True)

        props = layout.operator(
            "quick_viewport_filters.toggle",
            text="",
            icon=icon,
            depress=value,
        )
        props.filter_type = key
    except Exception:
        pass


def _draw_filter_buttons(layout, context):
    try:
        settings = context.scene.quick_viewport_filters
    except Exception:
        return

    for key, _, icon in FILTER_TYPES:
        if not settings.is_enabled(key):
            continue
        _draw_filter_button(layout, context, key, icon)


def _draw_tool_header(self, context):
    try:
        if not _is_viewport(context.space_data):
            return

        layout = self.layout
        row = layout.row(align=True)
        _draw_filter_buttons(row, context)
        row.popover("QUICK_VIEWPORT_FILTERS_PT_popover", text="", icon='PREFERENCES')
    except Exception:
        import traceback
        traceback.print_exc()


class QUICK_VIEWPORT_FILTERS_PT_popover(bpy.types.Panel):
    bl_label = "Quick Viewport Filters"
    bl_idname = "QUICK_VIEWPORT_FILTERS_PT_popover"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'HEADER'

    def draw(self, context):
        layout = self.layout
        settings = context.scene.quick_viewport_filters

        layout.label(text="Visible in header:")
        col = layout.column(align=True)
        for key, name, _ in FILTER_TYPES:
            col.prop(settings, f"show_{key}", text=name)

        layout.separator()
        col = layout.column(align=True)
        col.label(text="Hold Shift and click a button to solo it", icon='INFO')


def register_header():
    global _HEADER_DRAW_HANDLE
    _HEADER_DRAW_HANDLE = _draw_tool_header
    bpy.types.VIEW3D_HT_tool_header.append(_HEADER_DRAW_HANDLE)


def unregister_header():
    global _HEADER_DRAW_HANDLE
    if _HEADER_DRAW_HANDLE is not None:
        bpy.types.VIEW3D_HT_tool_header.remove(_HEADER_DRAW_HANDLE)
        _HEADER_DRAW_HANDLE = None
