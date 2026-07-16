# Canvas 主题设计

## 目标
为 libtv 画布增加可 DIY 的主题系统，覆盖画布背景、网格、节点、连线等视觉元素。

## 范围
只改 `libtv-boost.user.js` 一个文件，不新增文件。

## 新增 CSS 变量（:root 注入）

| 变量 | 默认值 | 作用 |
|------|--------|------|
| `--canvas-bg` | `#0f0f0f` | 画布背景色 |
| `--grid-color` | `rgba(255,255,255,0.06)` | 网格点/线颜色 |
| `--node-bg` | `#1e1e2e` | 节点背景色 |
| `--border-color` | `rgba(255,255,255,0.12)` | 节点边框色 |
| `--edge-color` | `rgba(255,255,255,0.08)` | 连线颜色 |

## 新增 CSS 覆盖规则

```css
.react-flow__renderer,
.react-flow { background: var(--canvas-bg) !important; }

.react-flow__background pattern path { fill: var(--grid-color) !important; }

.react-flow__node { background: var(--node-bg) !important; border-color: var(--border-color) !important; }

.react-flow__edge-path { stroke: var(--edge-color) !important; }
```

## 预设主题

现有 6 套预设新增 canvas 色值，从主色自动推导：
- canvas-bg = accent 的暗化版本（`darken(accent, 85%)`）
- grid-color = 白色低透明度
- node-bg = canvas-bg 提亮版
- border-color = canvas-bg 提亮版（更亮）
- edge-color = accent 的低饱和度版本

## 自定义颜色

🎨 主题 tab 新增 3 个颜色选择器：
1. 画布背景（影响 canvas-bg 和节点背景）
2. 网格颜色（单独控制）
3. 连线颜色（单独控制）

节点边框色自动从画布背景推导，不需要单独配置。

## 持久化

全部主题字段存入 localStorage `_lt_theme`，页面刷新后保持。

## 主题数据格式

```json
{
  "n": "自定义",           // 名称
  "a": "#6366f1",          // accent
  "l": "#818cf8",          // accent-light
  "d": "#4f46e5",          // accent-dark
  "ar": "99,102,241",      // accent-rgb
  "alr": "129,140,248",    // accent-light-rgb
  "cb": "#0f0f0f",         // canvas-bg
  "gc": "rgba(255,255,255,0.06)", // grid-color
  "nb": "#1e1e2e",         // node-bg
  "nc": "rgba(255,255,255,0.12)", // border-color
  "ec": "rgba(255,255,255,0.08)"  // edge-color
}
```
