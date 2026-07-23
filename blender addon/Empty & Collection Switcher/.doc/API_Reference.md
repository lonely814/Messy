# API Reference / 开发者参考

> 本文档面向需要理解或扩展源代码的 Blender 插件开发者。
> 代码遵循 Blender 5.1 主目标 / 4.5 LTS 兼容标准。

---

## 文件结构 (v2.0 — 模块化重构)

```
Empty & Collection Switcher/
├── blender_manifest.toml   # 扩展平台清单（4.2+）
├── __init__.py             # 注册入口（bl_info 双格式兼容）
├── utils.py                # 工具函数与数据（Bounding、翻译表）
├── operators.py            # 操作符类与菜单挂载
├── LICENSE.txt             # 许可证
└── .doc/                   # 文档目录
    ├── README.md
    ├── Usage_Guide.md
    ├── API_Reference.md     ← 本文档
    └── CHANGELOG.md
```

---

## 扩展清单 / Extension Manifest

**文件**: `blender_manifest.toml`

| 字段 | 值 |
|------|-----|
| `id` | `empty_collection_switcher` |
| `version` | `"1.1.0"` |
| `blender_version_min` | `"4.5.0"` |
| `type` | `"add-on"` |
| `tags` | `["Object", "User Interface"]` |

同时保留 `__init__.py` 中的 `bl_info` 字典，以实现 **双格式兼容**：
- 扩展平台 → 读取 `blender_manifest.toml`
- 传统安装 → 读取 `bl_info`

---

## 模块 / Modules

### `utils.py` — 工具函数

#### `Bounding`

用于计算一组对象的包围球（Bounding Sphere）。

**`Bounding.sphere(objects, context=None, mode='BBOX')`**

| 参数 | 类型 | 说明 |
|------|------|------|
| `objects` | `Sequence[bpy.types.Object]` | 要计算包围球的对象列表 |
| `context` | `bpy.types.Context 或 None` | Blender 上下文；为 None 时使用 bpy.context |
| `mode` | `str` | `'BBOX'`（默认，基于边界框）、`'GEOMETRY'`（基于顶点几何）、`'ORIGIN'`（仅基于原点） |

**返回**: `tuple[Vector | None, float | None]` — `(包围球中心坐标, 包围球半径)`

#### `all_layer_collections(view_layer)`

返回: `Generator[bpy.types.LayerCollection]` — 广度优先遍历所有层集合（含嵌套）

#### `recur_layer_collection(layer_coll, coll_name)`

返回: `bpy.types.LayerCollection | None` — 递归查找指定名称的层集合

#### `translations`

`dict[str, dict[tuple[str, str], str]]` — 中英文翻译映射表（zh_CN / zh_HANS）

---

### `operators.py` — 操作符

#### `OBJECT_OT_CollToEmpty` *(Collection → Empty)*

| 属性 | 值 |
|------|-----|
| **bl_idname** | `object.coll_to_empty` |
| **bl_label** | `Coll ⇉ Empty` |
| **bl_options** | `{'REGISTER', 'UNDO'}` |

**实例属性（类型注解）**:
- `_oldobjs: list[bpy.types.Object]` — 已转换的对象列表，防重复处理

**方法**:

| 方法 | 说明 |
|------|------|
| `_unhide_ancestor_collections(active_coll, context)` | 递归取消隐藏所有祖先集合 |
| `_find_parent_collection(collection)` | 查找指定集合的直接父集合 |
| `_convert_collection_to_empty(context, collection, scale, parent_coll)` | 递归将集合→空物体，scale 递减（每次 -0.2，最小 0.4） |
| `_is_multi_referenced(collection)` | 检查集合是否被多引用 |
| `execute(context)` | 主入口 |

**转换算法**:
1. 取消隐藏所有祖先集合
2. 用 `for _ in list(children)` 快照迭代子集合（防止死循环）
3. 递归转换每个子集合为 Plain Axes 空物体
4. 转换根集合为 Cube 空物体
5. 计算包围球 → 设置位置和显示大小
6. 重设子对象父级，保持世界坐标
7. 删除原始集合（多引用者保留并移至场景根）

---

