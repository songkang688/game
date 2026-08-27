# 发版手册(给维护者)

发行包不是手工传的:**打一个 tag,GitHub Actions 就会把 Windows / macOS / Linux / 安卓的包
全部打出来,并挂到对应的 GitHub Release 上。** 本地不用、也不该去打 dmg。

## 一次发版的完整步骤

1. **对齐版本号。** `package.json` 里的 `version` 必须和要打的 tag 去掉 `v` 之后完全一致
   ——比如 tag `v1.1.0` 对应 `"version": "1.1.0"`。
   工作流第一步就会校验这一条,对不上直接失败,不会出包(否则文件名里的版本会和 Release 对不上)。

2. **确认要发的提交已经在远端分支上**,本地跑一遍 `npm test && npm run build` 心里有底。

3. **打 annotated tag 并推上去:**

   ```bash
   git fetch origin game-1.2
   git checkout game-1.2 && git pull origin game-1.2
   git tag -a v1.2.0 -m "一朵一星 1.2.0"
   git push origin v1.2.0
   ```

   > tag 一律用 `-a`(annotated,带作者和说明),不要用轻量 tag。
   > **不要 force 改已经推出去的 tag**:别人可能已经下载过那个版本的包了。
   > 发错了就把版本号往上加一位,重新发一个(比如 `v1.1.1`)。

4. **盯 Actions。** 仓库 → Actions → `Release` 工作流,或者:

   ```bash
   gh run list --workflow=release.yml
   gh run view <run-id>
   ```

5. 全绿之后,Release 页会出现在
   `https://github.com/songkang688/game/releases/tag/v1.2.0`,资产就是各平台安装包。

## 发版记录

| 版本 | tag | 基线分支 | 内容 |
| ---- | ---- | ---- | ---- |
| 1.1.0 | `v1.1.0` | `game-1.1` | 55 款游戏、188 关战役、2.5D 跑酷、首页筛选与收藏册 |
| 1.2.0 | `v1.2.0` | `game-1.2`(窗口 1–5 全部合入) | **76 款**游戏(新增 21 款)、55 款老游戏精细化升级、手游/端游筛选、闯关/对战/无尽兼容壳、root 高权限门 |

### 1.2.0 这次是怎么发的

- 版本号从 `1.1.0` 提到 `1.2.0` 的提交在分支 `cursor/1.2-release-tag-027e` 上,
  它是从 `game-1.2` 的窗口 5 合入点(`2c02497`)开出来的;
  annotated tag `v1.2.0` 打在这个「版本号已经是 1.2.0」的提交上。
- 同一个提交里顺手把对外文案的「1.1 / 55 款」改成了「1.2 / 76 款」:
  README 标题与清单、家长说明弹窗(`src/ui/parentGate.ts`)、
  以及 `release.yml` 生成 Release 说明时那句介绍。
  **发行页和 README 的数字要一致**,不然用户下载前后看到两个说法。
- 76 = 1.1 的 55 款 + 1.2 新接入的 21 款,按 `src/games/*/meta.ts` 的实际数量数出来的,
  不是拍脑袋写的;以后加了游戏记得同步这几处。

## 工作流里都有什么

| 工作流 | 什么时候跑 | 干什么 |
| ---- | ---- | ---- |
| `.github/workflows/ci.yml` | push 到 `main` / `game-1.1` / `game-1.2`,以及所有 PR | Node 22 上 `npm ci && npm test && npm run build` |
| `.github/workflows/release.yml` | push `v*` tag | 校验版本号 → 跑测试 → 三个平台出包 → 建 Release 挂资产 |

`release.yml` 的 job:

- **test**:版本号校验 + `npm test` + `npm run build`。**不过就不出包**,三个打包 job 都 `needs: test`。
- **linux-windows**(ubuntu-latest):`electron-builder --linux AppImage --win portable`。
  Windows **便携版**在 Linux 上交叉打没问题(exe 的图标/版本信息用纯 JS 的 resedit 改写,不需要 wine)。
- **windows-setup**(windows-latest):`electron-builder --win nsis`,出安装器 `*-win-setup.exe`。
  为什么单独拉一个 Windows runner:**NSIS 安装器在 Linux 上打必须有 wine**
  (实测报 `wine process failed ENOENT`),而在 CI 里装 wine 要额外几分钟和上 G 的依赖,
  还得盯着 wine 版本;直接用原生 Windows runner 更省事也更可靠,公开仓库跑 Actions 不额外花钱。
  这个 job 挂了也不影响别的:便携版仍然由上面的 Linux job 产出。
