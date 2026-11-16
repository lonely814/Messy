# mayi（敲豆蚂蚁 / 桥豆麻衣酱）三会话提炼

来源：export/mayi-oss-smoke.md（2026-09-28，重写 oss-smoke.js）、export/mayi-robustness.md（2026-09-29，鲁棒性审查）、export/mayi-hindsight.md（2026-11-01~11-05，Hindsight 同步 + 连续 bundle 升级）。
项目目录 mayi（APP 目录下的仓库；APP 是符号链接别名，两个盘符同一目录），git 仓库 github.com/lonely814/mayi，main 分支。

## 1. 项目关键事实

### 技术栈与架构
- 定位：Tauri 桌面应用「桥豆麻衣酱 / qiaodoumayi」（React 无限画布 AI 生图/生视频 previz 应用）的 Web 移植。原桌面版源码永久丢失，前端 React bundle 以黑盒方式整体复用（从 exe 的 PE 段表提取嵌入资源），后端用零依赖 Node.js（node:http）按提取的 IPC 契约重写。
- 提取工具：`tools/extract-atelier.js`（`node tools/extract-atelier.js probe <exe>` / `all <exe> <outdir>`，PE 段表 + anchor 字符串定位 + 全量资源表扫描）。
- IPC 面扫描器：`tools/scan-ipc.js`（对 tauri-api chunk）、`tools/scan-invoke-sites.js`（静态 import 别名）、`tools/scan-invoke-dynamic.js`（动态 import + 解构，单体扫描器对这类全盲）。
- 契约文档：`docs/api-surface.json` / `docs/api-args.json` / `docs/api-contract.md`。服务端启动时 `server/src/handlers/stubs.js` 读 api-surface.json 的 literalCommands，给没有真 handler 的命令自动注册 not_implemented 桩。
- bundle 版本演进：V3.5.1（227 资源/226 命令，入口 index-DKttICfk.js）→ Atelier 1.0（439 资源/256 命令 323 调用点，入口 index-BFT_phOC.js）→ 1.0-10-10 → 1.1-10-19（264 命令）→ 1.1-10-31（代码分包：1194 条目 210MB，入口 7KB，invoke 集中在 tauri-api-CYqD1w83.js 的 `export{i}`，约 700 懒加载 chunk；契约 307 命令/397 调用点 = +19/−3 另补 27 个动态别名漏扫）→ 1.1-11-02（1209 条目，入口 index-CtzGyEuS.js，tauri-api-Ba4jWloo.js，契约 123=123 字面量零变化）→ 1.1-11-05（1174 条目，入口 index-DpdqvjeO.js——PE anchor 报的 index-dj6uhBqX.js 不准，**入口以 index.html 引用为准**，tauri-api D4g3yZTI，契约零变化，静态别名 +8 全部桌面门控）。photocraft_web_bg.wasm 约 35MB。

### 目录结构（本地仓库）
- `server/`：零依赖 Node 后端。`server/src/index.js`（入口，env 合并只填空字段）、`server/src/router.js`、`server/src/invoke.js`（POST /api/invoke 单端点分发 + settings 锁 + canvas 锁拦截）、`server/src/static.js`（静态/媒体服务 + 缓存层 + 桥注入）、`server/src/auth.js`、`server/src/workspace.js`、`server/src/trash.js`、`server/src/canvas-lock.js`、`server/src/settings-lock.js`、`server/src/outbound-proxy.js`、`server/src/libtv/jobs.js`、`server/src/handlers/{fs,db,proxy,oss,storage-mgmt,stubs}.js`。
- `web/`：桥接层。`web/tauri-bridge.js`（早期单文件，约 1700+ 行）后来拆成 `web/bridge/00-runtime.js` ~ `14-invoke.js` 片段，由 `web/build-bridge.js` 在镜像内重新生成。`injectWebUiTweaks()` 注册：installSettingsLock、installTrashPanel、installHistoryOrderToggle、installNetworkProxyPanel、installNodeDuplicateMenu、trackMenuNode、installGenerationRefresh、installOrbDock、installBuildBadge。
- `extracted/`：前端产物（运行时必需，约 154M→210M，models 92M + desktop-pets 13M 被 bundle 引用，保留）。`docs/`：IPC 契约。`tools/`：一次性提取/扫描脚本。`xfer/`：传输暂存（**2026-11-14 已按用户确认清理：旧 deploy tar/b64/op/hex/libtv 本地副本全删，仅剩 scan-invoke-dynamic.js 工具默认引用的两个 json + libtv-cli-skill 素材**）。`.backup-before-github/`（旧 exe + extracted-v3.5.1）**2026-11-14 用户确认已删**。
- 测试：`server/test/` 下 smoke、oss-smoke、settings-lock(12)、settings-lock-off(4)、canvas-lock(21)、trash(26)、db、body-limit(8)、storage-mgmt(43)、history-salvage(10)、static-cache(18) 等 13~14 组。

### 构建与部署
- 部署目标：内网服务器 192.168.3.2（容器 mayi-qdm-1，镜像 qdm-web:latest），宿主目录 /srv/data/mayi（**非 git 仓库**），线上经 http://192.168.3.2:8877 与公网反代 mayi.950814.xyz:16666。本机 LAN IP 192.168.3.66。
- 流程：本地打 tar（须含 server/src + web/bridge/ 片段 + extracted/ + docs）→ scp/HexHub 上传（scp_transfer 大包首次 sha256 不匹配 = 传输未完成，等待后重验）→ 远端跑测试 → `nohup docker compose up -d --build`（后台防 30s 超时；--force-recreate 可能容器名冲突需先 docker rm -f）→ curl 探针（首页 200 新入口 / tauri-api 200 / wasm 200 / invoke history_db_status / 徽章 __QDM_BUILD_TS__）。
- 关键坑：**web/ 与 extracted/ 都是构建时 COPY 进镜像，改任何前端桥文件必须 --build**；且 Dockerfile 在镜像内 `RUN node web/build-bridge.js` 从 web/bridge/ 片段重新生成——只传 tauri-bridge.js 产物会被旧片段覆盖回去。git 会把大文件（如 35.7MB wasm）判成 rename，`--diff-filter=AM` 打包会漏文件 → 打包清单必须含 rename 目标。
- HexHub MCP：本机 127.0.0.1:17321 由桌面应用 HexHub.exe 承载，进程没了要手动启动 exe 恢复；工具缺失 = 应用没跑。资产 R7E6F90A7 = 192.168.3.2:5522。
- compose：数据卷 bind mount `./data:/data`（宿主 /srv/data/mayi/data，属主 chown 1000:1000 给容器内 node 用户；/data/videos 曾因 root 属主导致生成视频写不进）；logging json-file max-size 20m max-file 3 + healthcheck（node -e，node:alpine 无 curl）；env 透传 QDM_PUBLIC_UID / QDM_GLOBAL_KEY / QDM_API_CONFIGS / QDM_SETTINGS_PASSWORD。
- **配置/密钥位置（只记位置不记值）**：服务器密钥全在 /srv/data/mayi/.env —— SESSION_SECRET、QDM_PUBLIC_UID（=u27a26612ca80，公共共享模式：所有设备匿名同工作区）、QDM_GLOBAL_KEY（全局 API key）、QDM_API_CONFIGS（按 id 合并的可选服务商配置）、QDM_SETTINGS_PASSWORD（设置锁密码）。本地仓库无 .env（.gitignore 兜底）。

### OSS / 存储配置
- OSS 冒烟测试的命令面：oss_put_object / oss_get_object / oss_list_objects / oss_put_object_from_url / oss_delete_object / cloudinary_upload / storage-s3 SigV4。服务端存储层 oss.js 有 100MB readCapped cap。
- 生成资产落盘：`data/workspaces/<uid>/data/` 下 assets/（原图，未传 subdir 时默认归档至此）、thumbnails/、local/（拖入素材）、videos/（生成视频）、uploads/、`project management/`（projects-index.json、project_xxx/{meta.json,payload.json}）、`.dbs/`（chat.json、history.json、manifest.json 等轻量库）、`localStorage/`（bundle 磁盘 localStorage）+ `data/lsSync/`（跨设备同步镜像，**不能与 bundle 磁盘 localStorage 同目录**，bundle 启动清理会删镜像文件）。
- 团队约定：测试统一走 http://192.168.3.2:8877（本地 8898 是开发沙箱）；浏览器测试标签页须及时关闭避免抢画布锁租约；secrets 绝不落日志或提交；SSRF 口 2026-10-01 用户拍板接受敞开（lucky 公网反代有账密）。

## 2. OSS 冒烟测试（会话 1 主体）

