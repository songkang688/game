有子agent都用指定模型 slug：`[claude-fable-5-thinking-xhigh]`。  我让你派发子任务来做，没让父任务做！！全部重做！请通过 Task 工具派生一个或多个云端子代理执行本任务。  直接做在main里面吧。

# 第 8 步：CI 三平台安装包（Windows + Mac + Android）+ 发布说明与走查证据

## 本步目标

仓库当前**没有 `.github/`，零 CI**，且 electron-builder 配置没有 mac 目标——Mac 的 dmg 在 Linux 上根本打不出来，必须靠 GitHub Actions 的 macOS runner。本步建立两条工作流：①每次 push/PR 的测试守门；②打 tag 时三平台自动出安装包并挂到 GitHub Release。**安装包等一切构建产物绝不进 git。**

## 仓库与分支

- 先 `git fetch origin main`，拉分支 `cursor/ci-installers-<你的后缀>`，做完 merge 回 main 并 `git push origin main`（禁止 force）。推不上就 push 分支并写明原因与 SHA。
- 不要合并旧 PR #7–#16；`gh` 只读可用来看 Actions 日志，不要用它开 PR。

## 范围与文件所有权（只许碰这些）

- `.github/workflows/`（新建 `ci.yml`、`release.yml`）
- `package.json` **仅 `build` 段（加 mac/win 目标）与新增 scripts**，不动依赖版本
- `scripts/`（如需补 mac 打包脚本）
- `README.md` **仅「安装」章节**（补 CI 出包与 Release 下载说明）
- `.gitignore`（如需补充产物路径）
- 不许碰：`src/`、`electron/`、`android/` 工程源码、`vite.config.ts`。

## 具体要做

1. **`ci.yml`（push 到 main + 全部 PR 触发）**：ubuntu-latest，Node 22，`npm ci && npm test && npm run build`。这是最基本的测试守门，先做这个再做发布流水线。
2. **`release.yml`（push tag `v*` 触发，三个 job）**：
   - **linux-windows**（ubuntu-latest）：`npm ci && npm run build`，electron-builder 出 Linux AppImage + Windows portable（Linux 可交叉打包 portable；NSIS 需 wine，若装 wine 成本高就只出 portable 并在 README 写明 NSIS 需在 Windows 本机打）。
   - **mac**（macos-latest）：electron-builder 出 dmg + zip。需先在 `package.json` 的 `build` 段补 `mac` 目标：`target: ["dmg","zip"]`、`category: "public.app-category.games"`、图标用 `public/icons/icon-512.png`（electron-builder 自动转 icns）。无签名证书就明确 `identity: null` 走无签名产物，README 写清首次打开需右键-打开。
   - **android**（ubuntu-latest）：JDK 17 + Android SDK（用 `android-actions/setup-android`），`npm run build && npx cap sync android && cd android && ./gradlew assembleDebug`。产出 debug APK（无签名 release 会装不上，debug 即可安装）。注意 Capacitor CLI 需要 `NODE_OPTIONS=--experimental-strip-types`（仓库 scripts 已带，工作流沿用 `npm run android:apk` 或复制其步骤）。
   - 三个 job 的产物统一 `actions/upload-artifact`，并在 tag 触发时用 `softprops/action-gh-release` 挂到 Release。产物命名沿用 `yiduo-yixing-<版本>-<os>-<arch>` 约定。
3. **本地可验证部分先验证**：在本 VM 至少跑通 `npm run dist:linux`（AppImage）与 `npm run dist:win`（portable，交叉打包），确认 electron-builder 配置无误；Android 若本 VM 有 SDK 就打一个 debug APK 验证 gradle 链路。mac 无法本地验证，依赖 workflow 语法审查 + `act` 不可用时写明「待 tag 触发实测」。
4. **发布说明**：README「安装」章节补一段「从 Release 下载」：三平台各自的文件名、安装步骤（Windows 双击 portable；Mac 右键-打开绕过 Gatekeeper；Android 允许未知来源）。再建 `docs/RELEASE.md`：维护者如何打 tag 触发发布、版本号规则（`package.json` version 与 tag 一致）。
5. **走查证据**：本地打出的 AppImage 启动截图/录屏按平台约定上传为走查产物（**不进 git**）；CI 首次全绿的 run 链接写进最终回复。若你能打 tag（如 `v1.0.0`）就打一个轻量 tag 触发 release 实测；tag 也算 push，不算 force，允许。

## 如何优化（本步做好的标准）

- 工作流要快：npm 缓存（`actions/setup-node` 的 cache: npm）、gradle 缓存；`ci.yml` 目标 <5 分钟。
- 出包 job 都依赖测试 job 通过（`needs`），不给坏代码出包。
- 三平台产物大小写进 Release 描述（AppImage/exe 约 100–120 MB 属正常，README 已有说明保持一致）。
- 任何 secrets（签名证书等）都不硬编码；没有就走无签名并文档化。

## 与其他步骤避免冲突

- 本步不碰 `src/`，与 01–07 任意步无文件冲突；README 只动「安装」章节，与第 1 步（改游戏清单章节）天然分区。
- 建议作为最后一步执行，这样 release 的首个 tag 就包含前面所有升级。

## 验收标准

- [ ] `ci.yml` 在 push/PR 上跑 test+build 且全绿（附 run 链接）。
- [ ] `release.yml` 语法有效，三个 job 齐备；本地 AppImage + win portable 打包成功（附产物文件名与大小）。
- [ ] `package.json` 有 mac 目标配置；产物路径全部在 `.gitignore` 覆盖内，`git status` 干净。
- [ ] README 安装章节含三平台 Release 下载说明；`docs/RELEASE.md` 存在。
- [ ] 仓库里没有新增任何二进制产物。
- [ ] 变更已 merge 进 main 并 push（或写明原因与分支 SHA）。

## 测试命令

```bash
npm ci && npm test && npm run build
npm run dist:linux && ls -lh release/   # AppImage
npm run dist:win && ls -lh release/     # win portable（交叉打包）
npx --yes @action-validator/cli .github/workflows/ci.yml 2>/dev/null || echo "用 gh api 或在线校验 workflow 语法"
git status --porcelain                   # 必须为空（产物不进 git）
```
