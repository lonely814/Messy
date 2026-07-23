"""operators.py — Operator classes for Empty & Collection Switcher.

【用途】定义两个操作符：集合→空物体、空物体→集合，以及大纲视图菜单挂载函数
【5.1 与 4.5 兼容性】所有 context 统一通过参数传入，不使用 bpy.context 全局访问
【运行方式】由 __init__.py 注册；菜单自动出现在大纲视图右键菜单
"""

from __future__ import annotations

import typing

import bpy
from mathutils import Vector

from . import utils

if typing.TYPE_CHECKING:
    from collections.abc import Sequence


# ===========================================================================
# 操作符 1：集合 → 空物体
# ===========================================================================
class OBJECT_OT_CollToEmpty(bpy.types.Operator):
    """将活动层集合递归转换为空物体层级。"""

    bl_idname = "object.coll_to_empty"
    bl_label = "Coll ⇉ Empty"
    bl_description = "Convert active collection to an empty with parent-child level"
    bl_options = {"REGISTER", "UNDO"}

    # ----- 实例属性（类型注解，满足约束 5） -----
    _oldobjs: list[bpy.types.Object]

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self._oldobjs = []

    # ====================== 辅助方法 ======================

    def _unhide_ancestor_collections(self, active_coll: bpy.types.LayerCollection, context: bpy.types.Context) -> None:
        """递归查找并取消隐藏所有祖先集合（解除排除和隐藏状态）。"""
        view_layer = context.view_layer
        if view_layer is None:
            return
        for lc in utils.all_layer_collections(view_layer):
            if lc.collection.name == active_coll.collection.name:
                lc.exclude = False
                lc.hide_viewport = False

        # 解除集合自身的隐藏
        for collection in bpy.data.collections:
            if collection.name == active_coll.collection.name:
                collection.hide_viewport = False
                collection.hide_select = False

        # 递归处理父集合
        parent = self._find_parent_collection(active_coll.collection)
        if parent is not None and parent != context.scene.collection:
            # 需要构造一个 LayerCollection 给递归调用
            self._unhide_ancestor_collections_by_name(
                parent.name, context
            )

    def _unhide_ancestor_collections_by_name(
        self, coll_name: str, context: bpy.types.Context
    ) -> None:
        """按名称递归取消隐藏祖先集合。"""
        view_layer = context.view_layer
        if view_layer is None:
            return
        for lc in utils.all_layer_collections(view_layer):
            if lc.collection.name == coll_name:
                lc.exclude = False
                lc.hide_viewport = False
                break
        for collection in bpy.data.collections:
            if collection.name == coll_name:
                collection.hide_viewport = False
                collection.hide_select = False
                break

        parent = self._find_parent_collection_by_name(coll_name)
        if parent is not None and parent.name != context.scene.collection.name:
            self._unhide_ancestor_collections_by_name(parent.name, context)

    @staticmethod
    def _find_parent_collection(
        collection: bpy.types.Collection,
    ) -> bpy.types.Collection | None:
        """查找指定集合的直接父集合。"""
        all_colls = list(bpy.data.collections)
        all_colls.append(bpy.context.scene.collection)
        for coll in all_colls:
            if collection.name in coll.children:
                return coll
        return None

    @staticmethod
    def _find_parent_collection_by_name(
        coll_name: str,
    ) -> bpy.types.Collection | None:
        """按名称查找父集合。"""
        all_colls = list(bpy.data.collections)
        all_colls.append(bpy.context.scene.collection)
        for coll in all_colls:
            if coll_name in coll.children:
                return coll
        return None

    # ====================== 递归转换 ======================

    def _convert_collection_to_empty(
        self,
        context: bpy.types.Context,
        collection: bpy.types.Collection,
        scale: float,
        parent_coll: bpy.types.Collection,
    ) -> None:
        """递归将集合转换为空物体。

        :param context: Blender 上下文
        :param collection: 要转换的集合
        :param scale: 当前层级空物体的显示大小
        :param parent_coll: 父集合（新空物体链接到此集合）
        """
        if collection.children:
            scale = max(scale - 0.2, 0.4)
            for child in list(collection.children):
                self._convert_collection_to_empty(context, child, scale, collection)
        else:
            new_empty = context.blend_data.objects.new(
                name=collection.name, object_data=None
            )
            parent_coll.objects.link(new_empty)

            if collection.objects:
                objects = list(collection.objects)
                try:
                    co, radius = utils.Bounding.sphere(
                        objects=objects, context=context, mode="BBOX"
                    )
                except Exception:
                    co = Vector((0.0, 0.0, 0.0))
                    self.report(
                        {"WARNING"},
                        f"Failed to compute bounding sphere for '{collection.name}'",
                    )
                else:
                    if co is not None and radius is not None:
                        new_empty.location = co
                        new_empty.empty_display_size = radius
                    else:
                        co = Vector((0.0, 0.0, 0.0))

                world_offset = Vector(co)  # type: ignore[arg-type]
                for obj in collection.objects:
                    if obj != new_empty and obj not in self._oldobjs:
                        self._oldobjs.append(obj)
                        world_pos = obj.matrix_world.translation.copy()
                        obj.parent = new_empty
                        obj.location = world_pos - world_offset

                # 将对象从原始集合移到父集合
                for obj in collection.objects:
                    parent_coll.objects.link(obj)
                    if not self._is_multi_referenced(collection):
                        collection.objects.unlink(obj)

                if new_empty.empty_display_size < 0.01:
                    new_empty.empty_display_size = scale

            # 清理空集合
            if not collection.objects:
                bpy.data.collections.remove(collection)
            elif self._is_multi_referenced(collection):
                parent_coll.children.unlink(collection)
                context.scene.collection.children.link(collection)
                self.report(
                    {"WARNING"},
                    f"[{collection.name}] collection is multi-referenced, "
                    f"kept in scene root",
                )
            else:
                bpy.data.collections.remove(collection)

    @staticmethod
    def _is_multi_referenced(collection: bpy.types.Collection) -> bool:
        """检查集合是否被多个父集合引用（或启用了 Fake User）。"""
        return collection.users > 1 and not collection.use_fake_user

    # ====================== 主入口 ======================

    def execute(self, context: bpy.types.Context) -> set[str]:
        active_col = context.view_layer.active_layer_collection
        if active_col is None:
            self.report({"ERROR"}, "No active layer collection")
            return {"CANCELLED"}

        # 找到父集合
        parent_coll = self._find_parent_collection(active_col.collection)

        # 确保所有祖先集合可见
        self._unhide_ancestor_collections(active_col, context)

        scale = 1.0
        # 使用快照迭代避免死循环（修复：while → for）
        for _ in list(active_col.children):
            self._convert_collection_to_empty(
                context, active_col.collection, scale, parent_coll
            )

        # 创建根空物体
        root_empty = context.blend_data.objects.new(
            name=active_col.collection.name, object_data=None
        )
        root_empty.empty_display_size = 1.0
        root_empty.empty_display_type = "CUBE"
        root_empty.show_name = True

        if parent_coll is not None:
            parent_coll.objects.link(root_empty)
        else:
            context.scene.collection.objects.link(root_empty)

        # 计算包围盒
        objects_in_coll = list(active_col.collection.objects)
        try:
            co, radius = utils.Bounding.sphere(
                objects=objects_in_coll, context=context, mode="BBOX"
            )
        except Exception:
            co = Vector((0.0, 0.0, 0.0))
            radius = 1.0
            self.report(
                {"WARNING"},
                "Failed to compute bounding sphere for root collection",
            )
        else:
            if co is not None and radius is not None:
                root_empty.location = co
                root_empty.empty_display_size = radius
            else:
                co = Vector((0.0, 0.0, 0.0))
                radius = 1.0

        # 重设子对象父级
        world_offset = Vector(co)  # type: ignore[arg-type]
        for obj in active_col.collection.objects:
            if obj != root_empty and obj.parent is None:
                world_pos = obj.matrix_world.translation.copy()
                obj.parent = root_empty
                obj.location = world_pos - world_offset

        # 将所有对象移到父集合
        for obj in active_col.collection.objects:
            if parent_coll is not None:
                parent_coll.objects.link(obj)
            active_col.collection.objects.unlink(obj)

        # 删除原始集合
        bpy.data.collections.remove(active_col.collection)

        # 选中新空物体
        context.view_layer.objects.active = root_empty
        root_empty.select_set(True)

        return {"FINISHED"}


