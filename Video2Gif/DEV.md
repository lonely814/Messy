# Video2Gif 开发文档

面向维护者的技术说明。用户用法见 `README.md`。

## 1. 目录结构

```
Video2Gif/
├── Video2Gif.cmd    主脚本（GBK + CRLF）
├── setup.cmd        下载 ffmpeg 到 bin\（GBK + CRLF）
├── README.md        用户文档（UTF-8）
├── DEV.md           本文档（UTF-8）
├── .gitignore       忽略 ffmpeg 大文件与输出
└── bin/
    └── gifski.exe   gifski CLI 1.34.0，随包附带（约 1.3MB）
```

## 2. 三种模式与选择逻辑

脚本对每个输入文件独立判断，按优先级：

| 模式 | 触发条件 | 命令形态 |
|---|---|---|
| `gifski` | 无 alpha，且找到 gifski CLI | `ffmpeg -f yuv4mpegpipe ... - \| gifski -o x.gif -` |
| `alpha` | 源像素格式含 alpha | `ffmpeg -vf "...format=rgba,palettegen reserve_transparent..."` |
| `ffmpeg` | 兜底（无 gifski CLI） | `ffmpeg -vf "...format=rgb24,palettegen..."` |

选择逻辑伪码：

```
ALPHA = (ffprobe pix_fmt 含 alpha 关键字)
MODE  = ffmpeg
if 有 gifski:      MODE = gifski
if ALPHA:          MODE = alpha     # 覆盖，alpha 优先
```

**alpha 必须覆盖 gifski 的原因**：`yuv4mpegpipe` 是纯 YUV 容器，**没有 alpha 通道**。带通道素材走管道时透明区会露出黑色。这是容器格式的硬限制，不是参数问题。

**GIF 只支持 1-bit alpha**（全透或全不透），所以 gifski 自己最终也是压成 1-bit，用 ffmpeg `palettegen reserve_transparent` 完全等价，不是画质降级。

## 3. 编码与行尾约束（改文件前必读）

**两个 `.cmd` 必须是 GBK(cp936) + CRLF。** 这不是偏好，是 cmd.exe 的硬要求：

- **UTF-8 会挂**：cmd.exe 按**字节偏移**解析批处理。UTF-8 中文是多字节，解析器读到的行边界错位，长行会被从中间截断并当成命令执行。实测把 `rem COLORQ : ...` 那行截成 `更小(抖动粗糙)` 然后报 `'更小' 不是内部或外部命令`。
- **BOM 会挂**：UTF-8 BOM 让首行变成 `\xEF\xBB\xBF@echo off`，`@echo off` 直接失效。
- **CRLF 必须**：LF-only 行尾叠加多字节字符，同样触发解析错位（报 `'em' 不是内部或外部命令` 这种诡异信息）。全 ASCII 脚本用 LF 侥幸能跑，所以容易漏。

**安全改法**（改完必须校验）：

```bash
# 写 UTF-8 源码 → 转 CRLF → 转 GBK
sed 's/$/\r/' source.txt | iconv -f UTF-8 -t GBK > Video2Gif.cmd

# 校验：往返转换无报错 = 文件未损坏
iconv -f GBK -t UTF-8 Video2Gif.cmd > /dev/null && echo OK
```

`iconv` 往返报错就说明文件被写坏了（历史上发生过：GBK→UTF-8→GBK 来回转，注释字节损坏）。

`.md` 文档用 UTF-8 即可，不受此限。

## 4. 参数体系

脚本顶部集中配置，运行时用 `!VAR!` 展开（`setlocal EnableDelayedExpansion`）。

`gifski` 模式的参数**按需拼接**，不亮起就不传，避免空值传给 gifski 报错：

```bat
set "GOPT=--quality !Q!"
if defined MOTIONQ set "GOPT=!GOPT! --motion-quality !MOTIONQ!"
...
```

`ffmpeg` 模式没有质量参数，把 `Q` 映射为调色板色数：

