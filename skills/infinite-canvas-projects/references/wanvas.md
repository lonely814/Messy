# wanvas-infinite 逆向解耦 Docker 多人协作部署 — 会话提炼

来源：会话导出 wanvas-docker.md（sess_7c59f7a7-757d-41bd-9d05-9fb0cb3c8dd0，2026-10-04 ~ 2026-11-03）。用户：杨洋（GitHub lonely814）。

## 1. 项目是什么、来源、技术栈

- wanvas-infinite = "Wanvas Infinite" 无限画布桌面应用，**Tauri 2.11.2（Rust + WebView2/wry）**。起点是 `~/Documents/wanvas-infinite/wanvas-infinite.exe`（38MB，用户唯一放进去的文件）。
- 用户原始需求（首条消息）："看看这个项目 我需要逆向解耦 改造为可以在linux环境 docker部署 多人协作使用（不分账号，共享），确保功能全部可用 ，脱离win桌面端逻辑"
- 上游版本演进：1.2.3（初始 exe）→ 1.2.4（`Wanvas.Infinite_1.2.4_x64_en-US.msi`，2026-10-26 部署）→ 1.3（直装版 wanvas.exe，Program Files 默认路径，2026-11-03 部署）。
- 前身经验：同类的 mayi 项目（无限画布桌面应用逆向 + Linux Docker 化），教训"桌面版路径/字段约定在 Web 上失效，统一解法是服务端做读侧适配"；"数据只跟服务端走"也是照搬 mayi 策略。
- **与 IC-main 项目（Infinite-Canvas-main）的关系：整个会话导出中未出现该项目名**。[未验证] 若需要确认关联，需追问用户。

## 2. 改造方案细节

### 三层架构
- **官方前端（零改动）**：从 exe 的 .rdata 段提取 brotli 压缩内嵌资产。1.2.3：213 文件/16MB；1.2.4：218 流；1.3：298 流/290 资产。
- **Node 服务端**（`server/`，唯一 npm 依赖 `ws`）：`POST /api/invoke/<cmd>` 命令端点 + WebSocket 回调/事件通道 + 静态服务 web/。实现全部桌面命令（1.2.3 时 100+，1.3 时命令表全集 178 条）。
- **浏览器桥**（`server/bridge.js`，注入 index.html 之前的阻塞 head 脚本）：复刻 `__TAURI_INTERNALS__`（transformCallback/runCallback/invoke/convertFileSrc）、Channel 顺序消息（`__CHANNEL__:<clientId>:<callbackId>`，载荷 `{index,message}`/`{index,end:true}`）、事件 `{event,id,payload}`。

### 提取流水线（tools/，已参数化可复用于新版本）
- `tools/scan-v2.js → finalize-www.js → verify-www.js`：exe 路径走 argv、.rdata 范围自动从 PE 段表读、brotli 扫描首字节 `(b & 0x3F) === 0x1B`（lgwin22）、`zlib.brotliDecompressSync` 单流精确解压（尾部垃圾容忍、二分定位压缩长度、`maxOutputLength:64MB` 防 OOM）、资产名↔数据流**双向零距离邻接映射**（[data][key] 与 [key][data] 布局并存）、webp/ico 未压缩直存、index.html 内容嗅探。
- CDP 方案不可行：wry 在 Windows 上显式设置 additionalBrowserArguments，覆盖 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`，远程调试端口起不来。
- MSI 解包：`msiexec /a` exit 83 被拒；用 NVIDIA 自带 7z.exe 直接解，内含单文件 `Path` 即新版 exe。

### 多人协作与"鉴权"
- 无账号、无鉴权：多用户共享同一数据目录，每个 WS 连接分配 clientId，同一画布多标签页实时可见（已验证）。
- 授权移除（用户要求"去掉授权功能及相关模块"）：`server/commands.js` 删除 license 存储逻辑（license.json 读写、设备号、每日额度约 70 行），保留形状兼容固定应答：`get_license_status`/`activate_license` 一律"已激活专业版、永久有效"、`check_pro_access` 恒 true、`daily_generate_can_start/commit` 恒"允许、额度无限制"、`get_device_id` 固定 `wanvas-web-shared`；删除 `data/license.json`；compose 移除 `WANVAS_DAILY_FREE_LIMIT`。

### Docker 化
- `Dockerfile` + `docker-compose.yml`：node:22-alpine 单阶段构建；容器内 8787，宿主映射 **8899**（宿主 8787 被 headroom 容器占用）；数据卷 `./data`；compose environment：
  - `WANVAS_CACHE_DIR=/data/cache`、`WANVAS_DOWNLOAD_DIR=/data/downloads`（env 优先，UI 的 set_cache_dir/set_download_dir 静默忽略）
  - `HTTPS_PROXY=http://<代理>:<端口>`（README 记载，国内服务器需要）
