@echo off
setlocal EnableDelayedExpansion
rem 本文件编码必须是 GBK(cp936) + CRLF 行尾，编辑器里别改成 UTF-8

rem ============================================================
rem  一键下载 ffmpeg 到本目录 bin\ ，让 Video2Gif.cmd 免配置运行
rem  只下 essentials 完整构建，不是精简版
rem  注意：echo 的文字里不要出现括号，会破坏 cmd 的块语法解析
rem ============================================================

set "HERE=%~dp0"
set "BINDIR=%~dp0bin\"
if not exist "!BINDIR!" mkdir "!BINDIR!"

echo 目标目录：!BINDIR!
echo.

rem 校验 bin 里已有的 ffmpeg 能不能用
if exist "!BINDIR!ffmpeg.exe" goto :check_existing
goto :need_download

:check_existing
echo bin\ffmpeg.exe 已存在，检查可用性...
rem 先看版本字样，防住名字叫 ffmpeg 实际是别的程序的情况，再冒烟测 yuv4mpegpipe
"!BINDIR!ffmpeg.exe" -hide_banner -version 2>&1 | findstr /i /c:"ffmpeg version" >nul
if errorlevel 1 goto :bad_existing
"!BINDIR!ffmpeg.exe" -hide_banner -f lavfi -i "color=black:s=16x16:d=0.1" -f yuv4mpegpipe - >nul 2>&1
if errorlevel 1 goto :bad_existing
echo 已可用，无需下载。直接拖视频到 Video2Gif.cmd 即可。
if not defined NO_PAUSE pause
exit /b 0

:bad_existing
echo 现有 ffmpeg 不可用，可能是精简版，将重新下载。
echo.

:need_download
rem 优先用 curl，Win10 1803 以上自带；其次 powershell
set "DL="
where curl.exe >nul 2>&1 && set "DL=curl"
if not defined DL where powershell.exe >nul 2>&1 && set "DL=ps"

if not defined DL goto :no_downloader

set "URL=https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
set "ZIP=%TEMP%\ffmpeg-v2g.zip"

echo 下载中：约 100MB，视网速可能需要几分钟
echo !URL!
if "!DL!"=="curl" (
  curl.exe -L --fail --retry 3 --retry-delay 2 -C - -o "!ZIP!" "!URL!"
) else (
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try{Invoke-WebRequest -Uri '!URL!' -OutFile '!ZIP!' -UseBasicParsing}catch{Write-Host $_; exit 1}"
)

if not exist "!ZIP!" goto :dl_failed

rem 体积校验：完整包约 100MB，小于 50MB 说明下载被中断或代理返回了错误页
for %%S in ("!ZIP!") do set "ZSZ=%%~zS"
if !ZSZ! LSS 52428800 goto :dl_partial
echo 下载完成：!ZSZ! 字节

echo 解压中...
set "EXDIR=%TEMP%\ffmpeg-v2g-x"
if exist "!EXDIR!" rd /s /q "!EXDIR!"
powershell -NoProfile -Command "Expand-Archive -LiteralPath '!ZIP!' -DestinationPath '!EXDIR!' -Force"
if errorlevel 1 goto :unzip_failed

rem 解压出来是嵌套结构 ffmpeg-*-essentials_build\bin\ffmpeg.exe，递归找出来拷到 bin\
set "FOUND="
for /r "!EXDIR!" %%F in (ffmpeg.exe) do if not defined FOUND set "FOUND=%%~fF"
if not defined FOUND goto :unzip_failed
for %%F in ("!FOUND!") do set "SRCDIR=%%~dpF"

copy /y "!SRCDIR!ffmpeg.exe" "!BINDIR!ffmpeg.exe" >nul
if errorlevel 1 goto :copy_failed
for %%S in ("!BINDIR!ffmpeg.exe") do if %%~zS LSS 1048576 goto :copy_failed
if exist "!SRCDIR!ffprobe.exe" (
  copy /y "!SRCDIR!ffprobe.exe" "!BINDIR!ffprobe.exe" >nul
  if errorlevel 1 goto :copy_failed
)

echo.
echo 验证...
rem 版本字样必须能匹配到，防住 bin 里躺着同名假货的情况
"!BINDIR!ffmpeg.exe" -hide_banner -version 2>&1 | findstr /i /c:"ffmpeg version" >nul
if errorlevel 1 goto :verify_failed
"!BINDIR!ffmpeg.exe" -hide_banner -f lavfi -i "color=black:s=16x16:d=0.1" -f yuv4mpegpipe - >nul 2>&1
if errorlevel 1 goto :verify_failed

rd /s /q "!EXDIR!" 2>nul
del /f /q "!ZIP!" 2>nul

echo.
echo 安装完成。现在可以直接把视频拖到 Video2Gif.cmd 上了。
if not defined NO_PAUSE pause
exit /b 0

:copy_failed
echo [x] 复制 ffmpeg 到 bin 目录失败，旧文件还在，已保留解压目录供手动补救
echo     手动把 ffmpeg.exe 和 ffprobe.exe 从下面目录拷进 bin 也可以：
echo     !EXDIR!
if not defined NO_PAUSE pause
exit /b 1

:no_downloader
echo [x] 本机没有 curl 也没有 powershell，无法自动下载。
echo     请手动下载 ffmpeg 并解压，把 ffmpeg.exe 和 ffprobe.exe 放进：
echo     !BINDIR!
echo     下载地址：https://www.gyan.dev/ffmpeg/builds/
if not defined NO_PAUSE pause
exit /b 1

:dl_failed
echo [x] 下载失败。检查网络，或手动下载后把 ffmpeg.exe 和 ffprobe.exe 放进 bin\
echo     !URL!
if not defined NO_PAUSE pause
exit /b 1

:dl_partial
echo [x] 下载不完整，只有 !ZSZ! 字节，完整包约 100MB。
echo     常见原因：网络中断、代理拦截。
echo     临时文件已保留，重跑本脚本会断点续传：!ZIP!
if not defined NO_PAUSE pause
exit /b 1

:unzip_failed
echo [x] 解压失败，压缩包可能损坏。
echo     删掉后重跑本脚本：!ZIP!
if not defined NO_PAUSE pause
exit /b 1

:verify_failed
echo [x] 装好了但 yuv4mpegpipe 不可用，请换其他构建
if not defined NO_PAUSE pause
exit /b 1
