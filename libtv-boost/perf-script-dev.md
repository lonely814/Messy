# LibTV Boost — 开发文档

## 概述

Tampermonkey 油猴脚本，为 liblib.tv / iblib.tv 的 React Flow 画布提供性能优化、视觉增强、AI 提示词工具、标签系统、画布主题、设置面板等功能。匹配 `*://*.liblib.tv/*` 和 `*://*.iblib.tv/*` 域名。

**当前版本：** 1.10.11  |  **作者：** oocc00  |  **协议：** MIT

## 文件结构

| 文件                        | 说明                                                                |
| ------------------------- | ----------------------------------------------------------------- |
| `src/style.css`           | **CSS 源码** — 638 行，完整 IDE 语法高亮/自动补全/颜色预览                          |
| `src/inject.js`           | **注入脚本源码** — 2246 行，页面上下文执行的 JS IIFE                              | **注入脚本源码** — 2088 行，页面上下文执行的 JS IIFE                              |
| `src/main.js`             | **主模板** — 油猴 IIFE 骨架，含 `__INJECT_CSS__` / `__INJECT_SCRIPT__` 占位符 |
| `build.js`                | **构建脚本** — 零依赖 Node 脚本，组装源码 → `.user.js`                          |
| `libtv-boost.user.js`     | **构建产出** — 拖进 Tampermonkey 安装。不要直接编辑此文件                           |
| `perf-script-dev.md`      | 本文档                                                               |
| `libtv-content-pack.json` | 内容包导出示例                                                           |

**工作流：** 编辑 `src/` 下的源码 → `node build.js` → 产出 `libtv-boost.user.js`。

## 开发交接（给下个会话 / 协作者）

> 这一节是「非显而易见、且容易重蹈覆辙」的信息汇总。常规实现细节见下方各节与「踩坑记录」。

### 1. 最反直觉的架构约定：双沙箱 + GM 特权 API 透传

脚本运行在**两个上下文**，这是本项目最容易踩坑的地方：

- **油猴沙箱（`src/main.js`）**：有 `unsafeWindow`、`GM_*` 特权 API。
- **页面上下文（`src/inject.js`，通过 `<script>` 注入）**：只有 `window`，**没有 `unsafeWindow` 标识符**，也没有 `GM_*`（`GM_xmlhttpRequest` 等）。

**跨上下文传东西的规则**：

- 沙箱 → 页面：沙箱里 `unsafeWindow.__xxx = ...`（因为沙箱的 `unsafeWindow` 实际指向页面 `window`），页面里用 `window.__xxx` 取。**绝不要在页面上下文写 `unsafeWindow`**（会抛 `unsafeWindow is not defined`）。
- 页面 → 沙箱：把函数挂到 `window._xxx`，沙箱用 `unsafeWindow._xxx` 调用。

**AI 请求必须用 `GM_xmlhttpRequest` 代发**（见第 4 点），相关透传已在 main.js 写好：`unsafeWindow.__ltGMXHR = GM_xmlhttpRequest`；inject.js 里封装为 `_ltXHR()`。**不要再改回原生 `fetch` 直连**——那会重新引入 CORS 问题。

### 2. 版本号只在 `build.js` 维护

- 唯一真相源：`build.js` 顶部的 `const VERSION`。改版本只改这一处。
- 源码里版本用占位符，构建时从 build.js 顶部 `VERSION` 常量自动注入。**不要去源码里手写版本号**：
  - `src/main.js` 用 `__VERSION__`（→ `@version` 元数据）
  - `src/inject.js` 用 `__LT_VER__`（→ 设置面板「关于」版本徽章，v1.10.10 起接入）
- 文档里的版本号（概述、更新日志）需手动同步。

### 3. 改动后必须提交进 git

- 曾经发生过：会话中对 `src/` 的编辑写到了临时副本、未落回仓库，导致 CORS 修复等改动**全部丢失、git 里也查无此项**（任何历史 commit 都没有）。
- **纪律**：每完成一个功能/修复，立刻 `node --check` + `node build.js` + `git commit`。不要依赖"会话结束自动保存"。

### 4. 第三方网关 CORS 是常态问题，GM_xmlhttpRequest 是标准解法

- 现象：用户自托管/中转网关（如 `https://xxx:16666/v1`）在 Postman、后端、其他软件都能连，但脚本里 `fetch` 直连报 `Failed to fetch`，而 DeepSeek（官方带 CORS 头）、本地 llama（`localhost` 豁免）却能连。
- 根因：页面上下文的 `fetch` 跨域触发浏览器 CORS 预检，网关没返 `Access-Control-Allow-Origin` 就被拦。
- 解法：一律走 `GM_xmlhttpRequest`（油猴扩展代发，绕过页面 CORS）。已实现 `_ltXHR()` 封装，对话/拉模型都走它，回退原生 `fetch` 仅作兜底。
- 拉模型用多端点探测 `/v1/models` → `/models`，404 自动回退。
- 详见「踩坑记录」第 10 条。

### 5. 已知待优化 / 后续方向（供参考，非必须）

- AI 面板错误提示可更细（区分鉴权 401、网关格式不符等）。
- 模型列表未做本地缓存，每次点「拉取」都重新请求；可考虑缓存到 localStorage 减少请求。
- 连接测试目前只发 `ping`，对部分只认特定 body 的网关兼容性可增强。
- 站点（liblib.tv）DOM 结构会改版，所有选择器需保留"自证/兜底"能力（见踩坑记录第 3 条）。

### 6. 测试入口

- `node --check src/inject.js` / `node --check libtv-boost.user.js`：语法校验（无需浏览器）。
- `test-step-algo.js`：电路板连线算法（`_ltStep*`）的几何单测，用 DOM stub 抽取 inject.js 对应代码块跑通，改连线算法后必跑。

## 构建系统

`build.js` 是一个零依赖（仅 `node:fs` / `node:path`）的纯字符串处理脚本。

**构建过程：**

1. 读取 `src/style.css`，按行分割，每行转成单引号字符串（自动转义 `\` / `'` / CRLF）
2. 读取 `src/inject.js`，同上处理
3. 读取 `src/main.js` 模板，将 CSS 数组替换 `__INJECT_CSS__`，注入脚本数组替换 `__INJECT_SCRIPT__`
4. 将 `build.js` 顶部的 `VERSION` 常量注入占位符：main.js 的 `__VERSION__`（`@version` 元数据）、inject.js 的 `__LT_VER__`（设置面板「关于」徽章）
5. 写出 `libtv-boost.user.js`

**版本号维护：** 统一在 `build.js` 顶部 `VERSION` 常量修改，构建时自动注入，不再手动改源码。文档中的版本号仍需手动同步。

