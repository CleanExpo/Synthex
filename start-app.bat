@echo off
echo.
echo ===================================
echo     SYNTHEX - Starting Application
echo ===================================
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    npm install
    echo.
)

:: Start the server
echo Starting SYNTHEX server...
echo.
echo The application will be available at:
echo   - Home:      http://localhost:3001
echo   - Login:     http://localhost:3001/login
echo   - Dashboard: http://localhost:3001/dashboard
echo.
echo Press Ctrl+C to stop the server
echo.

:: Run the simple server
node simple-server.js

pause