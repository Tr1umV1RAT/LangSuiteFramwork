[CmdletBinding()]
param(
    [switch]$CleanNpmCache,
    [switch]$RemoveShortcuts,
    [switch]$DryRun,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ResetScript = Join-Path $PSScriptRoot 'HardReset-LangSuite.ps1'
$VenvDir = Join-Path $ProjectRoot '.venv'
$ClientNodeModules = Join-Path $ProjectRoot 'client\node_modules'
$StartMenuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\LangSuite'
$DesktopManager = Join-Path ([Environment]::GetFolderPath('Desktop')) 'LangSuite Manager.lnk'
$DesktopLaunch = Join-Path ([Environment]::GetFolderPath('Desktop')) 'LangSuite Launch.lnk'

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

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite uninstall log $(Get-Date -Format s)"

& $ResetScript -RemoveNodeModules -CleanNpmCache:$CleanNpmCache -DryRun:$DryRun -LogPath $LogPath
Remove-IfExists $VenvDir
Remove-IfExists $ClientNodeModules
if ($RemoveShortcuts) {
    Remove-IfExists $DesktopManager
    Remove-IfExists $DesktopLaunch
    Remove-IfExists $StartMenuDir
}

Write-Step 'LangSuite local QA uninstall complete.' 'Green'
if ($RemoveShortcuts) { Write-Step 'Windows shortcuts were also removed when present.' 'Green' }
if ($DryRun) {
    Write-Step 'Dry-run mode only described uninstall cleanup.' 'Yellow'
}