- 交接清单：重写 `server/test/oss-smoke.js`——spawn 服务（PORT=8791 + QDM_DATA_DIR 临时目录）→ register 拿 cookie → ①oss_put_object/oss_get_object 往返（字节、content_type、size 全比对）②oss_list_objects 含所写 key ③oss_put_object_from_url（以自身 /assets/index-DKttICfk.js 为源）④取回内容以 `var` 开头 ⑤cloudinary_upload 返回 URL ⑥带 cookie GET 该 URL 命中且字节一致 ⑦oss_delete_object 后 get 返回 not_found ⑧storage-s3 SigV4 单测——对 AWS 官方文档测试向量断言（canonical request 逐字符比对、哈希 7344ae5b…、最终签名 f0e8bdb8…；先用独立脚本复算确认向量值再写入，非循环自证）。
- 运行方式：`node test/smoke.js` → 12/12 ALL PASS（第 9 步标签 `cloudinary_admin_request -> not_implemented`）；`node test/oss-smoke.js` → 8 PASS（startup + register + ①~⑦，退出码 0）。
- 过程中唯一失败：断言写错——URL 里 userId 段（如 ue1739c008f23）位于 `/oss/` 和 key 之间，误查连续的 `/oss/smoke/cld-test.bin`；服务端行为正确，改断言后过。
- 同会话顺带：服务器部署修复（EACCES chown + .dockerignore 放行 docs + Dockerfile COPY docs）、Web 保存打通（桥 seed 缓存目录 /data + 补 13 个文件写命令）、公共共享模式、QDM_GLOBAL_KEY 注入、缩略图链路、新版 Atelier 1.0 迁移上线。

## 3. 鲁棒性审查结论（会话 2）

### 已验证并全部修复的问题（108 项测试全过后部署）
1. manifest 快照数组/map 错配（server/src/handlers/db.js）——前端送数组、原实现 Object.keys 存成索引键 → manifest_db_delete_ids 静默跳过、upsert 重复。修：两种形状都认，用 asset.id 做键。线上存量数据未坏（apply 路径没跑过），无需修数据。
2. 读操作重写整个 JSON 库（withDb/withIndex）——纯读也 load→stringify→写。修：stringify 前后比对，未变更直接返回。
3. ≥19MB 单文件 ECONNRESET——JSON body 25MB 上限 + req.destroy() 在 reject 之后。修：改为 PUT /workspace-file 流式直写磁盘（限 data/uploads/），JSON 上限 25→64MB，超限回 413 payload_too_large。实测 PUT 40MB→200。
4. 「浏览器下载」只拦截 plugin:fs|copy_file——bundle saveToDisk 走 plugin:fs|write_file 不被拦。修：browserDownloadWrite() 覆盖全部写命令形态（dataBase64/__bytesBase64/contents/body/chunks）。
5. 强制接管后心跳不重启（tauri-bridge.js）——接管分支没 startHeartbeat，45 秒后锁失效。修：补上 + .catch。
6. 上游无界缓冲——proxy.js 无大小上限（oss.js 有 100MB cap 模式已存在）、storage-s3.js 无 timeout（挂到浏览器 300s）、本地 /oss/ range 整文件 readFile。修：readCapped 放 router.js（oss/proxy 共用 100MB），S3 加 60s 超时（S3_TIMEOUT_MS）。**遗留低优先级：本地 /oss/ range 仍整文件读内存（视频实际走 /workspace-file 已流式），要动就是 createReadStream + start/end。**
7. 次要：compose 加日志上限 + healthcheck；测试退出码 127 噪音（process.exit() 触发 libuv 断言 → 改 process.exitCode）；settings-lock 保护路径曾写裸名而实际带 .json 后缀（形同虚设，已补）。
- 刻意不做（内网单用户）：登录限流、CSRF、错误信息泄露、CSP、unhandledRejection 守卫。

