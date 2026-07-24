@echo off
setlocal EnableExtensions
REM Blink - works in Command Prompt, PowerShell, and Windows Terminal.
set "BLINK_INVOKE_CWD=%CD%"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo Blink requires Node.js 18 or newer.
  echo Install from https://nodejs.org then run blink again.
  echo.
  exit /b 1
)

REM Avoid node -^> powershell -^> bun double-wrap; blink.js runs Bun directly.
set "BLINK_WIN_PS_LAUNCH=1"
node "%~dp0blink.js" %*
set "EXITCODE=%ERRORLEVEL%"
endlocal & exit /b %EXITCODE%
