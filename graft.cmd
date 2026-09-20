@echo off
REM Quick launcher when graft is not on PATH — run from repo root or add this folder to PATH.
set "GRAFT_INVOKE_CWD=%CD%"
set "GRAFT_INVOKE_CWD_LOCKED=1"
call "%~dp0bin\graft.cmd" %*
