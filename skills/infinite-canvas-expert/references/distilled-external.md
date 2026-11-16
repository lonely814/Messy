# 外部项目蒸馏手册（GitHub 画布项目方法提炼）

来源标签：[tldraw]（TS 白板 SDK，source-available：开发免费、生产需 License Key，学手法不受限、搬包受限）；[basketikun]（React/Vite 纯前端 AI 生图画布，~7000★ MIT，全手写无画布库）；[toonflow]（Vue3+Bun monorepo，@vue-flow/core + dagre，MIT，价值在任务队列/资产管线）；[shuo]（闭源桌面 AI 画布，仅 release notes 可读，自定义双许可——打法可吸收、无源码）。

验证分级：**[实测]** = 项目内自证（作者注释/性能声明）；**[日志级]** = shuo 仅 release notes 产品日志，实现未验证；其余为代码证据支持的可迁移结论。

## 目录

- 通用判据节（tldraw / basketikun / toonflow / shuo 的内容分布于此）：渲染与空间索引 → 交互与手势 → 图像与资源 → 任务链路与防丢钱 → 撤销 / 持久化 / 协作
- SVG 派：SVG 引擎派（X6）→ 轻量流程图框架（logicflow）→ 树形布局派（mind-map）
- Canvas2D 派：Canvas2D 渲染派（litegraph）→ Canvas2D 元素缓存派（excalidraw）→ Canvas2D 对象派（fabric）→ Canvas2D hit graph 派（konva）→ 国产 Canvas 引擎（leafer）→ 生产化节点图（comfyui）→ 零依赖引擎派（quickdraw）
- GPU 派：GPU 渲染派（webgl）
- 混合引擎：AI 生图画布双代架构（invokeai）
- 协作：CRDT 协作派（blocksuite）→ Agent + 协作画布（dim0）
- Agent×画布：自然语言驱动画布 Agent（movie）→ Agent 工作区画布（opencove）→ LLM 对话转思维图（thoughtdag）
- 任务与媒体：Web 端媒体处理引擎（webav）
- 时间轴：关键帧时间轴（atc）→ 多轨视频时间轴（tl-studio）
- 骨架：插件化节点引擎（rete）
- 收尾：全局反面模式索引

## 渲染与空间索引

- [tldraw][实测] 命中测试用 R-tree（rbush）每页一树 + 旁挂 `Map<id,element>`；初始 bulk load、增量逐条 remove/insert——**作者实测整树重建反而更慢**，别按"定期重建更简单"直觉做。脏更新沿 parent/child + binding 闭包扩散到不动点，代价 O(affected) 而非 O(全页)；对外只 bump 单调 epoch 供 `===` 短路。
- [tldraw][实测] 命中两段式：R-tree 出候选集 → z 序自顶向下精测。margin 按屏幕像素/zoom 换算（粗指针加大 margin）；命中裁决**收集语义**（最小空心面积、最近边、frame 特判）而非首个命中即停。
- [tldraw][实测] DOM 渲染相机：只改单容器 CSS transform；shape DOM 按 id 排序**永不搬节点**（防 iframe/视频元素重载），z 序用 z-index band 表达；culling 单组件 + Context 批量切 display:none（selected/editing 豁免）；**相机 moving 期间冻结可见集重算**，idle 超时后才更新——平移流畅优先于裁剪精度。
- [tldraw][实测] 信号系统：computed 可挂环形 HistoryBuffer，`getDiffSince(epoch)` 增量重算；**返回值引用稳定化是下游 `===` 短路的基础**——React/Vue 细粒度更新框架通用。
- [basketikun] 节点 div `contain: layout style`；全回调 useCallback + 模块级 `EMPTY_REFERENCES` 常量防 props 打穿 memo。
- [basketikun] 视口裁剪可以很朴素：世界矩形 ±280px 线性 filter 节点 + 连线用 bezier 控制点凸包判定；React 场景没四叉树也够用——索引上不上按规模，不按潮流。
- [basketikun] 逆缩放三件套（zoom=k 时）：面板 `scale(1/k)`、选框 stroke-width `1/k`、命中半径 `padding/k`——保证 UI 元素屏幕尺寸恒定。
- [basketikun] 无限网格零 DOM：纯 CSS gradient + `backgroundPosition` 取模跟随视口。

空间索引四档判据（按规模选档，不按潮流）：R-tree——[tldraw] rbush 每页一树、增量 remove/insert（大页高频命中）；均匀网格——[blocksuite] GridManager 3000px 格（grid.ts）；线性——[basketikun] / [litegraph] / [quickdraw] / [excalidraw]（中规模够用）；QuadTree——[comfyui] 连线命中粗筛级（Path2D+QuadTree 两级）。万级以上另看 GPU 节门槛。

网格渲染选型判据（低成本四条路线）：CSS gradient + backgroundPosition 取模——[basketikun]，最便宜、无层级淡出；SVG pattern + patternTransform 单 rect——[logicflow]；SVG pattern 多级淡入——[tldraw]（distill-tldraw.md §3）；倍频程墨量恒定——[quickdraw]（editor.js:1694-1788），缩放时网格不变亮不变暗。按是否需要缩放淡出层级与视觉连续性选。

## 交互与手势

- [tldraw][实测] 捏合缩放是手写三态状态机（panning/zooming/not sure）：两指中心移动判 pan、指距变化判 zoom，**进入 zoom 态不回退**（防抖动振荡）；输入统一归一到 atoms 再进状态机分发。
- [basketikun] pan/节点拖拽统一 rAF 合帧：pending-ref 模式每帧一次 setState；拖拽位置 = 起点 + 累计 delta 重算（防浮点漂移）；3px 死区区分点击/拖拽。
- [basketikun] IME 保护统一入口：`isComposing || nativeEvent.isComposing || keyCode===229` + 纯 Enter 判定（`isPlainEnterKey`）。
- [basketikun] 免疫区用 data 属性分流：`[data-canvas-no-zoom]`（滚轮缩放豁免）、`[data-canvas-shortcuts-ignore]`（快捷键豁免）——比全局黑名单可维护。
- [toonflow] 触控板捏合与 Ctrl+滚轮判别：捏合事件自带 ctrlKey=true，**以有无实体 Control keydown（pressedCodes）区分捏合与真 Ctrl+滚轮**；`deltaMode` 只用于滚轮因子换算；WebKit 另走 gesturechange——两路走不同灵敏度。
- [shuo][日志级] 产品教训：媒体节点勿双份挂载同一资源；失焦复焦勿重建节点；缩略图局部刷新防整排闪烁。
- [basketikun] 光标锚点缩放：缩放前后指针下的世界点不动（infinite-canvas.tsx:87-107）——五仓同款：[litegraph]（distill-litegraph.md 相机 #7）、[webgl]（CameraControl.ts:366-386）、[fabric]（StaticCanvas.ts:378-389）、[mind-map] scaleInCenter（View.js:277-289）——一切缩放交互的地基公式，缺了就指针漂移。
- [tldraw][实测] 相机 moving 期间全屏 hit-test blocker（distill-tldraw.md §2 末）——与渲染冻结（渲染节本仓条目）配套：相机运动中命中整体冻结。
- [tldraw][实测] 拖到边缘自动滚屏（EdgeScrollManager，distill-tldraw.md §7）——与 [mind-map] AutoMove、[atc] autopan 同族：拖拽到边的自动滚屏三仓互证。
- [opencove] wheel 手势自动识别 + 手势锁（distill-cove-dag.md opencove §一.13）——触控板/滚轮判别互证组再添一仓（与 [toonflow] / [comfyui] / [mind-map] 同题）。

## 图像与资源

- [tldraw][实测] 图像按 screenScale 请求分辨率变体（500ms tick 计数 debounce），被 cull 的不解析，上传中用临时预览占位，blob URL 有 revoke 生命周期——与 [basketikun]（原图 Blob 落 IndexedDB、屏幕所需像素 > 预览长边才切原图、孤儿 GC 把历史快照算"在用"）与 [excalidraw]（imageCache 先存 Promise 占位防重复 decode、字节走 fileId 旁路）三仓互证：**分级请求 / 引用计数 / blob 生命周期**。

## 任务链路与防丢钱（AI 生图画布核心层）

- [toonflow][实测] 防重复付费总判据：**只有宿主证明“未提交”才允许标 failed**；断线/超时一律 interrupted；恢复只按 taskId resume 查询绝不重提——完整状态机与 file:line → 详见 network-api.md 四。
- [toonflow][实测] checkpoint 续跑 / 共享短轮询单例 / staging 发布+引用占用检查 / FFmpeg 有界兜底 / 取消墓碑+幂等 start → 详见 network-api.md 二、三、四、五各 [toonflow] 条。
- [shuo][日志级] 预扣结算退差额 / 并发感知排队 / 超时只提醒不判失败 / 结果找回 / 模型注册表 → 详见 network-api.md 一、二、四、八各 [shuo] 条。
- [shuo][日志级] 缩略图独立缓存不入工程文件；未引用素材定期 GC；崩溃/错误窗口强制保存（本手册独有）。
- [toonflow] Agent 画布读取走 64KB 预算投影 + revision 绑定分页游标（distill-toonflow.md §1.3 L59）——与 [dim0] Agent 投影互证；长请求 20s 心跳 + per-key promise 队列（同 key 串行化）→ 心跳详见 network-api.md 三。

## 撤销 / 持久化 / 协作

撤销三派判据（先问"操作可逆吗、历史要不要兼当报文"）：**diff 栈**——[tldraw] 可逆 diff 栈与 [quickdraw] `applyDiff(invertDiff)` 同构互证，一套 diff 兼任 undo 单元 / 同步报文 / 持久化增量；**快照栈**——[basketikun] 引用快照 50 条 180ms 防抖、[comfyui] 全图快照 50 步（快照派的反面教材本体，护栏齐全）、[logicflow] deepObserve+100ms 快照 maxSize 50（与 [comfyui] 同派，大图同病）；**结构化引用快照**——[toonflow] 只拍结构 + label、运行态排除、内容靠引用 Map 保留。undo 单元 = 一次用户交互 / 手势，三仓互证：[toonflow] 拖拽可重入合并、[blocksuite] stash/pop 交互期绕过 CRDT 结束一次落盘、[quickdraw] beginBatch/endBatch 手势压成一条。