### 本会话修复的其他大项
- **跨设备设置同步**：应用全用原生 localStorage.getItem 读配置；bundle 自带磁盘 localStorage 只在值 ≥4096 字符时落盘且读回进内存包装层（应用不查）。修：服务端把工作区镜像值内联进桥脚本（bundle 第一次 getItem 前就位）+ 捕获变更写回；镜像放 data/lsSync（2026-10-09 补：不能与 bundle 磁盘目录同目录）；空值永不写回；哨兵 __QDMY_DISK_V1__ 绝不能当值写回。api_configs 和 api_providers_v1 也纳入（上限 64KB）。
- **历史记录排序**：sortTs 全 0（14 条实测），createdAt 字段不存在 → 排序恒等。修：有时间戳按时间排，全 0 时按插入顺序取反；history_db_query_page 加 order 参数；桥注入「排序：最新在下/最新在上」按钮，偏好 qiaodoumayi_history_order 跨设备同步。注意：历史面板只在打开时查询一次，tab/搜索是本地过滤，切换靠关开面板刷新。
- **桌宠图集损坏**：44/75 个 webp 带 3~4 字节垃圾前缀。根因 tools/extract-atelier.js 的 webp 判分 `out.slice(0,4) === 'RIFF'`（Buffer 与字符串严格比较恒 false）→ plausibility 恒 0 → 退化成"选最长解码结果"。修：`.toString('latin1')`；重提取 75 个 webp 0 损坏。
- **视频播放全链路**（多轮）：①manifest remoteUrl 是 file://canvas-import/<hash>.mp4（桌面路径）→ 读侧改写为 /data/<fileName>；②应用视频判定只认 .mp4 扩展名或路径含 /videos/ → 桥把 /data/local/*.mp4 改写 /data/videos/<名>，服务端 /workspace-file 对 videos/ 回退找 local/；③<video> src 被拼成 thumbnails/preview_local_<id>.jpg 海报帧（桌面按 ID 命名、web 按时间戳命名）→ 服务端对 preview_ 开头路径总做反查（manifest 是视频资产→返回视频；文件名尾 8 位兜底，实测资产 ID 尾比文件名尾多一个前缀字符）；④同一 URL 双消费方 → Accept 头分流（<img> 发 Accept: image/*，<video> 发 */*）：img 回海报帧、video 回视频字节；⑤/workspaces-file 此前 200 全量无 Range → 加 HTTP Range 206 支持（Accept-Ranges，video seek 才有效）；⑥28 个海报帧躺回收站（manifest_db_delete_ids 连带清理）批量恢复。
- **画布轻量外壳白名单**：UE 白名单只放行 data:image 小图/受管 blob/asset:/路径含字面 /thumbnails/ 的 http URL——convertFileSrc 曾把斜杠编码成 %2F 匹配不上 → 保留字面斜杠。最终分流规则：**只有 assets/ 原图走 /canvas-materials/images/ 前缀**（满足全屏查看器 $he 校验），缩略图和视频一律普通直链（历史面板 Yz 组件对"媒体主机" URL 直接不渲染）；服务端 /canvas-materials/* 路由等同 /workspace-file。
- **历史面板缩略图全空**：三层叠加——manifest_db_load_snapshot 返回对象而 bundle Bwr() 期望数组 [{id, fileName...}]（for...of 抛错静默失败）；记录里 payload 子对象优先于平级字段被读（只改外层 fileName 不够）；Yz 拒渲染 Xn 命中 URL。
- **局域网 IP 访问崩溃**：http://192.168.3.2:8877 非安全上下文，crypto.randomUUID（bundle 56 处）和 crypto.subtle（8 处 SHA-256）缺失 → 桥 installSecureContextShims()：randomUUID 用 crypto.getRandomValues 实现 UUID v4（修过自写 fmt 固定 4 字节产出 8-8-8-8-8 的 bug），SHA-256 纯 JS 实现对照 Node 验证；条件安装，HTTPS 下自动跳过。
- **聊天持久化**：多层根因——①chat_db_status 返回 {open,count} 而前端迁移守卫读 sessionCount → 每次启动判定库空 → chat_db_replace_all_sessions 用空 localStorage 覆盖服务器真数据（修：返回 sessionCount + 空列表拒绝覆盖非空库）；②chat_db_load_session_context 未实现 → 补实现（返回 {session:{...}, directory}）；③存储行格式 {id, role, sortTs, payload:<message>, contentPreview}，写入归一化只保留一层 payload（mergeRecords Object.assign 与 EPt 序列化叠加曾造 4 层嵌套），**读取接口必须 flatten 成 {id, role, content, files,...}**——渲染器 KBn 做 e.content.startsWith，拿到未展平行直接崩（"面板加载失败"）；④chat_db_upsert_sessions 仅 replaceMessages===true 时可覆盖 messages。E2E 验证 restored:true。
- **历史提示词"无提示词"**：记录存 promptFull/promptPreview，前端标题渲染读 item.prompt（设计为懒加载 sidecar）→ history_db_query_page 返回时补 prompt = promptFull || promptPreview（withPromptAlias，纯增量）。
- **历史视频栏不分栏**：记录存 itemType（值是节点类型 gen-video 等，bundle `itemType: n.type || "image"`），面板按 mediaType 过滤 → 不信任前端分类，用 manifest 真实 mimeType 纠正并返回 mediaType。
- **历史视频"壳记录"永久转圈**（49 条中 12 条）：生成开始建壳、下载失败后 isLocal=1 但无文件/assetId/海报；9 条远程 URL 已 404。修：12 条标 status:failed 保留提示词（备份 history.json.bak-1101-2338）+ db.js query_page 挂 scheduleVideoSalvage 后台抢救（活 URL 壳自动重下落盘 videos/salvage_video_<id>.mp4 + manifest + 行回填；6h 冷却、单并发；冷却戳只在真正尝试时盖）；新 bundle 自带海报自愈（MR/captureVideoPosterDataUrl）勿重复造。
- **生成完成后节点不自动显示**（部分未解）：真根因之一是应用 NodeRenderOptimizer 包装 window.fetch，并发 ≥3 冻结节点内容渲染（enableImageThumbnails:false），桌面版 invoke 走 IPC 不计入而 web 版每次 fetch('/api/invoke') 都计入 → 桥在最前保存原始 fetch（rawFetch），IPC 不计入流量统计（实测 6 并发 0 冻结）。另一层：节点显示 preview_<assetId> 缩略图而非 content，直接改节点数据 DOM 不动、选中才触发重解析；自动化无法产生应用认可的"选中"，最终修复（生成收尾命令成功后 250ms 派发 canvasActivity）未被证实有效，**用户接受"点选一下"的现状，该问题已封存**。期间一度怀疑粒子特效消失是回归，实测为暂时现象。
- **创建副本（右键菜单）**：PreviewContextMenu（生成结果缩略图右键，含 setNodes/setConnections/generateId）注入「创建副本」项（插在「保存到素材库」后）：复制节点（含提示词/设置/结果）+ 重建上游入边（下游故意不复制）；画布 store 不暴露 window，经 React root fiber（__reactContainer$）遍历取 {nodes, connections, setNodes, setConnections}，实测节点 13→14、连线 7→8。
- **设置锁**：QDM_SETTINGS_PASSWORD 存 /srv/data/mayi/.env（值不记录），双防线——桥捕获阶段拦「全局设置」按钮弹内联深色密码框（data-qdm-lock，Enter/Esc/遮罩，错误内联红字，成功自动重发 click）；服务端 invoke.js lockedWriteTarget 拦 10 个写命令对受保护路径（PROTECTED_SUFFIXES：localStorage/qiaodoumayi_api_configs.json、qiaodoumayi_api_providers_v1.json、qiaodoumayi_global_key、qiaodoumayi_global_base_url、Alibaba Cloud OSS/alibaba-cloud-oss-config.json）。8h HttpOnly 签名 cookie；未设密码完全惰性。测试 12/12 + 4/4。
- **回收站**：server/src/trash.js——RETENTION_DAYS 30，CONTENT_PREFIXES 白名单（project management/assets/videos/thumbnails/local/uploads/Memory/Screenwriting/Prompt words/Model list display），scratch 路径直接删；moveToTrash/listTrash/restoreTrash（拒绝覆盖→path_exists）/purgeTrash；plugin:fs|remove 与 manifest_db_delete_ids 改走回收站（修掉"删历史条目文件成孤儿"缺陷）；trash_list/trash_restore/trash_purge 命令；桥侧栏底部入口面板。测试 26/26。
- **画布独占锁**：server/src/canvas-lock.js——HEARTBEAT_MS 15s、TTL_MS 45s、模块级 leases Map；桥 acquire（payload.json 读时）、写请求带 X-QDM-Canvas-Id/Client-Id/Canvas-Token 头、只读遮罩（重新检测/强制接管）、sendBeacon 释放；服务端 canvasWriteTarget 对 /project management/ 路径的写命令强制校验，非持有者返回 canvas_locked。测试 21/21；后改版"写时取锁"（读不抢锁）。
- **出站代理**：server/src/outbound-proxy.js——零依赖 HTTP 代理客户端（HTTPS 走 CONNECT 隧道 + tls.connect，HTTP 走正向代理）；覆盖 proxy_fetch/下载落盘/OSS 拉取全部出站；坑：`http.request(绝对URL)` 会被 Node 直连目标完全绕过代理——必须把请求发给代理、path 用绝对 URL。配置存 qiaodoumayi_network_proxy 跨设备同步；UI 注入 React 设置面板两次失败（插导航旁挤坏布局 / React 周期删注入节点形成渲染循环）→ 最终改为独立面板（侧栏底部入口）。测试 outbound-proxy 9 项。
- **GitHub 推送**：github.com/lonely814/mayi main 分支；首次推送远端有占位 README，用 `git pull --rebase --allow-unrelated-histories` 接上；**教训：rebase 解冲突时 `--ours` 指上游（远端）不是自己**。.gitignore 加 .zcode/ tmp-*.js 等。仓库整理 412M→155M：两个 exe（95M+73M）+ extracted-v3.5.1（90M）移 .backup-before-github/；一次性脚本归 tools/；README 更新为 256 命令/323 调用点；.env.example 补 QDM_SETTINGS_PASSWORD。
- **模型切换"不能切"**：实测写入/持久化都正常，真根因是设计——`Ft = 官方渠道模式 && 当前会话已有非空消息` 时选择器禁用（tooltip："官方 DeepSeek 已开始对话，不能中途换模型，以免打断上下文缓存"）。A（保留规则+更明显提示）/B（桥解除限制）两方向待用户选择，**未定**。另：260 条 API 配置仅 19 条有 key，其中 Chat 类型仅 1 条（custom-7ee503aa… = combo/deepseek-flash），其余依赖全局 key。
- **误删事故（AI 责任，如实记录）**：验证跨设备同步时 localStorage.removeItem 触发写回空值清掉服务器镜像；后来又把 __QDMY_DISK_V1__ 哨兵当值写回覆盖 api_configs。已恢复平台用户 ID 62008/平台令牌/259 条模型配置；**永久丢失需用户重填**：平台分组令牌（2907 字符）、saved_api_keys（3178 字符）；快照在 data/recovery/localstorage-backup-*.json（82 键）。教训入私有库记忆。

## 4. Hindsight/后续会话（会话 3，弱画布相关的部分一笔带过）

- 主题是 Hindsight 记忆库同步检查 + 连续三次 bundle 升级。与画布项目直接相关的增量事实已并入上文（1.1-10-31/11-02/11-05 升级、storage-mgmt、视频壳、缓存层、全项目审查、时间戳徽章）。
- **全项目审查（commit 12eec78）修复 9 项**：①invoke 失败日志脱敏 argsSummary（/key|token|secret|password|apikey/i 字段 redact、>120 字符串记 <str:N>，密钥不再落 docker 日志）②static.js+db.js manifest 读取 mtime 门控缓存（热路径不再每 5s 同步 parse 435KB）③plugin:fs|write_text_file/write_file 改原子写（画布 autosave 防截断）④storage_cloud_page 直扫 sidecar 修 listObjects 硬上限 1000 的分页丢失 ⑤libtv staged 文件 try/finally 清理 ⑥salvage 冷却戳只在真正尝试时盖 ⑦桥 7 个全文档 MutationObserver 统一 qdmThrottled(200-300ms)+orb 位置写守卫（生成期间每帧全文档扫描→节流）⑧重复注释清理。查明不修：SSRF 口（用户拍板）、登录无限速（QDM_PUBLIC_UID 模式）、bridge no-cache 无 ETag、bytesToBase64 内存峰值、compose 卷写法、storage.js 全量扫 sidecar。
- **响应缓存层（commit 495d602）**：ETag/304 条件请求（304 只在无 Range 时走）；分路径 Cache-Control——bundle 分包（/assets/* vite 哈希名）1 年 immutable、缩略图/视频/本地素材 7 天 + Vary: Accept（同一 URL 双消费方分开缓存）、记录文件 no-cache+304；文本 gzip（公网文本快约 4 倍）。坑：rangeHeaders 无条件 Content-Length=原始大小，gzip 流更短→客户端永远等；gzip 绕 sendRangeOrFull 且必须发 Content-Encoding。static-cache 18 项测试。
- **构建时间戳徽章（commit 5054465 + d5ac57f）**：用户要求"每次修改或更新把时间戳标在与帮助按钮同一行高度的右上角"。__QDM_BUILD_TS__ 由 static.js buildBridgeScript 按桥文件 mtime 注入（每次部署重建镜像自动更新）；web/bridge/06-ui-bootstrap.js installBuildBadge() 渲染固定 right:8px 徽章，与 .desktop-titlebar-menu-btn 垂直居中对齐。坑：buildBridgeScript 是模块级函数而 bridgeFile 在 handler 闭包内，ReferenceError 被 catch 静默吞 → 改传参 mtimeMs。时间戳注入不放 build-bridge.js（保持字节确定性，--check 不受影响）。
- **Hindsight 记忆库状态**：本项目事实按 AGENTS.md 规则同步——团队库（hindsight-team，tag project:mayi）存架构/部署/功能/踩坑（document_id 如 project:mayi:build-badge、project:mayi:bundle-1102、project:mayi:bundle-1105、project:mayi:status）；私有库存两次数据损失事故教训。期间遭遇 Session not found（会话过期）→ MCP 断连（68 工具消失）→ 用户重启恢复后补齐；sync_retain 有 30s 硬顶超时（超时即失败，改用异步 retain）。**教训：recall 有增量就停——曾在冒烟阶段连发 10+ 次无意义检索陷入循环，被用户两次打断（"刚刚陷入循环了"/"又循环了 继续"），最终用户指示"浏览器渲染冒烟跳过吧 直接写新记忆"。**
- 本地记忆文件（持久备份）：`~/.zcode/cli/memories/projects/mayi-17aab5761ddd87f1/memory/` 下 MEMORY.md（索引）、qiaodoumayi-re-analysis.md（项目状态主文件）、localstorage-cross-device-sync.md、robustness-review.md、session-degradation-protocol.md、code-review-2026-10-01.md。
- 会话退化协议（本地记忆要点）：长会话后期大块生成会混幻觉、元叙述不可信，以执行+布尔探针为准；"Payload Too Large"（body 展开 2.25MB/1347 条）是致命临界点。本导出会话中 AI 曾凭空捏造"视频生成失败/整除错误"任务排查数轮被用户拉回——教训：严格以用户最近一条消息为准，发现处理没人报过的问题立即停手。

## 5. 踩坑与教训（跨会话汇总）

- 部署四坑：改前端必须 --build；tar 必须带 web/bridge/ 片段（镜像内重生成）；git rename 判定会漏打包大文件；scp 大包 sha256 首次不匹配=还没传完。
- 桥接层改造原则：bundle 零改动，一切注入走桥（CSS 隐藏、seed localStorage、命令拦截、URL 改写）；React 管理的 DOM 里没有注入节点的稳定立足点（重渲染会删），注入 UI 一律用独立面板/入口。
- 改一个 URL 前先想它有几个消费方（preview_local_<id>.jpg 同时喂 <video src> 和缩略图 <img>，单改一头必坏另一头）。
- 清 localStorage 不是只读操作——会触发写回空值毁数据；空值永不写回；__QDMY_DISK_V1__ 哨兵不是值。
- curl -o /dev/null 只测连通性不算验证；"HTTP 200 不代表文件可用"（wasm 404、jpg 当视频、webp 垃圾前缀均 200）。
- Node：`http.request(绝对URL)` 绕过正向代理；Buffer 与字符串严格比较恒 false；process.exit() 触发 libuv 断言（用 process.exitCode）；gzip 的 Content-Length 必须是压缩后长度。
- git：rebase 中 --ours 指上游；Windows 下 git autocrlf 会把提取产物 CRLF/LF 弄出大 diff（根治可给 extracted/** 加 -text）。
- 行为纪律：只读审查先行、不猜菜单/结构（要用户 10 秒抓 DOM 输出）、不捏造用户没报的问题、recall 有增量就停。

## 6. 未完成事项与用户明确的下一步意图

- **模型切换规则 A/B 未决**：保留"官方渠道已开始对话禁止换模型"设计（仅把提示做明显）还是桥解除限制（代价：打断上下文缓存），等用户选；并需验证"全新无消息对话"是否也切不了（若是才是真 bug）。
- **本地 /oss/ Range 流式读**：低优先级遗留（createReadStream + start/end，Range 解析现成）。
- **条目 2 本地模型 local_models_\***（长期待办）：ComfyUI 放用户局域网设备、地址可配、媒体回程走服务端。
- **12 条 failed 视频壳行**：已标失败保留提示词，是否直接删除等用户答复。
- **tmp-scan.js / tmp-scan2.js**（仓库根目录调查残留）待删。
- **误删待用户重填**：平台分组令牌、saved_api_keys（若别处有副本可按 data/recovery/localstorage-backup-*.json 比对写回）。
- GitHub 已就绪（.gitignore、155M、git init 已完成且多次推送），后续改动直接 add/commit/push；.backup-before-github/ 确认后可 rm -rf。服务器上留有测试账号（deployck_9f2、verify_9k1）与误建的空画布 project_1790666884120_61j8tdev，可删（现删会进回收站）。
- 大量"稍后可做"的小项（AI 提出未被要求）：draw 打包/ffmpeg 服务器安装（若用视频剪辑）、Codex 聊天命令实现（需外部 Codex 服务）、公网加 Basic Auth 门槛。


---

# mayi（桥豆麻衣酱）+ libtv-boost 会话事实提炼

来源：ZCode 工作区 export/ 目录下 12 个会话导出（[USER]=用户原话，权重最高）。提炼日期 2026-11-05。本文不记录任何密钥/token 值。

---

## 一、逐会话结论

### 1. mayi-reverse（sess_3e141543，2026-09-28，逆向桥豆麻衣酱 exe 做二次开发）
- 逆向对象 `桥豆麻衣酱_V.3.5.1-09-10.exe`（76MB）。技术栈实证：**Tauri 2.9.5（Rust）+ WebView2 + Vite/React 前端**，插件 fs 2.4.5 / http 2.5.6 / dialog 2.6.0 / log 2.8.0，内嵌 axum 0.7.9 本地桥接服务（给 Codex 等 agent 用，带 token、forbiddenTools），应用标识 `com.qiaodoumayi.studio`，七牛云 S3、ffmpeg、image 0.25.9、构建者 `zxyew`。
- 内嵌资源：`.rdata` 段 phf 资源表（锚点 0x459edb8，条目结构 32 字节 `[key_ptr, key_len, val_ptr, val_len]`），**227 个资源全部提取成功（54.3MB）**，raw DEFLATE 解压，落 `extracted/`；分析脚本 `analyze.js`/`extract.js`。前端 9.2MB JS bundle，minified 但无混淆无字符串加密。
- 二次开发三路线：A 重打包（否决）、B 官方本地桥接 API（推荐）、C 同栈重建。用户后来表态有源码授权，随后又说 **"原作者代码也丢失了 找不回来"** → 走提取产物重建路线。
- Docker web 版：Tauri 依赖 WebView2 不可容器化 → 前端黑盒上 nginx + `tauri-bridge.js` shim 把 `fr()/__TAURI_INTERNALS__.invoke` 映射到 `POST /api/invoke`，后端 Node 重写（本机无 cargo/docker，选 Node 可验证）。
- API 契约：`fr()` 是唯一 IPC 封装（全 bundle 仅 1 处 `window.__TAURI_INTERNALS__.invoke`，偏移 12525）；**281 个调用点 = 226 个唯一命令**（275 字面量 + 5 插件模板 + 1 封装定义），三重验证后落 `docs/api-surface.json` / `docs/api-args.json` / `docs/api-contract.md`。早期报的"231 个命令"作废。
- 后端骨架：零 npm 依赖（纯 node:http），226 命令 = 70 真实现（fs 13 + 全部 51 个 `*_db_*` + 6 个服务端 fetch 代理）+ 156 明确桩（not_implemented）；认证 scrypt+HMAC HttpOnly cookie；冒烟 12/12。Docker：node:22-alpine、SESSION_SECRET 强制 env 注入。
- 用户部署 `http://192.168.3.2:8877/`，数据位置 `/srv/data/mayi`，测了可用。用户要求：图像缓存/项目保存全在服务器本地或自部署桶；compose 卷改 bind mount `- /srv/data/mayi/data:/data`。
- OSS 解释（重要架构事实）：原版 OSS 是 **BYO 桶**（用户在设置里填自己的七牛/Cloudinary 凭据），作用是 ① 结果 URL 临时、转存做持久副本 ② 内容哈希去重（`oss_index_db`、`upload_dedup_v1`）③ 跨设备中立副本层。桌面端本地缓存+素材索引配套。
- 本会话后期模型输出持续劣化（大块生成混幻觉、伪造工具输出、元叙述自相矛盾），确立"会话退化协议"：只信单一目的小命令、布尔探针、执行结果；大文件生成交子代理+事后独立验证。会话结束于用户要求在目录下写交接文档。
- 教训：`oss-smoke.js` 注释里 `oss_*/cloudinary_*` 的 `*/` 提前闭合块注释（出现两次同类事故）；APP 目录是符号链接别名（两个盘符同一目录），用户明说别纠结。
- 存储层三件套（storage.js 本地默认 + storage-s3.js 零依赖 SigV4 + handlers/oss.js 13 个真实现）已写好并接线但**缺端到端测试执行**（oss-smoke.js 被写坏又删掉）。

### 2. mayi-thumb-bug（sess_a5589219，2026-10-01，缩略图不刷新排查）
- 根因链（最终定论）：生成完成后节点 `content` 字段存**远程结果 URL**；媒体组件渲染期做"远程→本地"异步本地化，落地后**无任何重渲染通知**；应用自带恢复回调只在"canvas 忙→闲"迁移时触发；点选节点会把 `render-quality-low` 翻成 `render-quality-high` 使解析 effect 重跑——这就是"点一下就好"的机制本体。
- 修复尝试：① commit `d628420` 阶梯催绘（canvasActivity 250ms/1.2s/3s/6s/12s）——用户实测仍要点一下；② commit `196bbed` 监听 `canvasNodeGeneratingVisual` 后程序化合成 pointer 点选刚完成节点——本地验证通过但引发新症状（输入框闪、放大按钮消失、双击大图不出）。
- 用户最终拍板："还是不行 算了就先这样用吧" → **封存**。排除了 NodeRenderOptimizer 冻结和 `lazyContentMemoryRelease` 事件两条嫌疑。附带产物 `tools/fake-image-api.js`（伪造 OpenAI 兼容生图 API + 可调延迟，零成本复现生成链路）。

### 3. mayi-code-review1（sess_026f8a9d，2026-10-01，整理评估项目代码）
- 基线：自写代码 ~9.4K 行（server 2.9K + bridge 2.3K + tests 1.8K + tools 1.1K），零 npm 依赖，9 组 118 项测试全过；269 注册命令中 153 桩（256 契约命令内）。
- 修复（commit `63a1dfd`，10 组 155 测试）：P0-2 SSRF 拦私网（`outbound-proxy.js` 加 `resolveSafeHost`/`assertPublicHost`，拦 10/127/169.254/172.16-31/192.168/224+/0 段 + DNS 全地址校验，测试旁路 env `QDM_SSRF_ALLOW_PRIVATE=1`）；P0-1 `/oss/` 流式（storage.js `statObject` + static.js createReadStream，Range 206/416）；P1-3 读放大（`withDb` readOnly 跳过 stringify diff + manifestMediaTypes 5s 缓存）；P2 桩日志降噪。
- 用户报 4 个新症状 → 根因全是 `196bbed` 合成点选写死视口坐标 `(8,8)` 命中顶部标题栏菜单（`#canvas-bg` 实际在 (246,35)）。修复 `5e63a83`（候选空白点 + elementFromPoint 验证 + 焦点保护）。用户仍不满 → **回滚 d628420+196bbed（commit `c557b30`）**，桥回到单次 250ms 催绘。
- 双击大图模糊根因：web 端无 Rust 图像管线，bundle 浏览器 canvas 把预览降采样到 512×288（357KB），查看器与缩略图共用 preview URL。修复 `f9a5e64`（`resolvePosterAlias` 对 `preview_<id>` 优先取原资产记录返回原图字节，curl 验证 512→3,277,275 字节）。
- 用户"头都大了" → **main 硬回滚到 `89e5bf8`（右键创建副本版本），定为稳定基线**；当前代码推备份分支 `backup/after-duplicate-20261001`。SSRF 修复随回滚重新敞开。
- 部署环境事实：服务器 SSH 端口 5522（HexHub「新服务器」资产）；容器 `mayi-qdm-1`（8877→8787）；公网 `mayi.950814.xyz:16666` 走 lucky 反代（管理后台 192.168.3.2:16601），502 是 lucky 规则问题、用户自己管；192.168.3.x 是服务器所在网段，192.168.31.x 是用户家网段（AI 曾搞混被纠正）。
- 用户明确：测试只在 `http://192.168.3.2:8877/` 做，别在本地验证。QDM_PUBLIC_UID 共享模式 = 所有人同一工作区，画布独占锁防互踩。

