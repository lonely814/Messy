bl_info = {
    "name": "Quick Viewport Filters",
    "blender": (4, 5, 0),
    "version": (1, 0, 0),
    "category": "3D View",
}

import bpy
from bpy.utils import register_classes_factory

from . import preferences, operators, ui

classes = (
    preferences.QUICK_VIEWPORT_FILTERS_PG_settings,
    preferences.QUICK_VIEWPORT_FILTERS_preferences,
    operators.QUICK_VIEWPORT_FILTERS_OT_toggle,
    ui.QUICK_VIEWPORT_FILTERS_PT_popover,
)

_register_classes, _unregister_classes = register_classes_factory(classes)


def register():
    _register_classes()
    ui.register_header()
    bpy.types.Scene.quick_viewport_filters = bpy.props.PointerProperty(
        type=preferences.QUICK_VIEWPORT_FILTERS_PG_settings
    )


def unregister():
    del bpy.types.Scene.quick_viewport_filters
    ui.unregister_header()
    _unregister_classes()
