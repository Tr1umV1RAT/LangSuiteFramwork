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

function Stop-LangSuiteProcess {
    param([string]$RootPath)
    $escaped = [Regex]::Escape($RootPath)
    $candidates = Get-CimInstance Win32_Process | Where-Object {
        ($_.CommandLine -match $escaped) -and (
            $_.CommandLine -match 'uvicorn' -or
            $_.CommandLine -match 'vite' -or
            $_.CommandLine -match 'node(.exe)? .*vite' -or
            $_.CommandLine -match 'npm(.cmd)? run dev' -or
            $_.CommandLine -match 'npm(.cmd)? run preview'
        )
    }
    if (-not $candidates) {
        Write-Step 'No obvious LangSuite backend/frontend processes were found.' 'Yellow'
        return
    }
    foreach ($proc in $candidates) {
        try {
            if ($DryRun) {
                Write-Step "[dry-run] Would stop process $($proc.ProcessId)" 'Yellow'
            } else {
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
                Write-Step "Stopped process $($proc.ProcessId)" 'Green'
            }
        } catch {
            Write-Warning "Failed to stop process $($proc.ProcessId): $_"
        }
    }
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite stop log $(Get-Date -Format s)"
Write-Step 'Stopping obvious local LangSuite processes...'
Stop-LangSuiteProcess -RootPath $ProjectRoot
if ($DryRun) {
    Write-Step 'Dry-run mode only described the stop plan.' 'Yellow'
}
