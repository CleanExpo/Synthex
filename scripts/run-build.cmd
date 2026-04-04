@echo off
cd /d D:\Synthex
npm run build > build-output.log 2>&1
if %errorlevel% equ 0 (
  echo BUILD_SUCCESS > build-status.txt
) else (
  echo BUILD_FAILED > build-status.txt
)
