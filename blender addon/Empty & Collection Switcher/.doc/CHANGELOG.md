# 版本历史 / Changelog

## v2.0.0

### 架构变更

- 模块化重构：`utils.py`（工具函数）+ `operators.py`（操作符）+ `__init__.py`（注册入口）
- 新增 `blender_manifest.toml`，支持 Blender 扩展平台（4.2+）
- 保留 `bl_info` 实现双格式兼容（扩展平台 + 传统安装）

### Bug 修复

- **修复变量遮蔽 Bug**：`delect_empt_method` 中循环变量 `obj` 被内层 `for` 覆盖，导致删错对象
- **修复潜在死循环**：`while active_col.children` → `for _ in list(...)` 快照迭代
- **修复 GitHub URL**：拼接错误导致无效链接
- **替换 bare except**：所有 `except:` 改为 `except Exception` 并添加 `self.report()`
- **移除循环内 `bpy.ops`**：`parent_clear` 改为直接操作 `matrix_world`
- **移除死代码**：`if not (False)` 和未使用变量 `layer_coll`
- **修复危险默认参数**：`context=bpy.context` 改为 `context=None`

### 6 条硬约束合规

- 遵守 **循环内不用 bpy.ops**
- 遵守 **blender_manifest.toml**（同时保留 bl_info 双格式）
- 遵守 **props 类型注解** + **context 判空**
- 所有 `bpy.context` 访问统一为参数 `context`

## v1.1.0

- 改进空物体显示大小计算，根据子对象包围盒自动适配
- 优化集合转换时的可见性处理（自动取消排除和隐藏）
- 完善多引用集合的处理逻辑（`isinstance` 检测与警告）

## v1.0.0

- 首次发布
- 实现 **Coll ⇉ Empty**：集合递归转换为空物体层级
- 实现 **Empty ⇉ Coll**：空物体递归转换为集合层级
- 支援中英文双语界面
- 集成 Blender 大纲视图右键菜单
- 支持 Undo 撤销操作
