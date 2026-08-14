# Dual Addon Search (插件双搜索) — 开发文档

> 文件：`__init__.py` + `blender_manifest.toml`
> 版本：3.0.1
> 作者：loNely
> 兼容：Blender 4.2+

---

## 一、架构总览

本插件通过 **Monkey-patch** 替换 Blender 原生插件面板的 `draw` 方法，在原生面板基础上叠加搜索、筛选、批量操作等功能，而不是重写整个面板。

### 数据流

```
Blender 重绘 Preferences 面板
  → USERPREF_PT_addons.draw()
    → _safe_patched_addons_draw()      ← 外层兜底（异常捕获 + 回退原生）
      → _patched_addons_draw()          ← 核心绘制逻辑
        → 获取 addon_utils.modules()     ← 所有可用插件
        → 排序 → 过滤 → 逐行绘制
```

### 文件模块划分

`__init__.py` 作为入口 + AddonPreferences + 键位映射 Patch，其余逻辑拆分到子模块；`blender_manifest.toml` 是扩展平台元数据：

| 文件模块 | 说明 |
|---------|------|
| `__init__.py` | 入口：AddonPreferences、WM 属性注册、register/unregister、键位映射 Patch |
| `panels/addon_list.py` | 核心绘制：`_patched_addons_draw()` 替换原生插件面板 draw |
| `operators/search.py` | 搜索操作符：清空、切换模式、搜索历史 |
| `operators/addon_ops.py` | 插件操作：卸载/删除、打开文件夹、Google 搜索、右键菜单、复制 |
| `operators/tags.py` | 标签操作符：切换、新建、删除、筛选、菜单 |
| `operators/star.py` | 星标收藏操作符 |
| `operators/profile.py` | Profile 操作符：保存/加载/删除、一键关闭非收藏 |
| `operators/export.py` | 导出操作符：Markdown / JSON |
| `operators/keymap.py` | 快捷键捕获操作符 + 工具函数 |
| `data/tags.py` | 标签/星标 JSON 持久化：加载/保存/筛选 |
| `data/history.py` | 搜索历史 JSON 持久化 |
| `data/profiles.py` | Profile JSON 持久化 |
| `data/boot_profiler.py` | **启动耗时统计**：load_post handler 测量 + 历史记录 |
| `utils/cache.py` | 缓存管理：模块文件、搜索 haystack、插件列表、标签缓存 |
| `utils/search.py` | 双搜索匹配：AND/OR 模式 |
| `utils/i18n.py` | 中英文切换 |
| `utils/ui_helpers.py` | UI 工具：重绘、安全取值、分隔符、`warn_once()` |
| `utils/addon_info.py` | 插件信息工具：来源检测、类型文本、版本格式化 |

---

## 二、Monkey-patch 机制

### 原理

```python
panel_cls = bl_ui.space_userpref.USERPREF_PT_addons
_ORIGINAL_ADDONS_DRAW = panel_cls.draw          # 1. 保存原生 draw
panel_cls.draw = _safe_patched_addons_draw       # 2. 替换为包装 draw

# 注销时：
panel_cls.draw = _ORIGINAL_ADDONS_DRAW           # 3. 恢复原生 draw
```

### 安全兜底

`_safe_patched_addons_draw()` 用 `try/except` 包裹整个绘制流程：

- 异常时 **回退到原生 draw**（`_ORIGINAL_ADDONS_DRAW`）
- **10 秒错误节流**：同一错误 10 秒内只打印一次，不刷屏
- 错误信息输出到 Blender 系统控制台

### 多实例保护

`_IS_PATCHED` 标志防止重复 patch，`_patch_addons_panel()` 可重复调用而不会多层嵌套。

### 动态分发器兼容（4.2+ 扩展系统 / bl_pkg）

Blender 4.2+ 面板 draw 支持动态追加（`panel.append`）。内置扩展系统 `bl_pkg`
启动时会执行 `USERPREF_PT_addons.append(addons_panel_draw)`（原生搜索框 + 原生列表），
把面板 draw 变成动态分发器。

