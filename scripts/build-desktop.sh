#!/usr/bin/env bash
# 桌面打包:构建 Web 产物后用 electron-builder 打 Linux AppImage。
# 用法: npm run dist   (可附加 electron-builder 参数,例如 --win)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/2 构建 Web 产物 (dist/)"
npm run build

echo "==> 2/2 打包桌面应用 (release/)"
npx electron-builder --linux AppImage "$@"

echo ""
echo "完成!安装包在 release/ 目录:"
ls -lh release/*.AppImage 2>/dev/null || true
