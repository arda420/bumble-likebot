@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 pause & exit /b 1
)
node autoclick-playwright.js
pause
