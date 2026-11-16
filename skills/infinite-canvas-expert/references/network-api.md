# 无限画布网络层与三方集成手册（Provider / 回传 / 传输 / 重试 / 落盘 / 兼容 / 环境 / 成本）

> 回捞自 30+ 份蒸馏笔记。格式：`- [来源] **要点**：内容（file:line 证据）——影响/代价`。
> 来源标签：mayi / ic / wanvas（用户自建项目会话笔记 mayi-small/mayi-large/ic/wanvas.md）；shuo / moive / toonflow / comfyui / refly / dify / webav / beeftv / tldraw / invokeai / dim0 / aicanvas / litegraph / excalidraw-collab / coze / webgl / tl-studio / basketikun（对应 distill-*.md）。

## 一、Provider 适配层

- [shuo] **展示名与执行型号分离**：模型目录统一展示审核后名称与副标题，执行型号保持稳定，展示名修改不影响调用（release_notes.txt:398-399）——注册表双字段 displayName（可随意改）/ executionId（稳定）。
- [shuo] **模型能力矩阵驱动输入槽**：连线输入端按所选模型实际能力开放（有无视频输入、参考图上限 5/9/10/14/16 张、时长上限），超限提前提示、按目标格式重新分段（release_notes.txt:549、527、109、553、1316）——capability schema 生成输入槽与校验。
- [shuo] **provider 上传链路严格隔离**：Seedance 音频误走 apimart 上传链路、跨账户上传结果混用、复制节点共享入参句柄致后台没拿到视频（release_notes.txt:1227、233、825）——上传通道与 provider 绑定；节点复制时引用必须重新物化。
- [moive] **provider_context 协议快照 + 漂移校验**：提交时保存 {version, provider, base_url, model, profile} 快照；查询时校验当前 key 连接与快照一致，漂移即拒绝"密钥连接已变更"（backend/src/services/provider/gateway.py:264、factory.py:12）——防 key 换绑/重启后轮询打错 host。
- [moive] **协议 profile 适配器 + 能力目录**：GatewayProvider 按 chat/images/video/speech 分 profile，models.json 声明 aspect_ratios/durations/max_references/supports_json，残余 kwargs 直接 raise（gateway.py 文件头注释 "No model-name guessing"）——未知参数宁可报错，禁止猜模型名。
- [invokeai] **节点 schema 由后端下发**：字段模板来自后端 InvocationTemplates，前端不做节点 schema 的 source of truth（features/workflow/core/fields.ts）——新增节点/字段零前端改动。
- [shuo] **RunningHub 档位→队列映射**：显卡档位写入 instanceType（24G/48G/84G）走对应队列，并发数按会员等级检测（release_notes.txt:2012、2007、1129）。
- [mayi] **OpenAI 兼容层桥接连环 10 坑**（LibTV 桥 commit 9dd9143，全部有测试）：① provider 配置 80KB pretty JSON 超 64KB 同步上限被整体丢弃 → 改紧凑 JSON（55,897B）；② 模型 ID 不容空白 → key/显示名分离、shim 侧还原；③ referenceMode:"url" 触发图床配置要求 → dataUrl 内联 base64，请求体上限 1MB→64MB；④ 画布 UUID 是 32 位无连字符 hex → 双格式正则；⑤ 30001"账号状态已切换"真因 = 画布空间与账户作用域错配 → scratch 画布按当前作用域建 + config 按账户分键缓存；⑥ `libtv model <key>` 是回显查询词，显示名取自 search 结果；⑦ 临时文件 .bin 后缀被拒 → 按 mime 推断扩展名 + 显式 --type；⑧ 接参考图必须 params.modeType=image2image；⑨ 1×1 微型测试图触发平台审核 unmarshal 错（平台怪癖）；⑩ install 双写 lsSync+磁盘 localStorage 按并集合并防分叉丢条目。
- [ic] **渠道 API key 掩码三件套**：接口掩码 + 前端页不再传 api_key（走服务端 modelscope_api_key 回退）+ 后端挡掩码串（misc.py:445-471）——修复 `GET /api/config/token` 明文回传 ModelScope Token 的标准模板。
- [mayi] **密钥只记位置不记值**：QDM_API_CONFIGS / QDM_GLOBAL_KEY / SESSION_SECRET 全在服务器 /srv/data/mayi/.env（.gitignore 兜底），git 全历史无真实密钥、每次推送前扫描（mayi-large.md §1）。

