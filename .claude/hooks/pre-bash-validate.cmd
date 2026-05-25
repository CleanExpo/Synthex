@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
  python -u "%~dp0pre-bash-validate.py"
  exit /b %ERRORLEVEL%
)
where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
  py -3 -u "%~dp0pre-bash-validate.py"
  exit /b %ERRORLEVEL%
)
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0pre-bash-validate.ps1"
exit /b %ERRORLEVEL%
