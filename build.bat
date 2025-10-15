@echo off
echo Building BAMS Employee Web Client...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo Error: npm is not available
    pause
    exit /b 1
)

echo Installing dependencies...
npm install
if errorlevel 1 (
    echo Error: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Building React application...
npm run build
if errorlevel 1 (
    echo Error: Failed to build React application
    pause
    exit /b 1
)

echo.
echo ====================================
echo Build completed successfully!
echo.
echo Output files are in the 'build' folder
echo You can deploy this folder to any web server
echo ====================================
echo.
pause