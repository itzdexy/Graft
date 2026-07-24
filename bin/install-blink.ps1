# Install Blink user-level command shims.
# Compatible with Windows PowerShell 5.1 and PowerShell 7+.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$launcher = Join-Path $repoRoot 'bin\blink.ps1'
$shimDir = Join-Path $env:USERPROFILE '.local\bin'
$shimCmd = Join-Path $shimDir 'blink.cmd'
$shimPs1 = Join-Path $shimDir 'blink.ps1'

if (-not (Test-Path -LiteralPath $launcher)) {
  throw "Blink launcher not found: $launcher"
}

New-Item -ItemType Directory -Force -Path $shimDir | Out-Null

$cmdContent = @"
@echo off
set "BLINK_PACKAGE_ROOT=$repoRoot"
set "BLINK_SRC=$repoRoot"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$launcher" %*
"@
$cmdContent = $cmdContent -replace "`r?`n", "`r`n"
[System.IO.File]::WriteAllText(
  $shimCmd,
  $cmdContent,
  [System.Text.Encoding]::ASCII
)

$escapedRoot = $repoRoot.Replace("'", "''")
$escapedLauncher = $launcher.Replace("'", "''")
$ps1Content = @"
`$env:BLINK_PACKAGE_ROOT = '$escapedRoot'
`$env:BLINK_SRC = '$escapedRoot'
& '$escapedLauncher' @args
exit `$LASTEXITCODE
"@
[System.IO.File]::WriteAllText(
  $shimPs1,
  $ps1Content,
  [System.Text.UTF8Encoding]::new($true)
)

[Environment]::SetEnvironmentVariable('BLINK_PACKAGE_ROOT', $repoRoot, 'User')
[Environment]::SetEnvironmentVariable('BLINK_SRC', $repoRoot, 'User')
$env:BLINK_PACKAGE_ROOT = $repoRoot
$env:BLINK_SRC = $repoRoot

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
public static class BlinkEnvironmentBroadcast {
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
  [void][BlinkEnvironmentBroadcast]::SendMessageTimeout(
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

Write-Host "Blink command installed:" -ForegroundColor Green
Write-Host "  $shimCmd"
Write-Host "  $shimPs1"
Write-Host ""
Write-Host "Open a new PowerShell window, then run: blink" -ForegroundColor Cyan