**加新文件的流程：** 在 `build.js` 的 `build()` 函数中加一行 `read()` + `replace()` 链即可。

**语法验证：**

```bash
node build.js                              # 构建
node --check libtv-boost.user.js           # 验证产出语法
node --check src/inject.js                 # 直接验证注入脚本语法（无需构建）
```

## 脚本整体结构

`build.js` 将 `src/` 下的源码组装进 `src/main.js` 模板，产出单文件 `.user.js`。

| 源代码             | 对应运行时位置                     | 说明                                    |
| --------------- | --------------------------- | ------------------------------------- |
| `src/main.js`   | IIFE 外层                     | 油猴沙箱上下文：FPS 面板、流动光效、Drawer 适配、菜单开关、诊断 |
| `src/inject.js` | `<script>` 注入到页面上下文         | 所有画布交互逻辑：链高亮、搜索、标签、提示词、主题、快捷键、设置面板    |
| `src/style.css` | `style.textContent = [...]` | 所有视觉样式，通过构建自动嵌入                       |

### 双沙箱通信

油猴沙箱（`src/main.js`）通过 `unsafeWindow` 调用注入脚本（`src/inject.js`）的函数：

```
油猴沙箱                         注入脚本（页面上下文）
───────                         ────────────────────
unsafeWindow._ltShowTagMenu(ta)  ← window._ltShowTagMenu
unsafeWindow._ltOpenSettings()   ← window._ltOpenSettings
unsafeWindow._ltDiag             ← window._ltDiag（图标扫描自检，诊断菜单读取）
unsafeWindow._ltContent          ← window._ltContent
```

注入脚本中的 `_lt*` 变量在 IIFE 内部，不污染全局。暴露给外层的接口通过 `window._lt*` 显式导出。

> ⚠️ **页面上下文里没有 `unsafeWindow` 标识符。** `unsafeWindow` 只存在于油猴沙箱（main.js）。沙箱里的 `unsafeWindow` 实际指向页面 `window`，所以 `unsafeWindow.__ltGMXHR = GM_xmlhttpRequest` 会把函数挂到页面的 `window.__ltGMXHR` 上；注入脚本必须用 `window.__ltGMXHR` 去取，不能用 `unsafeWindow`（否则报 `unsafeWindow is not defined`）。详见「踩坑记录」第 10 条。

#### 油猴特权 API 透传（CORS 绕过）

AI 对话与模型拉取原本用页面上下文的 `fetch` 直连第三方网关，会被浏览器 **CORS** 拦截（自托管/中转网关常不返 CORS 头，而 Postman、后端调用不受影响）。解决方案：用油猴特权 API `GM_xmlhttpRequest` 由扩展代发请求，绕过页面 CORS。

模式（单向透传：沙箱 → 页面）：

```js
// main.js（油猴沙箱，有 unsafeWindow / GM_*）
try { unsafeWindow.__ltGMXHR = GM_xmlhttpRequest; } catch(e) {}

// inject.js（页面上下文，只有 window）
function _ltXHR(opts){
  var gm = window && window.__ltGMXHR;   // 注意：不是 unsafeWindow
  if (gm) return new Promise(function(res,rej){ /* GM 代发，绕过 CORS */ });
  return fetch(opts.url, opts);          // 兜底：原生 fetch（仍受 CORS 约束）
}
```

- 元信息需声明 `@grant GM_xmlhttpRequest` 与 `@connect *`（通配，分发后不会逐个域名弹确认）。
- `_ltAIChat()` 与 `_ltFetchModels()` 全部改用 `_ltXHR()` 封装，保持原 Promise 接口，上层逻辑零改动。
- `GM_xmlhttpRequest` 的 `onload` 返回 `{status, responseText}`，需自行判 `status` 与 `JSON.parse`。

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

| 类名                 | 作用元素                      | 功能             | localStorage    |
| ------------------ | ------------------------- | -------------- | --------------- |
| `perf-mode`        | `body`                    | 去阴影/模糊/动画/滤镜   | `_lt_perf`      |
| `perf-hide-imgs`   | `body`                    | 隐藏节点图片         | `_lt_hide`      |
| `perf-no-grid`     | `.react-flow__background` | 隐藏网格           | `_lt_grid`      |
| `perf-hide-edges`  | `.react-flow__edges`      | 隐藏连线           | `_lt_edges`     |
| `libtv-focus`      | `body`                    | 专注模式（隐藏侧栏）     | `_lt_focus`     |
| `libtv-chain`      | `body`                    | 链高亮激活          | —               |
| `libtv-autochain`  | `body`                    | 自动链模式          | `_lt_autochain` |
| `libtv-step-edges` | `body`                    | 电路板连线（避让式直角路由） | `_lt_step`      |

### 视觉改造（v1.9.3，v1.9.6 已移除）

以下视觉改造在 v1.9.6 中已全部移除（因导致节点缩放 bug），节点恢复 React Flow 原生外观：

| ~~改造项~~  | ~~效果~~                                                  | 状态    |
| -------- | ------------------------------------------------------- | ----- |
| 节点卡片     | ~~玻璃质感（`backdrop-filter: blur(8px)` + 微透明背景 + 微边框）~~    | ❌ 已移除 |
| 节点悬浮     | ~~hover 时边框提亮 + 阴影上浮~~                                  | ❌ 已移除 |
| 选中节点     | ~~全息光晕（`box-shadow` 四层叠加）+ 边框变 accent 色~~               | ❌ 已移除 |
| 连线       | ~~2px 粗 + hover 发光描边~~                                  | ❌ 已移除 |
| 链高亮连线    | ~~2.8px + 8px 发光滤镜~~                                    | ❌ 已移除 |
| 画布背景     | ~~多色渐变辉光（跟随主题 accent 色）~~                               | ❌ 已移除 |
| 面板打开     | ~~画布自动压暗（`brightness(0.7) saturate(0.5)`）~~             | ❌ 已移除 |
| ~~性能模式~~ | ~~一键关闭所有玻璃/发光/动画效果~~                                    | —     |
| 清爽首页     | ~~CSS 布局优化 + 隐藏干扰元素~~（v1.10.7 改为跳转，v1.10.8 站点频繁改版，完全移除） | ❌ 已移除 |

> ⚠️ `transform` 属性被 React Flow 用于节点定位，CSS 中不能覆盖。所有视觉效果使用 `box-shadow` / `filter` / `backdrop-filter` 实现。

开关类名在 `src/style.css` + `src/inject.js`（快捷键 handler）+ `src/inject.js`（设置面板）三处同步维护。

### CSS 主题变量

`:root` 定义的 CSS 变量：

