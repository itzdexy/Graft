@echo off
REM Quick launcher when blink is not on PATH — run from repo root or add this folder to PATH.
set "BLINK_INVOKE_CWD=%CD%"
call "%~dp0bin\blink.cmd" %*
