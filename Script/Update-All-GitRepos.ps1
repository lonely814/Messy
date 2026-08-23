# ============================================================
# 批量更新 Git 仓库：先拉取，网络失败时硬重置后重试
# 非 git 目录会用 ComfyUI-Manager 插件库按目录名匹配远端，
# 确认后 init+fetch+reset 对齐（适合 zip 安装的 ComfyUI 插件）
# 用法：放在包含多个仓库的父目录，右键 PowerShell 运行；
#       -SelfTest 运行自检
# ============================================================

param([switch]$SelfTest)

function Get-ComfyNodeMap {
    # 从 ComfyUI-Manager 清单建映射：小写目录名(仓库名去 .git) -> 远端 URL
    param([string]$JsonText)
    $map = @{}
    foreach ($entry in ($JsonText | ConvertFrom-Json).custom_nodes) {
        if ($entry.install_type -ne 'git-clone') { continue }
        foreach ($f in @($entry.files)) {
            if ("$f" -like 'http*') {
                $name = ([uri]$f).Segments[-1] -replace '\.git$', ''
                $map[$name.ToLower()] = "$f"
                break
            }
        }
    }
    return $map
}

if ($SelfTest) {
    $sample = '{"custom_nodes":[' +
        '{"install_type":"git-clone","files":["https://github.com/x/ComfyUI_Foo.git"]},' +
        '{"install_type":"git-clone","files":["https://github.com/y/bar"]},' +
        '{"install_type":"copy","files":["https://github.com/z/notgit"]}]}'
    $m = Get-ComfyNodeMap -JsonText $sample
    if ($m['comfyui_foo'] -ne 'https://github.com/x/ComfyUI_Foo.git') { throw 'self-test: 仓库名映射失败' }
    if ($m['bar'] -ne 'https://github.com/y/bar') { throw 'self-test: 去路径/.git 后缀失败' }
    if ($m.ContainsKey('notgit')) { throw 'self-test: 非git条目未过滤' }
    Write-Host 'self-test OK'
    exit 0
}

# 缓冲区参数仅对本次命令生效，不污染全局配置
$gitOpts = @('-c','http.postBuffer=524288000','-c','http.lowSpeedLimit=0','-c','http.lowSpeedTime=999999')

$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

$repos = Get-ChildItem -Path $rootDir -Directory -Recurse | Where-Object { Test-Path "$($_.FullName)\.git" }

if ($repos.Count -eq 0) {
    Write-Host "未找到任何 Git 仓库" -ForegroundColor Yellow
    exit
}

# ---- 非 git 目录匹配用的插件数据库（缓存 7 天）----
$nodeMap = @{}
$dbUrl = 'https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/custom-node-list.json'
$dbCache = Join-Path $rootDir '.node-db-cache.json'
# 空文件或过期都重新下载；先写临时文件再原子替换，避免半截文件毒化缓存
$needDb = -not (Test-Path $dbCache) -or (Get-Item $dbCache).Length -eq 0 -or ((Get-Date) - (Get-Item $dbCache).LastWriteTime).TotalDays -ge 7
if ($needDb) {
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $tmpDb = "$dbCache.part"
        Invoke-WebRequest -Uri $dbUrl -OutFile $tmpDb -UseBasicParsing -TimeoutSec 60
        Move-Item -Force $tmpDb $dbCache
    } catch {
        Remove-Item "$dbCache.part" -ErrorAction SilentlyContinue
        if ((Test-Path $dbCache) -and (Get-Item $dbCache).Length -gt 0) { Write-Host "插件数据库下载失败，使用旧缓存" -ForegroundColor Yellow }
        else { Write-Host "插件数据库下载失败，跳过非 git 目录匹配" -ForegroundColor Yellow }
    }
}
if (Test-Path $dbCache) {
    try { $nodeMap = Get-ComfyNodeMap -JsonText (Get-Content -Raw -Encoding UTF8 $dbCache) }
    catch { Write-Host "插件数据库解析失败，跳过非 git 目录匹配" -ForegroundColor Yellow }
}

Write-Host "找到 $($repos.Count) 个仓库，开始处理..." -ForegroundColor Green
$successCount = 0
$failCount = 0
$startTime = Get-Date

