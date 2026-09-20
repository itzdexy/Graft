# Graft — Windows launcher. Runs Bun directly (better TTY than node→bun).
# Supports: Windows PowerShell 5.1+, PowerShell Core 7+
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # Faster progress bar handling

$GraftScopedEnvNames = @(
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_MODEL',
  'GRAFT_CODE_DISABLE_THINKING',
  'DISABLE_INTERLEAVED_THINKING',
  'ENABLE_TOOL_SEARCH',
  'GRAFT_PACKAGE_ROOT',
  'GRAFT_SRC',
  'GRAFT_ACTIVE_PROVIDER',
  'GRAFT_PROVIDER_AUTH_MODE',
  'GRAFT_FORCE_INTERACTIVE',
  'GRAFT_SKIP_TERMINAL_QUERIES',
  'GRAFT_CACHE_WARMED',
  'GRAFT_INVOKE_CWD',
  'GRAFT_INVOKE_CWD_LOCKED',
  'GRAFT_IN_WINDOW',
  'GRAFT_ALLOW_HOME',
  'GRAFT_BUN_CMD',
  'GRAFT_DOCTOR_INVOKED_AS',
  'GRAFT_CODE_NO_FLICKER',
  'GRAFT_CODE_OAUTH_TOKEN',
  'GRAFT_CODE_SIMPLE'
)
$GraftSavedEnvironment = @{}
foreach ($name in $GraftScopedEnvNames) {
  $item = Get-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
  if ($null -eq $item) {
    $GraftSavedEnvironment[$name] = @{ Exists = $false; Value = $null }
  } else {
    $GraftSavedEnvironment[$name] = @{ Exists = $true; Value = [string]$item.Value }
  }
}

