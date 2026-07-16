# 无限画布性能优化加速器 — 开发笔记

## 这脚本干啥的

一个 Tampermonkey 油猴脚本，在不改源码的前提下给无限画布"外挂"性能优化和视觉增强。

## 整体架构

```
┌─ 油猴沙箱（第 1–5、7 节）──────────────┐
│  CSS 注入、FPS 显示、MutationObserver    │
│  菜单开关、localStorage 持久化           │
└──────────────────────────────────────────┘
┌─ <script> 注入到页面（第 6 节）─────────┐
│  勾住 applyViewport/render/refreshNodes  │
│  快捷键、列表文件名管理、LOD 更新        │
└──────────────────────────────────────────┘
```

油猴沙箱能操作 DOM 但读不到页面 JS 变量，所以需要页面 JS 的部分（勾函数、快捷键）用 `<script>` 注入到页面里跑。

## 文件结构

| 节 | 作用 | 修改要点 |
|----|------|----------|
| 1 | CSS 注入 | 所有视觉样式。想改颜色/粗细就在这里改 |
| 2 | FPS 面板 | fpsLoop + 节点统计 + 状态标记 |
| 3 | 内存清理 | 节点删除时清图片 src 防泄漏 |
| 4 | LOD | MutationObserver 监听缩放自动切换 L1–L3 |
| 5 | 图片优化 | loading lazy / decoding async |
| 6 | 注入脚本 | 勾函数 + 快捷键 + 列表文件名管理 |
| 7 | 菜单开关 | GM_registerMenuCommand + localStorage |

## 核心机制

### CSS 开关模式

几乎所有功能用 **body 类** 控制。在 CSS 注入区写规则，按快捷键/菜单切换类名：

| body 类 | 功能 | 对应 CSS 选择器 |
|---------|------|-----------------|
| `perf-mode` | 性能模式 | `body.perf-mode .node { box-shadow: none }` |
| `perf-no-grid` | 隐藏网格 | `.board.perf-no-grid { background-image: none }` |
| `perf-hide-imgs` | 隐藏图片 | `body.perf-hide-imgs .node img { display: none }` |
| `perf-hide-links` | 隐藏连线 | `#links.perf-hide-links { display: none }` |
| `perf-output-list` | 列表模式 | `body.perf-output-list .output-grid { flex-direction: column }` |

### 状态持久化 (`localStorage`)

键名 `_pf_{功能}`，值 `1` 或 `0`。加载时 `_pfApply()` 读取并恢复。

快捷键和菜单双向同步：快捷键→存 localStorage，菜单→存 localStorage。

### 列表模式文件名 (`_pfLabel`)

用 `insertBefore(l, .output-del)` 把文件名插到删除按钮前面。
两个 MutationObserver 兜底：
- 新输出项出现时自动加标签
- body class 变化时同步标签添加/移除

### 勾函数 (Hook)

```js
var _a = applyViewport;
applyViewport = function(){ _a.apply(this, arguments); _upd(); };
```

在每次 `render()` / `applyViewport()` / `refreshNodes()` 之后额外跑 `_upd()`（更新 LOD）和 `_opt()`（优化新图片）。

## 常见调整场景

### 改发光颜色

```css
/* 第 1 节 CSS */
--pf-glow-rgb: 124, 58, 237;  /* 浅色主题（紫色） */
.theme-dark { --pf-glow-rgb: 96, 165, 250; /* 深色主题（蓝色） */ }
```

改成自己喜欢的 RGB 值即可。

### 改连线粗细

```css
/* 第 1 节 CSS */
--pf-link-width: 2.2;
--pf-link-opacity: 0.7;
```

然后用 CSS 那边的 `var(--pf-link-width)` 替代硬编码的 `stroke-width`。目前是硬编码的，如果想用变量需要改一下：

```css
'.link {',
'  stroke-width: var(--pf-link-width) !important;',
'  opacity: var(--pf-link-opacity) !important;',
'}',
```

### 改列表缩略图大小

```css
/* 第 1 节 CSS */
'body.perf-output-list .output-img-wrap img,',
'body.perf-output-list .output-img-wrap video {',
'  width: 36px !important; height: 36px !important;',
'}',
```

改 `36px` 就行。

### 新增快捷键

在第 6 节注入脚本的 `keydown` 监听器里加：

```js
'    if(e.key==="x"||e.key==="X"){',
'      e.preventDefault();',
'      // 你的逻辑',
'      try{localStorage.setItem("_pf_xxx","1");}catch(ex){}',
'      return;',
'    }',
```

### 新增菜单开关

两步：

1. 在第 1 节写 CSS，用 `body.perf-xxx .target { }` 做样式
2. 在第 7 节加一行 `GM_registerMenuCommand('名称', function(){ _pfClick('xxx'); });`
3. 在 `_pfToggleFns` 加对应函数
4. localStorage 自动兼容

## 冷知识

- 页面 `canvas.js` 里 `renderOutputMedia` 生成 `.output-img-wrap`，`renderOutputGrid` 生成 `.output-grid`
- 删除按钮 `.output-del` 原生是 `position: absolute`，列表模式改成 `position: static` 放到 flex 流里
- 输出节点的 `grid-layout` 和 `list-layout` 互不冲突，因为列表模式用的是 body 类而非 node 类
- 拖动时隐藏图片的规则优先级：`body.perf-output-list.canvas-board-pan .output-img-wrap img`（两条 body 类 + class + tag）> `body.canvas-board-pan .node img`（单条 body 类 + class + tag）