协作四路线判据（按离线需求与冲突容忍度选）：**CRDT**——[blocksuite] Yjs 底座（离线与合并语义最强，成本最高）；**逐元素 LWW**——[excalidraw] version+versionNonce（不上 CRDT 也能多人，冲突按时间戳丢半边）；**rebase**——[tldraw] 乐观本地 + push/pull/rebase + 服务器仲裁；**rebase-LWW + 幂等 outbox**——[dim0] sequencer + IndexedDB oplog 尾。

- [tldraw][实测] 撤销用**可逆 diff 栈**而非快照：仅 user 来源操作进历史；pendingDiff 按 batch 压栈；undo = 反向 squash 后一次 applyDiff；ephemeral 字段（选中态/光标）永不进历史与同步。
- [basketikun] React 语境的轻量撤销：引用快照式（非命令、非深拷贝），50 条上限，180ms 防抖合并 + 引用相等跳过，applying/paused 双 ref 防自触发。
- [basketikun] 持久化：zustand persist 自定义 PersistStorage → IndexedDB 单 JSON key，400ms 防抖 + 引用相等双层跳过；**图片字节出 JSON**；viewport 单独低频保存。
- [toonflow][实测] 结构化撤销：只拍结构 + label，运行态字段排除，内容靠引用 Map 保留，100 步，拖拽可重入合并。
- [toonflow][实测] 自动保存三件套：debounce + promise 串行链（防并发写）+ revision（防旧覆盖新）；"保存到稳定"循环。
- [tldraw][实测] 协作可以不是 CRDT：乐观本地 + push/pull/rebase（回滚 speculativeChanges → apply 远端 → 重放本地），服务器仲裁 + per-record patch + 协议版本握手；presence 走独立 ephemeral 记录；rebase/push 按 fps 节流。

## SVG 引擎派（AntV X6 v3.1.8，MIT，零框架依赖 MVVM）

- [X6] 渲染合批不用 batch 而用调度器：更新请求压成 flag 位掩码按位或合并 → JobQueue 同视图 id 去重 → **16ms 帧预算分帧**（超预算的任务挪下一帧）——大图初次渲染不冻结主线程的关键。
- [X6] 「消费-返还」协议：`confirmUpdate` 消费自己能处理的 flag、返还剩余 flag 给父级——跨视图依赖未就绪时挂起重试，避免时序 bug。
- [X6] 虚拟渲染：摘除 DOM 但**保留 view 对象置 WAITING**，重挂时补 bootstrap flag 再渲染——复用对象而非销毁重建。
- [X6] 连线四层管线：锚点（anchor）→ 路由（router）→ 连接点（connectionPoint）→ 连接器（connector），四层各自 registry 可替换——连线系统分层的标准答案。
- [X6] manhattan 路由共享障碍图：WeakMap 缓存 + dirty 标记 + optionsKey 失效，堆式 A*；失败 fallback 直角——避障路由的成本集中在障碍图增量维护。
- [X6] 交互爬坡：magnet 是 DOM 属性向上爬坡查找（比事件委托更宽容）；`validateConnection` 内置短路链在前、用户函数最后跑（便宜的检查先做）。
- [X6] snapline 对齐线 O(n) + 提前退出；embedding（拖入父子）先 `isDescendantOf` 防循环引用、batch 内成组撤销。
- [X6] minimap 的优雅解法：**共享同一 Model 的第二个 Graph 实例**——不需要单独同步逻辑，模型即真相。
- [X6] zPivot 稀疏 z 档锚点 + attr registry 声明式伪属性（refX 语义三分）（distill-x6.md §3、§10）——与连线四层管线并列的两大核心设计。
- [X6] 反面教材：全库无空间索引，框选/吸附全量 DOM getBBox——**>1k 节点即劣化**，与 [basketikun] "线性够用"的取舍边界在规模：小图省索引维护，万级以上换档（见 GPU 节门槛）；Store 每次 set 深拷贝 previous；flag 位宽上限 25 个更新类型；transform 插件用 `model.on('*')` 全事件监听。

## 轻量流程图框架（LogicFlow 2.2.5，Apache-2.0，preact + mobx + SVG）

X6 的轻量对照：core 111 文件 21.5k 行（X6 约 5.8 万行），core 运行时依赖仅 8 个。

- [logicflow] 每元素一对 **Model(mobx)/View(preact observer)**，桥接仅一行（index.ts:7-9）——渲染层可整体替换的 MVVM 最小实现。
- [logicflow] 画布 = 单 SVG `<g transform=matrix>`；网格 = SVG pattern + patternTransform 一张 rect 填充——零 DOM 网格四路线互证见「渲染与空间索引」节判据。
- [logicflow] **规则系统 = 声明式数组**：`sourceRules/targetRules/moveRules/resizeRules`（BaseNodeModel.ts:147-152）；校验返回 `{isAllPass,msg}` 直接映射节点变色（拖线时目标可/不可连）；拖线期按四元组 key 缓存规则结果；移动规则支持 x/y 轴向放行——流程图业务约束的工程化标准答案。
- [logicflow] 文本三档：SVG text/tspan 默认；autoWrap/ellipsis 才切 foreignObject + 离屏测高；编辑用 HTML contentEditable 浮层坐标换算，**input 暂存、componentDidUpdate 才落库**（TextEditTool.tsx:111-127）。
- [logicflow] snapline 仅 256 行：epsilon 1px、中心→边缘优先级、命中即 break、**只提示不位移**（对照 X6 全功能版，轻场景够用）。
- [logicflow] MiniMap = 内部第二个 LogicFlow 实例渲染同数据 + matrix 视口——与 [X6] 共享 Model 同思路，双实现互证。
- [logicflow] `partial` 视口裁剪；History = deepObserve + debounce 100ms 全量快照（maxSize 50）——与 [comfyui] 快照 undo 同派，大图同病。
- [logicflow] fakeNode 外拖：伪造节点复用渲染管线画拖拽预览——与 [mind-map] fakeClone（Drag.js）同族互证。
- [logicflow] 反面教材：**`GraphModel.addEdge` 程序化加边不校验规则（规则只挂交互手势）——校验必须挂模型层而非手势层**；sortElements 每变更全量排序自认待优化；React 节点 properties 用 JSON.stringify 比较。

## 树形布局派（wanglin2/mind-map，MIT，SVG 思维导图）

- [mind-map] 布局骨架：「三遍遍历 + setTimeout(0) 分片」管线（定坐标 → 分配 top → 兄弟推移）；兄弟推移 difference/2 上下分摊并递归向根传播；左右导图 = 逻辑布局 + `dir` 变量（首层 index%2 分向、左右独立累计）——一套布局框架支撑 N 种布局的样板。
- [mind-map] 增量策略：无局部重排，每次 render 全树遍历，但**节点实例按 uid LRU(1000) 复用** + JSON 快照对比跳过重算；单点改文本先 `reRender()` 测尺寸，尺寸没变不触发全图——"先测后改"的通用化。
- [mind-map] 大规模渲染（openPerformance 模式）：视口懒渲染（padding 100，出视口摘 `<g>`、可插回）；view_data_change 节流 250ms 重判视口；渲染入口 setTimeout 合并 + isRendering 排队防重入；lastNodeCache diff 回收死节点。
- [mind-map] SVG 连线 path 池：每父节点 `_lines[]` 池画在独立 lineDraw 层，`plot()` 只重设 `d` 不重建元素——SVG 连线层的标准做法。
- [mind-map] 拖拽换父三态命中（overlapNode=当子 / prev·next=当兄弟），鼠标矩形 + 半间隙带（<10px 视为无间隙）；候选 BFS 后反转、深层优先；**fakeClone 伪造树后直接调真布局 renderLine 画预览线**（Drag.js:1083-1119）——拖拽预览不复算真树；10px 阈值、300ms 节流、拖到边缘 AutoMove。
- [mind-map] 缩放平移 transform-only 单图层 + scaleInCenter 补偿公式；ctrl/cmd 滚轮缩放否则平移；触控板 `|deltaY|<=10` 判定——与 [toonflow]/[comfyui] 的判别法互证。
- [mind-map] 缺口：核心无布局过渡动画（仅演示模式 CSS transition）——吸收其布局算法需自补插值层。
- [mind-map] 反面教材：JSON.stringify 快照对比开销；updateBrothers O(N·depth)；拖拽命中循环内逐节点发命令；纯文本逐字符 measureText；Drag.js 250+ 行布局 switch 复制粘贴。
- [mind-map] renderSourceList 渲染来源追踪——渲染触发来源可查。

## Canvas2D 渲染派（litegraph.js，MIT，Canvas 即时模式代表）

- [litegraph] 前后双 canvas 分层：背景层（网格+连线）与前景层（节点）各自独立脏标记（`dirty_canvas/dirty_bgcanvas`），网格不动就不重绘背景层——Canvas2D 分层是脏区管理的前提。
- [litegraph] 缩放降级渲染三阈值（**小缩放是性能救生阀**）：`scale<0.6` 关阴影、不画文字、slot 圆变矩形；连线描边 0.6 阈值；背景图 0.5 阈值；连线流动动画期间强制重绘背景层。
- [litegraph] Canvas2D 裁剪可以零索引：`computeVisibleNodes` 纯 AABB 遍历，连线按两端点 AABB+20px 剔除——规模中等时线性过滤够用，与 [basketikun] 结论互证。
- [litegraph] Canvas 命中测试：数组反向遍历即 z 序（渲染顺序的正序 = 命中顺序的逆序）；**渲染时顺手把连线中点写进数据**（`link._pos`），命中/悬停零重算。
- [litegraph] 连线交互：从 30x20 slot 热区起拖 → 松手 `connectByType` 自动匹配兼容空 slot（省去精确瞄准）；拖线中类型不符的 slot 降 alpha 0.4（视觉反馈即约束）；shift 点已连 input 进入拖拽重连。
- [litegraph] 序列化兼容三件：links 压缩成 6 元素数组省体积；`last_node_id/last_link_id` 保证 ID 永不复用；**两阶段恢复（先 add 后 configure）+ 缺类型建替身节点保留数据**——老文件遇到未知类型不丢数据，版本兼容模板。
- [litegraph] 执行引擎：Kahn 拓扑排序 + 可执行集精简迭代（ComfyUI 血统）。
- [litegraph] widget 混合式：Canvas 即时模式画外观 + DOM 只做文字输入——Canvas2D 派解决输入的通用折衷。
- [litegraph] 反面教材：无 DPR 处理（HiDPI 模糊）；slot 热区三套尺寸不一致；连线只能点中点（±4px）；节点 1000 硬上限；rAF 常驻全速无休眠；鼠标一动即置脏（全量重绘）。

