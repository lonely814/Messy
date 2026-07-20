# InfiniteCanvas Turbo — 开发文档

## 概述

Tampermonkey 油猴脚本，为自部署 / 官方 Infinite Canvas 提供性能优化（DOM 虚拟化、LOD、content-visibility）、视觉增强、快捷键工具。匹配 `*/static/canvas.html*`、`*/static/smart-canvas.html*`、`*/canvas.html*`、`*/canvas*`，排除 iblib/liblib 域名。

**版本：** 11.1  |  **作者：** oocc00  |  **协议：** MIT

## 架构

```
┌─ 油猴沙箱（第 1–5、7 节）─────────────────┐
│  CSS 注入、FPS 显示、MutationObserver      │
│  菜单开关、localStorage 持久化             │
└────────────────────────────────────────────┘
┌─ <script> 注入到页面（第 6 节）───────────┐
│  勾函数（applyViewport/render/refreshNodes）│
│  快捷键、DOM 虚拟化、链高亮、搜索          │
│  LOD 更新、图片优化                        │
└────────────────────────────────────────────┘
```

油猴沙箱无法读取页面 JS 变量，需要页面上下文的功能（勾函数、快捷键）注入到 `<script>` 中。

## 文件结构

| 节 | 行号 | 作用 |
|----|------|------|
| 0 | 1–16 | **元信息** — @name/@version/@match/@grant |
| 1 | 24–281 | **CSS 注入** — 所有视觉样式 |
| 2 | 283–377 | **FPS 面板** — fpsLoop + 节点统计 + 状态标记 |
| 3 | 379–412 | **内存清理** — 节点删除时清图片 src |
| 4 | 414–443 | **LOD** — MutationObserver 监听缩放 |
| 5 | 445–466 | **图片优化** — loading lazy / decoding async |
| 6 | 468–790 | **注入脚本** — 勾函数 + 快捷键 + DOM 虚拟化 + 链引擎 + 搜索 |
| 7 | 792–838 | **菜单开关** — GM_registerMenuCommand + localStorage |

## CSS 开关模式

功能通过 body 类 / 元素类切换：

| 类名 | 元素 | 功能 | localStorage |
|------|------|------|-------------|
| `perf-mode` | `body` | 性能模式 | `_pf_perf` |
| `perf-hide-imgs` | `body` | 隐藏图片/视频 | `_pf_hide` |
| `perf-output-list` | `body` | 输出列表模式（经典画布） | `_pf_list` |
| `pf-focus` | `body` | 专注模式 | `_pf_focus` |
| `pf-chain` | `body` | 链高亮激活 | — |
| `pf-autochain` | `body` | 自动链模式 | `_pf_autochain` |
| `perf-no-grid` | `#board` / `#shell` | 隐藏网格 | `_pf_grid` |
| `perf-hide-links` | `#links` / `.connection-layer` | 隐藏连线 | `_pf_links` |
| `pf-vhide` | `.node` / `.image-node` | DOM 虚拟化隐藏 | — |
| `pf-chain-node` | `.node` / `.image-node` | 链高亮节点 | — |
| `pf-chain-edge` | `.link` / `.link-hit` | 链高亮连线 | — |
| `zoom-lod-(1\|2\|3)` | `#world` | 缩放级别 | — |

## 快捷键

| 键 | 功能 | 说明 |
|----|------|------|
| `G` | 网格 | 切换网格背景显隐 |
| `T` | 性能 | 切换性能模式 |
| `H` | 隐藏 | 切换图片/视频显隐 |
| `L` | 连线 | 切换连线显隐 |
| `O` | 列表 | 输出节点切换列表布局（经典画布） |
| `C` | 全链 | 切换自动链高亮（经典画布） |
| `F` | 搜索 | 打开节点搜索面板 |
| `X` | 专注 | 切换专注模式 |
| `?` / `/` | 帮助 | 切换底部提示显隐 |

## 菜单开关

油猴菜单 6 项，快捷键与油猴菜单双向同步：

| 菜单 | localStorage | toggle key |
|------|-------------|------------|
| `⏱ 性能模式` | `_pf_perf` | `perf` |
| `≡ 输出列表` | `_pf_list` | `list` |
| `⊙ 隐藏图片` | `_pf_hide` | `hide` |
| `╳ 隐藏连线` | `_pf_links` | `links` |
| `▦ 隐藏网格` | `_pf_grid` | `grid` |
| `◎ 专注模式` | `_pf_focus` | `focus` |

## 性能模式（约 136–163 行）

`body.perf-mode` 生效，开启后：

**节点：**
- `box-shadow: none` · `border-radius: 0` · `opacity: 0.85`
- `contain: content`（layout/style/paint 隔离）
- `will-change: auto`（清除强制 GPU 层）
- `isolation: auto` · `mix-blend-mode: normal` · `border-color` 淡化
- hover/selected 时 `opacity: 1`
- `::before` 隐藏

**面板：**
- 去阴影/模糊/圆角，纯色背景，`resize: none`

**全局：**
- `backdrop-filter: none` · `animation: none` · `transition: none`
- `filter: none` · `cursor: default`
- 滚动条简化（4px + 半透明滑块）

**连线 / 最小地图 / 运行状态点：**
- 连线 `stroke-width: 0.8`，`filter: none`
- 最小地图去阴影
- 运行状态点停止动画
- 节点头部分隔线淡化

## DOM 虚拟化（第 6 节，约 508–552 行）

基于视口裁剪的虚拟化引擎，在注入脚本中实现：
- 监听 `#world` 的 transform 变化
- 计算当前视口范围（含 1.5x 边距，拖动时 0.5x）
- 视口外的 `.node` / `.image-node` 加 `pf-vhide` 类（`display: none`）
- 选中节点始终可见
- 拖动画布/节点时自动全显
- scale/translate 变化时重新计算

## LOD 多级缩放（约 414–443 行）

| 级别 | 缩放阈值 | 效果 |
|------|---------|------|
| L1 | < 0.45 | 图片模糊+半透明，隐藏 caption/status |
| L2 | < 0.25 | 隐藏图片/media，缩小节点 body |
| L3 | < 0.12 | 隐藏 body，节点缩至 48×22，标题 5px，连线 0.3 宽度 |

通过 `MutationObserver` 监听 `#world style` 属性的 transform 变化。智能画布跳过 LOD。

## 性能注意事项

- `content-visibility: auto` 仅对 `.image-node` 启用
- 性能模式 + DOM 虚拟化 + LOD 共同作用时效果最大
- 流动光效已从本脚本中移除（libtv-boost 中保留）
- 性能模式选中边 flush 的 CSS `filter: none` 会覆盖链高亮的 drop-shadow
