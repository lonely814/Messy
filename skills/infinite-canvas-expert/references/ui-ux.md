# UI 设计 / 易用性 / 小巧思手册

与 performance/interaction/data 并列的第四维：画布类应用的**产品层**经验。来源标签同 network-api.md 头注；`[ic]` = 用户 Infinite-Canvas-main 实战。按 UX 维度分类组织，跨来源互证。持续补充中。

## 判据总述

画布 UX 评价维度：首次体验能不能 30 秒内画出一个东西；高频操作是否单手可达；出错能不能原地恢复（不刷新）；状态变化不点开能不能知道。性能是手感的地基（performance.md），本文件只收产品层。跨源通用规律（多仓互证）：

1. **状态用边框语言不用弹窗**（n8n/refly/beeftv/dify 四家一致：四色状态边框、连线即状态机）。
2. **生成细节进面板、画布保形**（refly/coze 一致：卡片只留标题+状态，流式正文去侧板）。
3. **防呆前置到动作入口**（refly/coze/beeftv：空 prompt 禁跑、未安装拦截、费用 TTL 重确认）。
4. **「拖线到空白落点建节点」已是行业标准**（refly/coze/dify 三家同款）。
5. **端口 tooltip 同时教两个手势**（「点击=加节点/拖拽=连线」，coze/dify 同款）。

## AI-Canvas-tauri（Tenney95，Source-Available：禁商业再分发/套壳，10k stars 承诺转 MIT；Tauri 2 + React Flow 12，AI 短剧画布，与 IC-main/mayi 同域）

### 首次体验

- [aicanvas] **在线演示画布的种子方案**：不复制 schema——先让应用真跑一次自建 IndexedDB store，等 `last-active-project` 落定后向 projects/metadata 种一条演示工程，再重建 iframe 加载即落演示画布（site/demo/demo.js）——**schema 升级免疫、失败退化空画布**，比硬编码 demo JSON 聪明。

### 节点卡片

- [aicanvas] 生成中显示**阶段文案 + 「已等待 mm:ss」双计时**；完成瞬间 700ms just-completed 外发光（与 [beeftv] 进度诚实性互证：时间可见即诚实）。
- [aicanvas] 失败按 **9 类成因给精确恢复文案**（MediaTaskStatus），并提供「继续查询（只读原任务，不重提交）」——失败分类到能给出对应动作的程度。

### 剧集/多画布结构（新维度样本）

- [aicanvas] 右缘 **2px 竖线悬浮展开 SeriesRail**（收起态几乎零占地）；分集 = 带 parentId 的项目记录各占一画布；角色库/素材/记忆按 seriesOwnerId **整剧共享**。
- [aicanvas] AI 提取角色走「**预览去重 → 勾选确认 → 入库**」三步防呆——AI 批量入库的通用交互模板。

### Agent 写板（与 dim0/movie/tl-studio 四路线对照，第五样本）

- [aicanvas] Agent 写画布走 **effect 九类权限矩阵**，Plan/B/C 三档色+文字+tooltip 区分风险；**审批卡内联聊天流**（不是弹窗打断）；写画布必过 projectId+revision+undo 三件套与 canvasDerivationGuard。
- [aicanvas] 只读子智能体 = 配置数据（单父最多 6 个）；项目记忆四类徽章需确认写入。

### ComfyUI 工作流集成 UX

- [aicanvas] 导入工作流**自动抽 IO 节点 + 连线推断**正/负面提示词徽章；本地/云共用参数浮层、**字段带原 ComfyUI 节点编号**（出错能对回源）；batch_size>1 提示「画布只收首份产物」。

### 插件系统

- [aicanvas] 三源安装（本地/市场/GitHub Release），权限即 manifest 字段；JS = QuickJS 受限沙箱、Python = 可信 + 原生确认；**安装前可 PluginPreview 试运行**——与 [aicanvas] 角色提取同款「先试后确认」。

## 首次体验（此前样本）

