@echo off
setlocal EnableDelayedExpansion
rem 本文件编码必须是 GBK(cp936) + CRLF 行尾，编辑器里别改成 UTF-8

rem ========================= 可调参数 =========================
rem  【基础】
rem  WIDTH   输出宽度(像素)，高度按比例自动算。240=表情包 480=普通 720=高清大图
rem  FPS     输出帧率。12到15流畅够用，20以上文件明显变大
rem  MAXDUR  只转前几秒，留空=整段。长视频建议填 5，防止文件爆炸
rem
rem  【质量】(仅 gifski 管道模式生效)
rem  Q       总质量 1到100，越高越清晰、体积越大。默认 90
rem  MOTIONQ 运动质量 1到100，控制快速运动画面的清晰度。留空=跟随 Q
rem  LOSSYQ  有损压缩 1到100，输入画面是噪声照片时才需要调低。留空=关闭
rem  SPEED   编码速度。fast=快50%画质降10%  normal=默认  extra=慢50%画质升1%
rem  REPEAT  循环次数。0=无限循环(默认)  -1=只播一次  3=循环3次
rem
rem  【透明通道】
rem  ALPHATH 透明分界阈值 0到255。GIF 只支持全透或全不透，默认 128
rem
rem  【仅 ffmpeg 模式】(没装 gifski 时用)
rem  COLORQ  画质档位。1=文件更小(抖动粗糙)  2=更细腻(默认)
rem ============================================================

set "WIDTH=480"
set "FPS=15"
set "MAXDUR="

set "Q=90"
set "MOTIONQ="
set "LOSSYQ="
set "SPEED=normal"
set "REPEAT=0"

set "ALPHATH=128"

set "COLORQ=2"

rem ---------- 下面一般不用改 ----------

rem 本脚本所在目录，BINDIR 是其中的 bin 子目录
set "BINDIR=%~dp0bin\"

rem 找 ffmpeg，优先级：本目录 bin\ffmpeg.exe > 系统 PATH
rem 换机免配置：把 ffmpeg.exe 放进 bin\ 目录，或让它出现在 PATH 里
rem 两处都没有时双击 setup.cmd 一键下载
set "FF="
if exist "!BINDIR!ffmpeg.exe" set "FF=!BINDIR!ffmpeg.exe"
if not defined FF for %%I in (ffmpeg.exe) do set "FF=%%~$PATH:I"

rem 从 ffmpeg 所在目录找 ffprobe，用来探测素材像素格式(判断有没有透明通道)
set "FP="
if exist "!BINDIR!ffprobe.exe" set "FP=!BINDIR!ffprobe.exe"
if not defined FP for %%I in (ffprobe.exe) do set "FP=%%~$PATH:I"
if not defined FP if defined FF (
  for %%I in ("!FF!") do set "FFDIR=%%~dpI"
  if exist "!FFDIR!ffprobe.exe" set "FP=!FFDIR!ffprobe.exe"
)

rem 找 gifski 命令行版：本目录 bin\ > 系统 PATH
rem 注意：某些软件附带的 gifski 是 GUI 版，不认命令行参数，别指到它
set "GIFSKI="
if exist "!BINDIR!gifski.exe" set "GIFSKI=!BINDIR!gifski.exe"
if not defined GIFSKI for %%I in (gifski.exe) do set "GIFSKI=%%~$PATH:I"

rem 没拖文件时给提示，双击也能看到说明
if "%~1"=="" (
  echo 把视频文件拖到本 .cmd 上即可转成 GIF。
  echo 输出在同目录，文件名相同、后缀换成 .gif
  echo 带透明通道的 mov 会自动保留透明背景。
  echo 用记事本打开本文件，顶部可调宽度/帧率/质量等参数。
  echo.
  echo 缺 ffmpeg 时，双击 setup.cmd 一键下载到 bin 目录。
  if not defined NO_PAUSE pause
  exit /b 0
)

if not exist "!FF!" (
  echo [x] 找不到 ffmpeg
  echo     办法一：双击本目录的 setup.cmd 自动下载
  echo     办法二：把 ffmpeg.exe 和 ffprobe.exe 放进 bin 目录
  echo     办法三：把 ffmpeg 加入系统 PATH
  if not defined NO_PAUSE pause
  exit /b 1
)

rem MAXDUR 非空时加 -t 限制时长
set "STOP="
if defined MAXDUR set "STOP=-t %MAXDUR%"

rem ---------- 组装 gifski 参数 ----------
rem 只有在填了值时才拼参数，避免把空值传给 gifski 导致报错
set "GOPT=--quality !Q!"
if defined MOTIONQ set "GOPT=!GOPT! --motion-quality !MOTIONQ!"
if defined LOSSYQ set "GOPT=!GOPT! --lossy-quality !LOSSYQ!"
if /i "!SPEED!"=="fast" set "GOPT=!GOPT! --fast"
if /i "!SPEED!"=="extra" set "GOPT=!GOPT! --extra"
if defined REPEAT set "GOPT=!GOPT! --repeat !REPEAT!"

