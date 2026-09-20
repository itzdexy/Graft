# Install Graft user-level command shims.
# Compatible with Windows PowerShell 5.1 and PowerShell 7+.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $repoRoot 'bin\graft.ps1'
$shimDir = Join-Path $env:USERPROFILE '.local\bin'
$shimCmd = Join-Path $shimDir 'graft.cmd'
$shimPs1 = Join-Path $shimDir 'graft.ps1'
$legacyExe = Join-Path $shimDir 'graft.exe'

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Graft launcher not found: $launcher"
}

New-Item -ItemType Directory -Force -Path $shimDir | Out-Null

# CMD resolves .exe before .cmd. Preserve, but disable, a stale binary so the
# source launcher always wins and keeps the caller's project directory.
if (Test-Path -LiteralPath $legacyExe) {
  $legacyBackup = "$legacyExe.disabled-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
  Move-Item -LiteralPath $legacyExe -Destination $legacyBackup
}

$cmdContent = @"
@echo off
set "GRAFT_INVOKE_CWD=%CD%"
set "GRAFT_INVOKE_CWD_LOCKED=1"
if /I "%~1"=="--help" goto :graft_node_fast
if /I "%~1"=="-h" goto :graft_node_fast
if /I "%~1"=="--version" goto :graft_node_fast
if /I "%~1"=="-v" goto :graft_node_fast
if /I "%~1"=="-V" goto :graft_node_fast
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$launcher" %*
exit /b %ERRORLEVEL%

:graft_node_fast
node "$repoRoot\bin\graft.js" %*
"@
$cmdContent = $cmdContent -replace "`r?`n", "`r`n"
[System.IO.File]::WriteAllText(
  $shimCmd,
  $cmdContent,
  [System.Text.Encoding]::ASCII
)

$escapedLauncher = $launcher.Replace("'", "''")
$ps1Content = @"
`$env:GRAFT_INVOKE_CWD = (Get-Location).Path
`$env:GRAFT_INVOKE_CWD_LOCKED = '1'
& '$escapedLauncher' @args
exit `$LASTEXITCODE
"@
[System.IO.File]::WriteAllText(
  $shimPs1,
  $ps1Content,
  [System.Text.UTF8Encoding]::new($true)
)

[Environment]::SetEnvironmentVariable('GRAFT_PACKAGE_ROOT', $null, 'User')
[Environment]::SetEnvironmentVariable('GRAFT_SRC', $null, 'User')
Remove-Item Env:GRAFT_PACKAGE_ROOT -ErrorAction SilentlyContinue
Remove-Item Env:GRAFT_SRC -ErrorAction SilentlyContinue

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$pathEntries = @($userPath -split ';' | Where-Object { $_ })
$alreadyPresent = $pathEntries | Where-Object {
  $_.TrimEnd('\') -ieq $shimDir.TrimEnd('\')
}
if (-not $alreadyPresent) {
  $newPath = if ($userPath) { "$userPath;$shimDir" } else { $shimDir }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
}
if (($env:Path -split ';') -notcontains $shimDir) {
  $env:Path = "$shimDir;$env:Path"
}

# Notify Explorer and future terminal processes that the environment changed.
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class GraftEnvironmentBroadcast {
  [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    uint Msg,
    UIntPtr wParam,
    string lParam,
    uint flags,
    uint timeout,
    out UIntPtr result);
}
'@
  $result = [UIntPtr]::Zero
  [void][GraftEnvironmentBroadcast]::SendMessageTimeout(
    [IntPtr]0xffff,
    0x1a,
    [UIntPtr]::Zero,
    'Environment',
    2,
    5000,
    [ref]$result
  )
} catch {
  # The shims and persisted PATH are already installed.
}

Write-Host "Graft command installed:" -ForegroundColor Green
Write-Host "  $shimCmd"
Write-Host "  $shimPs1"
Write-Host ""
Write-Host "Open a new PowerShell window, then run: graft" -ForegroundColor Cyan