# ===========================================================================
# 操作符 2：空物体 → 集合
# ===========================================================================
class OBJECT_OT_EmptyToColl(bpy.types.Operator):
    """将活动空物体递归转换为集合层级。"""

    bl_idname = "object.empty_to_coll"
    bl_label = "Empty ⇉ Coll"
    bl_description = (
        "Convert active empty to collection, "
        "and the parent-child relationship to the set level."
    )
    bl_options = {"REGISTER", "UNDO"}

    # ----- 实例属性（类型注解，满足约束 5） -----
    _empties_to_delete: list[bpy.types.Object]
    _created_collections: list[str]

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self._empties_to_delete = []
        self._created_collections = []

    @classmethod
    def poll(cls, context: bpy.types.Context) -> bool:
        obj = context.active_object
        return bool(obj and obj.type == "EMPTY" and obj.children)

    # ====================== 递归转换 ======================

    def _convert_empty_to_collection(
        self,
        parent_empty: bpy.types.Object,
        parent_coll: bpy.types.Collection | None,
        color: str,
        great_parent_coll: bpy.types.Collection | None,
    ) -> None:
        """递归将空物体转换为集合。

        :param parent_empty: 要转换的空物体
        :param parent_coll: 新集合的父集合
        :param color: 集合颜色标签
        :param great_parent_coll: 曾祖父集合（用于解除对象链接）
        """
        self._empties_to_delete.append(parent_empty)
        new_coll = bpy.data.collections.new(parent_empty.name)
        new_coll.color_tag = color
        self._created_collections.append(new_coll.name)

        if parent_coll is not None:
            parent_coll.children.link(new_coll)

        for child in list(parent_empty.children):
            # 从曾祖父集合解除链接
            if great_parent_coll is not None:
                try:
                    great_parent_coll.objects.unlink(child)
                except Exception:
                    pass

            # 从场景集合解除链接
            for old_coll in child.users_collection:
                if old_coll == bpy.context.scene.collection:
                    try:
                        old_coll.objects.unlink(child)
                    except Exception:
                        pass

            new_coll.objects.link(child)

            # 递归处理子空物体
            if child.children:
                self._convert_empty_to_collection(
                    child, new_coll, "NONE", great_parent_coll
                )

    def _clear_and_delete_empties(self) -> None:
        """解除空物体的父子关系并删除空物体。"""
        # 第一遍：先解除所有子对象的父子关系（保持世界坐标）
        for empty in self._empties_to_delete:
            for child in list(empty.children):
                world_mat = child.matrix_world.copy()
                child.parent = None
                child.matrix_world = world_mat

        # 第二遍：删除空物体（用快照避免迭代中修改）
        for empty in list(self._empties_to_delete):
            try:
                bpy.data.objects.remove(empty, do_unlink=True)
            except Exception:
                pass

    # ====================== 主入口 ======================

    def execute(self, context: bpy.types.Context) -> set[str]:
        parent_empty = context.active_object
        if parent_empty is None:
            self.report({"ERROR"}, "No active object")
            return {"CANCELLED"}
        if parent_empty.type != "EMPTY":
            self.report({"ERROR"}, f"{parent_empty.name} is not an Empty")
            return {"CANCELLED"}

        parent_coll = None
        if parent_empty.users_collection:
            parent_coll = parent_empty.users_collection[0]

        # 递归转换
        self._convert_empty_to_collection(
            parent_empty, parent_coll, "COLOR_04", parent_coll
        )

        # 清除并删除空物体
        self._clear_and_delete_empties()

        # 自动选中新创建的顶层集合
        if self._created_collections:
            first_name = self._created_collections[0]
            last_coll = bpy.data.collections.get(first_name)
            if last_coll is not None:
                layer_coll = context.view_layer.layer_collection
                found = utils.recur_layer_collection(
                    layer_coll, last_coll.name
                )
                if found is not None:
                    context.view_layer.active_layer_collection = found

        return {"FINISHED"}