rem ---------- 组装 ffmpeg 调色板参数 ----------
rem 抖动方式：bayer 颗粒感强但文件小，sierra2_4a 更平滑
if defined COLORQ if "%COLORQ%"=="1" (
  set "DITHER=bayer:bayer_scale=5:diff_mode=rectangle"
) else (
  set "DITHER=sierra2_4a:diff_mode=rectangle"
)

rem ffmpeg 模式没有质量参数，把 Q 换算成调色板色数(色数越多越清晰、体积越大)
if !Q! GEQ 85 (set "NCOL=256") else if !Q! GEQ 60 (set "NCOL=192") else if !Q! GEQ 40 (set "NCOL=128") else set "NCOL=96"

rem 不透明素材的调色板滤镜
set "CODEC=split[a][b];[a]palettegen=max_colors=!NCOL!:stats_mode=diff[p];[b][p]paletteuse=dither=!DITHER!"

rem 透明素材的调色板滤镜。reserve_transparent 留出一个索引给透明色，所以色数减 1
set /a NCOLA=!NCOL!-1
set "CODECA=split[a][b];[a]palettegen=max_colors=!NCOLA!:stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=!DITHER!:alpha_threshold=!ALPHATH!"

echo ffmpeg : !FF!
if defined GIFSKI (echo gifski : !GIFSKI!) else (echo gifski : 未找到 --^> 全部走 ffmpeg 调色板模式)
if defined FP (echo ffprobe: !FP!) else (echo ffprobe: 未找到 --^> 无法自动识别透明通道)
echo 参数   : 宽度 !WIDTH! 帧率 !FPS! 质量 !Q! 速度 !SPEED! 循环 !REPEAT!
echo.

rem 逐个处理拖入的文件
for %%F in (%*) do (
  echo === %%~nxF

  rem 先探测像素格式，判断带不带 alpha(透明通道)
  rem 带 alpha 的格式主要有 yuva*/rgba/bgra/argb/abgr/gbrap/ya8/pal8
  rem 不能走 gifski 管道：yuv4mpegpipe 是纯 YUV，没有 alpha 通道，透明区会变黑
  set "ALPHA="
  set "PIX="
  if defined FP (
    rem 必须用 cmd /c 包一层：直接写带引号的路径会让 for /f 把 -of default=nw=1:nk=1 里的等号冒号二次解析，参数串位导致探测失败
    for /f "usebackq delims=" %%P in (`cmd /c ""!FP!" -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 "%%~fF"" 2^>nul`) do set "PIX=%%P"
    if defined PIX (
      rem 用子串包含判断：!PIX:yuva=! 若发生变化说明含 yuva
      rem rgb24 yuv420p 这类不含 alpha 的格式不会被误判
      for %%A in (yuva rgba argb bgra abgr gbrap pal8 ya8 rgb0 bgr0) do if /i "!PIX:%%A=!" neq "!PIX!" set "ALPHA=1"
    )
  )

  set "MODE=ffmpeg"
  if defined GIFSKI set "MODE=gifski"
  if defined ALPHA set "MODE=alpha"
  if "!MODE!"=="alpha" echo     像素格式 !PIX! 含透明通道，改用 ffmpeg 保留 alpha

  if "!MODE!"=="gifski" (
    rem gifski 模式：ffmpeg 解码后通过管道喂帧，不落地中间文件
    rem -pix_fmt yuv420p 必须加：ProRes DNxHD 等 10bit 素材的 yuv422p10le 不被 yuv4mpegpipe 支持
    "!FF!" -hide_banner -loglevel error !STOP! -y -i "%%~fF" -f yuv4mpegpipe -pix_fmt yuv420p -vf "fps=!FPS!,scale=!WIDTH!:-2:flags=lanczos,format=yuv420p" - | "!GIFSKI!" -o "%%~dpnF.gif" !GOPT! -q -
  ) else if "!MODE!"=="alpha" (
    rem 透明模式：先转 rgba 再进 palettegen，最后用 reserve_transparent 保住透明色
    "!FF!" -hide_banner -loglevel error !STOP! -y -i "%%~fF" -vf "fps=!FPS!,scale=!WIDTH!:-2:flags=lanczos,format=rgba,!CODECA!" -loop 0 "%%~dpnF.gif"
  ) else (
    rem ffmpeg 模式：一条命令出图
    "!FF!" -hide_banner -loglevel error !STOP! -y -i "%%~fF" -vf "fps=!FPS!,scale=!WIDTH!:-2:flags=lanczos,format=rgb24,!CODEC!" -loop 0 "%%~dpnF.gif"
  )

  rem 用文件是否生成且非空判断成败，比解析 ffmpeg 文本可靠(不受系统语言影响)
  rem 管道模式下 ffmpeg 失败会留下 0 字节残件，必须按大小判，并删掉它
  set "OK="
  for %%S in ("%%~dpnF.gif") do if %%~zS GTR 0 set "OK=1"
  if defined OK (
    for %%S in ("%%~dpnF.gif") do echo     成功   %%~dpnF.gif  [%%~zS 字节]
  ) else (
    if exist "%%~dpnF.gif" del /f /q "%%~dpnF.gif"
    echo     失败   %%~nxF
  )
)

echo.
echo 全部完成。
if not defined NO_PAUSE pause
