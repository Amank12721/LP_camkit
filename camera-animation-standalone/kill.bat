@echo off
echo ========================================
echo Killing All Node.js Servers
echo ========================================
echo.

REM Kill all node.exe processes
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Killed all Node.js processes
) else (
    echo ℹ️  No Node.js processes found
)

echo.
echo ========================================
echo Done!
echo ========================================
pause