## Canvas2D 元素缓存派（excalidraw，MIT，React + Canvas2D + roughjs）

- [excalidraw] **两级元素缓存**（它性能的核心）：`ShapeCache` 存 roughjs 矢量路径（theme 入键，null 也算缓存防重复生成）+ 离屏位图缓存（`elementWithCanvasCache`）；形状画在**元素局部坐标系**再变换贴出 → 平移缩放零失效——失效键只留 width/height/fileId/points 四个真几何字段（mutateElement.ts:133）。
- [excalidraw] **缩放手势豁免替代 zoom 分桶**：捏合期间 `shouldCacheIgnoreZoom=true` 直接用旧位图重采样（糊但流畅），结束后 debounce 300ms 重生成清晰位图——不按 zoom 层级分桶缓存，用一个豁免开关拿到 90% 收益。
- [excalidraw] **整像素对齐 blit**：`setTransform` 把原点放到 round 后的设备像素做 nearest-neighbor 1:1 拷贝，半像素 tie 加 1e-6 bias（renderElement.ts:901-957）——Canvas2D 位图贴出的模糊问题标准解。
- [excalidraw] rAF 节流按需触发非常驻：每画布独立节流器（WeakMap 按 canvas+ownerWindow 键控）；pointermove 走 batchedUpdates + throttleRAF 合帧——渲染循环不必 setInterval/rAF 常驻（对照 litegraph 反面教材）。
- [excalidraw] 协作可以很轻：**逐元素 LWW**（version 高者胜，同 version 比 versionNonce）+ Figma 式分数索引（fractional indexing）管 z 序 + 20s 全量对账兜底 + 33ms volatile 游标（reconcile.ts:23-44）——不上 CRDT/OT 也能做多人，代价是冲突时按时间戳丢半边。
- [excalidraw] 图像异步三态：`imageCache: Map<FileId, {image|Promise}>` 先存 Promise 占位防重复 decode，decode 完原地替换；图片字节走 fileId 旁路（元素先广播 saved 状态、远端自行拉文件）——元素数据与图像字节分离广播。
- [excalidraw] 网格降级：`actualGridSize < 10px` 直接跳过细线只画粗线。
- [excalidraw] 单元素位图尺寸封顶（cappedElementCanvasSize）：边长 ≤32767、面积 ≤16.7Mpx，超限降 scale（distill-excalidraw.md §一.3）——与 [fabric] 2Mpx/4096 缓存上限互证。
- [excalidraw] 热点元素隔离画布（NewElementCanvas）：正在创建的元素单独第三 canvas，防每帧重画全场景（distill-excalidraw.md §一.9）——创建期高频重绘只碰小画布。
- [excalidraw] 字体晚到批量失效：字体加载完成触发受影响缓存批量重建（distill-excalidraw.md §一.12）——与 [quickdraw] 互证（distill-quickdraw.md #38）；晚到资源必须显式失效。
- [excalidraw] 反面教材：视口裁剪/命中全线性扫描（90k★ 也没建空间索引，App.tsx:6045）；imageCache 无 LRU 上限（对比链接图标缓存反而有 8 条 LRU）；frame 透明度动画把 containingFrameOpacity 进位图重生成键 → 每帧全元素重生成；线性元素碰撞形状无缓存。

## Canvas2D 对象派（fabric.js v7 beta，MIT，对象模型 + 对象缓存）

Canvas2D 第三条路线对照：fabric（对象缓存）/ litegraph（即时模式全量重绘）/ excalidraw（自研元素缓存）。

- [fabric] 双 canvas 层的命中分工：上层只画瞬态 UI（控制柄/选中框），**命中靠 JS 数学不靠 DOM**；`renderTop()` 只清上层，`contextTopDirty` 懒清理——上层透明覆盖但不重绘下层。
- [fabric] objectCaching 的失效纪律：cacheProperties 显式列表触发 `dirty` 且**冒泡只增不减**（Object.ts:613）；缓存上限 2Mpx/4096 边长（config.ts:36-50）防内存爆；**组只缓一层**，子对象带偏移 shadow 直接放弃整组缓存（Group.ts:453）——缓存不是越多越好，有明确放弃条件。
- [fabric] 缩放手势豁免的另一种实现：`noScaleCache` 缩放拖拽期用旧位图拉伸、mouseup 才重建（InteractiveObject.ts:180）——与 [excalidraw] 手势豁免同思路异实现，互证该模式。
- [fabric] perPixel 命中解耦视口：`(tolerance*2+1)*retina` 的专用小 canvas（willReadFrequently）**单独重绘目标后读单点 alpha**（SelectableCanvas.ts:449-489）——像素级命中开销只与目标大小相关。
- [fabric] 变换：composeMatrix 固定顺序 translate→rotate→scale(fold flip)→skew；`transformMatrixKey` 数组做矩阵 memo（ObjectGeometry.ts:455-535）——矩阵计算缓存键化的样板。
- [fabric] PencilBrush 增量笔迹：每 move 只补一段中点二次曲线（不重画整条），半透明/shadow/直线模式才全量重绘（PencilBrush.ts:97-114）；finalize 时 decimate(0.4px)→SVG path 对象。
- [fabric] retina：backstore×dpr + `ctx.scale(dpr)` 一次到位；导出默认关 retina——显示与导出分辨率策略分离。
- [fabric] clipPath 裁剪用 destination-in 离屏合成；浮点噪声会杀缓存（distill-fabric.md A3/A5）——合成裁剪与缓存失效的耦合坑。
- [fabric] 反面教材：`isCacheDirty` 带副作用（注释自认 badly designed）；事件缓存靠隐式出入口配对；`toCanvasElement` 临时改全局状态非可重入。

## Canvas2D hit graph 派（konva，MIT，场景图 + 色键命中）

命中测试第四路线：hit canvas 光栅化色块（pixelRatio 恒 1、imageSmoothingEnabled=false、willReadFrequently）+ 全局 colorKey→shape 表，命中 = 读 1 像素 RGB 查表 O(1)（Layer.ts:406-428）。五路线判据：konva 所见即命中、零双实现，代价是常驻 hit canvas 内存；fabric 数学粗筛 + 按需像素精筛；excalidraw 纯几何线性遍历；litegraph 反向数组 + 连线中点；basketikun SVG 双层 path 命中层（透明 16px stroke 加宽热区，distill-basketikun.md §1.3）。

- [konva] **色键网格吸附**（独家坑位）：预乘边缘读回 ±1 偏差 + **Brave farbling 隐私噪声**会改画布读回色 → 所有键色生成/读回都 snap 到网格（step 3，farbling 时 5）；farbling 靠画 `#282828` 读回对比检测（Util.ts:696-762）——浏览器隐私特性干扰颜色方案的实测坑，任何色键命中方案都要防。
- [konva] 抗锯齿边缘环搜：读不中且 alpha>0 时向外逐环找最近形状像素，半径 10→256 翻倍、alpha 停涨即断（Layer.ts:351-405）。
- [konva] hit 省法三件：非 listening 层 hit canvas 释放为 0x0；缓存节点 hit 位图懒建；**拖拽/变形期整层跳刷 hit graph 且事件侧同步禁命中**（Layer.ts:450-471）——命中图与事件必须同开同关，否则读到旧图。
- [konva] perfectDrawEnabled：fill+stroke+opacity<1 时画离屏合成面防交界暗缝（_useBufferCanvas 触发条件在 Shape.ts:478-505）；isolation surface 池按外接框 1.5 倍涨、连续 10 帧低用量释放（Canvas.ts:178-286）。
- [konva] 杂项防线：visibilitychange 补画防 Chrome 后台清 canvas；指针坐标用 `rect.width/clientWidth` 兼容 CSS 缩放容器；dragend 后同步 draw 防下一次 mousemove 读旧 hit graph。
- [konva] Transformer 数学：变形只改 scale 不改 w/h——新旧盒各表为 `translate·rotate·scale(w/1e7,h/1e7)`，`delta = new·old⁻¹` 按父链换算后 decompose 写回；负宽高翻转用"暂存-裁决-提交"两段式防抖。
- [konva] 反面教材：全局色键表依赖 destroy 纪律（泄漏即误命中）；intersects 逐形状清屏重画；每事件 getBoundingClientRect；Text 命中 = 整包围盒。

## 国产 Canvas 引擎（leafer-ui v2.3.3，MIT；引擎核心在 leaferjs/leafer 仓）

- [leafer] 命中测试第六路线——**多策略按对象类型分派**：按 leaf 缓存离屏 hit canvas + 原生 `ctx.isPointInPath/isPointInStroke` 为主（hit/src/canvas.ts:8-15）；`getImageData` 只兜底半透明位图且限小尺寸 + willReadFrequently（UIHit.ts:21-38）；纯矩形走包围盒数学（RectHit.ts:10-17）；<10px 图形只测 bounds；**hit canvas 全局限量 1000 超限全清**（HitCanvasManager.ts:7）——hit 缓存也要配额。
- [leafer] 手势阈值集中一处 config（各阈值数值 → 详见 interaction.md 手势阈值词汇表；interaction/config.ts:3-30）；**双击判定先查路径上有无监听才延迟 tap**——无人监听不付延迟成本；up 时合并 downPath 保证按下目标必收 up（Interaction.ts:178）。
- [leafer] 输入归一纪律：Pointer>Touch>Mouse 优先级锁死 + **touchend 后 500ms 屏蔽合成 mouse**；多指先 `pointerCancel` 再按 identifier 配对 `{from,to}`；touch preventDefault 仅可拖拽路径才拦截。
- [leafer] 事件：命中路径 LeafList + capture/bubble 三段式；**无人监听不建事件对象**；hoverStyle/pressStyle 在派发时自动套用。
- [leafer] 数据驱动三步 setter：属性装饰器（记值 → 派生标志 → `layout.renderChange()/boxChange()` 打脏，decorator/src/data.ts:5-17）；App = ground/tree/sky 多画布 `copyWorld` 增量合成；JSON 原生进出对称。
- [leafer] 反面教材：`lazySpeard` 拼写进了公开 API；手势状态散在 6 个布尔位（应上 FSM）；emit try/catch 吞错；destroy 默认异步。