### 4. mayi-code-review2（sess_9b38b5a7，2026-10-02，评估项目整体）
- 基线 `89e5bf8`：9 组 133 测试全过（smoke 20 / oss 8 / settings-lock 12+4 / canvas-lock 21 / trash 26 / db 25 / body-limit 8 / outbound-proxy 9）。契约 256 命令、registry 269、真实现 103、桩 153。自制四件：跨设备设置同步、回收站 30 天、画布独占锁（心跳 15s/TTL 45s）、出站 HTTP 代理（手写 CONNECT）。
- AI 独立新发现（记忆里没有的）：设置锁三处旁路（`plugin:fs|rename`/`copy_file` 不在锁表、`remove` 可拖进回收站、`write_base64_to_file` 路径在 `args.params.path`）；注册口敞开无速率限制；会话 token 无服务端吊销表；`/workspace-file` 无归属检查；资产别名 8 字符 includes 猜文件名会串片；画布自动保存 `write_text_file` 非原子写（半截 JSON 风险）；`download_url_to_local_asset` 收 200MB Buffer 进内存（fs.js:385，比 /oss/ 先爆）；测试只证明翻译层不证明产品。
- 实施 3 件（SSRF 从 backup 摘 + 设置锁补旁路 + 画布原子写，155 测试全过），base64/十六进制分段传文件部署后 → **用户"回退下吧 缩略图问题又出现了 就在这些修改中导致得"** → 全部退回。教训：三件改动绑一次重建分不出凶手；结论"出站拦截会拦掉生成结果回程"。
- 会话内用户确认："验证了 的确就是这次修改中导致得"。

