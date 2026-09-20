@echo off
setlocal EnableExtensions
REM Graft — works in Command Prompt, PowerShell, and Windows Terminal.
set "GRAFT_INVOKE_CWD=%CD%"
set "GRAFT_INVOKE_CWD_LOCKED=1"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Graft requires Node.js 18 or newer.
  echo Install from https://nodejs.org then run graft again.
  echo.
  exit /b 1
)

REM Avoid node -> powershell -> bun double-wrap; graft.js runs Bun directly.
set "GRAFT_WIN_PS_LAUNCH=1"
node "%~dp0graft.js" %*
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%
