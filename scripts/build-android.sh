#!/usr/bin/env bash
# 安卓打包:构建 Web 产物 -> Capacitor 同步 -> Gradle 出 debug APK。
# 需要本机装有 Android SDK(设置 ANDROID_HOME 或 ANDROID_SDK_ROOT)。
set -euo pipefail
cd "$(dirname "$0")/.."

# Capacitor CLI 读取 capacitor.config.ts 需要 Node 的 strip-types 支持
export NODE_OPTIONS="--experimental-strip-types${NODE_OPTIONS:+ $NODE_OPTIONS}"

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  echo "错误:未检测到 Android SDK。" >&2
  echo "请先安装 Android Studio(或命令行 SDK),并设置 ANDROID_HOME,再重新运行:" >&2
  echo "  npm run android:apk" >&2
  exit 1
fi

echo "==> 1/3 构建 Web 产物 (dist/)"
npm run build

if [ ! -d android ]; then
  echo "==> 首次运行,生成 Android 工程"
  npx cap add android
fi

echo "==> 2/3 同步到 Android 工程"
npx cap sync android

echo "==> 3/3 Gradle 构建 debug APK"
cd android
./gradlew assembleDebug

echo ""
echo "完成!APK 在:android/app/build/outputs/apk/debug/app-debug.apk"
