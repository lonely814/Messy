# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、标签系统、画布主题、设置面板等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

**当前版本：** 1.10.1  |  **作者：** oocc00  |  **协议：** MIT

## 文件结构

| 文件 | 说明 |
|------|------|
| `src/style.css` | **CSS 源码** — 840 行，完整 IDE 语法高亮/自动补全/颜色预览 |
| `src/inject.js` | **注入脚本源码** — 1178 行，页面上下文执行的 JS IIFE |
| `src/main.js` | **主模板** — 油猴 IIFE 骨架，含 `__INJECT_CSS__` / `__INJECT_SCRIPT__` 占位符 |
| `build.js` | **构建脚本** — 零依赖 Node 脚本，组装源码 → `.user.js` |
| `libtv-boost.user.js` | **构建产出** — 拖进 Tampermonkey 安装。不要直接编辑此文件 |
| `perf-script-dev.md` | 本文档 |
| `libtv-content-pack.json` | 内容包导出示例 |

**工作流：** 编辑 `src/` 下的源码 → `node build.js` → 产出 `libtv-boost.user.js`。

## 构建系统

`build.js` 是一个零依赖（仅 `node:fs` / `node:path`）的纯字符串处理脚本。

**构建过程：**
1. 读取 `src/style.css`，按行分割，每行转成单引号字符串（自动转义 `\` / `'` / CRLF）
2. 读取 `src/inject.js`，同上处理
3. 读取 `src/main.js` 模板，将 CSS 数组替换 `__INJECT_CSS__`，注入脚本数组替换 `__INJECT_SCRIPT__`
4. 写出 `libtv-boost.user.js`

**加新文件的流程：** 在 `build.js` 的 `build()` 函数中加一行 `read()` + `replace()` 链即可。

**语法验证：**
```bash
node build.js                              # 构建
node --check libtv-boost.user.js           # 验证产出语法
node --check src/inject.js                 # 直接验证注入脚本语法（无需构建）
```

## 脚本整体结构

`build.js` 将 `src/` 下的源码组装进 `src/main.js` 模板，产出单文件 `.user.js`。

| 源代码 | 对应运行时位置 | 说明 |
|--------|--------------|------|
| `src/main.js` | IIFE 外层 | 油猴沙箱上下文：FPS 面板、流动光效、Drawer 适配、菜单开关、诊断 |
| `src/inject.js` | `<script>` 注入到页面上下文 | 所有画布交互逻辑：链高亮、搜索、标签、提示词、主题、快捷键、设置面板 |
| `src/style.css` | `style.textContent = [...]` | 所有视觉样式，通过构建自动嵌入 |

### 双沙箱通信

油猴沙箱（`src/main.js`）通过 `unsafeWindow` 调用注入脚本（`src/inject.js`）的函数：

```
油猴沙箱                         注入脚本（页面上下文）
───────                         ────────────────────
unsafeWindow._ltShowTagMenu(ta)  ← window._ltShowTagMenu
unsafeWindow._ltOpenSettings()   ← window._ltOpenSettings
unsafeWindow._ltContent          ← window._ltContent
```

注入脚本中的 `_lt*` 变量在 IIFE 内部，不污染全局。暴露给外层的接口通过 `window._lt*` 显式导出。

## 第一节：CSS 注入（`src/style.css`）

直接编辑 `src/style.css`，完整的 CSS 语法支持。构建时 `build.js` 将每行转为数组元素嵌入模板：

```css
/* 编辑 src/style.css — 正常 CSS 语法 */
.react-flow__node {
  border-radius: 12px;
  transition: box-shadow 0.25s ease, opacity 0.2s ease !important;
}
```

构建产出等价于：
```js
style.textContent = ['.react-flow__node {', '  border-radius: 12px;', ...].join('\n');
```

> 开发者**不需要**手动维护数组格式。`node build.js` 自动处理所有引号/逗号/转义。

### CSS 开关模式

通过 body 类或元素类控制显隐：