## 二、生成结果回传与下载

- [moive] **结果资产化只存 object_key**：provider 视频 URL 先下载进 MinIO（`_store_remote_video` canvas.py:986），持久化只存 result_video_object_key；前端保存节点时 stripTransientMediaUrls 删除临时 URL 字段（frontend/src/composables/useCanvasEditor.js:37）——签名 URL 过期问题根治。
- [shuo] **结果找回替代重新生成**：provider 结果 URL 时效约 24h（高清重绘约 26h）；任务中心持久记录任务 ID+结果 URL+落库时间，"结果仍在有效期且可读取时无需重新生成或重复付费"，重开项目先查任务表（release_notes.txt:296、43、165、195、30）。
- [shuo] **结果及时落盘 + 断点续传**：符合条件的视频下载支持断点续传，落地对象存储/本地（release_notes.txt:236、897）。
- [toonflow] **下载管线带 sha256 检查点**：任务 checkpoint 记 files[index]+sha256，恢复时逐段校验哈希复用，缺哪段补哪段（apps/server/src/utils/media/tasks.ts recordSchema:38-65、generation.ts:331-365）——任一段失败都从最近检查点续跑，不重付。
- [toonflow] **下载地址过期只刷不重提**：MEDIA_ASSET_URL_EXPIRED 时仅重查原供应商任务一次拿新地址（refreshed 标志防循环），不重试失效地址（generation.ts:339-347）。
- [ic] **SSRF 四入口收口**：/api/local-assets/import-urls 裸 httpx.get+follow_redirects 完全绕过已有防线（assets.py:244），codex 参考/即梦参考/runninghub 三处同病 → 统一走 safe_remote_get（core.py:4397、5560、runninghub.py:706-722）——新增出站请求必须走同一收口函数。
- [mayi] **SSRF 拦私网**：outbound-proxy.js 加 resolveSafeHost/assertPublicHost，拦 10/127/169.254/172.16-31/192.168/224+/0 段 + DNS 全地址校验，旁路 env QDM_SSRF_ALLOW_PRIVATE=1（commit 63a1dfd）——覆盖 proxy_fetch/下载落盘/OSS 拉取全部出站。
- [toonflow] **媒体转码防恶意文件**：浏览器播不动的媒体 POST /api/media/preview 服务端 FFmpeg 转码，`-protocol_whitelist file` 禁网络协议、并发限 2、2 分钟超时、输出 100MB 上限（packages/nodeShared/src/mediaPreview.ts:97-109、apps/server/src/utils/media/preview.ts）。
- [mayi] **Range/206 视频链路五连修**：file:// 路径读侧改写 → .mp4 扩展名判定 → `<video>` src 被拼成海报帧的路径反查 → 同一 URL 双消费方 Accept 头分流（`<img>` 发 image/* 回海报、`<video>` 发 */* 回字节）→ 加 HTTP Range 206 支持 seek（mayi-large.md §3）——改一个 URL 前先想它有几个消费方。
- [mayi] **大文件流式直写**：≥19MB 单文件 ECONNRESET（JSON body 25MB 上限 + req.destroy 时序错）→ PUT /workspace-file 流式直写磁盘，JSON 上限提 64MB、超限回 413（实测 PUT 40MB→200）；上游响应帽 100MB（通用代理）/200MB（download_url_to_local_asset）（mayi-large.md §3.3、mayi-small.md §二）。
- [ic] **上传 50MB 上限 413**：两个上传接口加 50MB 上限（413）（canvas.js:1550-1556、13988）；关页 keepalive 载荷瘦身 → 详见 data.md keepalive 64KB 上限。
- [basketikun] **网络图加载全带 AbortSignal + 三档超时**：下载 10min / 远程 meta 10min / decode 10s，AbortSignal 逐层透传 fetch→Image 解码→store 写入（image-storage.ts:27-29、71-123）。
- [wanvas] **二进制字节旁路**：JSON invoke 之外开 `x-wanvas-binary` 原始字节通道（BINARY_CMDS 含 plugin:http|fetch_read_body）；三段 rid 协议结束块必须为空——官方 JS 绑定先 close 再 return，flag=1 块载荷被丢弃（wanvas.md 坑④）。

## 三、传输协议选型