- [coze] 新建工作流即预置 Start(id=100001)/End(id=900001) 双节点，**节点描述文案即引导**；添加弹窗四入口导航 + 空态例句引导。
- [dify] 创建三入口（空白/模板/DSL 导入）；模板库 = 分类侧栏 + 类型筛选 + 500ms debounce 搜索，**卡片可先试运行再建**（create-app-dialog）；step-by-step-tour 新手导览**无权限时显示禁用原因而非隐藏**（step-by-step-tour/tasks.ts:32）。
- [n8n] 空画布预置「Add first step」虚线占位节点；hover 禁用的执行按钮时弹 tooltip 指路（跨组件事件总线，CanvasNodeAddNodes.vue:30-113）。
- [refly] 空画布引导只有一句「双击画布打开菜单」+ 可隐藏模板卡（empty-guide/index.tsx:18）——引导一句话就够。
- [n8n] **sticky note 体系**：markdown + 7 色 + 自定义 hex 自动算对比色——文档直接长在画布上。
- [beeftv] 新手引导是**状态观察器**：自动检测真实操作推进步骤，只观察挂载不观察 style（防逐帧重绘）。

## 添加内容路径

- [refly] **拖线到空白 → ghost 菜单节点 + 临时虚线边**，一步建节点+建边；Escape/点外自动清理（use-drag-create-node.ts:149-176）。
- [n8n] 拖线落空 = 在落点开节点面板并**预过滤兼容节点**；点线中段 = 插入节点。
- [coze] 点输出口在光标处弹面板并自动建线 + 防重叠落位；连线中点「+」可插入节点。
- [refly] 把手 hover 出「+」，tooltip 同时教两个手势：「点击添加/拖拽连线」（custom-handle.tsx:88-113）。
- [refly] 新 Agent 自动连「最新/选中的」skillResponse 形成对话链（use-add-agent-global.ts:19-63）。
- [n8n] hover 线出 +/删 工具条，300ms 延迟消失防误触；反向连线两段折线绕行。
- [dify] BlockSelector 5 tab（Blocks/Tools/Start/Sources/Snippets）**各自保留过滤态**（block-selector/tabs.tsx:49）；Blocks 按五分组；每节点 i18n 描述 + 官方文档链接（node-catalog.ts:105-115）；hover 150ms PreviewCard。
- [affine] @ 菜单四组（doc/成员/journal/newDoc）；自动聚焦优先级 成员>doc>create；空查询列自己不通知；journal 日期别名识别；MAX_DOCS=3 + 溢出计数（>100→100+）。

## 节点卡片

- [n8n] **极简卡片**（图标 + 两行 label，名字放卡片下方 2 倍宽区域）；**状态全走边框语言**（绿成功/红错误/紫 pinned/黄 dirty）；执行动画纯 CSS conic-gradient 旋转边框（running 1.5s/waiting 4.5s，_canvasNodeStyles.scss:57-101）。
- [n8n] 禁用节点画**贯穿删除线**而非变灰；右下角角标优先级链：锁定 > 未安装 > 禁用 > 错误聚合 xN > deprecated > 校验 > pin。
- [dify] 普通节点定宽 240px，Iteration/Loop 可 resize；**四色状态边框**（run 蓝/成功绿/失败红/异常橙，_base/node.helpers.tsx:4-21）；端口小竖条随状态变色；插件缺失磨砂锁层；标题旁协作 presence 头像。
- [coze] 色板注册表下发与卡片染色 → 详见下文视觉系统·色板治理；双击标题就地改名；V2 不做折叠、复杂配置走侧边抽屉。
- [refly] 生成中：外圈发光环 + CSS 流光；**卡片只显示 prompt + 标签，流式正文去右侧面板**——画布保形。
- [n8n] 执行按钮图标可读性（luma 重映射/zoom 补偿/gamma 2.2）→ 详见下文视觉系统·文本可读性。
- [beeftv] hover 视频预览**全局单例租约**：350ms 延迟/3s 默认/8s 硬超时/首帧解码才淡入/媒体在播即礼让。

## 连线