- 部署命令：`git clone https://github.com/lonely814/wanvas-infinite.git && cd wanvas-infinite && docker compose up -d --build`
- 生产服务器：`http://192.168.3.2:8899/`，部署路径 `/srv/data/wanvas-infinite`（compose 工作目录，data 卷 → /data），SSH 端口 5522（HexHub asset_ref=R7E6F90A7）。部署流程：scp→sha256 校验→备份（*.bak-proxy 等）→`docker compose up -d --build`→健康检查。

### 数据只跟服务端走（客户端零残留）
- 桥内整体替换 `localStorage`/`sessionStorage`/`indexedDB` 为服务端 KV 垫片；服务端 `/api/kv` GET/PUT/DELETE + `/api/kv/keys` + `/api/kv/all`，落 `data/kv/<key>.json`（key 可含 `/` 生成子目录，PUT 前 mkdirSync recursive）。
- key 校验 kvKeyOk：`/^[\w.-:/]{1,240}$/` + 拒 `..` + resolve 包含检查防越界。
- **同步 XHR 预取 /api/kv/all** 灌缓存——否则应用首条同步 getItem 读到假 null，会把空配置写回服务端覆盖真实数据。

### 桌面能力浏览器化（桥内降级实现）
- 文件对话框→选择器+上传（/bridge/upload + sourcePath）；导出→自动下载（`writeDownload` token 机制，`/bridge/download/<token>/<name>`）；剪贴板→Clipboard API；取色→EyeDropper；内嵌浏览器节点→iframe 叠层；image_editor（Lightroom 级调参：exposure/contrast/vibrance/clarity/sharpen/dehaze/vignette/grain/curves/grading/cropRect/rotation…）→**Canvas 引擎功能等价重实现**；ComfyUI→HTTP+WS 代理；AI 助手→服务端 SSE 流式代理（mock 上游验证 `delta:'你'→delta:'好'→done→end` Channel 投递）。
- 服务器路径选择器：`pick_comfyui_root`/`pick_comfyui_python`/`pick_comfyui_workflow_dir` 弹自绘弹窗（快捷链接+目录树+手输），服务端 `GET /api/browse` 列目录，`contain()` 严格限数据卷内。
- 设置页网络代理功能（commit 7a59bdf）：`get_proxy_config`/`save_proxy_config`/`test_proxy_config` 三命令 + `WanvasProxySettingsCard`（general tab 首位，pin 在 `window.__WANVAS_PROXY_CARD__` 防重渲染丢输入）；出站统一走 `ofetch` 路由：`isPrivateHost`（loopback/10/192.168/172.16-31/169.254/100.64-127/::1/.local/.internal）永远直连（undici.Agent），公网按开关走代理；test 探针 `https://www.gstatic.com/generate_204` 8s 超时；scheme 非 http/https 快速拒绝（"仅支持 http/https 代理"）。
- .wanvas 加密归档：`server/archive.js`，自洽格式 scrypt+AES-256-GCM（WANVAS magic），与桌面版互不识别。

## 3. 关键架构事实