| 变量               | 含义        | 默认值                      |
| ---------------- | --------- | ------------------------ |
| `--accent`       | 主色调       | `#6366f1`                |
| `--accent-light` | 亮色调       | `#818cf8`                |
| `--accent-dark`  | 暗色调       | `#4f46e5`                |
| `--accent-rgb`   | RGB（逗号分隔） | `99,102,241`             |
| `--canvas-bg`    | 画布背景      | `#0f0f0f`                |
| `--node-bg`      | 节点背景      | `#1a1a2e`                |
| `--border-color` | 节点边框      | `rgba(255,255,255,0.12)` |
| `--edge-color`   | 连线色       | `rgba(255,255,255,0.08)` |

### 设置面板 CSS

设置面板使用独立样式（不与提示词面板共用）：

| 选择器                                                                 | 用途              |
| ------------------------------------------------------------------- | --------------- |
| `.lt-settings`                                                      | 面板容器（居中对齐，霓虹玻璃） |
| `.lt-settings-head` / `.lt-settings-close`                          | 头部 + 关闭         |
| `.lt-settings-body`                                                 | 滚动内容区           |
| `.lt-settings-sec` / `.lt-settings-stitle`                          | 分区标题            |
| `.lt-settings-toggle` / `.lt-settings-switch`                       | 滑动开关            |
| `.lt-settings-btn` / `-primary` / `-ghost` / `-sm`                  | 按钮              |
| `.lt-settings-row` / `.lt-settings-inp`                             | 输入行             |
| `.lt-settings-dlist` / `.lt-settings-ditem` / `.lt-settings-dclear` | 数据管理清单          |
| `.lt-settings-about`                                                | 关于区             |
| `.lt-settings-cpbtns`                                               | 内容包按钮行          |

## 第二节：FPS 面板（`src/main.js`）

DOM 创建 + 拖拽 + RAF 循环：

- `#libtv-fps` 浮动面板，显示 FPS、缩放、节点数、开关状态
- 可拖拽（mousedown/mousemove/mouseup）
- 悬停时显示快捷键提示卡片 `#libtv-help`

## 第三节：流动光效（`src/main.js`）

全屏 SVG overlay（`#libtv-glow`），`z-index:50`，`pointer-events:none`。

对每个 `.react-flow__node.selected` 生成沿节点边框运动的双流光（双层 × 180° 对位）：

- 结构：模糊光带（accentLight，7px，13% 周长）+ 白色亮线（2px，13% 周长），第二条 offset+周长/2
- 色调：读取 `--accent` / `--accent-light`
- 动画周期：7000ms/圈，每节点独立计时（t0），固定从顶边中点出发
- 光晕：`feGaussianBlur(stdDeviation=6)`（固定，不随缩放）
- 性能：元素缓存（帧内只改 dashoffset/opacity，零 DOM 重建）、30fps 节流、200ms 淡入 / 150ms 淡出
- 性能模式下自动隐藏
  
  ## 第四节：AI Agent Drawer 适配（`src/main.js`）

MutationObserver 监听 `body`，检测右侧 AI Agent Drawer 的出现。当 drawer 打开时，将 FPS 面板和浮动按钮右推避免遮挡。

## 第五节：注入脚本（`src/inject.js`）

通过 `<script>` 注入到页面上下文执行。这是脚本的核心，所有画布交互逻辑都在这里。编辑 `src/inject.js`，构建时自动嵌入。

### 子模块

| 子模块         | 功能                                              |
| ----------- | ----------------------------------------------- |
| 链高亮引擎       | BFS 图遍历、`_ltAutoChain` 自动模式                     |
| 连线 hover 高亮 | mouseover/mouseout 切换 `.libtv-edge-active`      |
| 节点搜索        | 浮动搜索面板，按文本过滤节点                                  |
| 提示词工具       | 模板 / AI / 主题 / 调色板 / 设置 tab                     |
| 标签系统        | 四层结构：库→分类→分组→标签                                 |
| 浮动按钮        | 可拖拽的提示词工具按钮（仅画布页面显示），5 套「极简描边」样式右键循环             |
| 电路板连线       | 避让式直角路由（节点避让 + 边缘引出 + 圆角），`R` 键开关               |
| 快捷键         | 11 个快捷键 handler                                 |
| 内容包         | 导出/导入 JSON                                      |
| 账号切换        | Cookie + localStorage 快照、多账号保存/切换/刷新/删除         |
| 首次引导        | `_ltShowWelcome()` + 帮助面板（设置页可重新弹出）             |
| 设置面板        | `_ltSettingsPanel()` 函数                         |
| AI 增强重构     | 预设策略(润色/扩写/缩写/翻译) + 自定义 system prompt + 原文对比结果区 |
| 积分⇄人民币换算    | `_ltCreditScan()` 在积分数值旁注入 `.lt-rmb` 估值标签（`_ltRate` 默认 15:1） |

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

**API 相关键（v1.10.10）：**
_lt_prompt_api   // 当前生效配置 {id,url,key,model}
_lt_api_presets  // 预设列表 [{id,name,url,key,model}]
_lt_models_cache|{base}|{key}  // 模型列表缓存（24h 过期，换地址/Key 自动失效）
```

**核心函数：**

| 函数                           | 作用                  |
| ---------------------------- | ------------------- |
| `_ltShowTagMenu(ta)`         | 打开标签面板，绑定事件         |
| `_ltCloseTagMenu()`          | 关闭标签面板              |
| `_ltRenderTagMenu()`         | 渲染面板：库下拉、分类 Tab、内容区 |
| `_ltRenderCat(cat)`          | 渲染某分类的内容            |
| `_ltRenderSearch()`          | 全局搜索结果              |
| `_ltInsertTagAtCursor(text)` | 光标位置插入文本            |
| `_ltEsc(s)`                  | HTML 转义（防 XSS）      |

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

| 键         | 功能                    |
| --------- | --------------------- |
| `Escape`  | 关闭面板 + 清除链高亮          |
| `G`       | 网格 toggle             |
| `T`       | 性能 toggle             |
| `H`       | 隐藏图片 toggle           |
| `L`       | 隐藏连线 toggle           |
| `C`       | 自动链 toggle            |
| `F`       | 搜索面板开关                |
| `P`       | 提示词面板开关               |
| `X`       | 专注 toggle             |
| `R`       | 电路板连线 toggle（避让式直角路由） |
| `?` / `/` | 帮助提示 pin              |

#### 设置面板

`_ltSettingsPanel()` 函数（`src/inject.js`）创建独立浮动面板：

| 分区   | 实现                                                                          |
| ---- | --------------------------------------------------------------------------- |
| 开关   | 5 个 toggle（性能/隐藏图片/隐藏连线/隐藏网格/专注），操作 `localStorage._lt_*` + `body.classList` |
| API  | URL / Key / Model，存 `localStorage._lt_prompt_api`                           |
| 数据管理 | 3 项（标签库/当前库/历史）+ 导出全部配置 + 内容包导出/导入                                          |
| 关于   | 版本号                                                                         |

**AI API 请求机制（v1.10.8 重构）：**

- 对话 `_ltAIChat()` 与模型拉取 `_ltFetchModels()` 统一走 `_ltXHR()` 封装，优先 `GM_xmlhttpRequest`（油猴扩展代发，**绕过 CORS**），不可用回退原生 `fetch`。
- 模型列表拉取多端点探测：按 URL 是否带 `/v1` 智能排序，依次尝试 `/v1/models` → `/models`，404 自动回退下一个；解析兼容 `data` 与 `models` 两种字段。
- 错误可诊断：`_ltModelsErrDesc()` 把 `TypeError`（请求失败）与 HTTP 错误区分提示，避免笼统的 "Failed to fetch"。

入口：

- 油猴菜单 `⚙ 设置` → `unsafeWindow._ltOpenSettings()`
- 提示词面板「设置」tab → 关闭面板 + 调用 `_ltSettingsPanel()`

#### 账号切换系统

**数据流：**

1. `_ltAccSave(name)` → 保存当前 cookie + localStorage 快照到 `_lt_accounts`
2. `_ltAccSwitch(id)` → 恢复目标账号的 cookie + localStorage, 然后 `location.reload()`
3. `_ltAccList()` → 每次调用触发 `_ltAccTryRestore()` 自动恢复

**三级兜底备份（v1.10.2）：**

```
localStorage._lt_accounts（主）
  → cookie._lt_acc_bak（一级备份，60 天）
    → IndexedDB._lt_boost（二级备份：对象仓库 b）
