# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、**标签系统**、画布主题等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

**当前版本：** 1.8

## 架构

```
┌─ 油猴沙箱（第 1–4、6 节）─────────────────────┐
│  CSS 注入、FPS 显示、流动光效、Drawer 适配   │
│  GM_registerMenuCommand + localStorage        │
└───────────────────────────────────────────────┘
┌─ <script> 注入到页面（第 5 节）───────────────┐
│  链高亮引擎、连线 hover 高亮、直角连线        │
│  节点搜索、提示词工具、调色板、快捷键         │
│  标签系统（数据、菜单、扫描、右下角常驻图标）   │
└───────────────────────────────────────────────┘
```

油猴沙箱能操作 DOM 但读不到页面 JS 变量，需要页面上下文的功能注入到 `<script>` 中执行。
油猴菜单回调通过 `unsafeWindow._ltShowTagMenu` 调用注入脚本中的函数。

## 文件结构

| 节 | 行号（约） | 作用 |
|----|-----------|------|
| 1 | 15–367 | **CSS 注入** — 所有视觉样式（节点、连线、面板、FPS、链高亮、主题覆盖、**标签系统**等） |
| 2 | 369–442 | **FPS 面板** — DOM 创建 + 拖拽 + fpsLoop RAF |
| 3 | 444–528 | **流动光效** — SVG overlay，选中节点发光描边动画 |
| 4 | 530–564 | **AI Agent Drawer 适配** — MutationObserver 动态推位 |
| 5 | 569–1450 | **注入脚本** — 链引擎、hover 高亮、直角连线、搜索、提示词工具、调色板、**标签系统**、快捷键 |
| 6 | 1452–1489 | **菜单开关** — GM_registerMenuCommand + localStorage 持久化 |

## 快捷键

| 键 | 功能 | 说明 |
|----|------|------|
| `G` | 网格 | 切换背景网格显隐 |
| `T` | 性能 | 切换性能模式（去阴影/模糊/动画/滤镜/圆角） |
| `H` | 隐藏 | 切换图片显隐 |
| `L` | 连线 | 切换连线显隐 |
| `C` | 全链 | 切换自动链高亮模式 |
| `F` | 搜索 | 打开节点搜索浮动面板 |
| `P` | 提示词 | 打开提示词工具面板 |
| `X` | 专注 | 切换专注模式（隐藏侧栏，画布全屏） |
| `R` | 直角 | 切换直角连线（替换贝塞尔曲线） |
| `?` / `/` | 帮助 | 切换底部快捷键提示显隐 |
| `Escape` | 关闭 | 关闭搜索/提示词/诊断/标签面板 + 清除链高亮 |

所有快捷键在 input/textarea 中忽略。Ctrl/Meta/Alt 按下时也忽略。

## 菜单开关

油猴菜单 7 项，状态与快捷键双向同步，存 localStorage：

| 菜单 | 对应的 localStorage | toggle key |
|------|-------------------|------------|
| `⏱ 性能模式` | `_lt_perf` | `perf` |
| `⊙ 隐藏图片` | `_lt_hide` | `hide` |
| `╳ 隐藏连线` | `_lt_edges` | `edges` |
| `▦ 隐藏网格` | `_lt_grid` | `grid` |
| `◎ 专注模式` | `_lt_focus` | `focus` |
| `🏷️ 标签` | — | 打开标签面板（通过 `unsafeWindow._ltShowTagMenu`） |
| `⤓ 导出内容包` | — | 导出提示词 + 标签为 JSON（通过 `unsafeWindow._ltContent.exportPack`） |
| `⤒ 导入内容包` | — | 从 JSON 文件导入（整体替换 / 合并去重，通过 `unsafeWindow._ltContent.importFile`） |
| `🔍 诊断` | — | 临时诊断面板 |

## 标签系统

### 概述（第 5 节注入脚本）

