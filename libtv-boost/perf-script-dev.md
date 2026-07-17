# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、**标签系统**、画布主题等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

**当前版本：** 1.6

## 架构

```
┌─ 油猴沙箱（第 1–4、6 节）─────────────────────┐
│  CSS 注入、FPS 显示、流动光效、Drawer 适配   │
│  GM_registerMenuCommand + localStorage        │
└───────────────────────────────────────────────┘
┌─ <script> 注入到页面（第 5 节）───────────────┐
│  链高亮引擎、连线 hover 高亮、直角连线        │
│  节点搜索、提示词工具、调色板、快捷键         │
│  标签系统（数据、菜单、管理、扫描、标签栏）   │
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
| `I` | **标签** | **打开标签面板（输入框内也可用）** |
| `?` / `/` | 帮助 | 切换底部快捷键提示显隐 |
| `Escape` | 关闭 | 关闭搜索/提示词/诊断/标签面板 + 清除链高亮 |

所有快捷键在 input/textarea 中忽略，**仅 `I` 键例外**（输入框内也可打开标签菜单）。Ctrl/Meta/Alt 按下时也忽略。

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
| `🔍 诊断` | — | 临时诊断面板 |

## 标签系统

### 概述（第 5 节注入脚本）

轻量标签系统，提供预制描述词一键插入。支持：
- 4 组预设标签（质量/风格/光照/构图），共 32 个
- 自定义分组（新建/删除分组、添加/删除/重命名标签）
- 光标位置插入（React 兼容，支持 textarea / input\[type=text\] / contentEditable 三种输入框）
- 数据持久化到 `localStorage._lt_tags`

### 数据结构

```js
_ltTagGroups = [
  { id: "tg_quality", name: "质量", items: [
    { id: "tq1", text: "masterpiece" },
    { id: "tq2", text: "high quality" },
    // ...
  ]},
  // ...
]
var _ltTagActiveGroup = 0;         // 当前激活分组索引
var _ltTagMenuEl = null;           // 标签菜单 DOM 引用
var _ltTagInputEl = null;          // 当前绑定的输入框
```

### 核心函数

| 函数 | 作用 |
|------|------|
| `_ltInsertTagAtCursor(tagText)` | 在光标位置插入标签文本，支持 textarea/input（原生 setter + dispatchEvent）和 contentEditable（Range API） |
| `_ltShowTagMenu(ta)` | 打开标签浮动面板，定位在输入框上方 |
| `_ltCloseTagMenu()` | 关闭标签面板 |
| `_ltRenderTagMenu()` | 渲染标签面板内容（分组 tabs + 标签云） |
| `_ltPosTagMenu()` | 定位标签面板到输入框附近 |
| `_ltSaveTags()` | 持久化标签数据到 localStorage |
| `_ltManageTags()` | 打开管理模态框（新建/删除分组、添加/删除/重命名标签） |
| `_ltTagScan()` | 扫描页面中的输入框，对 contentEditable 建立吸附标签栏，对 textarea/input 附加图标 |
| `_ltRenderTagBarInner(ta, flexRow)` | 在输入框 flex 容器右侧渲染垂直紧凑标签栏（分组名 + 切换箭头 + 前 4 个标签 + 展开按钮） |
| `_ltRefreshTagBars()` | 刷新所有标签栏（分组切换后调用） |

### 入口

| 入口 | 说明 |
|------|------|
| **快捷键** | `I` 键 — 优先操作焦点输入框；无焦点时操作第一个可见输入框 |
| **油猴菜单** | `🏷️ 标签` — 通过 `unsafeWindow._ltShowTagMenu` 调用 |
| **标签栏** | contentEditable 输入框右侧吸附的垂直栏，点击标签直接插入 |
| **图标** | textarea/input 右下角半透明 🏷️ SVG（`position:absolute` 定位在父容器内） |

### 样式

CSS 注入区（第 1 节）包含标签系统全套样式：

| 选择器 | 用途 |
|--------|------|
| `.lt-tag-menu` | 标签浮动面板（霓虹玻璃风格，320px） |
| `.lt-tag-tabs` / `.lt-tag-tab` | 分组切换栏 |
| `.lt-tag-body` | 标签云容器（flex wrap） |
| `.lt-tag-item` | 单个标签（胶囊按钮） |
| `.lt-tag-bar` | 吸附标签栏（垂直 flex，输入框右侧） |
| `.lt-tag-bar-nav` / `.lt-tag-bar-arrow` | 分组导航 ◀ ▶ |
| `.lt-tag-bar-gname` | 分组名称 |
| `.lt-tag-bar-item` | 标签栏内标签（紧凑样式） |
| `.lt-tag-bar-expand` | 「▶ 更多」展开按钮 |
| `.lt-tag-bar-head` | 标签栏顶部 🏷️ 图标入口 |
| `.lt-mgr-overlay` / `.lt-mgr-panel` | 管理面板模态框 |

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
- contentEditable 的图标集成在标签栏顶部，不单独插入元素内部
- 直角连线模式断开 MutationObserver 后，下一次画布渲染会自动恢复贝塞尔曲线