```

- 每次保存/刷新/删除账号时同时写 cookie + IndexedDB
- `_ltAccTryRestore()` 判断 localStorage 丢失后依次尝试 cookie → IndexedDB
- 页面加载时异步从 IndexedDB 提前恢复（`_ltIDBGet` + 回调写回）
- IndexedDB 不会被 `localStorage.clear()` / 服务器 `Set-Cookie` 清除，仅「清除站点数据」可删

**所有 `_lt_` localStorage 键：**

| key                                                                      | 用途                     |
| ------------------------------------------------------------------------ | ---------------------- |
| `_lt_accounts`                                                           | 多账号列表                  |
| `_lt_theme`                                                              | 主题预设                   |
| `_lt_prompts`                                                            | AI 提示词模板               |
| `_lt_prompt_api`                                                         | AI API 配置（URL + model） |
| `_lt_ai_sys`                                                             | 自定义 system prompt      |
| `_lt_ai_custom_presets`                                                  | 自定义预设列表                |
| `_lt_pal_recent`                                                         | 取色器最近色（20 色）           |
| `_lt_pal_fav`                                                            | 取色器收藏                  |
| `_lt_tag_libs`                                                           | 标签库                    |
| `_lt_cur_lib`                                                            | 当前标签库名                 |
| `_lt_recent`                                                             | 已插入标签历史                |
| `_lt_autochain`                                                          | 自动连线开关                 |
| `_lt_first_run`                                                          | 首次引导标识                 |
| `_lt_perf`, `_lt_hide`, `_lt_grid`, `_lt_edges`, `_lt_focus`, `_lt_step` | 开关状态                   |

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
- 电路板连线 Observer 观察 `.react-flow` 父级（非 `.react-flow__edges` 自身），防 React 重建后失效；重写走 RAF 节流，节点包围盒 200ms TTL 缓存
- 电路板连线避让计算在 SVG 用户坐标系进行：节点矩形经 `getScreenCTM().inverse()` 转换，与 `path.getPointAtLength()` 坐标统一；性能模式下降级为方向感知 L 形（跳过避让）
- 算法回归测试：`node test-step-algo.js`（几何检测 / 边缘吸附 / 避让路由 / 圆角生成 23 例）
- 图标扫描：MutationObserver(100ms) + 事件连扫(80/300/800/1500ms) + 1s 轮询三层兜底；图标为 body 浮动元素（fixed 定位 + 稳定性门），不进 React 树
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

| 层      | 上下文                   | 转义目标                       | 示例                     |
| ------ | --------------------- | -------------------------- | ---------------------- |
| ~~①~~  | ~~数组元素 `'...'`~~      | ~~`build.js` 自动处理，无需手动操作~~ | 已自动化                   |
| ① (原②) | 注入脚本中的 JS 字符串：`"..."` | 双引号字符串内的转义                 | `\"` → `"`, `\\` → `\` |
| ② (原③) | HTML 属性值              | HTML entity                | `&` → `&amp;`          |

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

## CSS 现代特性应用（v1.10.2）

已应用的现代 CSS 特性（PC-only，不需要 `@media (hover)`）：

| 特性                            | 用途                              | 数量    |
| ----------------------------- | ------------------------------- | ----- |
| `color-mix()`                 | 替代 `rgba(var(--accent-rgb), N)` | 37 处  |
| `@starting-style`             | 面板入场过渡（display: none → block 时） | 6 个面板 |
| `scrollbar-gutter: stable`    | 防滚动条出现导致布局偏移                    | 7 个容器 |
| `text-wrap: balance`          | 标题自动断行                          | 6 处   |
| `content-visibility: auto`    | 长列表跳过屏外渲染                       | 3 个列表 |
| `backdrop-filter: blur(20px)` | 全屏输入毛玻璃                         | 1 处   |

过渡曲线统一使用 `var(--ease-out): cubic-bezier(0.23, 1, 0.32, 1)`，取代 `ease`。

## 设计原则

- **微动效**：参考 Emil Kowalski 设计哲学。短（0.15-0.3s），物理感，不干扰用户。用 `var(--ease-out)` 替代线性或 `ease`
- **毛玻璃**：用 `backdrop-filter: blur(20px)` 而非透明度叠加
- **PC 专用**：无 touch 适配，不需要 `@media (hover)` 守卫
- **不写无用文档**：不主动创建 README/doc 文件，除非用户要求
- **不用 emoji**：除非用户明确要求
- **不提自动 commit**：不主动 git commit/push，除非用户要求
- **诊断内置**：关键子系统自带自检（_ltDiag），出问题先看数据再猜原因
- **不轻易删兜底**：删除"看似冗余"的容错机制前，先确认它的历史作用

## 踩坑记录（2026-08 图标系统修复战役）

从 1.10.5 移除定时轮询到 1.10.6 重写图标架构，这轮修复踩了不少坑，全部沉淀如下。

### 1. 不要把「兜底轮询」当冗余优化

- **现象**：自认「双保险多余」删掉 `setInterval(_ltTagScan,1500)`，导致图标全部消失，历经五个版本才完全修复
- **教训**：双保险设计往往有历史原因（真实页面 MutationObserver 确实存在漏检）。删前先确认每一层的作用，删后必须留可回滚通道
- **最终方案**：三层各司其职——事件连扫负责即时响应、1s 轮询负责兜底注册、浮动图标负责存活

### 2. `offsetParent === null` 不等于隐藏

- **现象**：画布输入框在 `position:fixed` 悬浮面板内，`offsetParent` 按规范恒为 null，可见性检查把它当隐藏过滤
- **正确姿势**：判断可见性用 `getClientRects().length > 0` —— fixed 元素有布局矩形（通过），`display:none` 无矩形（跳过）

### 3. 站点 DOM 会变，选择器要能自证

- **现象**：liblib 把 textarea 输入框换成 ChatRichInput 富文本编辑器，旧选择器（textarea / contenteditable="true"）全部失效
- **教训**：站点脚本必须内置诊断（`window._ltDiag` + 油猴菜单「🔍 诊断」）。这次正是诊断数据直接给出「页面 textarea 总数: 0」「node=false」，才从猜转向了定位

### 4. 别往 React 管理的 DOM 里塞外来节点

- **现象**：图标注入输入框 wrapper 后，被 ChatRichInput 的高频重渲染（光标/选区/每次输入）反复清掉 → 时有时无
- **正确姿势**：图标挂 `document.body`（fixed 定位），按输入框 `getBoundingClientRect()` 同步位置，彻底脱离 React 渲染树
- **细节**：显示前加「稳定性门」——矩形连续两次一致（位移 <8px）才显示，避免面板动画期间图标闪现/瞬移

### 5. 顶层 `JSON.parse(localStorage)` 必须兜底

- **现象**：任一 `_lt_*` 数据损坏，整个 IIFE 在入口处抛错，后续所有功能（含图标）静默失效
- **正确姿势**：入口数据读取一律 try/catch + 默认值（`_lt_prompts` / `_lt_prompt_api` / `_lt_theme` / `_lt_tag_libs` / `_lt_recent` 已全部加固）

### 6. 嵌套作用域的函数不能顶层调用

- **现象**：`_ltIDBGet` 定义在 `_ltPromptPanel` 内部，顶层调用每次加载抛 ReferenceError（存量 bug，控制台可见但无人注意）
- **正确姿势**：顶层执行代码引用函数前确认其定义位置；用沙箱执行注入脚本可立刻暴露

### 7. 调试方法论（这次战役的制胜关键）

- **沙箱测试**：用 DOM stub 执行构建产物中提取的注入脚本（提取数组 → eval → 跑通），能秒级验证「加载是否抛错、图标能否注入」，无需浏览器
- **诊断先行**：先加可观测性再改逻辑；自检统计每轮重置，避免累积数字误导判断
- **产物与源码对比**：build 是字符串拼接，怀疑构建问题时提取产物中的数组反解对比（注意行尾符差异）
- **文件换行符**：dev 文档是 CRLF，直接 edit 多行匹配会失败，用 node 脚本按 index 替换

### 8. 版本纪律

- 修复期保持同一版本号，用户确认效果后再统一发布；合并发布时把中间版本的 changelog 合并为一条，避免文档膨胀

### 9. 视觉重做要保留原始风貌

- **现象**：光效重做先试三层彗星（被否）、再试纯模糊单层（被否），用户最终认可「最初的双层质感 + 顺滑机制」
- **教训**：用户对已有视觉有感情。重做时先保留原视觉骨架、只修问题（顺滑度/时机/性能），不要换概念；参数迭代比概念替换安全

### 10. 第三方网关 CORS 必须用 `GM_xmlhttpRequest` 绕过

- **现象**：自定义 HTTPS 网关在 Postman/后端都能连，但脚本里 `fetch` 直连报 `Failed to fetch`，DeepSeek/本地 llama 却正常。
- **根因**：`fetch` 跑在页面上下文，跨域（liblib.tv ≠ 网关域名）会触发浏览器 CORS 预检；自托管/中转网关常不返 `Access-Control-Allow-Origin`，预检失败 → 浏览器直接拦截，连真正的请求都不发。DeepSeek 官方带 CORS 头、本地 llama 走 localhost 豁免，所以能连。
- **方案**：改用油猴特权 API `GM_xmlhttpRequest`，由扩展在沙箱外代发，**不受页面 CORS 约束**。沙箱（main.js）把 `GM_xmlhttpRequest` 挂到 `window.__ltGMXHR`，注入脚本（页面上下文）用 `window.__ltGMXHR` 调用。
- **🪤 大坑：`unsafeWindow is not defined`**。`unsafeWindow` 只在油猴沙箱（main.js）里存在，页面上下文**没有这个标识符**。沙箱里的 `unsafeWindow` 实际指向页面 `window`，所以 `unsafeWindow.__ltGMXHR = GM_xmlhttpRequest` 是把函数挂到页面 `window` 上；注入脚本必须用 `window.__ltGMXHR` 取，写成 `unsafeWindow.__ltGMXHR` 会抛 `unsafeWindow is not defined`。
- **分发注意**：元信息需 `@grant GM_xmlhttpRequest` + `@connect *`（通配，避免逐个域名弹确认）；首次安装油猴会请求一次权限，用户允许即可。

### 11. 往站点元素里塞节点 = 把自己挂进 React 的渲染树

- **现象**：积分换算标签第一版往顶栏余额按钮里 `appendChild` 一个 `<span>`。节点浮动面板那处正常，顶栏那处出问题。
- **两个输点**：① React 重渲染那个容器时会连带清掉外来子节点（和 #4 输入框图标是同一类问题，只是余额容器重渲染没那么频繁，平时看不出来）；② 站点的组件自己可能读 `textContent`（余额、tooltip、埋点上报），多出来的 `≈¥1.33` 会把它的解析搞坏 —— `Number("20≈¥1.33")` 是 `NaN`。
- **正确姿势：只给自己的属性，不给别人的孩子。** 把文本打在站点元素自己的 `data-lt-rmb` 上，由 CSS `::after { content: attr(data-lt-rmb) }` 渲染。伪元素不在 React 的树里，React 碰不到它，它也不进 `textContent`。
- **附带好处**：不用再写「先摘掉自己标签再判断纯数字」那段绕路逻辑，代码反而更短。
- **代价**：伪元素仍然是 flex item，宽度照加、布局参与照旧——但这是可见、可测量的，比「被别人重渲染清掉」这种偶发问题好排查得多。

### 12. 别假设站点的数字是纯数字
- **现象**：锚点自证第一版写死 `/^\d{1,7}$/`，本机余额显示 `20` 时一切正常。
- **风险**：真实账号余额常见千分位（`1,204`）、小数、`万/k` 单位。一旦站点格式化成 `1,204`，就被判定成「不是数字」，那处 **永远不打标签，且不报错**——静默失败比崩溃更难发现。
- **正确姿势**：先归一再判断（去千分位/空白，支持 `万`·`w`·`k` 后缀），并在诊断里把「锚点文本 => 解析结果」原样打出来（`_ltDiag.credit` + 🔍 诊断菜单的「积分换算自检」段）。静默失败就变成了可读的一行。
- **实况补充**：站点实际出现过四种形态——纯数字 `20` / 千分位 `37,377` / 单位后缀 `1.2万` / 会员折扣「现价 / 原价」`196/230`。**每一种都是登进真实账号才看到的**：本机测试余额一直是 `20`、节点一直是纯数字，一个都没试出来。教训：解析器要按「站点可能展示数值的所有方式」写，而不是按「我见过的样本」写。

## 更新日志
### v1.13.1（修复设置面板排版，2026-09-22）

- **换算比例输入行挤垮了开关区**：比例行被插进 `.lt-sec-toggles`（它是 2 列 grid），多出的网格项让右列只剩半格宽，「隐藏图片/隐藏网格/积分换算」标签被挤成一列一个字的竖排。给该行加 `grid-column:1/-1` 横跨两列即可
- **开关标签加 `white-space:nowrap`**：列再窄也只溢出不竖排（治标，防同类问题复发）

### v1.13.0（换算比例可配置，2026-09-22）

- **比例开放为设置项**：高级会员和普通会员每积分单价不同，固定 15 不适用所有档位。设置面板「开关」区新增输入框「几分 = 1 元」（键 `_lt_rate`，默认 15，接受小数），改一次立即重刷所有标签，无需重载
- **读取容错**：启动时从 `_lt_rate` 读，`parseFloat` 失败或 ≤0 一律回落 15；输入框 `oninput` 里同样校验，非法值不写入（保住上一个合法值）
- **实现实时**：面板 `oninput` 直接改 IIFE 内变量 `_ltRate` 后调 `_ltCreditScan()`，不走「写 localStorage + 等下一轮轮询」的慢路径

### v1.12.1（积分换算支持会员折扣形态，2026-09-22）

- **折扣节点没换算**：会员节点的消耗显示成「现价 / 原价」`196 / 230`（原价在站点侧是删除线），解析器只认单个数字，整个锚点被跳过 → 不打标签（踩坑记录 #12 的又一种形态）
- **解析器拆成两层**：`_ltCreditOne`（归一单个数值）+ `_ltCreditLabel`（组装标签文本）。锚点文本按 `/` 拆开：1 段出 `≈¥2492`，2 段出 `≈¥13.07 / ≈¥15.33`（两段都换算，形式上对照站点自己的「现价 / 原价」，避免读者搞混哪个数换的是哪个）；超过 2 段或任一段解析不出就不认这个锚点
- `textContent` 里分隔符两侧**没有空格**（视觉间距靠 CSS `gap`），所以按 `/` 直接拆即可，不用先处理空白

### v1.12.0（悬浮按钮样式重做 + 积分换算顶栏修复，2026-09-22）

**样式重做**

- **提示词悬浮按钮改「极简描边」一族**：`#libtv-pbtn` 5 个槽位统一成透明底 + 1px 描边 + `currentColor` 线性图标，**不位移、不缩放、不发光**，hover 只变颜色（底浮 `rgba(var(--accent-light-rgb),0.12)`、描边转 accent、图标转白）
- **5 个槽位保留原语义**：s0 描边圆（基准）/ s1 幽灵（无描边，hover 才浮底）/ s2 小号 28px（hover 长回 36px）/ s3 hover 长成 112px 胶囊滑出「提示词」/ s4 纯文字「P」
- **删掉 JS 里 hover 的 inline `transform:scale(1.05)`**：inline 优先级高于样式表，留着就 5 个槽位各弹各的，统一不了
- 清掉 `@keyframes libtv-pbtn-glow` / `libtv-pbtn-pulse`，以及 s1/s3 的 `backdrop-filter`