**已知坑**：若本插件（作为扩展）在 `prefs.addons` 中的启用顺序排在 `bl_pkg` 之前，
`bl_pkg` 的 `append()` 会把本插件的绘制函数包进分发器：

```
USERPREF_PT_addons.draw._draw_funcs = [本插件, addons_panel_draw]
```

导致每次绘制都在面板底部重复渲染原生搜索框和原生列表（表现为"底部出现第二组搜索框"）。

**对策**（`panels/addon_list.py`）：
- `_self_heal_patch()`：绘制前检测面板 draw 是否被包成动态分发器，若是则重新替换为
  本插件函数，并同步更新 `_ORIGINAL_ADDONS_DRAW` 引用。
- `_on_load_post_self_heal`：注册 `load_post` handler，启动完成后立即自愈，
  避免面板首次打开时出现一次双重绘制闪烁。
- `unpatch_addons_panel()`：恢复面板时先把本插件函数从分发器中剔除，避免注销后
  本插件的绘制仍被执行。
- 另外，绘制异常时若已写入自定义内容（`_DRAW_LAYOUT_WRITTEN`），不再回退追加原生面板
  （否则同样会造成底部重复搜索框），只显示错误提示。

---

## 三、WindowManager 属性总表

所有属性在 `register()` 中注册，`unregister()` 中清理。

| 属性名 | 类型 | 用途 |
|--------|------|------|
| `addon_search` | StringProperty | Blender 原生，第一搜索框 |
| `dual_addon_search_second` | StringProperty | 第二搜索框 |
| `dual_enable_keymap` | BoolProperty (AddonPreferences) | 键位映射快捷键搜索启用开关 |
| `dual_addon_search_mode` | EnumProperty | AND / OR 匹配模式 |
| `dual_ctx_module` | StringProperty | 右键菜单上下文：模块名 |
| `dual_ctx_name` | StringProperty | 右键菜单上下文：插件名 |
| `dual_ctx_author` | StringProperty | 右键菜单上下文：作者 |
| `dual_ctx_file` | StringProperty | 右键菜单上下文：文件路径 |
| `dual_ctx_doc_url` | StringProperty | 右键菜单上下文：网站 URL |
| `dual_tag_filter` | StringProperty | 当前标签筛选值 |
| `dual_show_description` | BoolProperty | 双行显示开关 |
| `dual_addon_sort_mode` | EnumProperty | 排序模式（星标优先/名称/版本等） |
| `dual_keymap_capture_active` | BoolProperty | 快捷键捕获 modal 状态（SKIP_SAVE） |
| `dual_keymap_exact_enabled` | BoolProperty | 快捷键精确匹配开关 |
| `dual_keymap_exact_text` | StringProperty | 捕获到的快捷键文本（SKIP_SAVE） |
| `dual_keymap_exact_signature` | StringProperty | 捕获到的快捷键签名（SKIP_SAVE） |

---

## 四、功能清单

### 4.1 双搜索（核心）

- 两个搜索框并列，中间有 AND/OR 切换按钮（`[搜索1] [且/或] [搜索2]`）
- 搜索范围：插件名、模块名、作者、分类、描述、文件路径
- 匹配方式：AND（同时命中）、OR（任一命中）

### 4.2 来源图标

`_draw_addon_source_icon()` 在插件名尾部显示图标：
- 官方插件 → Blender 图标
- 扩展插件 → 扩展标记
- 用户安装 → 用户标记

### 4.3 排序

- 星标优先（默认）
- 名称 A-Z / 名称 Z-A
- 已启用优先 / 已禁用优先
- 版本号（从高到低）

### 4.4 批量操作

- 每行左侧复选框（勾选）
- 底部批量操作栏：批量启用、批量禁用、清空选择

### 4.5 右键菜单

每行右侧 `▼` 按钮弹出菜单：
- 复制名称 / 复制模块名 / 复制作者
- Google 搜索
- 打开文件夹
- 打开网站
- 启用/禁用

### 4.6 星标收藏

