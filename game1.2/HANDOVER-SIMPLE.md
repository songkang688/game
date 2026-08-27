# 一朵一星 · 项目交接文档（简易版）

> 5–10 分钟读完，够你把项目跑起来并知道每样东西在哪。
> 需要细节请看同目录的 [`HANDOVER.md`](./HANDOVER.md)（详细版）。

---

## 一句话

**「一朵一星」是一套给一年级小朋友（6–7 岁）的原创小游戏合集：34 款游戏、每款 99 关、全中文、无广告、不联网、进度只存本机，一套代码同时出网页 / PWA / 桌面安装包 / 安卓 APK。**

技术上是 **TypeScript + Vite + 原生 DOM，没有任何前端框架，Web 端零第三方运行时依赖**（物理、AI、音效全部手写）。

---

## 怎么跑起来

需要 Node ≥ 22。

```bash
npm install     # 装依赖（很快，依赖极少）
npm run dev     # 开发服务器
npm test        # 单元测试 —— 当前 50 文件 / 818 用例
npm run build   # tsc --noEmit + vite build（提交前必须和 npm test 一起绿）
npm run preview # 预览 dist/
```

出包：`npm run dist`（Linux AppImage）/ `npm run dist:win`（Windows 便携）/ `npm run android:apk`（安卓 APK）。

冒烟（需本机 Chrome，非必跑）：`npm i --no-save puppeteer-core` 后跑 `scripts/` 下的 4 个 `smoke-*.mjs`。

---

## 目录地图

```
index.html            入口页，挂载点 <div id="app">
vite.config.ts        Vite + PWA manifest + vitest 配置（三合一）
package.json          脚本 + electron-builder 配置

src/
├── main.ts           启动：注册 PWA + createApp
├── styles.css        壳层粉彩主题（游戏样式各自内联，不在这）
├── assets/avatars/   朵朵与星星的 4 张 PNG
├── engine/           平台引擎
│   ├── types.ts      ★ 全部核心契约（GameMeta / GameAPI / 分类）
│   ├── loader.ts     ★ 游戏自动发现 + 按需拆包
│   ├── save.ts       平台存档 + 导出/导入/清空
│   ├── audio.ts      7 种合成音效 + 五声音阶 BGM
│   └── loop.ts       可选的 rAF 循环 / DPR 画布工具
├── ui/               平台壳层
│   ├── app.ts        hash 路由（首页 ↔ #/game/<id>）
│   ├── home.ts       首页（卡片、页签、最近玩过、星星余额）
│   ├── gameShell.ts  ★ 游戏壳：构造 GameAPI + 结算 + 清理
│   ├── dialogs.ts    弹窗 + 结算 + 400ms 防狂点冷静期
│   ├── parentGate.ts 家长门（乘法题）+ 家长面板
│   ├── avatars.ts    朵朵星星头像的唯一出口
│   └── recent.ts     最近玩过列表
└── games/
    ├── level99.ts    ★ 99 关通用框架（22 款共用）
    ├── quiz99.ts     ★ 学习类答题关运行器（5 款共用）
    ├── speech.ts     朗读小助手（无语音包时静默降级）
    └── <34 个游戏>/  meta.ts + index.ts + levels/logic/physics/ai/puzzles/scene + *.test.ts

scripts/    打包脚本 + 4 个 Puppeteer 冒烟脚本
electron/   桌面壳    android/   Capacitor 工程    public/icons/   应用图标
docs/       历史 QA 报告与升级路线提示词
```

---

## 核心架构（10 行）

1. `index.html` → `main.ts` → `ui/app.ts`，只有两条 hash 路由：首页 和 `#/game/<id>`。
2. `engine/loader.ts` 用**双 glob** 发现游戏：`meta.ts` eager 进主包（首页立刻能渲染卡片），`index.ts` 懒加载各成独立 chunk（进游戏才下载）。主包因此只有 48 kB。
3. **把游戏目录合并进仓库，首页就自动出现，不用改任何壳层代码。**
4. 每个游戏必须导出 `meta`（纯数据）和 `mount(api) => { destroy }`。
5. `ui/gameShell.ts` 构造 `GameAPI` 交给游戏：`root` / `play` / `addStars` / `getStars` / `onWin` / `onLose`。
6. **`onWin(1|2|3)` 会自动加星并记录最好成绩，不要再手动 `addStars`。**
7. 22 款游戏走 `games/level99.ts`：只写 `playLevel(stage, ctx)`，选关地图 / 章节页签 / 三星存档 / 结算全由框架给。
8. 其中 5 款学习游戏再叠一层 `games/quiz99.ts`，只需要提供 `buildQuestions(level)`，`index.ts` 只有 23 行。
9. 另外 12 款（动作 5 + 经典 4 + 双人 3）自己实现战役 UI 和独立存档，纯逻辑抽在 `logic.ts`/`physics.ts` 里做单测。
10. 存档全在 `localStorage`：平台钱包 `yiduo-yixing.save.v1`，每关星级 `yiduo-yixing.l99.<id>`，自有战役各自 `campaign.v2`；隐私模式自动降级内存，坏数据静默回退新档。

