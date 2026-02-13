@echo off
REM SYNTHEX Database Deployment Script Wrapper
REM This batch file launches the PowerShell deployment script

echo.
echo ========================================
echo   SYNTHEX Database Deployment
echo ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: PowerShell not found
    exit /b 1
)

REM Pass all arguments to the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-database.ps1" %*

exit /b %ERRORLEVEL%