- 每行星标按钮 ⭐（`SOLO_ON` / `SOLO_OFF` 图标）
- 数据持久化到 `dual_addon_tags.json` 的 `__starred__` 键
- 默认排序模式为星标优先

### 4.7 标签系统

- 右键菜单 → 标签管理：勾选/取消标签
- 顶部标签筛选下拉
- 每行显示标签气泡（最多 3 个）
- 数据持久化到 `dual_addon_tags.json`

### 4.8 导出快照

- Markdown 格式 → 复制到剪贴板
- JSON 格式 → 保存到文件

### 4.9 搜索结果计数

面板底部显示：`显示 12 / 共 248 个插件 (已启用 35)`

### 4.10 文件信息

展开插件详情后显示：`1.2 MB · 2025-06-15 14:30`

### 4.11 双行显示

顶部 ≡ 按钮切换，开启后每行显示两行：插件名 + 描述

### 4.12 插件删除

- 支持普通插件和扩展插件的删除
- 安全保护：只读文件自动 chmod、符号链接保护、.zip 路径拒绝
- PermissionError 友好提示

### 4.13 Google 搜索

展开详情右上角 🌐 按钮，按 `插件名 + 作者 + Blender` 跳转 Google 搜索

### 4.14 搜索历史 (v2.0.0)

工具栏时钟图标下拉菜单，记录最近 20 次搜索词。持久化到 `dual_addon_search_history.json`，重启不清空。

### 4.15 原生分类筛选 (v3.0.0)

工具栏增加 `addon_filter` 原生分类下拉（All / Enabled / Disabled / User / 各分类），与原生面板行为一致。

### 4.16 Profile 系统 (v2.0.0)

工具栏文件图标下拉菜单：
- **保存 Profile**：记录当前所有已启用插件快照
- **加载 Profile**：启用/禁用插件匹配快照状态
- **删除 Profile**：移除已保存的快照

数据持久化到 `dual_addon_profiles.json`。

### 4.17 一键关闭非收藏 (v2.0.0)

工具栏星标图标按钮，停用所有未被星标收藏的插件（星标插件不动）。确认对话框防止误触。

---

## 五、标签/星标数据存储

### 文件位置

```
{bpy.utils.user_resource("SCRIPTS")}/dual_addon_tags.json
```

### 数据格式

```json
{
  "__starred__": ["node_wrangler", "n_panel_sub_tabs"],
  "node_wrangler": ["常用", "必备"],
  "some_addon": ["测试中"]
}
```

- `__starred__` 键：星标收藏列表
- 其他键：插件模块名 → 标签列表

### 工具函数

| 函数 | 说明 |
|------|------|
| `_tag_load()` | 从文件加载全部数据 |
| `_tag_save(data)` | 保存到文件（自动创建目录） |
| `_tag_get(module)` | 获取某插件的标签列表 |
| `_tag_set(module, tags)` | 设置某插件的标签 |
| `_tag_all_names()` | 获取所有标签名（去重排序） |
| `_tag_addons_with_tag(tag)` | 获取打了某标签的所有插件 |
| `_starred_load()` | 加载星标列表 |
| `_starred_toggle(module)` | 切换星标状态 |

---

## 六、Operator 一览

