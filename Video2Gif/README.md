# Video2Gif

把视频文件拖到 `Video2Gif.cmd` 上，自动在同目录生成同名 `.gif`。支持批量、中文路径、空格路径。

## 快速开始

1. 双击 `setup.cmd` —— 自动下载完整版 ffmpeg 到 `bin\`（约 90MB，只需一次）
2. 把视频文件拖到 `Video2Gif.cmd` 上
3. GIF 出现在源视频同目录

> `bin\gifski.exe` 已随包附带，无需另外下载。

## 免下载用法

不想跑 `setup.cmd` 也行，满足任一条件即可：

- 把 `ffmpeg.exe` 和 `ffprobe.exe` 放进 `bin\` 目录
- 或把 ffmpeg 加入系统 PATH

## 调参

用记事本打开 `Video2Gif.cmd`，顶部是参数区：

| 参数 | 默认 | 说明 |
|---|---|---|
| `WIDTH` | 480 | 输出宽度。240=表情包 480=普通 720=高清 |
| `FPS` | 15 | 帧率。12-15 流畅够用，20+ 明显变大 |
| `MAXDUR` | 空 | 只转前 N 秒，空=整段。长视频建议填 5 |
| `Q` | 90 | 总质量 1-100 |
| `MOTIONQ` | 空 | 运动质量 1-100，空=跟随 Q |
| `LOSSYQ` | 空 | 有损压缩 1-100，空=关闭 |
| `SPEED` | normal | `fast` 快50%画质降10% / `normal` / `extra` 慢50%画质升1% |
| `REPEAT` | 0 | 循环次数。0=无限 -1=播一次 3=循环3次 |
| `ALPHATH` | 128 | 透明分界 0-255 |
| `COLORQ` | 2 | 仅 ffmpeg 模式：1=更小 2=更细腻 |

### 体积参考

480px / 15fps / 2 秒源：

| 设置 | 体积 |
|---|---|
| Q=40 | 94 KB |
| Q=60 | 129 KB |
| Q=90（默认） | 229 KB |
| Q=100 | 321 KB |
| WIDTH=240 | 105 KB |
| WIDTH=720 | 442 KB |

## 工作原理

三种模式自动切换：

1. **gifski 管道模式**（默认）—— `ffmpeg -f yuv4mpegpipe | gifski`，无中间文件，比纯 ffmpeg 小约 30%
2. **alpha 模式** —— 源含透明通道时自动切换。因为 yuv4mpegpipe 是纯 YUV 没有 alpha，走管道会让透明区变黑
3. **ffmpeg 调色板模式** —— 没装 gifski 时兜底

## 支持格式

实测通过：ProRes 422 / ProRes 4444（含透明）/ H.264 8bit 和 10bit / FFV1 / VP9 / MP4 / MOV / MKV / WebM

## 常见问题

**乱码？** 文件是 GBK 编码，编辑器请选「中文 GB2312」或「GBK」打开，**不要另存为 UTF-8**，否则脚本会解析错位跑挂。

**提示找不到 ffmpeg？** 双击 `setup.cmd`。

**透明背景变黑了？** 确认用的是本目录的脚本（会自动走 alpha 模式）。若源素材不透明则属正常。

**为什么 bin\ 里没有 ffmpeg？** 139MB 太大不适合进 git 仓库，所以由 `setup.cmd` 按需下载。gifski 只有 1.3MB，直接附带。

## 依赖

| 组件 | 说明 |
|---|---|
| ffmpeg + ffprobe | 必需。`setup.cmd` 下载，或自行放入 `bin\` |
| gifski CLI 1.34.0 | 已附带。可选，缺省时自动降级为 ffmpeg 模式 |

注意：`Program Files\gifski\gifski.exe` 是 **GUI 版**，不认命令行参数，不能用。