**Bug 修复（积分换算，均为 v1.11.0 引入）**

- **顶栏余额那处不打标签**：`_ltCreditNum` 原来卡死 `/^\d{1,7}$/`（纯数字），余额一带千分位就被判成「不是数字」而**整个静默跳过**
- **标签改 `data-lt-rmb` + CSS `::after` 渲染**，不再往站点元素里插节点（踩坑记录 #11）
- **数值解析容错**：千分位 / 小数 / `万`·`k` 单位（踩坑记录 #12）
- **诊断**：🔍 诊断菜单新增「积分换算自检」段 + `window._ltDiag.credit`（开关状态 / 已打标签数 / 各锚点文本 => 解析结果）

### v1.11.0（积分⇄人民币换算，2026-09-22）

**新功能**

- **积分旁补人民币估值标签**：站点用闪电图标展示积分（顶栏账号余额、节点浮动面板的生成消耗），脚本给该元素打 `data-lt-rmb`，由 CSS `::after` 渲染成 `≈¥140.00`，按 `_ltRate`（默认 15 积分 = 1 元）实时换算
- **带 ≈ 前缀**：`_ltRate` 是用户口径的近似汇率、非站点官方定价，标签不能自陈为精确值，故统一渲染成 `≈¥1.33`；汇率达 1000 元以上取整（`≈¥140.00` vs `≈¥6667`）
- **锚点靠站点自己的积分图标定位**：认闪电 path（`svg path[d^="M7.3.64"]`）再往上找最近的「图标+数值」容器，不依赖易变类名，站点以后新增积分展示位自动覆盖；另留 `span.min-w-5.text-center` 类名兜底锚点
- **锚点自证**：解析不出数值就不认这个锚点——站点改版时自动退出而非乱贴
- **开关**：设置面板「开关」区新增「积分换算」（键 `_lt_rmb`）。因其他开关沿用「缺省即关」约定（`==="1"` 才算开），本功能默认开的做法是：**仅在 `_lt_rmb` 从未存过时写一次 `"1"`**，不改共用的开关渲染/点击代码；`_ltCreditScan` 每轮读一次 localStorage，所以开关点一下即生效、无需重载
- **刷新时机**：`MutationObserver`（`childList` 兜面板重挂载、`characterData` 兜余额数字原地变化）+ 1.5s 轮询兜底，与项目既有的「事件扫 + 定时兜底」双保险同构