- 目录：`web/`（提取的前端，入口 bundle 见下）、`server/`（index/commands/bridge/ws/storage/archive 六模块）、`tools/`（提取脚本链 + `shape-audit.js` + `patch-addmenu-flyout.js` + `patch-proxy-settings.js` + `REVERSE-NOTES.md`）、`Dockerfile`、`docker-compose.yml`、`README.md`、`package.json`。`.gitignore` 排除 data/、exe、MSI、node_modules/、udata/。
- 服务端端点：`/api/invoke/<cmd>`、`/api/kv`（+keys+all）、`/api/browse`、`/bridge/upload`、`/bridge/download/<token>/<name>`、`/bridge-file/<seg>/`、`/bridge-proxy`、`/healthz`、`/api/event/emit`；另有 `x-wanvas-binary` 原始字节通道（BINARY_CMDS 含 `plugin:http|fetch_read_body`）。
- 数据布局（镜像桌面版）：`canvases/`（workspace.json 纯 meta + `canvases/<id>.json` 文档，保存拆分/加载合并）、`assets/`、`Asset Library/`、`history/`（entries.json）、`logs/`、`config.json`、`kv/`、`comfyui-workflows/`（sidecar `<fileName>.wanvas.json`）、`assets/style-library/<id>/manifest.json`+previews、`novel/`、`comic/`、`cache/`、`downloads/`。
- 入口 bundle 演进：1.2.3 `index-CdKjPrrn.js`/`index-C9goGPMI5.css` → 1.2.4 `index-B08QobAn.js`/`index-BXQZZtfM.css` → 1.3 `index-CcBObLVX.js`/`index-Cf68Q8Bu.css`；import map 别名 `/assets/wanvas-entry-<WANVAS_ASSET_VER>.js`（20261005d → 20261026a → 20261103a）。
- 缓存策略：.js/.css/.woff2 发 `immutable, max-age=1年`；index.html 发 `no-store` + `Clear-Site-Data: "cache"`；serveIndex 注入 import map 并泛化 rewrite 正则 `/src="(\/assets\/index-[A-Za-z0-9_-]+\.js)(\?[^"]*)?"/`。
- UI 补丁（打在入口 bundle 原文件名上）：①新建节点菜单 Blender 式分类+飞出（3 组：输入与生成 8/处理与工具 7/组织与布局 3，分类图标 generate/blend/frame，hover 200ms 关闭延时飞出，≤6 项保持平面列表，ResizeObserver 重钳制）；②设置页代理卡片。两个补丁工具已重写为**动态推导**（入口名读 index.html、混淆符号名从 bundle 正则抓），升级零改动重打。
- GitHub：https://github.com/lonely814/wanvas-infinite（main）。commit 链：`57cdce6`(初版 236 文件) → `b01410c`(expose sidecar) → `1f226de`(data URL 剥前缀) → `6c47509`/`aa105a3`/`358b9ca`(菜单高度/紧凑/RO) → `a4df378`/`e9daf0e`(Blender 菜单) → `c4acaab`/`07402e6`/`731f7e6`/`316f834`/`2f66d3f`(缓存方案) → `7a59bdf`(代理功能) → `32e8ca7`(1.2.4) → `4a4d901`(历史契约) → `6dd7d23`(1.3，本地 a867839 经 api.github.com 兜底推送)。
- 外部依赖事实：ComfyUI 在 `http://192.168.3.66:8188`（Windows 本机，`~/ComfyUI-Shared`）；生产 KV 里代理配置 `http://192.168.3.66:7890`（启用）跨部署保留。
- 记忆：本地 `~/.zcode/cli/memories/projects/wanvas-infinite-ba5e757ecd42f549/memory/wanvas-reverse-deployment.md`（11 个坑）；hindsight-team 文档 `73134b73-16d4-483f-b0a3-2588dc28f5c5`（update_mode replace）。

## 4. 踩坑与教训（编号沿用本地记忆）

