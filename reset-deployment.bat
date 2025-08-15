@echo off
echo =======================================
echo    SYNTHEX DEPLOYMENT RESET
echo =======================================
echo.

echo Step 1: Cleaning old files...
rmdir /s /q .next 2>nul
rmdir /s /q .vercel 2>nul
del package-lock.json 2>nul
echo    - Cleaned!

echo.
echo Step 2: Installing fresh dependencies...
call npm install
echo    - Installed!

echo.
echo Step 3: Building application...
call npm run build

if %errorlevel% neq 0 (
    echo.
    echo ❌ Build failed! Please fix errors before continuing.
    pause
    exit /b 1
)

echo    - Build successful!

echo.
echo Step 4: Linking to Vercel...
call vercel link
echo    - Linked!

echo.
echo Step 5: Deploying to production...
call vercel --prod --yes
echo    - Deployment initiated!

echo.
echo =======================================
echo    ✅ RESET COMPLETE!
echo =======================================
echo.
echo Your site will be live at https://synthex.social
echo in about 5-10 minutes once DNS propagates.
echo.
echo Check deployment status at:
echo https://vercel.com/unite-group/synthex
echo.
pause