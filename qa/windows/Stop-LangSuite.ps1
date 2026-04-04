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

function Get-ProcessPropertyValue {
    param([object]$Proc, [string[]]$Names)
    foreach ($name in $Names) {
        $prop = $Proc.PSObject.Properties[$name]
        if ($null -ne $prop) {
            $value = $prop.Value
            if ($null -ne $value -and "$value".Trim() -ne '') {
                return $value
            }
        }
    }
    return $null
}

function Get-ProcessIdValue {
    param([object]$Proc)
    $value = Get-ProcessPropertyValue -Proc $Proc -Names @('ProcessId', 'Id', 'Handle')
    if ($null -eq $value) { return $null }
    try { return [int]$value } catch { return $null }
}

function Get-ParentProcessIdValue {
    param([object]$Proc)
    $value = Get-ProcessPropertyValue -Proc $Proc -Names @('ParentProcessId', 'ParentProcessID')
    if ($null -eq $value) { return 0 }
    try { return [int]$value } catch { return 0 }
}

function Get-CommandLineValue {
    param([object]$Proc)
    $value = Get-ProcessPropertyValue -Proc $Proc -Names @('CommandLine')
    if ($null -eq $value) { return '' }
    return [string]$value
}

function Get-NormalizedProcessSnapshot {
    $normalized = @()
    foreach ($proc in @(Get-CimInstance Win32_Process)) {
        $procId = Get-ProcessIdValue -Proc $proc
        if ($null -eq $procId) {
            continue
        }
        $normalized += [pscustomobject]@{
            ProcessId = $procId
            ParentProcessId = Get-ParentProcessIdValue -Proc $proc
            CommandLine = Get-CommandLineValue -Proc $proc
            Name = [string](Get-ProcessPropertyValue -Proc $proc -Names @('Name'))
        }
    }
    return @($normalized)
}

function Get-ProtectedProcessIds {
    $protected = New-Object 'System.Collections.Generic.HashSet[int]'
    $cursor = Get-CimInstance Win32_Process -Filter "ProcessId = $PID" -ErrorAction SilentlyContinue
    while ($null -ne $cursor) {
        $cursorId = Get-ProcessIdValue -Proc $cursor
        if ($null -eq $cursorId) { break }
        $null = $protected.Add($cursorId)
        $parentId = Get-ParentProcessIdValue -Proc $cursor
        if ($parentId -le 0 -or $parentId -eq $cursorId) { break }
        $cursor = Get-CimInstance Win32_Process -Filter "ProcessId = $parentId" -ErrorAction SilentlyContinue
    }
    return $protected
}

function Get-LangSuiteProcessStopOrder {
    param([string]$RootPath)

    $escaped = [Regex]::Escape($RootPath)
    $all = @(Get-NormalizedProcessSnapshot)
    $protected = Get-ProtectedProcessIds
    $childrenByParent = @{}
    foreach ($proc in $all) {
        $parentId = [int]$proc.ParentProcessId
        if (-not $childrenByParent.ContainsKey($parentId)) {
            $childrenByParent[$parentId] = @()
        }
        $childrenByParent[$parentId] += ,$proc
    }

    $matched = @(
        $all | Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match $escaped -and (
                $_.CommandLine -match 'uvicorn' -or
                $_.CommandLine -match 'vite' -or
                $_.CommandLine -match 'node(.exe)? .*vite' -or
                $_.CommandLine -match 'npm(.cmd)? run dev' -or
                $_.CommandLine -match 'npm(.cmd)? run preview'
            ) -and
            -not $protected.Contains([int]$_.ProcessId)
        }
    )

    if (-not $matched) {
        return @()
    }

    $seen = New-Object 'System.Collections.Generic.HashSet[int]'
    $ordered = New-Object System.Collections.ArrayList

    function Add-Tree {
        param([object]$Proc)
        $procId = Get-ProcessIdValue -Proc $Proc
        if ($null -eq $procId) { return }
        if ($protected.Contains($procId) -or $seen.Contains($procId)) { return }
        $null = $seen.Add($procId)
        foreach ($child in @($childrenByParent[$procId])) {
            Add-Tree -Proc $child
        }
        [void]$ordered.Add($Proc)
    }

    foreach ($proc in $matched) {
        Add-Tree -Proc $proc
    }

    return @($ordered)
}

function Stop-LangSuiteProcess {
    param([string]$RootPath)
    $ordered = @(Get-LangSuiteProcessStopOrder -RootPath $RootPath)
    if (-not $ordered) {
        Write-Step 'No obvious LangSuite backend/frontend processes were found.' 'Yellow'
        return
    }
    foreach ($proc in $ordered) {
        try {
            if ($DryRun) {
                $procId = Get-ProcessIdValue -Proc $proc
                Write-Step "[dry-run] Would stop descendant-tree process $procId" 'Yellow'
            } else {
                $procId = Get-ProcessIdValue -Proc $proc
                if ($null -eq $procId) { continue }
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Step "Stopped descendant-tree process $procId" 'Green'
            }
        } catch {
            $procId = Get-ProcessIdValue -Proc $proc
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
