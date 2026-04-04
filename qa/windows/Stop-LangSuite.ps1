[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Write-Step {
    param([string]$Message, [string]$Color = 'Cyan')
    Write-Host $Message -ForegroundColor $Color
    if ($LogPath) { Add-Content -Path $LogPath -Value $Message }
}

function Initialize-LogFile {
    param([string]$RequestedPath, [string]$Header)
    if (-not $RequestedPath) { return $null }
    $resolvedPath = if ([System.IO.Path]::IsPathRooted($RequestedPath)) { $RequestedPath } else { Join-Path $ProjectRoot $RequestedPath }
    $parent = Split-Path -Parent $resolvedPath
    if ($parent) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Set-Content -Path $resolvedPath -Value $Header
    return $resolvedPath
}

function Expand-DescendantProcessIds {
    param([uint32[]]$RootIds)
    $all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)
    $queue = New-Object System.Collections.Generic.Queue[uint32]
    $seen = @{}
    foreach ($root in $RootIds) {
        if ($root -and -not $seen.ContainsKey($root)) {
            $seen[$root] = $true
            $queue.Enqueue([uint32]$root)
        }
    }
    while ($queue.Count -gt 0) {
        $current = $queue.Dequeue()
        foreach ($proc in $all) {
            if ($proc.ParentProcessId -eq $current -and -not $seen.ContainsKey([uint32]$proc.ProcessId)) {
                $seen[[uint32]$proc.ProcessId] = $true
                $queue.Enqueue([uint32]$proc.ProcessId)
            }
        }
    }
    return @($seen.Keys | ForEach-Object { [uint32]$_ })
}

function Get-ProtectedAncestorProcessIds {
    $protected = @{}
    $current = [uint32]$PID
    while ($current -and -not $protected.ContainsKey($current)) {
        $protected[$current] = $true
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue
        if (-not $proc -or -not $proc.ParentProcessId -or $proc.ParentProcessId -eq 0) {
            break
        }
        $current = [uint32]$proc.ParentProcessId
    }
    return $protected
}

function Stop-LangSuiteProcess {
    param([string]$RootPath)
    $protected = Get-ProtectedAncestorProcessIds
    $escaped = [Regex]::Escape($RootPath)
    $candidates = @(Get-CimInstance Win32_Process | Where-Object {
        ($_.CommandLine -match $escaped) -and (
            $_.CommandLine -match 'uvicorn' -or
            $_.CommandLine -match 'vite' -or
            $_.CommandLine -match 'node(.exe)? .*vite' -or
            $_.CommandLine -match 'npm(.cmd)? run dev' -or
            $_.CommandLine -match 'npm(.cmd)? run preview'
        )
    })
    if (-not $candidates) {
        Write-Step 'No obvious LangSuite backend/frontend processes were found.' 'Yellow'
        return
    }

    $rootIds = @($candidates | Where-Object { -not $protected.ContainsKey([uint32]$_.ProcessId) } | ForEach-Object { [uint32]$_.ProcessId })
    if (-not $rootIds) {
        Write-Step 'No obvious LangSuite backend/frontend processes remained after excluding the current shell ancestry.' 'Yellow'
        return
    }

    foreach ($procId in (Expand-DescendantProcessIds -RootIds $rootIds | Sort-Object -Descending)) {
        if ($protected.ContainsKey([uint32]$procId)) { continue }
        try {
            if ($DryRun) {
                Write-Step "[dry-run] Would stop process $procId" 'Yellow'
            } else {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Step "Stopped process $procId" 'Green'
            }
        } catch {
            Write-Warning "Failed to stop process $procId: $_"
        }
    }
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite stop log $(Get-Date -Format s)"
Write-Step 'Stopping obvious local LangSuite processes...'
Stop-LangSuiteProcess -RootPath $ProjectRoot
if ($DryRun) {
    Write-Step 'Dry-run mode only described the stop plan.' 'Yellow'
}
