@echo off
echo.
echo ================================================================================
echo                      SYNTHEX COMPLETE BUILD EXECUTOR
echo                   Autonomous Marketing Application Builder
echo ================================================================================
echo.

:: Set console colors
color 0A

echo [SYSTEM] Initializing build environment...
echo.

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed
    pause
    exit /b 1
)

:: Navigate to project directory
cd /d "%~dp0"

:: Install dependencies if needed
if not exist "node_modules" (
    echo [INSTALL] Installing dependencies...
    call npm install
    echo.
)

:: Create necessary directories
echo [SETUP] Creating data directories...
if not exist "data\agent-outputs" mkdir "data\agent-outputs"
if not exist "data\personas" mkdir "data\personas"
if not exist "config\platforms" mkdir "config\platforms"
if not exist "templates" mkdir "templates"
if not exist "src\components" mkdir "src\components"
echo.

:: Compile TypeScript
echo [BUILD] Compiling TypeScript files...
call npx tsc src/agents/execute-full-build.ts src/agents/agent-data-store.ts src/services/agent-integration.ts --outDir dist --esModuleInterop --resolveJsonModule --skipLibCheck --downlevelIteration 2>nul
echo.

:: Execute the complete build
echo ================================================================================
echo                         STARTING COMPLETE BUILD PROCESS
echo ================================================================================
echo.

node dist/agents/execute-full-build.js

echo.
echo ================================================================================
echo                              BUILD COMPLETE
echo ================================================================================
echo.
echo Next steps:
echo   1. Review generated data in /data/agent-outputs/
echo   2. Check application configuration in /config/app-config.json
echo   3. View build summary in /data/build-summary.json
echo   4. Start the application with: npm start
echo.

pause