### v1.10.10（代码审查修复批次，2026-08-23）

**Bug 修复**

- **切换预设不再吞空模型名**：`_ltFillPreset` 保留预设原始 model（本地 Llama 留空由网关用默认模型），deepseek-v4-flash 兜底只在请求层生效
- **设置面板开关初始状态**：移除误加的 `perf-mode` 短路，每个开关独立读 `_lt_`+key
- **DeepSeek 预设默认模型**：`deepseek-chat` → `deepseek-v4-flash`（旧名已于 2026-07-24 停用）
- **IndexedDB 启动恢复真实生效**：`_ltIDBSet/_ltIDBGet` 从 `_ltPromptPanel` 内部提升至 IIFE 顶层——此前顶层调用抛 ReferenceError 被 try/catch 静默吞掉，v1.10.6 的该修复实际从未生效（踩坑记录 #6 残留）
- **账号备份损坏数据不再堵死兜底链**：cookie/IndexedDB 恢复前先 `_ltAccValid`（JSON 数组校验），损坏值不再写入 localStorage 挡住下一级恢复
- **Escape 关闭清单补全**：新增 lt-settings / lt-ai-panel / lt-acc-panel / lt-cp-overlay / welcome（关闭即写入首次引导标记）；移除死引用 lt-debug，诊断面板补 `id=lt-diag` 并纳入清单
- **hover 连线高亮 O(1) 化**：新增节点→连线倒排索引 `_ltEdgeIdx`（与 `_ltGraphCache` 同步失效），替代每次 mouseover 全量遍历边+正则
- **全站 match 移除**：删 `@match https://www.liblib.tv/*`，脚本只在 canvas 页注入，非画布页不再空转 FPS/光效/Observer