- **坑① 空数据目录禁自动保存**：`canvas_load_workspace` 返回 null 时前端永久禁用本次会话自动保存（防覆盖保护，catch 里置 `S.current=true`）→ 服务端首启播种默认工作区（校验器只要求 activeCanvasId + 非空 canvases）。
- **坑② 工作区拆分格式**：前端把 nodes/edges/viewport 嵌在工作区 `canvases[]`，桌面 Rust 侧拆成 workspace.json + canvas-<id>.json；服务端保存拆分/加载合并，桌面数据目录可原样接入（双向兼容已验证）。
- **坑③ 进程健壮性**：无显式保存命令（1s 防抖 + autosaveIntervalSec 默认 10s 循环）；fire-and-forget 异步 handler 抛错成为 unhandledRejection 直接杀 Node 进程，必须兜底。另有 channel 查找器把字符串检查放在 object 检查之后的路由 bug。
- **坑④ plugin:http 三段 rid 协议**：`fetch(clientConfig)`→rid、`fetch_send(rid)`→`{status,statusText,url,headers,rid}`、`fetch_read_body(rid)`→字节+尾标志。**结束块必须为空**——官方 JS 绑定 `if (i === 1) { t.close(); return }` 先 close 再 return，flag=1 块的载荷被丢弃；载荷块一律 flag=0，裸 `[1]` 结束。违反即"响应非 JSON：200"（前端恰好丢掉每响应最后一块）。排查手法：逐层钩子（invoke/Response.text/手动 reader 对照），手动 reader 全量而 Response.text() 截断即此坑。
- **坑⑤ 服务端出站代理**：Node 内建 fetch 不认 `HTTPS_PROXY`；DNS 污染域名（api.openai.com 解析到 facebook/instagram 段假 IP）直连必挂。启动时 `setGlobalDispatcher(new EnvHttpProxyAgent())`。配对规则：npm undici@8 的 ProxyAgent 只能配 `undici.fetch`，Node 24 内建 fetch 拒绝 npm dispatcher（"invalid onRequestStart method"）。
- **坑⑥ 返回形状不全会崩面板**：`history_list` 漏 `dateKeys` → 面板 `r.dateKeys.map` 崩"Cannot read properties of undefined (reading 'map')"。方法论：复刻返回形状必须对照**面板 chunk 的实际消费代码**（宁可多给不可少给），只看调用点参数不够。工具 `tools/shape-audit.js`（wrapper→export 别名→chunk 本地名→调用点后 420 字符字段访问），扫出 4 处真实不匹配：comfyui_http_json/upload_image 缺 `body`（前端 `JSON.parse(result.body)`，缺它 ComfyUI 全链路挂）、history 条目缺小写 `filename`/`localPath`（normalizeEntry 读时归一化旧数据）、`list_download_media` 语义是"history 中 mediaType='download' 条目"而非独立文件列表、`scan_comfyui_workflow_dir` 缺 `category`/`coverPath`（image/video/audio 子目录分流 + covers/ 同名 png）。
- **坑⑦ 缩略图返回形状**：`history_resolve_thumbnail_path` 桌面返回**对象 `{path, generated}`**，返回裸字符串 → `r.path` undefined → `/bridge-file/undefined`。配套：桥内 `convertFileSrc` 对合成路径直通（/bridge-file/、/bridge-uploads/、/bridge-downloads/、/bridge-proxy、http(s)://、data:）。
- **坑⑧ 输入侧契约 data URL**：前端 `comfyui_upload_image` 的 `imageBase64` 传完整 data URL，桌面 Rust 剥前缀；服务端直接 `Buffer.from(整串,'base64')` 把 `dataimagepngbase64` 18 个合法字符解出 ~13 字节垃圾拼图前，ComfyUI LoadImage 报 `cannot identify image file`。字节级实锤：坏文件头 `75ab5a8a…` 与错误解码输出逐字节一致。修复 `^data:([^;,]*);base64,` 剥前缀 + mime 兜底。教训：契约核对要覆盖输入侧预处理。
- **坑⑨ Expose sidecar 契约**：`read_comfyui_expose_config` 返回 sidecar **文本**（前端 .trim()）、`write` 收 `{dir,fileName,content}` 写每工作流 `<fileName>.wanvas.json`（命名从 exe 的 `comfyui_workflow.rs` 字符串表挖出）、`stat_comfyui_expose_config`/`stat_comfyui_workflow_file` 返回 **modifiedMs 数字**；import/update/cover 桌面是内嵌文件对话框需桥拦截；scan 排除 *.wanvas.json，sidecar 随 rename/delete/move 生命周期。
- **坑⑩ 入口文件名绝不能改 + webview 缓存路径键控**：所有懒加载 chunk 硬编码 `import ... from "/assets/index-CdKjPrrn.js"`；改入口名（曾试 CdKjPrrn2/3/4）导致懒 chunk 加载时重新执行未打补丁的原始 bundle，React root 接管画布——"新 UI 闪一下→白屏→变回旧版"。且该 webview 的 HTTP 缓存连 `?v=` 查询串都忽略（按路径匹配）。正确解法：①补丁就地写原文件名；②import map 把路径重映射到 `/assets/wanvas-entry-<VER>.js` 别名；③index.html `no-store`+`Clear-Site-Data`；④改 CSS 才换文件名。
- **坑⑪ 1.2.4 历史契约**：①`history_add_from_asset/url` 必须返回**完整 entry 含 `id`**——1.2.4 前端拿 `result.id` 当写入确认，缺 id 判"历史记录未确认写入"→延迟持久化路径（outputDownloadPending）再写一遍，成对条目 size 相同 createdAt 差 9~10ms；服务端另按 sourceAssetId/(batchId+sourceUrl) 去重兜底。②面板删除在条目都有 localPath 时优先走 `delete_download_media({paths:[…]})` **复数数组**，旧实现只收 `{path}` 单数 → 静默返回 true，"删不掉"刷新复活；须连 entries.json 记录一并移除。方法论：面板同功能常有新旧两条调用路径，复刻要两条都对齐。
- **AI 助手供应商问题（非 bug）**：助手下拉只列"API 设置→编辑供应商→大语言模型 tab→勾选『用于在AI助手与文本节点调用』"的供应商，全未勾选只剩兜底"Codex（本地订阅）"；模型下拉在 modelIds 为空时 disabled。数据源 `wanvas-unified-api-providers` 的 `provider.aiAssistant`（`wanvas-assistant-storage` 只是再生缓存，直接改会被覆盖）。已配置 comfly（deepseek-v4-flash-vision-exp）+ OpenAI（gpt-4.1-mini）。
- **菜单钳制 bug**：菜单以光标为中心（`translateY(-50%)`），挂载只量一次高度，CSS/字体晚就绪按错误高度钳制底部溢出 → 补 ResizeObserver 尺寸变化重钳（top∈[8+h/2, vh-8-h/2]）。
- **E2E 合成事件技巧**：应用就绪门控使合成事件加载后 10-15s 内不被接受；新建菜单开启是 onPaneClick 里 **320ms 内两次 click 配对**（原生 dblclick 无效），须完整 Pointer 序列（pointerdown/up+mousedown/up+click）配对约 130ms；画布顶部约 150px 是透明 `canvas-topbar-drag` 遮挡区；React onMouseEnter 走 mouseover 委托；被合成事件折腾脏的页面 reload 恢复。
- **工具坑（反复出现）**：Git Bash MSYS 路径改写（`/tmp`、`/data/...`、`cmdkey /list` 被吃，用 `MSYS_NO_PATHCONV=1`）；`node -e` 正则/反斜杠/反引号在 bash 里转义地狱——一律用脚本文件；sed 批量替换损坏正则字符类（`[\w]`→`[w]`）；Write 工具偶发不落盘（ls 验证）；`node --check` 按 CommonJS 解析 ESM 报假阳性（拷成 .mjs 再查）；模板串当对象键（`` `aria-checked`: ``）是语法错误；Windows `path.normalize` 把 `/` 转 `\`，正则须 `[/\\]`；brotli 扫描 OOM（垃圾流解出 GB 级，`maxOutputLength:64MB` + `--max-old-space-size=16384` + best-buffer 复用）；npm undici 与 Node 24 内建 fetch 接口不匹配。
- **Git/部署通道坑**：ghfast.top 加速镜像（insteadOf 重写）导致 GCM 无该 host 凭据挂起 → 用户指示移除镜像后直连 github.com 凭据匹配成功；GitHub 整站被墙（TLS RST）时走 api.github.com 兜底推送；HexHub MCP 重启窗口期工具消失 → 直连 `http://127.0.0.1:17321/mcp` JSON-RPC 兜底（Bearer token 在 `~/.zcode/cli/config.json`）；`mcp__hexhub__shell` 30s 工具超时，docker build 服务器侧继续跑轮询 `docker ps`；HexHub 完全不可用时可 SSH 5522 直连替代；hindsight-team "Session not found" → 直连 `https://hindsight.950814.xyz:16666/mcp/team-shared` 新建会话兜底。
- **流程事故**：两次陷入浏览器工具空转循环（用户问"卡住了吗？""咋又卡住了"），教训是不发无意义填充调用，跳到下一个可验证步骤；MSI 差点误入 git 提交（git status 复核时拦下，reset + .gitignore）。