| bl_idname | 类 | 功能 |
|-----------|-----|------|
| `dual_firstrow_addon_search.clear` | `OT_clear_search` | 清空两个搜索框 |
| `dual_firstrow_addon_search.open_folder` | `OT_open_addon_folder` | 打开插件所在文件夹 |
| `dual_firstrow_addon_search.remove` | `OT_remove_addon` | 移除插件 |
| `dual_firstrow_addon_search.google_search` | `OT_google_search` | Google 搜索插件 |
| `dual_firstrow_addon_search.context_menu` | `OT_context_menu` | 打开右键菜单 |
| `dual_firstrow_addon_search.copy_text` | `OT_copy_text` | 复制文字到剪贴板 |
| `dual_firstrow_addon_search.toggle_select` | `OT_toggle_select` | 勾选/取消批量选择 |
| `dual_firstrow_addon_search.batch_enable` | `OT_batch_enable` | 批量启用 |
| `dual_firstrow_addon_search.batch_disable` | `OT_batch_disable` | 批量禁用 |
| `dual_firstrow_addon_search.batch_clear` | `OT_batch_clear` | 清空批量选择 |
| `dual_firstrow_addon_search.export_snapshot_md` | `OT_export_snapshot_markdown` | 导出 Markdown 快照 |
| `dual_firstrow_addon_search.export_snapshot_json` | `OT_export_snapshot_json` | 导出 JSON 快照 |
| `dual_firstrow_addon_search.star_toggle` | `OT_star_toggle` | 切换星标 |
| `dual_firstrow_addon_search.toggle_mode` | `OT_toggle_search_mode` | 切换 AND/OR |
| `dual_firstrow_addon_search.tag_toggle` | `OT_tag_toggle` | 切换标签 |
| `dual_firstrow_addon_search.tag_add_new` | `OT_tag_add_new` | 新建标签 |
| `dual_firstrow_addon_search.tag_remove_global` | `OT_tag_remove_global` | 删除标签（全局） |
| `dual_firstrow_addon_search.tag_set_filter` | `OT_tag_set_filter` | 设置标签筛选 |

### Menu 类一览

| bl_idname | 类 | 用途 |
|-----------|-----|------|
| `DUAL_FIRSTROW_MT_addon_actions` | `MT_addon_actions` | 右键操作菜单 |
| `DUAL_FIRSTROW_MT_tag_menu` | `MT_tag_menu` | 标签管理子菜单 |
| `DUAL_FIRSTROW_MT_tag_filter_menu` | `MT_tag_filter_menu` | 标签筛选下拉 |
| `DUAL_FIRSTROW_MT_export_menu` | `MT_export_menu` | 导出快照下拉 |

---

## 七、缓存策略

### 两个全局缓存

```python
_CACHE_MODULE_FILE = {}   # mod.__name__ → 文件路径
_CACHE_HAYSTACK = {}      # mod.__name__ → 搜索文本（合并后的字符串）
```

### 失效时机

- **注册时**：`register()` 中 `clear()` 两者
- **移除插件时**：`OT_remove_addon.execute()` 中 `clear()` 两者
- **日常使用**：只增不减，注册和卸载时清空即可

### 标签/星标缓存

```python
_TAG_CACHE = {}          # _tag_load() 的内存缓存
_TAG_CACHE_DIRTY = True  # 数据是否已修改
_ADDONS_CACHE = []       # addons = [(mod, info), ...] 列表缓存
_ADDONS_CACHE_TIME = 0.0 # 时间戳，3 秒 TTL
```

- `_tag_load()` 从磁盘读取一次后缓存到内存，后续返回缓存
- `_tag_save()` 写入磁盘的同时更新内存缓存，标记为干净
- `_ADDONS_CACHE` 在 `_patched_addons_draw` 中使用，3 秒内重复绘制直接走缓存
- 避免在面板重绘时反复读磁盘 JSON 和扫描所有插件模块
    - 标签修改后，操作符调用  将  置 True，下次绘制自动重读磁盘
    - 标签/星标数据读写通过 `_TAG_CACHE` / `_TAG_CACHE_DIRTY` 参数透传（`panels/addon_list.py`），或通过 `_mark_tag_dirty()` 脏标记机制（`operators/tags.py`）

---

## 八、开发指南

### 添加新功能

1. **新增 Operator**：在 `operators/` 下添加新类 → 在 `__init__.py` 中 import 并加入 `classes` 元组
2. **新增 UI 元素**：在 `panels/addon_list.py` 的 `_patched_addons_draw()` 中适当的绘制位置添加
3. **新增 WM 属性**：在 `__init__.py` 的 `_register_wm_properties()` 中添加 → `_unregister_wm_properties()` 中清理
4. **新增 Menu**：在对应模块添加 Menu 类 → 在 `__init__.py` 中 import 并加入 `classes` 元组

### Extensions Platform 注意事项

