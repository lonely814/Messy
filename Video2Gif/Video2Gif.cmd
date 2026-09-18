@echo off
setlocal EnableDelayedExpansion
rem 本文件编码必须是 GBK(cp936) + CRLF 行尾，编辑器里别改成 UTF-8

rem ========================= 可调参数 =========================
rem 参数已移到同目录的 config.txt，用记事本打开就能改，不必碰本文件
rem config.txt 不存在、或某一行被删掉时，用下面这些内置默认值

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

set "TARGETKB="

rem ---------- 读 config.txt ----------
rem 只认上面出现过的键，其他行自动忽略；eol=# 让 # 开头的注释整行跳过
set "CFG=%~dp0config.txt"
if not exist "!CFG!" goto :cfg_done
for /f "usebackq tokens=1,* delims== eol=#" %%A in ("!CFG!") do (
  if /i "%%A"=="WIDTH" set "WIDTH=%%B"
  if /i "%%A"=="FPS" set "FPS=%%B"
  if /i "%%A"=="MAXDUR" set "MAXDUR=%%B"
  if /i "%%A"=="Q" set "Q=%%B"
  if /i "%%A"=="MOTIONQ" set "MOTIONQ=%%B"
  if /i "%%A"=="LOSSYQ" set "LOSSYQ=%%B"
  if /i "%%A"=="SPEED" set "SPEED=%%B"
  if /i "%%A"=="REPEAT" set "REPEAT=%%B"
  if /i "%%A"=="ALPHATH" set "ALPHATH=%%B"
  if /i "%%A"=="COLORQ" set "COLORQ=%%B"
  if /i "%%A"=="TARGETKB" set "TARGETKB=%%B"
)
rem 一行都没认出说明文件坏了，比如被存成 UTF-16，提醒一下，免得用户以为改了参数没生效
findstr /i /r /c:"^WIDTH=" /c:"^FPS=" /c:"^MAXDUR=" /c:"^Q=" /c:"^MOTIONQ=" /c:"^LOSSYQ=" /c:"^SPEED=" /c:"^REPEAT=" /c:"^ALPHATH=" /c:"^COLORQ=" /c:"^TARGETKB=" "!CFG!" >nul 2>&1
if errorlevel 1 echo [!] config.txt 里没认出任何参数行，请检查文件编码和参数行格式，本次使用内置默认值
:cfg_done

rem TARGETKB 必须是纯数字，混了别的字符就当没设，防止后面算体积上限出错
rem 不用 echo 管道 findstr 来验：管道两侧会在子 cmd 里重新解析，延迟变量会失效
if defined TARGETKB for /f "delims=0123456789" %%Z in ("!TARGETKB!") do set "TARGETKB="

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
  echo 参数用记事本打开同目录的 config.txt 修改，缺该文件时用内置默认值。
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

rem ---------- 抖动方式：bayer 颗粒感强但文件小，sierra2_4a 更平滑 ----------
if defined COLORQ if "%COLORQ%"=="1" (
  set "DITHER=bayer:bayer_scale=5:diff_mode=rectangle"
) else (
  set "DITHER=sierra2_4a:diff_mode=rectangle"
)

echo ffmpeg : !FF!
if defined GIFSKI (echo gifski : !GIFSKI!) else (echo gifski : 未找到 --^> 全部走 ffmpeg 调色板模式)
if defined FP (echo ffprobe: !FP!) else (echo ffprobe: 未找到 --^> 无法自动识别透明通道)
echo 参数   : 宽度 !WIDTH! 帧率 !FPS! 质量 !Q! 速度 !SPEED! 循环 !REPEAT!
if defined TARGETKB echo 体积   : 每个文件压到 !TARGETKB!KB 以内，超了自动降档重试
echo.

rem 逐个处理拖入的文件。转换单文件要按目标体积反复重编，逻辑放进子过程才好用 goto
for %%F in (%*) do call :one_file "%%~fF"

echo.
echo 全部完成。
if not defined NO_PAUSE pause
exit /b 0

rem ========================= 子过程：转一个文件 =========================

:one_file
echo === %~nx1

