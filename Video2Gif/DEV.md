# Video2Gif 开发文档

面向维护者的技术说明。用户用法见 `README.md`。

## 1. 目录结构

```
Video2Gif/
├── Video2Gif.cmd    主脚本（GBK + CRLF）
├── config.txt       参数配置（编码随意，参数行纯 ASCII）
├── setup.cmd        下载 ffmpeg 到 bin\（GBK + CRLF）
├── README.md        用户文档（UTF-8）
├── DEV.md           本文档（UTF-8）
├── .gitignore       忽略 ffmpeg 大文件与输出
└── bin/
    └── gifski.exe   gifski CLI 1.34.0，随包附带（约 1.3MB）
```

## 2. 四种模式与选择逻辑

脚本对每个输入文件独立判断，按优先级：

| 模式 | 触发条件 | 命令形态 |
|---|---|---|
| `gifski` | 无 alpha，且找到 gifski CLI | `ffmpeg -f yuv4mpegpipe ... - \| gifski -o x.gif -` |
| `alphaski` | 有 alpha，且找到 gifski CLI | ffmpeg 抽 rgba PNG 帧 → `gifski -o x.gif 目录\f*.png` |
| `alpha` | 有 alpha，无 gifski | `ffmpeg -vf "...format=rgba,palettegen reserve_transparent..."` |
| `ffmpeg` | 兜底（无 gifski，无 alpha） | `ffmpeg -vf "...format=rgb24,palettegen..."` |

选择逻辑伪码：

```
ALPHA = (ffprobe pix_fmt 含 alpha 关键字)
MODE  = ffmpeg
if 有 gifski:        MODE = gifski
if ALPHA 且 有 gifski: MODE = alphaski   # 覆盖
if ALPHA 且 无 gifski: MODE = alpha      # 覆盖
```

**alpha 不能走 y4m 管道的原因**：`yuv4mpegpipe` 是纯 YUV 容器，**没有 alpha 通道**，透明区会变黑。但 gifski 本体支持 alpha——只认 PNG 帧输入（rgba PNG），所以 alphaski 抽帧绕行，实测压缩率远好于调色板方案（见下方基准）。

**alphaski 基准**（同一 2 秒 testsrc 透明素材，240px/12fps，2026-09 实测）：

| 档位 | gifski | ffmpeg 调色板 | 差异 |
|---|---|---|---|
| 最高 | Q90 → 71.5KB | 255色 → 74.6KB | -4% |
| 中高 | Q60 → 27.4KB | 191色 → 73.7KB | **-63%** |
| 最低 | Q30 → 19.6KB | 95色 → 61.1KB | **-68%** |

调色板模式的减色杠杆被抖动噪声抵消，95 色也只省 18%；gifski 的有损量化在 Q60 以下优势巨大。这就是 alpha 素材走 alphaski 的理由。

**alphaski 实现要点**：

- 临时目录 `%TEMP%\v2g_png_<RANDOM>`，抽帧 `format=rgba` 出 8 位 PNG；gifski 自己做 1-bit alpha 阈值，**ALPHATH 对此模式无效**（只影响 `alpha` 兜底模式）
- gifski CLI 自己展开 `目录\f*.png` 通配符，不用拼文件列表
- TARGETKB 降档梯照常工作，且**只降质量时不重抽帧**（`EXFPS`/`EXW` 记录抽帧参数，变了才重抽）；帧率/宽度档变化才重新抽帧
- 临时目录在成功、失败、降档到底三个出口都 `rd /s /q` 清理

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

`.md` 文档用 UTF-8 即可，不受此限。`config.txt` 用什么编码都行（参数行纯 ASCII），但**行尾同样必须 CRLF**，实测 UTF-8 注释 + LF 会让 `for /f` 吞参数行，见第 4 节。

## 4. 参数体系

**参数全部放在 `config.txt`**，用户改参数不必碰 `.cmd`，从根上规避 GBK 编码事故。脚本顶部的 `set` 块只是内置默认值，在 config.txt 缺失或某行被删时兜底——所以整体语义是「按行覆盖」，单行删除即单行回退。

`config.txt` 的解析（`Video2Gif.cmd` 里的「读 config.txt」段）：

```bat
for /f "usebackq tokens=1,* delims== eol=#" %%A in ("!CFG!") do (
  if /i "%%A"=="WIDTH" set "WIDTH=%%B"
  ...
)
```

设计要点：

- **键名白名单**：只认脚本出现过的 10 个键，其他行（包括被截断的注释行）自动忽略，垃圾行污染不了变量
- **`eol=#`**：行首 `#` 的注释整行跳过，所以注释里随便写 `=` 也没事
- **编码无关**：参数行和值都是纯 ASCII，注释行被整体跳过，所以无论文件存成 UTF-8、GBK 还是 ANSI 都能正常解析，编辑器乱码只影响注释显示不影响功能。唯一例外是 UTF-16（ASCII 也带 NUL 字节），整份文件一行都认不出——脚本用 `findstr /r /c:"^键="` 复查一遍，一行都匹配不到就打警告
- **首行必须是 `#` 注释**：这样即使编辑器加了 UTF-8 BOM，BOM 吃掉的也只是首行注释，不伤参数
- **值的限制**：不能带 `!`（脚本开了延迟变量展开，值里的 `!` 会被吃掉）、不能行尾跟注释（会并入值）、行首不能有空格（`eol` 和 `^KEY=` 都匹配不到）
- **必须 CRLF（实测）**：UTF-8 中文注释 + LF 行尾的组合会让 `for /f` 静默吞掉部分参数行——探针实测 `MAXDUR=` `SPEED=` `REPEAT=` `COLORQ=` 四行凭空消失，转回 CRLF 全部恢复。机理与第 3 节 `.cmd` 的 CRLF 约束同源（多字节字符叠加 LF 导致 cmd 字节配对错位）。GBK 编码 + LF、纯 ASCII + LF 实测都正常，但别赌，统一 CRLF。记事本默认 CRLF 不会踩到；注意 Git Bash 里用 sed 改这个文件会把 CRLF 剥成 LF（MSYS 文本模式读入），改完必须 `sed 's/$/\r/'` 补回

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