### 5. mayi-code-review3（sess_ffc1a965，2026-10-03，评估功能性/稳定性/性能）
- 只评估不改动。136 测试全过、health 5ms。功能性 ★★★★、稳定性 ★★★☆、性能 ★★★。
- 核心建议：cherry-pick `63a1dfd` 的 server 部分（SSRF + db 免 diff + 流式出盘 + mime 缓存）——当初回滚是为桥 UX 问题，纯 server 修复属误伤；静态 hash 素材改 immutable 缓存；缩略图刷新继续封存。
- 生产实测：近 48h invoke 11,090 次、平均 16ms、慢命令 0.55% 全是 proxy_fetch 上游延迟、db/文件类 0 次慢、容器内存 26MB、oss 对象 0 个。

### 6. mayi-deadcode（sess_f5164e03，2026-10-03，死代码清单）
- 结论：项目很干净。A 类死代码约 25 行（`storage.js:166 currentBackend`、`settings-lock.js:18,201 COOKIE_NAME`、`index.js:170 module.exports`、`router.js:169-178` 死导出、`trash.js:246 RETENTION_DAYS`、`canvas-lock.js:210-222 publicState`、`notImplemented` 双份、`fs.js:53-59 decompactProjectPayload` 恒等函数）；B 类小重复 5 组（err() 三胞胎、unwrap 三份、写命令清单、`download_file_bypass_cors`≡`fetch_remote_image_bytes`、db 三对同体 lambda）。
- 刻意不动：tmp+rename 原子写 7 处独立实现（违背"不混改"约定）、`timingSafeEq` 两种实现、海报/资产别名双胞胎。
- **用户拍板："其实挺干净哈 那没必要清理了吧" → 一个字节没动**。116 注册命令 × bundle 比对 = 0 死命令；桥 16 片段 100 函数全有引用。
- 重要约束（**已过时**：xfer/ 素材 2026-11-14 经用户确认清理，fs.js 原子写已由 12eec78 落地）：`tmp-scan.js` 可删；Dockerfile `COPY docs docs` 可瘦身 ~360KB（运行时只读 docs/api-surface.json）。
- 本会话后半段连做三件事（均已部署）：① 个人记忆面板样式错乱 → 根因是 Atelier 1.0 桌面构建本身漏了面板 CSS（`extracted/assets/index-DB04Eflo.css` 只有 1 条规则，v3.5.1 备份 CSS 里有 296 条）→ 修法 `web/bridge/140-memory-panel-css.js` 注入 33.7KB 规则段（commit `4d06181`，新 bundle 后已删除）；② 桌面端/服务端返回形状全面扫查 → 2 个真 MISMATCH（`project_memory_db_get_state` 返回包装但 bundle 读裸 payload 字段 → 项目记忆恢复静默失效；`qiniu_put_object_from_url` 只回 remoteUrl 但 bundle 认 publicUrl）+ saveAssetRecord 补 fileName（commit `7e9e712`）；③ 桌面残留清理五件套（commit `bbba356`）：`plugin:opener|open_url` 拦截 → window.open、CSS 隐藏标题栏窗口控制、非 `qiaodoumayi_` 前缀 LS 键纳入同步（include 名单：modelSettings、selectedImageModel/selectedVideoModel、global*Defaults、pose_reference_*、studio-*）、`file://canvas-import/...` 写侧归一（history_db_upsert/manifest_db_upsert_assets 落库前改写）、MutationObserver 隐藏"在文件夹中显示"等菜单项。

