# Infinite-Canvas 二开会话提炼（ic-main-rework.md + ic-main-review.md）

来源：
- `export/ic-main-rework.md`（9660 行，sess_d6574f02，2026-09-20 起，改造+部署+功能迭代主线）
- `export/ic-main-review.md`（1146 行，sess_d52aa76f，2026-10-03 与 2026-11-03 两次全面审查）
- 项目：Infinite-Canvas-main 仓库（GitHub 原库 hero8152/Infinite-Canvas，原作者停更于 2026.08.28 版）；用户 fork：`https://github.com/lonely814/MyCanvas`

## 一、用户做的改动（按时间线）

### 1. 主线改造 Phase 0-8（2026-09-20，10 个 commit）
用户原话定调："这是一个画布项目 原作者停更了 我准备二开自用 仅通过linux服务部署使用 你先了解下项目 改解耦的解耦 该清理的清理"。
用户决策：画布"我喜欢用经典 但是经典有性能问题"、smart-canvas "删除，只留经典"；8 种 AI 渠道全部保留；功能页只拆 gpt-chat（保留 zimage/enhance/klein/online、angle、LTX 时间轴+数字人）；main.py 拆分为包结构。

- Phase 0：git init + 基线 commit + 171 条路由快照 + 启动冒烟。
- Phase 1：删 Windows/macOS 桌面分发物料（内嵌 Python 16MB、wheel 包、全部 .bat/.command、CLI/windows|macos、打赏码），-40MB+。
- Phase 2：拆自更新系统（后端 990 行 + 前端 1100 行 UI），路由 171→165；删 update-notes.json 与 VERSION（VERSION 后来又加回来了）。
- Phase 3：拆推广/返利（推荐 API 面板 `?aff=`、DX-OS 横幅、作者推广盒），README 重写保留原作者署名（License 要求）。
- Phase 4：拆 gpt-chat（165→158）。注意：`canvas-llm`（画布节点 AI）、`resolve_chat_provider`、`friendly_chat_error_detail` 被 LLM 节点/共享文件夹打标共用，必须保留。
- Phase 5：删 smart-canvas 约 1.9 万行（158→155）；LTX Director/数字人/MiniMax 都在经典画布上，未受影响；素材收件箱随删。
- Phase 6：Linux 部署适配——HOST/PORT 环境变量、CORS 从 `*` 收紧为默认同源（`ALLOWED_ORIGINS` 可配）、可选 `API_TOKEN`（`/api/unlock` 写 Cookie + api_token_guard 中间件 + WS 校验，默认关闭；程序调用支持 Bearer/查询参数）、`start.sh`（自动 venv+依赖+启动）、`deploy/infinite-canvas.service`（systemd）、`.env.example`。
- Phase 7：main.py 19,038 行 → 薄入口 365 行 + `app/core.py`（全部非路由代码，保持原始顺序）+ `app/routers/` 10 个域模块（misc25/storage9/assets36/comfyui3/runninghub11/cli11/providers6/generation17/canvases18/prompt_lib11，共 147 条路由）。15 个运行时可重绑全局变量做 tokenize 级模块限定改写；core→routes 反向引用改函数内懒导入。
- Phase 8：总验证（路由 diff、冒烟、单测适配——发现 `delete_canvas_log` 测试是上游遗留死测试）+ 删 python/ 与 get-pip.py。
- 期间做 AST 差集完整性检查，抓回 3 个被连带误删的共享符号：`now_ms`、`CANVAS_DIR`、`MAX_HISTORY_MESSAGES`。

### 2. 性能专项（canvas.js）
用户："性能问题是节点数量多了就出现"，后强调"我不懂技术 我的需求就是流畅不卡顿"。
根因（N 节点 C 连线）：小地图每帧 O(N²) querySelector + N 次 reflow；mousemove 全量连线命中 O(C·N) + 强制布局；render() 全量重建 O(N²) + lucide 全文档重扫；滚轮/拉线/小刀路径无 rAF。
修复：节点 id/DOM 索引（nodeById Map）、按帧失效的端口坐标缓存、小地图改从数据模型取几何、rAF 合并、增量渲染 `nodeRenderSignature`（RENDER_EPOCH + dataset.renderSig，内容未变复用 DOM）、`refreshIconsWithin` 限定容器。
真实基准实测（用户批评空节点测试不准后重做，2-4MB 噪点 PNG + 混合节点）：
- 悬停命中 N=100/200/400：15.48 → 0.29ms（约 53 倍，超线性变平坦）
- 小地图 15.45 → 3.55ms；renderLinks 18.5 → 3.78ms
- render()：88.7 → 3.6ms（N=100）、632 → 25.9ms（N=400）；无变化时不重绘
- 后期复测：57 节点 render 0.3ms、renderLinks 0.2ms；500 节点 0.9ms；JS 堆 25-41MB。剩余瓶颈是浏览器合成层：60 节点带 115 图平移约 46fps；`contain`/`content-visibility`/`will-change` 全项目 0 处（"药方开了没抓药"）。