- [refly] **连线视觉即状态机**：虚线→实线→流光→失败退回虚线（custom-edge.tsx:213-237）；连线默认透明降噪；线上 20px 透明命中区 + 中点删除按钮。
- [n8n] 线上数据量标签「N items」（含 pinned 计数、AI tool 按 target 分组）；**线颜色即状态**（running > pinned > error > success，useCanvasMapping.ts:288-344）。
- [coze] 异常连线弹**语言化错误示意 SVG**；if/else = 多源 port。
- [dify] 24px 分支间距防缩放误触（坐标空间注释）；Shift 按住压暗未选节点聚焦当前链路。
- [beeftv] 连线彗星流光与虚线**刻意错拍**；blur 只给单条；端口恒取边中心防「伪端口」。
- [litegraph] 拖线时类型不符的 slot 降 alpha 0.4——约束即反馈。

## 运行/执行体验

- [coze] 试运行：绿色 Play + **全画布校验 → 问题面板点击滚动定位节点**；逐节点四态点亮，结果回填卡内，**出错节点默认展开**；AI 补全测试数据；单节点调试是后端一等 API。
- [dify] Alt+R 呼出触发器菜单（**数字键直选、单选项免弹层**，test-run-menu.tsx）；变量检查器按节点/env/系统分组、支持还原上次运行/大数据部分预览 + 导出；触发器「监听中」调试态带下一步指引；run 详情含 K/M tokens·耗时与 iteration/loop/retry 下钻。
- [dify] 发布前 **checklist**：角标 + 点击定位节点 +「所有问题均已解决」空态。
- [n8n] 执行按钮 split-button 可选「从某 trigger 执行」；单节点重跑 destinationNode inclusive。
- [refly] 运行 500ms 后摄像头**自动 fitView 到执行中节点**（use-node-execution-focus.ts）；流式自动滚动仅距底 <50px 跟随、上滑即停；停止二次确认。
- [beeftv] **进度诚实性**：禁假百分比、60s 停滞换循环条、「视频通常要几分钟，可以先做别的」；「提交结果待确认」一等状态 + 反双扣费前后端同文案协议。
- [beeftv] 批量创作表节点：**表格即编排**（并发 1/5/10）；费用预估 TTL → 详见 network-api.md 八。

## 变量/参数系统

- [coze] `{{` 触发引用、树形引用选择器、类型不匹配/悬空引用**即时报错**、引用影响面计数面板。

## 发布 / 分享 / 版本

- [dify] publisher popover 汇总「最新发布 + 作者」+ 打开 WebApp/接入点/部署/Marketplace/发布为工具；**版本历史 = 时间线 + 命名版本 + 部署环境徽章 + 还原/删除确认（先自动备份草稿）**。
- [affine] 分享四 tab（Share/Export/Invite/Members）；入口按钮 Lock/Publish 随态切换；免费墙 PlanTag + paywall 双文案（member 隐取消键）；公开链接按当前 mode 生成（Edgeless/Page）；访客页 3s 超时降级。
- [makereal] **分享即链接**：HTML 按 shapeId 存 Postgres，`makereal.tldraw.link/{id}` 独立域名渲染——分享不要求对方有画布。

## 协作场景 UX（excalidraw 协作层深挖 + affine/dify/n8n）

### 发起与加入

- [excalidraw-collab] 发起三入口（顶栏/菜单/欢迎屏）+ 命令面板；ShareDialog 双形态（选人 Picker → 活跃房 ActiveRoomDialog）。
- [excalidraw-collab] **e2e 加密解释前置到开会话前**："Not even our server can see what you draw"；页脚盾牌常驻信任锚点——隐私是卖点就当文案主角。
- [excalidraw-collab] 链接 = `#room=<id>,<22字符key>`（**key 在 fragment 不进服务器**）；弹窗内嵌二维码、平台感知分享图标、复制成功态 2s + 自动全选。

### 协作中状态

- [excalidraw-collab] **37 档 hue 用户色**统一头像/光标/选区（一人一色贯穿所有元素）；远程光标出界**钳制在视口边缘 + 30% 透明不消失**（知道有人在隔壁）；远程选区虚线框；idle/away 变淡。
- [excalidraw-collab] 在线列表：当前用户 pill 恒定不换行（21px 预留算法）；≥8 人出搜索；"Click on user to follow" 教学提示。
- [dify] 节点标题旁 presence 头像；同步草稿时**全屏透明遮罩锁画布**。
- [n8n] 协作写锁 pill。
- [affine] 光标渲染在 blocksuite 层，应用层只接线 awareness（本地 BroadcastChannel/云端专用存储）。

