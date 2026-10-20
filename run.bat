@echo off
title Sievphov
cd /d "%~dp0"
rem VS Code and tools launched from it set this; it makes electron.exe run as plain Node.
set ELECTRON_RUN_AS_NODE=
where pnpm >/dev/null 2>nul
if errorlevel 1 (
  echo pnpm is not installed. Run "npm install -g pnpm" in a terminal and run this again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing packages for the first run...
  call pnpm install || (pause & exit /b 1)
)
if not exist engine-dist\Sievphov.Engine.exe (
  echo Building the print engine for the first run...
  call pnpm run engine || (pause & exit /b 1)
)
call pnpm start
