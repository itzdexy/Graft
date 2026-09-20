@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -SourcePath "%~dp0." %*
exit /b %errorlevel%