**健壮性**

- 新增 `_ltJ(k,d)` 安全 JSON 读取：内容包导出、设置面板、AI 面板、调色板 recent/fav、`_ltPromptRefresh` 等 8 处顶层 `JSON.parse(localStorage)` 全部加固
- 搜索节点选择器转义 data-id（含引号/反斜杠不再抛错），失败回退线性扫描
- AI 面板执行时重读 `_lt_prompt_api`（面板打开期间切换预设立即生效）
- `_ltToast` 导出到 window，main.js 诊断菜单错误提示经 `unsafeWindow._ltToast` 真正可达
- 拉模型端点顺序：base 以 /v1 结尾时首选 /models，不再先打必 404 的 /v1/v1/models
- 帮助卡片跟随 FPS 面板当前位置（面板可拖拽后不再固定右下角）；修复 top/bottom 同时生效导致 fixed 卡片纵向拉伸的定位异常
- **模型列表缓存**：按「API base + Key」维度存 `_lt_models_cache|{base}|{key}`，24h 过期；拉取优先命中缓存免网络，列表头部提供「🔄 重新拉取」强制刷新；打开设置面板时命中缓存直接展示
- **新预设改为面板内联输入**：替代原生 prompt 弹窗，回车保存、Esc 取消
- **三处下拉全部自绘化（原生 select 弹层不受 CSS 控制，Windows 浅色主题下白底黑字突兀）**：
  - 新增顶层通用组件 `_ltDropdown`（button + 自绘弹层，接口兼容 value/onchange/setList，弹层观感复用 `.lt-model-item` 毛玻璃风格）；弹层经 `_ltFloatPop` 助手挂 `document.body` + `position:fixed`（z-index 100007），**不受面板容器 `overflow:hidden` 裁剪**，随滚动跟随按钮，下方空间不足自动翻上方
  - 设置面板「预设」下拉 → 自绘（原 `<select>` 保留为 1px 隐藏元素同步 value，`_ltApiSaveForm` 等读取点零改动）；新增/删除预设后 setList 同步
  - 提示词面板 AI tab 与独立 AI 面板的模型下拉 → `_ltModelSelect` 自绘版（button 触发 + 弹层列表，缓存优先自动填充，⟳ 强制刷新，当前项 accent 色 + ✓ + 滚动到可视区）
  - 选中即写回 `_lt_prompt_api` 并同步预设；`_ltApiBase`/`_ltFetchModels`/`_ltModelsCache*`/`_ltModelsErrDesc` 提升为 IIFE 顶层共用
- CSS 去重：`.lt-tag-item:hover` 重复规则删一条
- **设置面板「关于」版本徽章硬编码修复**：徽章此前手写版本号（v1.10.10 发布时漏改显示 v1.10.9），现改 `__LT_VER__` 占位符由 build.js 统一注入，与 `@version` 同源永不再漏

### v1.10.9

**状态栏配置信息简化**

- 提示词增强面板（`ltp-ai-status`）与 AI 增强面板（`lt-ap-status`）底部的「已配置」状态栏，不再展示完整 API 地址，改为「模型方 + 模型名称」：`已配置 {host} · {model}`
- 新增 `_ltHost()` 辅助：从 API 地址提取 host（去掉协议/端口/path）作为「模型方」展示

### v1.10.8

**图标系统修复 + AI 网关 CORS 绕过**（清爽模式已彻底移除，历史见 v1.10.7）

- 图标误显示修复：`_ltIsNodeInput` 从「节点内任意输入框」收窄为「节点内 + 可编辑 + 编辑器白名单 class」
- 适配新版画布：可见提示词编辑区 class 改为 `text-fg-default`
- 修复 @ 引用标签误显示：排除 `contenteditable="false"`（mention 标签如 `<图1>` 不再出现图标）
- 引导面板快捷键速览移除残留的 `<kbd>N</kbd> 清爽模式` 项
- **AI 请求改用 `GM_xmlhttpRequest` 代发（绕过 CORS）**：`_ltAIChat` / `_ltFetchModels` 走 `_ltXHR()` 封装，透传 `window.__ltGMXHR`，回退原生 fetch
- **模型拉取多端点探测**：`/v1/models` → `/models`，404 回退（详见踩坑记录第 10 条）

### v1.10.7

**清爽模式最终移除**（v1.10.4~1.10.6 曾重做为跳转逻辑，现整体下线）

- 删除清爽首页全部逻辑 / 链接拦截 / `N` 键 / FPS ♡ 标志 / 文档章节

### v1.10.6

**AI 增强体验**

- 版本号自动注入：build.js 顶部 VERSION 常量统一维护，@version 元数据与设置面板关于区构建时自动注入
- API Key 显隐切换：设置面板 Key 输入框新增 👁 按钮
- 执行按钮状态化：生成成功后按钮变「🔄 重新生成」，清空结果后恢复「执行」
- 设置面板双栏卡片化布局：加宽至 880px，分区独立玻璃卡片（渐变背景/圆角/投影/hover 上浮），头部 logo 徽章 + 关于区版本呼吸徽章
- 面板统一贵气化：提示词面板/标签面板/AI 面板统一渐变背景、18px 大圆角、顶部高光线；AI 与标签面板宽度统一 540px
- 浮动图标层级修正：z-index 从 2147483646 降至 99990（面板 99999~100002 之上、页面 UI 之下，弹出面板不再被图标遮挡）