四层结构标签管理器，提供预制描述词一键插入。支持：
- **两层分类**：一级分类 Tab（常规标签⭐ / 艺术题材 / 人物类 / 场景 / 已插入）+ 二级折叠分组（画质 / 负面标签 / 摄影 / 光影 / 构图 …）
- 多标签库切换（顶部下拉，默认「默认标签」）
- 全局搜索（顶部搜索框，跨分类过滤）
- 最近使用行 + 已插入管理（点击标签后记录到 `localStorage._lt_recent`）
- 自定义扩展：新增分类 / 分组 / 标签（面板内 `+` 按钮，prompt 输入）
- 光标位置插入（React 兼容，支持 textarea / input\[type=text\] / contentEditable 三种输入框）
  - 数据持久化到 `localStorage._lt_tag_libs`（库）+ `_lt_cur_lib`（当前库）+ `_lt_recent`（已插入历史）
  - 面板常驻：点击标签仅插入文本、不自动关闭；关闭方式 = 面板 ✕ / 按 Esc / 再次点击图标（icon 切换开关）
  - 负向标签：暂不区分，负面标签分组同样插入到当前输入框

### 数据结构

```js
_ltTagLibs = {                       // localStorage._lt_tag_libs
  "默认标签": { categories: [
    { name: "常规标签", icon: "⭐", groups: [
      { name: "画质", open: true,  items: ["杰作","写实", ...] },
      { name: "负面标签", open: false, items: ["低质量","模糊", ...] },
      // ...
    ]},
    { name: "艺术题材", icon: "🎨", groups: [ ... ] },
    // ...
  ]}
}
var _ltCurLib = "默认标签";         // 当前标签库（localStorage._lt_cur_lib）
var _ltTagActiveCat = 0;            // 当前激活一级分类索引
var _ltTagSearch = "";              // 当前搜索关键词
var _ltRecentTags = [];             // 已插入历史（localStorage._lt_recent）
var _ltTagMenuEl = null;            // 标签菜单 DOM 引用
var _ltTagInputEl = null;           // 当前绑定的输入框
```

### 核心函数

| 函数 | 作用 |
|------|------|
| `_ltInsertTagAtCursor(tagText)` | 在光标位置插入标签文本，支持 textarea/input（原生 setter + dispatchEvent）和 contentEditable（Range API） |
| `_ltShowTagMenu(ta)` | 打开标签浮动面板（头部栏 + Tab + 内容），绑定库下拉/搜索/刷新/关闭，并为内容区绑定事件委托 |
| `_ltCloseTagMenu()` | 关闭标签面板 |
| `_ltRenderTagMenu()` | 渲染面板：库下拉、一级分类 Tab、内容区（已插入 / 搜索 / 分类分组） |
| `_ltRenderCat(cat)` | 渲染某分类：最近使用行 + 可折叠分组 + 新增分组按钮 |
| `_ltRenderSearch()` | 全局搜索结果（跨分类聚合，隐藏不匹配项） |
| `_ltRenderInserted()` | 已插入历史列表（带清空） |
| `_ltCurLibCats()` / `_ltCurCatGroups()` | 取当前库的各级数据 |
| `_ltSaveLibs()` | 持久化标签库 + 当前库到 localStorage |
| `_ltPushRecent(t)` | 追加已插入标签到历史（去重、上限 40） |
| `_ltTagScan()` | 扫描页面中的输入框（textarea / input / contentEditable），为每个可见输入框在右下角统一附加常驻标签图标（锚定父容器，随输入框显隐） |

### 入口

| 入口 | 说明 |
|------|------|
| **油猴菜单** | `🏷️ 标签` — 通过 `unsafeWindow._ltShowTagMenu` 调用（操作焦点输入框或第一个可见输入框） |
| **图标** | 所有输入框（textarea / input / contentEditable）右下角半透明 🏷️ SVG（`position:absolute` 定位在父容器内，`z-index` 置顶），点击切换开关标签面板 |

> 注：原 `I` 快捷键已移除（避免与输入框打字冲突），标签面板仅由右下角图标打开。

### 样式

CSS 注入区（第 1 节）包含标签系统全套样式：

| 选择器 | 用途 |
|--------|------|
| `.lt-tag-menu` | 标签浮动面板（霓虹玻璃风格，344px，四层 flex 纵向布局） |
| `.lt-tag-header` | 头部栏：库下拉 `.lt-tag-lib` + 搜索 `.lt-tag-search` + 刷新/关闭按钮 |
| `.lt-tag-tabs` / `.lt-tag-tab` | 一级分类 Tab（`active` 蓝色下划线高亮）+ 末尾新增分类 `+` |
| `.lt-tag-content` | 内容滚动区 |
| `.lt-tag-recent` / `.lt-tag-recent-head` | 最近使用行 |
| `.lt-tag-group` / `.lt-tag-group-head` / `.lt-tag-group-name` | 二级可折叠分组（头部含 `+` 新增标签与折叠箭头） |
| `.lt-tag-grid` | 标签网格（flex wrap） |
| `.lt-tag-item` | 单个标签（胶囊按钮，hover 放大发光，原生 title 作悬停预览） |
| `.lt-tag-add-group` | 底部新增分组按钮 |
| `.lt-tag-resize` | 右下角拖拽调整面板大小手柄（`nwse-resize` 光标，最小 240×160，受视口限制） |

