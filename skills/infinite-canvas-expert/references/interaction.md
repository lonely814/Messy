# 无限画布交互手册（触屏 / 浮层 / 菜单 / 表单）

## 触屏桥（touch → mouse）

画布类应用原生只认 mouse 事件，手机上"点了没反应"的通用解法是触屏桥，按顺序处理：

1. **长按 500ms → 合成 contextmenu**：一处修好全部右键菜单（节点/连线/空白）。长按触发后必须吞掉同一触摸后续的 click/dblclick，否则弹完菜单又误开别的。不要逐个页面补 listener——桥接层一处解决。
2. **事件放行规则 `shouldSkip()`**：从 target 上溯到文档根，遇 `position:fixed` 浮层停止放行。效果：灯箱/弹层内捏合缩放保留，普通页面保留原生滚动。跳过这步直接全桥接，生成页/列表页会划不动。
3. **桥只挂需要的页面**，别全站注入。
4. 捏合缩放翻译成 wheel 事件，复用既有缩放逻辑，不要另写一套。

## 移动端布局

- `100vh` → `100dvh` 双声明。注意：所有含 `100vh` 的 JS calc 公式必须同单位改（`calc(100vh / scale)` 之类漏改会出现高度撕裂）。
- 定宽浮层 → `min(<宽>px, 92vw)`。
- 宿主缩放若走 CSS `zoom`（不是 transform）：抽屉等新浮层内加 `zoom:1`，否则继承缩放后文字不可读（iOS 上被放大到模糊）。
- ≤768px 侧栏改汉堡按钮 + 遮罩抽屉：复用桌面态视觉类、Esc/遮罩/选页后自动收、`aria-expanded` 同步。
- **hover 才出现的按钮，触屏必须有常显或替代入口**（`@media (hover:none)` 兜底）。这类问题审查清单必备——真机不试测不出来，模拟触摸测不出手感，最终验收让用户真机过。

## 浮层菜单防裁切

先定位、再限列表高度，顺序不能反（反序会出现"放得下却出滚动条"）：测量可用空间 → 定位（上下翻转取优）→ 用剩余空间限 max-height。所有浮层（创建菜单/节点菜单/连线菜单/右键菜单）走同一组 `placeFloatingMenu / clampFloatingMenu / measureFloatingMenu`。

## 双击空白与节点误触

双击空白弹新建菜单时必须校验 `e.target`——双击落在节点上要穿透给节点的双击逻辑。若上游代码 `ondblclick = null` 是主动禁用而非缺失，加上属于新功能，先确认原意。

## 节点类型单一数据源

节点类型定义（图标/颜色/菜单项/创建入口）收进一个 `NODE_TYPES` 注册表，驱动全部入口（工具栏/创建菜单/连线菜单/输入输出菜单）。否则 6 套入口各自为政，互相缺失项。菜单加分组 + 顶部搜索（节点类型 >10 个后必配）。连线连出即弹匹配类型菜单，减少回工具栏取节点。

## 快捷键

- 基本盘：Ctrl+A 全选 / Delete 删除 / Ctrl+0 重置视图 / `?` 帮助浮层。
- 新快捷键先查冲突（`?` 常已被帮助占）；开关类状态持久化到 localStorage 并保证"隐藏态有回来入口"——只做 off 不留 on 入口是死路（用户会问"咋重新出现"）。

## 表单与字段映射（React/原生通用）

- 字段变更只更新受控项，**白名单外键绝不重建整个表单**——重建即输入失焦。新增字段必须入"不重建"白名单。
- React Flow 类画布：落位走 `onNodesChange` 批量提交，保存挂 `onSelectionDragStop` 批量写，别逐节点逐帧写库。
- 需要在 React 组件外拿状态：`react fiber` 节点取 store 是兜底手段，能走 props/事件就别碰 fiber。

## 滚轮缩放

每格固定百分比 + 无过渡 = 生硬。改：滚动量连续换算（鼠标一格 ×1.17~1.25 可调）→ 目标值 150ms rAF 缓动 → 软钳制上下限 → 捏合 1:1。画布空白区默认光标 grab、拖动中 grabbing，别一律箭头。

## 手势阈值词汇表（六仓对照，抄表不抄码）

| 手势 | 阈值 | 来源 |
|---|---|---|
| 点击 vs 拖拽死区 | 2px（dragDistance） | [leafer] interaction/config.ts |
| 点击 vs 拖拽死区 | 3px | [basketikun] |
| 微抖容差 | maxClickDrift=6px | [comfyui] CanvasPointer |
| 触屏 tap slop | 8px | [affine] mobile |
| 点/拖双阈值 | 3px + 120ms | [atc] timeline.ts:1226 |
| 长按弹菜单 | 500ms（合成 contextmenu） | [ic] touch-mouse.js |
| 长按弹菜单 | 800ms（longPressTime） | [leafer] config |
| 短按重命名 / 长按平移 | 同键按时长分义 | [n8n] F2/空格 |
| hover 悬停延迟 | 150ms（PreviewCard）/[atc] 视频预览 350ms | [dify]/[atc] |
| swipe 触发 | 20px | [leafer] config |

判据：阈值没有普适值但有收敛区间——死区 2-3px（触屏 8px）、长按 500-800ms、hover 150-350ms。**同键按时长分义**（短按/长按）是高频键位复用的成熟解。落点：把全部阈值收进一处 config（[leafer] 做法），散在各组件里必漂移（[litegraph] slot 热区三套尺寸反面）。

## 微交互状态设计

- 交互元素四态齐全：默认/悬停/按下/拖拽中/禁用——缺任何一态用户就靠猜。画布特有的**可放置性提示**：拖拽时跟随光标的 tooltip（[coze]）、「落点会变成什么」的 ghost 预览（[refly] ghost 节点）。
- 约束可视化：类型不符 slot 降 alpha（[litegraph]）、连线预过滤兼容节点（[n8n]）、不可连目标变色（[logicflow] 规则映射节点色）——**禁用要提前显形，不要等松手报错**。
- 批量操作交互：shift+方向键选上下游（[n8n]）、框选 marquee；批量动作必须有进度与可中断（对照 [toonflow] 批量队列）。
- 撤销的交互面：自动整理也要写撤销历史可 Ctrl+Z（[coze]）；undo 粒度 = 一次手势（三仓互证，见 distilled-external 撤销三派）。

## 通用域知识

- listener 加 `{ passive: true }`（wheel/touchmove 默认阻塞合成线程）。
- `touch-action: none` 只给画布面，给到 body 会杀掉页面滚动。
- pointer capture（`setPointerCapture`）保证拖出元素仍收 move/up。
- 输入法组合期（compositionstart/end）拦截快捷键，否则中文输入打字触发快捷键。