### 3. 部署交付与服务器上线（2026-09-20）
- `deploy-ready/`：`git archive HEAD | tar -x -C deploy-ready` 导出，123 文件 8.3MB（后精简至 121 文件 8.1MB），已 gitignore。
- 服务器：hexhub MCP（`http://127.0.0.1:17321/mcp`，23 工具），"新服务器" asset_ref `R7E6F90A7`，192.168.3.2:5522，路径 `/srv/data/Infinite-Canvas-main`；本机内网 192.168.3.66。
- 服务器原状：原版 2026.08.28，pm2 进程 `infinite-canvas`（后改用 venv python 直接跑 main.py），3000 端口，6 画布（5 classic + 1 smart test 37 节点）、assets 1.9G、`API/.env` 333B、`data/api_providers.json` 140KB。
- 备份 `/srv/data/_backup_20260920-115659/code-data.tar.gz`（94MB）。用户授权："服务器上是pm2管理的 直接停止服务 覆盖再尝试启动吧 反正也不是非常重要的数据"。
- 传输：`scp_transfer` 最初不认 Windows 路径 → 本机起临时 HTTP 服务（内网同段）让服务器 curl 拉取；后来发现 scp 其实认盘符斜杠格式路径。
- 数据兼容性验证：数据路径完全一致（新版 BASE_DIR 多一层 `.parent` 抵消 app/ 子目录）；`canvas_path/save_canvas/canvas_record/iter_canvas_records/load_canvas_any` 与原版逐字节一致。

### 4. 后续功能迭代（均本地 commit，按用户命令推送/部署）
- 双击空白处弹新建节点菜单（原版 `board.ondblclick = null` 是主动禁用，属新增功能；复用 `openCreateMenu()`，加 e.target 校验避免节点双击误触）。
- UI 四批次（对齐用户提供的 libtv 截图设计语言：压平、收色、留白分层）：
  - 批次 1：CSS token（canvas.css 原有 `:root` 17 个变量基础上补 `--sp-1..6`、`--r-sm/md/lg`(6/10/14)、`--shadow-card/pop/selected`、`--ok/--warn/--danger/--accent:#2563eb`、14 种节点类型色 `--node-image:#0ea5e9` 等）。
  - 批次 2：`NODE_TYPES` 注册表（13 种类型，唯一数据源）驱动工具栏+createMenu+linkCreateMenu+nodeInputMenu+nodeOutputMenu（imageNodeMenu 是动作菜单不纳入）；菜单分组（基础/图像生成/视频生成/工作流）+ 顶部搜索框；补齐互相缺失项。
  - 批次 3：节点卡片压平——圆角 22→14px、阴影 `0 16px 42px`→`rgba(15,23,42,.06) 0 1px 2px`、左侧 3px 类型色条（`.node::after`）、头部 42→34px、`.node-type-dot`、选中态 `--shadow-selected`、空画布引导。
  - 批次 4：连线悬停高亮（`.link-hover` stroke rgb(96,165,250)）、快捷键 Ctrl+A/Delete/Ctrl+0/? 帮助浮层、`.node.dragging`、`.port-target`。