### 文本插入机制

对于 **textarea / input\[type=text\]**：
```js
// 使用原生 setter 绕过 React 属性描述符
var proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
nativeSetter.call(ta, newVal);
ta.dispatchEvent(new Event('input', {bubbles: true}));
```

对于 **contentEditable**：
```js
var sel = window.getSelection();
var r = sel.getRangeAt(0);
r.deleteContents();
r.insertNode(document.createTextNode(tagText));
r.collapse(false); // 光标放在插入文本之后
sel.removeAllRanges(); sel.addRange(r);
```

## 提示词工具（第 5 节，约 645–943 行）

内置提示词模板管理 + AI 增强功能：
- 默认预置 5 个模板（产品摄影/电影镜头/吉卜力风/产品环绕/延时摄影）
- 模板变量替换：`{变量名=默认值}`
- AI 增强对接 OpenAI 兼容 API（默认 DeepSeek）
- 调色板：内置 180+ 色板，分组管理，支持收藏/最近使用/收藏置顶
- P 键开关

## 直角连线系统

| 样式 | 选择器 | 说明 |
|------|--------|------|
| 默认 | `.react-flow__edge-path` | stroke `var(--faint)`，宽度 1.8 |
| hover 高亮 | `.libtv-edge-active .react-flow__edge-path` | stroke `var(--strong)`，宽度 2.5 |
| 链高亮 | `.libtv-chain-edge .react-flow__edge-path` | stroke `var(--accent)`，宽度 2.5，带 drop-shadow |
| 直角模式 | `body.libtv-step-edges` | 用 SVG API 将贝塞尔路径重写为直角折线 |
| 性能模式 | `body.perf-mode .react-flow__edge-path` | 宽度 0.8，去 filter/transition |

直角连线通过 `_ltStepEdges()` + MutationObserver 实现：
- 观察 **`.react-flow`** 父级（而非 `.react-flow__edges` 自身，避免 React 重建后失效）
- 最大 5 次重试
- Observer 回调中重置 retries

## 性能模式

触发方式：`T` 键 / 油猴菜单。body 加 `perf-mode` 类。

**CSS 效果（约 94–116 行）：**
- 节点：`box-shadow: none` · `border-radius: 0` · `backdrop-filter: none` · `opacity: 0.85`
- 节点内部 `[class*="rounded"]`：`border-radius: 0`
- 节点 hover/selected：`opacity: 1`
- 面板：`box-shadow: none` · `backdrop-filter: none` · 纯色背景
- 连续滚动条：简化至 4px
- 全局 `*`：去 blur/animation/transition/filter + `cursor: default`
- 连线：`stroke-width: 0.8` · `filter: none` · 去 transition
- 节点 `::before`：隐藏
- 流动光效 SVG（`#libtv-glow`）：`display: none`

## 流动光效（第 3 节）

全屏 SVG overlay（`#libtv-glow`），`z-index: 50`，`pointer-events: none`。

对每个 `.react-flow__node.selected`，生成一个沿节点边框运动的虚线描边动画：
- 色调：读取页面 CSS 变量 `--accent` / `--accent-light`
- 动画周期：7000ms
- 外侧光晕：`feGaussianBlur(stdDeviation=6)`
- 性能模式下自动隐藏

## 主题系统

6 种预设主题（靛蓝/翡翠/玫瑰/琥珀/天蓝/紫色），存 localStorage `_lt_theme`。

通过 `_ltApplyTheme()` 设置 `document.documentElement` 的 CSS 变量。

## 注意事项

