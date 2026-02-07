@echo off
chcp 65001 >nul
title XHS Factory - Close this window to stop backend and frontend
cd /d "%~dp0"

echo.
echo [XHS Factory] Starting backend and frontend (no extra CMD windows)...
echo.

node run-local.js

echo.
echo [XHS Factory] Stopped.
pause
