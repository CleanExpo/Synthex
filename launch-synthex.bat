@echo off
echo.
echo =====================================
echo     SYNTHEX PLATFORM LAUNCHER
echo =====================================
echo.

:: Kill any existing Node processes on our ports
echo Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002"') do taskkill /F /PID %%a 2>nul

echo.
echo Starting SYNTHEX Application...
echo.

:: Start the server on port 3001
set PORT=3001
start "SYNTHEX Server" node simple-server.js

:: Wait for server to start
timeout /t 3 /nobreak > nul

:: Open browser
echo Opening SYNTHEX in browser...
start http://localhost:3001

echo.
echo =====================================
echo   SYNTHEX is now running!
echo   
echo   Access Points:
echo   - Home: http://localhost:3001
echo   - Login: http://localhost:3001/login
echo   - Dashboard: http://localhost:3001/dashboard
echo   
echo   Press Ctrl+C in the server window to stop
echo =====================================
echo.