引擎核心（leaferjs/leafer，185 文件/15.2k 行，补前篇未确认项）：

- [leafer-core] **三循环事件链**：attr setter → watcher.add → RenderEvent.REQUEST → rAF → renderOnce 内同步 requestLayout → WatchEvent.DATA(updatedList) → partLayout → LayoutEvent.END → partRender——4 个事件解耦，Watcher/Layouter/Renderer 三循环经 Creator 工厂可整体替换（partner/src/index.ts:16-24）。帧调度：rAF + maxFPS=120 跳帧闸门 + 30 帧滑动平均 FPS（Renderer.ts:235-260）。
- [leafer-core] **部分渲染实为单一合并脏矩形**：mergeBlocks 把全部脏块 union 成一个矩形 + 扩边 10px 防残影（Renderer.ts:225-233）——无 excalidraw 式多块分治，**远距离双变更退化为近全屏重绘**（靠 App 多层缓解）——脏区合并策略的取舍对照样本。脏块记录法：before∪after 包围盒，移动元素旧位新位一次覆盖（LayoutBlockData.ts:20-27）。
- [leafer-core] 布局夹心：变更叶按 `__level` 升序算矩阵（父先）、levelList 降序聚合 bounds（子先），while 允许遍历中追加；autoLayout 有 waitAutoLayout 抑制中间态（LayouterHelper.ts）。
- [leafer-core] `__world` 一体两面：12 字段单对象 = 世界矩阵 + 渲染包围盒（Leaf.ts:58,131）；multiplyParent 对纯平移节点跳过旋转乘法快路径（MatrixHelper.ts:149-186）。
- [leafer-core] **重入保护双闸门**：waitAgain + times>3（Renderer/Layouter 同构）——渲染/布局互调的防递归模式，可迁移。
- [leafer-core] stintSet 语义确认（前篇未确认项）：`data[k]!==value && (data[k]=value)`，falsy 归一 undefined（DataHelper.ts:42-45）；非 zoomLayer 属性变化不构造事件对象直接 watcher.add（LeafDataProxy.ts:55-62）。
- [leafer-core] 零碎可吸收：离屏 canvas 池帧末回收；TaskProcessor 按预估时间加权进度；zIndex 中位数插入免重排；Debug.showRepaint 脏区可视化调试开关。
- [leafer-core] 反面教材：`__tempNumber` 三义复用；emit 吞错默认不可见；hitPoint 自注「后期需进行优化！！！」；**README 1.28s/320MB/60FPS 声明仓库内无 benchmark 支撑**（外链 [未验证]，320MB≈336B/图形与扁平对象结构量级吻合，佐证非实测）。

## 生产化节点图（ComfyUI_frontend，GPL-3.0 + 内嵌 litegraph fork MIT）

「老 Canvas 引擎怎么生产化运维」的样板——fork 痛点逐项补丁：

- [comfyui] 原 litegraph 反面教材的修复对照：DPR/HiDPI 修了（独立 `canvasViewport.ts`：css×dpr + setTransform + css 尺寸探测）；连线命中从「中点 ±4px」升级为 **Path2D 缓存 + isPointInStroke + QuadTree 两级**（粗筛全图、精筛候选）；节点上限 1000→10000；rAF 常驻架构保留但加 **fps 上限 / 60 帧失败熔断自愈 + Sentry 上报**——不改架构也能止血。
- [comfyui] 指针层声明式重写（`CanvasPointer`）：click/drag 声明式分派、maxClickDrift=6 防微抖判点击、trackpad 与 wheel 判别——即时模式引擎的输入层现代化方向。
- [comfyui] Vue3 与 Canvas 即时模式共存的三件套：主 canvas 画网格背景 + **Vue DOM 节点层**（单容器 `scale3d translate3d` 镜像相机，**每帧直写 style 绕过 vdom diff**）+ 连线专用第三 canvas；DOM widget 同步搭 `onDrawForeground` 渲染钩子便车；引擎集合 `shallowReactive`（浅响应防深遍历）。
- [comfyui] 执行进度渲染：last-write-wins rAF 合并器（高频进度只留最后一帧，丢弃计数可采样）；预览图 blob URL 引用计数 + 按执行代际回收；渲染序按 (graphVersion, layoutVersion) 双版本号缓存。
- [comfyui] 任务协议：WS 二进制帧 `[u32 type][payload]`（1=预览图 / 3=progress_text / 4=带元数据预览）+ JSON 事件总线并行，指数退避重连；queuePrompt/interrupt 幂等设计。
- [comfyui] 持久化：workflow JSON 双 Zod schema（0.4/1）共存迁移；localStorage 草稿 per-key + LRU + 配额遥测；undo = 全图快照 + 50 步上限 + 50ms debounce（快照派的反面教材本体，但护栏齐全——引用它时连护栏一起抄）。
- [comfyui] DPR 探测：`canvas.width=0` 才能量出真实 CSS 尺寸（probeCssSize，distill-comfyui.md §一.1）；字号 LOD 用 sqrt(dpr) 因子（distill-comfyui.md §三.2）——与 [litegraph] 固定 0.6 阈值对照，连续因子替代硬阈值。
- [comfyui] 反面教材：rAF 仍无 idle 停车；模式布尔开关散布 20+ 处；Yjs 引而未联（无 provider）；localStorage 扛大工作流。

## 零依赖引擎派（quickdraw，MIT，2026 新，纯 ESM 直发）

「自写 vs 引库」边界的参考答案（core 0 外部 import，自写约 1100 行：geometry 282 / store 353 / UI 631 / emitter 10）：

- [quickdraw] **diff 即一切**：store 是扁平 `Map<id, record>` + 不可变记录，每次 transact 产出 diff `{added, removed, updated}`；**同一个 diff 兼任 undo 单元、同步报文、持久化增量**（store.js:1-12）——一套 diff 三个用途，消灭三套簿记。
- [quickdraw] 命中不用空间索引：线性按 z 降序 + AABB 膨胀分相再精确测，容差 `8/camera.z` 保持手感一致（editor.js:475-482）；marquee 对描边类做线段-矩形精确相交（shapes.js:573-598）——中规模画布线性够用，与 [basketikun]/[litegraph] 互证「先线性后索引」。
- [quickdraw] 手势归约为**单个判别联合 session 对象**；第二指落下即回滚刚起笔的笔画（`_abortForPinch`，editor.js:765-778）；自写 tap/双 tap 检测补 iPad 无 dblclick；笔模式掌压拒绝 + 笔不参与 pinch——触笔/触掌/捏合的冲突仲裁细节。
- [quickdraw] undo 纪律：`applyDiff(invertDiff(d),'user')` + `_applyingHistory` 防重入；`beginBatch/endBatch` 把整个手势压成一条 undo；`netDiff` **剔除拖回原点的空操作**（store.js:51-67）——历史里不留垃圾；与 [tldraw] 可逆 diff 栈同构互证。
- [quickdraw] 笔画增量报文：`packDiff` `{grow, at, pts}` 只送尾段新点（store.js:80-121）——协作/录制场景笔画不整笔重传。
- [quickdraw] 笔画保真三件套：getCoalescedEvents 收高刷中间点 / 笔亚像素合并 / 坐标量化百分之一像素（distill-quickdraw.md 二.29-31）；WeakMap-per-props 自动失效缓存（distill-quickdraw.md #41）——高刷输入不丢点，缓存失效按属性粒度自动化。
- [quickdraw] 网格墨量恒定算法：倍频程带内中间刻度按渐显公式随缩放出现/消失，**缩放时网格不变亮不变暗**（editor.js:1694-1788）——无限网格的视觉连续性问题有现成解。
- [quickdraw] 零依赖边界判断标准：「算法正确性风险高的才引库」——perfect-freehand 是唯一实质借用且 vendor 进源码保留 MIT 头；明确不写 CRDT（用记录级 LWW 顶替）、空间索引（线性+AABB 顶替）、bundler（raw ESM 直发）。
- [quickdraw] 工程纪律：153 测试、0 TODO、手写 d.ts 配 drift 测试防类型漂移、renderScene 一份代码服务屏幕/录制/导出三处——小团队 SDK 的质量样板。
- [quickdraw] 反面教材：跨模块读私有 `store._batch`；marquee 每次 move 全量重排序；空 catch 吞错。

## GPU 渲染派（infinite-canvas-tutorial，MIT，WebGL/WebGPU，AntV 系教程工程）

什么时候值得上 GPU：单视口 >1 万元素、复杂特效叠加、或需要 compute shader（vello 类矢量渲染）——DOM/SVG 与 Canvas2D 各派在 1 万元素以下游刃有余（各派实测见上）。

- [webgl] **跨后端抽象**：fork @antv/g-device-api 做 HAL，GLSL 单源 + naga WASM 编译到 WGSL 跑 WebGPU；WebGL2→WebGL1 运行时降级——多 GPU API 共存的工程结构样板。
- [webgl] GPU 每帧全量重绘无 damage region，**脏标记上移到 CPU 资产层**（GeometryDirty/MaterialDirty ECS 组件 → drawcall 级重建）——GPU 派的脏区位置与 Canvas2D 派完全不同。
- [webgl] **GPU 文本完整链路**：TinySDF 离屏 canvas → EDT/ESDT → potpack 图集（SDF_SCALE=4），shader 三模式 SDF/MSDF/位图；高级 shaping 走 opentype.js / harfbuzzjs WASM——GPU 白板最大难点的现成答案。
- [webgl] 命中测试仍是 CPU 解析法 + rbush（20000 圆 0.088ms，20× 提升）；复杂 Path 注入 WASM kurbo；GPU color picking 只提及未实装——**GPU 渲染不改变命中架构**，rbush 与 [tldraw] 同款。
- [webgl] 笔迹方案最新颖：不用 perfect-freehand 的 outline 三角化，**articulated line shader**（Ciallo 式）——相邻圆公切线连 quad、stamp 模式 fragment 解二次方程；join/cap/虚线全在 shader 距离场实现。
- [webgl] Path 填充：earcut 快路径 + libtess 兜底按拓扑自动选择；裁切/擦除用 stencil（clip/mask/soft-clip/非原子橡皮）；mix-blend-mode 走离屏分段合成。
- [webgl] 性能件：instanced drawcall 按形状类型池化、单 DynamicUniformBuffer 线性分配、RT dead pool、纹理 LRU 256、fractional index 兼任 z 序与协同序（与 [blocksuite]/[excalidraw] 互证）。
- [webgl] 反面教材：potpack 图集不可增量更新；WeakMap 缓存不可枚举需另维护 Set；shader #define 变体爆炸；**剔除可能负收益（教程自认）**——GPU 全量重绘有时快过剔除+重建；WebGL1 双路径包袱。