### Follow mode（跟随观看）

- [excalidraw-collab] 点头像触发跟随：画布主色边框 + "Following {username}" 徽章（X 退出）；**任意平移缩放自动退出，唯 laser 笔例外**（注释明示 laser 是演示辅助，不该打断跟随）；互跟防环、对方离开自动退跟。

### 冲突与数据

- [excalidraw-collab] **reconcile 全静默无对话框**——能自动合并的绝不打扰用户（与 n8n/refly 的显式冲突弹窗是两条哲学：内容型协作静默合并，结构型编辑显式裁决）。
- [excalidraw-collab] 保存失败三层升级：一次性 dialog → 去重 → **常驻角标 + shake**。
- [excalidraw-collab] 停止协作会话 confirm 文案直接教退路：「想保留本地副本就关标签页」。
- [excalidraw-collab] 协作中暂停本地自动保存（Firebase 20s 节流）；**上传前剔除已删除元素防敏感数据入库**；beforeUnload 抢救性保存。
- [affine] mention 无权限时错误 toast 内嵌一键「Invite」授 Reader 并重发通知（at-menu-config:471-530）——错误即修复入口。
- [affine] journal 同日多文档冲突块。

### 协作调试巧思

- [excalidraw-collab] `?collaborators=<N>` URL 参数造假人调试协作 UI；双指手势停发光标（广播侧 → network-api.md 三）。

## cmd+K / 命令面板

- [affine] **多 session 实体管线**（modules/quicksearch/entities/quick-search.ts:59）；CMDK 组合 7 源（recent/collections/commands/creation/docs/links/tags，services/cmdk.ts:28）；命令注册即绑键（tinykeys）+ PreconditionStrategy 控制可见性、**快捷键仍生效**。
- [affine] 面板细节：Fuse threshold 0 + 高亮注入；组间按 score 双层排序；列表刷新保持选中项；打开 150ms 后才 focus；「Search locally」score 1000 置顶 + beforeSubmit 拦截切换搜索域；远端空结果/异常双路回退本地；500ms throttle；battery-save 关远端。

## 移动端画布

- [affine] `src/mobile/` **独立壳**（239 文件）+ `BUILD_CONFIG.isMobileEdition`（35 处）——不是响应式而是独立应用层；底 tab Home/All/Journal/Create；back-coordinator 统一 4 种返回意图 + 列表恢复快照（anchor/expanded/listState）；haptics 服务（含 selectionChanged 连续触觉）；虚拟键盘桥 batch signals 进 blocksuite；edgeless 横屏沉浸模式（tap slop 8px、工具栏排除选择器、标题 scrollY≥158 才显示）；100dvh；**移动搜索复用桌面 session 实体只换视图**。

## AI×画布交互范式（make-real：画布即 AI 交互界面）

- [makereal] 范式闭环：框住草图 → `editor.toImage` 截图（最长边 1000px）→ 单次多模态请求 → 结果作为 preview shape 落画布选区右侧 +60px（useMakeReal.ts:122-174）——**无聊天框，画布即交互界面**。
- [makereal] **不序列化 shape JSON，纯截图为主**；多轮迭代 = 框住旧 preview + 新草图，旧 HTML 作 sourceCode 注入——「代码是 source of truth、画布是 diff」（prompt.ts:65-84）。
- [makereal] 流式门控：文本流出现 `<!DOCTYPE html>` 才展示、`</html>` 即停吞 thinking；delta 增量写进 shape props，iframe `contentDocument.write` 断点续写（useMakeReal.ts:262-277）。
- [makereal] **生成前先落占位 shape**（进度存在画布文档里，刷新可恢复）；失败五类错误 toast 并删 shape 零残留（useMakeReal.ts:167-174,514）。
- [makereal] **红笔 = 批注协议**贯穿 prompt 与文本抽取两层（prompt.ts:49）。
- [makereal] 「All」竞赛模式：三家 provider 并行出三个 preview 带标签，对比内建在画布（useMakeReal.ts:176-188）。
- [makereal] 结果一等公民：双击进交互模式；右上角 Copy link/HTML、开新 tab、导出 CodeSandbox/StackBlitz/Replit（PreviewShape.tsx:178-204）。
- [makereal] Prompt 是一等公民：**版本号化**（NOVEMBER_19_2025）+ settings 迁移推送；`temperature:0, seed:42` 固定复现；BYOK 服务端零存储。

