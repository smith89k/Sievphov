@echo off
title Sievphov - build installer
cd /d "%~dp0"
rem VS Code and tools launched from it set this; it makes electron.exe run as plain Node.
set ELECTRON_RUN_AS_NODE=
where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download the LTS version from https://nodejs.org and run this again.
  pause
  exit /b 1
)
where pnpm >/dev/null 2>nul
if errorlevel 1 (
  echo pnpm is not installed. Run "npm install -g pnpm" in a terminal and run this again.
  pause
  exit /b 1
)
where dotnet >/dev/null 2>nul
if errorlevel 1 (
  echo The .NET 8 SDK is not installed. Run "winget install Microsoft.DotNet.SDK.8" and run this again.
  pause
  exit /b 1
)
echo [1/2] Installing packages (first time takes a few minutes)...
call pnpm install
if errorlevel 1 goto fail
echo [2/2] Building the print engine and the Windows installer...
call pnpm run dist
if errorlevel 1 goto fail
echo.
echo Done. The installer is in the dist folder.
start "" "%~dp0dist"
pause
exit /b 0
:fail
echo.
echo Build failed. See the messages above.
pause
exit /b 1
