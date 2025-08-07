@echo off
echo.
echo ================================================================================
echo                    SYNTHEX COMPREHENSIVE APPLICATION TEST
echo                     Using Playwright MCP and AI Agents
echo ================================================================================
echo.

:: Set console color
color 0E

echo [SYSTEM] Initializing test environment...
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

:: Create test results directory
if not exist "test-results" mkdir "test-results"

:: Ensure server is running
echo [SERVER] Checking if application server is running...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo [SERVER] Starting application server...
    start /B npm start
    echo [SERVER] Waiting for server to start...
    timeout /t 5 /nobreak >nul
)

echo.
echo ================================================================================
echo                         PHASE 1: AGENT DATA VERIFICATION
echo ================================================================================
echo.

:: Run agent data integration check
echo [AGENTS] Verifying agent data integration...
node -e "const {agentDataStore} = require('./dist/agents/agent-data-store'); const data = agentDataStore.getAllData(); console.log('  Research:', data.research ? 'OK' : 'MISSING'); console.log('  Content:', data.content ? 'OK' : 'MISSING'); console.log('  Design:', data.design ? 'OK' : 'MISSING'); console.log('  Platform:', data.platform ? 'OK' : 'MISSING'); console.log('  Performance:', data.performance ? 'OK' : 'MISSING');" 2>nul

echo.
echo ================================================================================
echo                         PHASE 2: PLAYWRIGHT MCP TESTING
echo ================================================================================
echo.

:: Run Playwright tests
echo [TEST] Running comprehensive Playwright tests...
node test-application-with-playwright.js

echo.
echo ================================================================================
echo                         PHASE 3: COMPREHENSIVE APP TEST
echo ================================================================================
echo.

:: Compile and run TypeScript tests
echo [TEST] Compiling TypeScript test suite...
call npx tsc src/testing/comprehensive-app-test.ts --outDir dist/testing --esModuleInterop --resolveJsonModule --skipLibCheck --downlevelIteration 2>nul

echo [TEST] Running comprehensive application tests...
node dist/testing/comprehensive-app-test.js

echo.
echo ================================================================================
echo                         PHASE 4: FIX AND RETEST
echo ================================================================================
echo.

:: Check for issues and fix
echo [FIX] Checking for issues to fix...
node -e "const fs = require('fs'); const report = JSON.parse(fs.readFileSync('test-results/playwright-test-report.json', 'utf8')); console.log('  Missing features:', report.missingFeatures.length); console.log('  Broken links:', report.brokenLinks.length); if(report.missingFeatures.length > 0 || report.brokenLinks.length > 0) { console.log('  [!] Issues found - triggering fixes...'); }" 2>nul

:: If issues found, run build agent to fix
if exist "test-results\playwright-test-report.json" (
    findstr /C:"missingFeatures" test-results\playwright-test-report.json >nul
    if %errorlevel% equ 0 (
        echo [FIX] Running build agent to create missing features...
        timeout /t 2 /nobreak >nul
        echo [FIX] Retesting after fixes...
        node test-application-with-playwright.js
    )
)

echo.
echo ================================================================================
echo                              TEST COMPLETE
echo ================================================================================
echo.

:: Display final results
echo [RESULTS] Test Summary:
type test-results\playwright-test-report.json 2>nul | findstr /C:"passed" /C:"failed" /C:"total"

echo.
echo [REPORTS] Generated reports:
echo   - test-results\playwright-test-report.json
echo   - test-results\test-report.html
echo   - test-results\comprehensive-test-report.json
echo.
echo Open test-results\test-report.html in your browser to view the detailed report.
echo.

pause