## 防呆

- [n8n] beforeunload dirty 检查；webhook 409 冲突模态；协作写锁 pill；AI builder 流式时画布只读 + 可中断。
- [refly] 下游 prompt 为空禁跑整链；MCP 工具未装运行前拦截并高亮安装按钮；只读画布拖动 3s 防抖 toast；运行按钮 500ms 防抖。
- [beeftv] 滚轮行为用户可固定；分镜行 → 节点提示词同步带 allowedOldDrafts **防覆盖手改**。
- [dify] Mod+Shift+L 下载导入日志（导入失败有据可查）。

## 快捷键 / 画布级

- [n8n] 快捷键体系最全（Canvas.vue:542-649）：d 禁用 / p 钉数据 / F2 或空格短按重命名（**长按 = 平移**）/ 方向键沿拓扑兄弟导航 / shift+方向选上下游 / shift+alt+t 自动布局；ctrl+enter 执行、ctrl+s 覆盖浏览器行为。
- [dify] 声明式快捷键全集（shortcuts/definitions.ts）；**Cmd+K 搜节点跳转**；对齐辅助线；导出 PNG/JPEG/SVG；ELK 自动整理（先容器内后根图 + 动画）。
- [coze] **自动整理写撤销历史**（可 Ctrl+Z 还原布局）；快捷键帮助弹窗随鼠标/触控板模式切换内容；头栏「已自动保存 {time}」tag 组。
- [n8n] minimap **惰性显示**（仅平移时淡入）。
- [quickdraw] FPS 胶囊三态循环 + 隐藏态留回来入口（P 键 + 档位持久化）。
- [ic] `?` 帮助浮层/快捷键查冲突/浮层防裁切 → 详见 interaction.md 快捷键、浮层菜单防裁切。

## 视觉系统

### 色板治理

- [coze] **色板从注册表下发**：每类节点一主色（大模型 #5C62FF/插件 #CA61FF…），卡片头部按 mainColor 8% 渐变染色——颜色即类型身份，色板是数据不是 CSS 散写；新增节点类型自动获得色彩。
- [n8n] oklch 色彩空间 + 原生 `light-dark()` 函数做主题——现代 CSS 主题路线（对照 [ic] theme.css 316 个 !important 的反面）。
- [excalidraw-collab] 协作用户色 **37 档 hue 均匀分布**，头像/光标/选区一人一色贯穿。
- [ic] 对比度实测纪律：文字色改动前后算对比度（1.47→4.76 达标）；刻意不改 `--faint`（同时用于连线描边，改字色会伤线色）——**一个变量多消费方时先查全部使用点**。

### 主题

- [quickdraw] 主题切换**位图快照交叉溶解**不闪白——主题的连续性即质感；网格墨量恒定 → 详见 distilled-external.md quickdraw 节。
- [ic] 纯黑主题程序化生成（亮度阶梯/中性化判据/直钉规则 → 详见 data.md 主题系统）——UX 侧一句话：黑暗主题不是「把白变黑」，是重建亮度阶梯。

### 动效规范

- 执行态动画**纯 CSS 优先**：conic-gradient 旋转边框（[n8n]，零 JS 循环）、发光环 + 流光 keyframes（[refly]）、连线彗星流光与虚线**刻意错拍**（[beeftv]，整齐即廉价）。
- 动效时长锚点：完成反馈 700ms 后熄灭（[aicanvas] just-completed 外发光）、降级过渡 180ms 渐进（[aicanvas] LOD）、悬停出工具条 300ms 延迟消失防误触（[n8n]）。
- **动效的性能代价清单**：backdrop-filter 节点禁用（每帧重模糊）、frame 透明度进位图重生成键 = 每帧全量重生成（[excalidraw] 反面）、CSS 变量缩放补偿替代 JS 同步（[aicanvas]）。

### 文本可读性

- [n8n] 图标做 **luma 测量重映射**保任意品牌 logo 在按钮上可读；zoom 补偿 + **gamma 2.2 亮度校正**保低缩放倍率文字可读。
- [leafer] <10px 图形跳过精细命中只测 bounds——渲染同理，小尺寸降细节。