## 5. 未完成事项与用户明确的下一步意图

- 会话结束时（2026-11-03）**无明确未完成任务**：1.3 升级已上线（生产 roundtrip 验证通过、容器 healthy、代理配置保留、本地+hindsight 记忆已更新、GitHub main=`6dd7d23`）。
- 用户动作项（AI 交付时提出）：此前产生的重复历史条目需用户刷新后手动删除（删除功能已修好）。
- 已知限制（README 记载，未计划解决）：内嵌浏览器节点受目标站 X-Frame-Options 限制；图像引擎功能等价非逐像素一致；.wanvas 加密归档与桌面版互不识别；ComfyUI 托管启动容器内不可用（无 Python，用外部服务地址）；1.2.4/1.3 的 llamacpp 本地模型、Agent 技能库、MCP 桥、license 设备管理、应用更新器等桌面管理家族按"非 Tauri 环境"回退形状打桩，面板显示"不可用"（小说/漫剧工作台、风格库、comfyui_probe_port、system_stats_get 为真实现）。
- 既定运维模式：上游出新版 exe/MSI 后，用 `tools/` 参数化脚本链重新提取 → 动态推导补丁工具零改动重打 → shape-audit 对照新增命令 → 本地验证 → scp/git pull + `docker compose up -d --build` 部署 → 双侧记忆更新。
- 生产环境事实（后续排障要用）：地址 http://192.168.3.2:8899/；宿主机 8787 被 headroom 占用，curl 调试走 8899；服务器路径 /srv/data/wanvas-infinite；SSH 5522；ComfyUI http://192.168.3.66:8188；生产代理 http://192.168.3.66:7890（启用）。
