---
name: infinite-canvas-expert
description: 无限画布/白板/节点图应用的领域专家：性能卡顿诊断与优化、触屏与移动端适配、浮层菜单、主题系统、数据持久化与协作。凡用户提到画布、canvas、白板、节点编辑器、node graph、节点多了卡顿、拖拽缩放掉帧、画布优化、白板项目、AI 生图画布、思维导图、流程图类应用，或要求优化/审查这类项目，先读本 skill 再动手。涉及用户自己的三个具体项目（Infinite-Canvas-main / mayi / wanvas）时，同时读 infinite-canvas-projects skill 拿项目事实。
---

# 无限画布领域知识

打过的仗：一个 FastAPI + 原生 JS 节点式 AI 生图画布，从空节点误判到真实基准 render() 632→25.9ms（N=400）、悬停命中 15.48→0.29ms。本 skill 是那场仗沉淀的通用打法 + 无限画布领域通识。所有实测数字来自该项目，方法可迁移，数字不可照搬。

## 心智模型

无限画布 = 世界坐标(w)↔屏幕坐标(s)变换 + 大量可交互节点 + 连线 + 常驻 UI 层。90% 的卡顿源于同一件事：**把全量 O(N²) 工作放进了每帧路径**（mousemove、render、wheel、小地图）。优化 = 找出这些路径，逐个降频、索引、增量化。

渲染路线五派（选型按内容特征与规模，实测依据见 distilled-external.md）：DOM/SVG（React 生态、中小规模）、Canvas2D 即时模式（litegraph，节点图全量重绘+LOD）、Canvas2D 元素/对象缓存（excalidraw/fabric，手绘风与对象模型）、SVG 引擎（X6，B 端流程图）、GPU（>1 万元素/特效/compute）。命中测试统一规律：**粗筛（空间索引或线性 AABB）+ 精测**，GPU 渲染也不改变这条规律。

## 卡顿诊断路径（先测后改，顺序执行）

1. **先立真实基准**。空节点基准不成立——必须用带 2-4MB 噪点 PNG 的混合节点、真实节点分布。用户会抓这个。
2. **量四个经典热点**（DevTools Performance + performance.now() 打点）：
   - mousemove 连线/端口命中测试（典型病：O(C·N) 全量遍历 + 强制布局）
   - render()/draw()（典型病：全量重建 DOM/SVG + 全文档图标重扫）
   - 小地图（典型病：每帧 O(N²) querySelector）
   - wheel/拖拽（典型病：无 rAF 合并，每事件同步重排）
3. **JS 修不动再看合成层**：DevTools Layers 面板看平移帧率；`contain`/`content-visibility`/`will-change` 一处都没有的项目，合成层就是剩余瓶颈（"药方开了没抓药"）。
4. **一次只改一件**，改完复测同一基准。多件一起上，回归了分不出凶手。

## 痛点 → 解法索引（细节在 references/）

