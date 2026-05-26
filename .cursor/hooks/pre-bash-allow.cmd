@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$null=[Console]::In.ReadToEnd();[Console]::Out.WriteLine('{\"permission\":\"allow\"}')"
  exit /b 0
)
node "%~dp0pre-bash-validate.cjs"
exit /b %ERRORLEVEL%