## AI 生图画布双代架构（InvokeAI，Apache-2.0，React 前端）

- [invokeai] **状态与像素引擎所有权分离**（webv2 重写核心）：Redux reducer 只持可序列化契约，像素/交互/历史归 per-project **React-free engine**（`workbench/canvas-engine/ARCHITECTURE.md` "Ownership invariant"）——React 状态层不碰像素，引擎不进 React 树。
- [invokeai] 图层 = 四栈森林（raster/control/regional_guidance/inpaint_mask），组为 pass-through，不可变树 + 分层索引（`document/documentIndex.ts`）。
- [invokeai] 渲染调度第三种模式——**帧前需求计算**：`render/frameDemand.ts` 只有与视口相交的层才 rasterize，离屏层按需 + LRU；显式区域 damage，非 rAF 常驻（`render/scheduler.ts`）——对照 rAF 合帧派（basketikun）与常驻派（litegraph）。
- [invokeai] 大图内存用**总账 + 租约**不用猜：RasterController 运行字节总账、512MiB 软限、`RasterReadLease` 读租约（pin + freshness guard）、后台大活先预留再分配、超限返回类型化 over-budget。
- [invokeai] 编辑准入协议（admission 先于突变）：History 预订 undo 字节数，订不下 over-budget 拒绝且三无伤（distill-invokeai.md §一.8）——与内存总账/租约（上条）互补：预算防线前移到突变之前。
- [invokeai] 进度链路（hub/handshake/热冷分离/对账闭环）→ 详见 network-api.md 三。
- [invokeai] 跨 tab 巨坑与解法：queue item delivery claim（2 分钟过期）+ Web Locks 证明页面存活；**unload journal 用独立 IndexedDB 库——Chromium 会丢同库未关事务的 unload 写入**。
- [invokeai] 工作流：@xyflow/react v12 + 自研字段类型系统（`fields.ts` 三个 Set 驱动渲染策略）；类型化连线验证 + graphIndex；大图阈值 300 节点/500 边、初始渲染只渲 120 节点。
- [invokeai] 批次前端解析：batch/generator 节点提交时展开为笛卡尔积 × zip 的队列组（`core/batch.ts`）。
- [invokeai] 状态设施：26 行 externalStoreCore + projectedExternalStore（懒订阅 + 投影相等保持 snapshot 身份）+ React Compiler 兜底 memo——比 zustand 更小的自研样板。
- [invokeai] Gallery：服务端 thumbnail/full 两档；稀疏分页（gap 不压缩、recents overlay 只贴最新端）；409 恢复 probe → 详见 network-api.md 七。
- [invokeai] 独门性能教训：模块级 `export *` barrel 失去 tree-shaking，把无关 chunk 拖进首屏；顶层读 `Number.EPSILON` 使模块 side-effectful（`fields.ts` 注释 + `performance/README.md`）。
- [invokeai] 性能门：per-route 字节预算 + source-owner 精确匹配 + 请求计数，禁止提预算过审；画布像素级 golden PNG+JSON 基线（`render/golden/`）——性能回归测试的标杆做法。
- [invokeai] 反面教材：webv1→webv2 全量重写无兼容层（与 mayi「小步回滚」哲学相反的两极）。

## CRDT 协作派（BlockSuite/AFFiNE，MPL-2.0，Yjs 底座）

- [blocksuite] CRDT 数据建模：每页一个 **Y.Doc 子文档**（分片）；块 = 扁平 Y.Map + `sys:children` 存 id 数组（不用嵌套结构）；画布元素挂 surface 块的 `elements = Boxed(new Y.Map())`、每元素一个 Y.Map；**树结构用扁平 Map 存 {index,parent}**（其 mindmap 元素即此做法）——嵌套 Y 结构是反模式，扁平化 + 指针才是正路。
- [blocksuite] z 序用**持久 fractional index**（`generateKeyBetween` + 32 位随机后缀防撞）+ 运行时 LayerManager 把有序流切成 block/canvas 交替层——DOM 块与 Canvas2D 交错堆叠，两种渲染体系共享一个 z 轴。
- [blocksuite] CRDT → 渲染的桥：Yjs transaction → rxjs Subject → `refresh()` rAF 合帧，**一帧最多一次、断连时不渲染**——协作更新节流的两个条件（合帧 + 可渲染）。
- [blocksuite] 视口剔除两态机：DOM 块视口外 `visibility:hidden`（不摘 DOM，保状态）；**每帧最多 2 个子组件渲染**的硬上限——渲染分帧不用复杂调度器，一个常数就够。
- [blocksuite] 缩放中画灰占位符（糊但可交互）；turbo-renderer 用 Web Worker 离屏渲染 + 交互时回退 DOM。
- [blocksuite] 协作细节：awareness 存 {user,color,selection}，光标坐标存**文档坐标系**（视口容器整体 transform，光标不参与视口换算）；离线 = IndexedDB 存增量 update 日志 + BroadcastChannel 跨 tab 同步；子文档逐个入队懒加载、队列可按 docId 插队。
- [blocksuite] undo 与 CRDT：`Y.UndoManager` trackedOrigins 只收本地 clientID；**拖拽等交互期用 stash/pop 绕过 CRDT、结束时一次落盘**——undo 单元 = 一次用户交互，不是一次 transaction。
- [blocksuite] 反面教材：属性 getter 带副作用（xywh 边读边算边发事件）；Canvas2D 全量重绘无脏区；LayerManager 组变化全量重建；热路径装饰器直读 Y.Map 无本地缓存。

## Agent + 协作画布（dim0，MIT，v0.3.102，Agent 读板/写板是差异化层）

- [dim0] **LOD 逐节点类型定价**：`defineNode({lod:{minZoomForReact}})`——iframe 类 0.6 / 重 React 类 0.25，低于阈值画 glyph 占位 + off-screen 挂载（node-types/mini-app/def.ts）——LOD 不按 zoom 一刀切，按节点类型渲染成本分别定价。
- [dim0] 协作不用 CRDT/OT：后端无状态 sequencer + relay，客户端 rebase-LWW（undo 未 ack 的本地批 → 应用远端 → 重放）；seq 权威 = PG oplog + Redis INCR 播种；`batch.id` 幂等；outbox = IndexedDB oplog 尾（ADR-SYNC-001）——与 [tldraw] rebase 路线互证，再加幂等与离线 outbox。
- [dim0] Presence：服务端 presence map（**4KB 上限**）随 welcome 快照一次下发；客户端 30ms 采样 + 50ms 双沿节流。
- [dim0] **Agent 读画布给投影不给全量**：确定性无 LLM 快照块（类型分布 / 分层 outline / 选区 / oplog 净折叠的 recent changes，预算常量显式）+ 可选 viewport 截图给 vision——大画布塞不进上下文，按预算投影。
- [dim0] **Agent 写画布走人手同管线**：领域动词端口 `BoardMutator` + `store.batch()`，使 agent 写与人手编辑共用 undo/persist/sync；位置用 `near{node_id,dir}` 关系放置替代裸坐标；`navigate` 有 cd 语义——agent 必须过与人手相同的校验/撤销层（反面：绕过 convert 层插节点 → 主题漂移回归两次）。
- [dim0] 颜色存储与显示分离：`_storedColors` 为唯一事实源，显示样式按主题投影，服务端忽略 wire 显示色（distill-dim0.md §一.2）——主题系统通用铁律：存语义色，算显示色。
- [dim0] mini-app 沙箱两代：旧 = 任意 JSX → sucrase 子进程校验（不 eval）→ sandbox iframe；新 = **解释器即沙箱**（受限 JSX + 固定注册表 + 5 动词，封 prototype 逃逸 + op/深度预算，无 eval 无 iframe）；**YAML-DSL 路线实测失败——「模型写不好 DSL」**，让 LLM 写受限代码而非 DSL。
- [dim0] 离线三平面（content/meta/view），camera/selection 永不进同步集；load = snapshot + replay；级联删 `sync_meta` 否则静默丢编辑。
- [dim0] 反面教材：README 自称 "operational transforms" 实为 LWW rebase——营销与实现脱节；CORS `*` + credentials 自标风险。

## 自然语言驱动画布 Agent（ai-moive-studio，Apache-2.0，Python + Vue，~1.7k★）

Agent 操作画布**第三条路线**：受约束 ReAct 多工具 + 服务端固化阶段管线（对照 dim0 增量 BoardMutator、timeline-studio 全量 JSON 替换）。

