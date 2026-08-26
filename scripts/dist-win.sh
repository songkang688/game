#!/usr/bin/env bash
# Windows 发行物一把梭:同时出便携版 exe 与 NSIS 安装包。
# 在 Linux 上交叉打包时,electron-builder 自带 NSIS 工具链,通常无需 wine;
# 若本机 NSIS 环节失败,单独跑 npm run dist:win 至少能拿到便携版。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/2 构建 Web 产物 (dist/)"
npm run build

echo "==> 2/2 打包 Windows 便携版 + 安装包 (release/)"
npx electron-builder --win portable nsis "$@"

echo ""
echo "完成!Windows 产物:"
ls -lh release/*.exe 2>/dev/null || echo "(release/ 下没找到 exe)"
