@echo off
echo.
echo ========================================
echo    SYNTHEX BUILD ORCHESTRATOR AGENT
echo ========================================
echo.
echo Starting the autonomous build agent...
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Navigate to the project directory
cd /d "%~dp0"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

:: Compile TypeScript files
echo Compiling TypeScript files...
npx tsc src/agents/launch-build-agent.ts --outDir dist/agents --esModuleInterop --resolveJsonModule --skipLibCheck

:: Run the build agent
echo.
echo Launching Build Orchestrator Agent...
echo.
node dist/agents/launch-build-agent.js

pause