- **mac**(macos-latest):`npx electron-builder --mac dmg zip --x64 --arm64`,
  Intel 和 Apple 芯片各出一份 dmg + zip。
- **android**(ubuntu-latest):JDK **21** + Android SDK(API 36),跑仓库自带的 `npm run android:apk`,
  出 **debug** 签名的 APK,再改名成 `yiduo-yixing-<版本>-android-debug.apk`。
- **release**:把上面三个 job 的产物下下来,一次性挂到 Release。
  设了 `if: !cancelled()`,所以 **某个平台挂了,其它平台已经打好的包照样发出去**;
  只有 test 失败才整个不发。若 tag 那棵树上有演示视频(`docs/demos/*.mp4`),也会一并挂上去。

  JDK 必须是 21:Capacitor 8 的 `capacitor-android` 是按 Java 21 编的,
  用 17 会在 `:capacitor-android:compileDebugJavaWithJavac` 报 `invalid source release: 21`。

产物同时用 `actions/upload-artifact` 存了一份,run 页面上可以单独下载,方便出问题时排查。

## 某个平台的包没打出来怎么补(不用重新打 tag)

`release.yml` 带了一个手动入口:仓库 → Actions → `Release` → **Run workflow**,
在 `tag` 里填已经存在的 tag(比如 `v1.1.0`)。它会 **用那个 tag 上的代码** 重新走一遍打包,
把产物补挂到那个 tag 已有的 Release 上(工作流本身用的是你所在分支的最新版本,
所以修好的打包脚本能直接生效,不用为了修 CI 再发一个版本号)。

已知的一次:`v1.1.0` 第一次跑时 android job 用的是 JDK 17,APK 没出来;
JDK 改成 21 之后,用上面的手动入口补跑 android 即可把 APK 挂上去。

## 一个已知的小坑:测试超时

CI 里跑测试用的是 `npm test -- --testTimeout=30000`,不是光秃秃的 `npm test`。
原因是 `src/games/bomb-buddies/ai.test.ts` 里那个「三档电脑在六张擂台各打三分钟」的模拟用例,
开发机上 4 秒出头就跑完,GitHub runner 上会超过 vitest 默认的 5 秒超时而假失败。
以后谁方便的话,把 `testTimeout: 30000` 挪进 `vite.config.ts` 的 `test` 段更干净,
那样本地跑 `npm test` 也不会偶发红。

## macOS 包没有签名(重要)

我们没有买苹果开发者账号,所以 mac 的包是 **无签名** 的:
工作流里设了 `CSC_IDENTITY_AUTO_DISCOVERY=false` 和 `--config.mac.identity=null`,
明确告诉 electron-builder 别去钥匙串找证书,也别写签名身份。

后果是用户第一次打开会看到「无法打开,因为无法验证开发者」。**正确的打开方式是:**

1. 把 App 拖到「应用程序」里;
2. **右键(或按住 Control 点)图标 → 选「打开」→ 弹窗里再点一次「打开」」**;
3. 之后就能像正常应用一样双击了。

这句话在 README 和 Release 说明里都写了,发版时别删。
如果以后买了开发者证书,把证书放进仓库 Secrets(`CSC_LINK` / `CSC_KEY_PASSWORD`),
去掉那两个关签名的参数即可 —— **不要把证书或密码写进工作流文件**。

## Windows 与安卓的提示

- Windows 包同样没有代码签名证书,SmartScreen 会提示「不常见的应用」,
  用户点「更多信息 → 仍要运行」即可。
- 安卓出的是 **debug 签名**的 APK,给家里人装够用;
  上架应用商店需要正式签名,参考 [Capacitor 文档](https://capacitorjs.com/docs/android)。

## 不要做的事

- **不要把 `release/` 里的安装包提交进 git**(一个包 100 MB 以上,已在 `.gitignore` 里忽略)。
- **不要在工作流里硬编码任何证书、密码、token。** `GITHUB_TOKEN` 由 Actions 自动注入,
  `release.yml` 里只声明了 `permissions: contents: write`,够用了。
- **不要 force push tag**。