| 症状 | 病根 | 解法 |
|---|---|---|
| 节点一多 render 卡死 | 全量重建 DOM | 节点 id→DOM 索引 Map + 增量渲染（render signature，内容未变复用 DOM）→ performance.md |
| 悬停/连线命中卡 | O(C·N) 遍历 + 强制布局 | 节点/端口坐标缓存（按帧失效）+ 空间索引 → performance.md |
| 小地图卡 | 每帧 querySelector 全 DOM | 改从数据模型取几何，别碰 DOM → performance.md |
| 滚轮/拖拽掉帧 | 事件直触重排 | rAF 合并批处理 → performance.md |
| 图多了内存爆/加载卡 | 全量加载原图 | 懒加载 + LOD + 离屏释放 → performance.md |
| 手机上长按无菜单/布局乱 | touch≠mouse、100vh | 长按 500ms→contextmenu、100dvh、zoom:1 → interaction.md |
| 触屏按钮看不见/菜单被裁切 | hover:none、定位先于测量 | 媒体查询兜底、先定位后限高 → interaction.md |
| 主题改不动 | 硬编码 !important | 程序化生成覆盖层（亮度阶梯法）→ data.md |
| 存档损坏/丢数据 | 非原子写、静默覆盖 | tmp+rename 原子写 + .corrupt-<ts> 隔离 → data.md |
| 表单输入丢焦点 | 字段变更重建整个表单 | "不重建"白名单 → interaction.md |
| 命中测试量级更大/语义复杂 | 线性 filter 不够 | R-tree 空间索引 + 两段式裁决 → distilled-external.md |
| 多人协作/跨端同步 | 无冲突处理 | 可逆 diff 栈 + push/pull/rebase（不必上 CRDT）→ distilled-external.md |
| AI 生图重复扣费/任务丢失 | 失败判定过于激进 | interrupted 状态机 + taskId 续查 + checkpoint → network-api.md |
| Canvas2D 全量重绘卡 | 无分层/无降级/无缓存 | 双 canvas 分层 + 缩放 LOD 阈值 + 元素级离屏缓存 → distilled-external.md（litegraph/excalidraw 节） |
| 小缩放下画面糊/细节浪费 | 全分辨率画一切 | 缩放降级阈值（0.5/0.6 关阴影/文字/细线）→ distilled-external.md |
| 多人协作选型 | 不知上 CRDT 还是 LWW | 三方路线对比（Yjs / rebase / 逐元素 LWW）→ distilled-external.md 协作节 |
| 老 Canvas 引擎生产化（DPR/命中/熔断） | litegraph 类遗留问题 | ComfyUI fork 补丁清单 → distilled-external.md 生产化节 |
| 树形/思维导图布局与拖拽换父 | 布局算法与预览线 | 三遍遍历管线 + fakeClone 预览 → distilled-external.md 树形节 |

## 何时不优化

按实测瓶颈决定，别按直觉。已验证的"不做"：连线 ≤30 条不做连线裁剪；节点几百个不做虚拟化（先做索引+增量渲染就够）；不做打包工具/完整 a11y，除非用户要。优化前先问：这个画布的真实规模（节点数、图大小、并发）是多少？

## 详档路由

- 性能（渲染/命中/内存/基准方法）→ [references/performance.md](references/performance.md)
- 交互（触屏/浮层/菜单/快捷键/表单/手势阈值词汇表）→ [references/interaction.md](references/interaction.md)
- 数据（持久化/主题/缓存/协作/回滚纪律）→ [references/data.md](references/data.md)
- 外部项目蒸馏（41 个开源仓库 + LibTV Desktop / MiniMax Design / TapNow 三款闭源解包：渲染五派/命中六路线/协作四路线/撤销三派/空间索引四档的横向判据，Agent×画布六样本 + Agent 集成两条路线对照（自研 canda vs 复用 opencode vs 云端门禁）、桌面化工程三样本、ComfyUI 生态三档集成、视频时间轴与 WebCodecs、生产化与性能基建；顶部有目录，带来源与验证分级）→ [references/distilled-external.md](references/distilled-external.md)
- UI 设计/易用性/小巧思/视觉系统（AI 画布产品层：空状态引导、添加路径、生成呈现、防呆、快捷键、色板治理、动效规范、文案语气）→ [references/ui-ux.md](references/ui-ux.md)
- 网络与三方集成（provider 适配层、生成结果回传与资源落盘、WS/SSE/轮询选型判据、超时重试幂等与任务状态机防丢钱、协议版本与 schema 迁移、CORS/代理/弱网、成本防双扣）→ [references/network-api.md](references/network-api.md)
- 代码片段库（41 个仓库中精选的 50 段可参考写法：渲染缓存/命中拾取/坐标变换/交互手感/状态历史/任务网络，每段 ≤15 行带 file:line 与思路）→ [references/snippets.md](references/snippets.md)
- 性能基准脚本（浏览器控制台粘贴，量四大热点：先立真实基准、改一件复测一件）→ [scripts/perf-bench.js](scripts/perf-bench.js)，配 performance.md 基准方法论用
- 部署指纹脚本（部署前后数据指纹比对，回归归因与回滚核对）→ [scripts/deploy-fingerprint.py](scripts/deploy-fingerprint.py)，配 data.md 回滚纪律用