function Restore-GraftEnvironment {
  foreach ($name in $GraftScopedEnvNames) {
    $saved = $GraftSavedEnvironment[$name]
    if ($saved.Exists) {
      Set-Item -LiteralPath "Env:$name" -Value ([string]$saved.Value)
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}

function Exit-Graft {
  param([int]$Code)
  Restore-GraftEnvironment
  exit $Code
}

# Capture the user's folder at the outermost launcher boundary. Installer,
# npm, and repo shims lock this before any wrapper changes location.
if ($env:GRAFT_INVOKE_CWD_LOCKED -ne '1' -or -not $env:GRAFT_INVOKE_CWD) {
  $env:GRAFT_INVOKE_CWD = (Get-Location).Path
  $env:GRAFT_INVOKE_CWD_LOCKED = '1'
}

# Fresh console for interactive sessions (parent shell scrollback breaks Ink UI).
$cliArgs = @($args)
if ($cliArgs -contains '--in-window') {
  $env:GRAFT_IN_WINDOW = '1'
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--in-window' })
  if ($Host.Name -eq 'ConsoleHost') { Clear-Host }
  if ($env:GRAFT_INVOKE_CWD -and (Test-Path $env:GRAFT_INVOKE_CWD)) {
    Set-Location $env:GRAFT_INVOKE_CWD
  }
}

function Test-IsBunInstalled {
  $bunPaths = @(
    Join-Path $env:USERPROFILE '.bun\bin\bun.exe',
    Join-Path $env:LOCALAPPDATA 'Programs\bun\bin\bun.exe'
  )
  foreach ($path in $bunPaths) {
    if (Test-Path $path) { return $true }
  }
  $cmd = Get-Command bun -ErrorAction SilentlyContinue
  return ($null -ne $cmd)
}

$GraftCliSubcommands = @(
  'setup', 'doctor', 'bench', 'auth', 'provider', 'chrome', 'config', 'models', 'sessions',
  'serve', 'mcp', 'providers', 'launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'
)
$GraftAppCommands = @(
  'launch', 'apps', 'codex', 'claude', 'claude-code', 'claude-desktop', 'chatgpt', 'chatgpt-desktop'
)

if ($cliArgs -contains '--allow-home') { $env:GRAFT_ALLOW_HOME = '1' }
$cliArgs = @($cliArgs | Where-Object { $_ -ne '--allow-home' })

# ask/review/fix/plan turn a scope into a print-mode prompt. bin/graft.js owns
# that construction (buildWorkflowPrintArgs); this launcher must not re-derive
# it, or the two entry points drift.
$GraftWorkflowCommands = @('ask', 'review', 'fix', 'plan')

function Test-IsInteractiveGraftLaunch {
  param([string[]]$PassArgs)
  if ($PassArgs -contains '-p' -or $PassArgs -contains '--print') { return $false }
  if ($PassArgs -contains '--help' -or $PassArgs -contains '-h') { return $false }
  if ($PassArgs -contains '--version' -or $PassArgs -contains '-v' -or $PassArgs -contains '-V') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $GraftCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $GraftWorkflowCommands) { return $false }
  return $true
}

function Invoke-GraftWarmCompile {
  param([string]$Root)
  $warm = Join-Path $Root 'scripts\graft-warm.js'
  if (-not (Test-Path $warm)) { return $true }

  # Staleness is decided only by graftWarmNeeded(). This used to be shortcut by
  # an inline check of six entry files, which missed every edit under
  # components/** and services/** — i.e. most of the product — so the launcher
  # silently served a stale compiled bundle and source changes never appeared.
  # The real fingerprint walks those trees; it memoizes per process and costs
  # ~20ms, which is not worth risking a stale UI to save.
  Push-Location $Root
  try {
    $neededOut = & $Node -e "import('./scripts/graft-warm.js').then(m => console.log(m.graftWarmNeeded() ? '1' : '0'))"
    if ($neededOut -eq '0') {
      $env:GRAFT_CACHE_WARMED = '1'
      return $true
    }

    # Warm must not inherit interactive mode — that hangs the compile child forever.
    # Leave quiet off so the warm child owns the compiling animation.
    $prevForce = $env:GRAFT_FORCE_INTERACTIVE
    $env:GRAFT_FORCE_INTERACTIVE = '0'
    Remove-Item Env:GRAFT_WARM_QUIET_LOADER -ErrorAction SilentlyContinue
    try {
      & $Node $warm
      if ($LASTEXITCODE -ne 0) {
        [Console]::Error.WriteLine('Compile prep failed; Graft will compile on launch (please wait).')
        return $false
      }
      $env:GRAFT_CACHE_WARMED = '1'
      return $true
    } finally {
      if ($null -ne $prevForce -and $prevForce -ne '') {
        $env:GRAFT_FORCE_INTERACTIVE = $prevForce
      } else {
        Remove-Item Env:GRAFT_FORCE_INTERACTIVE -ErrorAction SilentlyContinue
      }
    }
  } finally {
    Pop-Location
  }
}

function Set-GraftConsoleUtf8 {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  try {
    $null = chcp 65001
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
  } catch {
    # Best-effort; Ink still runs if UTF-8 setup fails.
  }
}

function Enter-GraftTuiConsole {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  Set-GraftConsoleUtf8
  # Switch to the alt buffer before warm compile / Ink so the parent PowerShell
  # prompt stays on the main screen and does not paint over setup UI.
  $esc = [char]27
  [Console]::Out.Write("${esc}[?1049h${esc}[2J${esc}[H")
  [Console]::Out.Flush()
}

function Leave-GraftTuiConsole {
  if ($Host.Name -ne 'ConsoleHost') { return }
  if ([Console]::IsOutputRedirected) { return }
  $esc = [char]27
  [Console]::Out.Write("${esc}[?1049l${esc}[?25h")
  [Console]::Out.Flush()
}

function Test-GraftOpenNewWindow {
  param([string[]]$PassArgs)
  # Opt-in only (a separate window flashes/closes on startup hiccups).
  if ($env:GRAFT_NEW_WINDOW -ne '1') { return $false }
  if ($env:GRAFT_IN_WINDOW -eq '1') { return $false }
  if ($env:GRAFT_NO_NEW_WINDOW -eq '1') { return $false }
  if ($PassArgs -contains '--help' -or $PassArgs -contains '-h') { return $false }
  if ($PassArgs -contains '--version' -or $PassArgs -contains '-v' -or $PassArgs -contains '-V') { return $false }
  if ($PassArgs -contains '-p' -or $PassArgs -contains '--print') { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $GraftCliSubcommands) { return $false }
  if ($PassArgs.Count -ge 1 -and $PassArgs[0] -in $GraftWorkflowCommands) { return $false }
  return $true
}

function Start-GraftNewWindow {
  param([string[]]$PassArgs)
  $ps1 = $PSCommandPath
  $cwd = (Get-Location).Path
  $newArgs = @('--in-window') + $PassArgs
  $wtCmd = Get-Command wt.exe -ErrorAction SilentlyContinue
  $wt = if ($wtCmd) { $wtCmd.Source } else { $null }
  $psLaunch = @(
    'powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1
  ) + $newArgs
  if ($wt) {
    $argList = @('new-tab', '-d', $cwd, '--title', 'Graft') + $psLaunch
    Start-Process -FilePath $wt -ArgumentList $argList | Out-Null
  } else {
    Start-Process -FilePath 'powershell.exe' -WorkingDirectory $cwd -ArgumentList (
      @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ps1) + $newArgs
    ) | Out-Null
  }
}

