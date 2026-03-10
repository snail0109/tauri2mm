@echo off
chcp 65001 >nul 2>&1
title mytest - Tauri 桌面端启动 (Windows)

echo =========================================
echo   mytest - Tauri 桌面端启动 (Windows)
echo =========================================

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Rust
where cargo >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Rust，请先安装: https://rustup.rs/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do echo [信息] Node.js 版本: %%i
for /f "tokens=*" %%i in ('pnpm -v') do echo [信息] pnpm 版本: %%i
for /f "tokens=*" %%i in ('rustc --version') do echo [信息] Rust 版本: %%i
echo.

:: 安装前端依赖
if not exist "node_modules" (
    echo [步骤] 安装前端依赖...
    call pnpm install
    if %errorlevel% neq 0 (
        echo [错误] pnpm install 失败
        pause
        exit /b 1
    )
)

:: 启动 Tauri 开发模式
echo [启动] 正在启动 Tauri 桌面端开发模式...
pnpm tauri dev

if %errorlevel% neq 0 (
    echo [错误] Tauri 启动失败
    pause
    exit /b 1
)

pause
