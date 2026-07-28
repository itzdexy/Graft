@echo off
REM Quick launcher when tovyr is not on PATH — run from repo root or add this folder to PATH.
set "TOVYR_INVOKE_CWD=%CD%"
set "TOVYR_INVOKE_CWD_LOCKED=1"
call "%~dp0bin\tovyr.cmd" %*
