param(
  [string]$Launcher = (Join-Path $PSScriptRoot '..\bin\tovyr.ps1')
)

$ErrorActionPreference = 'Continue'
$env:ANTHROPIC_API_KEY = 'sentinel-key'
$env:ANTHROPIC_BASE_URL = 'https://sentinel.invalid'

& $Launcher '--definitely-invalid'

$keyRestored = $env:ANTHROPIC_API_KEY -eq 'sentinel-key'
$baseRestored = $env:ANTHROPIC_BASE_URL -eq 'https://sentinel.invalid'
Write-Output "KEY_RESTORED=$keyRestored"
Write-Output "BASE_RESTORED=$baseRestored"

if (-not $keyRestored -or -not $baseRestored) {
  exit 1
}
