# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、标签系统、画布主题、设置面板等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

**当前版本：** 1.9.10  |  **作者：** oocc00  |  **协议：** MIT

## 文件结构

| 文件 | 说明 |
|------|------|
| `libtv-boost.user.js` | 油猴单文件脚本，拖进 Tampermonkey 安装 |
| `perf-script-dev.md` | 本文档 |
| `libtv-content-pack.json` | 内容包导出示例 |

## 脚本整体结构

脚本是一个完整的单文件 IIFE，分 6 个节（按行号区间）：

| 节 | 行号（约） | 内容 |
|----|-----------|------|
| 1 | 20–760 | **CSS 注入** — 数组 `[...].join('\n')`，所有视觉样式 |
| 2 | 762–840 | **FPS 面板** — 拖拽 + RAF 帧率循环 |
| 3 | 843–926 | **流动光效** — SVG overlay，选中节点发光描边动画 |
| 4 | 929–962 | **AI Agent Drawer 适配** — MutationObserver 动态右推 |
| 5 | 964–1960 | **注入脚本** — `<script>` 元素注入到页面上下文的 JS |
| 6 | 1963–2067 | **菜单开关 + 持久化** — GM_registerMenuCommand + localStorage |

### 双沙箱通信

油猴沙箱（第 6 节）通过 `unsafeWindow` 调用注入脚本（第 5 节）的函数：

```
油猴沙箱                         注入脚本（页面上下文）
───────                         ────────────────────
unsafeWindow._ltShowTagMenu(ta)  ← window._ltShowTagMenu
unsafeWindow._ltOpenSettings()   ← window._ltOpenSettings
unsafeWindow._ltContent          ← window._ltContent
```

注入脚本中的 `_lt*` 变量在 IIFE 内部，不污染全局。暴露给外层的接口通过 `window._lt*` 显式导出。

## 第一节：CSS 注入（约第 20–760 行）

样式以数组形式注入：

```js
var style = document.createElement('style');
style.textContent = [ '/* CSS */', '.class { rule; }', ].join('\n');
document.head.appendChild(style);
```

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

开关类名在 CSS 注入数组 + 快捷键 handler + 设置面板三处同步维护。

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

## 第二节：FPS 面板（约第 762–840 行）

DOM 创建 + 拖拽 + RAF 循环：
- `#libtv-fps` 浮动面板，显示 FPS、缩放、节点数、开关状态
- 可拖拽（mousedown/mousemove/mouseup）
- 悬停时显示快捷键提示卡片 `#libtv-help`

## 第三节：流动光效（约第 843–926 行）

全屏 SVG overlay（`#libtv-glow`），`z-index:50`，`pointer-events:none`。

对每个 `.react-flow__node.selected`，生成沿节点边框运动的虚线描边动画：
- 色调：读取 `--accent` / `--accent-light`
- 动画周期：7000ms
- 光晕：`feGaussianBlur(stdDeviation=6)`
- 性能模式下自动隐藏

## 第四节：AI Agent Drawer 适配（约第 929–962 行）

MutationObserver 监听 `body`，检测右侧 AI Agent Drawer 的出现。当 drawer 打开时，将 FPS 面板和浮动按钮右推避免遮挡。

## 第五节：注入脚本（约第 964–1960 行）

通过 `<script>` 注入到页面上下文执行。这是脚本的核心，所有画布交互逻辑都在这里。

### 子模块

| 子模块 | 行号（约） | 功能 |
|--------|-----------|------|
| 链高亮引擎 | ~968 | BFS 图遍历、`_ltAutoChain` 自动模式 |
| 连线 hover 高亮 | ~1020 | mouseover/mouseout 切换 `.libtv-edge-active` |
| 节点搜索 | 1038–1080 | 浮动搜索面板，按文本过滤节点 |
| 提示词工具 | 1082–1286 | 模板 / AI / 主题 / 调色板 / 设置 tab |
| 标签系统 | ~1289 | 四层结构：库→分类→分组→标签 |
| 浮动按钮 | ~1580 | 可拖拽的提示词工具按钮（仅画布页面显示） |
| 直角连线 | ~1612 | 贝塞尔→折线重写 |
| 快捷键 | ~1648 | 11 个快捷键 handler |
| 内容包 | ~1752 | 导出/导入 JSON |
| 账号切换 | ~1492 | Cookie + localStorage 快照、多账号保存/切换/刷新/删除 |
| 首次引导 | ~1775 | `_ltShowWelcome()` + 帮助面板（设置页可重新弹出） |
| 设置面板 | ~2046 | `_ltSettingsPanel()` 函数 |
| AI 增强重构 | ~1325 | 预设策略(润色/扩写/缩写/翻译) + 自定义 system prompt + 原文对比结果区 |

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

