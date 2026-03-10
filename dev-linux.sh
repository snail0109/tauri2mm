#!/bin/bash
# Linux 开发启动脚本 - mytest Tauri App

set -e

echo "========================================="
echo "  mytest - Tauri 桌面端启动 (Linux)"
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

# 检查 Linux 系统依赖 (Debian/Ubuntu)
echo "[检查] 验证系统依赖..."
MISSING_DEPS=""
for pkg in libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf; do
    if ! dpkg -s "$pkg" &> /dev/null 2>&1; then
        MISSING_DEPS="$MISSING_DEPS $pkg"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    echo "[警告] 缺少以下系统依赖:$MISSING_DEPS"
    echo "[提示] 请执行: sudo apt install -y$MISSING_DEPS"
    read -p "是否自动安装? (y/N): " choice
    if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then
        sudo apt install -y $MISSING_DEPS
    else
        echo "[跳过] 未安装系统依赖，可能导致编译失败"
    fi
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
