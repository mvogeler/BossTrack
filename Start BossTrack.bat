@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed. Get it from nodejs.org, then run this again.
  pause
  exit /b 1
)

if not exist node_modules\electron\dist\electron.exe (
  echo First run, installing Electron. This takes a minute.
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