if (Test-GraftOpenNewWindow -PassArgs $cliArgs) {
  Start-GraftNewWindow -PassArgs $cliArgs
  exit 0
}

if ($Host.Name -eq 'ConsoleHost') {
  $Host.UI.RawUI.WindowTitle = 'Graft'
}

$sourceRoot = Split-Path $PSScriptRoot -Parent
$PkgRoot = if (Test-Path (Join-Path $sourceRoot 'src\entrypoints\cli.tsx')) {
  $sourceRoot
} elseif ($env:GRAFT_PACKAGE_ROOT) {
  $env:GRAFT_PACKAGE_ROOT
} elseif ($env:GRAFT_SRC) {
  $env:GRAFT_SRC
} else {
  Split-Path $PSScriptRoot -Parent
}

$Bun = if ($env:BUN_INSTALL) {
  Join-Path $env:BUN_INSTALL 'bin\bun.exe'
} else {
  Join-Path $env:USERPROFILE '.bun\bin\bun.exe'
}
if (-not (Test-Path $Bun)) {
  $found = Get-Command bun -ErrorAction SilentlyContinue
  if ($found) { $Bun = $found.Source }
}
if (-not (Test-Path $Bun) -and -not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun is required. Install: https://bun.sh" -ForegroundColor Red
  Write-Host '  powershell -c "irm bun.sh/install.ps1 | iex"' -ForegroundColor Yellow
  exit 1
}

$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  # Bun can execute Graft's JavaScript launcher helpers.
  $Node = $Bun
}

# Verify Bun is executable
try {
  $null = & $Bun --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Bun exited with code $LASTEXITCODE"
  }
} catch {
  Write-Host "Bun executable found but failed to run. Reinstall Bun: https://bun.sh" -ForegroundColor Red
  exit 1
}

# Child Node helpers resolve Bun independently. Replace stale user-level
# overrides only after this executable has passed the native version probe.
$env:GRAFT_BUN_CMD = $Bun

$cliEntry = Join-Path $PkgRoot 'src\entrypoints\cli.tsx'

# This launcher exists for exactly one reason: npm's node->bun hop breaks Ink
# raw mode on Windows, so the interactive UI has to start Bun in-process. Every
# other path -- subcommands, workflow prompts, --help/--version, print mode --
# is dispatched by bin/graft.js, which owns the subcommand table, the workflow
# prompt builder, the exit codes, and the source-missing fallbacks. Keeping a
# second copy of that table here is what silently dropped `sessions` and
# `review|fix|plan`: both were declared non-interactive but never routed, so
# they fell through and were handed to the agent as raw positional arguments.
# GRAFT_WIN_PS_LAUNCH stops graft.js from delegating straight back here.
if (-not (Test-IsInteractiveGraftLaunch -PassArgs $cliArgs)) {
  $nodeCli = Join-Path $PkgRoot 'bin\graft.js'
  if (-not (Test-Path $nodeCli)) {
    Write-Host "Graft launcher not found at $nodeCli." -ForegroundColor Red
    Write-Host 'Reinstall the graft package.' -ForegroundColor DarkGray
    Exit-Graft 1
  }
  $env:GRAFT_WIN_PS_LAUNCH = '1'
  & $Node $nodeCli @cliArgs
  Exit-Graft $LASTEXITCODE
}

# Interactive launch only: without the source entry there is nothing to run.
if (-not (Test-Path $cliEntry)) {
  Write-Host "Graft source not found at $PkgRoot (missing src\entrypoints\cli.tsx)." -ForegroundColor Red
  Write-Host 'Graft will not fall back to, patch, or launch another AI CLI.' -ForegroundColor DarkGray
  Write-Host 'Install the complete graft package or run from its source checkout.' -ForegroundColor DarkGray
  Exit-Graft 1
}

