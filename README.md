# 🌸 一朵一星 ⭐

送给一年级左右(6–7 岁)小朋友的原创小游戏合集。

- 🎨 粉彩萌系界面、大圆角、大按钮,全中文
- 🚫 无广告、无内购、无联网账号
- 💾 星星和进度只保存在本机(localStorage),不上传任何数据
- 🎵 音效全部由 Web Audio 现场合成,不依赖外部音源
- 📦 一套代码,四种玩法:网页 / 手机 PWA / 电脑安装包 / 安卓 APK

> 所有游戏均为**原创同类型玩法**,不使用任何商业 IP、商标或角色。

当前合集 **27** 款短局小游戏:

| 分类 | 游戏 |
| ---- | ---- |
| 闯关 | 花园守卫、海底大胃王、绿芽保卫战、彩虹跑跑、水果切切乐 |
| 休闲 | 星星消消乐、记忆翻翻乐、接住小水果、地鼠嘭嘭、拼图乐园、泡泡噗噗、贪吃毛毛虫、碰碰砖块、连连看、萌猫小屋、气球砰砰 |
| 对战 | 红蓝拔河、红蓝点点、红蓝赛跑 |
| 学习 | 算数小农场、识字小花园、拼音小火车、形状王国、找不同、时钟小屋 |
| 动手 | 涂色小屋、音乐星星 |

---

## 快速开始

需要 Node.js ≥ 22(建议 22.14+)。

```bash
npm install        # 安装依赖
npm run dev        # 本地开发,浏览器打开提示的地址
npm test           # 跑单元测试(vitest)
npm run build      # 类型检查 + 构建到 dist/
npm run preview    # 本地预览构建产物
```

## 📱 手机上安装(PWA)

1. 把 `dist/` 部署到任意支持 HTTPS 的静态服务器(或局域网内 `npm run preview`)。
2. 手机浏览器打开地址:
   - **iPhone(Safari)**:分享按钮 → 「添加到主屏幕」。
   - **安卓(Chrome/Edge)**:菜单 → 「安装应用 / 添加到主屏幕」。
3. 之后从主屏幕图标打开,全屏运行、支持离线(Service Worker 预缓存)。

## 💻 电脑安装包(Electron)

```bash
npm run dist        # 构建 + 打 Linux AppImage,产物在 release/
```

产物路径:

| 平台 | 命令 | 产物 |
| ---- | ---- | ---- |
| Linux | `npm run dist` 或 `npm run dist:linux` | `release/yiduo-yixing-<版本>-linux-x86_64.AppImage` |
| Windows 便携版 | `npm run dist:win` | `release/yiduo-yixing-<版本>-win-portable.exe` |
| Windows 安装器(NSIS) | `npm run dist:win:nsis` | `release/yiduo-yixing-<版本>-win-setup.exe` |

说明:

- AppImage 下载后 `chmod +x` 即可双击运行。
- Windows 便携版在 Linux 上也能交叉打包;**NSIS 安装器**在 Linux 上打包需要安装 wine,建议直接在 Windows 机器上执行 `npm run dist:win:nsis`。
- 安装包体积约 100–120 MB(内含 Chromium),因此 **不要把 release/ 提交进 git**(已在 `.gitignore` 中忽略)。
- 开发时想直接跑桌面窗口:`npm run electron:dev`。

## 🤖 安卓打包(Capacitor)

`android/` 工程已生成并提交,打 debug APK 的步骤:

1. 安装 Android Studio(或命令行 SDK),确保设置了 `ANDROID_HOME`(或 `ANDROID_SDK_ROOT`),并装好 JDK 17+。
2. 一条命令出包:

```bash
npm run android:apk
```

   脚本会依次:构建 Web 产物 → `cap sync android` → `gradlew assembleDebug`。

3. 产物路径:`android/app/build/outputs/apk/debug/app-debug.apk`,传到手机安装即可(需允许安装未知来源应用)。

也可以 `npx cap open android` 用 Android Studio 打开工程后点运行。
正式签名发布请参考 [Capacitor 官方文档](https://capacitorjs.com/docs/android)。

> 注:Capacitor CLI 读取 `capacitor.config.ts` 需要 Node 22+ 的
> `--experimental-strip-types`,仓库里的脚本已自动带上,无需手动设置。

## 🧩 给游戏开发者:游戏模块约定

每个小游戏放在 `src/games/<游戏id>/index.ts`,平台用
`import.meta.glob("../games/*/index.ts", { eager: true })` 自动收集,
**合并进仓库即自动出现在首页**,无需改壳代码。

模块需要导出 `meta` 和 `mount`(命名导出或 default 导出均可):

```ts
import type { GameAPI, GameMeta } from "../../engine";

export const meta: GameMeta = {
  id: "my-game",          // 全局唯一,建议与目录名一致
  title: "我的小游戏",     // 中文短标题
  emoji: "🐱",            // 卡片图标
  category: "casual",     // action 闯关 | casual 休闲 | party 对战 | edu 学习 | create 动手
  color: "#ffd6e7",       // 卡片粉彩主题色
  blurb: "一句话介绍"      // 给小朋友看的说明
};

export function mount(api: GameAPI): { destroy: () => void } {
  // api.root      —— 挂载点,把 DOM / canvas 放进来
  // api.play(x)   —— 合成音效:tap/win/oops/coin/pop/meow/jump
  // api.addStars  —— 增减星星余额(onWin 会自动加星,别重复加)
  // api.getStars  —— 查询星星余额
  // api.onWin(1|2|3, 提示语) —— 通关结算(自动加星 + 记录最好成绩)
  // api.onLose(提示语)       —— 失败结算(不扣星)
  const el = document.createElement("div");
  api.root.appendChild(el);
  return {
    destroy() {
      el.remove(); // 清理定时器、事件监听、canvas 循环等
    }
  };
}
```

引擎还提供可选工具:`createLoop`(rAF 游戏循环)、`attachCanvas`(自适应 DPR 画布),从 `../../engine` 导入。

## 📁 目录结构

```
├── index.html            # 入口页
├── vite.config.ts        # Vite + PWA 配置
├── capacitor.config.ts   # Capacitor(安卓)配置
├── electron/             # Electron 桌面壳(main.cjs / preload.cjs)
├── android/              # Capacitor 生成的安卓工程
├── public/icons/         # 应用图标(SVG 源文件 + 生成的 PNG)
├── scripts/              # 打包与图标生成脚本
└── src/
    ├── main.ts           # 启动入口(注册 PWA、挂载应用)
    ├── styles.css        # 粉彩萌系主题
    ├── engine/           # 类型约定、存档、音效、画布循环、游戏加载器(含测试)
    ├── ui/               # 首页、游戏壳、弹窗、家长门
    └── games/            # 各个小游戏(每个一个目录,自动收集)
```

## 👪 家长须知

- 首页右上角「👪」按钮进入家长说明(需回答一道乘法题)。
- 家长面板中可以一键清空本机全部进度。
- 建议每次游玩不超过 20 分钟,保护眼睛。

## 许可

代码 MIT。所有玩法与美术均为原创,不包含任何商业 IP。
