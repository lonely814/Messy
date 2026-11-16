---
name: infinite-canvas-projects
description: 用户的三个无限画布项目（Infinite-Canvas-main 二开 / mayi 敲豆蚂蚁 / wanvas-infinite）的背景、约定、部署事实与踩坑档案。只要会话涉及无限画布、画布项目、Infinite-Canvas、mayi、敲豆蚂蚁、桥豆麻衣酱、qiaodoumayi、wanvas、libtv-boost 画布桌宠，或用户在 Infinite-Canvas-main、mayi、wanvas-infinite 项目目录下工作（按目录名匹配，不写盘符路径），先读本 skill 再动手。
---

# 无限画布项目档案

本 skill 是从 2026-09 ~ 2026-11 的 19 个相关会话中提炼的事实档案。三个项目互相独立但共享同一台服务器（192.168.3.2）和同一套工作模式。

## 三个项目对照

| | Infinite-Canvas-main | mayi（敲豆蚂蚁） | wanvas-infinite |
|---|---|---|---|
| 本地目录 | `Infinite-Canvas-main` | `mayi`（APP 目录下） | `~/Documents/wanvas-infinite` |
| 本质 | hero8152/Infinite-Canvas 二开（原作者停更），FastAPI + 原生 JS 节点式画布 AI 生图；fork: lonely814/MyCanvas | 桥豆麻衣酱 Tauri exe 的 Web 移植（原作者源码已丢）：前端 bundle 黑盒零改动 + Node 后端重写 IPC | wanvas-infinite.exe（Tauri 2.11.2）逆向的 Linux Docker 多人协作 Web 版 |
| 前端策略 | 直接改源码 | `extracted/` bundle 零改动，`web/tauri-bridge.js` 把 `fr()` 翻成 `POST /api/invoke` | 官方前端 brotli 嵌 .rdata 零改动提取 + 浏览器桥复刻 `__TAURI_INTERNALS__` |
| 后端 | Python FastAPI，`app/core.py` + `app/routers/` 10 域 155 路由 | 零 npm 依赖 Node，契约 256 命令（`docs/api-surface.json`） | Node（唯一依赖 `ws`） |
| 部署 | pm2 @ 192.168.3.2:3000，路径 `/srv/data/Infinite-Canvas-main` | 容器 `mayi-qdm-1` @ :8877，数据 `/srv/data/mayi`，公网 mayi.950814.xyz:16666 | node:22-alpine 容器 8787→8899，路径 `/srv/data/wanvas-infinite` |
| 详档 | [references/ic-main.md](references/ic-main.md) | [references/mayi.md](references/mayi.md) | [references/wanvas.md](references/wanvas.md) |

## 何时读哪个详档

- 改 IC-main 代码/部署/审查 → 读 `references/ic-main.md`（含部署铁律、性能基准、纯黑主题生成器、遗留待办清单）
- 改 mayi 后端/桥/bundle 升级 → 读 `references/mayi.md`（含 256 命令契约、OSS 冒烟、LibTV 桥接、bundle 升级流水线、逐会话结论）
- wanvas 上游升级/桥改动 → 读 `references/wanvas.md`（含 11 个编号坑、升级重提取流水线）
- 涉及 libtv-boost 画布桌宠 → 读 `references/mayi.md` 末尾桌宠章节（pet.json 格式 + React Flow 批量落位）
- 领域通用打法（性能优化/交互/网络/选型判据，与具体项目无关）→ 读 infinite-canvas-expert skill，本档案只存项目事实

## 跨项目铁律（多次付费验证，勿再试）

1. **黑盒前端补丁必翻车**（mayi 阶梯催绘、合成点选两次失败后用户拍板封存）：改黑盒 bundle 前先证明注入立足点存在；eval/合成事件 ≠ 真实验证。
2. **多改动一次一件部署归因**：mayi 曾三件修复同上引发缩略图回归，全退重做。
3. **空值永不写回**；`__QDMY_DISK_V1__` 是哨兵不是值。mayi 因违反发生两次永久数据丢失（平台分组令牌 + saved_api_keys）。
4. **部署后必须验证真进程**：pm2 旧进程会伪装生效（IC 主线炸过语法错误被掩盖）；改前端必须 `--build`（mayi）。
5. **IC 部署只推代码**：不碰 data/assets/workflows/output/API；rsync 不带 `--delete`（保 thumbnails）；打包必含 VERSION。
6. **`from app.core import *` 不导下划线名**（IC 炸两次）；行级删除必须严格降序 + AST 差集兜底。
7. **`xfer/` 目录不是垃圾**（mayi 下一轮安全修复的独有素材）；mayi 所在的 APP 目录是符号链接（两个盘符同名目录指向同一处），别纠结。

## 用户工作偏好（会话确认）

- IC-main：自验通过可直接推送+部署；动数据/不可逆操作仍需确认；测试基准要用真实噪点数据，空节点基准会被否。
- mayi：测试只在 `http://192.168.3.2:8877/` 做，不在本地验证；QDM_PUBLIC_UID 共享模式下所有人同一工作区。
- 会话退化时只信单一目的小命令与执行结果；大文件生成交子代理 + 事后独立验证。

## 维护纪律

新事实（新踩坑/新结论/待办完成）当场追加进对应详档的对应小节，不要只留在会话里；SKILL.md 只同步对照表与待办区。待办条目完成即更新状态，"截至"日期随更新推进。

## 关键待办（截至 2026-11-05）

- IC-main：hover:none 触屏按钮可见性；深色模式 5 处变量互相覆盖；alert 70 处换 toast；断点 17+2 种；死代码 ~800 行；comfy 任务刷新转圈；HEIF 缩略图 415（pillow_heif 未装）。
- mayi：本地模型 local_models_*（等你提供 ComfyUI 局域网地址，参考 192.168.3.66:8188）；SSRF 口与大图模糊修复躺 `backup/after-duplicate-20261001` 分支待 cherry-pick；12 条 failed 视频壳待定；SSH 主机密钥更换待核实。
- wanvas：无未完成任务。