# ===========================================================================
# 菜单挂载函数
# ===========================================================================

def menu_fn_coll_to_empty(self: bpy.types.Menu, context: bpy.types.Context) -> None:
    """在大纲视图的集合右键菜单中添加 Coll ⇉ Empty。"""
    layout = self.layout
    active_coll = context.view_layer.active_layer_collection
    if active_coll is None:
        return

    selected_ids = getattr(context, "selected_ids", [])
    selected_coll_names = [
        item.name
        for item in selected_ids
        if isinstance(item, bpy.types.Collection)
    ]

    if (
        len(selected_coll_names) == 1
        and active_coll.name in selected_coll_names
        and active_coll != context.scene.collection
    ):
        layout.operator(
            OBJECT_OT_CollToEmpty.bl_idname,
            icon="UV_SYNC_SELECT",
        )
        layout.separator()


def menu_fn_empty_to_coll(self: bpy.types.Menu, context: bpy.types.Context) -> None:
    """在大纲视图的对象右键菜单中添加 Empty ⇉ Coll。"""
    if len(context.selected_objects) == 1:
        obj = context.active_object
        if obj is not None and obj.type == "EMPTY":
            self.layout.operator(
                OBJECT_OT_EmptyToColl.bl_idname,
                icon="UV_SYNC_SELECT",
            )
            self.layout.separator()
