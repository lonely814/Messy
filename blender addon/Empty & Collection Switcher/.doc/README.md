# Empty & Collection Switcher

> 空物体与集合相互转换，同时保持父子关系  
> Empty and collection convert to each other while keeping parent-child relationships.

- **Author / 作者**: CP-Design
- **Version / 版本**: 2.0.0
- **Blender**: 4.5 LTS+（兼容 5.x）
- **Category / 分类**: CP
- **Location / 位置**: 大纲视图右键菜单 (Right-click context menu in the Outliner)
- **Format**: 扩展平台格式（`blender_manifest.toml`）+ 传统 `bl_info` 双格式兼容
- **Marketplace**: [Blender Market](https://blendermarket.com/products/empty--collection-switcher)

---

## 概述 / Overview

**Empty & Collection Switcher** 是一个 Blender 插件，用于在大纲视图中快速将 **集合 (Collection)** 与 **空物体 (Empty)** 相互转换，同时完整保留原有的 **父子层级关系 (Parent-Child hierarchy)**。

这在以下场景中尤为有用：

- 当你需要将一个已按集合组织的场景结构转换为空物体层级，以便在动画中使用变换约束或驱动时；
- 当你需要将临时用空物体搭建的层级重新整理为集合结构，以便于场景管理时。

**Empty & Collection Switcher** is a Blender addon that lets you quickly convert **Collections** to **Empty objects** and vice versa from the Outliner's right-click menu, while preserving all parent-child relationships.

---

## 功能特性 / Features

| 操作 | 说明 |
|------|------|
| **Coll ⇉ Empty** | 将选中的集合递归转换为空物体层级，子集合也一并转换 |
| **Empty ⇉ Coll** | 将选中的空物体及其子层级递归转换为集合结构 |

- ✅ 递归处理多层嵌套层级
- ✅ 保留对象的世界坐标变换
- ✅ 自动计算空物体显示大小（基于子对象的包围盒）
- ✅ 支持中英文界面
- ✅ 支持 Undo（撤销）

---

## 安装 / Installation

### 方式一：扩展平台安装（推荐，4.2+）

1. 下载插件文件夹或 ZIP 包。
2. 打开 Blender → **Edit** → **Preferences** → **Add-ons**。
3. 点击右下角下拉菜单，选择 **Install from Repository...** 或拖拽文件夹到插件窗口。
4. 搜索 "Empty & Collection Switcher"，勾选启用。

### 方式二：传统安装（兼容）

1. 下载插件 ZIP 包。
2. 打开 Blender → **Edit** → **Preferences** → **Add-ons**。
3. 点击 **Install legacy Add-on...**，选择 ZIP 文件。
4. 搜索 "Empty & Collection Switcher"，勾选启用。

### 使用

打开 **大纲视图 (Outliner)**，选中一个集合或空物体，右键即可看到菜单项。

---

## 链接 / Links

- [Blender Market](https://blendermarket.com/products/empty--collection-switcher)
- [GitHub](https://github.com/chenpaner)
- [Bilibili](https://space.bilibili.com/2711518)
- [YouTube](https://www.youtube.com/channel/UCb4bdeOqaXHLnSr9HGu63Ew)