| 类名 | 作用元素 | 功能 | localStorage |
|------|---------|------|-------------|
| `perf-mode` | `body` | 去阴影/模糊/动画/滤镜 | `_lt_perf` |
| `perf-hide-imgs` | `body` | 隐藏节点图片 | `_lt_hide` |
| `perf-no-grid` | `.react-flow__background` | 隐藏网格 | `_lt_grid` |
| `perf-hide-edges` | `.react-flow__edges` | 隐藏连线 | `_lt_edges` |
| `libtv-focus` | `body` | 专注模式（隐藏侧栏） | `_lt_focus` |
| `libtv-chain` | `body` | 链高亮激活 | — |
| `libtv-autochain` | `body` | 自动链模式 | `_lt_autochain` |
| `libtv-step-edges` | `body` | 直角连线 | `_lt_step` |
| `libtv-clean-home` | `body` | 清爽首页 | `_lt_clean` |

### 视觉改造（v1.9.3，v1.9.6 已移除）

以下视觉改造在 v1.9.6 中已全部移除（因导致节点缩放 bug），节点恢复 React Flow 原生外观：

| ~~改造项~~ | ~~效果~~ | 状态 |
|-----------|---------|------|
| 节点卡片 | ~~玻璃质感（`backdrop-filter: blur(8px)` + 微透明背景 + 微边框）~~ | ❌ 已移除 |
| 节点悬浮 | ~~hover 时边框提亮 + 阴影上浮~~ | ❌ 已移除 |
| 选中节点 | ~~全息光晕（`box-shadow` 四层叠加）+ 边框变 accent 色~~ | ❌ 已移除 |
| 连线 | ~~2px 粗 + hover 发光描边~~ | ❌ 已移除 |
| 链高亮连线 | ~~2.8px + 8px 发光滤镜~~ | ❌ 已移除 |
| 画布背景 | ~~多色渐变辉光（跟随主题 accent 色）~~ | ❌ 已移除 |
| 面板打开 | ~~画布自动压暗（`brightness(0.7) saturate(0.5)`）~~ | ❌ 已移除 |
| ~~性能模式~~ | ~~一键关闭所有玻璃/发光/动画效果~~ | — |
| 清爽首页 | 首页/全部项目页布局优化 + 隐藏干扰元素（Banner/会员超市/帮助按钮/轮播/AI输入区等），`N` 键切换 | ✅ 保留 |

> ⚠️ `transform` 属性被 React Flow 用于节点定位，CSS 中不能覆盖。所有视觉效果使用 `box-shadow` / `filter` / `backdrop-filter` 实现。

开关类名在 `src/style.css` + `src/inject.js`（快捷键 handler）+ `src/inject.js`（设置面板）三处同步维护。

### 清爽首页 CSS（v1.9.4）

首页/全部项目页的布局优化 + 隐藏干扰元素样式，通过 `body.libtv-clean-home` 类控制显隐（`N` 键切换）：

| 区块 | 效果 |
|------|------|
| 隐藏干扰元素 | 顶部 Banner、会员超市、限时40折、帮助按钮、Mantine图标①②③④、导航栏右侧文字 |
| 隐藏主 Banner/轮播 | `section[class*=banner]`、`div[class*=carousel]`、`[class*=swiper]` |
| 隐藏全部项目页顶部 | `div.b1280:max-w-[1440px]` 的 block/hidden/mx-auto/mt-10/button |
| 首页个人最近项目 | 限宽 1200px 居中、3列网格、卡片320px、封面210px |
| 全部项目容器 | 限宽 1800px 居中、6列网格、面包屑24px、卡片280px、封面170px |
| 分区标题 | `::before` 注入「最近项目」、`::after` 注入「所有项目」+ 分割线 |
| 创作卡/项目卡 | 玻璃质感背景、hover 上浮+阴影、标题两行截断 |

> ⚠️ 选择器依赖站点 Tailwind 生成的 class 名（含 `:` / `[]`），站点改版后可能失效。

### CSS 主题变量

`:root` 定义的 CSS 变量：

| 变量 | 含义 | 默认值 |
|------|------|--------|
| `--accent` | 主色调 | `#6366f1` |
| `--accent-light` | 亮色调 | `#818cf8` |
| `--accent-dark` | 暗色调 | `#4f46e5` |
| `--accent-rgb` | RGB（逗号分隔） | `99,102,241` |
| `--canvas-bg` | 画布背景 | `#0f0f0f` |
| `--node-bg` | 节点背景 | `#1a1a2e` |
| `--border-color` | 节点边框 | `rgba(255,255,255,0.12)` |
| `--edge-color` | 连线色 | `rgba(255,255,255,0.08)` |

### 设置面板 CSS