foreach ($repo in $repos) {
    Write-Host "`n>>> 处理: $($repo.FullName)" -ForegroundColor Cyan
    Push-Location $repo.FullName

    # 步骤1：尝试正常拉取（带重试）
    $oldHead = git rev-parse HEAD 2>$null
    $maxRetries = 2
    $retryCount = 0
    $pullOk = $false
    $errorMsg = ""

    while ($retryCount -lt $maxRetries -and -not $pullOk) {
        $retryCount++
        Write-Host "  拉取尝试 $retryCount/$maxRetries ..." -ForegroundColor Yellow
        $output = git @gitOpts pull --rebase --prune 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pullOk = $true
            if ((git rev-parse HEAD) -ne $oldHead) {
                Write-Host "  ✅ 有更新" -ForegroundColor Green
            } else {
                Write-Host "  ✓ 已是最新" -ForegroundColor DarkGray
            }
        } else {
            $errorMsg = $output | Out-String
            if ($retryCount -lt $maxRetries) {
                Write-Host "  ⚠️ 失败，5 秒后重试..." -ForegroundColor Yellow
                Start-Sleep -Seconds 5
            }
        }
    }

    # 步骤2：如果拉取失败且错误信息包含网络关键词，则硬重置后再次拉取
    if (-not $pullOk) {
        $isNetworkError = $errorMsg -match "RPC failed|curl 56|early EOF|unexpected disconnect|schannel|SSL"
        if ($isNetworkError) {
            Write-Host "  ⚠️ 检测到网络错误，清理状态后重新拉取..." -ForegroundColor Yellow
            git rebase --abort 2>$null  # 清理可能卡住的 rebase 中间态
            # 硬重置会丢已跟踪文件的未提交改动，有改动则跳过保护数据
            $dirty = git status --porcelain --untracked-files=no
            if ($dirty) {
                Write-Host "  ❌ 存在未提交改动，跳过硬重置（请手动处理）" -ForegroundColor Red
                $failCount++
                Pop-Location
                continue
            }
            git @gitOpts reset --hard HEAD
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ 硬重置失败，跳过该仓库" -ForegroundColor Red
                $failCount++
                Pop-Location
                continue
            }
            # 重置后再拉取一次
            Write-Host "  重新拉取..." -ForegroundColor Yellow
            git @gitOpts pull --rebase --prune
            if ($LASTEXITCODE -eq 0) {
                $pullOk = $true
                if ((git rev-parse HEAD) -ne $oldHead) {
                    Write-Host "  ✅ 硬重置后有更新" -ForegroundColor Green
                } else {
                    Write-Host "  ✓ 已是最新" -ForegroundColor DarkGray
                }
            } else {
                Write-Host "  ❌ 硬重置后拉取仍失败" -ForegroundColor Red
            }
        } else {
            Write-Host "  ❌ 拉取失败（非网络错误），跳过该仓库" -ForegroundColor Red
            Write-Host "  错误摘要: $($errorMsg.Substring(0, [Math]::Min(200, $errorMsg.Length)))" -ForegroundColor Yellow
        }
    }

    if ($pullOk) {
        $successCount++
    } else {
        $failCount++
    }

    Pop-Location
}

# ---- 处理非 git 目录（仅扫顶层，含仓库的父目录已排除）----
# ponytail: 只扫顶层且只靠仓库名匹配；若要支持改名目录，升级为读 CSV 映射表覆盖
$adoptCount = 0
$noMatch = @()
if ($nodeMap.Count -gt 0) {
    Write-Host "`n========== 检查非 git 目录 ==========" -ForegroundColor Magenta
    $repoPaths = @($repos | ForEach-Object { $_.FullName })
    $candidates = @(Get-ChildItem -Path $rootDir -Directory | Where-Object {
        $p = $_.FullName
        ($_.Name -ne '__pycache__') -and
        -not (Test-Path "$p\.git") -and
        -not (@($repoPaths | Where-Object { $_.StartsWith($p + '\', [StringComparison]::OrdinalIgnoreCase) }).Count)
    })

    foreach ($cand in $candidates) {
        $key = $cand.Name.ToLower()
        if (-not $nodeMap.ContainsKey($key)) { $noMatch += $cand.Name; continue }
        $url = $nodeMap[$key]
        Write-Host "`n>>> 非 git 目录: $($cand.Name)" -ForegroundColor Cyan
        Write-Host "    匹配仓库: $url" -ForegroundColor Gray
        $ans = Read-Host "    对齐到该仓库？将覆盖目录内与远端不同的文件 (y/N)"
        if ($ans -notmatch '^[Yy]') { continue }

        Push-Location $cand.FullName
        git init 2>&1 | Out-Null
        git remote remove origin 2>$null
        git remote add origin $url
        git fetch origin --tags 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ fetch 失败，跳过" -ForegroundColor Red
            Pop-Location
            continue
        }
        git remote set-head origin --auto 2>&1 | Out-Null
        $branch = (git symbolic-ref --short refs/remotes/origin/HEAD 2>$null) -replace '^origin/', ''
        if (-not $branch) {
            foreach ($guess in @('main', 'master')) {
                if (git rev-parse -q --verify "refs/remotes/origin/$guess" *> $null) { $branch = $guess; break }
            }
        }
        if (-not $branch) {
            Write-Host "  ❌ 无法确定默认分支，跳过" -ForegroundColor Red
            Pop-Location
            continue
        }
        git checkout -f -B $branch --track "origin/$branch" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ 已对齐到 origin/$branch" -ForegroundColor Green
            $adoptCount++
        } else {
            Write-Host "  ❌ checkout 失败，该目录可能处于混合状态，请手动检查" -ForegroundColor Red
        }
        Pop-Location
    }

    if ($noMatch.Count -gt 0) {
        Write-Host "`n以下目录未在插件库中匹配到，请手动确认来源:" -ForegroundColor Yellow
        Write-Host ($noMatch -join ', ')
    }
}

$elapsed = (Get-Date) - $startTime
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "完成：成功 $successCount 个，失败 $failCount 个" -ForegroundColor Green
if ($adoptCount -gt 0) { Write-Host "新对齐非 git 目录：$adoptCount 个" -ForegroundColor Green }
Write-Host "总耗时：$($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green