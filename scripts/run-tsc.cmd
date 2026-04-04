@echo off
cd /d D:\Synthex
npx tsc --noEmit > tsc-output.log 2>&1
if %errorlevel% equ 0 (
  echo TSC_PASS > tsc-status.txt
) else (
  echo TSC_FAIL > tsc-status.txt
)
