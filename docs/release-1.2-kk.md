# 📦 鸭梨康康 1.2-kk · 发布说明与构建记录

| 项 | 值 |
| --- | --- |
| 对外版本 | **1.2-kk** |
| `package.json` `version` | `1.2.0-kk`（语义化版本的预发布写法，`electron-builder` / CI 校验都吃这个格式） |
| 产品显示名 | **鸭梨康康**（原「一朵一星」） |
| 分支 | `1.2-kk`，从 `origin/game-1.2` 切出，**只维护 PR，base = `game-1.2`**（[PR #35](https://github.com/songkang688/game/pull/35)） |
| 游戏数量 | 76 款（`src/games/*/meta.ts` 点数） |
| 存档兼容 | ✅ 完全兼容，key 前缀仍是 `yiduo-yixing.` |

本叉整体说明见 [`docs/game-1.2-kk.md`](./game-1.2-kk.md)。

## 一、这一版改了什么

- **换人物**：朵朵 → **鸭梨**（左，女），星星（角色）→ **康康**（右，男）。
  头像、首页欢迎语、游戏内文案、双人对战 P1/P2 的称呼全部跟着改，
  局内分人的小图标从 🌸/⭐ 换成 🍐/👓。含角色的 9 款游戏标题也一并改名，
  对照表见 [`docs/game-1.2-kk.md`](./game-1.2-kk.md)。
- **换产品名**：一朵一星 → **鸭梨康康**。落到这些地方：
  - `package.json` → `build.productName`（Windows / macOS 安装包显示名）
  - `vite.config.ts` → PWA `manifest.name` / `short_name` / `description`（手机主屏图标下的字）
  - `electron/main.cjs` → 桌面窗口标题
  - `capacitor.config.ts` + `android/app/src/main/res/values/strings.xml` → 安卓应用名
  - `index.html` → 浏览器标签标题与 `meta description`
  - `.github/workflows/release.yml` → GitHub Release 的标题
- **对外版本号**：`1.1.0` → `1.2.0-kk`，安装包文件名随之变成
  `yiduo-yixing-1.2.0-kk-<平台>.<后缀>`。
- **文档**：新增本文件与 `docs/game-1.2-kk.md`；README 补「1.2-kk 构建与发布」小节，
  并把游戏清单从 1.1 的 55 款补齐到实际的 **76 款**（新增 21 款分门别类列出），
  各分类小标题的款数也一并对齐。

### 明确没改的

玩法逻辑与数值、188 关战役结构、三星评级、家长门 / root 门、收藏册加成、音效合成，
以及 `docs/qa/**` 的历史验收记录。

**评分体系的「星星」不改名**：三星评级、星星余额、用星星解锁人物宠物装备，
这套词汇跟角色无关，继续叫星星、继续用 ⭐。

### 升级与回滚

- 从 1.1 / 1.2 直接覆盖安装即可，`appId` 与安卓 `package_name` 都还是
  `com.yiduoyixing.hub`，属于同一个应用的新版本，**进度原地保留**。
- 想回退，装回旧版本的包就行；存档在 localStorage 里，两个版本读的是同一批 key。
- PWA 用户不用重装：Service Worker 是 `autoUpdate`，下次联网打开会自动换成新版，
  主屏图标下的名字会更新为「鸭梨康康」（部分系统需要重新添加到主屏才刷新名字）。

## 二、本轮测试与构建记录

在分支 `1.2-kk` 上实跑，Node **v22.14.0** / npm **10.9.7**：

| 步骤 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `npm test -- --testTimeout=30000` | ✅ **674 个测试文件 / 14817 条用例全部通过**，耗时 180.69s |
| 类型检查 + 构建 | `npm run build`（= `tsc --noEmit && vite build`） | ✅ 通过，`built in 629ms`，无类型错误 |
| PWA 产物 | 同上（`vite-plugin-pwa` generateSW） | ✅ 预缓存 **188 项 / 约 5203 KiB**，生成 `dist/sw.js`、`dist/workbox-*.js` |
| 产物体积 | `du -sh dist` | 5.5 MB |

- **验证的提交：`f91d08c`**（三个档 A / B / C 全部合到一起之后的分支尖端）。
  分叉起点是 `69d6c31`，即 `origin/game-1.2` 当时的 HEAD。
- 构建产物落在 `dist/`：`index.html`、`assets/`、`icons/`、`manifest.webmanifest`、
  `sw.js`、`workbox-<hash>.js`。`dist/` 不进 git。
- 生成的 `dist/manifest.webmanifest` 已确认写着 `"name":"鸭梨康康"`。
- 中途有一次红：档 B 改完游戏标题后，`src/ui/homeFilters.test.ts` 里写死的拼音首字母
  期望值还停在 `朵朵星星象棋` / `朵星地产`，3 条用例失败；档 B 随即用 `f91d08c` 补齐，
  上面这次全绿的记录就是在那之后跑的。
- 清单一致性另跑了一遍对拍：README 的 76 行游戏清单与 `src/games/*/meta.ts` 的 `title`
  逐条对上，不多不少。
- `npm test` 直接跑（不带 `--testTimeout`）在慢机器上可能因
  `src/games/bomb-buddies/ai.test.ts` 的长时模拟用例假失败，CI 一律带
  `--testTimeout=30000`，见 [`docs/RELEASE.md`](./RELEASE.md)。
- 构建时有一条 Rollup 提示 `[INEFFECTIVE_DYNAMIC_IMPORT] src/ui/parentAuth.ts …`，
  是 `game-1.2` 上就有的既有告警，不是本叉引入的，不影响产物。

> **本轮没有发布到 npm，也没有建 GitHub Release。** 本分支只维护 PR
> （base = `game-1.2`），出正式包要走下面的流程，由有写权限的维护者执行。

## 三、怎么出包

先把代码准备好：

```bash
git fetch origin 1.2-kk
git checkout 1.2-kk
npm install
npm test -- --testTimeout=30000   # 674 个测试文件 / 14817 条用例
npm run build                     # 先出 dist/,下面各端都基于它
```

### 📱 PWA（手机上安装，最省事）

1. 把 `dist/` 整个目录部署到任意 HTTPS 静态服务器；局域网内自测可以直接
   `npm run preview`（默认 `http://localhost:4173`，PWA 安装要 HTTPS 或 localhost）。
2. 手机浏览器打开地址：
   - **iPhone（Safari）**：分享 → 「添加到主屏幕」。
   - **安卓（Chrome / Edge）**：菜单 → 「安装应用 / 添加到主屏幕」。
3. 装完从主屏图标进，全屏、可离线（Service Worker 预缓存 188 项）。
   图标下显示的名字就是 manifest 里的 **鸭梨康康**。
4. 部署注意：`vite.config.ts` 里 `base: "./"`，放子目录也能跑，不用改配置。
   更新版本后旧客户端会自动拉新（`registerType: "autoUpdate"`）。

### 🪟 Windows

```bash
npm run dist:win        # 便携版 exe,Linux 上也能交叉打
npm run dist:win:nsis   # 安装器 exe,在 Linux 上打需要 wine,建议直接在 Windows 上跑
npm run dist:win:all    # scripts/dist-win.sh,两个一起出
```

产物（`release/` 目录，已在 `.gitignore` 里）：

| 命令 | 产物 |
| --- | --- |
| `npm run dist:win` | `release/yiduo-yixing-1.2.0-kk-win-portable.exe` |
| `npm run dist:win:nsis` | `release/yiduo-yixing-1.2.0-kk-win-setup.exe` |

安装 / 打开时 SmartScreen 会提示「不常见的应用」——没买代码签名证书，
点「更多信息 → 仍要运行」即可。

### 🐧 Linux / 🍎 macOS

| 平台 | 命令 | 产物 |
| --- | --- | --- |
| Linux | `npm run dist` 或 `npm run dist:linux` | `release/yiduo-yixing-1.2.0-kk-linux-x86_64.AppImage`（`chmod +x` 后双击） |
| macOS（必须在 Mac 上执行） | `npm run dist:mac` | `release/yiduo-yixing-1.2.0-kk-mac-<arch>.dmg` / `.zip`，x64 与 arm64 各一份 |

mac 包无签名，第一次打开要 **右键图标 → 打开 → 再点一次「打开」**。

### 🤖 安卓 APK

```bash
npm run android:apk     # 构建 → cap sync android → gradlew assembleDebug
```

需要 `ANDROID_HOME`（或 `ANDROID_SDK_ROOT`）与 **JDK 21**（Capacitor 8 按 Java 21 编，
用 17 会在 `:capacitor-android:compileDebugJavaWithJavac` 报 `invalid source release: 21`）。
产物：`android/app/build/outputs/apk/debug/app-debug.apk`，debug 签名，家里自己装够用。

### 🏷️ 正式发版（打 tag 让 CI 出包）

完整手册见 [`docs/RELEASE.md`](./RELEASE.md)，这里只记与本叉相关的两点：

1. **tag 必须与 `package.json` 的 `version` 对得上**：本叉是 `1.2.0-kk`，
   所以 tag 是 `v1.2.0-kk`。`release.yml` 第一步就校验，对不上直接失败、不出包。
2. 打 tag 之前先确认 PR 已经合入目标分支；本分支自身**不合进 `game-1.2`**，
   要发版由维护者在合并后的分支上打。

```bash
# 维护者操作,本窗口不执行
git tag -a v1.2.0-kk -m "鸭梨康康 1.2-kk"
git push origin v1.2.0-kk
```

CI 会跑测试 → Linux/Windows/macOS/安卓四路出包 → 建 Release 挂资产。
**不要 force push 已经推出去的 tag**，发错就把版本号往上加一位重发。
