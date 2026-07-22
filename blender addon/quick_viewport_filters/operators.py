import bpy

from .preferences import FILTER_TYPES


class QUICK_VIEWPORT_FILTERS_OT_toggle(bpy.types.Operator):
    bl_idname = "quick_viewport_filters.toggle"
    bl_label = "Toggle Viewport Filter"
    bl_options = {'REGISTER', 'UNDO'}

    filter_type: bpy.props.StringProperty(name="Filter Type", default="mesh")

    @classmethod
    def poll(cls, context):
        return context.space_data and context.space_data.type == 'VIEW_3D'

    def _label(self) -> str:
        return next(
            (name for key, name, _ in FILTER_TYPES if key == self.filter_type),
            self.filter_type,
        )

    def _toggle(self, context):
        space = context.space_data
        attr = f"show_object_viewport_{self.filter_type}"
        if not hasattr(space, attr):
            self.report({'ERROR'}, f"Unknown viewport filter: {self.filter_type}")
            return {'CANCELLED'}

        settings = context.scene.quick_viewport_filters
        settings.clear_solo()

        current = getattr(space, attr)
        setattr(space, attr, not current)

        state = "shown" if not current else "hidden"
        self.report({'INFO'}, f"{self._label()} viewport {state}")
        return {'FINISHED'}

    def _restore_solo(self, context):
        space = context.space_data
        settings = context.scene.quick_viewport_filters

        for key, _, _ in FILTER_TYPES:
            attr = f"show_object_viewport_{key}"
            if hasattr(space, attr):
                setattr(space, attr, settings.get_snapshot(key))

        settings.clear_solo()
        self.report({'INFO'}, f"Restored viewport filters")
        return {'FINISHED'}

    def _apply_solo(self, context):
        space = context.space_data
        settings = context.scene.quick_viewport_filters

        for key, _, _ in FILTER_TYPES:
            attr = f"show_object_viewport_{key}"
            if hasattr(space, attr):
                settings.set_snapshot(key, getattr(space, attr))
                setattr(space, attr, key == self.filter_type)

        settings.solo_target = self.filter_type
        self.report({'INFO'}, f"Solo {self._label()}")
        return {'FINISHED'}

    def _solo(self, context):
        settings = context.scene.quick_viewport_filters
        if settings.solo_target == self.filter_type:
            return self._restore_solo(context)
        return self._apply_solo(context)

    def invoke(self, context, event):
        if event.shift:
            return self._solo(context)
        return self._toggle(context)

    def execute(self, context):
        return self._toggle(context)
