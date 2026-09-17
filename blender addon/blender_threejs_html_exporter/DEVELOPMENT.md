# 开发要点

本文档提炼插件开发过程中的关键设计决策与踩坑记录，供后续维护参考。当前版本 2.9.0。

## 架构

- 单文件插件（`__init__.py`），HTML 模板以 `r'''...'''` 内嵌，无构建链、无外部 Python 依赖。
- 导出流程：Blender glTF 导出器 → 临时 GLB → Base64 → 注入 HTML 模板 → 写盘。
- 参数双入口：文件菜单对话框（操作器自身属性）与 N 面板侧边栏（`HTML3D_Settings` 挂 `bpy.types.Scene.html3d_settings`，随 .blend 持久化），面板导出走 `EXEC_DEFAULT` 转调主操作器。

## 模板占位符

使用标准库 `string.Template`，模板里写 `${name}`，注入用 `Template(HTML_TEMPLATE).substitute(...)`。

- **模板里单写花括号即可**，不要再用 `{{ }}` 转义，也不需要 `str.replace` 链——注入内容（base64、importmap JSON）里的花括号本来就不会被碰。
- **模板里的裸 `$` 必须写成 `$$`**。JS/正则里的 `$` 最容易踩：`replace(/\\.html?$/i, '')` 会被当成占位符而报 `Invalid placeholder`，需写作 `/\\.html?$$/i`。
- 占位符名写错会在 `substitute` 时直接报错（`KeyError`），比静默注入空串好；如要容错可用 `safe_substitute`。

## 离线内嵌运行库

- 运行库版本集中在 `THREE_VERSION` / `THREE_CDN`；下载入口 `_fetch_runtime`，缓存门面 `_download_runtime`。
- **磁盘缓存**：`<user>/cache/threejs_html_exporter/<RUNTIME_CACHE_ID>/`。首次冷启 ~3s，之后命中缓存 ~0s。改了下载或相对导入改写逻辑后 **必须递增 `RUNTIME_CACHE_ID`**（形如 `three-0.160.0-r2`），否则会读回旧缓存。
- **并行下载**：依赖图按层展开，同层用 `ThreadPoolExecutor(max_workers=8)` 并发。串行实现实测 25s，并行 ~3s。
- 单个 URL 失败重试 3 次（jsDelivr 在中国大陆偶发失败）。
- `register()` 会调用 `_prune_runtime_cache()` 只留最近 3 个缓存目录。
- 递归下载 `examples/jsm` 依赖，**相对导入必须改写为 importmap 裸标识符**：data: URL 模块没有基准 URL，`import './x.js'` 无法解析。
- 依赖发现与守卫正则限定在 `(?:from|import)\s*['\"]` 上下文——宽松匹配任意引号字符串会误伤代码内普通路径并 404。
- 正则捕获组：`from 'path'` 有两个组，路径是 `group(2)` 不是 `group(1)`（曾因此产生 `from ''` 语法错误）。
- 任何未处理的相对引用 → 抛错 → 回退 CDN 并 `WARNING`，不产出静默坏文件。
- SAO 后处理链共 10+ 个文件（EffectComposer/RenderPass/ShaderPass/OutputPass/SAOPass/Pass/MaskPass + 3 个 Shader），全部走同一条管道。

## 环境光照

- 世界环境：临时 Cycles 场景 + PANO 相机渲染 512×256 equirect JPEG（几十 KB），`bpy.context.temp_override(scene=tmp)` 后台渲染，`try/finally` 清理。
- 查看器：世界全景图优先，失败回退 `RoomEnvironment`（r160 亮度偏暗，需 `envMapIntensity = 2.0` 补偿，已做成导出选项）。
- 金属死黑排查顺序：base color（金属 F0 由它决定）→ environment_lighting 开关 → roughness=1 无镜面 → 环境强度。

## SSAO 后处理

- `EffectComposer + RenderPass + SAOPass + OutputPass`；`OutputPass` 负责色调映射输出，缺了会发灰。
- 相机切换（透视/正交）必须同步 `renderPass.camera` 与 `saoPass.camera`。
- `saoKernelRadius` 是世界单位，跟随模型尺寸（`maxDim * 0.06`）。
- `window.__viewer = {renderer, scene, camera}` 调试句柄：**module 作用域变量从 CDP evaluate 不可见**，有了句柄才能量化测亮度（readPixels 中心区均值）。

## 侧边栏 UI

- 高级感三件套：`bl_parent_id` 可折叠子面板、`use_property_split = True` 双列布局、条件置灰（未启用的功能灰掉其参数）。
- 子面板图标用 `draw_header` + `layout.label(icon=...)`。
- 数值调参用 `slider=True`。

## 测试策略

- `tests/smoke_test.py`：Blender 后台导出动画立方体，校验内嵌 GLB 结构、importmap、世界环境、AO 标志、截图走 composer、空选中被拦下、原子写无残留、面板导出与 `webbrowser.open`（monkeypatch 拦截）。
- **必须加 `--python-exit-code 1`**：Blender `--background` 吞脚本异常且 exit 恒 0，否则测试失败也显示通过。
- 浏览器验证：CDP 无头 + `Network.setBlockedURLs` 封 jsDelivr 证明离线；截图哈希对比验证画面变化。
- 合成 `KeyboardEvent` 必须 `bubbles: true` 才能冒泡到 window 监听器。

## 踩坑速查

| 症状 | 根因 |
|---|---|
| `Cannot access 'x' before initialization` | 模块顶部即调用 `init()`，变量声明放在了调用点之后（TDZ） |
| `Failed to resolve module specifier '../...'` | data: URL 模块的相对导入未改写 |
| `from ''` / Invalid or unexpected token | 改写正则捕获组用错 |
| `Invalid placeholder in string` | 模板里有裸 `$`，需写成 `$$`（常见于 JS 正则 `/xxx$/`） |
| `getPixelRatio of undefined` | EffectComposer 在 renderer 创建前初始化 |
| smoke 通过但功能坏 | 未加 `--python-exit-code 1`，或断言引用了模板中不存在的字符串 |