设置面板使用独立样式（不与提示词面板共用）：

| 选择器 | 用途 |
|--------|------|
| `.lt-settings` | 面板容器（居中对齐，霓虹玻璃） |
| `.lt-settings-head` / `.lt-settings-close` | 头部 + 关闭 |
| `.lt-settings-body` | 滚动内容区 |
| `.lt-settings-sec` / `.lt-settings-stitle` | 分区标题 |
| `.lt-settings-toggle` / `.lt-settings-switch` | 滑动开关 |
| `.lt-settings-btn` / `-primary` / `-ghost` / `-sm` | 按钮 |
| `.lt-settings-row` / `.lt-settings-inp` | 输入行 |
| `.lt-settings-dlist` / `.lt-settings-ditem` / `.lt-settings-dclear` | 数据管理清单 |
| `.lt-settings-about` | 关于区 |
| `.lt-settings-cpbtns` | 内容包按钮行 |

## 第二节：FPS 面板（`src/main.js`）

DOM 创建 + 拖拽 + RAF 循环：
- `#libtv-fps` 浮动面板，显示 FPS、缩放、节点数、开关状态
- 可拖拽（mousedown/mousemove/mouseup）
- 悬停时显示快捷键提示卡片 `#libtv-help`

## 第三节：流动光效（`src/main.js`）

全屏 SVG overlay（`#libtv-glow`），`z-index:50`，`pointer-events:none`。

对每个 `.react-flow__node.selected`，生成沿节点边框运动的虚线描边动画：
- 色调：读取 `--accent` / `--accent-light`
- 动画周期：7000ms
- 光晕：`feGaussianBlur(stdDeviation=6)`
- 性能模式下自动隐藏

## 第四节：AI Agent Drawer 适配（`src/main.js`）

MutationObserver 监听 `body`，检测右侧 AI Agent Drawer 的出现。当 drawer 打开时，将 FPS 面板和浮动按钮右推避免遮挡。

## 第五节：注入脚本（`src/inject.js`）

通过 `<script>` 注入到页面上下文执行。这是脚本的核心，所有画布交互逻辑都在这里。编辑 `src/inject.js`，构建时自动嵌入。

### 子模块

| 子模块 | 功能 |
|--------|------|
| 链高亮引擎 | BFS 图遍历、`_ltAutoChain` 自动模式 |
| 连线 hover 高亮 | mouseover/mouseout 切换 `.libtv-edge-active` |
| 节点搜索 | 浮动搜索面板，按文本过滤节点 |
| 提示词工具 | 模板 / AI / 主题 / 调色板 / 设置 tab |
| 标签系统 | 四层结构：库→分类→分组→标签 |
| 浮动按钮 | 可拖拽的提示词工具按钮（仅画布页面显示） |
| 直角连线 | 贝塞尔→折线重写 |
| 快捷键 | 11 个快捷键 handler |
| 内容包 | 导出/导入 JSON |
| 账号切换 | Cookie + localStorage 快照、多账号保存/切换/刷新/删除 |
| 首次引导 | `_ltShowWelcome()` + 帮助面板（设置页可重新弹出） |
| 设置面板 | `_ltSettingsPanel()` 函数 |
| AI 增强重构 | 预设策略(润色/扩写/缩写/翻译) + 自定义 system prompt + 原文对比结果区 |

#### 链高亮引擎

```js
var _ltAutoChain = localStorage.getItem("_lt_autochain") === "1";
```

点击节点时 BFS 遍历上下游：
1. `_ltGetGraph()` — 读取 `.react-flow__edge` 的 `aria-label`，格式 `Edge from X to Y`
2. **关键：aria-label 前有不可见字符**，须用 `.trim()` 后再正则匹配
3. 遍历出所有相连节点，添加 `.libtv-chain-node` / `.libtv-chain-edge` 类
4. `body` 加 `.libtv-chain` 类，非链中节点 opacity 降至 0.08

#### 标签系统

**数据结构（localStorage）：**

```js
_ltTagLibs = {
  "默认标签": {
    categories: [
      { name: "常规标签", icon: "⭐", groups: [
        { name: "画质", open: true, items: ["杰作", "写实", ...] },
        { name: "负面标签", open: false, items: ["低质量", "模糊", ...] }
      ]}
    ]
  }
}
_ltCurLib        // 当前库名（localStorage._lt_cur_lib）
_ltTagActiveCat  // 当前分类索引
_ltRecentTags    // 已插入历史（localStorage._lt_recent）
```