### 7. mayi-export-backup（sess_5af5a86b，2026-10-09，导出画布/二次备份）
- 先误判"没有导出功能"（只扫了服务端命令），用户纠正后确认：**导出存在且纯前端**——bundle `useProjectIO`（`extracted/assets/index-BFT_phOC.js` 约 @7537994–7566423）用 JSZip 打 `<项目名>_<时间戳>.zip`（项目 JSON + 素材字节），入口在左侧工具栏「导出项目」，可仅导出选中节点。
- web 版差异：`window.showSaveFilePicker` 需 HTTPS/localhost 安全上下文，HTTP 下回退锚点下载；素材字节从本地缓存读，未缓存资源提示"保存完成（ZIP，部分资源未缓存）"。
- 卷备份方案：画布全部数据 = `qdm-data` 卷内纯 JSON+文件（`workspaces/<uid>/data/localStorage/*.json`、`.dbs/*.json`、`oss/`、回收站），`docker run --rm -v qdm-data:/data -v /root/backup:/backup alpine tar czf ...` 即完整备份；若 `STORAGE_BACKEND=s3` 桶需单独备。

### 8. mayi-balance-bug（sess_38c0e4b1，2026-10-09，换电脑后余额不可见）
- 根因（实测复现，页面启动 1 秒内 5 个镜像文件被删）：跨设备同步镜像写在 `data/localStorage/<key>.json`，而 bundle 自己的"磁盘 localStorage"（浏览器配额溢出层）把同一目录当私有存储——启动时 `migrateAndHydrateDiskLocalStorage` 把该目录所有 `<key>.json` 标记为磁盘键，之后任何 `setItem`/`removeItem` 走 `zst → removeDiskLocalStorageEntry` 删除文件；`global_key`/`global_base_url` 这类极少变动的键被删后永远回不来。
- 修复（commit `c3750db`，7 文件）：同步镜像搬 `data/lsSync/`（bundle 独占 `data/localStorage/`）；读侧取两处较新者 + 自愈回写；设置锁 `PROTECTED_SUFFIXES` 补 lsSync 形式；出站代理配置读新位置带旧路径回退。
- 坑：lsSync 目录属主必须是容器用户（uid=1000=lonely），root 建目录会让写回静默失败。
- 恢复值：`global_key` 曾被探测写成测试串、`global_base_url` 已丢，均按 `.env` 与原值补回（值本身不入记忆）。备份：服务器 `/tmp/localStorage-backup-1009-1409.tgz`、`/tmp/mayi-code-backup-1009-1536.tgz`。
- 本会话后半段 UI 改造：侧边栏压缩（底部 5 项 197px→一行 49px、导航 250px→两列 136px，commit `6107648`）；画布工具栏 + AI 对话球按 LibTV 参考站 1:1 搬运（从 liblib.tv 页面直接读计算样式：面板 #262626、边框 #363636、圆角 12px、+块白 90%、球 28px radial-gradient #00ffc1→#007dff，毛玻璃保留 rgba(38,38,38,.72)+blur(20px)，commit `9223075`）；新建节点菜单照抄（16px 圆角/6px 内距/条目 36px 等，commit `ba9a367`）。

### 9. mayi-video-history（sess_beab2283，2026-10-09，视频历史归类）
- 根因：历史读出口形状与 bundle 消费侧不匹配。bundle 面板 tab/角标/拖拽全按扁平 item 的 `type` 过滤；写侧 `Jwr()` 造的行是 `{id, payload:<item>, itemType:n.type||"image"}`；服务端 `history_db_query_page`/`get_by_id` 没拍平 payload（chat 侧有 `flattenMessageRow` 同款先例，history 漏了）；9/30 的 `76d1723` 修复盖了 `mediaType` 字段但 bundle 无人读它，且 `recordMediaType` 回退链不看 `payload.type`，OSS 路径视频条目 `_assetId` 被清 → 回退 image。
- 修复（commit `dca700c`）：读侧拍平 + 权威 type 判定序 = manifest mime（model/* 归 3d）→ URL 嗅探（videoPosterUrl、/videos/、mp4/webm/mov）→ 自述字段 → image 兜底。db 测试新增 7 例，线上实测 5 条生成视频归位、60 条图片不受影响。
- 部署插曲：HexHub MCP 挂（fetch failed 重试 6 次）、直连 SSH 5522 公钥认证被拒（本机无服务器认的私钥）；**SSH 主机密钥已更换**，known_hosts 备份为 `known_hosts.bak-20261010`，AI 建议用户核实（局域网服务器重装是合理解释但无法带外验证）——此项待用户核实。

### 10. mayi-newversion（sess_21b494e4，2026-10-10 起，新版 exe 拆解合并）
- 17 条更新公告拆解：11 条换 bundle 白拿（纯前端）、3 条要后端跟进（1 Harness 删除、4 OSS 备份、15 OSS 保存 Project——后来证实 chat_db/oss_index 族旧契约已有，换 bundle 即生效）、条目 2 本地模型（ComfyUI）桌面专属需决策、条目 17 内置浏览器用户拍板放弃（已有代理功能）。
- 批 1（commit `4d47b0a`）：整套 10-10 bundle 替换（440 条目，新入口 `index-D8OBaPwq.js` 16MB，新 CSS 1.28MB 带 297 条记忆面板规则 → **删除 34KB 的 140-memory-panel-css.js 注入**）；契约 delta 仅 +4/−15；桥补拦 `plugin:opener|open_path`；两处测试硬编码旧 bundle 文件名改动态解析。
- 后续 UI 收尾：撤工具栏/新建节点菜单样式注入、AI 对话球保留、网络代理+回收站挪进个人菜单悬浮面板 `div.studio-profile-menu`（MutationObserver 注入行、Escape 关菜单、行序固定 网络代理→回收站、菜单贴底锚定 `top:auto;bottom:12px!important`；commits `f478d11`/`92b0cca`/`7ad6a3b`）。
- "圆角比例不对"误会：主题系统按主题给圆角（`--studio-design-radius` 由 JS 注入；原始14/纸感16/极简8/霓虹赛博6/黑胶音乐20），web 在霓虹赛博、桌面在黑胶音乐，不是 CSS 坏。CSS 完整性验证过（1,310,938 字符、括号 11260/11260 平衡）。
- 协作锁修复（commit `c8b587c`）：首页项目卡片封面钩子读 `payload.json` 被旧锁当成"正在编辑"抢租约 → 改成**只有写画布状态文件（payload.json/meta.json/autosave-patch.json）才取锁**，读永不取；`.thumbnails/`、`assets/` 派生缓存写不取锁；撤"只读时所有命令抛错"。
- 1.1-10-19 升级（commit `3f04d53`）：新入口 `index-CAbaShwc.js`（38MB）、契约 +20/−1、新实现 `production_state_db_get`、系统托盘桩成 false。三个新面暂不实现：素材搜索（material_search_* ×9）、媒体下载器（yt-dlp，media_download_*）、画布连接器/MCP（canvas_mcp_*，建议放弃）。
- 待办：**条目 2 本地模型 local_models_*/local_llm_* + ping_local_server**——用户明确 ComfyUI 放服务器外的同局域网设备、地址可配（不是装在服务器上）；媒体回程走服务端取字节落 workspace；卡在用户没给设备地址和模型/工作流情况。exe 自带 `canvas-local-package.json` + 便携 CompyUI（flux-2-klein gguf + qwen_3_8b）。