| Q | 色数 |
|---|---|
| ≥85 | 256 |
| ≥60 | 192 |
| ≥40 | 128 |
| <40 | 96 |

透明模式色数再减 1（`reserve_transparent` 要占一个索引）。

**抖动方式**由 `COLORQ` 选择：`bayer:bayer_scale=5` 颗粒感强体积小，`sierra2_4a` 更平滑。

## 5. 关键踩坑清单

1. **管道模式必须加 `-pix_fmt yuv420p`**。ProRes / DNxHD 等 10bit 素材是 `yuv422p10le`，`yuv4mpegpipe` 不支持，报 `'yuv422p10le' is not an official yuv4mpegpipe pixel format` → `Could not write header`。滤镜链尾部再加 `format=yuv420p` 双保险。

2. **`ffprobe` 探测必须用 `cmd /c` 包一层**：

   ```bat
   for /f "usebackq delims=" %%P in (`cmd /c ""!FP!" -v error ... -of default=nw=1:nk=1 "%%~fF""`) do ...
   ```

   直接写带引号的路径，`for /f` 会把 `-of default=nw=1:nk=1` 里的 `:` 和 `=` 二次解析，参数串位，探测永远返回空 → 判断不出 alpha。

3. **成败判定用文件大小 > 0，不能只判存在**。管道模式下 ffmpeg 失败仍会建出 **0 字节** .gif，`if exist` 会误判为成功。失败时必须 `del` 掉残件。

4. **alpha 关键字用子串包含判断**：

   ```bat
   for %%A in (yuva rgba argb bgra abgr gbrap pal8 ya8 rgb0 bgr0) do if /i "!PIX:%%A=!" neq "!PIX!" set "ALPHA=1"
   ```

   用 `!PIX:yuva=!` 是否变化来判断。`rgb24` / `yuv420p` 不含这些关键字，不会误判。（`findstr /c:"^yuva"` 写法在引号传递时不可靠，已弃用。）

5. **cmd 块语法里不要出现中文括号**。`setup.cmd` 初版在 `if (...)` 块内写 `（` `）`，破坏块解析，报"此时不应有"。改用 `goto` 标签式控制流。

6. **`echo` 的文字避免括号**，同上原因会破坏块语法。

7. **gifski 的 GUI 版不能当 CLI 用**。`Program Files` 里那个是 tauri/WebView2 包装，不认命令行参数，在 Git Bash 里调用会因为不挂控制台而**挂死**（需 `timeout`）。认准 1.3MB 的 CLI 版。

8. **`--bounce` 不支持管道模式**，gifski 会警告 `supported only for individual files, not pipe or video`。

9. **官方 Windows 渠道只发 MSI（GUI）**，没有预编译 CLI。CLI 需自行获取或 `cargo install gifski`。1.32+ 才支持 stdin y4m。

## 6. 测试方法

**在 Git Bash 里跑 .cmd 的注意事项**：

- 输出是 GBK，读取要转码：`iconv -f GBK -t UTF-8`，或先重定向到文件再解码
- 用 `node spawnSync('cmd.exe', ['/c', '...'])` 传中文参数最可靠（Git Bash 直接传参会破坏编码）
- 直接 `cmd //c script.cmd "中文.mp4"` 也可，但参数里的反斜杠会被 bash 吃掉，路径要用 `'<盘符>:\路径\'"$f"` 这种拼法

**测试矩阵**（改完必跑）：

| 素材 | 验证点 |
|---|---|
| H.264 mp4 | 基础链路，走 gifski |
| ProRes 422 HQ mov（`yuv422p10le`） | 10bit 兼容，证明 `-pix_fmt yuv420p` 生效 |
| ProRes 4444 mov（`yuva444p12le`） | 自动切 alpha 模式 |
| 不存在的文件 | 失败分支，无残留 |
| 无参数双击 | 提示文案 |
| 多文件混合 | 逐个处理不中断 |