- [movie] **ToolEffect 统一信封**：每个工具返回 `{effect:{mutated,needs_refresh,refresh_scopes}, audit:{risk_level}, display}`（backend/src/assistant/types.py:10）——刷新范围/风险等级/UI 展示全由协议驱动，不靠各工具自述。
- [movie] **client_id 映射批量建图**：LLM 用自编 client_id 表达内部连线，服务端创建后映射真实 UUID 再落连线；`source_item_id` 自动补上游连线 + row/column/grid 自动布局（canvas_tools.py:149,190,241）——LLM 不需要知道真实 ID。
- [movie] **服务端一致性守卫**：目标含变更词 + 文案含成功词 + `effect.mutated` 全 false → 改写为失败消息（service.py:630）——LLM 报喜不报忧的防线。
- [movie] 重复失败熔断：tool+args 签名失败一次入黑名单，原样重试直接终止回合 + `recursion_limit:12`（service.py:269,439,535）。
- [movie] LangGraph `interrupt()` 删除确认闭环：interrupt → SSE → ConfirmationCard → `/resume` 带 decision/interrupt_id + 防并发重入——危险操作确认的通用骨架。
- [movie] **双层工具协议**：15 个低层画布原语 + 6 个 `workflow_*` 阶段工具（剧本→角色→分镜管线固化为服务端确定性代码），prompt 禁止低层工具伪造主链路节点（agent_factory.py:384-592）——主链路确定性 + 自由创作留给 ReAct。
- [movie] 参数预抽取：正则 + 关键词表抽 style/时长/镜头秒数作 `workflow.parameters`，missing_fields 非空禁调阶段工具；provider_context 协议快照（提交时存 version/provider/base_url，轮询校验连接漂移）；**"Polling never resubmits a POST"**。
- [movie] 结果资产化：provider URL 下载进 MinIO 只存 object_key；前端 `stripTransientMediaUrls`——临时 URL 永不进持久层（与 toonflow checkpoint 同哲学）。
- [movie] Konva+DOM 混合渲染：富文本/状态 chip 走 DOM overlay、编辑中节点从 Konva 层剔除——「canvas 画内容 + DOM 画交互」与 [litegraph]/[webav] 同族互证；**视频 poster 帧 `currentTime = min(duration/2, 0.05)`** 技巧（KonvaCanvasStage.vue:657）；per-item 300ms 防抖 PATCH + lite/detail 分层加载。
- [movie] DB 轮询桥接 SSE：transient_status_issue 不判死（distill-moive.md §一.9）——与 [shuo] "只提醒不判失败"同哲学：瞬态故障不升级终态。
- [movie] 反面教材：agent 伪流式（整回合跑完再重放事件）；变更后全量 reload 画布；无视口裁剪 + deep watch 全量；**CLAUDE.md 宣称 Playwright 但 package.json 只有 vitest（AI 重度开发项目的文档漂移实证）**。

## Agent 工作区画布（opencove，MIT，Electron + @xyflow/react + xterm + node-pty）

- [opencove] **PTY 与呈现分家**：Worker 持真相——PTY → `PtyStreamHub`（seq 流）→ 无头 xterm + SerializeAddon → snapshot，client 按 `attach(afterSeq)` 重放——renderer 重载不丢终端，断线重连零损耗。
- [opencove] 帧预算输出调度：64k 分块、交互期 8k + 300ms 延迟、rAF 每帧 4 次/8ms 上限——终端洪流的通用整形法。
- [opencove] 画布三件套：DPR 吸附（1/dpr 网格对齐 GPU 层）、xterm WebGL canvas transform 清理、WebGL→DOM 渲染器降级时保滚动位。
- [opencove] **Agent 是第三 client**：Control Surface `node.*` + `canvas.focus` 与 Desktop/CLI/Web 同一契约；Agent 节点 = terminal 节点的 overlay（durable binding 分 verified/hint 两级 + hook 状态纯函数投影 `applyAgentStateToNodes`，**冷恢复只信 verified binding**）。
- [opencove] 恢复流程带 CAS/generation fence——恢复写回需世代围栏，防旧快照覆盖新状态。
- [opencove] 对话内容读 provider 会话文件（`~/.claude/projects/*.jsonl` 等）而非解析屏幕——与 thoughtdag 导入协议互证：**原始会话记录 > 屏幕抓取**。
- [opencove] 反面教材：30+ hook 组合根爆炸；`node_scrollback` 兼容双写 mirror。

## LLM 对话转思维图（thoughtdag，MIT，Vite + React + @xyflow/react）

「会话历史 → 可编辑图」的完整协议（对 ZCode 会话提炼场景可直接复用）：

- [thoughtdag] 协议核心 **"Wires are the context"**：`walkUpAncestors`（后序 DFS）+ `partitionContext`（materials/references/mainline 三层）是唯一真相，prompt、面板、预览共用；**语义在边**（多父顺序存 `edge.data.contextOrder`），拖动节点不改上下文——图结构即上下文装配器。
- [thoughtdag] 编辑即反传：断线/高亮过滤/折叠直接改下次请求；**同图必出同 prompt**（确定性要求）。
- [thoughtdag] 映射规则：一 exchange = 一 Q/A 节点；@提及 = 真实虚线边（不隐形注入）；拖线落空地 = 新建续问节点、落卡片 = 引用。
- [thoughtdag] **会话导入协议**：turn→节点；tool_use/result 配对成可单独排除的原子附件；thinking 只计数不展开；子代理成分支；compaction 出 Note；源文件只读 + 冻结快照。
- [thoughtdag] 实测教训：无工具模型喂工具记录必须在 header 明说"本对话无工具"（三档 header）。
- [thoughtdag] 布局自研三遍 Column-Tree（非 dagre），高度取 `max(measured, estimate)` 防缩略图低估——与 [mind-map] 三遍遍历管线互证。
- [thoughtdag] 持久化：IDB 对象存储 + 1s debounce——**createJSONStorage 每 chunk 50-100ms 卡顿的实测教训**（大 JSON 字符串序列化是 IDB 的坑）。
- [thoughtdag] 语义 zoom ladder：4 级摘要、短层必须「写」长层必须「引」（distill-cove-dag.md thoughtdag §一.11）——语义分级供给上下文，附两次失败设计记录。
- [thoughtdag] Agent 侧只读 MCP（`why_check`/`recall_turn`）——对照 dim0 写板协议：只读是另一种合法选择。
- [thoughtdag] 反面教材：legacy 导入把 note 串进结构链（需 `healLegacyNoteEdges` 幂等修复）——导入协议要带自愈。

## Web 端媒体处理引擎（WebAV，MIT，bilibili，WebCodecs 封装）

- [webav] 分层样板：四包单向依赖 internal-utils→av-cliper→av-canvas/av-recorder；核心 = **IClip 素材抽象（tick/ready/clone/split/destroy）+ VisibleSprite/OffscreenSprite 两种壳 + Combinator 合成**；预览与导出共用同一素材、`copyStateTo` 平移状态（av-canvas.ts:441）。
- [webav] av-canvas 纯自研（无 konva/fabric）：canvas 2d 画像素 + **DOM 覆盖层画选中框/8 缩放手柄/旋转手柄/参考线**；手柄缩放用旋转坐标系投影数学（sprite-op.ts:335-404）；磁吸距离随分辨率缩放——「canvas 画内容 + DOM 画手柄」与 [litegraph] widget 混合式同族。
- [webav] **两种时钟**：预览 = blob Worker 的 workerTimer（免后台节流）+ performance.now 修正 + AudioContext.currentTime 调度音频；导出 = while `ts += 1e6/fps` 离线推进、音频静音占位补空洞——实时播放与离线导出必须分时钟。
- [webav] 编码背压：`encodeQueueSize > 50` 则 sleep(15)（combinator.ts:32）；GOP 3s 一关键帧；**双 VideoEncoder 按 GOP 奇偶交替**提升吞吐、按关键帧边界保序（recodemux.ts:298）。
- [webav] 素材生命周期：流先落 OPFS tmpfile、内存只留 sample 索引（视频 data:null）；tick 按 GoP 解码 + 缓存帧 + 预解码；seek 回退最近 IDR（视频阈值 3s、音频 100ms）；6s 超时抛错带 performance.memory 诊断。
- [webav] 兼容性弹性清单：解码失败自动降级 prefer-software；**不 await flush（Windows 卡死坑）**；Chrome constraint_set_flags 清零补丁（issue #203）；手工构造 ESDS/VP9 描述。
- [webav] 导出：每 500ms 增量写流 + unsafeReleaseMP4BoxFile 随写随弃防 OOM；取消 = aborter + destroy 全链路；fastConcatMP4 免重编码拼接（时间戳归零累加偏移）。
- [webav] 扩展钩子：`tickInterceptor` 每 Clip 可拦截 tick 输出（绿幕/变速等二次处理）；用户实现 IClip 即接入画布与合成器——插件接入面最小化的样板。
- [webav] 反面教材：sleep(15) 轮询遍布；AudioClip 全量 PCM 驻内存（与索引化原则不一致）；预览每 33ms new AudioBufferSourceNode；scaleRect 8 分支复制粘贴；48kHz/2ch 全库硬编码。

## 关键帧时间轴（animation-timeline-control 2.3.5，MIT，core 2864 行）

时间轴画布与自由画布共享坐标系思想，但有自己的专属手法（用户 IC-main 的 LTX 时间轴/数字人场景可直接对照）：

- [atc] 像素↔时间双向映射一个公式：`valToPx = val*(stepPx/(stepVal*zoom))`（timeline.ts:1409-1453）；**缩放锚定光标**：先存光标屏幕坐标、缩放后反推 scrollLeft（timeline.ts:437-458）——缩放不动光标所指时刻。
- [atc] 标尺刻度：`findGoodStep` 取 [1,2,5,10]×10^pow 的"好数" + 只渲染可见区 + 标签避让（timelineUtils.ts:45-74）。
- [atc] **借原生滚动条虚拟化**：oversized scrollContent + scroll 防抖重绘（timeline.ts:394-415）——不自己写虚拟滚动，浏览器滚动条就是虚拟化。
- [atc] 播放头出界自动扩容/滚屏（timeline.ts:2238-2243）；拖拽吸附施加在 offset 上**保持选中集相对间距**（`snapAllKeyframesOnMove` 才切换为逐个吸附，timeline.ts:819）；组拖拽先全局钳制再统一落位；点击/拖拽双阈值 3px + 120ms。
- [atc] **引擎解耦最小协议**：`setTime/getTime/onTimeChanged` + `TimelineEventSource` 过滤防环（README.md:339-359）——时间轴与播放引擎双向绑定的最小面，IC-main 的 LTX 时间轴可对照。
- [atc] 事件全可取消且回滚：`preventDefault` + `_preventDrag` 恢复 startedVal（timeline.ts:2827-2837）；模型只读、元数据零拷贝挂载。
- [atc] 反面教材：`off()` 过滤条件写反会误删同 topic 其他回调（timelineEventsEmitter.ts:35-41）；`_pixelRatio` 恒 1 未接 devicePixelRatio（HiDPI 半成品）；2864 行 God class；console.log 当错误通道。