`blender_manifest.toml` 是 Blender 5.x 扩展平台的源文件。当两者同时存在时，
Blender 优先使用 manifest。`bl_info` 保留用于 4.2 LTS 向后兼容。

manifest 验证常见陷阱：
- `id` 必须是有效的 Python 标识符（不能用连字符、空格、数字开头）
- `tagline` 最长 64 字符，且不能以句号结尾
- `license` 和 `copyright` 是字符串数组，非裸字符串
- `tags` 必须在 Blender 官方标签列表中

详情见 Blender 手册：
https://docs.blender.org/manual/en/latest/advanced/extensions/index.html

### 新增工具函数

#### `_batch_selected_names(wm) → set[str]`

取代原先重复的 `raw.split(",")` 脆皮模式。返回无序集合，消除重复元素风险。

```python
# 之前（重复 5 次）：
raw = getattr(wm, "dual_batch_selected", "")
names = [n.strip() for n in raw.split(",") if n.strip()]

# 之后：
names = _batch_selected_names(wm)
```

#### `_batch_selected_save(wm, names)`

统一写入入口，自动排序保证序列化一致性。

#### `_warn_once(tag, message)`

一次性警告，用于本应报告错误但被 `except: pass` 的地方。首次触发打印到
Blender 控制台，后续同 tag 调用静默。命名空间用函数名作为 tag。

### 重复注册保护

`_IS_REGISTERED` 标志防止 Blender 文本编辑器热重载（F8）时 `register()` 被
重复调用导致崩溃。`unregister()` 同理。

### 命名规范

- Operator 类名：`DUAL_FIRSTROW_OT_<name>`
- Menu 类名：`DUAL_FIRSTROW_MT_<name>`
- bl_idname：`dual_firstrow_addon_search.<action_name>`
- 工具函数：`_<name>()`（下划线前缀表示内部使用）

### 打包发布

1. 修改版本号 (`bl_info["version"]`)
2. 如果改了名称/描述，同步更新 `bl_info["name"]` / `"description"` / `"location"`
3. 删除 `__pycache__/` 后再打包

### 调试技巧

- 打开 Blender 系统控制台（`窗口 > 切换系统控制台`）查看错误输出
- `_redraw_preferences()` 强制重绘插件面板
- `_safe_patched_addons_draw` 的异常会被捕获并打印 `[Dual Add-on Search] draw error` 字样

---

## 九、版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 3.1.0 | — | 启动耗时统计板块、标签即时生效脏标记机制、删除批量勾选/星标/PRO配置等派生功能、优化权限声明文件 |
| 3.0.1 | — | **修复**：bl_pkg 动态分发器导致的面板底部重复出现第二组搜索框（自愈机制 + load_post 提前自愈 + 注销时剔除分发器残留）；绘制异常且已写入内容时不再回退追加原生面板（避免重复渲染）只显示错误提示；**其他**：作者署名统一为 loNely |
| 3.0.0 | — | **模块化重构**：拆分单文件为 `panels/`、`operators/`、`data/`、`utils/` 子模块，`register_classes_factory` 模式；**移除**：健康概览；**修复**：首选项面板内容丢失、扩展卸载回归、搜索历史记录、展开详情嵌入、标签/星标磁盘 I/O 优化、键位映射精确匹配回归；**性能**：`history_record()` 纯内存不写盘、标签缓存参数透传避免每次绘制读盘、缓存 TTL 1s→3s、原生 `addon_filter` / `addon_support` 过滤减少循环量 |
| 2.0.0 | — | **扩展平台兼容**：新增 `blender_manifest.toml`，可提交官方扩展平台；**新功能**：搜索历史、插件健康概览(警告/版本/冲突)、Profile 快照系统、一键关闭非收藏；**性能**：`_T()` 语言缓存，`_get_health_report()`/`_detect_addon_conflicts()` TTL 缓存；**健壮性**：`_batch_selected_names()`/`_batch_selected_save()` 替代脆弱逗号分割、`_IS_REGISTERED` 防重复注册/注销；**可调试性**：`_warn_once()` 替代静默 `except: pass`，暴露被吞掉的异常 |
