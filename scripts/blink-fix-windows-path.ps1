# Remove stale Blink shims that override the real launcher (Bun source CLI).
$ErrorActionPreference = 'SilentlyContinue'

$SrcRoot = if ($env:BLINK_SRC) { $env:BLINK_SRC } else { Split-Path $PSScriptRoot -Parent }

$stale = @(
  (Join-Path $env:USERPROFILE '.local\bin\blink.ps1'),
  (Join-Path $env:USERPROFILE '.local\bin\blink.cmd'),
  (Join-Path $env:USERPROFILE '.local\bin\blink'),
  (Join-Path $env:USERPROFILE '.bun\bin\blink.ps1'),
  (Join-Path $env:USERPROFILE '.bun\bin\blink.cmd'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\blink.ps1'),
  (Join-Path $env:LOCALAPPDATA 'bun\bin\blink.cmd')
)

foreach ($p in $stale) {
  if (Test-Path $p) {
    Remove-Item $p -Force
    Write-Host "Removed stale shim: $p"
  }
}

# Optional: install a shim that delegates to bin/blink.js in this repo
$bunBin = Join-Path $env:USERPROFILE '.bun\bin'
if (-not (Test-Path $bunBin)) {
  New-Item -ItemType Directory -Path $bunBin -Force | Out-Null
}

$shimPs1 = Join-Path $bunBin 'blink.ps1'
$shimContent = @"
# Blink — delegates to source launcher (Bun only)
`$ErrorActionPreference = 'Stop'
`$SrcRoot = '$($SrcRoot.Replace("'", "''"))'
`$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not `$Node) { `$Node = 'node' }
& `$Node (Join-Path `$SrcRoot 'bin\blink.js') @args
exit `$LASTEXITCODE
"@
Set-Content -Path $shimPs1 -Value $shimContent -Encoding UTF8
Write-Host "Installed launcher: $shimPs1"

$npmBlink = Join-Path $env:APPDATA 'npm\blink.cmd'
if (Test-Path $npmBlink) {
  Write-Host "npm global blink: $npmBlink"
} else {
  Write-Host "Optional: cd $SrcRoot && npm link"
}

Write-Host ""
Write-Host "Open a NEW terminal, then:"
Write-Host "  blink auth login --key fe_oa_YOUR_KEY"
Write-Host "  blink"