## 多轨视频时间轴（timeline-studio，MIT，Tauri/Rust + Next.js）

- [tl-studio] **schema 单源生成**：Rust serde+schemars 定义一次 → `timeline-render --emit-schema` 生成 TS 类型与 JSON Schema（`src/types/contracts/`）；semver 兼容策略：MAJOR 不同拒载、MINOR 仅加性靠 serde 默认值——契约管理的标准答案。
- [tl-studio] **agent 友好单 JSON 要点**：顶层扁平、track 内嵌 clips、效果按 ID 引用全局数组、clip 四时间字段（timeline start/end + source start/end + speed）、封闭字符串枚举——「整个时间轴是一个 JSON 文件，所以 AI agent 能编辑视频」。
- [tl-studio] AI 编辑协议两条路线：小文档走**整文档替换 + 命令清单审计（commands 带 rationale）+ 验证-修复循环**；大画布走 dim0 的增量 BoardMutator——按文档大小选路线。
- [tl-studio] 播放双层时钟：rAF 60fps 更新 UI + 1Hz 节流同步后端，`video.currentTime` 为主时钟；React 手法：PlayerContext 里 currentTime 恒 0，**独立 PlaybackTimeContext 供 60fps 订阅**——高频值不进低频状态树。
- [tl-studio] 时间轴不需要 canvas：纯 DOM，轨道纵向 @tanstack/react-virtual、片段横向手写时间窗剔除、**LOD 按像素宽度分档**（<50px 不渲染详情，100/300 分档预览质量）、renderDetails 门控昂贵 hook（optimized-clip.tsx）。
- [tl-studio] 吸附引擎：typed SnapPoint + strength 权重，有效阈值 = threshold×(1+strength)，跨轨磁性衰减 1.0/0.8/0.6（snap-engine.ts）——吸附强度分级比单一阈值精细。
- [tl-studio] 编辑几何纯函数化：trim 限界/碰撞/slip/slide 全是纯函数，**拖动只改本地 preview、松手才进状态机，Shift+松开 = 取消**；拖拽 16ms 双通道节流（即时 UI / debounce 状态提交）。
- [tl-studio] 预览缓存两层：前端 LRU 键 = timestamp+effectsHash（参数变键即变）+ 字节预算驱逐；Rust 侧三路 LRU+TTL+压缩。
- [tl-studio] agent 工具粒度按动词：Rust MCP 仅 18 个粗粒度动词工具（add/move/split_clip，手写 json! schema）——对照 dim0 的 BoardMutator 领域动词。
- [tl-studio] 反面教材：UI 模型与契约 schema 双轨漂移 → **1716 行有损转换器**（FIXME 注明转场直接丢弃）；66 个 TS AI 工具的 `getSchema()` 全是空壳、与 Rust MCP 另写一份 schema 失同步；clip 数据模型混入 isSelected；吸附双实现且强者不在主路径；宣传的 Remotion 渲染实际走 Rust+ffmpeg。

## 插件化节点引擎（rete 2.0 core，MIT，src 8 文件 707 行）

- [rete] **Signal/Pipe 可取消中间件链**：处理器返回 undefined 即否决（scope.ts:60-77）；**双阶段信号**——`nodecreate`（可否决）→ `nodecreated`（通知）：写操作有前置否决窗口，比"先改再回滚"便宜。
- [rete] 插件协议的类型安全：`Scope.use()` 插件树 + 编译期信号契约校验（`CanAssignSignal`）+ `.debug()` 让未处理信号显形（scope.ts:27-53）——插件化系统防"信号没人接"的样板。
- [rete] 价值评估：core 只覆盖信号总线/插件组装/最小模型（Socket/Port/Input/Output/Node/Connection）；渲染/校验/序列化全在插件仓——评估这类"核心极小 + 生态承担一切"架构时按插件生态成熟度判断。
- [rete] 反面教材：取消语义靠 falsy 判断（editor.ts:82）——0/'' 会被误判为否决，取消通道要显式类型。

## AI 生成落画布的工程细节（make-real 补充，范式与 UX 见 ui-ux.md）

- [makereal] 导出桥：画布导 SVG 时向 iframe postMessage 请求 html2canvas 截图回传，**2s 超时兜底**（PreviewShape.tsx:238-270）——iframe 内容进宿主导出图的标准桥接。
- [makereal] License 冲突警示：package.json 标 MIT 但 third-parties.ts 注释自称 AGPL、仓库无 LICENSE 文件——引用前先裁决 [未验证]。

## React Flow 12 深度定制（AI-Canvas-tauri，Source-Available，与 InvokeAI/n8n 的 react-flow 系改造三对照）

- [aicanvas] **边不进 React 渲染循环**：边走 store 快照 + SVG 数学拾取层——React Flow 的边渲染是其最大性能瓶颈，三家改造殊途同归（[invokeai] 自研字段系统绕、[n8n] renderData shallowReactive Map 注入、[aicanvas] 直接把边搬出 React）。
- [aicanvas] LOD 16%/25% 双阈值换源 + **180ms 渐进调度**（降级不瞬变，错峰执行）；工具栏用 **CSS 变量缩放补偿**而非独立浮层（对照 [basketikun] scale(1/k)）；滚轮自接管不复用库默认。
- [aicanvas] 状态架构：Zustand 23 slices；IndexedDB 只存引用 → 详见 network-api.md 五；Rust 侧管凭据/插件快照/MCP 桥/path_policy——桌面 Tauri 的职责切分样板。
- [aicanvas] License：Source-Available 禁商业再分发/套壳/白标；10k stars 承诺转 MIT——「星标换许可」模式首见。

## 设计编辑器（grida，Apache-2.0，框架无关核心 + Skia-WASM 双后端）

- [grida] **吸附阈值随 zoom 自适应**：`ceil(5/zoom)`（packages/grida-canvas-react/_snap.ts:21-26）——固定像素阈值在缩放下失效的正确化。
- [grida] undo **300ms 时间桶合并同类 action**（editor-history-adapter.ts:243-262）+ 六态录制（record/silent/gesture 三对）；单 immer store，action reducer 出 patches/ops。
- [grida] Figma 标准手势覆盖度最高的开源实现（方向键微移 shift=10px、alt 拖拽克隆、alt+hover 测量三态、enter/tab 层级遍历）；唯一缺口 flip 用**诚实 toast** 不静默。
- [grida] 小巧思：`0` 键单击 100%/双击 0% 透明度；键盘微移 500ms debounce 伪造手势态让吸附线也出现；window blur 统一重置修饰键防卡死；快捷键默认 preventDefault 防浏览器加速键蚕食。
- [grida] 双后端协议先行：DOM ∥ Skia-WASM（Rust 引擎独立仓经 WASM 消费）同一 editor 协议；只读画布挂 WASM surface **旁路整条 React 管线**。

## Agent 原生生产画布（TapCanvas，MIT，React Flow 12，~68 万行）

- [tapcanvas] **单焦点渲染**：全画布一个 taskNode 类型 ×12 种 kind 由 schema kernel 驱动（icon+27 种 feature 开关）；**只有唯一选中节点挂载 1.1 万行重体组件，其余渲染骨架**，壳/体共用尺寸真相源切换像素级无跳变（TaskNodeCard.tsx:71-100）——React Flow 大卡片重体的标准解。
- [tapcanvas] **AI 只改库不碰前端状态**：画布按钮发「自然语言合同 + JSON 作用域 + 受限工具白名单」（dispatchIntent.ts:14-60）；FlowPatchToolCall 五原语经 BatchBuffer **整批原子提交**；服务端改库 + SSE 回传——一切生成都走「真实任务→真实资产 URL→交付证据」可验证链路。
- [tapcanvas] 性能三件：LOD 滞回 0.32/0.38、拖拽帧 DOM 直写旁路、SHA-256 资产指纹；空画布 4 张快速开始卡直接种最小样本流 + 双 rAF fitView。

## ComfyUI 生态画布三档集成模式（ComfyTV / ComfyUI-Local-Infinite-Canvas / ComfyUI-Infinite-Canvas）

- 集成深度三档递进（选档 = 抗宿主升级 vs 执行器/节点生态的取舍）：**协议适配派**（Express 网关把 20 条工作流暴露成 OpenAI 兼容「模型」，画布只改 Base URL 零改动）→ **iframe 外挂派**（aiohttp 单文件 `/prompt`+`/ws(clientId)`+`/history` 教科书集成，output→input 用内容哈希+硬链接接驳，`__init__.py:893`）→ **LiteGraph 深度共生派**（ComfyTV：节点内挂 Vue3 DOM widget、`queuePrompt({partialExecutionTargets})` 复用宿主执行器）。
- 三家共同点：**下游消费轻量引用（文件名/库 id/DB 行），位图从不进画布 JSON**。
- 扩展形态的鲁棒性成本集中在宿主竞态：三仓分别用队列核对 / afterLoadGraph 防抖 / 恢复前核对解决。
- [Infinite-Canvas] `pathLength=100` 归一化进度环（真实采样步数、max>1 过滤**防假 100%**）+ culled 视口裁剪（zoom<8% 豁免选中/运行）。

## 中小仓精选（DirectorsConsole / tigerowo / 258-Canvas）

- [tigerowo] **SSRF 根治写法**（IC-main 漏洞的对照源）：自定义 DialContext——自己解析域名 → 逐 IP 校验（**含 100.64.0.0/10 云 metadata 段**）→ 只拨已校验 IP，封死 DNS rebinding TOCTOU（service/ssrf.go）；入口另限 data URL/公网 HTTPS。
- [tigerowo] 字段映射值源优先级：fieldValues > source > prompt > 素材索引 > 默认/随机 + SourceFromUpstream 自动推断 + fail-loud 素材校验；轮询器单 goroutine 统管四类任务、唤醒合并（满通道丢弃）、inFlight 去重。
- [DirectorsConsole] **PNG tEXt chunk 回填 workflow**（带路径穿越防护）；workflow→参数 schema 解析器（class_type→widget 顺序表 + 跨 OS 路径归一化）；submission_unknown 不盲目重试的持久提交日志。
- [258-Canvas] CanvasStore 脏标记 + O(1) 索引分层；**链级 AbortController 注册表**（取消只中止所在链）；打开画布聚焦内容包围盒（1.25 上限）。