#### `OBJECT_OT_EmptyToColl` *(Empty → Collection)*

| 属性 | 值 |
|------|-----|
| **bl_idname** | `object.empty_to_coll` |
| **bl_label** | `Empty ⇉ Coll` |
| **bl_options** | `{'REGISTER', 'UNDO'}` |

**poll**: 要求选中一个空物体且该空物体有子对象

**实例属性（类型注解）**:
- `_empties_to_delete: list[bpy.types.Object]` — 待删除的空物体列表
- `_created_collections: list[str]` — 新创建的集合名称列表

**方法**:

| 方法 | 说明 |
|------|------|
| `_convert_empty_to_collection(parent_empty, parent_coll, color, great_parent_coll)` | 递归将空物体→集合 |
| `_clear_and_delete_empties()` | 先解除子对象父子关系（用 matrix_world 保持世界坐标），再删除空物体 |
| `execute(context)` | 主入口 |

**转换算法**:
1. 从活动空物体开始递归遍历子层级
2. 每个空物体 → 同名集合（顶层紫色 COLOR_04，子级无标签 NONE）
3. 子对象移入新集合，递归处理嵌套空物体
4. 解除所有空物体的父子关系（直接操作 matrix_world，**无 bpy.ops**）
5. 删除空物体，自动选中新集合

---

#### 菜单挂载函数

| 函数 | 挂载到 | 显示条件 |
|------|--------|----------|
| `menu_fn_coll_to_empty(self, context)` | `OUTLINER_MT_collection` | 选中活动层集合，非场景根集合 |
| `menu_fn_empty_to_coll(self, context)` | `OUTLINER_MT_object` | 选中空物体且有子对象 |

---

### `__init__.py` — 注册入口

**职责**: 仅注册/反注册，不包含业务逻辑

**注册流程**（使用 `register_classes_factory`）:

```
1. register_classes_factory 自动注册所有类
2. OUTLINER_MT_collection.prepend(menu_fn_coll_to_empty)
3. OUTLINER_MT_object.prepend(menu_fn_empty_to_coll)
4. bpy.app.translations.register(__package__, utils.translations)
```

**反注册流程**（严格逆序）:

```
1. bpy.app.translations.unregister(__package__)
2. OUTLINER_MT_collection.remove(...)
3. OUTLINER_MT_object.remove(...)
4. register_classes_factory 自动反注册
```

---

## 关键字变更对照 / Key Changes from v1.x

| v1.x 旧版 | v2.0 新版 | 原因 |
|-----------|----------|------|
| `OBJECT_OT_CollToEmpty_70Dbd` | `OBJECT_OT_CollToEmpty` | 简化命名 |
| `object.colltoempty_70dbd` | `object.coll_to_empty` | 标准 bl_idname 格式 |
| `OBJECT_OT_EmptyToColl_70Dbd` | `OBJECT_OT_EmptyToColl` | 简化命名 |
| `object.emptytocoll_70dbd` | `object.empty_to_coll` | 标准 bl_idname 格式 |
| `sna_add_to_outliner_colltoempty_70Dbd` | `menu_fn_coll_to_empty` | 简化命名 |
| `sna_add_to_outliner_emptytocoll_70Dbd` | `menu_fn_empty_to_coll` | 简化命名 |
| `bl_idname = __name__` | `bl_idname = __package__` | 扩展系统兼容 |
| `delect_empt` / `activecol` | `_empties_to_delete` / `_created_collections` | 英文正确性 + 私有约定 |

---

## 数据流 / Data Flow

```
┌──────────────────────────────┐
│    用户在大纲视图右键点击      │
└──────────┬───────────────────┘
           ▼
    ┌──────┴──────┐
    ▼              ▼
Coll ⇉ Empty   Empty ⇉ Coll
    │              │
    ▼              ▼
递归转换集合     递归转换空物体
为空物体层级     为集合层级
    │              │
    ▼              ▼
保持世界坐标     保持世界坐标
包围盒定位       matrix_world 直接操作
    │              │
    ▼              ▼
删除原集合      删除原空物体
(多引用保留)    (无子对象时删除)
    │              │
    ▼              ▼
 完成            完成，选中新集合
```
