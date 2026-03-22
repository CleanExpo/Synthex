@echo off
:loop
if exist D:\Synthex\build-status.txt (
  type D:\Synthex\build-status.txt
  exit /b 0
)
ping -n 10 127.0.0.1 >nul
goto loop
