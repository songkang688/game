#!/usr/bin/env bash
# 桌面打包:先构建 Web 产物,再交给 electron-builder 出安装包。
#
# 正式发行只挂三件套(Mac dmg / Windows 便携版 / 安卓 APK),安卓走 npm run android:apk。
# 本脚本只管桌面端;linux / nsis 仅供本地自用,不会进 GitHub Release。
#
# 用法:
#   bash scripts/build-desktop.sh                 # 默认 Windows 便携版
#   bash scripts/build-desktop.sh win             # Windows 便携版
#   bash scripts/build-desktop.sh mac             # macOS 通用 dmg(需在 macOS 上跑)
#   bash scripts/build-desktop.sh linux           # Linux AppImage(本地自用,不进 Release)
#   bash scripts/build-desktop.sh --win portable  # 其余参数原样透传给 electron-builder
set -euo pipefail
cd "$(dirname "$0")/.."

case "${1:-win}" in
  linux) TARGET_ARGS=(--linux AppImage); shift || true ;;
  win|windows) TARGET_ARGS=(--win portable); shift || true ;;
  mac|macos) TARGET_ARGS=(--mac dmg --universal); shift || true ;;
  *) TARGET_ARGS=() ;;
esac

if [ ${#TARGET_ARGS[@]} -eq 0 ] && [ $# -eq 0 ]; then
  TARGET_ARGS=(--win portable)
fi

echo "==> 1/2 构建 Web 产物 (dist/)"
npm run build

echo "==> 2/2 打包桌面应用 (release/):electron-builder ${TARGET_ARGS[*]-} $*"
npx electron-builder ${TARGET_ARGS[@]+"${TARGET_ARGS[@]}"} "$@"

echo ""
echo "完成!安装包在 release/ 目录:"
ls -lh release/ 2>/dev/null | grep -Ei '\.(AppImage|exe|dmg|zip|deb)$' || ls -lh release/ 2>/dev/null || true
