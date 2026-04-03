[CmdletBinding()]
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5000,
    [switch]$NoBrowser,
    [switch]$PreviewBuild,
    [switch]$DryRun,
    [string]$LogPath,
    [int]$WaitTimeoutSeconds = 35
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ClientDir = Join-Path $ProjectRoot 'client'
$PythonExe = Join-Path $ProjectRoot '.venv\Scripts\python.exe'
$StaticDist = Join-Path $ClientDir 'dist'
$MainPy = Join-Path $ProjectRoot 'main.py'
$PackageJsonPath = Join-Path $ClientDir 'package.json'

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

function Resolve-NpmLauncher {
    $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npmCmd) {
        return @{ FilePath = 'cmd.exe'; PrefixArgs = @('/d', '/c', $npmCmd.Source) ; Display = 'npm.cmd' }
    }
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) {
        return @{ FilePath = 'cmd.exe'; PrefixArgs = @('/d', '/c', $npm.Source) ; Display = $npm.Name }
    }
    throw "Required command 'npm' was not found in PATH."
}

function Test-PortAvailable {
    param([int]$Port)
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [string]$Label,
        [int]$TimeoutSeconds = 30
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -lt 500) {
                Write-Step "$Label ready at $Url" 'Green'
                return
            }
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }
    throw "$Label did not become ready at $Url within $TimeoutSeconds seconds. The launcher now uses --strictPort, so a port mismatch usually means the port is busy or the dev server failed to boot."
}

function Format-CommandForLog {
    param([string]$FilePath, [string[]]$Arguments)
    $parts = @($FilePath) + $Arguments
    return ($parts | ForEach-Object {
        if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
    }) -join ' '
}

function Start-OrDescribeProcess {
    param(
        [string]$Label,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$WaitUrl,
        [string]$WaitLabel
    )
    Write-Step $Label
    $display = Format-CommandForLog -FilePath $FilePath -Arguments $Arguments
    if ($DryRun) {
        Write-Step "[dry-run] Would run in $WorkingDirectory: $display" 'Yellow'
        return $null
    }
    $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -PassThru
    Write-Step "Started PID $($proc.Id): $display" 'DarkGray'
    if ($WaitUrl) {
        Wait-ForHttp -Url $WaitUrl -Label $WaitLabel -TimeoutSeconds $WaitTimeoutSeconds
    }
    return $proc
}

$LogPath = Initialize-LogFile -RequestedPath $LogPath -Header "LangSuite launch log $(Get-Date -Format s)"

if ($BackendPort -lt 1 -or $BackendPort -gt 65535 -or $FrontendPort -lt 1 -or $FrontendPort -gt 65535) {
    throw 'Ports must be between 1 and 65535.'
}
if ($WaitTimeoutSeconds -lt 5 -or $WaitTimeoutSeconds -gt 180) {
    throw 'WaitTimeoutSeconds must be between 5 and 180.'
}

Require-Path $PythonExe 'Virtual environment python.exe'
Require-Path $MainPy 'Backend main.py'
Require-Path $PackageJsonPath 'Frontend package.json'
Require-Path (Join-Path $ClientDir 'node_modules') 'Frontend node_modules'
Require-Command cmd.exe
$npmLauncher = Resolve-NpmLauncher
if ($PreviewBuild) {
    Require-Path $StaticDist 'Built frontend dist directory'
    Write-Step 'Preview mode uses the built dist output from the last successful install/build step.'
} else {
    Write-Step 'Default launch mode mirrors the real QA path: backend + Vite dev server on the fixed frontend port. This is a local QA/dev flow, not a packaged desktop launcher.' 'Yellow'
}

if (-not $DryRun) {
    if (-not (Test-PortAvailable -Port $BackendPort)) {
        throw "Backend port $BackendPort is already in use. Choose another port or free it before launching."
    }
    if (-not (Test-PortAvailable -Port $FrontendPort)) {
        throw "Frontend port $FrontendPort is already in use. The launcher now uses --strictPort and will not silently drift to another port."
    }
}

$backendArgs = @('-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', "$BackendPort")
$frontendArgs = if ($PreviewBuild) {
    $npmLauncher.PrefixArgs + @('run', 'preview', '--', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort')
} else {
    $npmLauncher.PrefixArgs + @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort')
}

Start-OrDescribeProcess -Label "Starting backend on http://127.0.0.1:$BackendPort" -FilePath $PythonExe -Arguments $backendArgs -WorkingDirectory $ProjectRoot -WaitUrl "http://127.0.0.1:$BackendPort/openapi.json" -WaitLabel 'Backend'
Start-OrDescribeProcess -Label "Starting frontend on http://127.0.0.1:$FrontendPort using $($npmLauncher.Display)" -FilePath $npmLauncher.FilePath -Arguments $frontendArgs -WorkingDirectory $ClientDir -WaitUrl "http://127.0.0.1:$FrontendPort" -WaitLabel 'Frontend'

if (-not $NoBrowser) {
    if ($DryRun) {
        Write-Step "[dry-run] Would open browser: http://127.0.0.1:$FrontendPort" 'Yellow'
    } else {
        Start-Process "http://127.0.0.1:$FrontendPort" | Out-Null
    }
}

Write-Step 'LangSuite launcher prepared:' 'Green'
Write-Step "  Backend  -> http://127.0.0.1:$BackendPort" 'Green'
Write-Step "  Frontend -> http://127.0.0.1:$FrontendPort" 'Green'
if ($DryRun) {
    Write-Step 'Dry-run mode only validated launch prerequisites and command composition.' 'Yellow'
}