$exitCode = 0
try {
$env:GRAFT_PACKAGE_ROOT = $PkgRoot
$env:GRAFT_SRC = $PkgRoot
$env:GRAFT_FORCE_INTERACTIVE = '1'
if (-not $env:GRAFT_CODE_NO_FLICKER) { $env:GRAFT_CODE_NO_FLICKER = '1' }
$env:GRAFT_SKIP_TERMINAL_QUERIES = '1'

# Own the terminal before the warm compile / loader paints: UTF-8 for the
# braille spinners and box drawing, then the alternate screen so install and
# parent-shell output cannot bleed through the interactive UI. Ink re-enters
# the alternate screen on mount; staying in it is harmless, flashing the
# parent scrollback underneath is not.
$GraftOriginalTitle = if ($Host.Name -eq 'ConsoleHost') { $Host.UI.RawUI.WindowTitle } else { $null }
Set-GraftConsoleUtf8
Enter-GraftTuiConsole

# Interactive init reads the active provider straight from Graft's config, so
# no throwaway Node process runs before Bun can start accepting input. The
# non-interactive auth prep that used to sit here is gone: those invocations
# now delegate to bin/graft.js above, which runs buildGraftChildAuthEnv itself.
Remove-Item Env:GRAFT_CODE_OAUTH_TOKEN -ErrorAction SilentlyContinue

if ($cliArgs -contains '--fast') {
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--fast' })
  if ($cliArgs -notcontains '--bare') { $cliArgs = @('--bare') + $cliArgs }
  $env:GRAFT_CODE_SIMPLE = '1'
} elseif ($cliArgs -contains '--bare') {
  $env:GRAFT_CODE_SIMPLE = '1'
} elseif ($cliArgs -contains '--full') {
  $cliArgs = @($cliArgs | Where-Object { $_ -ne '--full' })
  Remove-Item Env:GRAFT_CODE_SIMPLE -ErrorAction SilentlyContinue
} else {
  if ($cliArgs -notcontains '--bare') { $cliArgs = @('--bare') + $cliArgs }
  $env:GRAFT_CODE_SIMPLE = '1'
}

$null = Invoke-GraftWarmCompile -Root $PkgRoot

$runtimeEntry = Join-Path $PkgRoot '.cache\runtime\graft-cli.js'
# Existence alone is not enough: a bundle left over from an earlier build is
# exactly how stale code gets served. Only run it when the warm step confirmed
# the cache matches current source, otherwise fall back to compiling from
# source — slower to start, but never wrong.
if (
  $cliArgs -contains '--bare' -and
  (Test-Path $runtimeEntry) -and
  $env:GRAFT_CACHE_WARMED -eq '1'
) {
  $cliEntry = $runtimeEntry
}

Push-Location $PkgRoot
try {
  & $Bun $cliEntry @cliArgs
  if ($null -ne $LASTEXITCODE) { $exitCode = $LASTEXITCODE }
} catch {
  $exitCode = 1
  [Console]::Error.WriteLine('')
  [Console]::Error.WriteLine("Graft failed to start: $_")
} finally {
  Pop-Location
}
} finally {
  # Restore the terminal even on crash: leave the alternate screen (which
  # also restores the cursor) and give the parent shell its title back.
  try { Leave-GraftTuiConsole } catch { }
  if ($GraftOriginalTitle -and $Host.Name -eq 'ConsoleHost') {
    try { $Host.UI.RawUI.WindowTitle = $GraftOriginalTitle } catch { }
  }
  foreach ($name in $GraftScopedEnvNames) {
    $saved = $GraftSavedEnvironment[$name]
    if ($saved.Exists) {
      Set-Item -LiteralPath "Env:$name" -Value ([string]$saved.Value)
    } else {
      Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
    }
  }
}
if ($exitCode -ne 0 -and $exitCode -ne 130) {
  [Console]::Error.WriteLine('')
  if ($cliArgs.Count -ge 1 -and $cliArgs[0] -in $GraftAppCommands) {
    [Console]::Error.WriteLine("Graft app command '$($cliArgs[0])' exited with code $exitCode.")
    [Console]::Error.WriteLine('Run: graft apps list   (verify providers/models)')
  } else {
    [Console]::Error.WriteLine("Graft exited with code $exitCode. Run: graft setup")
  }
  [Console]::Error.WriteLine('For details: graft --debug-to-stderr')
}
exit $exitCode
