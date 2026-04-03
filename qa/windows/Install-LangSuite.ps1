[CmdletBinding()]
param(
    [switch]$ReinstallNodeModules,
    [switch]$SkipFrontendBuild,
    [switch]$SkipDbInit,
    [switch]$CreateDesktopShortcut,
    [switch]$CreateStartMenuShortcut,
    [switch]$DryRun,
    [string]$LogPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ClientDir = Join-Path $ProjectRoot 'client'
$VenvDir = Join-Path $ProjectRoot '.venv'
$PythonExe = Join-Path $VenvDir 'Scripts\python.exe'
$NodeModulesDir = Join-Path $ClientDir 'node_modules'
$RequirementsPath = Join-Path $ProjectRoot 'requirements.txt'
$PackageJsonPath = Join-Path $ClientDir 'package.json'
$ShortcutScript = Join-Path $PSScriptRoot 'CreateShortcuts-LangSuite.ps1'

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

function Require-Path {
    param([string]$PathToCheck, [string]$Label)
    if (-not (Test-Path $PathToCheck)) {
        throw "$Label was not found at $PathToCheck"
    }
}

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Invoke-External {
    param([string]$Label, [scriptblock]$Action)
    Write-Step $Label
    if ($DryRun) {
        Write-Step "[dry-run] Skipped: $Label" 'Yellow'
        return
    }
    & $Action
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite install log $(Get-Date -Format s)"

Require-Path $RequirementsPath 'Backend requirements.txt'
Require-Path $PackageJsonPath 'Frontend package.json'
Require-Command npm
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3 was not found. Install Python or enable the 'py' launcher first."
}

if (-not (Test-Path $VenvDir)) {
    Invoke-External "Creating Python virtual environment in $VenvDir" {
        if (Get-Command py -ErrorAction SilentlyContinue) {
            & py -3 -m venv $VenvDir
        } else {
            & python -m venv $VenvDir
        }
    }
}

if (-not $DryRun) {
    Require-Path $PythonExe 'Virtual environment python.exe'
}

Invoke-External 'Installing backend dependencies...' {
    & $PythonExe -m pip install --upgrade pip
    & $PythonExe -m pip install -r $RequirementsPath
}

if ($ReinstallNodeModules -and (Test-Path $NodeModulesDir)) {
    Invoke-External 'Removing existing node_modules before reinstall...' {
        Remove-Item $NodeModulesDir -Recurse -Force
    }
}

Write-Step 'Installing frontend dependencies...'
if (-not $DryRun) { Push-Location $ClientDir }
try {
    if (Test-Path (Join-Path $ClientDir 'package-lock.json')) {
        Invoke-External 'Running npm ci' { npm ci }
    } else {
        Invoke-External 'Running npm install' { npm install }
    }

    if (-not $SkipFrontendBuild) {
        Invoke-External 'Building frontend assets with npm run build' { npm run build }
    }
} finally {
    if (-not $DryRun) { Pop-Location }
}

if (-not $SkipDbInit) {
    Invoke-External 'Initializing local database state...' {
        Push-Location $ProjectRoot
        try {
            & $PythonExe -c "import db; print('LangSuite DB initialized')"
        } finally {
            Pop-Location
        }
    }
}

if ($CreateDesktopShortcut -or $CreateStartMenuShortcut) {
    Invoke-External 'Creating optional Windows shortcuts...' {
        & $ShortcutScript -Desktop:$CreateDesktopShortcut -StartMenu:$CreateStartMenuShortcut -DryRun:$DryRun -LogPath $LogPath
    }
}

Write-Step ''
Write-Step 'LangSuite QA install complete.' 'Green'
Write-Step "Launcher: $ProjectRoot\qa\windows\Launch-LangSuite.ps1" 'Green'
Write-Step "Manager:  $ProjectRoot\qa\windows\LangSuiteLauncher.pyw" 'Green'
if ($DryRun) {
    Write-Step 'Dry-run mode only validated paths, prerequisites, and intended commands.' 'Yellow'
}
