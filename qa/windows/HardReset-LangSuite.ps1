[CmdletBinding()]
param(
    [switch]$RemoveNodeModules,
    [switch]$CleanNpmCache,
    [switch]$DryRun,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ClientDir = Join-Path $ProjectRoot 'client'

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
            $_.CommandLine -match 'npm run dev' -or
            $_.CommandLine -match 'npm run preview'
        )
    }
    foreach ($proc in $candidates) {
        try {
            if ($DryRun) {
                Write-Step "[dry-run] Would stop process $($proc.ProcessId)" 'Yellow'
            } else {
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
                Write-Step "Stopped process $($proc.ProcessId)" 'Yellow'
            }
        } catch {
            Write-Warning "Failed to stop process $($proc.ProcessId): $_"
        }
    }
}

function Remove-IfExists {
    param([string]$PathToRemove)
    if (Test-Path $PathToRemove) {
        if ($DryRun) {
            Write-Step "[dry-run] Would remove $PathToRemove" 'Yellow'
        } else {
            Remove-Item $PathToRemove -Recurse -Force
            Write-Step "Removed $PathToRemove" 'DarkGray'
        }
    }
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite hard reset log $(Get-Date -Format s)"

Write-Step 'Stopping obvious local LangSuite processes...'
Stop-LangSuiteProcess -RootPath $ProjectRoot

Remove-IfExists (Join-Path $ClientDir 'dist')
Remove-IfExists (Join-Path $ProjectRoot 'static')
Remove-IfExists (Join-Path $ClientDir 'tsconfig.tsbuildinfo')
Remove-IfExists (Join-Path $ProjectRoot '.pytest_cache')

Get-ChildItem -Path $ProjectRoot -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-IfExists $_.FullName }

Get-ChildItem -Path (Join-Path $ProjectRoot 'db') -Filter 'langgraph_builder.db*' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-IfExists $_.FullName }
Get-ChildItem -Path (Join-Path $ProjectRoot 'data') -Filter '*.db*' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-IfExists $_.FullName }

if ($RemoveNodeModules) {
    Remove-IfExists (Join-Path $ClientDir 'node_modules')
}

if ($CleanNpmCache) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warning 'npm not found in PATH; skipping npm cache cleanup.'
    } elseif ($DryRun) {
        Write-Step '[dry-run] Would run: npm cache clean --force' 'Yellow'
    } else {
        npm cache clean --force
    }
}

Write-Step 'LangSuite hard reset complete.' 'Green'
if ($DryRun) {
    Write-Step 'Dry-run mode only described the cleanup plan.' 'Yellow'
}