**核心函数：**

| 函数 | 作用 |
|------|------|
| `_ltShowTagMenu(ta)` | 打开标签面板，绑定事件 |
| `_ltCloseTagMenu()` | 关闭标签面板 |
| `_ltRenderTagMenu()` | 渲染面板：库下拉、分类 Tab、内容区 |
| `_ltRenderCat(cat)` | 渲染某分类的内容 |
| `_ltRenderSearch()` | 全局搜索结果 |
| `_ltInsertTagAtCursor(text)` | 光标位置插入文本 |
| `_ltEsc(s)` | HTML 转义（防 XSS） |

**文本插入机制：**

textarea / input\[type=text\]：
```js
var proto = ta.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
setter.call(ta, newVal);
ta.dispatchEvent(new Event('input', {bubbles: true}));
```

contentEditable：
```js
var sel = window.getSelection();
var r = sel.getRangeAt(0);
r.deleteContents();
r.insertNode(document.createTextNode(text));
r.collapse(false);
sel.removeAllRanges(); sel.addRange(r);
```

**入口：** 所有输入框右下角 🏷️ 图标（MutationObserver 自动扫描，100ms 防抖，setInterval 1.5 秒轮询兜底）

#### 主题系统

**预设数据结构：**
```js
{ n:"靛蓝", a:"#6366f1", l:"#818cf8", d:"#4f46e5",
  ar:"99,102,241", alr:"129,140,248",
  cb:"#0e0e12", gc:"rgba(...)", nb:"#16162a", nc:"rgba(...)", ec:"rgba(...)",
  cat:"dark" }  // dark / light / high
```

29 套预设按 `cat` 分组渲染：
- **dark**（18）：靛蓝、翡翠、玫瑰、琥珀、天蓝、紫色、暗夜绿、赛博朋克、暖棕复古、暗紫、墨绿、深红、钴蓝、石墨、霓虹紫、午夜蓝、橄榄绿、熔岩橙
- **light**（7）：极简白、灰银、暖白、淡紫、粉彩、淡青、奶油
- **high**（4）：高对比、高对比蓝、高对比黄黑、高对比绿黑

**`_ltApplyTheme(t)`** 设置 CSS 变量 + 写 localStorage + 刷新画布背景。

#### 快捷键

所有 handler 在 keydown 事件中。input/textarea 中忽略，Ctrl/Meta/Alt 按下时忽略。

| 键 | 功能 |
|----|------|
| `Escape` | 关闭面板 + 清除链高亮 |
| `G` | 网格 toggle |
| `T` | 性能 toggle |
| `H` | 隐藏图片 toggle |
| `L` | 隐藏连线 toggle |
| `C` | 自动链 toggle |
| `F` | 搜索面板开关 |
| `P` | 提示词面板开关 |
| `X` | 专注 toggle |
| `R` | 直角连线 toggle |
| `?` / `/` | 帮助提示 pin |
| `N` | 清爽首页 toggle |

#### 设置面板

`_ltSettingsPanel()` 函数（`src/inject.js`）创建独立浮动面板：

| 分区 | 实现 |
|------|------|
| 开关 | 6 个 toggle（性能/隐藏图片/隐藏连线/隐藏网格/专注/清爽首页），操作 `localStorage._lt_*` + `body.classList` |
| API | URL / Key / Model，存 `localStorage._lt_prompt_api` |
| 数据管理 | 3 项（标签库/当前库/历史）+ 导出全部配置 + 内容包导出/导入 |
| 关于 | 版本号 |

入口：
- 油猴菜单 `⚙ 设置` → `unsafeWindow._ltOpenSettings()`
- 提示词面板「设置」tab → 关闭面板 + 调用 `_ltSettingsPanel()`

## 第六节：菜单 + 持久化（`src/main.js`）

```js
var _toggles = {
    perf: function(v){ document.body.classList.toggle('perf-mode', v); },
    hide: function(v){ document.body.classList.toggle('perf-hide-imgs', v); },
    grid: function(v){
        var bg = document.querySelector('.react-flow__background');
        if(bg) bg.classList.toggle('perf-no-grid', v);
    },
    edges: function(v){ ... },
    focus: function(v){ document.body.classList.toggle('libtv-focus', v); },
};
```