## 小巧思 / 视觉细节（旧收录，与上节互补）

- [beeftv] LOD 140/172px **迟滞双阈值** + 缩略图 LRU 600；助手文案单一来源模块（文案即代码）；付费授权 grant → 详见 network-api.md 八。
- [affine] Alt 产本地字符跳过快捷键；`alert-ctrl-s` 吞 Ctrl+S；resize handle 兼作拖拽分屏 drop target；workbench 打开位置枚举 beside/active/head/tail/number/new-tab。

## License 警示

- [n8n] Sustainable Use License（fair-code），`.ee.` 需企业授权——借行为不抄码。
- [beeftv] Source Available（个人/内部免费，售卖/托管须书面授权；历史提交 MIT）。
- [refly] Apache 2.0 附加条件（组织商用需授权、禁删 LOGO）。
- [dify] 修改版 Apache 2.0（**禁多租户运营、web/ 禁删 LOGO、交互设计受外观专利保护**）。
- [coze] Apache-2.0 可自由商用吸收。
- [affine] core MIT（backend/native 专有）。
- [makereal] License 冲突（MIT 自称 AGPL）→ 详见 distilled-external.md make-real 节、snippets.md 许可速查。

## 文案语气体系（n8n en.json 11034 条实测抽样）

- [n8n] **克制专业风，不卖萌**：11034 条文案中幽默词命中仅 1 处（"Oops, couldn't find that"）——大产品文案的底色是专业与具体，幽默只在极轻处点缀。
- [n8n] **错误文案 = 具体化 + 恢复动作**（169 条错误恢复类）："Some items couldn't load. Retry to refresh the list."、"The result is closed, but Assistant is unavailable. Try again when Assistant is available."——每条错误都带下一步动词，绝不止说"出错了"。
- [n8n] **错误里带教育**：表达式错误文案直接解释原因并内嵌文档链接："An expression here won't work because it uses `.item` and n8n can't figure out the <a>…</a>"——报错即教程，最长文案都是这类。
- [n8n] 确认弹窗**直说不可逆后果**："This action cannot be undone."；删除类全部带范围说明（"It will also be removed from all your conversations"）。
- [n8n] 引导文案任务导向："Connect your favorite apps to get started"——说用户要做的事，不说功能名。
- [dify] 操作历史具体到动作对象："块已断开连接"——撤销历史能当操作日志读。

## LibTV Desktop（闭源商业 Electron 桌面端，仅手法学习；用户「用得最舒服」的日常工具——蒸馏目的：挖出它好用的原因）

### 失败工程（桌面应用失败 UX 天花板）

- [libtv-app] 启动状态机 starting→rolling-back→presenting + **恢复阶梯按钮**（重启 → 导出日志 → 清 Profile（声明不删外部素材）→ 退出）+ 诊断标识 + 对话框降级链——失败路径与成功路径同等设计。
- [libtv-app] 通知按生成/导出/下载**三类订阅**且验证显示回执；托盘任务数徽标 none/dot/1-9/9+ 双主题 26 张合成图——托盘是任务面板不是装饰。

### 队列 / 任务 UX

- [libtv-app] 排队消息可视化、**跳队确认**、批量确认 + footer 状态汇总、组运行 awaitGroupSaveOrRollback（组要么全存要么回滚）。
- [libtv-app] 标签页 = 项目会话：WebContentsView 每标签，自定义 MIME `application/x-libtv-tab` 支持标签拖拽；标签徽章轮询用双 rAF + 1s 超时做「UI 落帧回执」遥测。

### 画布交互

- [libtv-app] **画布模式矩阵**：14+ 个 `canvas-*-mode.css` 根类切换整套 affordance（进入某模式=换一套交互皮肤）——比逐元素显隐干净的模式切换实现。
- [libtv-app] **节点级 NodeHistory**（单节点预览 + 恢复确认）——全局 undo 之外的局部历史。
- [libtv-app] 可定制节点工具条（CustomizeToolbarModal + recentTools + 升级红点）；协作有 follow 模式/远端光标/编辑锁/离线重放冲突。
- [libtv-app] **Agent 接管权 pill**：「你在操作 / 用完后交还给…」——人机共用一套输入时权属可见；AskUser 口语选项（好了/算了/不用）——Agent 提问选项用口语不用术语。
- [libtv-app] MCP 单队列说明写进设置页——把「为什么一次只跑一个」的前置解释放进 UI。