---

## 游戏清单（34 款）

图例：**L99** = 走 `level99` 框架 / **L99+Quiz** = 框架 + 答题运行器 / **自有** = 自己实现战役 UI。

### 🏹 闯关（7）

| 中文名 | 目录 | 玩什么 | 档 |
| --- | --- | --- | --- |
| 花园守卫 | `garden-guard` | 摆 5 种防守塔拦住偷花的小虫（塔防，九主题 + BOSS） | 自有 |
| 海底大胃王 | `ocean-munch` | 小鱼吃小的长大躲大的，挑战海域大王（带生物图鉴） | 自有 |
| 绿芽保卫战 | `sprout-defense` | 格子花园种 7 种植物挡虫虫大军，决战虫虫女王 | 自有 |
| 彩虹跑跑 | `rainbow-run` | 一指跳跃跑酷，九世界 + 无尽模式 | 自有 |
| 水果切切乐 | `fruit-slice` | 划屏切水果躲炸弹，99 回合 + 禅宗 + 街机 | 自有 |
| 糖果秋千 | `candy-swing` | 划断绳子把糖果送进啾啾嘴里（自写绳物理） | 自有 |
| 弹弹小鸟 | `sling-birds` | 拉弹弓撞倒积木塔（自写弹弓 + 破坏物理，4 种鸟技能） | 自有 |

### 🍭 休闲（13）

| 中文名 | 目录 | 玩什么 | 档 |
| --- | --- | --- | --- |
| 星星消消乐 | `match-stars` | 点相连同色星星消除（唯一 7 章节的游戏） | L99 |
| 记忆翻翻乐 | `memory-cards` | 翻卡配对，有偷看/换牌/三连卡 | L99 |
| 接住小水果 | `fruit-catch` | 移动篮子接水果躲炸弹，六种天气 | L99 |
| 地鼠嘭嘭 | `mole-pop` | 打地鼠，金地鼠加分、小兔子不能敲 | L99 |
| 拼图乐园 | `puzzle-tiles` | 拖回拼图块，3×3 到 4×4，后期记忆拼图 | L99 |
| 泡泡噗噗 | `bubble-pop` | 点破彩色泡泡，有彩虹/闪电/冰冻泡 | L99 |
| 贪吃毛毛虫 | `snake-snack` | 吃果子变长，六种迷宫布局 | L99 |
| 碰碰砖块 | `brick-break` | 挡板反弹小球打碎砖墙，六大砖阵 | L99 |
| 连连看 | `lianliankan` | 两拐弯内连线消除，会下落/游动 | L99 |
| 萌猫小屋 | `kitty-care` | 照顾小猫团团（喂饭洗澡逗玩哄睡） | L99 |
| 气球砰砰 | `balloon-pop` | 按颜色/数字顺序戳气球 | L99 |
| 五子棋 | `gomoku` | 三档 AI + 双人 + 禁手，另有 99 道残局棋谜 | 自有 |
| 泡泡瞄准手 | `bubble-aim` | 泡泡龙，瞄准线与飞行同一套模拟「指哪打哪」 | 自有 |

### 🏁 对战（6）

| 中文名 | 目录 | 玩什么 | 档 |
| --- | --- | --- | --- |
| 红蓝拔河 | `red-blue-tug` | 连点加力拔过中线（人机） | L99 |
| 红蓝点点 | `red-blue-tap` | 抢点蓝点躲红点（人机） | L99 |
| 红蓝赛跑 | `red-blue-race` | 连点冲刺，跳水坑跨栏架（人机） | L99 |
| 朵星擂台 | `duo-arena` | **同屏双人**三回合点点大战，同一份时间表保证公平 | 自有 |
| 朵星双人冲刺 | `duo-rush` | **同屏双人**跑酷，同种子同赛道，无尽 + 金币赛 | 自有 |
| 朵朵星星象棋 | `xiangqi` | 标准中国象棋，**同屏双人**或挑战电脑「棋灵象」 | 自有 |

> 三款 `duo-*`/`xiangqi` 是一局一局的对战，**没有 99 关、不写存档**。

### 📚 学习（6）

| 中文名 | 目录 | 玩什么 | 档 |
| --- | --- | --- | --- |
| 算数小农场 | `math-farm` | 数一数、加减法、凑十破十 | L99+Quiz |
| 识字小花园 | `word-garden` | 看图认字、拼音选字、组词 | L99+Quiz |
| 拼音小火车 | `pinyin-train` | 单韵母、声母、声调、音节 | L99+Quiz |
| 形状王国 | `shape-kingdom` | 认形状、辨颜色、比大小、数边数 | L99+Quiz |
| 时钟小屋 | `clock-house` | 认整点半点、拨时针分针 | L99+Quiz |
| 找不同 | `find-diff` | 对比两幅图找不同（`scene.ts` 纯函数画 SVG） | L99 |