`_read()` / `_apply()` / `_click()` 负责 localStorage ↔ body class 同步。

油猴菜单（2 项）：
- `⚙ 设置` → `unsafeWindow._ltOpenSettings()`
- `🔍 诊断` → DOM 诊断面板

## 内容包

导出结构：
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

导入支持「整体替换」和「合并去重」两种模式。

## 安全

- 所有用户/内容包来源数据的 `innerHTML` 插入点均经过 `_ltEsc()` 转义（`& < > "`）
- API Key 存 `localStorage._lt_prompt_api`，设置面板中显示为 password 输入框

## 注意事项

- 油猴沙箱中创建的变量在注入脚本中不可见，反之亦然
- `unsafeWindow` 需要 `@grant unsafeWindow`
- edge 的 `aria-label` 可能包含不可见 Unicode 字符（零宽空格等），需 `.trim()` 后再匹配
- 直角连线 Observer 观察 `.react-flow` 父级（非 `.react-flow__edges` 自身），防 React 重建后失效
- 标签 MutationObserver 使用 100ms 防抖 + `setInterval` 1.5 秒轮询兜底
- 所有 `_lt_*` localStorage 键的读写统一定义在脚本中，无外部依赖
- 编辑 `src/` 下的源码后必须执行 `node build.js` 重新生成 `.user.js`
- `node --check src/inject.js` 可直接验证注入脚本语法，无需构建
- 不要直接编辑 `libtv-boost.user.js` — 它是构建产出，下次 `node build.js` 会被覆盖

### ⚠️ Hook 注入（构建自动处理）

注入脚本通过 `<script>` 注入到页面上下文。`build.js` 自动将 `src/inject.js` 转换为数组形式嵌入模板。开发者**不需要**手动维护数组格式：

```js
// 这是 build.js 产出的代码，不是手写的
hook.textContent = [/* build 自动生成的数组 */].join('\n');
```

> 数组格式的引号/逗号/转义全部由 `node build.js` 自动处理。如果有语法错误，`node --check libtv-boost.user.js` 会在构建时报错，不会静默吞掉。

### 🪤 转义注意事项（v1.9.10 +）

> 旧版的三重转义陷阱（层①：数组元素格式转义）**已由 `build.js` 自动处理**。开发者只需关心两层：

| 层 | 上下文 | 转义目标 | 示例 |
|---|--------|---------|------|
| ~~①~~ | ~~数组元素 `'...'`~~ | ~~`build.js` 自动处理，无需手动操作~~ | 已自动化 |
| ① (原②) | 注入脚本中的 JS 字符串：`"..."` | 双引号字符串内的转义 | `\"` → `"`, `\\` → `\` |
| ② (原③) | HTML 属性值 | HTML entity | `&` → `&amp;` |

**注入脚本（`src/inject.js`）是正常 JS 文件，字符串行为就是标准 JS：**

```js
"... value=\"" + _ltEsc(n) + "\">..."
//        ^^      标准 JS：\" 是转义双引号
```

**调试方法：** 直接对源文件做 `node --check`：
```bash
node --check src/inject.js
```

**判断出错层次的速查：**
- `node --check src/inject.js` 报错 → JS 字符串语法错误
- `node --check src/inject.js` 通过但浏览器里效果不对 → HTML 转义问题（`_ltEsc()` 漏调）
- `node build.js` 报错或产出文件语法错误 → `build.js` 的转义逻辑有 bug

## 更新日志

### v1.10.1
- AI 面板定位重构：从图标按钮位置弹出（右上对齐），替代屏幕居中
- 按钮样式修复：使用内联样式替代 `.ltp-btn` CSS 类（因作用域限定于 `#libtv-prompt`）
- 布局修正：任务标签、textarea、自定义 system prompt padding 统一对齐
- 删除无用 CSS 规则 `#lt-ai-panel .ltp-status`

### v1.10.0
- 输入框内联 AI 快捷按钮（🤖），点击直接运行当前预设策略
- 结果预览弹窗，支持预设切换、替换/复制/取消操作
- 未配置 API 时引导至设置面板
- 图标跟随输入内容自动显示/隐藏

