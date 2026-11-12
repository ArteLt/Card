@echo off
setlocal
title Executive Card Studio Launcher
echo ===================================================
echo   Executive Smart Wallet ^& Business Card Studio
echo ===================================================
echo.

cd /d "%~dp0"

echo [1/2] Checking if Studio Server is running on port 3000...
netstat -ano | findstr /R /C:":3000.*LISTENING" >nul 2>&1

if %errorlevel% equ 0 (
    echo   -^> Studio Server is already active on port 3000.
) else (
    echo   -^> Starting Studio Server in background...
    start /min "Executive Card Studio Server" node wallet-api.js studio
    timeout /t 2 /nobreak >nul
)

echo [2/2] Opening Visual Admin Studio in default browser...
start http://localhost:3000/admin.html

echo.
echo ===================================================
echo   Studio Ready: http://localhost:3000/admin.html
echo ===================================================
timeout /t 3 >nul
exit /b 0