## 桌面化工程（LibTV Desktop，闭源商业 Electron，只学手法不抄码）

- [libtv-app] **本地 origin 网关**：`host-resolver-rules` 把 `app.libtv.localhost:80` MAP 到 `127.0.0.1:<随机端口>`——**上游服务可换、浏览器 origin 恒定、零端口冲突**，桌面应用加载 Web 端的范式解。
- [libtv-app] 窗口编排：9 类窗口（startup-shell/product-tabs/settings/first-run/update/developer/agent-browser+overlay）每窗独立 preload + 严格 CSP；**弹层（tooltip/菜单）都是独立 WebContentsView，同一 SPA 用 `?surface=` 复用**——比 DOM 弹层高一层但同栈渲染。
- [libtv-app] **无头画布**：offscreen BrowserWindow + 7.7MB 专用 canvas bundle 在主进程做导出/截图，帧率显式可控——导出不必开可见窗口。
- [libtv-app] 进程内 Next.js BFF（worker_threads + node:sqlite），与 Web 端 monorepo（apps/liblibtv）**单源**——桌面端不是重写是宿主。
- [libtv-app] 画布引擎 @xyflow/react v12 + three.js；更新走本地随机端口 YAML feed。

## canda 本地 Agent 内核（Go 单二进制 72MB，闭源，LibTV Desktop 内置）

「桌面 AI 应用的 Agent 运行时该怎么造」的最完整闭源样本（对 mayi LibTV 桥/Agent 集成直接相关）：

- [canda] **ACP 控制面**：JSON-RPC over stdio/unix socket/named pipe；env 注入 `CANDA_ACP_{PATH,NETWORK,ENDPOINT,AUTH_TOKEN,PROTOCOL_VERSION,CONNECTION_ID}` + `CANDA_PARENT_PID` **看门狗**（父进程死内核自灭）；`control.initialize` 必须先于会话 RPC；两阶段关停 draining → close.ack。
- [canda] **idgen 时间栅栏**：固定纪元（2024-01-01）+ 持久 boot_id 下界（minimum_boot_id）+ legacy_fence_unix_millis 新旧格式栅栏，错误串含 rpc_id_conflict/sequence_exhausted——分布式 ID 生成器的桌面防重放设计。
- [canda] **boot_store 内嵌 SQLite**（WAL/foreign_keys）：插件安装账本（admission fences/receipts/watermarks）+ 远程任务 outbox `remote_pending`（reconcile 重试投影）。
- [canda] **redis "desktop-local" = 内嵌 miniredis 替身**：承载 memory recall 分块/去重/billing pending——桌面应用需要 Redis 语义时的标准替代（不真装 Redis）。
- [canda] **vfs 三卷哈希链**：agent-context/agent-skills/coding-agent；会话日志 `AppendWithExpectedLeaf` CAS 写入（expected_leaf/current_leaf 乐观锁），路径 `project/%s/threads/%s`。
- [canda] **model_registry 三级解析 fail-fast**：prompt-svc profile → models: 精确匹配（剥 provider 前缀、大小写不敏感）→ families: 保守兜底 → 全空即报错；双字段 model_family + context_window_size 分离；注释含「模型窗口 256k→1M 实测后更新注册表」的教训——**模型窗口大小必须有注册表，不能猜**。
- [canda] **context_projection（上下文压缩）**：Condenser（MaybeCondense/appendBoundary）+ basic/rolling 双策略；键 active_segment_trigger_ratio / engineering_segment_max_tokens / output_reserve_tokens / keep_first_n_turns / condenser_model；**boundary 幂等**（msg_id+summary_version+checksum）+ failure-marker anti-thrash 冷却——长会话 Agent 的上下文压缩完整配置面。
- [canda] **marketplaces 结构**：`{builtin,hidden,public}/plugins/<name>/<version>/` + marketplace.json（policy INSTALLED_BY_DEFAULT|AVAILABLE + ON_FIRST_USE）+ `.canda-plugin/plugin.json` + `.mcp.json`（stdio MCP 超时字段）+ `sources.lock.json` 逐文件 sha256；**MCP 型与 SKILL.md 型两形态插件**。
- [canda] 同源安全三件：mcpServers/audit origin 必须匹配 `llm.base_url`、token_gateway 强制 https、密钥 ACP env 注入**不落盘**。
- [canda] 内核 bundle 自校验：manifest.json 带全文件 sha256，启动核对防篡改。

## 桌面化工程对照补（MiniMax Design，闭源，与 LibTV Desktop 双样本对照）

- [minimax-app] 双 SPA 架构：Hub 工作台（根 index.html）与 Canvas V3 独立窗口（**专属 preload + MessagePort 直连**）；Rolldown+Vite、@base-ui/react + TanStack Router/Query + React Flow 画布 + three.js 预演。
- [minimax-app] **本地服务编排的失败态细分是运维面精华**：GatewayManager 预分配端口 + 退避 [0,1500,4000]；opencode 二进制失败态 20+ 种细分（binary_corrupted/db_schema_migrated…）；托管 Python 下载带哨兵锁文件；ComfyUI host 会话 preflight → 自动下载缺模型 → materializing 上画布。
- [minimax-app] 更新走 velopack + 策略下发 + 强制更新分级（对照 LibTV 自研 YAML feed）。

## Agent 集成两条路线（LibTV 自研 canda 内核 vs MiniMax 复用开源 opencode）

- [minimax-agent] **复用开源基座 + 外置定制**：opencode.exe 近乎原版（二进制 grep 无品牌串），定制全外置——声明式 base.json + 启动期系统提示词拼接 + 3 个插件 hook + 业务全在 gateway（@hilo/gateway-bundle :8001）。判据：**产品差异化在业务后端时，此路线维护成本最低**；对照 [canda] 自研内核（控制面/压缩/注册表全在自己手里，适合 Agent 即产品核心的场合）。
- [minimax-agent] 四层架构：Electron → opencode.exe（HTTP :4096）→ gateway :8001 → cloud_gateway（**本地不持厂商密钥**）；MCP 工具进程由 opencode spawn，只做 gateway REST 的「工具化外壳」。
- [minimax-agent] **agent-profiles v2→v3 演进**：v2 五 agent 认知拓扑（router/planner/executor 分工）+ contracts/knowledge/workflows 三层文档 → v3 收敛为 media-agent + code-agent，**从控制流程转向控制对象**（Composition/Resource/Version 对象模型）；「部门制」多 agent（writers-room 等）留配置但 disable——多 Agent 编排的迭代方向样本。
- [minimax-agent] **comfyui 托管插件**（用户 ComfyUI 集成直接对照）：官方前端整包 + fork 后端**版本化下发**（sha256/双 CDN/不查 latest）；专用端口 18188 + MANAGED_LAUNCH_FLAGS 禁用户覆盖；本机 models 只读挂载而 custom_nodes 不挂（任意代码风险隔离）；hub.python.run 10 分钟硬顶 → detached worker + 状态文件轮询。
- [minimax-agent] **3d-director-stage 插件协议**：manifest `agent.methods[]`（timeoutMs + 完整 doc 即工具文档）+ `instructions` 会话 SP；调用链 opencode → hub_plugin_agent_invoke → gateway WS → iframe SDK → 回传；scene.edit 1..50 单事务；model.compare 确定性 gate 仅 advisory。
- [minimax-agent] hilo 插件权限体系：permission last-match-wins 的 deny 规则替换、LoopGuard 指纹滑窗、ToolConfirm 卡、SKILL.md allowed-tools 动态授权、压缩续写语言改写、编码沙箱 workDir 绑定。
- [minimax-agent] 计费语义：session-header 计费 Group fail-closed `REQUEST_GROUP_REQUIRED`——计费键缺失宁可拒绝。

## 平台化桌面（TapNow，闭源商业 Electron，薄壳路线）

- [tapnow] **Web/App 双轨更新**：Electron 壳仅 1.15MB（薄壳 main.cjs），产品 UI 走自研 web-bundle 热更——sha256 + 文件级 manifest + 200MB 上限 + preview→apply 确认框 + **四档安装时机**（manual/idle/immediate/next-launch）+ 完整性 meta 门禁防社区包覆盖（对照 LibTV YAML feed / MiniMax velopack，三家三路线）。
- [tapnow] **IPC 全景 150+ 通道统一 `tap-desktop:域:动作`** 命名；local-files 是 **grant 授权模型**（目录粒度/可吊销）；system 域含 Agent shell 命令「提案→审批→可自动放行→可吊销」四段门禁。
- [tapnow] **external-apps 平台宿主**：内嵌 partner 应用（Cinemap/Studio）——origin 白名单远程下发 + `tn_uid/tn_org/theme` 传参 + BFF session 兑换 + 权限清单默认拒绝制 + Chrome WebGL alpha 修复垫片。
- [tapnow] 遥测纪律：OTEL 全家桶（instrumentation-undici 自动 span 化出站请求）+ Sentry + `--tapnow-startup-bench` 启动基准 flag + **遥测路径脱敏**（install-dir/temp/user-profile 正则替换）。
- 三款闭源桌面战略对照：LibTV 押壳工程与启动容错、MiniMax 押生成可靠性语义（durable task/参数合同）、TapNow 押**平台化**（薄壳+双轨更新+具身 Agent+生态闭环）；Agent 后端三家分别选 本机 ACP 内核 / 本地二进制+gateway / 云端+门禁。

## 全局反面模式索引（引以为鉴）

- [basketikun] 3000 行 god-component + 30+ 回调 props 的 memo 体系难维护；minimap 全量小方块（数千节点会卡）；无捏合缩放、无 beforeunload flush。
- [toonflow] Vue Flow 补丁修其 O(n²) 父节点查找——用现成图库要审它的热路径。
- [shuo] "1200 媒体节点无压力"但手段未知——产品话术与实现之间隔一个解包验证。
- 跨仓母题：AI 重度开发的文档漂移（[movie] CLAUDE.md 宣称 Playwright 实为 vitest，distill-moive.md §三.6）；README 营销与实现脱节（[dim0] 自称 "operational transforms" 实为 LWW rebase，distill-dim0.md §三）——引用任何仓库前先核对声明与实现。