**图标系统重写（适配 liblib 新版画布）**

- 适配 ChatRichInput 富文本输入：页面已无 textarea，节点白名单新增 ChatRichInput/RichInput/chat-rich/prompt-editor 等 class 匹配
- 浮动图标架构：标签/AI 图标挂载 document.body（fixed 定位），彻底脱离 React 渲染树，富文本高频重渲染不再清除图标
- 选择器放宽为 `textarea,input,[contenteditable]`（过滤按钮类），可见性改用 getClientRects（兼容 fixed 悬浮面板）
- 响应优化：事件后 80/300/800/1500ms 连扫 + 1s 轮询兜底；稳定性门（矩形稳定后才显示，面板动画期间不闪现）

**流动光效重写**

- 双层双流光：模糊光带（accent 13% 周长）+ 白色亮线双层，180° 对位第二条；固定从顶边中点出发（消除随机跳位）、200ms 淡入/150ms 淡出、元素缓存零重建、30fps 渲染、模糊固定 6px
- 迭代教训：三层彗星/纯模糊均被否，最终回到原始双层质感 + 顺滑机制

**健壮性与诊断**

- 修复注入脚本顶层调用 `_ltIDBGet` 加载即崩（ReferenceError）
- `_lt_prompts` / `_lt_prompt_api` / `_lt_theme` / `_lt_tag_libs` / `_lt_recent` 五处顶层 JSON.parse 异常兜底，数据损坏不再杀死整个脚本
- 图标扫描自检接入油猴菜单「🔍 诊断」：输入框详情（tag/type/可见性/节点归属）+ 浮动图标状态（连接/显示/坐标）

### v1.10.5

- **面板拖拽**：标签面板 / AI 增强面板按住头部可自由拖动（自动排除内部可交互元素，标签面板缩放仍可用）
- **AI 面板定位**：改为面板左下角对齐 AI 按钮左上角，实测尺寸定位 + 视口内自动收敛
- **AI 配置面板大改**：新增连接测试（严格校验：必须返回有效 choices 才算成功，消除假阳性）、多预设管理（+ 新预设 / 切换 / 删除，默认预置 DeepSeek 与本地 Llama 两个预设）、拉取模型列表（GET `{base}/models`，兼容 `data[]` / `models[]` 两种响应）
- **端点自动补全**：`_ltAIChat` 按序尝试 原始 URL → `/chat/completions` → `/v1/chat/completions`（自动去重），404/405/错误体 200 自动换端点重试
- **所见即所得**：连接测试成功 / 拉取成功 / 点击选模型时自动保存为当前激活配置（并同步预设），测什么用什么
- **结果提取健壮化**：`_ltMsgText` 支持 `content` → `reasoning_content` → 多段数组逐级降级；max_tokens 1000 → 4096（避免推理模型思考阶段被截断导致空内容）；空结果显示原始响应提示
- **错误可排查**：AI 调用失败信息携带实际请求 URL（`@ ...`）与模型名（`| model=...`）

### v1.10.4

- **修复 Mantine 全局规则误杀节点面板**：移除 `[id$="-target"][id^="mantine-"] { display:none }`，节点面板内按钮/图片容器恢复正常
- **设置面板新增项目链接**：关于区加入 GitHub / Greasy Fork / ScriptCat 三个跳转图标

### v1.10.3

- **内容包扩充**：AI 自定义预设（`_lt_ai_custom_presets`）+ 自定义 system prompt（`_lt_ai_sys`）加入导出导入
- **API 默认值自动写入**：首次加载时自动将 deepseek 地址和模型写进 localStorage，不再需要手动点保存

### v1.10.2

- **多账号切换数据丢修复**：IndexedDB 三级兜底备份（localStorage → cookie → IndexedDB），退出登录不再丢账号
- **性能模式毛玻璃修复**：增加 `-webkit-backdrop-filter: none` 覆盖，补全高专用性选择器的毛玻璃禁用
- **CSS 持续打磨**：color-mix / @starting-style / scrollbar-gutter / text-wrap / content-visibility / backdrop-filter
- **过渡曲线统一**：全部 `ease` → `var(--ease-out)` / `var(--ease-in-out)`
- **全局 focus 规则移除**：橙色描边问题修复
- **Mantine 选择器收窄**：`nav [id$="-target"][id^="mantine-"]` 修复导航按钮被隐藏
- **广告按钮隐藏**：`[data-tag="CornerMark"]` 替代旧版 class 选择器

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

- **构建系统重构**：单体 `.user.js` 拆分为模块化 `src/`（`style.css` / `inject.js` / `main.js`）+ `build.js`；CSS/JS 改为独立文件，获 IDE 支持与 `node --check` 直验，数组引号/转义由构建自动处理

### v1.9.10

- 提示词模板列表重构：内联表单弹窗 + 分类徽章 + 预览 + 常驻操作按钮（复制/查看/编辑/删除）

### v1.9.9

- AI 增强 tab 重构：预设策略（润色/扩写/缩写/中英互译）+ 自定义 system prompt；结果区改为对比布局
- 新增多账号切换（Cookie + localStorage 快照）；首次引导面板 `_ltShowWelcome`；修复 AI 请求未检查 `r.ok` 与欢迎面板定时器堆积

### v1.9.8

- 首次使用引导面板（毛玻璃卡片 + 快捷键速览/功能标签/小提示）

### v1.9.7

- 面板 CSS 改用 CSS 变量，切主题时自动跟随；主题预设 14 → 29 个

### v1.9.6

- 移除节点视觉美化 CSS（修复远距缩放变大 bug）；悬浮按钮改 `_createBtn`/`_removeBtn` + MutationObserver 仅画布页显示
- **修复 hook 注入缺 try/catch 静默失败**：注入脚本语法错误致整段 IIFE 挂掉，加 try/catch 后暴露错误并恢复轮询兜底

### v1.9.5

- 悬浮提示词按钮仅画布页（`.react-flow` 存在）显示

### v1.9.4

- 新增 AI Agent Drawer 适配（MutationObserver 右推 FPS/浮动按钮）、流动光效 SVG overlay

### v1.8.3

- 首页/全部项目页布局优化 CSS（1200px/1800px 限宽、3/6 列网格、卡片尺寸、面包屑、分区标题等）
- 隐藏干扰元素（顶部 Banner、会员超市、帮助按钮、Mantine 图标、轮播/AI 输入区等）
