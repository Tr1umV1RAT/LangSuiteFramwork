[CmdletBinding()]
param(
    [switch]$Desktop,
    [switch]$StartMenu,
    [switch]$DryRun,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ManagerBat = Join-Path $PSScriptRoot 'manager.bat'
$LaunchBat = Join-Path $PSScriptRoot 'launch.bat'

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

function New-WindowsShortcut {
    param(
        [string]$ShortcutPath,
        [string]$TargetPath,
        [string]$WorkingDirectory,
        [string]$Description
    )
    if ($DryRun) {
        Write-Step "[dry-run] Would create shortcut $ShortcutPath -> $TargetPath" 'Yellow'
        return
    }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
    $shortcut.Save()
    Write-Step "Created shortcut $ShortcutPath" 'Green'
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite shortcut log $(Get-Date -Format s)"
if (-not $Desktop -and -not $StartMenu) {
    $Desktop = $true
}

$targets = @()
if ($Desktop) {
    $targets += @{ Base = [Environment]::GetFolderPath('Desktop'); Label = 'Desktop' }
}
if ($StartMenu) {
    $programs = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\LangSuite'
    $targets += @{ Base = $programs; Label = 'Start Menu' }
}

foreach ($entry in $targets) {
    $base = $entry.Base
    if (-not $DryRun) {
        New-Item -ItemType Directory -Force -Path $base | Out-Null
    }
    $managerShortcut = Join-Path $base 'LangSuite Manager.lnk'
    $launchShortcut = Join-Path $base 'LangSuite Launch.lnk'
    New-WindowsShortcut -ShortcutPath $managerShortcut -TargetPath $ManagerBat -WorkingDirectory $ProjectRoot -Description 'Open the LangSuite Windows manager.'
    New-WindowsShortcut -ShortcutPath $launchShortcut -TargetPath $LaunchBat -WorkingDirectory $ProjectRoot -Description 'Launch LangSuite directly with the QA launcher.'
    Write-Step "$($entry.Label) shortcuts prepared." 'Green'
}

if ($DryRun) {
    Write-Step 'Dry-run mode only validated the shortcut plan.' 'Yellow'
}
