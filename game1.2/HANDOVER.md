# 一朵一星 · 项目交接文档（详细版）

> 面向：接手本仓库继续开发的工程师
> 仓库：`github.com/songkang688/game`
> 基线：`main` 分支，最新提交 `f5af789`（三人组 R3 监督修复收尾）
> 校验方式：本文档中的每一条结论都来自实际读源码 + 实际运行 `npm test` / `npm run build`，不是推测
> 实测数据：`npm test` = **50 个测试文件 / 818 个用例全过**；`npm run build` = `tsc --noEmit` 无错 + Vite 构建成功，主 chunk 48.24 kB（gzip 17.51 kB）
> 简版请看同目录的 [`HANDOVER-SIMPLE.md`](./HANDOVER-SIMPLE.md)（5–10 分钟读完）

---

## 目录

1. [项目是什么](#1-项目是什么)
2. [技术栈与运行时](#2-技术栈与运行时)
3. [完整目录结构](#3-完整目录结构)
4. [命令速查](#4-命令速查)
5. [应用入口与启动链路](#5-应用入口与启动链路)
6. [UI 架构与页面流](#6-ui-架构与页面流)
7. [游戏插件模型：一个游戏是怎么被发现和加载的](#7-游戏插件模型一个游戏是怎么被发现和加载的)
8. [三种游戏实现档次](#8-三种游戏实现档次)
9. [横切系统](#9-横切系统)
10. [数据流与状态](#10-数据流与状态)
11. [逐个游戏说明（34 款）](#11-逐个游戏说明34-款)
12. [样式与资源](#12-样式与资源)
13. [测试策略](#13-测试策略)
14. [打包与分发](#14-打包与分发)
15. [如何新增一个小游戏（step-by-step）](#15-如何新增一个小游戏step-by-step)
16. [已知约定、陷阱与扩展点](#16-已知约定陷阱与扩展点)
17. [已知问题与待办](#17-已知问题与待办)
18. [给接手人的建议工作流](#18-给接手人的建议工作流)
19. [附录 A：本次文档的实施计划](#附录-a本次文档的实施计划)
20. [附录 B：全部存档 key 清单](#附录-b全部存档-key-清单)
21. [附录 C：本次交接的验证记录](#附录-c本次交接的验证记录)

---

## 1. 项目是什么

**「一朵一星」**（英文包名 `yiduo-yixing`，appId `com.yiduoyixing.hub`）是一套送给**一年级左右（6–7 岁）小朋友**的原创小游戏合集。两位吉祥物角色叫**朵朵**（粉裙小女生）和**星星**（蓝背心小男生），项目名与所有 UI 文案都围绕这两个角色展开。

### 产品定位与硬性原则

这些原则贯穿全部代码，改动时不要破坏：

| 原则 | 具体表现 |
| --- | --- |
| 全中文、适龄 | 所有界面文案简体中文，大圆角（30px）、大按钮（热区普遍 ≥ 44–50px）、粉彩配色 |
| 零商业 IP | 全部玩法与角色都是原创同类型玩法。角色名如糯糯/云云/墩墩/闪闪（小鸟）、绿绿豆（对手）、啾啾（小怪物）、团团（猫）。**注释里也不能出现商标词** |
| 无广告、无内购、无账号 | 代码里没有任何统计 SDK、外链、网络请求 |
| 完全离线可玩 | 音效由 Web Audio 现场合成（`src/engine/audio.ts`），字体走系统字体栈，图标是本地 PNG/SVG，没有 CDN 依赖 |
| 进度只存本机 | 全部进度写 `localStorage`，永不上传。隐私模式下自动降级为内存存储 |
| 失败不惩罚 | 学习类答错只有鼓励语（「没关系，再想一想～」），失败只重试本关、不清进度、不扣星 |
| 一套代码四端 | 网页 / 手机 PWA / 桌面 Electron 安装包 / 安卓 Capacitor APK |

### 规模

- **34 款小游戏**，五个分类：闯关 7 / 休闲 13 / 对战 6 / 学习 6 / 动手 2
- 每款游戏内置 **99 关**成长路线（五子棋是 99 道残局棋谜），三星评级，共约 3366 关
- `src/` 下 187 个文件、约 4.7 万行 TypeScript + CSS

> ⚠️ 根目录 `README.md` 仍写「共 31 款」，是过时的：`duo-arena`（朵星擂台）、`duo-rush`（朵星双人冲刺）、`xiangqi`（朵朵星星象棋）三款后来加入但没有回写 README。以代码为准。

---

## 2. 技术栈与运行时

| 项目 | 选型 | 说明 |
| --- | --- | --- |
| 语言 | TypeScript 7.x（`strict: true`） | `tsconfig.json` 排除 `*.test.ts`，`noEmit: true`，类型检查靠 `npm run build` 里的 `tsc --noEmit` |
| 框架 | **无框架**，原生 DOM API | 没有 React/Vue。所有 UI 都是 `document.createElement` + 手写 CSS 字符串 |
| 构建 | Vite 8 | `vite.config.ts`，`base: "./"`（相对路径，Electron 的 `file://` 与 Capacitor 都能直接加载 dist） |
| PWA | `vite-plugin-pwa` 1.3 | `registerType: "autoUpdate"`，构建后预缓存 58 项 / 约 1.3 MB |
| 测试 | Vitest 4 | `environment: "node"`，只收 `src/**/*.test.ts` |
| 包管理 | npm（有 `package-lock.json`） | Node ≥ 22（建议 22.14+），本机实测 v22.14.0 |
| 桌面 | Electron 44 + electron-builder 26 | `electron/main.cjs` + `preload.cjs` |
| 安卓 | Capacitor 8 | `capacitor.config.ts` + 已提交的 `android/` Gradle 工程 |
| 运行时依赖 | 只有 `@capacitor/core` 和 `@capacitor/android` | Web 端运行时**零第三方依赖**，游戏全部手写（物理、AI、音频都是自己实现） |

**重要**：`environment: "node"` 意味着 **测试里没有 DOM**。所以所有单元测试只能测纯函数（关卡表、物理、AI、评星、文案生成）。UI 行为要靠 `scripts/` 下的 Puppeteer 冒烟脚本验证。

---

## 3. 完整目录结构

```
game/
├── index.html                  # 唯一入口页，挂载点 <div id="app">
├── package.json                # 脚本 + electron-builder 配置（build 段）
├── vite.config.ts              # Vite + PWA manifest + vitest 配置（三合一）
├── tsconfig.json               # 严格模式，排除 *.test.ts
├── LICENSE                     # MIT
├── README.md                   # 面向用户/家长的说明（游戏数已过时）
├── .gitignore                  # 忽略 node_modules/dist/release/android 构建产物
│
├── src/                        # ★ 全部业务代码
│   ├── main.ts                 # 启动入口：注册 PWA + createApp
│   ├── styles.css              # 1100+ 行粉彩主题（平台壳层专用）
│   ├── assets/avatars/         # 朵朵与星星的 4 张 Q 版 PNG
│   ├── engine/                 # 平台引擎（类型、存档、音效、循环、加载器）
│   ├── ui/                     # 平台壳层（首页、游戏壳、弹窗、家长门…）
│   └── games/                  # ★ 34 个游戏目录 + 3 个横切模块
│
├── public/icons/               # 应用图标（icon.svg 源 + 生成的 PNG）
├── scripts/                    # 打包脚本 + 4 个 Puppeteer 冒烟脚本 + 图标生成
├── electron/                   # 桌面壳（main.cjs 主进程 / preload.cjs）
├── android/                    # Capacitor 生成的安卓工程（已提交）
└── docs/
    ├── qa/                     # 历史三人组走查报告（R1/R2/R3）
    └── upgrade-prompts/        # 8 步升级路线的历史提示词与审查报告
```

### 3.1 `src/engine/` —— 平台引擎（8 文件）

| 文件 | 职责 |
| --- | --- |
| `types.ts` | 全部核心类型：`GameMeta`、`GameAPI`、`GameMount`、`GameModule`、`GameCategory`、`SoundName`；以及 `CATEGORY_LABELS`（分类中文名）和 `CATEGORY_ORDER`（展示顺序） |
| `index.ts` | 引擎统一出口，游戏 `import ... from "../../engine"` 时走这里 |
| `loader.ts` | **游戏自动发现**。双 `import.meta.glob`：eager 收集 `meta.ts`、lazy 收集 `index.ts`。负责校验、归一化、去重、排序 |
| `save.ts` | 平台存档（星星余额、音效/BGM 开关、每游戏最好成绩）+ 进度导出/导入/全清 |
| `audio.ts` | 7 种 Web Audio 合成音效 + 五声音阶 BGM 生成器 |
| `loop.ts` | 可选工具：`createLoop`（rAF 循环，dt 钳到 1/20 秒）、`attachCanvas`（自适应 DPR 画布） |
| `loader.test.ts` / `save.test.ts` / `audio.test.ts` | 三个引擎模块的单测 |

### 3.2 `src/ui/` —— 平台壳层（8 文件）

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `app.ts` | 62 | 应用根：hash 路由（首页 ↔ 游戏页）+ 背景漂浮装饰 |
| `home.ts` | 376 | 首页：Logo、星星余额、音效/BGM/家长按钮、问候语、最近玩过、分类页签、卡片网格 |
| `gameShell.ts` | 185 | 游戏壳：顶栏（返回/标题/星星/BGM）+ 舞台 + 构造 `GameAPI` + 胜负结算 + 异步加载防竞态 |
| `dialogs.ts` | 222 | 通用弹窗 `showDialog` + 胜负结算弹窗 `showResultDialog` + **防狂点冷静期** `isGuardedClick` |
| `parentGate.ts` | 289 | 家长门（乘法题 + 答错 3 次锁 30 秒）→ 家长面板（说明 / 清空进度 / 导出 / 导入） |
| `avatars.ts` | 60 | 朵朵与星星头像的唯一出口（`createAvatarImg`、`createDuoPair`、`AVATAR_URLS`） |
| `recent.ts` | 45 | 「最近玩过」列表（独立 localStorage key，最多 8 条） |
| `dialogs.test.ts` | 33 | 冷静期与朗读文案的纯函数测试 |

### 3.3 `src/games/` —— 游戏与横切模块

```
src/games/
├── level99.ts       # ★ 99 关通用框架（章节地图 + 每关星级存档 + 结算 UI）
├── quiz99.ts        # ★ 学习类「答题关」运行器（选择题 + 朗读 + 悄悄提示）
├── speech.ts        # ★ 朗读小助手（Web Speech API，无语音包时静默降级）
├── level99.test.ts / quiz99.test.ts / speech.test.ts
└── <34 个游戏目录>/
```

每个游戏目录里的文件角色是固定约定：

| 文件 | 是否必需 | 角色 |
| --- | --- | --- |
| `meta.ts` | **必需** | 纯数据 `meta`，被首页 eager 收集打进主包。**绝对不能 import 任何玩法代码** |
| `index.ts` | **必需** | 导出 `mount(api)`，并在顶部 `import { meta } from "./meta"; export { meta };` 做兼容 re-export。进游戏时才动态加载 |
| `levels.ts` | 常见 | 99 关关卡表 / 章节定义 `CHAPTERS` / 关卡生成器 |
| `logic.ts` | 常见 | 与 DOM 无关的纯逻辑（评星、状态机、生成器、碰撞判定） |
| `physics.ts` | 2 款 | 自写物理（`candy-swing` 绳物理、`sling-birds` 弹弓+破坏） |
| `ai.ts` | 1 款 | 电脑对手（`gomoku` 三档 AI + 禁手） |
| `puzzles.ts` | 1 款 | 残局棋谜库（`gomoku` 99 道） |
| `scene.ts` | 1 款 | SVG 场景绘制（`find-diff`） |
| `*.test.ts` | **强约定** | 与被测文件同目录同名，`levels.test.ts` / `logic.test.ts` / `physics.test.ts` / `ai.test.ts` … |

---

## 4. 命令速查

```bash
# 开发
npm install          # 安装依赖（约 5 秒，依赖很少）
npm run dev          # Vite 开发服务器
npm run preview      # 预览 dist/（冒烟脚本默认连 http://localhost:4173）

# 质量门（提交前必须双绿）
npm test             # vitest run —— 当前 50 文件 / 818 用例
npm run test:watch   # 监听模式
npm run build        # tsc --noEmit && vite build

# 冒烟（需要本机 Chrome + puppeteer-core，非 CI 门禁）
npm i --no-save puppeteer-core
npm run build && npx vite preview --port 4173      # 另开一个终端
node scripts/smoke-games.mjs          # 34 款全量挂载 + 离开重进 + 家长门
node scripts/smoke-l99-deep.mjs       # 22 款 l99 游戏种档直接进第 99 关
node scripts/smoke-campaign-deep.mjs  # 9 款自有战役 UI 的深关
node scripts/smoke-save-corrupt.mjs   # 六类坏存档注入后的自愈验证

# 出包
npm run dist          # Linux AppImage → release/
npm run dist:win      # Windows 便携版（Linux 上可交叉打）
npm run dist:win:nsis # Windows NSIS 安装器（Linux 上需 wine，建议在 Windows 上跑）
npm run electron:dev  # 直接起桌面窗口调试
npm run android:sync  # 构建 + cap sync android
npm run android:apk   # 构建 + sync + gradlew assembleDebug
npm run icons         # 从 SVG 重新生成图标 PNG
```

冒烟脚本可用环境变量：`SMOKE_BASE`（默认 `http://localhost:4173`）、`CHROME_PATH`（默认 `/usr/local/bin/google-chrome`）。

---

## 5. 应用入口与启动链路

```
index.html
  └── <div id="app">                       挂载点，带 aria-live="polite"
  └── <script type="module" src="/src/main.ts">
        │
        ├── import "./styles.css"          全局粉彩主题
        ├── loadGames()                    engine/loader.ts：扫出 34 个 GameModule
        ├── createApp(appEl, games)        ui/app.ts
        │     ├── 插入背景漂浮装饰（6 个 emoji，aria-hidden）
        │     ├── 建立 .view 容器
        │     ├── window.addEventListener("hashchange", route)
        │     └── route()
        │           ├── hash 匹配 /^#\/?game\/(.+)$/ 且找得到该 id
        │           │     → mountGameScreen(view, game, goHome)   ui/gameShell.ts
        │           └── 否则 → renderHome(view, games)            ui/home.ts
        │
        └── setupPWA()                     动态 import "virtual:pwa-register"
              ├── location.protocol === "file:" 时跳过（Electron/Capacitor）
              └── onNeedRefresh → 底部「有新版本啦，点我更新 ✨」小吐司
```

### 路由约定

- 只有两条路由：首页（空 hash）和游戏页 `#/game/<id>`（id 经 `encodeURIComponent`）
- **深链可用**：直接打开 `#/game/gomoku` 会进游戏并记入「最近玩过」（记录点放在游戏壳里，不在首页按钮上，就是为了覆盖深链和 PWA 恢复的场景）
- 每次路由切换先执行上一个页面的 `cleanup()`，再清空 `view.innerHTML`

---

## 6. UI 架构与页面流

### 6.1 首页 `ui/home.ts`

从上到下的结构：

1. **顶栏**：Logo（朵朵头像 + 「🌸一朵一星⭐」+ 星星头像）、星星余额 chip、🔊 音效开关、🎵 BGM 开关、👪 家长入口
2. **问候区**：按时段变化的问候语（夜深啦/早上好/下午好/晚上好）+ 朵朵和星星的立绘
3. **最近玩过**：读 `yiduo-yixing.recent.v1`，最多展示 4 张；空列表时整个分区 `hidden`
4. **分类页签**：全部 🌈 / 闯关 🚀 / 休闲 🍭 / 对战 🤝 / 学习 📚 / 动手 🎨
5. **卡片区**：
   - 「全部」页签按分类分小节渲染（孩子滚动时有方位感）
   - 其他页签渲染单个网格
   - 每张卡片显示 emoji、标题、blurb、历史最好星级（⭐☆），有 99 关进度时额外挂一个 `🚩 n/99` 徽章
6. **页脚**：「🌱 无广告 · 不联网 · 进度只存在这台设备上」

关键实现细节：

- **`l99ClearedCount(id)`（第 31–46 行）**：首页**只读**地解析 `yiduo-yixing.l99.<id>`，统计非零项。这是首页与 99 关框架之间唯一的耦合点，故意做成只读且带 try/catch，坏数据直接返回 `null`。
  - 注意：这个函数只认 `l99` 框架的存档格式，**12 款自有战役 UI 的游戏（如花园守卫、五子棋）不会显示这个徽章**，这是当前的已知限制而非 bug。
- 星星余额通过 `save.onChange(renderStars)` 订阅，`renderHome` 返回的 cleanup 会取消订阅。
- 卡片入场动画用 `--card-i` CSS 变量做错峰，序号封顶在 11。

### 6.2 游戏壳 `ui/gameShell.ts`

这是**平台与游戏之间唯一的接口层**，逻辑很短但每一段都有原因：

```
mountGameScreen(container, game, goHome)
  ├── 顶栏：🏠 返回 | emoji + 标题 | 朵朵星星头像对 | 🎵 BGM | ⭐ 余额
  ├── .game-stage 舞台
  └── start()
        ├── seq = ++startSeq          ← 防竞态：每次 start 领一个序号
        ├── closeDialog() / unmount() ← 清掉上一局
        ├── save.recordPlay(id)       ← 游玩次数 +1
        ├── recordRecent(id)          ← 写「最近玩过」（深链也覆盖）
        ├── showLoading()             ← 「马上就好～」粉彩加载态
        ├── 构造 GameAPI
        └── game.load()               ← 动态 import 该游戏的 chunk
              ├── .then(mount)  若 stale() 则丢弃；否则 mounted = mount(api)
              └── .catch()      控制台报错 + 「这个游戏出了点小问题，先玩别的吧！」
```

三个保护机制值得记住：

- **`stale()` 防竞态**：`disposed || seq !== startSeq`。用户在 chunk 还没下载完时点了「再玩一次」或返回首页，过期的结果会被直接丢弃，不会往已销毁的舞台上挂东西。
- **`finished` 一次性结算**：`onWin`/`onLose` 只认第一次调用，游戏里重复调用不会弹两个结算框。
- **`unmount()` 包 try/catch**：游戏自己的 `destroy()` 抛错不会拖垮整个壳，只打一条 `console.warn`。

`GameAPI` 的五个成员（定义在 `engine/types.ts`）：

| 成员 | 说明 |
| --- | --- |
| `root: HTMLElement` | 舞台节点，游戏把 DOM/canvas 挂这里 |
| `play(name)` | 播放合成音效，`"tap" \| "win" \| "oops" \| "coin" \| "pop" \| "meow" \| "jump"` |
| `addStars(n)` | 增减星星余额（可为负，不低于 0），返回最新余额 |
| `getStars()` | 查询余额 |
| `onWin(1\|2\|3, msg?)` | 通关结算：**自动加对应颗星** + 记录最好成绩 + 弹胜利框。**不要再手动 `addStars`** |
| `onLose(msg?)` | 失败结算：弹鼓励框，**不扣星** |

### 6.3 弹窗 `ui/dialogs.ts`

- `showDialog({ className, content, buttons, dismissible })` 是所有弹窗的底座，返回 `{ close, el }`
- `showResultDialog` 在它上面加：朵朵星星立绘、随机表情/标题/鼓励语、三星逐颗弹出（动画 delay 与 `coin` 音效节奏对齐）、彩带
- **`CLICK_GUARD_MS = 400` 防狂点冷静期**：狂点型玩法（拔河、点点、地鼠）胜负一出时孩子手指还在连点，没有冷静期会瞬间误触「再玩一次/回首页」，画面根本没看到。判定函数 `isGuardedClick(shownAt, now, guard)` 是纯函数，被 `dialogs.test.ts` 覆盖，也被 `level99.ts` 的结算浮层复用
- 结算弹出时会 `speak(标题 + 鼓励语)` 朗读一遍（识字量不够的孩子靠听），关闭/换局时 `stopSpeaking()`
- 默认 `dismissible: false`（点遮罩不关），避免小朋友误触

### 6.4 家长门 `ui/parentGate.ts`

两级结构：

1. **`showParentGate()`**：一道 `3–9 × 3–9` 的乘法题。
   - 防暴力：`MAX_WRONG = 3` 次连错 → 锁 `LOCK_MS = 30_000` 毫秒。
   - `lockUntil` / `wrongStreak` 是**模块级变量**，关掉弹窗再打开也不重置（只有刷新页面才清零，**不写存档**）。
   - 每 500ms 刷新一次倒计时；`content.isConnected === false` 时自动 `clearInterval` 停表。
   - 答错抖动动画靠 `remove class → 读 offsetWidth 触发重排 → add class`。
2. **`showParentPanel()`**：五条家长说明 + 三个功能。
   - **清空全部进度**：双击确认（第一次点变成「再点一次确认清空」），调 `save.resetAll()`
   - **📤 导出进度**：`save.exportAll()` → 同时下载 `一朵一星进度备份-YYYY-MM-DD.txt` 和写剪贴板，两条路都失败才报错
   - **📥 导入进度**：粘贴文本 → `save.importAll()`，全量校验通过才写入

### 6.5 头像 `ui/avatars.ts` 与「最近玩过」`ui/recent.ts`

- `avatars.ts` 是**朵朵和星星形象的唯一出口**，4 张图：`duoduo`（半身 Q）、`xingxing`（半身 Q）、`duoduoCheer`（举奖状庆祝）、`xingxingRun`（奔跑）。所有界面统一从这里取图，保证形象一致。`import` 静态 PNG，Vite 会处理成带 hash 的 URL。
- 三款自有 UI 的对战游戏（`duo-arena`/`duo-rush`/`xiangqi`）没走 `avatars.ts`，而是自己用 `import.meta.glob("../../assets/avatars/*.png", { eager: true, query: "?url" })` 取图并做 emoji 占位降级。**这是历史遗留的重复实现**，新游戏请直接用 `../../ui/avatars`。
- `recent.ts` 用独立 key `yiduo-yixing.recent.v1`，最多留 8 条，首页只展示前 4 条。写入点在游戏壳而非首页按钮。

---

## 7. 游戏插件模型：一个游戏是怎么被发现和加载的

这是整个项目最重要的架构决策：**把游戏目录合并进仓库，首页就自动出现，不需要改任何壳层代码**。

### 7.1 双 glob 按需拆包

`engine/loader.ts` 的 `loadGames()`：

```ts
const metaModules = import.meta.glob("../games/*/meta.ts", { eager: true });  // 立即求值 → 进主包
const implLoaders = import.meta.glob("../games/*/index.ts");                  // 懒加载 → 各自独立 chunk
return collectGames(metaModules, implLoaders);
```

- `meta.ts` 是**纯数据**，34 份加起来只有几 KB，随主包加载，首页立刻能渲染全部卡片
- `index.ts` 及其依赖（levels/logic/physics/ai）被 Vite 拆成独立 chunk，**进游戏时才下载**
- 实测效果：主 chunk 只有 48.24 kB（gzip 17.51 kB），最大的游戏 chunk 是 `sling-birds` 59.89 kB

> 历史背景：这个拆包是升级路线的第 3 步做的。此前 `loader.ts` 用单个 eager glob 把 34 款全打进主包，主 chunk 达 618 kB，低端安卓首屏很慢。**不要退回单 glob。**

### 7.2 `collectGames` 的容错规则

`collectGames(metaModules, implLoaders)` 逐条处理 meta 表，任何一款坏了都不会拖垮首页：

| 情况 | 行为 |
| --- | --- |
| `meta` 缺失 / `id` 或 `title` 为空 | 跳过，`console.warn("忽略无效游戏模块…")` |
| 同目录找不到 `index.ts` 的懒加载器 | 跳过，`console.warn("忽略无实现的游戏…")` |
| `id` 重复 | 只保留第一个，warn 后来者 |
| `category` 不在五个合法值里 | 兜底成 `"casual"` |
| `emoji` / `color` / `blurb` 缺失 | 兜底成 `"🎮"` / `"#ffd6e7"` / `""` |
| 一款游戏都没有 | 返回空数组（首页显示「小游戏正在路上，很快就到啦！」），**绝不抛错** |
| `index.ts` 没有 `mount` | `load()` reject，游戏壳显示错误态 |

同时兼容 `export const meta` 和 `export default { meta }` 两种模块形状（`moduleBody()` 做的归一化）。

排序规则：先按 `CATEGORY_ORDER`（action → casual → party → edu → create），同分类内按 `title.localeCompare(title, "zh-Hans-CN")`。

### 7.3 `meta` 约定

```ts
export const meta = {
  id: "my-game",            // 全局唯一，必须与目录名一致（存档 key 依赖它）
  title: "我的小游戏",       // 中文短标题
  emoji: "🐱",              // 卡片图标
  category: "casual" as const, // action|casual|party|edu|create
  color: "#ffd6e7",         // 卡片粉彩主题色
  blurb: "一句话介绍"        // 给小朋友看的说明
};
```

`as const` 是必要的：`category` 需要窄化到字面量类型才能通过 `GameMeta` 的类型检查。

---

## 8. 三种游戏实现档次

34 款游戏分成三档，接手时先判断你要改的游戏属于哪一档：

### 档 1：`level99` 框架 + 自定义关卡玩法（17 款）

`index.ts` 只写 `playLevel(stage, ctx)`，选关地图、章节页签、星级存档、结算浮层全部由框架提供。

典型例子 `mole-pop/index.ts`（213 行）：

```ts
export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,                       // (stage, ctx) => PlayHandle
    mapHint: "不拍错、留点时间，就能拿 3 星！",
    grandMessage: "99 关地鼠全部拍完，锤子小冠军就是你！",
  });
}
```

游戏：`balloon-pop`、`brick-break`、`bubble-pop`、`color-fun`、`find-diff`、`fruit-catch`、`kitty-care`、`lianliankan`、`match-stars`、`memory-cards`、`mole-pop`、`music-stars`、`puzzle-tiles`、`red-blue-race`、`red-blue-tap`、`red-blue-tug`、`snake-snack`

### 档 2：`level99` + `quiz99` 答题关（5 款，全部是学习类）

`index.ts` 只有 23 行左右，把关卡生成完全交给 `levels.ts` 的 `buildQuestions(level)`：

```ts
// clock-house/index.ts 全文（23 行）
export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "滴答滴答，一层一层爬上时钟小屋～",
    grandMessage: "99 关全部通关，你是时间小管家！",
    playLevel: (stage, ctx) => runQuiz({
      stage, ctx,
      questions: buildQuestions(ctx.level),
      theme: CHAPTER_THEMES[ctx.chapterIndex],
    }),
  });
}
```

游戏：`clock-house`、`math-farm`、`pinyin-train`、`shape-kingdom`、`word-garden`

**这是新增学习类游戏最省力的路径**——只需要写一个 `buildQuestions(level): QuizQuestion[]`。

### 档 3：自有战役 UI（12 款）

这些游戏**不用 `level99`**，各自实现主题选择页 → 选关地图 → 关卡 → 结算，并各自管理独立的 localStorage 存档。基本都是 canvas 或重 DOM，单文件 900–2248 行。

| 分组 | 游戏 | 特点 |
| --- | --- | --- |
| 动作 5 款 | `garden-guard`、`sprout-defense`、`rainbow-run`、`fruit-slice`、`ocean-munch` | 九大主题 × 11 关 = 99，章末 BOSS，`logic.ts` 承载全部纯逻辑（577–1092 行）并被大量单测覆盖 |
| 经典 4 款 | `sling-birds`、`candy-swing`、`bubble-aim`、`gomoku` | 各自的自写物理/AI；六大主题；`gomoku` 是 99 道残局棋谜而非 99 关 |
| 双人 3 款 | `duo-arena`、`duo-rush`、`xiangqi` | 同屏双人对战，**没有 99 关、没有持久化存档**，是一局一局的对战 |

档 3 的共同模式（以 `garden-guard` 为例）：

- `logic.ts` 导出 `PROGRESS_KEY`、`parseProgress`/`serializeProgress`、`starsForLevel`、`isLevelUnlocked`、`isThemeUnlocked`、`themeStars`、`totalStars`、`clearSpeechLine`/`retrySpeechLine` 等**纯函数**
- `index.ts` 是一个大状态机：`type Phase = "themes" | "map" | "intro" | "prewave" | "wave" | "clear" | "retry"`
- 所有 DOM/canvas/计时器都在 `mount` 返回的 `destroy()` 里清理

---

## 9. 横切系统

### 9.1 `src/games/level99.ts` —— 99 关通用框架（603 行）

**注意**：这个文件放在 `src/games/` 下但**不在游戏子目录里**，所以不会被 loader 的 `import.meta.glob("../games/*/meta.ts")` 收集。

提供四件事：

**① 章节工具（纯函数，可测）**

```ts
export const TOTAL_LEVELS = 99;
export interface Chapter { name; emoji; color; desc; size }

totalSize(chapters)              // 全部章节关卡数之和，必须 === 99
chapterOf(chapters, level)       // level（0 基）属于第几章
chapterStart(chapters, ci)       // 第 ci 章的第一关
indexInChapter(chapters, level)  // level 在本章内的序号
```

**② 确定性随机 + 评星工具**

```ts
mulberry32(seed)                 // 可复现伪随机（同一关每次布局一致，也便于测试）
randInt(rand, min, max)
pick(rand, arr)
shuffled(arr, rand)
rateBelow(value, three, two)     // 越小越好（用时、步数）
rateAbove(value, three, two)     // 越大越好（分数、剩余时间）
```

**③ 每关星级存档**

```
key: yiduo-yixing.l99.<gameId>
值 : JSON 数组，长度 99，每项 0..3（0 = 未通过）
```

```ts
loadStars(gameId, storage?)      // 坏数据静默回退成全 0
saveStar(gameId, level, stars)   // 只升不降（保留历史最好）
clearedCount(stars)              // 已通关数
totalStars(stars)                // 累计星数，满分 297
furthestPlayable(stars)          // 第一个未通过的关；全通则最后一关
```

隐私模式（`localStorage` 读写抛异常）下降级到模块级 `memoryFallback` Map，本次会话内仍然记进度。探测 key `yiduo-yixing.l99.probe` 写完立刻删，不会混进备份。

**④ 选关地图 + 结算 UI**

`mountLevelGame(api, opts)` 是唯一入口，`opts` 形状：

```ts
{
  id: string;                                        // 必须 === meta.id（存档 key 用它）
  chapters: Chapter[];                               // 大小之和必须 = 99，否则控制台 warn
  playLevel: (stage, ctx: PlayCtx) => PlayHandle | void;
  mapHint?: string;                                  // 地图底部提示
  grandMessage?: string;                             // 99 关全通时的庆祝语（走平台 onWin）
}
```

`PlayCtx` 交给关卡的东西：`level`（0 基）、`chapter`、`chapterIndex`、`indexInChapter`、`win(stars, msg?)`、`lose(msg?)`、`sfx(name)`、`bonusStars(n)`。

行为要点：

- 地图头部显示 `🚩 n/99 关` 和 `⭐ n/297`，以及「继续 第 n 关 ▶」按钮
- 章节页签：`ci > furthestChapter` 的章节显示 🔒 并保持可点（点了会看到锁着的关卡格子）
- 关卡格子：已解锁显示序号 + 星级；`level > furthest` 显示 🔒 且 `disabled`
- **过关只奖励增量星星**：`gain = max(0, got - prev)`，回头刷 3 星不会重复刷平台星星余额
- **失败只重试本关**：按钮是「🔁 再试本关 / 🗺️ 回地图」，绝不清进度
- 结算浮层同样有 400ms 防狂点冷静期（复用 `ui/dialogs.ts` 的 `isGuardedClick`）
- 结算会朗读 `settleSpeechLine(kind, level, msg)`（纯函数，可测）
- 99 关全通且当前是最后一关时，额外调 `api.onWin(3, grandMessage)` 触发平台级庆祝
- 框架自带的 CSS 以字符串常量 `L99_CSS` 内联注入，类名前缀 `l99-`

### 9.2 `src/games/quiz99.ts` —— 答题关运行器（229 行）

```ts
runQuiz({ stage, ctx, questions, theme, maxWrong = 3, bigChoices })
```

`QuizQuestion` = `{ promptHTML, ask, choices, correct, praise? }`。

行为：

- 答对：`coin` 音效 + 随机夸奖 + 850ms 后进下一题；**连对 4 的倍数额外奖 1 颗平台星星**
- 答错：`oops` + 该选项禁用变灰 + 随机鼓励语（`CHEERS`），**原题继续**，绝不跳题
- **悄悄提示**：`shouldHint(wrongHere, wrongTotal, maxWrong)` 为真时，正确选项开始一闪一闪并朗读「悄悄提示：一闪一闪的那个就是答案！」。触发条件是「同题连错 2 次」或「总错数已到上限」（最后一次机会不让孩子踩空）。这是纯函数，有单测
- 评星：0 错 = 3 星，≤2 错 = 2 星，其余 1 星
- 超过 `maxWrong` → `ctx.lose("这一关的题目有点调皮，我们休息一下再来一次！")`——**文案里没有任何批评**
- 每题切换自动朗读 `ask`；有中文语音包时才显示「🔈 再听一遍」按钮；语音包异步到位（Chrome 的 `voiceschanged`）时会补读当前题

### 9.3 `src/games/speech.ts` —— 朗读小助手（119 行）

包装 `speechSynthesis`，核心是**永不报错、永不崩游戏**：

```ts
speechReady()              // 有接口 且 系统装了中文语音包
whenSpeechReady(onReady)   // 语音包异步到位后回调一次，返回取消函数
speak(text): boolean       // 返回是否真的开始朗读
stopSpeaking()             // 切题/退出关卡/销毁时调用，防叠音
speechText(text)           // 剥掉 emoji 等念不出来的字符（纯函数，有测试）
pickChineseVoice(voices)   // zh-CN 优先 → 任何 zh 开头 → null
```

配置：`SPEECH_LANG = "zh-CN"`，`SPEECH_RATE = 0.85`（放慢，适合一年级）。

没有语音包时：`speechReady()` 返回 false、界面隐藏朗读按钮、`speak()` 什么也不做且无副作用。

使用方：`quiz99`、`level99`、`ui/dialogs`，以及 9 款自有 UI 游戏（`garden-guard`、`sprout-defense`、`rainbow-run`、`fruit-slice`、`ocean-munch`、`sling-birds`、`candy-swing`、`bubble-aim`、`gomoku`）和 `find-diff`。

### 9.4 `src/engine/save.ts` —— 平台存档（374 行）

**数据结构**（key `yiduo-yixing.save.v1`）：

```ts
{ stars: number, soundOn: boolean, bgmOn: boolean, games: Record<id, { bestStars: 0|1|2|3, plays: number }> }
```

**`SaveStore` API**：`getStars` / `addStars` / `isSoundOn` / `setSoundOn` / `isBgmOn` / `setBgmOn` / `getGameProgress` / `recordPlay` / `recordWin` / `onChange` / `exportAll` / `importAll` / `resetAll`。全局单例 `save`。

**健壮性设计**（都有单测）：

- `pickStorage()`：先探测写一次 `yiduo-yixing.probe`，抛异常就降级到内存 Map（隐私模式）
- `sanitize()`：读到坏 JSON、错误类型、越界数值一律回退到默认值，绝不抛
- `persist()` 的 `setItem` 包 try/catch：存储满/被禁用时静默失败，游戏继续可玩
- `bgmOn` 默认 `false`（尊重家长）

**导出 / 导入**（家长面板用）：

- 格式：`"YDYX1." + base64(JSON.stringify({ v: 1, sum: <FNV-1a32>, entries: {key: value} }))`
- `exportAll()` 收集**所有** `yiduo-yixing.` 和 `yiduo.` 前缀的 key，按 key 排序保证同一份进度导出文本稳定；过滤掉 `.probe` 探测 key
- `importAll()` **先整体校验再写入**：头部、版本、格式、key 前缀、校验和全过才动手；写入途中失败（存储满）会**整体回滚**，不留半套存档
- `resetAll()` 同样覆盖两代前缀

**⚠️ 两代前缀这件事非常重要**：

```ts
export const SAVE_PREFIX = "yiduo-yixing.";
export const LEGACY_SAVE_PREFIX = "yiduo.";     // gomoku / candy-swing / bubble-aim 三款的历史前缀
```

这三款游戏的存档 key 是 `yiduo.gomoku.campaign.v2` 等。**存档 key 不能改**（老玩家进度不能丢），所以导出/导入/清空都必须同时覆盖两代前缀。新游戏一律用 `yiduo-yixing.` 前缀。

### 9.5 `src/engine/audio.ts` —— 音效与背景音乐（322 行）

**音效**：7 种，全部用 `OscillatorNode` + `GainNode` + 白噪声 buffer 合成，零外部音源。

| 名字 | 用途 | 合成方式 |
| --- | --- | --- |
| `tap` | 按钮 | 560Hz 正弦 70ms |
| `pop` | 消除/戳破 | 900→150Hz 下滑 + 噪声爆 |
| `coin` | 得分 | 988Hz → 1319Hz 方波两连 |
| `win` | 胜利 | C-E-G-C 三角波琶音 |
| `oops` | 失败 | 320→110Hz 锯齿 |
| `meow` | 猫叫 | 620→900→480Hz 正弦 |
| `jump` | 跳跃 | 190→660Hz 方波 |

`AudioContext` 懒创建（浏览器自动播放策略），构造失败时**静音降级**——因为 `playSound` 挂在几乎所有按钮的 click 里，这里绝对不能抛。

**背景音乐（BGM）**：五声音阶（宫商角徵羽 = C4 D4 E4 G4 A4）慢速琶音 + 低八度正弦垫底。

- `generateBgmPhrase(seed)` 是**纯函数**（mulberry32 驱动），同 seed 输出完全一致，有单测；真实 `AudioContext` 只做薄封装
- 每句 6–8 个音，音间隔 0.55–1.1 秒，`BGM_MASTER_GAIN = 0.06` 柔和垫底
- 循环时 seed 递增，不重样；提前 0.3 秒排下一句，不留缝也不叠音
- 自动播放策略：上次会话开着 BGM 时，本次要等**第一次 pointerdown** 才起播
- `visibilitychange`：切后台立即淡出停止，回前台自动续上

### 9.6 双人 / 对战相关

- **`red-blue-*` 三款**（拔河/点点/赛跑）：**人机对战**，走 `level99` 框架的 99 关。红方是玩家、蓝方是小电脑，难度由 `levels.ts` 的关卡参数控制
- **`duo-arena`（朵星擂台）**：**同屏双人**。屏幕上下各一个战区（上=星星，下=朵朵），两边用**同一份 `buildRoundSchedule` 时间表**保证绝对公平；3 回合制 + 决胜回合；金币/炸弹/礼物道具（+3 分 / 冰冻对手 `FREEZE_SECONDS` / 双倍星光 `DOUBLE_SECONDS`）
- **`duo-rush`（朵星双人冲刺）**：**同屏双人**无尽跑酷。上下两条赛道用**同种子同赛道**（`createTrackGen`）保证公平；三车道 + 金币 + 石头 + 木栏 + 加速带；两种模式——无尽对战比谁跑得远（`endlessWinner`）、金币赛先抢 `COIN_RACE_TARGET = 30` 枚
- **`xiangqi`（朵朵星星象棋）**：标准中国象棋，同屏双人（朵朵 vs 星星）**或**挑战电脑「棋灵象」。`logic.ts` 实现完整规则（`legalMoves`、`inCheck`、`statusOf`、`applyMove`、`aiMove`），带将军提示、悔棋一档、图文规则页

这三款**没有 99 关战役、也不写持久化存档**，是纯对战局。

---

## 10. 数据流与状态

### 10.1 星星的两套体系（容易混淆，务必分清）

| 体系 | 存在哪 | 谁写 | 展示在哪 |
| --- | --- | --- | --- |
| **平台星星余额**（钱包） | `yiduo-yixing.save.v1` 的 `stars` | `api.onWin` 自动加、`api.addStars` 手动加、`ctx.bonusStars` 加 | 首页顶栏 ⭐ chip、游戏壳顶栏 |
| **每关星级**（1–3 星成绩） | `yiduo-yixing.l99.<id>` 数组 / 各游戏自有 `campaign.v2` | `saveStar()` / 各游戏 `serializeProgress` | 选关地图格子、首页 `🚩 n/99` 徽章 |
| **每游戏最好星级** | `save.v1` 的 `games[id].bestStars` | `save.recordWin()`（由游戏壳在 `onWin` 时调） | 首页卡片的 ⭐☆☆ |

**关键规则**：`level99` 过关时只把「比历史最好成绩多出来的星数」加进钱包（`gain = max(0, got - prev)`），所以回头刷星不会无限刷钱包。

### 10.2 进度是怎么保存和恢复的

```
玩家过关
  ├─ level99 类：ctx.win(stars) → saveStar() 写 yiduo-yixing.l99.<id>
  │                            → api.addStars(gain) 写平台钱包
  │                            （只有 99 关全通时才额外调 api.onWin）
  └─ 自有战役类：serializeProgress() 写各自的 campaign.v2
                → api.onWin(stars) → save.recordWin() + save.addStars()

进入游戏
  ├─ gameShell.start() → save.recordPlay(id) + recordRecent(id)
  └─ 游戏自己 loadStars(id) / parseProgress() 恢复选关地图

首页渲染
  ├─ save.getStars() 读钱包 + save.onChange() 订阅刷新
  ├─ save.getGameProgress(id).bestStars 读最好星级
  ├─ l99ClearedCount(id) 只读 l99 存档算 🚩 徽章
  └─ loadRecentIds() 读最近玩过
```

### 10.3 跨页面一致性

- 星星余额靠 `SaveStore` 的**订阅机制**：`save.onChange(fn)` 注册监听，任何 `persist()` 都会通知全部订阅者。首页和游戏壳都订阅，所以游戏里加星，回首页立刻是新数字。
- **`l99` 存档没有订阅机制**：首页的 🚩 徽章是在 `renderHome` 时一次性读的。从游戏返回首页会重新 `route()` → 重新 `renderHome()`，所以徽章还是最新的。如果以后做「首页不重建」的优化，要注意这一点。
- 「最近玩过」同理，`renderRecent()` 在首页构造时读一次。

### 10.4 坏数据的自愈

每一层读存档都包了 try/catch 并回退到默认值，`scripts/smoke-save-corrupt.mjs` 专门守这一类问题：把六类坏数据（非法 JSON、错误类型、越界数值…）注入到全部已知 key，然后加载首页 + 12 款有独立存档的游戏 + 家长门导出，断言零 `pageerror` / `console.error`。

**新增带独立存档的游戏时，记得把 key 加进那个脚本的 `KEYS` 数组。**

---

## 11. 逐个游戏说明（34 款）

图例：**档** 列 = `L99`（走 level99 框架）/ `L99+Quiz`（框架 + 答题运行器）/ `自有`（自己实现战役 UI）。

### 🏹 闯关 action（7 款）

| 中文名 | 目录 | 玩什么 | 档 | 关键文件 | 特殊机制 |
| --- | --- | --- | --- | --- | --- |
| 花园守卫 | `garden-guard` | 在花园小路旁摆 5 种防守塔，拦住偷花的小虫 | 自有 | `index.ts` 1785 / `logic.ts` 1092 | 塔防；九大主题 × 章末 BOSS；塔升级/出售、减速叠加（`combineSlow`）、溅射（`boomSplash`）、路径点（`buildWaypoints`）、怪物冲刺/治疗/召唤/潜行；朗读 |
| 海底大胃王 | `ocean-munch` | 小鱼吃比自己小的生物长大，躲大鱼挑战海域大王 | 自有 | `index.ts` 2168 / `logic.ts` 577 | 九大海域 + 9 位 BOSS；**生物图鉴**（独立存档 `dex.v1`）；漩涡吸力、电鳗、黑暗视野、护盾 |
| 绿芽保卫战 | `sprout-defense` | 格子花园里种 7 种植物挡虫虫大军，决战虫虫女王 | 自有 | `index.ts` 1596 / `logic.ts` 952 | 塔防（行列制）；九种虫 + 旗帜大波；冰冻、爆炸豆、铲子退款、露水资源 |
| 彩虹跑跑 | `rainbow-run` | 一指跳跃跑酷，跳坑踩平台收集星星 | 自有 | `index.ts` 1576 / `logic.ts` 673 | 九大世界 + **无尽彩虹跑**（独立最远纪录 key）；七种障碍、喷气鞋/磁铁/滑板道具、花星星复活一次（`REVIVE_COST`）；滑动手势 `detectSwipe` |
| 水果切切乐 | `fruit-slice` | 手指划屏切水果，小心炸弹，连切有奖励 | 自有 | `index.ts` 1755 / `logic.ts` 563 | 99 回合九大果园 + **禅宗**（无炸弹限时）+ **街机无尽**三种玩法；侧风/低重力/急坠各果园手感不同；连击窗口、狂热模式、冰冻 |
| 糖果秋千 | `candy-swing` | 划断绳子让糖果荡进小怪物「啾啾」嘴里 | 自有 | `index.ts` 1569 / `physics.ts` 504 / `levels.ts` 1063 | **自写绳物理**（质点 + 链接 + Verlet 式 `integrate`/`solveLinks`）；9 种机关：传送门、气球、风口、飞蛾…；存档用旧前缀 `yiduo.` |
| 弹弹小鸟 | `sling-birds` | 拉弹弓弹小鸟撞倒积木塔，弹走绿绿豆 | 自有 | `index.ts` 2248 / `physics.ts` 253 / `levels.ts` 938 | **自写弹弓 + 重力 + 方块破坏物理**（不用任何物理引擎）；4 种原创小鸟技能：糯糯直球 / 云云分裂 / 墩墩下砸 / 闪闪加速钻；瞄准轨迹与真实飞行同一套 `simulateTrajectory` |

### 🍭 休闲 casual（13 款）

| 中文名 | 目录 | 玩什么 | 档 | 关键文件 | 特殊机制 |
| --- | --- | --- | --- | --- | --- |
| 星星消消乐 | `match-stars` | 点两个以上相连同色星星一起消除 | L99 | `index.ts` 376 / `levels.ts` 141 | 7 个章节（唯一一个 7 章的）；冰块、藤蔓、彩虹星 |
| 记忆翻翻乐 | `memory-cards` | 翻卡记位置，相同图案两两配对 | L99 | `index.ts` 238 | 偷看、章鱼换牌、三连卡、限时赛 |
| 接住小水果 | `fruit-catch` | 左右移动篮子接水果，躲乌鸦炸弹 | L99 | `index.ts` 267 | 六种天气；大风吹水果、夜晚追萤火 |
| 地鼠嘭嘭 | `mole-pop` | 地鼠冒头就点，金地鼠加分，别敲小兔子 | L99 | `index.ts` 213 / `levels.ts` 89 | 四种地鼠（普通/瞌睡/金/兔）；拍错兔子 3 次即失败 |
| 拼图乐园 | `puzzle-tiles` | 把打乱的拼图块拖回原位 | L99 | `index.ts` 239 | 3×3 → 4×4；后期有「看一眼就藏起来」的记忆拼图 |
| 泡泡噗噗 | `bubble-pop` | 快速点破彩色泡泡 | L99 | `index.ts` 361 | 彩虹泡、闪电泡、冰冻泡 |
| 贪吃毛毛虫 | `snake-snack` | 控制毛毛虫吃果子变长，别撞墙咬自己 | L99 | `index.ts` 239 / `levels.ts` 148 | 树篱/石柱/回字迷宫（`mulberry32` 生成）；会跑的星星果 |
| 碰碰砖块 | `brick-break` | 移动挡板反弹小球打碎砖墙 | L99 | `index.ts` 277 / `levels.ts` 123 | 六大砖阵：金字塔、钻石阵、钢铁堡垒 |
| 连连看 | `lianliankan` | 找相同图案，两个拐弯内连线消掉 | L99 | `index.ts` 388 | 玩具会下落、鱼儿会游动（消除后重排） |
| 萌猫小屋 | `kitty-care` | 给小猫「团团」喂饭、洗澡、逗玩、哄睡 | L99 | `index.ts` 429 | 养成；六大季节；`meow` 音效的主要使用者 |
| 气球砰砰 | `balloon-pop` | 按颜色指令、按数字顺序戳气球 | L99 | `index.ts` 307 | 乌云捣乱、彩虹清屏 |
| 五子棋 | `gomoku` | 和小电脑轮流落子，五子连线获胜 | 自有 | `index.ts` 900 / `ai.ts` 376 / `puzzles.ts` 552 | **三档 AI + 双人 + 可选禁手**；15×15 与 9×9；**99 道残局棋谜**（`puzzles.test.ts` 断言逐题可解）；提示功能 `hintMove`；存档用旧前缀 `yiduo.` |
| 泡泡瞄准手 | `bubble-aim` | 拖瞄准线发射泡泡，三个同色相碰爆掉 | 自有 | `index.ts` 1038 / `logic.ts` 468 / `levels.ts` 665 | 泡泡龙；**瞄准虚线和真实飞行用同一个 `simulateShot`，保证指哪打哪**；石泡/彩虹泡/黑洞/云挡板/下落新行五种机关；存档用旧前缀 `yiduo.` |

### 🏁 对战 party（6 款）

| 中文名 | 目录 | 玩什么 | 档 | 关键文件 | 特殊机制 |
| --- | --- | --- | --- | --- | --- |
| 红蓝拔河 | `red-blue-tug` | 快速点击加力，把绳结拔过中线 | L99 | `index.ts` 244 | 人机；抢加油星、红绿灯（抢跑判罚）、左右手打节奏 |
| 红蓝点点 | `red-blue-tap` | 蓝点出现抢先点，红点陷阱别碰 | L99 | `index.ts` 202 | 人机；双子点点 |
| 红蓝赛跑 | `red-blue-race` | 连点向前冲，遇水坑跳、栏架跨 | L99 | `index.ts` 253 | 人机；六大赛道，上坡拼耐力 |
| 朵星擂台 | `duo-arena` | 上下半场同时开抢的三回合点点大战 | 自有 | `index.ts` 463 / `logic.ts` 139 | **同屏双人**；两边同一份时间表保证公平；金币/炸弹/礼物；冰冻对手、双倍星光；先赢两回合 |
| 朵星双人冲刺 | `duo-rush` | 朵朵星星同屏开跑，三车道躲障碍 | 自有 | `index.ts` 574 / `logic.ts` 261 | **同屏双人**；同种子同赛道；无尽对战 + 金币赛（先抢 30 枚）；加速带、跳跃、心数 |
| 朵朵星星象棋 | `xiangqi` | 标准中国象棋，双人或挑战「棋灵象」 | 自有 | `index.ts` 731 / `logic.ts` 346 | **同屏双人 + 电脑**；完整规则含将帅对脸；将军提示、悔棋一档、图文规则页 |

### 📚 学习 edu（6 款）

| 中文名 | 目录 | 玩什么 | 档 | 关键文件 | 特殊机制 |
| --- | --- | --- | --- | --- | --- |
| 算数小农场 | `math-farm` | 数一数、加减法、凑十破十，答对喂动物 | L99+Quiz | `index.ts` 24 / `levels.ts` 318 / `logic.ts` 123 | 六大农场；`logic.ts` 负责出题算法，`levels.ts` 组题 |
| 识字小花园 | `word-garden` | 看图认字、拼音选字、组词 | L99+Quiz | `index.ts` 24 / `levels.ts` 248 / `logic.ts` 157 | 六座花园；答对开一朵花 |
| 拼音小火车 | `pinyin-train` | 认单韵母、声母、声调和音节 | L99+Quiz | `index.ts` 24 / `levels.ts` 197 / `logic.ts` 203 | 六大车站；双胞胎字母（b/d、p/q）辨析 |
| 形状王国 | `shape-kingdom` | 认形状、辨颜色、比大小、数边数 | L99+Quiz | `index.ts` 23 / `levels.ts` 248 / `logic.ts` 161 | 六大王国区域；图形大搜数 |
| 找不同 | `find-diff` | 对比上下两幅图找出不同点 | L99（自定义关卡） | `index.ts` 220 / `scene.ts` 260 / `levels.ts` 98 | **不走 quiz99**；`scene.ts` 是纯函数 SVG 场景绘制（左右两版 markup + 差异热区）；后期双胞胎图案和限时挑战；带朗读 |
| 时钟小屋 | `clock-house` | 认整点半点、自己拨时针分针 | L99+Quiz | `index.ts` 23 / `levels.ts` 178 / `logic.ts` 67 | 六层小屋；1 刻 3 刻、拨针找钟面、时间小推理 |

### 🎨 动手 create（2 款）

| 中文名 | 目录 | 玩什么 | 档 | 关键文件 | 特殊机制 |
| --- | --- | --- | --- | --- | --- |
| 涂色小屋 | `color-fun` | 按指令涂色、调色锅调新颜色 | L99 | `index.ts` 345 / `levels.ts` 233 | 六大村镇；指令涂色、调色（混色）、数字涂色、记忆涂色 |
| 音乐星星 | `music-stars` | 跟着亮起的星星弹旋律 | L99 | `index.ts` 303 / `logic.ts` 38 | 六大音乐会；`makeSequence` 生成相邻不重复、可限跨度的旋律；终曲《一闪一闪亮晶晶》(`TWINKLE_FINALE`)；回声森林凭记忆弹 |

---

## 12. 样式与资源

### `src/styles.css`（约 1130 行）

这是**平台壳层专用**的主题文件，游戏自己的样式各写各的（内联 `<style>` 字符串）。分段：

```
:root 变量 → 键盘焦点 → 背景漂浮装饰 → 通用按钮 → 头像 →
首页（问候区/页签/分区标题/最近玩过/卡片网格/99关徽章/空状态）→
游戏页 → 弹窗（结算/家长门）→ 99 关地图热区补丁 →
动画弱化 → 小屏适配（≤420px）→ 超窄屏（≤380px）→ 游戏 chunk 加载态
```

CSS 变量要点：`--ink: #5b4a55`、`--ink-soft: #6d5b66`（这个值被专门调过以满足 WCAG AA 4.5:1 对比度）、`--pink-deep: #c73a80`、`--radius-lg: 30px`、`--font` 是中文系统字体栈（PingFang SC / HarmonyOS Sans SC / Source Han Sans SC …，**无 CDN 字体**）。

无障碍相关：`:focus-visible` 有粉色 3px 外圈（遥控/键盘可玩）、`prefers-reduced-motion` 弱化动画、`99 关地图热区` 有一段「纯加法、不覆盖框架样式」的补丁把格子撑到 ≥44×44。

### 资源

- `src/assets/avatars/`：4 张朵朵星星 PNG，通过 `ui/avatars.ts` 静态 import（Vite 打包成带 hash 的 URL）
- `public/icons/`：`icon.svg`（源）+ `icon-192/256/512.png` + `icon-maskable-512.png` + `apple-touch-icon.png`；用 `npm run icons`（`scripts/gen-icons.mjs`，依赖 sharp）从 SVG 重生成
- **游戏内所有图形要么是 emoji、要么是 canvas 手绘、要么是内联 SVG**，没有一张游戏素材图

---

## 13. 测试策略

### 现状

- `npm test` = **50 个测试文件 / 818 个用例**，实测全过，耗时约 5 秒
- 环境是 `node`，**没有 DOM**，所以只能测纯函数

### 测什么

| 层 | 文件 | 测什么 |
| --- | --- | --- |
| 引擎 | `engine/loader.test.ts` | 自动发现、id 去重、坏 meta 跳过、分类兜底、排序、`load()` 缺 mount 时 reject |
| 引擎 | `engine/save.test.ts` | sanitize 容错、隐私模式降级、导出/导入/校验和/回滚、两代前缀覆盖、probe key 不进备份 |
| 引擎 | `engine/audio.test.ts` | `generateBgmPhrase` 的确定性与音域约束 |
| 壳层 | `ui/dialogs.test.ts` | 防狂点冷静期、结算朗读文案 |
| 横切 | `games/level99.test.ts` | 章节工具、评星、星级存档（含坏数据）、`furthestPlayable`、probe key 清理 |
| 横切 | `games/quiz99.test.ts` | `shouldHint` 的触发条件 |
| 横切 | `games/speech.test.ts` | `pickChineseVoice` 优先级、`speechText` 剥 emoji |
| 游戏 | `<game>/levels.test.ts` | **几乎每款都有**：恰好 99 关、`totalSize(CHAPTERS) === 99`、章节 ≥6、参数合法且理论可达、六章机关各不相同、章节内难度递增 |
| 游戏 | `<game>/logic.test.ts` / `physics.test.ts` / `ai.test.ts` / `puzzles.test.ts` / `scene.test.ts` | 各自的核心算法 |

`mole-pop/levels.test.ts` 是关卡测试的模板，值得照抄：

```ts
it("恰好 99 关，至少 6 个主题章节", () => {
  expect(LEVELS).toHaveLength(99);
  expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
  expect(totalSize(CHAPTERS)).toBe(99);
});
it("每关参数合法且理论可达", () => { /* 用公式验证目标分在时长内拿得到 */ });
it("六章机关各不相同（并非同一模板）", () => { /* 抽查各章特征参数 */ });
it("章节内目标递增、节奏更快", () => { /* 难度爬坡 */ });
```

### 四个冒烟脚本（`scripts/*.mjs`，Puppeteer）

这些不在 `npm test` 里，需要本机 Chrome，是发版前的人工门禁：

| 脚本 | 覆盖 |
| --- | --- |
| `smoke-games.mjs` | 34 款逐个打开 → l99 类点进第 1 关 → 4×3 网格猴子点击 → 离开重进（验 destroy）→ 家长门解题/面板/导出。首页卡片数 < 30 或任何 `pageerror`/`console.error` 即失败 |
| `smoke-l99-deep.mjs` | 22 款 l99 游戏种档到前 98 关全通，直接点进第 99 关（参数化生成的最深关） |
| `smoke-campaign-deep.mjs` | 9 款自有战役游戏种私有存档到最深关；经典 4 款按 DOM 点进最深关，动作 5 款做 canvas 盲点 |
| `smoke-save-corrupt.mjs` | 六类坏存档注入全部已知 key 后的自愈验证 |

### 为新游戏补测试的清单

1. `levels.test.ts`：99 关、章节和 = 99、参数合法、章节差异、难度递增（照抄 `mole-pop`）
2. `logic.test.ts`：评星边界、状态机转移、生成器确定性（同 seed 同结果）
3. 如果有物理/AI：`physics.test.ts` / `ai.test.ts`，重点测「不可能出现的状态」不会出现
4. 把游戏 id 加进 `scripts/smoke-games.mjs` 的 `GAME_IDS`
5. 如果是 l99 框架游戏，加进 `scripts/smoke-l99-deep.mjs` 的 `L99_IDS`
6. 如果有独立存档 key，加进 `scripts/smoke-save-corrupt.mjs` 的 `KEYS`

---

## 14. 打包与分发

### PWA（最推荐给家长的安装方式）

`vite.config.ts` 里配置：`registerType: "autoUpdate"`，manifest 有 `id: "/"`、`display: "standalone"`、`theme_color: #ffd9ea`、三种尺寸图标含 maskable。构建后预缓存 58 项约 1.3 MB。

`src/main.ts` 的 `setupPWA()` 在有新版本时弹底部小吐司让用户点一下更新；`location.protocol === "file:"` 时**不注册** Service Worker（Electron/Capacitor 场景）。

### Electron 桌面

- `electron/main.cjs`：1100×780 窗口，`contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`，**禁止弹新窗口、禁止导航到外部地址**（儿童应用的安全考量）
- `package.json` 的 `build` 段：appId `com.yiduoyixing.hub`，产物到 `release/`，命名 `yiduo-yixing-<版本>-<os>-<arch>.<ext>`
- 目标：Linux AppImage（默认）、Windows portable、Windows NSIS
- **注意**：`build` 段目前**没有 mac 目标**，dmg 打不出来（需要在 macOS 上加配置）
- 安装包 100–120 MB（内含 Chromium），`release/` 已在 `.gitignore` 里，**绝不能提交**

### Capacitor 安卓

- `capacitor.config.ts`：`webDir: "dist"`、`androidScheme: "https"`、`allowMixedContent: false`
- `android/` 工程已提交（构建产物在 `.gitignore` 里）
- `npm run android:apk` 一条命令：build → `cap sync android` → `gradlew assembleDebug`
- Capacitor CLI 读 `capacitor.config.ts` 需要 Node 22 的 `--experimental-strip-types`，脚本已自动带上

---

## 15. 如何新增一个小游戏（step-by-step）

### 情况 A：普通关卡玩法（推荐，走 level99 框架）

**① 建目录**

```bash
mkdir src/games/my-game
```

**② `src/games/my-game/meta.ts`**（纯数据，不能 import 玩法代码）

```ts
export const meta = {
  id: "my-game",              // 必须与目录名一致
  title: "我的小游戏",
  emoji: "🐱",
  category: "casual" as const,
  color: "#ffd6e7",
  blurb: "99 关六大主题！一句话说清玩什么。",
};
```

**③ `src/games/my-game/levels.ts`**

```ts
import type { Chapter } from "../level99";

export interface MyLevel { /* 本关参数 */ }

export const CHAPTERS: Chapter[] = [
  { name: "草地新手", emoji: "🌱", color: "#E4F3D4", desc: "先熟悉一下！", size: 17 },
  // … 至少 6 章，size 之和必须 === 99
];

function buildLevel(ci: number, t: number): MyLevel { /* ci=章节序号 t=章内序号 */ }

export const LEVELS: MyLevel[] = (() => {
  const out: MyLevel[] = [];
  CHAPTERS.forEach((ch, ci) => { for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t)); });
  return out;
})();
```

**④ `src/games/my-game/index.ts`**

```ts
import { meta } from "./meta";
export { meta };                               // ← 兼容 re-export，别漏

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  // …建 DOM / canvas，挂到 stage…
  // 过关：ctx.win(1|2|3, "夸奖")；失败：ctx.lose("温柔的话")
  // 音效：ctx.sfx("pop")；额外奖励：ctx.bonusStars(1)
  return {
    destroy() {
      destroyed = true;
      timeouts.forEach(clearTimeout);
      // 清掉全部 interval / 事件监听 / rAF / DOM
    },
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    playLevel,
    mapHint: "地图底部的一句话提示",
    grandMessage: "99 关全部通关，你就是小冠军！",
  });
}
```

**⑤ `src/games/my-game/levels.test.ts`**（照抄 `mole-pop/levels.test.ts`）

**⑥ 注册到冒烟脚本**：`scripts/smoke-games.mjs` 的 `GAME_IDS`、`scripts/smoke-l99-deep.mjs` 的 `L99_IDS`

**⑦ 验证**

```bash
npm test && npm run build && npm run dev   # 首页应自动出现新卡片，无需改任何壳代码
```

### 情况 B：学习类答题游戏（最省力）

同上，但 `levels.ts` 导出 `CHAPTERS`、`CHAPTER_THEMES: QuizTheme[]`（每章一套 `{bg, accent}`）和 `buildQuestions(level): QuizQuestion[]`，`index.ts` 只需 20 行（照抄 `clock-house/index.ts`）。出题时注意：

- `ask` 是要被朗读的引导语，写成完整口语句子（「哪个是小猫的猫？」）
- `promptHTML` 可以是大表情、汉字、内联 SVG
- 错误选项要有教学意义（形近字、易混音），不要随机凑

### 情况 C：自有战役 UI（重型游戏）

不用 `level99`，但仍要遵守：

- `meta.ts` + `index.ts` 的 `mount`/`destroy` 契约不变
- 纯逻辑全部抽到 `logic.ts` / `physics.ts` 并写单测（DOM 层没法测）
- 存档 key 用 `yiduo-yixing.<id>.<用途>.v<N>`，读的时候必须容错到默认值
- 把 key 加进 `scripts/smoke-save-corrupt.mjs` 的 `KEYS`

---

## 16. 已知约定、陷阱与扩展点

### 必须遵守的硬约定

1. **`meta.ts` 不能 import 玩法代码**。它被 eager 收集进主包，一旦 import 了 `levels.ts`，那份关卡表就会跟着进主包，拆包白做。
2. **`index.ts` 顶部要 `import { meta } from "./meta"; export { meta };`**。loader 只从 `meta.ts` 取 meta，但这个 re-export 保持了单文件导入的兼容性，全部 34 款都这么写。
3. **`meta.id` 必须与目录名一致**。存档 key（`yiduo-yixing.l99.<id>`）、路由（`#/game/<id>`）、冒烟脚本都依赖它。
4. **存档 key 不能改**。老玩家进度不能丢。三款经典（`gomoku`/`candy-swing`/`bubble-aim`）用的旧前缀 `yiduo.` 就是这个原因保留至今。
5. **`onWin` 会自动加星，不要再手动 `addStars`**，否则双倍加星。
6. **`destroy()` 必须清干净**：定时器、`setInterval`、事件监听、rAF 循环、`ResizeObserver`、朗读（`stopSpeaking()`）。壳层会调 `destroy()` 但不会替你清。惯用法是全程用 `Set<timer>` 收集再统一 clear。
7. **章节 size 之和必须 = 99**，否则 `mountLevelGame` 会 `console.warn`，且最后几关点不到。
8. **不引入任何外部运行时依赖**：无 CDN 字体、无外链音源、无统计 SDK。游戏必须离线可玩。
9. **不引入商业 IP / 商标 / 角色名**，注释里也不行。
10. **不要提交 `dist/`、`release/`、APK 等大二进制。**

### 容易踩的坑

| 坑 | 说明 |
| --- | --- |
| 测试环境没有 DOM | `vitest` 的 `environment: "node"`。写测试时不要 `document.createElement`，逻辑要抽成纯函数才能测 |
| 首页的 🚩 徽章只认 l99 存档 | 自有战役游戏（12 款）不会显示进度徽章。要支持得改 `home.ts` 的 `l99ClearedCount` |
| 狂点误触 | 任何新的结算浮层都要用 `isGuardedClick`（400ms 冷静期），否则孩子连点会直接跳过结算画面 |
| 朗读叠音 | 切题、退出关卡、销毁游戏时都要 `stopSpeaking()` |
| `AudioContext` 可能构造失败 | 某些 WebView 会抛，`ensureCtx()` 已经兜住并静音降级，不要在游戏里自己 `new AudioContext()` |
| 隐私模式 | `localStorage` 读写会抛，`save.ts` 和 `level99.ts` 都做了内存降级；游戏自己读存档也要包 try/catch |
| 异步加载竞态 | 游戏 chunk 是异步下载的，壳层用 `startSeq` 防竞态。游戏内部如果也有异步（比如 `whenSpeechReady`），回调里要检查 `destroyed` 标志 |
| 三款对战游戏重复实现头像 | `duo-arena`/`duo-rush`/`xiangqi` 自己用 `import.meta.glob` 取头像。新代码请用 `../../ui/avatars` |
| `noUncheckedIndexedAccess: false` | 数组下标访问不会被类型系统检查越界，大量关卡代码依赖这一点（`LEVELS[ctx.level]`）。改成 true 会引发大面积类型错误 |

### 扩展点

- **加一个音效**：`engine/types.ts` 的 `SoundName` 联合类型 + `engine/audio.ts` 的 `playSound` switch
- **加一个分类**：`engine/types.ts` 的 `GameCategory` + `CATEGORY_LABELS` + `CATEGORY_ORDER`，再在 `ui/home.ts` 的 `TAB_EMOJI` 里加图标
- **换 99 为其他关数**：`level99.ts` 的 `TOTAL_LEVELS`（但 22 款游戏的测试都硬编码了 99，改动面很大）
- **给自有战役游戏加首页进度徽章**：在 `ui/home.ts` 里扩展 `l99ClearedCount`，或者让这些游戏额外写一份 `yiduo-yixing.l99.<id>` 格式的镜像
- **加 CI**：仓库目前**没有 `.github/`**，这是最大的工程缺口

---

## 17. 已知问题与待办

按优先级排列（判断依据是代码现状 + `docs/upgrade-prompts/00-README.md` 里的历史审查结论）：

| 优先级 | 问题 | 涉及位置 | 建议 |
| --- | --- | --- | --- |
| 高 | **零 CI**：仓库没有 `.github/`，没有测试守门，没有出包流水线 | 仓库根 | 加一条 GitHub Actions：`ubuntu` 跑 `npm test` + `npm run build` + AppImage/win-portable/APK，`macos` 跑 dmg。产物走 artifacts，绝不进 git |
| 高 | **README 过时**：写「共 31 款」，缺 `duo-arena`/`duo-rush`/`xiangqi` 三款；分类表也未更新 | `README.md` | 按 `src/games/*/meta.ts` 重新生成游戏清单表 |
| 中 | **Mac 安装包打不出来**：`package.json` 的 `build` 段没有 `mac` 目标 | `package.json` | 加 `mac` 配置 + macOS runner |
| 中 | **12 款自有战役游戏在首页没有 🚩 进度徽章** | `ui/home.ts` | 见上一节「扩展点」 |
| 中 | **三款对战游戏重复实现了头像加载** | `duo-arena`/`duo-rush`/`xiangqi` 的 `index.ts` | 统一改用 `../../ui/avatars` |
| 中 | **约 3366 个关卡缺系统性人工抽验**：大量关卡由 seed 参数化生成，中后期是否只是数值渐变、有无「坏关」未完全验证 | 各 `levels.ts` | `docs/qa/` 下有三轮走查记录可参考，继续按包抽验 |
| 低 | **UI 壳层零单元测试**（只有 `dialogs.test.ts` 的两个纯函数） | `ui/` | 环境是 node，要测 DOM 得引入 jsdom，权衡后可能不值得——冒烟脚本已覆盖 |
| 低 | **家长门锁定状态不持久**：`lockUntil` 是模块级变量，刷新页面就清零 | `ui/parentGate.ts` | 有意为之（不进存档），如需加固可写 sessionStorage |
| 低 | **`index.html` 的 `user-scalable=no`** 对低视力用户不友好 | `index.html` | 儿童游戏场景下可接受，暂不改 |

---

## 18. 给接手人的建议工作流

### 第一天：跑起来 + 摸清一款游戏

```bash
npm install && npm test && npm run build && npm run dev
```

然后按这个顺序读代码（每个文件都不长）：

1. `src/engine/types.ts`（77 行）—— 全部核心契约都在这
2. `src/engine/loader.ts`（120 行）—— 游戏怎么被发现
3. `src/ui/app.ts`（62 行）→ `src/ui/gameShell.ts`（185 行）—— 平台怎么把 `GameAPI` 交给游戏
4. `src/games/mole-pop/`（index 213 + levels 89 + test 42）—— 一款完整的 l99 游戏全貌
5. `src/games/level99.ts`（603 行）—— 99 关框架
6. `src/games/clock-house/index.ts`（23 行）+ `src/games/quiz99.ts`（229 行）—— 学习类怎么做

### 日常改动的节奏

1. `git fetch origin main` → 从最新 main 开分支（`docs/upgrade-prompts/00-README.md` 里定的纪律是 main 只走一条线）
2. 改动**只碰自己那一块**：改一款游戏就只动那个目录，改壳层就只动 `src/ui`/`src/engine`
3. 每次提交前跑 `npm test && npm run build`，**两个都必须绿**
4. 涉及 UI 行为的改动，额外跑一次 `node scripts/smoke-games.mjs`
5. 提交信息用中文描述做了什么（看历史提交，风格是 `fix(sling-birds): 竖屏画布只占舞台上部约 40%——…`）

### 改动风险速查

| 你要做的事 | 风险等级 | 注意 |
| --- | --- | --- |
| 加一款新游戏 | 低 | 完全隔离，壳层不用动 |
| 改某款游戏的关卡参数 | 低 | 但 `levels.test.ts` 可能会红，同步更新断言 |
| 改 `level99.ts` | **高** | 22 款游戏共用 |
| 改 `quiz99.ts` | 中 | 5 款学习游戏共用 |
| 改 `save.ts` 的存档格式 | **极高** | 老玩家进度会丢。加字段可以（`sanitize` 会兜底），改 key / 改结构不行 |
| 改 `loader.ts` | **高** | 全部游戏的加载路径 |
| 改 `styles.css` | 中 | 只影响壳层，游戏样式是各自内联的 |
| 改 `gameShell.ts` | **高** | 全部游戏的挂载/结算路径，注意别破坏防竞态 |

### 不要做的事

- ❌ 不要退回单个 eager glob（拆包会失效，主包会从 48 kB 涨回 618 kB）
- ❌ 不要改动 `meta`/`mount`/`destroy` 契约与任何存档 key
- ❌ 不要重写游戏的 99 关关卡表（只修明显坏关，最小 diff）
- ❌ 不要引入外部运行时依赖或商业 IP
- ❌ 不要删除或降低现有 818 个测试

---

## 附录 A：本次文档的实施计划

这份计划是在动笔写文档**之前**定下的（任务要求的第二步），照此执行并全部完成。

### A.1 交付物

| 文件 | 定位 | 目标读者与场景 |
| --- | --- | --- |
| `game1.2/HANDOVER.md` | 非常详细版（本文件） | 真正要接手长期开发的工程师，当作常备手册反复查 |
| `game1.2/HANDOVER-SIMPLE.md` | 简易版 | 临时接手/评审/新人第一天，5–10 分钟读完就能跑起来并知道去哪找东西 |

### A.2 覆盖范围划分

**详细版覆盖**：产品定位 → 技术栈 → 目录逐层职责 → 命令 → 启动链路 → UI 页面流 → 游戏插件模型 → 三种实现档次 → 五个横切系统（level99 / quiz99 / speech / save / audio）+ 家长门 + 双人 → 数据流与状态 → 34 款游戏逐个说明 → 样式资源 → 测试策略 → 打包分发 → 新增游戏清单 → 约定与陷阱 → 已知问题 → 建议工作流 → 附录。

**简易版只保留**：一句话定位、怎么跑起来、目录地图、核心架构 10 行、34 款游戏清单表、新增游戏最短步骤、最重要的注意点。**不复制详细版全文**，需要细节时引导回详细版。

### A.3 要梳理的架构切片

1. 入口与路由：`index.html` → `main.ts` → `app.ts` 的 hash 路由 → `home.ts` / `gameShell.ts`
2. 游戏插件模型：双 glob 自动发现 + 按需拆包 + `collectGames` 容错 + `meta`/`mount` 契约
3. 关卡系统：`level99.ts` 的章节/存档/地图/结算四件事
4. 答题系统：`quiz99.ts` 的题目模型、悄悄提示、评星
5. 存档系统：平台钱包 vs 每关星级双轨、两代前缀、导出导入回滚、坏数据自愈
6. 家长门：乘法题 + 锁定 + 面板三功能
7. 双人 / 对战：`duo-*` 同屏双人的公平性设计、`red-blue-*` 人机、`xiangqi`
8. 语音：`speech.ts` 的静默降级契约
9. 音频：7 种合成音效 + 五声音阶 BGM
10. 测试与冒烟：单测层次 + 四个 Puppeteer 脚本

### A.4 信息来源（全部实际读过）

- 根配置：`README.md`、`package.json`、`vite.config.ts`、`tsconfig.json`、`index.html`、`capacitor.config.ts`、`.gitignore`、`LICENSE`
- 引擎：`src/engine/` 全部 8 个文件
- 壳层：`src/ui/` 全部 8 个文件
- 横切：`src/games/level99.ts`、`quiz99.ts`、`speech.ts` 及其测试
- 游戏：全部 34 份 `meta.ts`；完整读 `mole-pop`（index+levels+test）、`clock-house/index.ts`、`red-blue-tug/index.ts`、`music-stars/logic.ts`、`find-diff/scene.ts`；读文件头与导入清单 `garden-guard`、`ocean-munch`、`sprout-defense`、`rainbow-run`、`fruit-slice`、`sling-birds`、`candy-swing`、`bubble-aim`、`gomoku`、`duo-arena`、`duo-rush`、`xiangqi`
- 脚本与壳：`scripts/` 4 个冒烟脚本 + `build-android.sh`、`electron/main.cjs`
- 历史文档：`docs/upgrade-prompts/00-README.md`（8 步升级路线的审查报告）、`docs/qa/` 目录清单
- 实测：`npm install`、`npm test`（50/818 全过）、`npm run build`（含 chunk 体积）、`git log`、全库文件树与行数统计

### A.5 执行顺序

摸清结构（读文件 + 跑测试 + 跑构建）→ 定计划 → 写详细版 → 写简易版 → 自查一致性（游戏数、测试数、chunk 体积、key 清单）→ 提交并推送。

---

## 附录 B：全部存档 key 清单

所有 key 都在 `localStorage`，`resetAll()` / `exportAll()` / `importAll()` 按前缀统一处理。

### 平台级

| key | 内容 |
| --- | --- |
| `yiduo-yixing.save.v1` | 星星余额、音效开关、BGM 开关、每游戏 `{bestStars, plays}` |
| `yiduo-yixing.recent.v1` | 最近玩过的游戏 id 数组（最多 8） |

### 99 关框架（22 款共用格式）

| key | 内容 |
| --- | --- |
| `yiduo-yixing.l99.<gameId>` | 长度 99 的星级数组，每项 0..3 |

对应游戏：`balloon-pop`、`brick-break`、`bubble-pop`、`clock-house`、`color-fun`、`find-diff`、`fruit-catch`、`kitty-care`、`lianliankan`、`match-stars`、`math-farm`、`memory-cards`、`mole-pop`、`music-stars`、`pinyin-train`、`puzzle-tiles`、`red-blue-race`、`red-blue-tap`、`red-blue-tug`、`shape-kingdom`、`snake-snack`、`word-garden`

### 自有战役存档（9 款）

| key | 游戏 | 内容 |
| --- | --- | --- |
| `yiduo-yixing.garden-guard.campaign.v2` | 花园守卫 | 每关星级 |
| `yiduo-yixing.sprout-defense.campaign.v2` | 绿芽保卫战 | 每关星级 |
| `yiduo-yixing.rainbow-run.campaign.v2` | 彩虹跑跑 | 每关星级 |
| `yiduo-yixing.rainbow-run.endless-best.v1` | 彩虹跑跑 | 无尽模式最远纪录 |
| `yiduo-yixing.fruit-slice.campaign.v2` | 水果切切乐 | 每回合星级 |
| `yiduo-yixing.fruit-slice.best.v1` | 水果切切乐 | 禅宗/街机最好成绩 |
| `yiduo-yixing.ocean-munch.campaign.v2` | 海底大胃王 | 每关星级 |
| `yiduo-yixing.ocean-munch.dex.v1` | 海底大胃王 | 生物图鉴收集进度 |
| `yiduo-yixing.sling-birds.v2` | 弹弹小鸟 | 每关星级 |
| `yiduo.gomoku.campaign.v2` | 五子棋 | 99 道棋谜星级 ⚠️ 旧前缀 |
| `yiduo.candy-swing.campaign.v2` | 糖果秋千 | 每关星级 ⚠️ 旧前缀 |
| `yiduo.bubble-aim.campaign.v2` | 泡泡瞄准手 | 每关星级 ⚠️ 旧前缀 |

### 无持久化存档

`duo-arena`、`duo-rush`、`xiangqi` —— 一局一局的对战，不写进度。

### 临时探测 key（写完立刻删，不进备份）

`yiduo-yixing.probe`、`yiduo-yixing.l99.probe`

---

## 附录 C：本次交接的验证记录

在 `main` 分支基线 `f5af789` 上实际执行：

| 命令 | 结果 |
| --- | --- |
| `node -v` | v22.14.0 |
| `npm install --no-audit --no-fund` | 成功（约 5 秒，依赖极少） |
| `npm test` | ✅ **50 个测试文件 / 818 个用例全过**，耗时 4.50s |
| `npm run build` | ✅ `tsc --noEmit` 无错 + Vite 构建成功；PWA 预缓存 58 项 / 1343.94 KiB |

构建产物 chunk 体积（节选，验证按需拆包确实生效）：

| chunk | 原始 | gzip |
| --- | --- | --- |
| `index`（主包，含壳层 + 34 份 meta） | 48.24 kB | 17.51 kB |
| `level99`（22 款共用） | 11.96 kB | 4.63 kB |
| `sling-birds`（最大的游戏） | 59.89 kB | 19.01 kB |
| `garden-guard` | 55.02 kB | 18.71 kB |
| `ocean-munch` | 54.06 kB | 17.59 kB |
| `mole-pop` 一类的小游戏 | 数 kB 级 | — |

未执行（需要本机 Chrome，当前环境不具备）：4 个 Puppeteer 冒烟脚本。历史上这四套冒烟在 `f5af789` 的三方合并态下是全绿的（见 `docs/qa/trio-r3-report.md`）。

---

*文档基于 `main` 分支 `f5af789` 的代码实态编写。代码变了以代码为准，同时请回来更新这份文档。*