**TARGETKB 自动压档**：每个文件转完检查体积，超标就按 质量 90/60/45/30 → 帧率 12/10 → 宽度 200/160 逐档降一档重编；降到最低档还超，保留最小成品并提示用 MAXDUR 截短。要点：

- 降档时 `MOTIONQ`/`LOSSYQ` 不参与——它们是第一档的手动微调，重试统一走 `--quality` 总开关
- 单文件处理在 `:one_file` 子过程里（主循环 `call :one_file "%%~fF"`），因为 goto 重试循环没法在 for 块里跑，for 块里 goto 会直接终止整个循环
- 降档梯的条件用「大于才降」写法，用户配置本来就低于档位时自动跳过该档（如 FPS=12 会跳过帧率 12 档）

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

8. **`--bounce` 不支持管道模式**，gifski 会警告 `supported only for individual files, not pipe or video`。想加往返播放功能，可用 ffmpeg 滤镜自己拼反向流：`split` → `reverse`（加 `trim=start_frame=1` 去接缝重复帧）→ `concat`，管道内即可实现，无需 gifski 支持

9. **官方 Windows 渠道只发 MSI（GUI）**，没有预编译 CLI。CLI 需自行获取或 `cargo install gifski`。1.32+ 才支持 stdin y4m。

10. **config.txt 的值里不能有 `!`**。脚本 `setlocal EnableDelayedExpansion`，`for /f` 循环里 `set "K=%%B"` 时值中的 `!` 会被延迟展开吃掉。`%` 同理有风险。模板里已写明，但用户手滑填了也别奇怪。

11. **管道两侧在子 cmd 里重新解析，延迟变量失效**。`echo !VAR! | findstr` 里的 `!VAR!` 不会展开——`|` 的两侧各自启动一个新 cmd 实例执行，不继承脚本的 `setlocal EnableDelayedExpansion`。要在管道左边用变量，用 `for /f` 中转或换成无管道写法。TARGETKB 的纯数字校验用 `for /f "delims=0123456789"`（有非数字字符就产生 token，据此清空变量）就是这个原因。

12. **Git Bash 给 Windows 程序传含通配符的 POSIX 路径不会被转换**。`gifski.exe -o "/tmp/bench/x.gif" "/tmp/bench/f*.png"` 收到的是字面 POSIX 路径，报"目录不存在"——MSYS 的路径转换跳过带 `*` 的参数。从 Git Bash 测试时用 `cygpath -w` 转 Windows 路径；脚本自身在 cmd 里跑不受影响。

13. **gifski PNG 模式会把进度条打进 stderr**（`Frame 1 / 30 ... 97KB GIF;`），管道和抽帧模式都有。控制台直接跑看得到，属正常反馈不是报错。

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
| ProRes 4444 mov（`yuva444p12le`） | 自动切 alphaski 模式，透明保留（alphaextract 全 0） |
| 无 gifski 环境 + 透明素材 | 回退 alpha 模式 |
| 不存在的文件 | 失败分支，无残留 |
| 无参数双击 | 提示文案 |
| 多文件混合 | 逐个处理不中断 |
| config.txt 改参数 | 覆盖生效，`参数 :` 行显示新值 |
| config.txt 缺失 / 删行 | 内置默认值兜底 |
| config.txt 存成 UTF-16 | 打「没认出任何参数行」告警，走默认值 |
| config.txt 被存成 UTF-8 + LF | 会静默吞参数行（已知坑），CRLF 恢复 |
| TARGETKB 超标素材 | 自动降档重试，最终达标 |
| TARGETKB 降到最低档仍超 | 告警 + 保留最小成品 + 提示 MAXDUR |
| TARGETKB 填非数字 | 当作未设置，走单次转换 |

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
- 已有 ffmpeg 的可用性检查 = **版本字样精确匹配**（`findstr /i /c:"ffmpeg version"`）+ `yuv4mpegpipe` 冒烟测试，都过才跳过下载
- 解压用 PowerShell `Expand-Archive`（Win10 自带），递归查找嵌套的 `bin\ffmpeg.exe`
- copy 之后**校验 errorlevel 和目标体积**（< 1MB 判失败），失败时**保留解压目录**供手动补救。实测发生过一次 copy 静默失败（真 ffmpeg 没进 bin，原因未查明，现场被清理毁掉），这组守卫就是那次教训的产物
- 下载器优先级：`curl`（Win10 1803+ 自带）→ `powershell`

**findstr 的坑**：多词参数是 **OR** 语义，`findstr /i "ffmpeg version"` 连 `Usage: ffmpeg.exe ...` 都能匹配（含 "ffmpeg" 就行）。验证输出必须用 `/c:"短语"` 精确匹配并检查 errorlevel，否则假货能混过关。另一个连带发现：某些程序对任意参数都返回 0，光看 errorlevel 防不住，必须验证输出内容。

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

- 支持跳转链接（拖到桌面快捷方式）
- 交互模式：双击后询问参数而非直接退出
- START 起始秒数参数（`-ss %START%` 放 `-i` 前），配合 MAXDUR 成完整截段能力
- BOUNCE 往返循环（见踩坑清单第 8 条的滤镜拼法）
- MAXKB 目标体积上限，超限自动降 Q 重编