rem 先探测像素格式，判断带不带 alpha(透明通道)
rem 带 alpha 的格式主要有 yuva*/rgba/bgra/argb/abgr/gbrap/ya8/pal8
rem 不能走 gifski 管道：yuv4mpegpipe 是纯 YUV，没有 alpha 通道，透明区会变黑
set "ALPHA="
set "PIX="
if defined FP (
  rem 必须用 cmd /c 包一层：直接写带引号的路径会让 for /f 把 -of default=nw=1:nk=1 里的等号冒号二次解析，参数串位导致探测失败
  for /f "usebackq delims=" %%P in (`cmd /c ""!FP!" -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 "%~f1"" 2^>nul`) do set "PIX=%%P"
  if defined PIX (
    rem 用子串包含判断：!PIX:yuva=! 若发生变化说明含 yuva
    rem rgb24 yuv420p 这类不含 alpha 的格式不会被误判
    for %%A in (yuva rgba argb bgra abgr gbrap pal8 ya8 rgb0 bgr0) do if /i "!PIX:%%A=!" neq "!PIX!" set "ALPHA=1"
  )
)

set "MODE=ffmpeg"
if defined GIFSKI set "MODE=gifski"
if defined ALPHA if defined GIFSKI set "MODE=alphaski"
if defined ALPHA if not defined GIFSKI set "MODE=alpha"
if "!MODE!"=="alphaski" echo     像素格式 !PIX! 含透明通道，抽 PNG 帧走 gifski
if "!MODE!"=="alpha" echo     像素格式 !PIX! 含透明通道，改用 ffmpeg 保留 alpha

rem 降档工作变量：QCUR 质量 FPSCUR 帧率 WCUR 宽度
set "QCUR=!Q!"
set "FPSCUR=!FPS!"
set "WCUR=!WIDTH!"
rem alphaski 的抽帧缓存：EXFPS EXW 记录当前帧是按什么参数抽的
set "TMPD="
set "EXFPS="
set "EXW="

:retry_encode
rem 组装 gifski 参数。用户单独调的 MOTIONQ LOSSYQ 只在第一档生效，降档重试统一走 --quality 总开关
set "GOPT=--quality !QCUR!"
if /i "!SPEED!"=="fast" set "GOPT=!GOPT! --fast"
if /i "!SPEED!"=="extra" set "GOPT=!GOPT! --extra"
if defined REPEAT set "GOPT=!GOPT! --repeat !REPEAT!"
if !QCUR! EQU !Q! (
  if defined MOTIONQ set "GOPT=!GOPT! --motion-quality !MOTIONQ!"
  if defined LOSSYQ set "GOPT=!GOPT! --lossy-quality !LOSSYQ!"
)

rem ffmpeg 模式没有质量参数，把 QCUR 换算成调色板色数(色数越多越清晰、体积越大)
if !QCUR! GEQ 85 (set "NCOL=256") else if !QCUR! GEQ 60 (set "NCOL=192") else if !QCUR! GEQ 40 (set "NCOL=128") else set "NCOL=96"

rem 不透明素材的调色板滤镜
set "CODEC=split[a][b];[a]palettegen=max_colors=!NCOL!:stats_mode=diff[p];[b][p]paletteuse=dither=!DITHER!"

rem 透明素材的调色板滤镜。reserve_transparent 留出一个索引给透明色，所以色数减 1
set /a NCOLA=!NCOL!-1
set "CODECA=split[a][b];[a]palettegen=max_colors=!NCOLA!:stats_mode=diff:reserve_transparent=1[p];[b][p]paletteuse=dither=!DITHER!:alpha_threshold=!ALPHATH!"

rem alphaski 用 PNG 帧：只降质量时帧可复用，帧率或宽度变了才重新抽
if "!MODE!"=="alphaski" if not "!FPSCUR!x!WCUR!"=="!EXFPS!x!EXW!" call :extract_png "%~f1"