**验证 alpha 真的保住**（不能只看"成功"）：

```bash
ffmpeg -i out.gif -vf "select=eq(n\,0),alphaextract,format=gray" -frames:v 1 -f rawvideo - | od -An -tu1 -N 8
# 输出全 0 = 透明；全 255 = 不透明（说明 alpha 被抹掉了）
```

**生成带 alpha 的测试素材**：

```bash
ffmpeg -f lavfi -i "testsrc=size=480x270:rate=30:duration=2" \
       -f lavfi -i "color=c=black:s=480x270:r=30:d=2,format=gray,geq=lum='255*X/W'" \
       -filter_complex "[0:v][1:v]alphamerge,format=yuva444p10le" \
       -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le alpha.mov
```

**验证重复次数**：读 GIF 头的 NETSCAPE2.0 块第二字节，`0000` = 无限，`0300` = 循环 3 次。

```bash
grep -ao 'NETSCAPE2.0....' out.gif | head -1 | xxd -p
```

## 7. 打包与分发决策

**为什么 ffmpeg 不进仓库**：完整构建 `ffmpeg.exe` + `ffprobe.exe` 各约 130-140MB，塞进 git 仓库会造成克隆缓慢、仓库膨胀。改用 `setup.cmd` 按需下载。

**`setup.cmd` 的守卫生效点**：

- 下载后**体积校验**（< 50MB 判定为不完整）。实测网络中断时正确报"下载不完整，只有 13886130 字节"，保留临时文件
- 用 `curl -C -` 断点续传，重跑可续
- 已有 ffmpeg 先做 `yuv4mpegpipe` 冒烟测试，可用则跳过下载（避免重复下载）
- 解压用 PowerShell `Expand-Archive`（Win10 自带），递归查找嵌套的 `bin\ffmpeg.exe`
- 下载器优先级：`curl`（Win10 1803+ 自带）→ `powershell`

**路径探测顺序**（换机免配置的关键）：

```
ffmpeg : 本目录 bin\ > 系统 PATH > 硬编码兜底路径
gifski : 本目录 bin\ > 系统 PATH > 硬编码兜底路径
ffprobe: 本目录 bin\ > 系统 PATH > ffmpeg 同目录
```

用 `%~dp0` 取脚本自身目录，保证**拷贝到任何位置都能跑**。硬编码兜底路径只为开发机方便，换机时自动跳过。

## 8. ffmpeg 版本兼容性

实测多个版本跑同源同参：

| 版本 | 管道模式输出 |
|---|---|
| N-126086 (2026-08) | 229344 |
| N-126390 (2026-08) | 229344 |
| 8.0.1 gyan (2025) | 229344 |
| n6.0 (2023-04) | 229344 |
| 21.7.0（某商业软件附带） | 227915 |
| 某 2019 精简版 | **失败** |

**结论**：正规完整构建输出**字节完全一致**，版本差异表现为"能不能解、能不能跑"，不是画质差异。风险在**精简版**——实测某精简构建连 `yuv4mpegpipe` 和 gif 输出都不支持，直接失败。

分发时建议 gyan.dev 或 BtbN 的完整构建（`-gpl` / `essentials_build`）。

## 9. 已知限制

- `--bounce`（往返播放）在管道模式不可用
- `--matte`（半透明背景色）未暴露为参数，GIF 压 1-bit alpha 后基本用不上
- `ALPHATH` 之外的 alpha 控制（如半透明渐变）受 GIF 格式限制，无法实现
- 非中文 Windows（代码页 437）未实测；GBK 注释会显示为乱码，但转换功能应不受影响。介意可把注释改英文
- `setup.cmd` 只验证 `yuv4mpegpipe` 可用性，不逐个验证解码器

## 10. 后续可做

- 参数移到独立 `config.txt`，改参数不必碰 `.cmd`（规避编码事故）
- 支持跳转链接（拖到桌面快捷方式）
- 交互模式：双击后询问参数而非直接退出