## MiniMax Design（闭源商业 Electron，内部代号 hilo；用户认为优秀的 AI 设计画布）

### 生成可靠性语义（它作为「AI 画布好用」的核心）

- [minimax-app] **durable task**：生成任务与节点解耦——「删除或撤销节点不取消已提交任务」明示给用户；状态机 preparing/queued/running/retrying/paused/stopped；`generation.unknown` 时提示 **do not generate again** 禁重复扣费；成本确认门 confirmCost——任务可靠性做成用户可见的语义。
- [minimax-app] **合同驱动参数 UI**：preload 内嵌 MODEL_INPUT_CONTRACTS（每模型×mode×媒体的 count/duration/aspect/fps 全约束 schema + revision 哈希），参数表单与防呆文案全部由合同派生（如「首尾帧最多 2 图」）——**改模型不改 UI**。
- [minimax-app] **节点级文本版本三件套**：Agent 改前自动快照、恢复也快照、diff 过载降级——AI 改用户内容时的信任设计。

### 专业创作工具链内嵌

- [minimax-app] 内嵌时间线编辑器：Ducking/Beat 对齐/噪声学习/运动追踪 + **CapCut/达芬奇/FCP/Premiere 四套键位切换** + 导出剪映草稿包/FCP XML/DaVinci——按用户已有习惯提供键位而非自创。
- [minimax-app] subject 角色卡：成员/分区/按比例排版/封面绑版本——AI 角色库的 UI 样板；贴纸图章模式 + 清空 Undo once；全景 4/12 视角一键捕获成参考图节点。

### 小巧思精选

- [minimax-app] boot-splash 零依赖主题 spinner；记忆学习可撤销 Toast；关闭拦截列任务清单（不是干巴巴确认）；API key 粘贴防呆；快捷键面板写明作用域与例外；平台导出红线前置到提交前。

## TapNow（闭源商业 Electron，「Creative OS」平台型 AI 创作；第三款桌面对照样本）

### 具身画布 Agent（独家样本：Agent 住进画布）

- [tapnow] **presence 九态**：Agent 在画布上的状态全程可见（在看这里/整理了这里/正在生成这些…）+ 跟随镜头/第一人称视角——Agent 不是侧栏对话而是画布居民。
- [tapnow] **假出图 dry-run**：许可模式下零额度出占位假图——先看构图再真跑，省 trial 钱。
- [tapnow] **信任升级梯**：「Agent 已连续 N 次选对，切到智能生成？」——自动化程度随信任记录渐进放开，不是一次性授权。
- [tapnow] 冲突解决**把 Agent 列为编辑方**（与人类编辑同列）；Home feed = 可执行 Agent prompt 卡（模型营销即分发）。

### 防呆与计费

- [tapnow] **模型×附件兼容矩阵**：切换模型永不丢提示词/附件（不兼容的模型直接过滤或明示）。
- [tapnow] 计费前置：「本次约 {{price}} Tapies」提交前明示；错误文案**带修复工具名**（错误即行动入口）。

## 饱和评估（2026-11-07，更新于同日 AI-Canvas-tauri 补充轮）

原四条待补维度全部达成：文案语气（n8n 11034 条抽样 + dify）✅、协作场景（excalidraw 深挖 24 条 + affine/dify/n8n）✅、移动端（affine 独立壳模式）✅、cmd+K（affine 完整架构）✅、AI×画布范式（make-real）✅、文档×画布混合（affine 互转）✅。后补用户指名样本 AI-Canvas-tauri：新增剧集/多画布结构与 Agent 权限矩阵两个此前无样本的维度 ✅，并补「演示画布种子方案」。

候选池中剩余项目（Langflow/FastGPT/novanova/reveric 等）与已蒸馏产品高度同源（react-flow 系或中文 Agent 画布），预期增量不足，已停止。若后续发现**新的交互范式**（非又一个 react-flow 工作流）再重启蒸馏。

