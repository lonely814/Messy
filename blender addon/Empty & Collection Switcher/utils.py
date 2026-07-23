"""utils.py — Bounding sphere, layer collection helpers, translation tables.

【用途】Empty & Collection Switcher 的工具函数与数据模块
【5.1 与 4.5 兼容性】仅在需要时引用 bpy.context，统一通过参数传入
【运行方式】由 __init__.py 和 operators.py 以相对导入方式引用
"""

from __future__ import annotations

import typing

import bpy
from mathutils import Vector

if typing.TYPE_CHECKING:
    from collections.abc import Generator, Sequence


class Bounding:
    """计算一组 Blender 对象的包围球（Bounding Sphere）。"""

    @staticmethod
    def sphere(
        objects: Sequence[bpy.types.Object] | bpy.types.Object,
        context: bpy.types.Context | None = None,
        mode: str = "BBOX",
    ) -> tuple[Vector | None, float | None]:
        """计算包围球中心与半径。

        :param objects: 对象列表（单个对象会自动包装）。
        :param context: Blender 上下文。为 None 时使用 bpy.context（需核实运行时安全性）。
        :param mode: 计算模式 — 'BBOX'（边界框）、'GEOMETRY'（顶点几何）、'ORIGIN'（原点）。
        :returns: (中心坐标, 半径)。计算失败时返回 (None, None)。
        """
        if context is None:
            context = bpy.context  # type: ignore[assignment]

        if not isinstance(objects, list):
            objects = [objects]

        points_co_global: list[Vector] = []

        if mode == "GEOMETRY":
            depsgraph = context.evaluated_depsgraph_get()
            for obj in objects:
                obj_eval = obj.evaluated_get(depsgraph)
                if obj_eval.type == "MESH":
                    # 需核实：evaluated_get 在 5.1 中是否返回同一类型
                    points_co_global.extend(
                        obj_eval.matrix_world @ v.co for v in obj_eval.data.vertices
                    )
                elif obj_eval.type == "CURVE":
                    for spline in obj_eval.data.splines:
                        points_co_global.extend(
                            obj_eval.matrix_world @ p.co
                            for p in spline.bezier_points
                        )
                    # 需核实：NURBS 和 Poly spline 的点位置 API
                    # 当前仅处理 bezier_points，NURBS 和 Poly 暂被忽略
                else:
                    # 非 Mesh/Curve 类型使用 bound_box
                    if obj_eval.bound_box:
                        points_co_global.extend(
                            obj_eval.matrix_world @ Vector(bbox)
                            for bbox in obj_eval.bound_box
                        )
        elif mode == "BBOX":
            depsgraph = context.evaluated_depsgraph_get()
            for obj in objects:
                obj_eval = obj.evaluated_get(depsgraph)
                if obj_eval.bound_box:
                    points_co_global.extend(
                        obj_eval.matrix_world @ Vector(bbox)
                        for bbox in obj_eval.bound_box
                    )
        elif mode == "ORIGIN":
            points_co_global = [Vector(obj.location) for obj in objects]

        if not points_co_global:
            return None, None

        def _get_center(values: list[float]) -> float:
            return (max(values) + min(values)) / 2.0 if values else 0.0

        xs = [p[0] for p in points_co_global]
        ys = [p[1] for p in points_co_global]
        zs = [p[2] for p in points_co_global]

        center = Vector([_get_center(xs), _get_center(ys), _get_center(zs)])

        radius = max((pt - center).length for pt in points_co_global)
        return center, radius


def all_layer_collections(
    view_layer: bpy.types.ViewLayer,
) -> Generator[bpy.types.LayerCollection, None, None]:
    """广度优先遍历所有层集合（包括嵌套子集合）。

    :param view_layer: 视图层
    :yields: LayerCollection 实例
    """
    if not view_layer or not view_layer.layer_collection:
        return
    stack = [view_layer.layer_collection]
    while stack:
        lc = stack.pop()
        yield lc
        stack.extend(lc.children)


def recur_layer_collection(
    layer_coll: bpy.types.LayerCollection,
    coll_name: str,
) -> bpy.types.LayerCollection | None:
    """递归查找指定名称的层集合。

    :param layer_coll: 起始层集合
    :param coll_name: 要查找的集合名称
    :returns: 匹配的 LayerCollection，未找到返回 None
    """
    if layer_coll.name == coll_name:
        return layer_coll
    for child in layer_coll.children:
        found = recur_layer_collection(child, coll_name)
        if found:
            return found
    return None


# ---------------------------------------------------------------------------
# 翻译表 / Translations
# 语言代码: zh_CN（简体中文-中国大陆）, zh_HANS（简体中文-通用）
# ---------------------------------------------------------------------------
translations: dict[str, dict[tuple[str, str], str]] = {
    "zh_CN": {
        ("", "Empty & Collection Switcher"): "Empty & Collection Switcher集合与空物体相互转换",
        ("*", "Empty and collection convert to each other while keep parent-child relationships."):
            "空物体和集合相互转换,同时保持父子关系。",
        ("", "Right-click context menu in the outline"): "大纲视图里选中空物体或集合后右键菜单",
        ("Operator", "Coll ⇉ Empty"): "集合转为空物体",
        ("*", "Convert active collection to an empty with parent-child level"): "转换集合为带父子级的空物体",
        ("*", "Convert active empty to collection, and the parent-child relationship to the set level."):
            "将活动空物体转换为集合,父子关系转为集合层级。",
        ("Operator", "Empty ⇉ Coll"): "空物体转为集合",
    },
    "zh_HANS": {
        ("", "Empty & Collection Switcher"): "Empty & Collection Switcher集合与空物体相互转换",
        ("*", "Empty and collection convert to each other while keep parent-child relationships."):
            "空物体和集合相互转换,同时保持父子关系。",
        ("", "Right-click context menu in the outline"): "大纲视图里选中空物体或集合后右键菜单",
        ("Operator", "Coll ⇉ Empty"): "集合转为空物体",
        ("*", "Convert active collection to an empty with parent-child level"): "转换集合为带父子级的空物体",
        ("*", "Convert active empty to collection, and the parent-child relationship to the set level."):
            "将活动空物体转换为集合,父子关系转为集合层级。",
        ("Operator", "Empty ⇉ Coll"): "空物体转为集合",
    },
}