- [comfyui] **WS 二进制帧**：`binaryType='arraybuffer'`，帧 = `[u32 事件类型][载荷]`：type1 预览图 `[u32 mime][bytes]`、type3 progress_text 长度前缀字符串、type4 预览+JSON 元数据（packages/api-client/src/ComfyApi.ts:1038-1119）——大预览图不走 JSON base64。
- [comfyui] **指数退避重连**：delayMs*2 封顶 60s，恢复派发 reconnecting；status 消息带 sid 下发 clientId 并持久化（ComfyApi.ts:1018-1030、1133-1138）。
- [comfyui] **高频进度 rAF 合并**：progress/progress_state 两个 WS 事件各挂 last-write-wins coalescer，最多每帧写一次 store，丢弃量计入 droppedCount 遥测（src/stores/executionStore.ts:724-728、785-792、src/utils/rafBatch.ts:24-63）。
- [refly] **SSE 手解**：fetch + response.body.getReader() + TextDecoder 解 `data: ` 行，9 类事件 skill_start / skill_log / skill_stream / tool_call_start/end/stream / skill_structed_data / skill_create_node / skill_artifact / skill_token_usage / skill_end（AWC/utils/sse-post.ts:71-110、273）。
- [refly] **SSE+轮询双通道兜底**：SSE 在途用 streamResults，断线/重开页面走 useActionPolling 轮询动作结果直到终态；后端失联 10s 弹"连接超时，重试"Modal、2s 轮询自愈（skill-response.tsx:350-387、index.tsx:655-699）。
- [moive] **DB 轮询桥 SSE**：无 webhook 的 provider 用 stream_generation_events 每 1s 重查 generation 记录、签名去重、30min 超时，映射 start/progress/complete/fail SSE（backend/src/services/canvas.py:732）——"外部 provider 无 webhook、状态在自家 DB"的通用桥。
- [toonflow] **共享短轮询单例**：所有独立 UMD 节点包经 `Symbol.for("toonflow.nodeMediaTasks.v2")` 共享一个轮询器，按 directory+resume 分组、每批 ≤100 个 taskId、1s 调度、10s 超时（packages/nodeScaffold/src/nodeAi.ts:145-198）——插件化场景不用每节点一条 SSE。
- [toonflow] **长请求心跳**：SSE 式长响应每 20s 写一个前导空白 `\n` 防代理断连；客户端断开→AbortController→服务端 cancel 任务并返回 taskId 供续查（apps/server/src/routes/ai/media/generate.ts:41）。
- [dify] **草稿同步 debounce+hash**：debounced 同步函数存 store（可 flush/cancel）+ hash 去重 syncWorkflowDraftHash + 页面关闭 syncWorkflowDraftWhenPageClose（store/workflow/workflow-draft-slice.ts:21-61）。
- [excalidraw-collab] **volatile 分级广播**：光标/idle/视口全走 volatile（弱网允许丢帧）；3s 心跳报 ACTIVE、60s 无操作 IDLE、切标签页 AWAY；全量场景每 20s 重同步防丢包发散；双指手势期间暂停光标广播（Collab.tsx:943-999、Portal.tsx:151-224、pkg/common/src/constants.ts:374-377）。
- [invokeai] **单 Socket.IO hub + token 走 handshake**：整页一个 socket，凭据走 auth.token 回调而非静态 Authorization header（"静态 header 会活得比 token 替换更久"）；feature 级监听器挂 hub 之外、socket 重建存活（platform/transport/socketHub.ts）。
- [invokeai] **进度热/冷分离 + 对账闭环**：列表失效合并 50ms，进度帧直写 transient store 绕过 Query 缓存；swap 进度帧绑定目标 image names 才可上屏，防"item 3 的 denoise 帧画到 item 1"（features/queue/data/realtimeRuntime.ts、progressImageStore.ts）；对账以五类信号之一结束（终态事件/重读终态或 404/queue_cleared/重连重读/周期对账），HTTP 对账兜底一切丢事件场景（features/queue/README.md 末段）。
- [dim0] **WS 鉴权一次性 ticket**：HTTP 认证后铸 ticket（Redis `SET ... EX 30`），消费用 GETDEL 原子不可重放，payload 绑定 {user_id, board_id, role}（backend/topix/collab/tickets.py:1-8）——WS upgrade 带不了 Authorization 的通用解。
- **选型判据**：高吞吐二进制（预览图/帧）→ WS 二进制帧；单向流式文本 → SSE（fetch 手解即可，EventSource 不能 POST）；独立插件/海量小任务 → 批量短轮询单例；无 webhook 的外部 provider → DB 轮询桥 SSE；易丢的低价值高频态（光标/视口）→ volatile。