### 11. mayi-ltvbridge（sess_66728a10，2026-10-13，LibTV 桥接）
- 需求：把 LibTV 云端模型当 mayi 生成后端用（用户选方案 A，非画布同步）。素材包 `libtv-cli-skill.zip`（官方 CLI 1.1.3 的 agent skill 文档）解压在 `xfer/libtv-cli-skill/`。
- 架构（commit `9dd9143`，`docs/libtv-bridge.md`）：服务端 `/libtv-api/*` shim（`server/src/libtv/`）把生成请求翻译成官方 `libtv` CLI 调用（upload 建素材节点 → `node create … --run` 阻塞到终态 → 收割结果 URL → app 自己的 `download_url_to_local_asset` 回程落 workspace）；LibTV 模型以"自定义 HTTP"（customProtocol + 异步 poll）身份进 api_configs，**零 bundle 改动**；端点 status/login（手机验证码两步）/models/generate/poll/file 全挂登录态；生成参数除 model/prompt/images 外透传 `-s key=value`；job 状态在服务端内存、默认 20 分钟超时。
- CLI 二进制是 glibc 动态链接 → Dockerfile 基底 alpine 换 `node:22-slim`，libtv 1.1.3 烘进镜像。
- install 端点把「LibTV」服务商 + 预配模型写进 lsSync 镜像；首批装 7 模型：Lib Image 2.5 Pro（`lib-image-2.5-s`）、General image Pro（`nebula-ultra`）、Seedream 5.0 Pro（`doubao-seedream-5-0-pro`）、Qwen image 3.0（`qwen-image-3`）、Seedance 2.5（`star-video2.5`）、Wan 3.0（`wanx3.0`）、Minimax H3（`MiniMax-Hailuo-H3`）。
- 连环坑（全部修复并有测试）：① `qiaodoumayi_api_providers_v1` 写 80KB pretty JSON 超 `readLocalStorageSync` 的 `LS_MAX_CHARS=65536` 上限被整体丢弃 → 改紧凑 JSON（55,897B）；② app 校验模型 ID 不含空白，`modelName` 放显示名报错 → 改 key/显示名分离（provider=显示名、modelName=无空白 key，shim 侧还原）；③ 参考图 `referenceMode:"url"` 触发图床配置要求 → 改 `dataUrl` 内联 base64，shim 请求体上限 1MB→64MB；④ LibTV 画布 UUID 是 32 位无连字符 hex（`{"projectMeta":{"uuid":...}}`）→ 双格式正则；⑤ `libtv model <key>` 是回显查询词，显示名要从 `model search` 结果取；⑥ 临时文件 `.bin` 后缀 CLI 拒媒体类型 → 按 mime 推断扩展名 + 显式 `--type`；⑦ 接参考图平台要求 `params.modeType=image2image`；⑧ 1×1 微型测试图触发平台审核服务 unmarshal 错（平台怪癖）；⑨ **30001"账号状态已切换"真因 = 画布空间与账户作用域错配**（scratch 画布 `--team-id 0` 建在个人空间、活跃作用域是团队）→ scratch 画布按当前作用域建 + config 按账户分键缓存；⑩ install 双写（lsSync + bundle 的 data/localStorage）并按并集合并防分叉丢条目。
- 端到端验证：文生图个人作用域与团队作用域（teamId 24841 画布）都真实出图成功；图生图链路走通到平台建任务。个人账户曾报"算力不足"。用户"我发现好像不能设置参数" → 参数控件是"请求模板含占位符才渲染" → 模板补 `$quality/$count/$background/$size/$duration` 占位符 + 真实 schema 枚举（图片：比例 13 种/清晰度 1K/2K/4K/画质五档/背景；视频：比例/480P-1080P/时长 5/10/20/30s，"5s"→5 归一），commit `2ef8deb`。引用型参数（风格模板、镜头）未接。
- 记忆中的最终状态（MEMORY.md）：现行 main=`a07ca77`（LibTV 桥接 /libtv-api/* 端到端已验证）；当前活跃作用域=团队 3893841。

### 12. ltvboost-pet（sess_36f6eced，2026-10-12 起，libtv-boost 桌宠 + 后续功能）
- 项目：`~/Documents/Messy/libtv-boost`，油猴脚本（Tampermonkey）增强 liblib.tv 画布。结构：`src/main.js`（GM 沙盒）+ `src/inject.js`（页面上下文，~3300 行）+ `src/style.css`，零依赖 `build.js` 拼接出 `libtv-boost.user.js`，`VERSION` 常量单源，`__VERSION__`/`__LT_VER__` 占位符。纪律：每修一版即 `node --check` + `node build.js` + commit `libtv-boost <ver>: <desc>`。
- 桌宠 v1.15.0（commit `8523df6`）：**直接照搬 mayi 的「Codex 桌宠」**（用户："能用直接用 少造轮子"）。格式 = `pet.json` + `spritesheet.webp|png`，8 列固定网格，v1=9 行 / v2=11 行（行 9-10 = 16 向视线），9 动作条 row0-8：idle(6帧/7fps)、running-right(8/12)、running-left(8/12)、waving(4/8)、jumping(5/10)、failed(8/8)、waiting(6/7)、running=思考(6/8)、review=完成(6/7)；版本判定按宽高比（v1 基准 1536×1872 / v2 基准 1536×2288，容差 0.04）。视线数学：`atan2(dx,-dy)` → 0°=正上顺时针，22.5° 锚点最近邻取 lookIndex 0-15，死区 36px，眼点 = 水平中心 + 42% 高。心情接 `_ltAIChat`（AI 请求唯一漏斗）：请求中→running 思考、成功→waving 2800ms、失败→failed 3600ms。素材不嵌脚本（单张 0.8–2.4MB），导入用 mayi 的 `extracted/desktop-pets/` 10 只；测试样例包 `dafeiyu-whale-maid.codex-pet`（spritesheet 1536×2288 2,494,016 字节）。纯函数块 `__lt_pet_pure_*` 被 `test-pet-pack.js` 抽取单测 43 项。
- 桌宠 bug 修复（`88c62b8`、`80679e0`）：① 闪烁 = 亚像素位移光栅漂移 + 视线行是整身换姿势 16 帧 → 整数像素取整 + 视线跟随默认关；② "一排竖刺" = 站点全局 `img{max-width:100%}` 把 712px 精灵图钳成 89px → id 级 `max-width:none !important` + 内联 important 双保险；③ rAF"不跑"是测试面板后台化挂起（`raf-suspended`），非代码 bug；④ 单 rAF 链 + busy 120s 自愈。
- 设置面板 v1.16.0（`4ce7e10`）：一二级结构（左导航 通用/AI增强/数据管理/桌宠/关于 + 右内容卡），积分换算独立成卡，记住停留页。宠物尺寸 v1.16 改无级滑块 48–256px（`8f9998f`），拖动只改几何不重挂载。
- 提示词搜索 v1.17.0（`351f974`/`70cf57d`/`727b2e7`/`3e2eef6`/`1d282ae`）：输入面板工具栏搜索框，**CSS Custom Highlight API 零 DOM 改动高亮**（React 管的 contenteditable 绝不能动 DOM）；锚定"参考 标记 风格"三按钮右侧 8px；位置同步并入 `_ltSyncPositions` 热路径（scroll + 视口 MutationObserver + 拖动 rAF + ResizeObserver），缩放用爆发式 rAF 跟随 + 按缩放比 scale；对齐以原生按钮实测 rect 为准（top/height 逐像素一致）。
- pie 对齐菜单 v1.18.0（`d916ce0`）/v1.19.0（`c686209`）：快捷键 **A** 弹 8 扇区（外环 45°/扇区：顶/底/左/右对齐、水平/垂直居中、水平/垂直等距）+ 内环 120°（宫格/横排/竖排 = 复用原生 `onLayoutChange`）；甩选式 + 死区转点击模式。**节点位移主路径 = React Flow 批量通道**：fiber 摸 `onNodesChange`（`dragging:true` 批量 → `dragging:false` 清标志）→ `onSelectionDragStop` 一次请求保存全部（`onNodeDragStop` 只存一个节点）；合成拖拽（d3-drag `mousedown.drag`）丢帧 → 闭环补拖兜底；group 子节点 position 是父相对坐标 → 增量写。44 项单测。**用户实测"没问题"，闭环。**
- 重大教训（用户当场纠正 + Hindsight 反思固化 4 条）：① eval 片段/合成事件 ≠ 真实注入验证，做不了就明说喊用户测；② 写路径测试不许碰真实数据（曾在"商代鱼纹铜罍"画布真挪过 3 个节点且复原失败，须自还原或先要测试画布）；③ 先探最大技术风险再定方案；④ 一版一 commit、版本单源、纯函数块抽单测、给参考物先参考原生再扩展。

---

## 二、mayi 架构事实汇总

- **本质**：桌面 Tauri 应用（原 exe 76MB，源码已丢）的 Web 移植。前端 = 原版 React bundle 黑盒复用（`extracted/`，git 跟踪、零改动），`web/tauri-bridge.js`（桥，由 `web/bridge/NN-*.js` 有序片段经 `node web/build-bridge.js` 拼接）替换 `window.__TAURI_INTERNALS__` 把 `fr(cmd,args)` 翻成 `POST /api/invoke`；后端 = `server/src` 零 npm 依赖纯 Node（命令注册表 + 自动桩 `registerAutoStubs`）。
- **产品行为全由黑盒 bundle 决定**，服务器只能"翻译对了或翻译歪了"；歪一次出一种怪症状。对黑盒的补丁原则：读侧适配、桥侧最小侵入；"聪明补丁"路线（合成事件改渲染）已被证伪。
- **命令面**：契约 256 唯一命令，registry 269（多 13 个自制：回收站 trash_*、资产落盘、运行时探针）；真实现约 103+，其余桩返回 not_implemented。命令族：70 个 plugin:window/*（置空）、24 个 fs、6 族 `*_db_*`（chat/history/manifest/oss_index/production_state/project_memory，通用 store 模块）、oss_/qiniu_/cloudinary_（服务端存储，客户端凭据被忽略）、proxy_*/download（出站代理）。
- **数据流**：生成 = api_configs 模型条目 → 请求构造器（customProtocol 支持异步 poll、占位符 `$quality` 等）→ proxy_fetch/直连 → 结果 URL → `download_url_to_local_asset` 回程落 workspace assets/videos → 历史行 `{id, payload, itemType}`；`node.content` 存远程 URL，媒体组件渲染期本地化。
- **存储布局**（卷内 /data）：`workspaces/<uid>/data/localStorage/*.json`（bundle 磁盘 localStorage，含哨兵 `__QDMY_DISK_V1__`）、`workspaces/<uid>/data/lsSync/`（跨设备同步镜像，不能与前者同目录）、`workspaces/<uid>/.dbs/*.json`（6 族库）、`workspaces/<uid>/oss/`（sha256 内容寻址）、`workspaces/<uid>/data/assets|videos|thumbnails|exports`、回收站 30 天。
- **跨设备同步**：凭据键（platform_user_id/platform_system_token/global_key/saved_api_keys 等 `qiaodoumayi_` 前缀 + include 名单）桥内联读回（`__QDM_LOCALSTORAGE__` 注入）+ 写回；铁律：空值永不写回、哨兵绝不当值写回、lsSync 属主=容器用户。
- **并发控制**：画布独占锁（内存态，心跳 15s/TTL 45s，重启放锁是有意设计）；只有写 payload.json/meta.json/autosave-patch.json 才取锁。localStorage 键 64KB 同步上限（LS_MAX_CHARS=65536）。请求体 64MB 上限回 413；上游响应帽 100MB（通用代理）/200MB（download_url_to_local_asset）。
- **部署**：服务器 192.168.3.2（SSH 5522，HexHub MCP 托凭证；本机 ssh 密钥不被认）。流程 = tar 变更文件 → HexHub scp_transfer → /srv/data/mayi 解包 → 服务器跑测试 → `docker compose build && up -d`（`--force-recreate` 可能容器名冲突需先 `docker rm -f`）→ health 验证。容器 mayi-qdm-1，8877→8787，基底 node:22-slim，SESSION_SECRET 必填。公网 mayi.950814.xyz:16666 走 lucky 反代（用户自己管）。`/srv/data/mayi` 不是 git 仓库（部署=拷文件）。
- **版本升级流程**：新 exe → `node tools/extract-atelier.js all <exe> <outdir>` probe+提取 → diff → 换 `extracted/` → `node tools/scan-ipc.js` 重扫契约 diff `docs/api-surface.json` → server 实现新命令 → 桥补丁复核（类名/锚点/LS 键/形状）→ 全量测试（`node server/test/run.js`，必须 grep PASS/FAIL）→ 提交部署冒烟。当前版本线：89e5bf8（回滚基线）→ bbba356/dca700c → 4d47b0a（1.0-10-10）→ 7ad6a3b → c8b587c → 3f04d53（1.1-10-19）→ 9dd9143/a07ca77（LibTV 桥接）。
- **测试**：10 组（smoke 21 / oss-smoke 8 / settings-lock 16 / canvas-lock 21 / trash 26 / db 37 / body-limit 8 / outbound-proxy 9 / ssrf(在 backup) / libtv 23）。测试坑：块注释里 `*/` 提前闭合、spawn exit 码被吞、测试硬编码 bundle 文件名。