- 油猴沙箱中创建的变量在注入脚本中不可见，反之亦然
- 油猴菜单回调通过 `unsafeWindow` 访问注入脚本的函数（需 `@grant unsafeWindow`）
- 标签 MutationObserver 使用 100ms 防抖，避免 React 频繁触发扫描
- 首次扫描后 3 秒自动重试一次，应对异步渲染
- 所有输入框（含 contentEditable）统一在右下角附加常驻图标，锚定父容器（`position:relative`），随输入框一起显隐；图标 `z-index` 置顶，避免被输入框遮挡
- 直角连线模式断开 MutationObserver 后，下一次画布渲染会自动恢复贝塞尔曲线

## 内容包系统（第 5 节注入脚本）

将提示词与标签库打包成 JSON 文件，便于备份与跨设备/跨人分享（**不含** 主题、调色板、AI 配置）。

### 导出

- 入口：油猴菜单 `⤓ 导出内容包`、或提示词面板「设置」页 → `导出内容包` 按钮
- 调用 `_ltDownloadContentPack()`：`_ltBuildContentPack()` 收集当前数据后，写入 `Blob` 并通过 `<a download>` 触发下载
- 文件名：`libtv-content-pack-YYYY-MM-DD.json`
- 结构（pretty-print，便于 AI / 手工编辑）：

```json
{
  "app": "libtv-boost",
  "type": "content-pack",
  "version": 1,
  "exportedAt": "2026-07-17T...",
  "currentLib": "默认标签",
  "prompts": [ { "id":"d1", "name":"产品摄影", "category":"图像", "content":"..." } ],
  "tagLibs": { "默认标签": { "categories": [ ... ] } }
}
```

### 导入

- 入口：油猴菜单 `⤒ 导入内容包`、或提示词面板「设置」页 → `导入内容包` 按钮
- 调用 `_ltImportContentPackFromFile()`：创建隐藏 `<input type=file>`，读取后用 `_ltShowContentPackChooser()` 弹出选择框
- 校验：必须是 `type:"content-pack"` 的 JSON，否则报错
- 选择框三选项：
  - **整体替换**：覆盖现有提示词、标签库、当前库（直接写入 localStorage）
  - **合并去重**：提示词按 `id` 去重追加；标签库按「库名 → 分类名 → 分组名」逐级合并，标签项去重
  - **取消**
- 应用 `_ltApplyContentPack(data, mode)` 后，刷新已打开的面板：
  - `window._ltPromptRefresh`（提示词面板内注册）：重载 `_lt_prompts` 并重渲染
  - `window._ltTagRefresh`（标签面板内注册）：重载 `_lt_tag_libs` 并重渲染标签菜单

### 核心函数

| 函数 | 作用 |
|------|------|
| `_ltBuildContentPack()` | 组装 {app,type,version,exportedAt,currentLib,prompts,tagLibs} |
| `_ltDownloadContentPack()` | 生成 JSON Blob 并触发浏览器下载 |
| `_ltImportContentPackFromFile()` | 打开文件选择框读取 JSON |
| `_ltShowContentPackChooser(text)` | 解析 + 校验 + 弹出替换/合并选择框 |
| `_ltApplyContentPack(data, mode)` | 执行「整体替换」或「合并去重」，并刷新已开面板 |
| `window._ltContent` | 暴露 `{exportPack, importFile}` 供油猴菜单调用 |
| `window._ltPromptRefresh` / `window._ltTagRefresh` | 导入后刷新对应面板 |

> 注：本版仅做文件导入；WebDAV / 云同步留待后续版本。

## 更新日志

### v1.8
- 新增内容包系统：提示词 + 标签库导出 / 导入为 JSON（不含量主题 / 调色板 / AI 配置）
- 导出：油猴菜单 `⤓ 导出内容包` 或提示词面板「设置」页按钮，下载 `libtv-content-pack-YYYY-MM-DD.json`
- 导入：文件选择 → 解析校验（`type:"content-pack"`）→ 选择框提供「整体替换」与「合并去重」两种模式，导入后自动刷新已打开的面板

### v1.7
- 标签面板重构为四层结构（头部栏 + 一级分类 Tab + 二级折叠分组 + 标签网格）
- 新增：标签库切换（顶部下拉）、全局搜索、最近使用行、已插入管理、面板内新增分类 / 分组 / 标签
- 移除 `I` 快捷键（避免与输入框打字冲突），标签面板仅由右下角图标开关
- 标签插入改为逗号分隔（`, `），避免提示词粘连
- 数据结构由 `_lt_tags` 切换为 `_lt_tag_libs` / `_lt_cur_lib` / `_lt_recent`（旧数据丢弃）