- smart-canvas 残留死代码清扫：`i18n/smart-canvas.js` 284 键仅 37 活（迁成 `canvas.tpl*` 后删文件）、`static/css/smart-canvas.css` 206KB 零引用删除、`normalize_canvas_kind` 恒返回 classic 内联删除；**保留** 3 处 `kind != "smart"` 过滤（服务器磁盘上有旧智能画布数据，是历史数据过滤器不是死代码）。期间抓到 `app/core.py:2518` 有 JS 风格 `//` 注释（上一提交引入的 Python 语法错误，pm2 旧进程一直掩盖着）。
- 工作流字段映射（ComfyUI 侧补齐，RunningHub 侧本就完整）：WorkflowField 增 `required/image_order/source_from_upstream/label/note`；comfyui-settings.js 编辑器三控件；运行路径 bySlot() 槽位排序、必填缺图报 `canvas.comfyRequiredMediaMissing`、提示词跟随上游开关。坑：`updateField` 对白名单外键重建整个表单导致输入失焦，三个新键必须入"不重建"白名单。
- 任务状态落盘：CANVAS_TASKS 原内存态无清理 → `data/canvas_tasks.json`（原子写），24h TTL、上限 500 条（环境变量可调），重启时排队/运行中任务明确标记"服务重启，任务已中断"；启动 `canvas_task_load()`。
- i18n 缓存修复：`static/js/i18n.js` 硬编码 `const VERSION = '2026.07.04.rec-ui.1'` 导致文案更新后浏览器永远用旧翻译 → 启动钩子 `sync_i18n_loader_version()` 按 i18n 模块 mtime 重写（两次启动哈希一致验证幂等）。
- 浅色对比度修复：`text-gray-300`(#d1d5db) 白底 1.47、`text-gray-400`(#9ca3af) 2.54、`var(--faint)` 2.56 → 新增 `.node-muted { color: var(--muted) }`（浅 #64748b/深 #cbd5e1），改后 4.76 / 6.85-7.29 达标；**刻意不改 `--faint`**（`--faint` 同时用于 SVG 连线描边 `.link { stroke:var(--faint) }`）。
- POST 重试防重复扣费：`httpx_request_with_transient_retries`（core.py:5739）不看方法，视频 POST（core.py:10102）超时重发会二次扣费 → `_RETRYABLE_METHODS = frozenset({"GET","HEAD","OPTIONS"})`。
- 数据原子写：`write_json_atomic`/`write_text_atomic`/`read_json_checked`（损坏文件改名 `<name>.corrupt-<时间戳>` 保证 + 警告，不静默覆盖）；覆盖画布、资产库、提示词库、projects、api_providers、history、shared folders、RH workflow store、API/.env 等 11+ 处。
- VERSION（`2026.09.26`）+ CHANGELOG.md：VERSION 固定缓存版本号，解决"无 VERSION 时 `?v=` 回退当天日期→每次冷启动改写全部 HTML"的 git 噪音。
- 纯黑主题：实测蓝色来自 `theme.css` 硬编码 `!important`（1651 行 316 个 !important、0 个 var()；把变量全设红只有 ~2% 界面变色）→ `tools/theme-generator/gen_black_theme.py` 程序化生成 `theme-black.css`（139 条规则 44384B）：按感知亮度 r=g=b 中性化 + 通道极差判据（≤40 底色中性化、>40 语义色保留）+ 变量阶梯 `--page:#08080a → --soft:#141416 → --card:#1c1c20 → --soft-2:#26262b`（page→card 亮度比 1.041→1.178）+ accent_block（恢复 `--accent:#60a5fa` 等）+ surface_block（直钉 html/body/.shell/.board 背景，因 theme.css:1132-1135 的 `!important` 变量压不住）；theme.js 三态 `THEMES=['light','dark','black']`，切换按钮白天→深蓝→纯黑循环。修复：canvas.js 自己的 `applyTheme` 只认 dark/light，监听 studio-theme-change 事件会抹掉 black 的类——本地镜像三态逻辑而非委托（避免无限递归）。生成器多次踩坑：只认 `#rrggbb` 漏 `rgba()`、基础表面规则整条跳过丢中性网格、`:not(.theme-dark)` 被误替换成 `:not(.theme-black)` 导致 366 条浅色规则污染深蓝主题（改为先判深色规则再替换）。
- README 重写：对比原版事实核对（208→123 文件；smart-canvas 963KB JS+206KB CSS+41KB 页面；内嵌 Python 34 文件；wheel 22 文件）；安全/稳定性/交互/字段映射/纯黑主题/重构/精简/工程化分章 + 更新日志。
- 浮层菜单防裁切：`placeFloatingMenu`/`clampFloatingMenu`/`measureFloatingMenu` 接入全部 5 个菜单；先定位置再限列表高度（反序会"放得下却出滚动条"）；1920/1440 下 13 项零滚动。
- 移动端（用户："需要设备移动端的使用"）：
  - 现状：`static/js/touch-mouse.js`（127 行触屏→鼠标桥）只挂 canvas 两页且缺 contextmenu；theme.js autoScale() 缩放下限 0.68（缩小不等于可用）；所有页 viewport meta 正确；canvas.css 780px 断点已有触屏处理。
  - 第 1 档（commit 2ff3a5c）：长按 500ms→合成 contextmenu（一处修好全部右键菜单；长按后吞掉同触摸的 click/dblclick）；桥接扩到 6 页；`shouldSkip()` 上溯到文档根、遇 `position:fixed` 浮层停止（灯箱内捏合可缩放、普通页保留原生滚动——直接引入会让生成页划不动）；`100vh`→`100dvh` 双声明（canvas-list.css 与 theme.js 的 `calc(100vh / scale)` 公式必须同单位）；`.popup-panel` 380px→`min(380px,92vw)`。image-preview.js 无需改（捏合翻译成 wheel）。
  - 侧栏抽屉（commit 1759c1e）：≤768px 汉堡按钮+遮罩抽屉，复用 `.is-pinned` 视觉；抽屉内 `zoom:1`（宿主缩放走 zoom 不是 transform，实测 bodyTransform:none）；抽屉内点圆点收起且不污染桌面 pinned 状态；Esc/遮罩/选页后自动收；aria-expanded 同步。
- 油猴脚本合并（用户自写 `~/Documents/Messy/InfiniteCanvas Turbo`，843 行，作者 oocc00，MIT）：已原生具备（图片懒加载 canvas.js:70-72、删节点清内存 5758/7192-7209、upstreamNodeIds 13340、canvasImageNearViewport 175）；原生实现输出列表模式（`body.output-list-mode` CSS + `.output-name` + 工具栏按钮/O 键/localStorage `canvas_output_list_mode`）与 FPS 胶囊（`#studioPerfPill` 左下角 `60fps|14MB|3节点`，三态 full/fps/off 循环 + localStorage `canvas_perf_pill_mode`）；commit 21dceb9。
  - 坑：`refreshOutputNodeContent` 是增量更新（按 key 复用 DOM）注入不了新标签 → 专门写 `syncOutputNameLabels()` 直接增删 DOM，并挂进 render() 的 `if(rebuiltAny)`；音频/文件卡片自带文件名要排除（`.output-audio-card/.output-file-card`）。
  - 胶囊"隐藏"死路修复（用户问"咋重新出现"）：原脚本无隐藏态，是我加的 off 却没留回来入口 → 工具栏"性能"按钮 + `P` 键 + 隐藏前档位持久化；commit c65e3cd。
  - 顺手修既有 bug：深色/纯黑下按钮激活态被 `theme.css:591`/`theme-black.css:373` 的 `.shell .tool-btn { background:#161616 !important }` 压死 → 激活规则加 `!important` + ID 选择器（`#canvasAssetToggle` 等，含既有的"资产库"按钮）。
- 伪毛玻璃节点（用户想要磨砂但担心性能，commit 615caf2）：讲清"面板可毛玻璃（位置固定，模糊算一次复用）vs 节点不能（平移时每帧重模糊）"；实现第 1 层"伪毛玻璃"——半透明渐变底（浅色白 88%→62%）+ 上缘 1px 内侧高光 + 下缘暗线，三主题同步（深色/纯黑 .node-head 不透明规则一并改透明），删 `.node::before` 冗余背景层（净减负），无 backdrop-filter。抓到 `canvas.css:1699` 后置压平段会盖掉高光。
- 滚轮缩放重做（commit f13f959 + d96b86a + a74f811）：原每格固定 ±8%、无过渡、无上下限；改滚动量连续换算（鼠标每格 ×1.17→按用户要求提速 ×1.25，0.5↔2 约 6 格）+ 目标值 150ms rAF 缓动 + 触屏捏合 1:1 + 软钳制 0.15×–4×；画布空白与项目板默认光标 grab→箭头（canvas.css:208，拖动仍抓紧）。

### 5. 2026-10-03 审查后修复（4 commit：3161d8b / 17b07f1 / 16f0f9a / 403c91e）
1. 即梦 pending 永久转圈（core.py:11210）——改在后端：任务查询接口轮询到 `jimeng_pending` 时用现成 `jimeng_query_result(submit_id)`（CLI `query_result --submit_id=`）自动续查，5 秒节流、CLI 连续失败 5 次判死；前端零协议改动，刷新后可恢复；输出卡显示"云端排队中（第 x/y 位）"。
2. 多标签互踩三连修（canvas.js:2182/1556）：本窗有未保存改动且对方保存时弹"载入最新版本 / 保留当前窗口"选择框；同步远端版本后撤销/重做栈全部清空（原只清一半）。
3. 关页前保存兜底（visibilitychange + pagehide keepalive）+ 两个上传接口 50MB 上限（413）+ 补两处漏网原子写（canvases.py:202/:292）。

### 6. 2026-11-03 只读审查后修复（commit 5f3d6ed + 242209e，按授权直接部署）
- 安全 4 件：存储目录白名单（`PATCH /api/storage-settings` 原可指任意绝对路径 + 上传 = 任意文件写，storage.py:110-114、core.py:205-212/222-245）；SSRF 四入口收口（`/api/local-assets/import-urls` assets.py:244 裸 `httpx.get` + follow_redirects 完全绕过已有防线；core.py:4397 codex 参考、core.py:5560 即梦参考、runninghub.py:706-722）统一走 `safe_remote_get`；`GET /api/config/token` 明文回传 ModelScope Token（misc.py:445-471）→ 三件套：接口掩码 + zimage/angle 页不再传 api_key（走服务端 `modelscope_api_key(req.api_key)` 回退）+ 后端挡掩码串；`get_comfy_history` 补 30s 超时（core.py:2549）。
- 稳定性 6 件：关页 keepalive 载荷剔除 logs（Chrome keepalive >64KB 直接抛 TypeError 被 catch 吞，canvas.js:1550-1556，载荷含 500 条生成日志 canvas.js:13988）；LTX 编辑器泄漏（destroyLTXEditor 原只有 13039/13819/16828 三处；performUndo ~15425 与 applyRemoteCanvasData 2189 整体替换 nodes 数组不销毁，实例带常驻 rAF 轮询 ltx-director-timeline.js:1487）→ 四处 nodes 替换点（2022/2161/2199/15437）统一清扫函数；即梦续查重写（resume_checked_at 内存态不落盘、全异常计数、task 强引用防 GC）；6 处上传 fetch 补 res.ok（canvas.js:6179/6185/7604/7737、comfyui-settings.js:1210/1296，后者失败会拿 file.name 冒充 comfy 文件名）；`node.messages` 200 条上限；缩放下限三处统一（0.06/0.12/0.15）。
- XSS 两处：`ltx-director-timeline.js:1826` `seg.fileName` 直插 innerHTML → 转义助手；`canvas.js:6736` onclick 拼 `${node.id}` → 转义（2353 是 canvas 2D fillText 无风险）。
- 部署时炸出潜伏 bug：`from app.core import *` 不导入下划线开头名字——5 个路由文件 13 处裸调 `_local_upload_safe_folder`（assets.py:190/390/534）、`_write_local_upload_classification`、`_local_upload_kind_ext`（comfyui.py/storage.py），一调用即 500，全靠"恰好没人调"潜伏；全部改 `core.` 前缀。线上验证：内网地址 192.168.3.1 被 import-urls 拒绝。

## 二、关键架构事实

- 后端：Python 3.10+/FastAPI/uvicorn；`main.py`（薄入口：sys.path 注入、CORS/令牌中间件、startup 里 `sync_i18n_loader_version()` → `sync_static_html_versions()` → `canvas_task_load()`、`uvicorn.run(app, host=os.getenv("HOST","0.0.0.0"), port=int(os.getenv("PORT","3000")), ws_ping_interval=None, ws_ping_timeout=None)`）+ `app/core.py`（~12.5-12.7k 行：配置/状态/协议适配/共享函数；`BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))`）+ `app/routers/` 10 模块 147 条路由。
- 前端：无构建，原生 HTML/JS/CSS，11 个静态 HTML 页（index 为 iframe 宿主），约 32k 行 JS；本地 vendored Tailwind/lucide/Three.js 0.160。核心文件 `static/js/canvas.js`（约 16k-16.5k 行）是经典画布全部逻辑（渲染/交互/数据），顶层 `let nodes = []`、`connections`、`viewport` 是词法绑定——页面上下文 `eval('nodes')` 可取到数组，`window.nodes` 却是 `<div id="nodes">` DOM 元素。
- 存储：纯 JSON 文件 + 文件系统，无数据库。`data/canvases/*.json`、`data/canvas_tasks.json`、`data/asset_library.json`、`data/prompt_libraries.json`、`data/projects.json`、`data/api_providers.json`、`history.json`、`API/.env`（明文密钥）、`output/`、`assets/`、`static/runninghub/thumbnails/`（运行时生成，绝不能被部署删掉）。
- 缓存版本机制：`sync_static_html_versions()` 每次启动按文件 mtime 重写 HTML 里 `?v=`；HTML 里引用 `i18n.js` 的版本由 `sync_i18n_loader_version()` 按 i18n 模块 mtime 重写；启动改写会让被跟踪 HTML 变脏（已知 churn，随提交走）。
- 部署：pm2 进程 `infinite-canvas`，3000 端口，`/srv/data/Infinite-Canvas-main`；Python 3.13.5 venv；systemd unit `deploy/infinite-canvas.service` 为备选；ComfyUI 跑在用户本机 `192.168.3.66:8188`（`COMFYUI_INSTANCES` 默认 `127.0.0.1:8188`）；外网经反代账号密码鉴权（用户明确说"反代鉴权有的 外部访问会账号密码 不用担心"，勿再建议 API_TOKEN）。
- Git：本地 master，远程仅 `main`（快进推送 `git push origin master:main`）；全历史无真实密钥（每次推送前扫描）；回滚 SHA `67f49e4b9a0ac090bad1f5bd62ae385f8fb5394e` 存 `.zcode/rollback_main_sha.txt`。
- 本地开发：无系统 Python，`uv` 建 `.venv`（Python 3.12.11）；`node --check` 校验 JS、`node static/js/i18n/validate-i18n.js`（763→777 键）、`py_compile` 校验 Python。
- 部署固定流程：密钥扫描 → 打包自检（必含 VERSION/CHANGELOG.md，易漏）→ 备份到 `/srv/data/_backup_*` → scp（认盘符斜杠路径）或本机 HTTP（IDM 劫持 8896，用 18765）→ `rsync -a` 增量覆盖**不加 --delete**（保 thumbnails）→ py_compile → pm2 真重启（验证 PID 变化+uptime 归零+重启计数+启动日志）→ 数据指纹比对（画布数/会话数/assets 数/workflows 数 + projects/asset_library/prompt_libraries/API.env 四个 md5）→ 线上浏览器实测。数据指纹历史值：画布 6→7→8，assets 1105→1112→1137→1139（差值均为用户自己生成，按时间戳确认），workflows 11→13。
- 服务器备份清单（回滚用）：`_backup_20260920-115659`、`_backup_smartclean_142936`、`_backup_routesfix_232614`、`_backup_ui_batch2/3/4`、`_backup_history_014007`、`_backup_sync_210159`、`_backup_datatx_233021`、`_backup_before_accd133_002641`、`_backup_listmode_222840`、`_backup_pillfix_225206`、`_backup_code-20261003-fixes_221312`、`_backup_ui-glass-20261003_002005`。

## 三、审查结论（问题清单与状态）

### 已修复（两轮审查共 11 个严重项 + 一批中低项）
- 2026-10-03 审查 5 严重：即梦转圈、多标签互踩、关页丢数据、上传无限制、原子写漏网 —— 全修并部署。
- 2026-11-03 审查高 6 项：存储目录任意写、SSRF 绕过、keepalive 64KB 失效、LTX 泄漏、comfy history 无超时、hover:none 触屏删图无入口 —— 前 5 修完；hover:none 触屏按钮可见性**未修**。
- 11-03 中项已修：config/token 明文、XSS 两处、第三处原子写漏网+上传旁路（部分）、7 处 res.ok（实际 6 处）、即梦续查副作用、messages 无上限、缩放下限不一致。
- 核查通过无需处理：路径穿越防护全出口在位；cli.py subprocess 无注入（exec+白名单+shlex.quote）；CORS/CSRF 关闭；canvas.js 转义纪律良好；render/renderSig 无全量重建热路径；缩放动画 rAF 自熄。

### 遗留未修（11-03 清单，用户口径"影响面大属设计决策，本轮不动"）
- 🟡 14：`update_canvas` 事件循环内同步读盘+fsync（canvases.py:506/538）；storage.py:262、comfyui.py:134 async 路由同步 requests；缩略图/静态图无 Cache-Control（misc.py:124）；连线悬停 mousemove O(28×连线数)+elementFromPoint（canvas.js:16560/16305）；minimap 平移每帧 innerHTML 全量重建（1330-1345）；comfy 任务刷新后永久转圈（resumeCanvasImageTasks 只恢复 online-image，14395）；冲突弹窗 30 秒冷却内继续分叉、"本地赢"静默覆盖（2329-2341）。
- 🟡 15 UI 债：深色 `--page/--card` 5 处定义互相覆盖（canvas.css:15 vs theme.css:538/963/1141）；theme.css 0 var() + 316 !important（全站 1638）；断点 17+2 种；`#94a3b8` 低对比小字 10→32 处；create-menu(40) 被三个侧面板(41/42/57)盖住（canvas.css:1055/975/164/470）；canvas-meta-pop(120) 盖 error-modal(90)。
- 🟢 低：core.py 21 个零调用死函数；canvas.js 16 个死函数；约 176 行死 CSS（gate 选画布簇 + meta 弹层死路径 + 4 条 kebab 拼写死规则）；10 个 router 文件头重复 ~70 行 import；关页双 PUT；撤销栈 30 份全量深拷贝；WS 僵尸映射；poll_angle_cloud 同步挂 10 分钟；touch-mouse.js:52 文档可滚动跳过桥接（手机横屏风险，需真机验证）；prefers-reduced-motion 只覆盖 api-settings；image-preview 无 detach；thumbnails 被 git 跟踪与注释相悖；/api/app-info 疑似无人调用。
- 明确不做（有实测依据）：节点虚拟化、连线视口裁剪（最大 29 条连线收益不可测且平移是 transform-only 会留空洞）、引入打包工具、完整 a11y、画布 UI 再改版、i18n 并行加载（实测本就并行）。
- 其他已知问题：`/api/media-preview` 415——iPhone HEIF 照片伪装 .png，PIL 认不出（`pillow_heif` 未装），原图 206 可看，等用户决定（装解码库 or 上传时转格式）。

### 同类项目借鉴结论（三个同名仓库 + 4 个 fork）
- basketikun（React/Vite 纯前端，7048★ MIT）：可抄 Redo、解散分组、CHANGELOG/VERSION、输入法保护、CLI 脱敏、视频任务续查、视频截帧；不抄插件系统/Canvas Agent/纯前端架构；抄代码需注明来源（我们是禁商用协议）。
- tigerowo（Go+Next.js，1003★ AGPL-3.0）：最同构；其 SSRF 实现暴露了我们的 `/api/download-output` 漏洞（已修）；可借鉴工作流字段映射、服务端任务轮询器、节点悬浮工具栏、左侧面板聚合、提示词 @ 引用。
- 4 个 fork（LONG1065930878 建库 9 分钟停更 / benkwok1983-cmd Skill 库 / LaohuAD / mufanmu）：**多账号/权限全是零**（README 是给 DX-OS.com 打广告）；Agent 协作只有 LaohuAD 真实现（HTTP 命令信箱：request_id 幂等防重复付费、领取令牌、12 个动作、仅 loopback）；mufanmu 的 Agent 建在已删除的 smart-canvas.js 上，走不通。
- 多账号评估结论：标准库可做（sqlite+hashlib+hmac cookie 会话，174 处 fetch 全相对路径前端零改动）；难点是全局共享数据隔离面（画布/历史/渠道 API Key/输出目录/回收站）与"Key 共用还是各填"的产品决策。用户："先不改了 后续再说"。

## 四、踩坑与教训

1. **行级删除脚本必须严格降序执行**（自下而上）：违反两次，误删 `now_ms`/`CANVAS_DIR`/`MAX_HISTORY_MESSAGES`/`os.makedirs(CANVAS_DIR)`；系统性防线 = 基线与当前的顶层定义名 AST 差集检查 + "已删但仍被引用"扫描（findleak.js）。
2. **`from app.core import *` 不导入下划线开头名字**：两次炸——`_canvas_task_load`（启动 NameError，改非下划线命名）与路由文件 13 处裸调 `_local_upload_safe_folder` 等（潜伏 500，被部署探针炸出）。重构后要专门查运行时延迟导入与裸调用。
3. **空节点基准测试不成立**（用户抓的）：真实节点（大图+混合类型）让 render() 数字完全不同；修正了 commit message 里的错误数据。后续多轮先实测再下结论（i18n"串行 45ms"结论错误——页面走 document.write 本就并行；"关浏览器中断生成"错误——探针证明服务端照常跑完）。
4. **部署覆盖对用户目录做 rm -rf 有风险**：`rm -rf workflows` 删掉用户自建 `workflows/custom/`（5 工作流+5 配置：9B.json、image_flux2_klein_image_edit_9b_distilled.json、image_krea2_turbo_t2i_int8.json、image_z_image_turbo_int8.json、seedvr2_3b.json），从备份恢复；此后改用 rsync 不带 --delete、打包前查不含数据目录。
5. **pm2 旧进程会伪装"已生效"**：`//` 语法错误上线后服务照跑（改完没重启）；部署必须验证 PID 变化+uptime 归零。
6. **缓存版本号链条**：`?v=` 启动时才重写 → 打补丁不重启浏览器拿旧脚本；i18n.js 硬编码 VERSION 挡新文案；浏览器可能缓存旧 HTML → 部署后提醒 Ctrl+F5；启动钩子重写 HTML 造成 git churn（用 VERSION 文件消除日期回退）。
7. **主题体系是硬编码 `!important` 而非变量**：变量覆盖压不过直写 background；`!important` 压死按钮 `.active`（修法 = !important + ID 选择器）；生成覆盖层时 `:not(.theme-dark)` 替换会引入浅色规则污染。
8. **增量渲染注入陷阱**：`refreshOutputNodeContent` 按 key 复用 DOM，新标签必须直接 DOM 操作（syncOutputNameLabels）。
9. **测试工具坑**：Playwright `evaluate` 只收一个参数（两个会 undefined→NaN）；`grep -c` 0 命中退出码非 0 会短路命令链；Git Bash `/tmp` ≠ Windows node `/tmp`；Git Bash curl 中文 body 编码损坏用纯 ASCII；本地 curl 自检被 IDM 劫持（`HTTP/1.0 204 Intercepted by the IDM Advanced Integration`）不可信；IAB 无法改视口（用注入媒体查询内规则/defineProperty 模拟）；`getComputedStyle` 在 `transition:all .2s` 中读到中间值要等待；修改测试画布后要还原并核对指纹（assets 差值先看时间戳分辨是否用户生成）。
10. **hexhub MCP 通道会整体假死**（两台服务器同时超时=通道问题非服务器），用浏览器直连生产独立验证；通道恢复后收尾。
11. **git 大包传输不稳**：fetch 反复 early EOF/TLS 中断，用 `-c http.sslBackend=openssl -c http.postBuffer=524288000 fetch origin main --depth=1` 重试；`git ls-remote`/`push` 稳定；Windows 防火墙曾挡 18765 入站（加临时规则部署完删）。
12. **JSON 读-改-写的静默数据丢失链**：非原子写半截 → 读取异常静默返回空默认 → 业务把空值写回覆盖原文件；修法 = 原子写 + `.corrupt-<时间戳>` 保证。
13. **POST 超时 ≠ 上游没收到**：非幂等方法不自动重发（防重复扣费），提交类超时应拿 task_id 查状态。
14. **权限规则演进**（用户原话）：初期一轮做完推送+部署被纠正"下次可以提交，但是没有我的命令不许推送 其他改进一个个来"；2026-10-03 放宽"部署 后续有较大调整 没问题就直接部署"（自验通过直接上线后汇报；动数据/不可逆/用户要过目的仍需确认）。
15. 沟通：用户非技术、中文交流（"我不懂技术 我的需求就是流畅不卡顿"、"啥情况 说中文啊"）；方案要讲人话，量化数据代替形容词。

## 五、未完成事项与用户明确的下一步意图

- 用户最后指令（11-03 会话末）："你来判断修复" → 修复批次已完成并部署（origin/main = 242209e）。无进行中任务。
- 待用户决定的遗留（按 11-03 清单顺序）：hover:none 触屏按钮可见性、alert(70 处) 换统一提示、深色模式收敛成变量（分批）、撤销覆盖扩展（拖动节点不可撤销）、死代码清扫（预计净删 800+ 行：core.py 21 函数、canvas.js 16 函数、176 行 CSS、router import 头）。
- 更早积压候选（用户"按优先级来"后逐个做的清单剩余）：视频任务刷新后续查（现只恢复 online-image）、视频截帧成图片节点、音频分离/按时间截取、定时清理过期画布（每天 3 点清 7 天前）、服务端任务轮询器（已被"任务落盘"部分覆盖）、备份/恢复一键工具（LaohuAD /api/data-management 模式）、测试与 CI（目前 0 测试，仅 i18n 校验）。
- 油猴脚本未移植功能：网格开关(G)、连线显隐(L)、专注模式(X，对手机有用)、节点搜索(F)、LOD 降级、DOM 虚拟化、性能模式；`?` 键冲突（canvas.js:3800 已被快捷键帮助占用）。
- 暂缓的大项（用户"先不改了 后续再说"）：多账号/权限系统（有产品决策待定：渠道 API Key 共用 or 各填）；Agent 协作（LaohuAD 信箱模式，新增独立模块、可逆）。
- HEIF 缩略图 415 问题（`pillow_heif` 未装）：等用户定（装解码库 or 上传时转格式）。
- 移动端第 2/3 档剩余：平板宽度 769-1100px 侧栏、参考图 `capture` 直接调相机、悬停按钮触屏常显、框选/剪断连线/Alt 复制的触屏替代、PWA；建议用户真机试后反馈（模拟触摸测不出真机手感）。
- 用户明确不要的：节点虚拟化、打包工具、UI 再改版、完整 a11y、继续建议加 API_TOKEN（已有反代鉴权）。
