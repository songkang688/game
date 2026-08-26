# 1.1.0 发行计划（C：GitHub Actions + 出包 + Release）

目标：让「一朵一星 1.1.0」有真正可下载的发行版——Windows / Mac / Linux（以及安卓 debug APK）
的安装包挂在 GitHub Release 上，普通用户点一下就能装，不用自己 clone 仓库跑 npm。

## 为什么要走 Actions

发行包只能由 CI 产出：

- Mac 的 dmg/zip 必须在 macOS 机器上打，本地 Linux 环境打不出来；
- Release 资产也只能由带 `contents: write` 权限的工作流上传；
- 二进制不进 git（`release/` 已在 `.gitignore` 里），所以「构建 → 上传」必须是一次性的自动流程。

## 要做的事

1. `.github/workflows/ci.yml`
   - 触发：push 到 `main` / `game-1.1`，以及所有 pull_request。
   - ubuntu-latest + Node 22 + npm 缓存，跑 `npm ci && npm test && npm run build`。

2. `.github/workflows/release.yml`
   - 触发：push tag `v*`。
   - 先跑一遍测试（`test` job），三个出包 job 都 `needs: test`，测试不过就不出包：
     - `linux-windows`（ubuntu-latest）：Linux AppImage + Windows portable + NSIS setup（用
       electron-builder 自带的 wine 容器镜像，不额外装 wine）。
     - `mac`（macos-latest）：`npx electron-builder --mac dmg zip`，关掉签名自动发现，
       `--config.mac.identity=null`，无签名分发。
     - `android`（ubuntu-latest）：JDK 17 + Android SDK + gradle 缓存，`npm run android:apk`，
       debug APK 重命名成带版本号的文件名。
   - 每个 job 先 `upload-artifact`（方便单独下载排查），再用 `softprops/action-gh-release`
     把文件挂到 `v1.1.0` 的 Release 上；Release 正文写中文说明，逐个文件说清楚是干什么的。
   - 如果 tag 那棵树上有 `docs/demos/*.mp4`（A 的演示视频），一并挂到 Release 资产。

3. `docs/RELEASE.md`：维护者怎么发版——版本号和 tag 必须一致、打 annotated tag、
   怎么看 Actions、无签名 Mac 包首次打开要右键「打开」。

4. `README.md` 只动安装相关章节：在「电脑安装包」一节最前面加一张「从 GitHub Release 下载」
   的表格（Windows portable / setup、Mac dmg / zip、Linux AppImage、安卓 APK），
   自己编译的说明往后放。

5. 推完 workflows 后打 annotated tag `v1.1.0` 指向 `game-1.1` 的最新提交，push tag 触发发布。

## 边界

- 只碰 `.github/workflows/*`、`docs/RELEASE.md`、`README.md` 的安装章节、必要时 `.gitignore`。
- 不碰 `src/`、`package.json`、`electron/`、`android/` 源码、`vite.config.ts`。
- 只在 `game-1.1` 线上推送，不合回 `main`，不 force。
- 安装包二进制不进 git。
