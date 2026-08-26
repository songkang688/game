#!/usr/bin/env bash
# 桌面打包:先构建 Web 产物,再交给 electron-builder 出安装包。
#
# 用法:
#   bash scripts/build-desktop.sh                 # 默认 Linux AppImage
#   bash scripts/build-desktop.sh linux           # Linux AppImage
#   bash scripts/build-desktop.sh win             # Windows 便携版 + NSIS 安装包
#   bash scripts/build-desktop.sh mac             # macOS dmg + zip(需在 macOS 上跑)
#   bash scripts/build-desktop.sh --win portable  # 其余参数原样透传给 electron-builder
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-linux}" in
  linux) TARGET_ARGS=(--linux AppImage); shift || true ;;
  win|windows) TARGET_ARGS=(--win portable nsis); shift || true ;;
  mac|macos) TARGET_ARGS=(--mac dmg zip); shift || true ;;
  *) TARGET_ARGS=() ;;
esac

if [ ${#TARGET_ARGS[@]} -eq 0 ] && [ $# -eq 0 ]; then
  TARGET_ARGS=(--linux AppImage)
fi

echo "==> 1/2 构建 Web 产物 (dist/)"
npm run build

echo "==> 2/2 打包桌面应用 (release/):electron-builder ${TARGET_ARGS[*]-} $*"
npx electron-builder ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"} "$@"

echo ""
echo "完成!安装包在 release/ 目录:"
ls -lh release/ 2>/dev/null | grep -Ei '\.(AppImage|exe|dmg|zip|deb)$' || ls -lh release/ 2>/dev/null || true
