#!/bin/bash
# macOS 开发启动脚本 - mytest Tauri App

set -e

echo "========================================="
echo "  mytest - Tauri 桌面端启动 (macOS)"
echo "========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org/"
    exit 1
fi

# 检查 Rust
if ! command -v cargo &> /dev/null; then
    echo "[错误] 未检测到 Rust，请先安装: https://rustup.rs/"
    exit 1
fi

echo "[信息] Node.js 版本: $(node -v)"
echo "[信息] pnpm 版本: $(pnpm -v)"
echo "[信息] Rust 版本: $(rustc --version)"
echo ""

# 安装前端依赖
if [ ! -d "node_modules" ]; then
    echo "[步骤] 安装前端依赖..."
    pnpm install
fi

# 启动 Tauri 开发模式
echo "[启动] 正在启动 Tauri 桌面端开发模式..."
pnpm tauri dev
