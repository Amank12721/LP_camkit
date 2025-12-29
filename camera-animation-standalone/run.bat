@echo off
echo Starting Camera Animation Tool...
echo.

REM Start the Next.js dev server in the background
start /B cmd /c "npm run dev"

REM Wait for server to start (5 seconds)
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Open browser
echo Opening browser...
start http://localhost:3002

echo.
echo Camera Animation Tool is running!
echo Press Ctrl+C to stop the server.
echo.
