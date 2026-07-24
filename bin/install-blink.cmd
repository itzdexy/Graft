@echo off
setlocal
echo Installing blink onto your user PATH...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-blink.ps1"
if errorlevel 1 exit /b 1
echo.
echo For THIS Command Prompt window only, run:
echo   set PATH=%%PATH%%;%%USERPROFILE%%\.local\bin;%%APPDATA%%\npm
echo   blink
echo.
echo Then close this window and use a NEW Command Prompt for future sessions.
pause
