# ============================================================
# 批量更新 Git 仓库：先拉取，网络失败时硬重置后重试
# 用法：放在包含多个仓库的父目录，右键 PowerShell 运行
# ============================================================

# 全局设置：增大缓冲区，避免大文件传输中断
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

$repos = Get-ChildItem -Path $rootDir -Directory -Recurse | Where-Object { Test-Path "$($_.FullName)\.git" }

if ($repos.Count -eq 0) {
    Write-Host "未找到任何 Git 仓库" -ForegroundColor Yellow
    exit
}

Write-Host "找到 $($repos.Count) 个仓库，开始处理..." -ForegroundColor Green
$successCount = 0
$failCount = 0
$startTime = Get-Date

foreach ($repo in $repos) {
    Write-Host "`n>>> 处理: $($repo.FullName)" -ForegroundColor Cyan
    Push-Location $repo.FullName

    # 步骤1：尝试正常拉取（带重试）
    $maxRetries = 2
    $retryCount = 0
    $pullOk = $false
    $errorMsg = ""

    while ($retryCount -lt $maxRetries -and -not $pullOk) {
        $retryCount++
        Write-Host "  拉取尝试 $retryCount/$maxRetries ..." -ForegroundColor Yellow
        $output = git pull --rebase --prune 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pullOk = $true
            Write-Host "  ✅ 拉取成功" -ForegroundColor Green
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
            Write-Host "  ⚠️ 检测到网络错误，执行硬重置后重新拉取..." -ForegroundColor Yellow
            git reset --hard HEAD
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ 硬重置失败，跳过该仓库" -ForegroundColor Red
                $failCount++
                Pop-Location
                continue
            }
            # 重置后再拉取一次
            Write-Host "  重新拉取..." -ForegroundColor Yellow
            git pull --rebase --prune
            if ($LASTEXITCODE -eq 0) {
                $pullOk = $true
                Write-Host "  ✅ 硬重置后拉取成功" -ForegroundColor Green
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

$elapsed = (Get-Date) - $startTime
Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "完成：成功 $successCount 个，失败 $failCount 个" -ForegroundColor Green
Write-Host "总耗时：$($elapsed.ToString('hh\:mm\:ss'))" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green