## 四、超时 / 重试 / 幂等

- [shuo] **分级超时"只提醒不判失败"**：ComfyUI/即梦等待改无上限，持续 10 分钟未结束只提醒一次方便查看进度，不直接判定任务失败（release_notes.txt:430-431、480）；断线重查原任务、查询中断显示等待接收，绝不重建任务（release_notes.txt:369、77、170）。
- [ic] **非幂等不重发**：`_RETRYABLE_METHODS = frozenset({"GET","HEAD","OPTIONS"})`（core.py:5739）——视频 POST 超时重发会二次扣费（core.py:10102 实例）；提交类超时改拿 submit_id 轮询：即梦 pending 后端自动续查、5s 节流、CLI 连续失败 5 次判死（core.py:11210）。
- [toonflow] **Polling never resubmits a POST**：提交前先存 providerData（供应商任务凭据）再离开 worker（backend/src/services/canvas.py:843、895 注释原文）；submitting 状态只有"宿主明确证明尚未调用供应商"（markSubmitted + mediaTaskRejected）才许置 failed，断线/超时/5xx 一律 interrupted，恢复只走 provider.resumeTask 按 ID 查询（generation.ts:252-262、packages/nodeShared/src/useNodeGeneration.ts:95-97）——付费 API 任务管理核心范式。
- [toonflow] **取消先落盘墓碑 + 幂等 start + status 兼任恢复**：对"还没见到提交回执的 taskId"也写 cancelled 墓碑并 exclusive 提交，防乱序请求稍后创建付费任务（tasks.ts cancel:534-562）；同 taskId 同请求返回现有快照、不同请求 409（tasks.ts start:469-478）；status 端点发现 resumable 的中断任务直接重新 launch（tasks.ts status:510-532）——客户端只轮询 status 即得断线自动续跑。
- [toonflow] **轮询容 90 秒断线**：单次查询失败不取消任务，记 failedAt，90 秒内恢复就继续，超时才报 mediaTaskDisconnected（nodeAi.ts:183-190）——不因几次快速失败取消已提交的生成。
- [moive] **失败熔断（工具签名黑名单）**：`_tool_signature` = tool_name::json(args, sort_keys)，失败签名进 failed_signatures，原样重调直接终止回合（service.py:269、535）+ prompt 硬规则 + recursion_limit 12，三层防死循环全服务端强制。
- [moive] **transient_status_issue 不判死**：轮询异常只标 transient_status_issue:true 保持任务存活（canvas.py:951），前端对该标记不抛错（useCanvasGeneration.js:301）；"completed 但无 URL"继续 PROCESSING（canvas.py:983）。
- [beeftv] **后端任务幂等 admission**：ClientOperationID + operationHash 查重，命中走 admitExisting，重试天然安全（backend/internal/task/admission.go）；上游提交不确定协议"上一次提交结果不明确，为避免重复创建上游任务已停止自动重发"（route_attempt.go:64、121），恢复"已有任务只查询，不重复创建"（video_seedance.go:178）。
- [beeftv] **批量调度绝不重复提交**：已绑定 taskId 或已有成品的节点交给恢复/对账链路，绝不重复提交；成片成功判据是"节点拿到内容"而非后端返回成功（use-canvas-generation-batches.ts:198 reconcileBatches）。
- [beeftv] **进度诚实性（状态面）**：submission_unknown 是一等状态、上游 60s 停滞 determinate 换 indeterminate（GENERATION_PROGRESS_STALL_MS=60_000，lib/generation-task-display.ts:50、58、37）；呈现与文案规则 → 详见 ui-ux.md 运行/执行体验。
- [coze] **重试/超时做成节点表单通用段**：超时范围提示 / 重试 1-3 次 / 不重试 / 异常分支；预警"开启流式输出后，一旦开始输出数据，即使出现异常也无法重试或跳转异常分支"；LLM 重试可配备选模型（i18n workflow_250416_03、workflow_250407_204）。
- [comfyui] **幂等取消**：interrupt 附 prompt_id 提示；新 `/api/jobs/{job_id}/cancel` 已终态为 no-op（ComfyApi.ts:1602-1610 起注释）。
- [wanvas] **返回确认语义**：history_add_from_asset 必须返回完整 entry 含 id——缺 id 前端判"未确认写入"走延迟持久化路径重写一遍，产生成对重复条目（wanvas.md 坑⑪）——返回值是消费方的提交确认。
- [dim0] **batch.id 幂等 + 已知缺口**：relay 按 batch.id 去重、命中按原 seq 重发 ack（ADR-SYNC-001）；但 coalesced 重发取最后一条 record id，成员变化会重放已应用前缀，自认 known idempotency hazard——合并消息的幂等要按整批算。

