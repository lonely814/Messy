'''
关键帧吸附到时间线 (Snap Keyframe to Slider)
原作者: Bookyakuno (2019-2022)
中文化 + 5.0+ 兼容 + 功能增强版
License: GNU General Public License v3
'''

bl_info = {
    "name": "关键帧吸附到时间线",
    "author": "Bookyakuno (中文增强版)",
    "version": (2, 1, 0),
    "blender": (4, 2, 0),  # 声明最低支持版本，5.0+ 同样适用
    "description": "把选中的关键帧吸附到时间线(播放头)位置",
    "location": "摄影表 / 曲线编辑器  Ctrl + Alt + 左键拖动 ← / →",
    "category": "Animation",
}

import bpy
from bpy.props import BoolProperty
from bpy.types import Operator, AddonPreferences


# ============ 首选项面板（操作说明） ============
class SNAPSLIDER_AddonPreferences(AddonPreferences):
    bl_idname = __name__

    # 是否吸附到整数帧的开关，放在首选项里方便随时切换
    snap_to_int: BoolProperty(
        name="吸附到整数帧",
        description="拖拽完成后，把关键帧对齐到最近的整数帧（避免停在小数帧）",
        default=True,
    )

    def draw(self, context):
        layout = self.layout

        # 操作说明
        box = layout.box()
        col = box.column()
        col.label(text="操作方法：", icon="KEYINGSET")
        col.label(text="编辑器：摄影表 / 曲线编辑器", icon="ACTION")
        col.label(text="快捷键：Ctrl + Alt + 左键拖动", icon="MOUSE_LMB_DRAG")
        col.label(text="往右拖 → 选中关键帧最早的一帧对齐到时间线", icon="TRIA_RIGHT")
        col.label(text="往左拖 → 选中关键帧最晚的一帧对齐到时间线", icon="TRIA_LEFT")

        # 选项
        box2 = layout.box()
        box2.prop(self, "snap_to_int")


# ============ 核心操作：拖拽吸附 ============
class SNAPSLIDER_OT_main(Operator):
    """把选中关键帧吸附到时间线位置：往右拖对齐最早帧，往左拖对齐最晚帧"""
    bl_idname = "bktemp.keyframe_snap_slider"
    bl_label = "关键帧吸附到时间线"
    bl_description = "把选中的关键帧吸附到播放头(当前帧)位置"
    bl_options = {'REGISTER', 'UNDO'}

    def invoke(self, context, event):
        self.orig_x = event.mouse_region_x
        self.snap_end = False

        # 缓存：记录每条曲线 + 选中关键帧的索引 + 原始坐标
        # 不直接存 kp 对象，避免排序后引用失效导致崩溃
        self._cache = []
        for fcurve in context.editable_fcurves:
            if fcurve.lock:
                continue
            for i, kp in enumerate(fcurve.keyframe_points):
                if kp.select_control_point:
                    self._cache.append({
                        "fcurve": fcurve,
                        "index": i,
                        "co": kp.co.x,
                        "hl": kp.handle_left.x,
                        "hr": kp.handle_right.x,
                    })

        if not self._cache:
            self.report({'WARNING'}, "没有选中任何关键帧")
            return {'CANCELLED'}

        context.window_manager.modal_handler_add(self)
        return {'RUNNING_MODAL'}

    def _apply(self, context, finalize=False):
        """根据当前拖动方向计算位移并应用；finalize=True 时才刷新曲线"""
        c_frame = context.scene.frame_current
        co_list = [item["co"] for item in self._cache]
        base = max(co_list) if self.snap_end else min(co_list)
        delta = c_frame - base

        # 读取首选项里的“吸附到整数帧”开关
        addon_prefs = context.preferences.addons[__name__].preferences
        snap_int = addon_prefs.snap_to_int

        touched = set()
        for item in self._cache:
            fcurve = item["fcurve"]
            # 每次都按 index 重新取关键帧，不用缓存的 kp 对象，避免悬空引用
            kp = fcurve.keyframe_points[item["index"]]
            new_co = item["co"] + delta
            new_hl = item["hl"] + delta
            new_hr = item["hr"] + delta

            # 只有在结束时(finalize)才做整数帧吸附，拖拽过程中保持平滑
            if finalize and snap_int:
                snapped = round(new_co)
                offset = snapped - new_co  # 整帧吸附产生的微调量
                new_co += offset
                new_hl += offset
                new_hr += offset

            kp.co.x = new_co
            kp.handle_left.x = new_hl
            kp.handle_right.x = new_hr
            touched.add(fcurve)

        # 关键：只在结束时刷新一次，modal 过程中绝不调用 update()
        if finalize:
            for fcurve in touched:
                fcurve.update()

    def modal(self, context, event):
        # 松开鼠标 / 回车 → 完成并刷新
        if event.value == 'RELEASE' or event.type in {'RET', 'NUMPAD_ENTER'}:
            self._apply(context, finalize=True)
            return {'FINISHED'}

        # 右键 / ESC → 取消还原
        if event.type in {'RIGHTMOUSE', 'ESC'}:
            for item in self._cache:
                kp = item["fcurve"].keyframe_points[item["index"]]
                kp.co.x = item["co"]
                kp.handle_left.x = item["hl"]
                kp.handle_right.x = item["hr"]
            for item in self._cache:
                item["fcurve"].update()
            return {'CANCELLED'}

        if event.type != 'MOUSEMOVE':
            return {'RUNNING_MODAL'}

        # 判断方向：往左拖对齐最晚帧，往右拖对齐最早帧
        self.snap_end = (event.mouse_region_x - self.orig_x) < 0

        # 拖拽中只改坐标，不刷新曲线
        self._apply(context, finalize=False)
        return {'RUNNING_MODAL'}


# ============ 注册 + 快捷键 ============
classes = (
    SNAPSLIDER_AddonPreferences,
    SNAPSLIDER_OT_main,
)

addon_keymaps = []


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    wm = bpy.context.window_manager
    kc = wm.keyconfigs.addon
    if kc:
        # 摄影表 Dope Sheet
        km = kc.keymaps.new(name="Dopesheet", space_type='DOPESHEET_EDITOR')
        kmi = km.keymap_items.new(
            "bktemp.keyframe_snap_slider",
            type='LEFTMOUSE', value='PRESS',
            ctrl=True, alt=True
        )
        addon_keymaps.append((km, kmi))

        # 曲线编辑器 Graph Editor
        km2 = kc.keymaps.new(name="Graph Editor", space_type='GRAPH_EDITOR')
        kmi2 = km2.keymap_items.new(
            "bktemp.keyframe_snap_slider",
            type='LEFTMOUSE', value='PRESS',
            ctrl=True, alt=True
        )
        addon_keymaps.append((km2, kmi2))


def unregister():
    for km, kmi in addon_keymaps:
        km.keymap_items.remove(kmi)
    addon_keymaps.clear()

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()