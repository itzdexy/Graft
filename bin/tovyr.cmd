@echo off
setlocal EnableExtensions
REM Tovyr — works in Command Prompt, PowerShell, and Windows Terminal.
set "TOVYR_INVOKE_CWD=%CD%"
set "TOVYR_INVOKE_CWD_LOCKED=1"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Tovyr requires Node.js 18 or newer.
  echo Install from https://nodejs.org then run tovyr again.
  echo.
  exit /b 1
)

REM Avoid node -> powershell -> bun double-wrap; tovyr.js runs Bun directly.
set "TOVYR_WIN_PS_LAUNCH=1"
node "%~dp0tovyr.js" %*
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%