## 五、资源落盘管线（网络侧补充）

- [mayi/ic] **原子写网络侧补充**（三层防线本体 → 详见 data.md 原子写）：画布 autosave write_text_file 曾非原子（mayi-code-review2 发现）；大 body 走流式直写而非整包 Buffer（mayi download_url_to_local_asset 收 200MB Buffer 进内存是反面，fs.js:385）。
- [toonflow] **writeAtomic + staging 发布**：统一 writeAtomic = 同目录临时文件（wx 独占创建）→ rename/link 提交 → 失败清理且不吞原错误（packages/file/src/index.ts:150-179）；复制画布先复制到 `.toonflowCopy{uuid}` 临时目录、全部重映射完成才 rename 发布、失败全量回滚（canvasFiles.ts:85-164）。
- [toonflow] **大 base64 剥离哈希旁文件**：providerData 里 >4KB 的 `data:` URI 写成 `media{sha256}.bin` 旁文件，JSON 占位空串、恢复按路径+哈希回填，16MB JSON 上限（tasks.ts prepareBlobs:135-175、restoreBlobs:177-200）——任务 JSON 只留指针。
- [aicanvas] **IndexedDB 只存引用**：媒体文件在项目数据目录、库里只存相对路径（换机/导入仍可定位，SeriesRail.tsx:15）；保存时文件仍在 relativePath 就沿用 assetId 不逐节点 stat，全量扫盘只在解析不到文件时触发（doc/架构说明.md:285、532-533）。
- [mayi] **镜像目录撞车教训** → 详见 data.md 数据只跟服务端走（镜像目录别撞车，含 lsSync 自愈与属主细节）。
- [webav] **OPFS 当媒体中间存储**：构造时 `write(tmpfile(), stream)` 落 OPFS，此后按 offset 随机读、内存只留 sample 索引（mp4-clip.ts:158-167）——浏览器内处理远超内存的素材。
- [wanvas] **localStorage 服务端垫片** → 详见 data.md 数据只跟服务端走（含同步 XHR 预取防假 null、key 校验防越界）。
- [mayi] **响应缓存分层**：ETag/304 条件请求（304 只在无 Range 时走）；/assets/* vite 哈希名 1 年 immutable、缩略图/视频 7 天 + Vary: Accept（同一 URL 双消费方分开缓存）、记录文件 no-cache+304（commit 495d602）。
- [beeftv] **推测性生成不进普通持久化**：生成期间的 effect 带 generationEffectKeys 标记，确认后 stamp 才转正，失败按地图精确回滚连线/节点（stores/canvas/use-canvas-store.ts:537-553）——防"断线后画布上留一根指向不存在结果的线"。

## 六、协议版本与兼容

- [comfyui] **双版本 Zod schema 并存**：workflow version 0.4（扁平 nodes/links）与 version 1（definitions.subgraphs 递归）双 schema（packages/graph-model/src/workflowSchema.ts:421-438、473-490）；Zod 校验失败也不阻塞加载、回退原始数据（app.ts:1272-1280）；0.4 遗留 Reroute-as-node 弹 toast 让用户手动点 Migrate（app.ts:1284-1298）。
- [litegraph] **两阶段恢复 + 缺类型替身节点**：configure 先按 id 全部 add 节点、再逐个恢复连线（src/litegraph.js:2240-2309）；找不到类型建替身节点保留原始序列化（has_errors + last_serialization，:2290-2295）；last_node_id/last_link_id 保证 ID 单调不复用、重载后链接引用安全（:2217-2226）。
- [invokeai] **反面：全量重写无兼容**：webv2 "Loader refuses older document versions; nothing migrates them"——新立项省掉兼容层可行，存量用户项目不可复制（workbench/canvas-engine/ARCHITECTURE.md）。
- [tl-studio] **semver 版本门**：MAJOR 不同直接拒绝加载；MINOR 仅限加性字段，老加载器靠 serde 缺省忽略新字段——此前 version 硬编码 "1.0.0" 空串是踩坑后修复（crates/ts-schema/src/versioning.rs:1-30）。
- [tldraw] **协议版本握手**：TLSYNC_PROTOCOL_VERSION 握手，版本不匹配直接拒连（packages/sync-core/src/lib/protocol.ts）。
- [comfyui] **向后兼容转发**：WS 未注册的新事件类型落到 `_registered` 检查后原样转发；二进制字段有无受服务端 feature flag `supports_progress_text_metadata` 控制（ComfyApi.ts:1130-1160）。
- [webav] **运行时探测降级**：硬件解码失败且无输出帧 → 置 #downgradeSoftDecode 重配 `hardwareAcceleration:'prefer-software'` 再试一次（mp4-clip.ts:838-845）；Windows flush 可能不 resolve → decodeGoP 不 await flush；`Codec reclaimed due to inactivity` 容忍不抛错（mp4-clip.ts:896-902）。
- [webgl] **图形后端运行时降级**：`targets: ['webgl2','webgl1']` 自动降级；WebGL1 缺 UBO 时 isSupportedUBO() 走非 UBO 路径（packages/ecs/src/systems/SetupDevice.ts:211-234、render-graph/DynamicUniformBuffer.ts:47-52）。
- [wanvas] **复刻协议必须对齐消费侧形状**：history_list 漏 dateKeys 面板 .map 崩、缩略图返回裸字符串致 /bridge-file/undefined、data URL 未剥前缀解出垃圾字节（wanvas.md 坑⑥⑦⑧）；方法论：对照面板 chunk 的实际消费代码、宁可多给不可少给，工具 shape-audit.js 扫"调用点后 420 字符字段访问"；面板同功能常有新旧两条调用路径，复刻要两条都对齐（坑⑪）。

## 七、CORS / 代理 / 网络环境

- [dim0] **CORS `*` + credentials**：architecture.md:37 官方自标 "worth flagging"——带凭证的全开 CORS 是规范禁止组合，自部署前必改。
- [ic] **CORS 默认同源**：从 `*` 收紧，ALLOWED_ORIGINS 可配（Phase 6）；部署后用内网地址 192.168.3.1 被 import-urls 拒绝验证 SSRF 修复生效。
- [mayi] **Node 正向代理坑**：`http.request(绝对URL)` 会被 Node 直连目标完全绕过代理——必须把请求发给代理、path 用绝对 URL；HTTPS 走手写 CONNECT 隧道 + tls.connect（outbound-proxy.js，零依赖）。
- [wanvas] **Node fetch 不认 HTTPS_PROXY**：DNS 污染域名（api.openai.com 解析到假 IP）直连必挂 → 启动时 `setGlobalDispatcher(new EnvHttpProxyAgent())`；配对规则：npm undici@8 的 ProxyAgent 只能配 undici.fetch，Node 24 内建 fetch 拒绝 npm dispatcher（wanvas.md 坑⑤）。
- [wanvas] **代理功能私网直连**：出站统一走 ofetch 路由，isPrivateHost（loopback/10/192.168/172.16-31/169.254/100.64-127/::1/.local/.internal）永远直连、公网按开关走代理；test 探针 `https://www.gstatic.com/generate_204` 8s 超时；scheme 非 http/https 快速拒绝（commit 7a59bdf）。
- [ic] **本地 curl 自检被 IDM 劫持不可信**：`HTTP/1.0 204 Intercepted by the IDM Advanced Integration`——本机 HTTP 验证换端口（18765 而非 8896）并核对响应头特征。
- [ic] **git 大包传输不稳**：fetch 反复 early EOF/TLS 中断 → `-c http.sslBackend=openssl -c http.postBuffer=524288000 fetch origin main --depth=1` 重试；`git ls-remote`/`push` 稳定；Windows 防火墙挡入站端口需临时规则。
- [mayi] **非安全上下文 crypto 缺失**：HTTP 局域网 IP 下 crypto.randomUUID（bundle 56 处）与 crypto.subtle 缺失 → 桥条件安装 shim（getRandomValues 实现 UUID v4 + 纯 JS SHA-256 对照 Node 验证），HTTPS 下自动跳过。
- [excalidraw-collab] **离线后果管理**：online/offline 事件 + 1s debounce → 顶部警示条"更改不会被保存"；关页前先抢救性保存再 preventUnload；保存失败分级文案（普通失败 vs 画布超限 4MiB）、同一错误只弹一次（Collab.tsx:102-106、269-373）。
- [invokeai] **409 图片恢复 probe 单例**：img onError 拿不到状态码 → 失败 URL 上报单例 probe 串行 fetch 探测，绝不 per-element 重试（features/gallery/data/imageRecovery.ts）。
- [mayi] **压缩与 Range 互斥**：Range 响应不能 gzip（Content-Length 是原始大小、gzip 流更短，客户端永远等）；gzip 绕过 Range 分支且必须发 Content-Encoding（mayi-large commit 495d602）。

## 八、成本可视化与防双扣

- [shuo] **预扣 + 结算退差额**：跨档位计费"先预扣、完成后按实际费用结算并退回差额"（release_notes.txt:43）；toonflow 多租户网关同型：reserveSnapshot/settle/release，按 ffprobe 实测视频秒数结算、失败释放（apps/server modelGateway）。
- [shuo] **并发感知排队**：provider 并发额度做成画布队列——3 并发框选 10 个节点先跑 3 个、完成即补位；国内/国际线路、不同模型分开排队；余额不足暂停后续批量任务（release_notes.txt:1204、815-816、1069、77、689）。
- [shuo] **费用预估显式化**：生成按钮旁实时显示参考价、随模型参数更新，且"预估不等于最终扣费"（release_notes.txt:481、265、174）。
- [beeftv] **费用预估 TTL**：预估过期必须重确认——"费用预估已过期，请重新确认费用"（use-canvas-upscale-batch.ts:220）；估算失败给兜底文案"暂时算不出，按所选渠道实际计费"（use-canvas-storyboard.ts:90）。
- [dify] **K/M tokens 折叠**：运行详情节点追踪条目显示 `K/M 格式化 tokens · 耗时`（run/node.tsx:109-113、188-191）。
- [refly] **成本写在节点上**：状态条常显本次 credit 消耗与耗时秒数（skill-response.tsx:174-185）。
- [beeftv] **付费授权是数据不是口头同意**：付费提交必须持有确认卡片写入的有限授权（grant），失败或未知时查原任务不重复购买；新用户消息使旧提议失效（agent-host/system-prompt.mjs:13 + changelog v2.0.4）。
- [shuo] **防重锁**：点击生成加防重锁，一次点击只发一个请求；取消尚未确认时不开放再次生成（release_notes.txt:934、271）——按钮状态机 idle→submitting→polling→done/error。
- [aicanvas] **effect 权限矩阵审批**：media_generation/config_write/external_write 等 effect 分类驱动审批卡，付费媒体生成审批内嵌模型选择器（doc/架构说明.md:166、AgentApprovalCard.tsx:24-35）。

## 本手册未覆盖、需实测补齐（笔记标记 [未验证] 的网络相关项）

- [toonflow] 视频 Range 流式播放未确认：assets/read 支持 Range，但前端统一先整包下载为 blob URL 再播放；验证路径：网络面板观察视频请求是否 206（distill-toonflow.md）。
- [moive] 生成失败无自动重试/provider 级 fallback 链；历史版本是否处理过未验证（浅克隆单 commit 无法看演进）（distill-moive.md）。
- [shuo] 防重锁是前端状态还是服务端幂等、"任务中心找回结果"的存储结构均无证据（验证路径：抓包/反编译 asar、检查 %APPDATA%）；Electron/WebView2 技术栈推断与全部更新日志自述均 [未验证]（distill-shuo.md）。
- [dify] LLM 节点卡片内是否流式渲染生成文本未确认（流式只确认存在于预览聊天链路）（distill-dify.md）。
- [aicanvas] 在线演示模式下 Agent/生图是否真实可用未验证（Web 模式凭据存储不可用、演示数据预置 success）；验证路径：演示画布触发一次真实生成（distill-aicanvastauri.md）。
- [webav] `@webav/av-writer` 包在本克隆（v1.2.8）不存在，其他版本是否存在未确认（distill-webav.md）。
- [excalidraw-collab] 房间临时性/过期策略文案未发现；静默 reconcile 极端竞写的视觉表现未实测（distill-excalidraw-collab.md）。
- [comfyui] workflow 0.4→1 是否存在通用自动转换器未发现（仅 reroute 迁移提示与双 Zod）（distill-comfyui.md）。
