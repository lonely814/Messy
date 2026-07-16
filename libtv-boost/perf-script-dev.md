# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、画布主题等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

## 架构

```
┌─ 油猴沙箱（第 1–4、6 节）─────────────────────┐
│  CSS 注入、FPS 显示、流动光效、Drawer 适配   │
│  GM_registerMenuCommand + localStorage        │
└───────────────────────────────────────────────┘
┌─ <script> 注入到页面（第 5 节）───────────────┐
│  链高亮引擎、连线 hover 高亮、直角连线        │
│  节点搜索、提示词工具、调色板、快捷键         │
└───────────────────────────────────────────────┘
```

油猴沙箱能操作 DOM 但读不到页面 JS 变量，需要页面上下文的功能注入到 `<script>` 中执行。

## 文件结构

| 节 | 行号 | 作用 |
|----|------|------|
| 1 | 15–327 | **CSS 注入** — 所有视觉样式（节点、连线、面板、FPS、链高亮、主题覆盖等） |
| 2 | 329–402 | **FPS 面板** — DOM 创建 + 拖拽 + fpsLoop RAF |
| 3 | 404–488 | **流动光效** — SVG overlay，选中节点发光描边动画 |
| 4 | 490–524 | **AI Agent Drawer 适配** — MutationObserver 动态推位 |
| 5 | 529–1112 | **注入脚本** — 链引擎、hover 高亮、直角连线、搜索、提示词工具、调色板、快捷键 |
| 6 | 1114–1202 | **菜单开关** — GM_registerMenuCommand + localStorage 持久化 |

## CSS 开关模式

功能通过 body 类或元素类切换，CSS 注入区对应规则：

| 类名 | 元素 | 功能 | localStorage |
|------|------|------|-------------|
| `perf-mode` | `body` | 性能模式（去阴影/模糊/动画/滤镜） | `_lt_perf` |
| `perf-hide-imgs` | `body` | 隐藏节点图片 | `_lt_hide` |
| `perf-no-grid` | `.react-flow__background` | 隐藏网格 | `_lt_grid` |
| `perf-hide-edges` | `.react-flow__edges` | 隐藏连线 | `_lt_edges` |
| `libtv-focus` | `body` | 专注模式（隐藏侧栏） | `_lt_focus` |
| `libtv-chain` | `body` | 链高亮激活 | — |
| `libtv-autochain` | `body` | 自动链模式 | `_lt_autochain` |
| `libtv-step-edges` | `body` | 直角连线模式 | `_lt_step` |
| `libtv-chain-node` | `.react-flow__node` | 链中节点 | — |
| `libtv-chain-edge` | `.react-flow__edge` | 链中连线 | — |
| `libtv-edge-active` | `.react-flow__edge` | hover 高亮连线 | — |

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
| `Escape` | 关闭 | 关闭搜索/提示词/诊断面板 + 清除链高亮 |

所有快捷键在 input/textarea/contentEditable 中忽略，Ctrl/Meta/Alt 按下时也忽略。

## 菜单开关

油猴菜单 6 项，状态与快捷键双向同步，存 localStorage：

| 菜单 | 对应的 localStorage | toggle key |
|------|-------------------|------------|
| `⏱ 性能模式` | `_lt_perf` | `perf` |
| `⊙ 隐藏图片` | `_lt_hide` | `hide` |
| `╳ 隐藏连线` | `_lt_edges` | `edges` |
| `▦ 隐藏网格` | `_lt_grid` | `grid` |
| `◎ 专注模式` | `_lt_focus` | `focus` |
| `🔍 诊断` | — | 临时诊断面板 |

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

## 流动光效（第 3 节，404–488 行）

全屏 SVG overlay（`#libtv-glow`），`z-index: 50`，`pointer-events: none`。

对每个 `.react-flow__node.selected`，生成一个沿节点边框运动的虚线描边动画：
- 色调：读取页面 CSS 变量 `--accent` / `--accent-light`
- 动画周期：7000ms
- 外侧光晕：`feGaussianBlur(stdDeviation=6)`
- 性能模式下自动隐藏

## 连线系统

| 样式 | 选择器 | 说明 |
|------|--------|------|
| 默认 | `.react-flow__edge-path` | stroke `var(--faint)`，宽度 1.8 |
| hover 高亮 | `.libtv-edge-active .react-flow__edge-path` | stroke `var(--strong)`，宽度 2.5 |
| 链高亮 | `.libtv-chain-edge .react-flow__edge-path` | stroke `var(--accent)`，宽度 2.5，带 drop-shadow |
| 直角模式 | `body.libtv-step-edges` | 用 SVG API 将贝塞尔路径重写为直角折线 |
| 性能模式 | `body.perf-mode .react-flow__edge-path` | 宽度 0.8，去 filter/transition |

直角连线通过 `_ltStepEdges()` + MutationObserver 实现，监听 `.react-flow__edges` 的 childList/attribute/d 变化，用 `getPointAtLength()` 提取起止坐标，重写 `d` 为 `M x1 y1 L x2 y1 L x2 y2`。

## 主题系统

6 种预设主题（靛蓝/翡翠/玫瑰/琥珀/天蓝/紫色），存 localStorage `_lt_theme`。

通过 `_ltApplyTheme()` 设置 `document.documentElement` 的 CSS 变量：

| 变量 | 含义 |
|------|------|
| `--accent` | 主色调 |
| `--accent-light` | 亮色调 |
| `--accent-dark` | 暗色调 |
| `--accent-rgb` | RGB 值（逗号分隔） |
| `--accent-light-rgb` | 亮色 RGB |
| `--canvas-bg` | 画布背景 |
| `--node-bg` | 节点背景 |
| `--border-color` | 节点边框色 |
| `--edge-color` | 连线色 |

在提示词面板的「主题」标签页中切换。

## 提示词工具（第 5 节，约 645–943 行）

内置提示词模板管理 + AI 增强功能：
- 默认预置 5 个模板（产品摄影/电影镜头/吉卜力风/产品环绕/延时摄影）
- 模板变量替换：`{变量名=默认值}`
- AI 增强对接 OpenAI 兼容 API（默认 DeepSeek）
- 调色板：内置 180+ 色板，分组管理，支持收藏/最近使用/收藏置顶
- P 键开关

## 新增功能（给 AI 的指引）

### 新增快捷键

在第 5 节注入脚本的 `keydown` 监听器（约 1007–1107 行）中添加：

```js
'    if(e.key==="x"||e.key==="X"){',
'      e.preventDefault(); e.stopPropagation();',
'      // 逻辑',
'      try{localStorage.setItem("_lt_xxx","1");}catch(ex){}',
'      return;',
'    }',
```

需要更新以下位置：
1. 快捷键 handler（添加 case）
2. FPS 循环中的 flag 显示（如果有）
3. 底部帮助文字（约 339 行 `helpEl.textContent`）
4. console.log banner（约 1109 行）
5. @description 元信息（第 5 行）

### 新增 CSS 开关

1. 在第 1 节 CSS 注入中写规则，用 body 类控制
2. 在第 6 节 `_toggles` 加对应函数
3. 加 `GM_registerMenuCommand` 条目

## 注意事项

- 两个脚本通过 `@match` / `@exclude` 分离：libtv-boost 只操作 libtv 域名，infinite-canvas-perf 排除 libtv 域名
- 油猴沙箱中创建的变量在注入脚本中不可见，反之亦然
- `--grid-color` 在 CSS 中定义了但未被任何规则引用
- 非链模式下的流动光效只针对选中节点
- 直角连线模式断开 MutationObserver 后，下一次画布渲染会自动恢复贝塞尔曲线
