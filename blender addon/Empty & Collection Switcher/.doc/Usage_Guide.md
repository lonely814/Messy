# 使用指南 / Usage Guide

## 目录 / Contents

1. [基本操作 / Basic Operations](#1-基本操作--basic-operations)
2. [集合转空物体 (Coll ⇉ Empty)](#2-集合转空物体-coll--empty)
3. [空物体转集合 (Empty ⇉ Coll)](#3-空物体转集合-empty--coll)
4. [操作示例 / Examples](#4-操作示例--examples)
5. [常见问题 / FAQ](#5-常见问题--faq)

---

## 1. 基本操作 / Basic Operations

所有操作均从 **大纲视图 (Outliner)** 的右键菜单发起。

### 打开大纲视图

- 在 Blender 窗口右上角点击 **Outliner** 标签，或按 `Shift + F9`。
- 确保视图模式为 **场景 (Scene)** 或 **视图层 (View Layer)**，以便看到集合与对象。

### 右键菜单入口

插件会在以下两个菜单中各添加一项：

| 菜单 | 添加的操作 | 触发条件 |
|------|-----------|----------|
| 集合右键菜单 `OUTLINER_MT_collection` | **Coll ⇉ Empty** | 选中的集合为当前活动层集合，且非场景根集合 |
| 对象右键菜单 `OUTLINER_MT_object` | **Empty ⇉ Coll** | 选中一个空物体，且该空物体有子对象 |

---

## 2. 集合转空物体 (Coll ⇉ Empty)

**菜单项**: `Coll ⇉ Empty`  
**运算符 ID**: `OBJECT_OT_CollToEmpty_70Dbd`

### 功能说明

将当前活动层集合（Active Layer Collection）递归转换为空物体层级：

- 最外层集合 → 一个 **Cube 类型** 的空物体（显示名称为集合原名）
- 每个内层子集合 → 一个 **Plain Axes 类型** 的空物体（大小逐层递减）
- 原本属于该集合的对象 → 成为对应空物体的子对象
- 对象的 **世界坐标位置保持不变**
- 空物体的位置自动设为所有子对象的 **包围盒中心**
- 空物体的显示大小自动设为 **包围球半径**

### 操作步骤

1. 打开 **大纲视图 (Outliner)**。
2. 选中一个 **集合 (Collection)**，确保其左侧无灰色斜线（即未被排除）。
3. **右键点击** 该集合，在弹出的菜单中找到 **Coll ⇉ Empty**。
4. 点击执行。插件会自动递归处理所有子集合。
5. 完成后，原始集合被删除，所有对象重新挂接到新创建的空物体层级下。

### 注意事项

- 如果某个集合被多个父集合引用（`users > 1`）或启用了 `Use Fake User`，转换时该集合**不会被删除**，仅从当前父集合解除链接，并移至场景根集合下，同时弹出警告信息 `[集合名] collection is isinstance!`。
- 活动层集合必须 **不是** 场景根集合（`Scene Collection`）。

---

## 3. 空物体转集合 (Empty ⇉ Coll)

**菜单项**: `Empty ⇉ Coll`  
**运算符 ID**: `OBJECT_OT_EmptyToColl_70Dbd`

### 功能说明

将选中的活动空物体递归转换为集合层级：

- 最外层空物体 → 一个 **紫色 (COLOR_04)** 的集合
- 每个子空物体（递归）→ 一个 **无颜色标签** 的集合
- 原本属于该空物体的子对象 → 成为对应集合中的成员
- 转换完成后，原始空物体被删除
- 最后自动选中新创建的顶层集合

### 操作步骤

1. 打开 **大纲视图 (Outliner)**。
2. 选中一个 **空物体 (Empty)**，且该空物体至少有一个子对象。
3. **右键点击** 该空物体，在弹出的菜单中找到 **Empty ⇉ Coll**。
4. 点击执行。插件会自动递归处理所有子空物体。
5. 完成后，原始空物体被删除，所有对象被组织到新的集合层级中。

### 注意事项

- 目标空物体 **必须有子对象**（`poll` 方法检查 `context.active_object.children` 非空）。
- 转换过程中，子对象先解除与空物体的父子关系（`Clear Keep Transform`），再被加入新集合。

---

## 4. 操作示例 / Examples

### 示例 1：集合层级 → 空物体层级

**原始结构**：
```
Scene Collection
└── 家具 (Collection)
    ├── 椅子 (Collection)
    │   ├── 椅背 (Mesh)
    │   └── 椅座 (Mesh)
    └── 桌子 (Collection)
        └── 桌面 (Mesh)
```

**操作**：在「家具」集合上右键 → **Coll ⇉ Empty**

**结果**：
```
Scene Collection
└── 家具 (Empty, Cube, 大小自动)
    └── 椅子 (Empty, Plain Axes, 较小)
        ├── 椅背 (Mesh, 父级=椅子)
        └── 椅座 (Mesh, 父级=椅子)
    └── 桌子 (Empty, Plain Axes, 较小)
        └── 桌面 (Mesh, 父级=桌子)
```

### 示例 2：空物体层级 → 集合层级

**原始结构**：
```
Scene Collection
└── 角色 (Empty)
    ├── 头部 (Empty)
    │   └── 头部网格 (Mesh)
    └── 身体 (Empty)
        └── 身体网格 (Mesh)
```

**操作**：选中「角色」空物体 → 右键 → **Empty ⇉ Coll**

**结果**：
```
Scene Collection
└── 角色 (Collection, 紫色)
    ├── 头部 (Collection)
    │   └── 头部网格 (Mesh)
    └── 身体 (Collection)
        └── 身体网格 (Mesh)
```

---

## 5. 常见问题 / FAQ

**Q: 右键菜单没有看到插件选项？**  
A: 检查是否已启用插件（Preferences → Add-ons），以及是否满足触发条件：
- Coll ⇉ Empty：需要在大纲视图的**集合上**右键，且该集合是活动层集合，不能是 Scene Collection。
- Empty ⇉ Coll：需要选中**空物体**且该空物体有子对象。

**Q: 转换后对象位置变了？**  
A: 插件会保持对象的世界坐标。如果发现位置偏移，请检查是否有约束或驱动影响。

**Q: 某个集合没有在转换后被删除？**  
A: 该集合可能被多个父集合引用（isinstance），插件会保留它并移到场景根集合下。可手动删除。

**Q: 支持 Undo 吗？**  
A: 支持。两个运算符均注册了 `UNDO` 选项，可以使用 `Ctrl+Z` 撤销。