if "!MODE!"=="gifski" (
  rem gifski 模式：ffmpeg 解码后通过管道喂帧，不落地中间文件
  rem -pix_fmt yuv420p 必须加：ProRes DNxHD 等 10bit 素材的 yuv422p10le 不被 yuv4mpegpipe 支持
  "!FF!" -hide_banner -loglevel error !STOP! -y -i "%~f1" -f yuv4mpegpipe -pix_fmt yuv420p -vf "fps=!FPSCUR!,scale=!WCUR!:-2:flags=lanczos,format=yuv420p" - | "!GIFSKI!" -o "%~dpn1.gif" !GOPT! -q -
) else if "!MODE!"=="alphaski" (
  rem alphaski 模式：y4m 管道没有 alpha 通道，抽 rgba PNG 帧喂 gifski，gifski 自己展开通配符
  "!GIFSKI!" -o "%~dpn1.gif" !GOPT! "!TMPD!\f*.png"
) else if "!MODE!"=="alpha" (
  rem 透明模式：先转 rgba 再进 palettegen，最后用 reserve_transparent 保住透明色
  "!FF!" -hide_banner -loglevel error !STOP! -y -i "%~f1" -vf "fps=!FPSCUR!,scale=!WCUR!:-2:flags=lanczos,format=rgba,!CODECA!" -loop 0 "%~dpn1.gif"
) else (
  rem ffmpeg 模式：一条命令出图
  "!FF!" -hide_banner -loglevel error !STOP! -y -i "%~f1" -vf "fps=!FPSCUR!,scale=!WCUR!:-2:flags=lanczos,format=rgb24,!CODEC!" -loop 0 "%~dpn1.gif"
)

rem 用文件是否生成且非空判断成败，比解析 ffmpeg 文本可靠(不受系统语言影响)
rem 管道模式下 ffmpeg 失败会留下 0 字节残件，必须按大小判，并删掉它
set "OK="
set "SZ=0"
for %%S in ("%~dpn1.gif") do if %%~zS GTR 0 (
  set "OK=1"
  set "SZ=%%~zS"
)
if not defined OK (
  if exist "%~dpn1.gif" del /f /q "%~dpn1.gif"
  if defined TMPD rd /s /q "!TMPD!" 2>nul
  echo     失败   %~nx1
  goto :eof
)

rem 没设目标体积、或已达标，就收工
if not defined TARGETKB goto :done_ok
set /a LIMIT=TARGETKB*1024
if !SZ! LEQ !LIMIT! goto :done_ok

rem 超标了，按 质量、帧率、宽度的顺序降一档。条件都用旧值比较，改错的只有命中那一支
set "NEXT="
if !QCUR! GTR 60 (
  set "QCUR=60"
  set "NEXT=质量 60"
) else if !QCUR! GTR 45 (
  set "QCUR=45"
  set "NEXT=质量 45"
) else if !QCUR! GTR 30 (
  set "QCUR=30"
  set "NEXT=质量 30"
) else if !FPSCUR! GTR 12 (
  set "FPSCUR=12"
  set "NEXT=帧率 12"
) else if !FPSCUR! GTR 10 (
  set "FPSCUR=10"
  set "NEXT=帧率 10"
) else if !WCUR! GTR 200 (
  set "WCUR=200"
  set "NEXT=宽度 200"
) else if !WCUR! GTR 160 (
  set "WCUR=160"
  set "NEXT=宽度 160"
)

if not defined NEXT (
  if defined TMPD rd /s /q "!TMPD!" 2>nul
  echo     [!] 质量帧率宽度都到最低档，仍超过目标 !TARGETKB!KB，现在 !SZ! 字节
  echo     想再小只能截短时长：在 config.txt 里给 MAXDUR 填个秒数，比如 3
  goto :eof
)
echo     超过目标 !TARGETKB!KB，自动降档：!NEXT!
goto :retry_encode

:done_ok
if defined TMPD rd /s /q "!TMPD!" 2>nul
echo     成功   %~dpn1.gif  [!SZ! 字节]
goto :eof

rem 抽 rgba PNG 帧。gifski 认 PNG 里的 alpha 并自己做 1-bit 阈值，不走 ALPHATH
:extract_png
if defined TMPD rd /s /q "!TMPD!" 2>nul
set "TMPD=%TEMP%\v2g_png_%RANDOM%%RANDOM%"
mkdir "!TMPD!"
"!FF!" -hide_banner -loglevel error !STOP! -y -i "%~f1" -vf "fps=!FPSCUR!,scale=!WCUR!:-2:flags=lanczos,format=rgba" "!TMPD!\f%%06d.png"
set "EXFPS=!FPSCUR!"
set "EXW=!WCUR!"
goto :eof
