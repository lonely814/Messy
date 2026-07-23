"""__init__.py — Empty & Collection Switcher 注册入口

【用途】Blender 扩展入口点：注册/反注册操作符、菜单、偏好设置、翻译
【5.1 与 4.5 兼容性】
  - 使用 blender_manifest.toml（扩展平台） + bl_info（传统回退）双格式
  - register_classes_factory 在 4.2+ 和 5.x 中可用
  - 需核实：bpy.app.translations.register 在扩展系统下是否需调整
【运行方式】由 Blender 自动加载；也可在文本编辑器中运行以测试注册
"""

from __future__ import annotations

import bpy
from bpy.utils import register_classes_factory

# 双格式兼容：blender_manifest.toml（扩展平台）+ bl_info（传统回退）
bl_info = {
    "name": "Empty & Collection Switcher",
    "description": "Empty and collection convert to each other while keep parent-child relationships.",
    "author": "CP-Design",
    "version": (1, 1, 0),
    "blender": (3, 0, 0),
    "location": "Right-click context menu in the outliner",
    "doc_url": "https://blendermarket.com/products/empty--collection-switcher",
    "category": "CP",
}

from . import operators, utils

# ---------------------------------------------------------------------------
# 偏好设置 / Preferences
# ---------------------------------------------------------------------------

# 需核实：扩展系统下 AddonPreferences 是否被 ExtensionPreferences 取代
# 当前保留 AddonPreferences 以确保 4.5 LTS 兼容
class SNA_AddonPreferences_EmptyCollectionSwitcher(bpy.types.AddonPreferences):
    bl_idname = __package__  # 扩展系统下使用 __package__ 而非 __name__

    def draw(self, context: bpy.types.Context) -> None:
        layout = self.layout
        box = layout.box()
        box.scale_y = 1
        box.label(text="More Plugins", icon="SCRIPTPLUGINS")
        row = box.row(heading="", align=True)
        row.scale_y = 1.5

        links: list[tuple[str, str]] = [
            (
                "Rhino to Blender",
                "https://blenderartists.org/t/free-addon-rhino-to-blender-"
                "quickly-export-rhino-models-to-blender/1489621",
            ),
            (
                "Blender Market",
                "https://blendermarket.com/creators/cp-design",
            ),
            (
                "GitHub",
                "https://github.com/chenpaner",
            ),
            (
                "BiLiBiLi",
                "https://space.bilibili.com/2711518",
            ),
            (
                "YouTube",
                "https://www.youtube.com/channel/UCb4bdeOqaXHLnSr9HGu63Ew",
            ),
        ]
        for text, url in links:
            op = row.operator(
                "wm.url_open",
                text=text,
                icon="URL",
                emboss=True,
            )
            op.url = url


# ---------------------------------------------------------------------------
# 注册 / 反注册
# ---------------------------------------------------------------------------

_classes_to_register = (
    operators.OBJECT_OT_CollToEmpty,
    operators.OBJECT_OT_EmptyToColl,
    SNA_AddonPreferences_EmptyCollectionSwitcher,
)

_register_classes, _unregister_classes = register_classes_factory(
    _classes_to_register
)


def register() -> None:
    _register_classes()

    # 挂载菜单
    bpy.types.OUTLINER_MT_collection.prepend(operators.menu_fn_coll_to_empty)
    bpy.types.OUTLINER_MT_object.prepend(operators.menu_fn_empty_to_coll)

    # 注册翻译
    bpy.app.translations.register(__package__, utils.translations)


def unregister() -> None:
    # 反注册翻译（与 register 顺序相反）
    bpy.app.translations.unregister(__package__)

    # 移除菜单
    bpy.types.OUTLINER_MT_collection.remove(operators.menu_fn_coll_to_empty)
    bpy.types.OUTLINER_MT_object.remove(operators.menu_fn_empty_to_coll)

    _unregister_classes()


if __name__ == "__main__":
    register()
