@echo off
echo ========================================
echo Clearing Next.js Build Cache
echo ========================================
echo.

IF EXIST ".next" (
    echo Deleting .next cache...
    rmdir /s /q ".next"
    echo .next deleted successfully.
) ELSE (
    echo .next directory not found. Nothing to delete.
)

echo.

IF EXIST "node_modules\.cache" (
    echo Deleting node_modules cache...
    rmdir /s /q "node_modules\.cache"
    echo node_modules cache deleted successfully.
) ELSE (
    echo node_modules cache not found. Nothing to delete.
)

echo.

IF EXIST ".turbo" (
    echo Deleting .turbo cache...
    rmdir /s /q ".turbo"
    echo .turbo deleted successfully.
) ELSE (
    echo .turbo directory not found. Nothing to delete.
)

echo.
echo ========================================
echo Cache clearing complete!
echo ========================================
echo.
echo You can now run: npm run build
echo.