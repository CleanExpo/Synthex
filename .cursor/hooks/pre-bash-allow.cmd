@echo off
REM Cursor preToolUse — project-relative wrapper (no $CLAUDE_PROJECT_DIR)
setlocal EnableExtensions
set "ROOT=%~dp0..\.."
cd /d "%ROOT%"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%ROOT%\.claude\hooks\pre-bash-validate.ps1"
exit /b %ERRORLEVEL%