| 键 | handler 行 | 功能 |
|----|-----------|------|
| `Escape` | ~1670 | 关闭面板 + 清除链高亮 |
| `G` | ~1686 | 网格 toggle |
| `T` | ~1695 | 性能 toggle |
| `H` | ~1703 | 隐藏图片 toggle |
| `L` | ~1711 | 隐藏连线 toggle |
| `C` | ~1720 | 自动链 toggle |
| `F` | ~1730 | 搜索面板开关 |
| `P` | ~1737 | 提示词面板开关 |
| `X` | ~1744 | 专注 toggle |
| `R` | ~1752 | 直角连线 toggle |
| `?` / `/` | ~1761 | 帮助提示 pin |
| `N` | ~1761 | 清爽首页 toggle |

#### 设置面板

`_ltSettingsPanel()` 函数（约第 1865 行）创建独立浮动面板：

| 分区 | 实现 |
|------|------|
| 开关 | 6 个 toggle（性能/隐藏图片/隐藏连线/隐藏网格/专注/清爽首页），操作 `localStorage._lt_*` + `body.classList` |
| API | URL / Key / Model，存 `localStorage._lt_prompt_api` |
| 数据管理 | 3 项（标签库/当前库/历史）+ 导出全部配置 + 内容包导出/导入 |
| 关于 | 版本号 |

入口：
- 油猴菜单 `⚙ 设置` → `unsafeWindow._ltOpenSettings()`
- 提示词面板「设置」tab → 关闭面板 + 调用 `_ltSettingsPanel()`

## 第六节：菜单 + 持久化（约第 1963–2067 行）

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

### ⚠️ Hook 注入陷阱（已踩坑）

注入脚本通过数组拼字符串创建：
```js
var hook = document.createElement('script');
hook.textContent = [
    '(function(){',
    '  ...',
    '})();'
].join('\n');
document.body.appendChild(hook);
```

**这个数组只要有一个字符串的逗号/引号/缩进出错，整个外层脚本就静默挂掉，后续代码（设置面板同步、快捷键、诊断菜单等）全部不执行。** 连 F12 都看不到报错，因为错误发生在油猴沙箱内且被吞了。

**正确做法：** 始终用 try/catch 包裹：
```js
var hook;
try {
    hook = document.createElement('script');
    hook.textContent = [ ... ].join('\n');
    document.body.appendChild(hook);
} catch(e) {
    console.error('[LibTV] Hook error:', e);
    // 开发期间弹 alert 方便定位，发布前可移除
    if (typeof alert !== 'undefined') alert('LibTV hook error: ' + e.message);
}
```

> 在数组中间插入/删除行时，**特别留意**：
> - 每行必须是完整的 `'字符串',` 格式（末尾逗号）
> - 删除行后检查上下的逗号是否多出或缺失
> - 数组字符串的缩进只影响源码可读性，不影响执行
> - 优先用编辑器语法高亮检查数组语法

### 🪤 三重转义陷阱（v1.9.10 +）

注入脚本里拼 `innerHTML` 时如果混入 JS 变量拼接，会涉及 **三层转义**，很容易漏一层导致语法错误：

| 层 | 上下文 | 转义目标 | 示例 |
|---|--------|---------|------|
| ① | `user.js` 的数组元素：`'...'` | 把注入脚本的源代码当字符串值放进数组 | `\\` → `\`, `\"` → `"` |
| ② | 注入脚本中的 JS 字符串：`"..."` | 双引号字符串内的转义 | `\"` → `"`, `\\` → `\` |
| ③ | HTML 属性值 | HTML entity | `&` → `&amp;` |

**典型错误 — 拼接 `value` 属性（v1.9.10 踩坑）：**

想生成的注入脚本代码：
```js
"... value=\"" + _ltEsc(n) + "\">..."
//       ^闭字符串  ^开新字符串
```

在数组元素（单引号字符串）里写成：
```js
'... value=\\"\\"+_ltEsc(n)+"\\"...'
//         ^^^^^^                    层①：\\ → \, \" → "，得到 value=\"\"
//                                    即层②里的 \"\" 两个转义双引号，_ltEsc(n) 被关在字符串里面了
```

正确写法 — 让层②的 `\"` 闭字符串，`_ltEsc(n)` 在外面：
```js
'... value=\\"" + _ltEsc(n) + "\\"...'
//         ^^^^                       层①：\\ → \, "" → ""，得到 value=\""
//                                    层②：\" 是转义双引号，后面的 " 闭字符串 → value="
//                                    _ltEsc(n) 在字符串外面做拼接
```

**调试方法：** 把注入脚本 dump 出来用 `node --check` 检查语法：
```bash
# 从 user.js 提取数组 → eval → join('\n') → node --check
node -e "
const c = require('fs').readFileSync('libtv-boost.user.js','utf-8');
const s = c.indexOf('hook.textContent = ['), e = c.indexOf('].join', s);
const arr = eval('[' + c.substring(s + 21, e) + ']');
require('fs').writeFileSync('/tmp/inject.js', arr.join('\n'), 'utf-8');
"
node --check /tmp/inject.js
```

**判断哪一层出错的速查：**
- `node --check` 报错 → 层② 语法错误（JS 字符串引用/转义问题）
- array 的 `eval` 失败 → 层① 语法错误（数组元素格式问题）
- `node --check` 通过但浏览器里效果不对 → 层③ HTML 转义问题（`_ltEsc()` 漏调）

## 更新日志

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
