# Dual Addon Search（插件双搜索）开发文档

> 版本：3.3.0
> 作者：loNely
> 兼容：Blender 4.2+

## 1. 定位

插件通过 Monkey-patch 接管 `USERPREF_PT_addons.draw`，增强 Blender 插件管理面板：

- 双搜索框，支持 AND / OR
- 搜索字段语法：`name:`、`author:`、`tag:`、`status:`、`type:`、`path:`、`category:`、`module:`、`-排除`
- 当前结果批量选择与批量启用/禁用
- 星标、标签、排序和筛选
- Profile 保存/恢复启用状态（严格恢复 / 增量启用 + 差异预览）
- 搜索历史
- Markdown / JSON 快照导出
- 可选快捷键精确搜索
- 卸载后自动清理标签、星标和 Profile 残留

不再提供：健康概览、GitHub 统计、启动耗时统计。

## 2. 模块

| 路径 | 作用 |
|---|---|
| `__init__.py` | 注册入口、AddonPreferences、WM 属性、Keymap patch |
| `panels/addon_list.py` | 插件面板绘制、原生面板 patch、自愈和恢复 |
| `operators/` | 搜索、标签、星标、批量、Profile、导出、卸载、诊断操作器 |
| `data/tags.py` | 标签与星标持久化 |
| `data/history.py` | 0.8 秒防抖搜索历史持久化 |
| `data/profiles.py` | Profile 持久化 |
| `data/json_store.py` | JSON 读取和临时文件原子替换 |
| `utils/search.py` | 普通关键词与字段语法匹配 |
| `operators/batch.py` | 当前可见结果的批量选择与启用/禁用 |
| `utils/cache.py` | 插件列表、搜索文本、标签缓存 |
| `utils/addon_info.py` | 插件路径、来源和版本信息 |
| `blender_manifest.toml` | Extensions Platform 元数据和权限 |
| `tests/smoke_test.py` | Blender 后台注册/注销与持久化 smoke test |

## 3. Patch 生命周期

注册：

1. 注册类。
2. 注册 `WindowManager` 属性。
3. 保存原生 `USERPREF_PT_addons.draw`。
4. 替换为 `_safe_patched_addons_draw`。
5. 按用户设置决定是否 patch `rna_keymap_ui.draw_keymaps`。

任何注册步骤异常时，已完成步骤逆序回滚。

Blender 4.2+ 的 `bl_pkg` 可能通过 `Panel.append()` 重建动态分发器。`_self_heal_patch()` 检测该状态并重新接管；`load_post` handler 使用 `@persistent`，加载其他 `.blend` 后仍有效。注销时剔除自身函数并恢复原生 draw。

Keymap patch 维护成本高，默认关闭。偏好设置开关会在当前会话即时 patch/unpatch。

## 4. 搜索与批量

搜索词用空格分隔，词之间为 AND，均支持 `-` 前缀排除，`"完整短语"` 保留空格。

```text
name:node status:enabled tag:建模 -author:test
```

可用字段：`name` `author` `tag` `status` `type` `path` `category` `description` `location` `module`。
`status` 取值 `enabled` / `disabled`；`type` 取值 `local` / `extension` / `builtin`。

批量选择只作用于当前可见结果。列表底部提供“全选当前结果”、启用、禁用、清空；操作前弹窗确认，失败模块在报告和系统控制台列出。本插件自身永远不会被批量操作或 Profile 关闭。

## 5. 绘制约束

`draw()` 高频执行，禁止：

- 网络请求
- 写磁盘
- 扫描无缓存的大目录
- 修改持久状态

插件列表缓存 TTL 为 3 秒。搜索文本和模块路径随列表刷新清空。

嵌入其他插件的 AddonPreferences 时跟随 Blender 原生方式：

```python
prefs_class = type(addon_preferences)
prefs_class.layout = box
try:
    addon_preferences.draw(context)
finally:
    del prefs_class.layout
```

## 5. 数据

数据位于 `bpy.utils.user_resource("SCRIPTS")`：

- `dual_addon_tags.json`
- `dual_addon_search_history.json`
- `dual_addon_profiles.json`

写入统一经 `data/json_store.py`：先写 `.tmp`，`flush + fsync`，再用 `os.replace()` 原子替换。写入失败必须由操作器报告，不能静默显示成功。

搜索历史只保存输入稳定 0.8 秒后的完整词；插件注销前刷新待保存内容。

Profile 和“一键关闭非收藏”始终排除本插件自身，防止操作器执行中自我注销。

## 6. Manifest 权限

```toml
[permissions]
clipboard = "Copy exported add-on snapshots"
files = "Store tags, profiles, history, and exported snapshots"
```

插件不联网，不声明 `network`。新增网络功能前必须先确认必要性，且不得在 UI `draw()` 内同步联网。

## 7. 发布

版本号唯一来源：`build.py` 顶部 `VERSION`。

```bash
python build.py --sync
python build.py
python build.py --package
```

官方 Manifest 校验：

```bash
"D:/Blender/stable/blender/blender.exe" --factory-startup --command extension validate
```

Blender smoke test：

```bash
"D:/Blender/stable/blender/blender.exe" \
  --background --factory-startup --python-exit-code 1 \
  --python "S:/Messy/blender addon/dual_addon_search/tests/smoke_test.py"
```

发布前必须同时通过 Python 语法、版本一致性、官方 Manifest 校验、Blender smoke test。

## 8. 版本历史

| 版本 | 变更 |
|---|---|
| 3.3.0 | 新增搜索字段语法（name/author/tag/status/type/path/category/description/location/module 与 `-` 排除）；新增当前可见结果的批量选择与批量启用/禁用；Profile 加载前差异预览并支持严格恢复/增量启用，失败模块单独上报；卸载后清理标签、星标和 Profile 残留；筛选阶段每行只计算一次模块信息 |
| 3.2.0 | 修复 Manifest；删除 UI 同步 GitHub 请求和无效关联功能；修正 AddonPreferences layout 注入；搜索历史防抖持久化；JSON 原子写入及错误上报；Profile 防止关闭自身；Keymap patch 默认关闭且即时切换；注册失败回滚；删除不准确启动耗时功能；新增 Blender smoke test |
| 3.1.0 | 面板动态分发器自愈、面板状态诊断 |
| 3.0.0 | 模块化重构、Profile、搜索历史、标签缓存、原生筛选兼容 |
| 2.0.0 | Extensions Platform 兼容、标签/星标、导出 |