## 三、桌宠（libtv-boost）设计与实现状态

- 定位：liblib.tv 画布油猴增强脚本的桌宠子模块，逻辑照搬 mayi bundle 内的 Codex 桌宠（mayi 侧只存在于 minified bundle :2312/:8102/:9563 三枢纽，无源码可搬，按提取语义在 inject.js 重写）。
- 实现：clip div + 整图 img `translate(-col*cellW*scale, -row*cellH*scale)` 位移（无 canvas/WebGL/Live2D），单 rAF 链按 1000/fps 推帧；浮层挂 body fixed（红线：绝不注入 React 管理的容器）；素材 Blob 存 IndexedDB `_lt_boost`/`"b"` key `pet:<id>`，索引 localStorage `_lt_pets`、偏好 `_lt_pet_v1`；尺寸无级滑块 48–256px 热更新；AI 状态经 `_ltAIChat` 包装进 `_ltPetNotify`。
- 状态：v1.15.0 交付 + 实测通过（含 dafeiyu-whale-maid 包注册渲染、16 向视线实测偏移正确）；v1.19.0 pie 对齐实测通过。当前构建 v1.19.0。用户已确认可用。

## 四、踩坑与教训（跨会话）

1. **会话退化协议**：长会话后期大块生成会混幻觉、工具输出被伪造、元叙述自相矛盾；只信单一目的小命令、布尔探针、执行结果（"Payload Too Large" body 展开 2.25MB/1347 条是致命临界点）。
2. **验证必须走真实链路**：eval 片段/合成事件/绕过 CSS 的诊断截图都会漏真 bug（竖刺 bug 因 canvas 绘图绕过了站点 CSS 没暴露）；合成 pointer 事件虽能驱动 React 委托，但会点到错误坐标（(8,8) 命中标题栏）。
3. **对黑盒 bundle 的 UI 补丁全失败**：阶梯催绘、合成点选、revive 机制——与看不见内部状态的应用抢渲染权必翻车；已封存，再报先跑控制台探针。
4. **多改动一次部署无法归因**：SSRF+锁+原子写三件一起上，缩略图回归分不出凶手；一次一件、上完看缩略图。
5. **目录/路径坑**：APP 目录是符号链接别名（用户明说别纠结）；块注释 `*/` 提前闭合（两次）；bundle 磁盘 localStorage 会清同目录文件 → lsSync 分离；root 建目录属主错导致静默失败。
6. **数据安全铁律**：空值永不写回（两次覆盖事故）、`__QDMY_DISK_V1__` 哨兵不当值写回、写路径必须 tmp+rename、`chat_db_replace_all_sessions` 拒空覆写、删除必走回收站。
7. **LibTV 平台怪癖**：UUID 无连字符、model 查询回显、1×1 图触发审核崩溃、30001=空间/作用域错配、个人/团队算力分账。
8. SSH 主机密钥更换事件待核实（known_hosts.bak-20261010）。

## 五、未完成事项与用户明确的下一步

1. **mayi 条目 2 本地模型**：实现 `local_models_*`/`local_llm_*`/`ping_local_server` 后端，ComfyUI 地址做成服务端可配（用户在局域网另一设备部署，不在服务器上装）；媒体回程走服务端落 workspace；需核对 exe 自带工作流（`canvas-local-package.json`、flux-2-klein gguf + qwen_3_8b）与用户外置 ComfyUI 的匹配。**卡在等用户给设备地址 + 已装模型/工作流信息。**
2. **1.1 三个新面未实现**：素材搜索（material_search_* ×9）、媒体下载器（yt-dlp）、MCP 连接器（建议放弃）——等用户表态。
3. **备份分支可捡回**：`backup/after-duplicate-20261001` 里的 SSRF 修复（回滚后口子敞开）和大图模糊修复 f9a5e64，"再报问题优先捡回别重写"。
4. **xfer/ 目录**：~~下轮安全修复独有素材，勿删~~（2026-11-14 用户确认清理，素材已由 12eec78 消化）。
5. 封存项：生成完缩略图不自动刷新（用户接受手动点一下）；生成中粒子特效消失（从未定案）。
6. LibTV 桥接遗留：引用型参数（风格模板、镜头）未接；时长是固定档位（实际支持 4-30s 任意值，要滑条再说）；旧标签页不刷新可能回写冲掉 LibTV 配置（同步后写覆盖）。
7. mayi-reverse 会话末尾：用户要求在项目目录写一份交接文档 + 教用户新会话如何开场（该会话在此结束，交接文档是否已写未在本批导出中确认）。
8. 双击大图模糊在回滚后的 89e5bf8 基线上仍然存在（f9a5e64 在备份分支）。