### 🎨 动手（2）

| 中文名 | 目录 | 玩什么 | 档 |
| --- | --- | --- | --- |
| 涂色小屋 | `color-fun` | 指令涂色、调色锅混色、数字/记忆涂色 | L99 |
| 音乐星星 | `music-stars` | 跟着亮起的星星弹旋律，终曲《小星星》 | L99 |

---

## 新增一个游戏的最短步骤

以走 `level99` 框架的普通关卡玩法为例（学习类更省力，`index.ts` 只要 23 行）：

```bash
mkdir src/games/my-game
```

**1. `meta.ts`** —— 纯数据，**绝对不能 import 玩法代码**（会破坏拆包）：

```ts
export const meta = {
  id: "my-game",              // 必须与目录名一致
  title: "我的小游戏",
  emoji: "🐱",
  category: "casual" as const, // action|casual|party|edu|create
  color: "#ffd6e7",
  blurb: "一句话介绍",
};
```

**2. `levels.ts`** —— 导出 `CHAPTERS`（≥6 章，**size 之和必须 = 99**）和 `LEVELS`（99 项）。

**3. `index.ts`**：

```ts
import { meta } from "./meta";
export { meta };                    // ← 兼容 re-export，别漏

import { mountLevelGame, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { CHAPTERS, LEVELS } from "./levels";

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  // 挂 DOM/canvas 到 stage；过关 ctx.win(1|2|3, "夸奖")；失败 ctx.lose("温柔的话")
  return { destroy() { /* 清掉全部定时器/监听/rAF/DOM */ } };
}

export function mount(api: GameApi) {
  return mountLevelGame(api, { id: meta.id, chapters: CHAPTERS, playLevel });
}
```

**4. `levels.test.ts`** —— 照抄 `src/games/mole-pop/levels.test.ts`（断言 99 关、`totalSize(CHAPTERS) === 99`、参数合法、章节差异、难度递增）。

**5. 注册到冒烟脚本**：`scripts/smoke-games.mjs` 的 `GAME_IDS`；l99 类再加 `scripts/smoke-l99-deep.mjs` 的 `L99_IDS`；有独立存档 key 的再加 `scripts/smoke-save-corrupt.mjs` 的 `KEYS`。

**6. 验证**：`npm test && npm run build && npm run dev` —— 首页会自动出现新卡片，**不用改任何壳层代码**。

---

## 最重要的注意点

1. **`meta.ts` 不能 import 玩法代码** —— 它进主包，一旦 import 关卡表就跟着进主包，按需拆包白做（主包会从 48 kB 涨回 618 kB）。
2. **`meta.id` 必须与目录名一致** —— 存档 key、路由、冒烟脚本都靠它。
3. **`onWin` 会自动加星，不要再手动 `addStars`**，否则双倍。
4. **`destroy()` 必须清干净** —— 定时器、interval、事件监听、rAF、ResizeObserver、`stopSpeaking()`。惯用法是全程 `Set<timer>` 收集再统一 clear。
5. **存档 key 永远不能改** —— 老玩家进度不能丢。三款经典（`gomoku`/`candy-swing`/`bubble-aim`）用的是历史旧前缀 `yiduo.`，`save.ts` 的导出/导入/清空必须同时覆盖 `yiduo-yixing.` 和 `yiduo.` 两代前缀。新游戏一律用 `yiduo-yixing.`。
6. **测试环境没有 DOM**（vitest `environment: "node"`）—— 逻辑抽成纯函数才测得了；UI 行为靠 `scripts/` 的 Puppeteer 冒烟脚本。
7. **章节 size 之和必须 = 99**，否则最后几关点不到。
8. **结算浮层要用 400ms 防狂点冷静期**（`ui/dialogs.ts` 的 `isGuardedClick`）—— 孩子胜负一出手指还在连点，没冷静期会直接跳过结算画面。
9. **不引入任何外部运行时依赖**（无 CDN 字体、无外链音源、无统计 SDK），**不引入任何商业 IP/商标/角色名**（注释里也不行）。
10. **不要提交 `dist/`、`release/`、APK 等大二进制。**
11. 改动风险：改 `level99.ts`（22 款共用）、`loader.ts`、`gameShell.ts`、`save.ts` 存档格式 = **高风险**；加新游戏 = 低风险（完全隔离）。
12. **提交前 `npm test` 和 `npm run build` 必须都绿。**

---

## 已知缺口（挑最要紧的三条）

- **零 CI**：仓库没有 `.github/`，没有测试守门也没有出包流水线。
- **README 过时**：仍写「共 31 款」，缺 `duo-arena` / `duo-rush` / `xiangqi` 三款。以代码为准。
- **Mac 安装包打不出来**：`package.json` 的 electron-builder `build` 段没有 `mac` 目标。

完整清单见详细版的「已知问题与待办」。

---

*基于 `main` 分支 `f5af789`。实测 `npm test` 50 文件 / 818 用例全过，`npm run build` 成功。*
