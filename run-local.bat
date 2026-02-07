@echo off
chcp 65001 >nul
title XHS Factory 启动器
cd /d "%~dp0"

echo.
echo [XHS Factory] 正在启动后端和前端，请勿关闭弹出的两个命令行窗口。
echo.

REM 新开窗口启动后端（若存在 .venv 则自动激活）
start "XHS Backend" cmd /k "cd /d ""%~dp0backend"" && (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) && echo Backend: http://127.0.0.1:8000 && python main.py"

REM 等后端先起来
timeout /t 3 /nobreak >nul

REM 新开窗口启动前端
start "XHS Frontend" cmd /k "cd /d ""%~dp0"" && echo Frontend: http://localhost:3000 && npm run dev"

REM 等前端编译/启动
echo [XHS Factory] 等待前端启动（约 8 秒）…
timeout /t 8 /nobreak >nul

REM 自动打开浏览器
start "" "http://localhost:3000"

echo.
echo [XHS Factory] 已打开浏览器；若未打开请手动访问 http://localhost:3000
echo 关闭后端/前端请分别关闭对应的命令行窗口。
echo.
pause
