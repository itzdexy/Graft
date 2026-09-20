[CmdletBinding()]
param(
  [string]$SourcePath,
  [string]$InstallRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.local\share\graft'),
  [switch]$SkipDependencies
)
$ErrorActionPreference = 'Stop'
foreach ($name in @('node', 'bun')) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "$name is required. Install Node.js 22+ and Bun from https://nodejs.org and https://bun.sh, then reopen PowerShell."
  }
}
if ($SourcePath) {
  $root = (Resolve-Path -LiteralPath $SourcePath).Path
} else {
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git from https://git-scm.com first.' }
  $root = [IO.Path]::GetFullPath($InstallRoot)
  if (Test-Path -LiteralPath $root) {
    throw "Install directory already exists: $root. To update, pull your Graft checkout and rerun with -SourcePath pointing to it."
  }
  & git clone --depth 1 --branch main https://github.com/itzdexy/Graft.git $root
  if ($LASTEXITCODE -ne 0) { throw 'Could not download Graft.' }
}
if (-not (Test-Path -LiteralPath (Join-Path $root 'bin\graft.js'))) { throw 'SourcePath is not a Graft checkout.' }
Push-Location -LiteralPath $root
try {
  if (-not $SkipDependencies) {
    & bun install --frozen-lockfile --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
  }
  & bun scripts/build-graft-runtime.ts
  if ($LASTEXITCODE -ne 0) { throw 'Runtime build failed.' }
  & node scripts/graft-warm.js --force
  if ($LASTEXITCODE -ne 0) { throw 'Runtime preparation failed.' }
  & node bin/graft.js --version
  if ($LASTEXITCODE -ne 0) { throw 'CLI verification failed.' }
} finally { Pop-Location }
$userHome = [Environment]::GetFolderPath('UserProfile')
$binDir = Join-Path $userHome '.local\bin'
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$nodePath = (Get-Command node).Source
$entry = Join-Path $root 'bin\graft.js'
if ($entry.Contains('%') -or $nodePath.Contains('%')) { throw 'Install paths containing % are not supported by the CMD launcher.' }
$launcher = "@echo off`r`n`"$nodePath`" `"$entry`" %*`r`n"
Set-Content -LiteralPath (Join-Path $binDir 'graft.cmd') -Value $launcher -Encoding ASCII
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($userPath -split ';') -notcontains $binDir) {
  [Environment]::SetEnvironmentVariable('Path', "$binDir;$userPath", 'User')
}
if (($env:Path -split ';') -notcontains $binDir) { $env:Path = "$binDir;$env:Path" }
$iconPath = Join-Path $root 'assets\graft.ico'
if (Test-Path -LiteralPath $iconPath) {
  $programsDir = [Environment]::GetFolderPath('Programs')
  $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $programsDir 'Graft.lnk'))
  $shortcut.TargetPath = $env:ComSpec
  $shortcut.Arguments = '/k ""' + (Join-Path $binDir 'graft.cmd') + '""'
  $shortcut.WorkingDirectory = $root
  $shortcut.IconLocation = "$iconPath,0"
  $shortcut.Description = 'Graft terminal coding agent'
  $shortcut.Save()
}
Write-Host "Installed Graft. Run graft in a project folder. Reopen your terminal if it was already open."