### v1.9.11
- **构建系统重构**：单体 `.user.js` 拆分为模块化 `src/` 目录（`style.css` / `inject.js` / `main.js`）+ `build.js` 构建脚本
- 开发工作流：编辑 `src/` 下源码 → `node build.js` 组装
- CSS 改为纯 `.css` 文件，获得完整 IDE 语法高亮、自动补全、颜色预览
- 注入脚本改为纯 `.js` 文件，`node --check src/inject.js` 直接验证语法
- 数组格式的引号/逗号/转义由构建自动处理，不再手动维护

### v1.9.10
- 提示词模板列表重构：`prompt()` 改为内联表单弹窗（名称/分类/内容独立输入区）
- 列表项改为分类徽章 + 预览 (120字/2行) + 始终可见的操作按钮（复制/查看/编辑/删除）
- 新增查看弹窗：选中模板可查看完整内容 + 一键复制
- 点击模板非按钮区域自动执行复制

### v1.9.9
- AI 增强 tab 重构：预设策略任务（✨润色 📏扩写 ✂️缩写 🌐中→英 🌐英→中）+ ⚙自定义 system prompt（localStorage 自动保存）
- 结果区改为原文/增强结果对比布局，显式「写回源输入框」「复制」按钮，替代旧版点击文本写入
- `Ctrl+Enter` 快捷执行、textarea 自动增高
- 多账号切换功能（Cookie + localStorage 快照、保存/切换/刷新/删除）
- 账号入口放在提示词面板头部 👤 按钮，面板浮动在按钮下方
- 首次使用引导面板（`_ltShowWelcome`，首次进画布弹出，设置 > 关于可重新显示）
- 修复 AI 请求 `r.json()` 未检查 `r.ok` 导致的 "Unexpected end of JSON input"（HTTP 错误时 body 为空）
- 修复欢迎面板 MutationObserver 定时器堆积导致的鬼畜（`_ltWelcomePending` 标志位 + DOM 存在性检查）

### v1.9.8
- 首次使用引导面板（520px 毛玻璃卡片、快捷键速览/功能标签/小提示、3 秒延迟防加载拦截）
- 设置 > 关于新增「帮助 / 重新显示引导」按钮

### v1.9.7
- 面板 CSS 全部改用 CSS 变量（`var(--accent-light)` / `rgba(var(--accent-light-rgb), X)`），切主题时面板边框/阴影/按钮色/聚焦色自动跟随
- 主题预设从 14 个扩充到 29 个（+9 dark +4 light +2 high-contrast）

### v1.9.6
- 移除所有节点视觉美化 CSS（玻璃质感、全息投影、连线发光、画布辉光、面板压暗）— 修复远距缩放节点自动变大的 bug
- 悬浮按钮改为 `_createBtn`/`_removeBtn` + `MutationObserver` 监听 `.react-flow` 出现/消失，只在画布页面显示
- 版本号 1.9.3→1.9.6、图标换 GitHub raw、署名 `oocc00`、MIT 协议
- 性能优化：移除重复的 `_ltTagScan` / `console.log` / FPS 后台空帧 / 重复 `var` / `alert()`→`_ltToast` / `localStorage` try/catch / 未使用 CSS 变量
- **修复 hook 注入缺少 try/catch 导致静默失败** — 注入脚本数组语法错误时外层 IIFE 整段挂掉，标签/提示词/AI/设置面板全部不执行。加 try/catch 后错误暴露 + 恢复 `setInterval` 轮询兜底

### v1.9.5
- 悬浮提示词按钮仅在画布页面（`.react-flow` 存在时）显示，非画布页面（首页等）不再出现
- 修复清爽首页开关导致设置面板/Toast 无法显示的问题（移除设置面板 CSS 的 `body.libtv-clean-home` 前缀）

### v1.9.4
- 新增清爽首页开关（`N` 键 / 设置面板 toggle），首页/全部项目页布局优化 + 隐藏干扰元素
- 页面视觉微调：节点玻璃质感、选中全息光晕、连线 hover 发光、画布多色渐变辉光、面板打开自动压暗、Toast 通知
- 新增 AI Agent Drawer 适配（MutationObserver 右推 FPS/浮动按钮）
- 新增流动光效 SVG overlay

### v1.8.3
- 首页/全部项目页布局优化 CSS（1200px/1800px 限宽、3/6 列网格、卡片尺寸、面包屑、分区标题等）
- 隐藏干扰元素（顶部 Banner、会员超市、帮助按钮、Mantine 图标、轮播/AI 输入区等）
