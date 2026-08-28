# 三人组第 9 轮 · 测试修复员 B（休闲 / 对战 / 动手）

- 分支：`cursor/trio-r9-tester-b-c14c`（worktree 自 `origin/game-1.3` `a74e4868`）
- 管理员：`kangkang`（`yiduo-yixing.root.v1` 永久会话）
- 预览：`npm run build && npx vite preview --port 4175`
- 量裁：puppeteer-core + `/usr/local/bin/google-chrome`，主档 915×412；截图落 `/tmp/r9b-*.png` 不进库
- C-1：源码已有 `.bh-modebar[hidden]` / `.pcp-modebar[hidden]` / `.sp-modebar[hidden]` / `.ak-bar[hidden]` 与 `modebarHidden.guard.test.ts`，本轮不重做

## 水位

- 进场全量 `npm test`：1097 文件 / 19298 用例；其中 3 条与本改无关的超时/胜率抖动（`snake-snack/qaC1`、`bomb-buddies/ai`、`gomoku/tiers`），单文件复跑 90/90 绿
- 本轮新增 2 个测试文件（`fight-king/towerFit.r9.test.ts`、`fruit-catch/stageFit.r9.test.ts`），只增不减
- `npm run build` 绿（tsc + vite）

## 测了哪些 / 坏在哪 / 怎么修

### N-25 fight-king 格斗塔（真修 + 浏览器复测）

- 修前口径（playbook）：915×412 裁 498 / 出屏 335，触屏键全线下；390×844 也中
- 机理：塔独有八宫格 + l99 工具行把对局顶出 `.game-stage`；`.l99-stage{overflow:hidden}` 让 sticky 键排粘不住
- 修法：矮屏把八宫格收成「当前出战 · 换人 ▾」（`towerRosterCompact`）；隐藏塔顶导航；键排 `position:fixed` 贴视口底。`FIGHT_MIN_H=150` / `stageMaxWidthPx` 既有用例零改
- 修后 915×412（开触屏键）：crop 78 / canvasOverflow 60 / fold 0，dockBottom=412
- 修后 390×844：crop 0 / overflow 0 / fold 0
- 护栏：无尽连胜 915×412 crop 0；人机 crop 0；1280×800 塔 crop 6 fold 0

### N-31 fight-king 训练场（真修 + 浏览器复测）

- 修前：915×412 开「📱 触屏按键」后裁 801，8 键+假人 3 钮线下
- 修法：假人三钮与键排进 `.fk-dock`；矮横屏 fixed 置底；`.fk-scroll` 帧数表单独限高自滚
- 修后开触屏键：fold 0，dockBottom=412；crop 367 来自教学表（设计内可滚）；canvasOverflow 35
- 412×915 / 390×844 / 1024×768 原为线下 0，未改布局逻辑

### N-1 fruit-catch（真修 + 浏览器复测）

- 修前：915×412 裁 741 / 出屏 617，⬅️➡️ 线下；1024×768 亦中
- 机理：canvas `width:100%` 按宽长高；第一次 `fitDisplay` 用「wrap 底−画布底」当 below，画布已溢出时 room 变负、放弃钳位
- 修法：只钳 CSS 显示高；fixed 底栏左右键；below 不计 fixed 控件；backing 仍 360×460，`CATCH_Y` / `isCaught` 不动
- 修后 915×412：crop 20 / overflow 0 / fold 0，canvasH 106
- 修后 1024×768 / 1280×800：overflow 0 / fold 0（crop 53 为壳层小余量）

## 未完成项（本轮未动，留给后续）

- N-30 adventure-king 无尽古堡 13 控件
- N-16 走廊引擎三态（闯关/遗迹/速通）
- N-26 duo-vs-star 闯关七键
- N-27 dot-maze 四模式键排
- N-32 brave-path 无尽战斗三钮
- N-34 / N-35 pinyin-train（避让 A 的 quiz 撞车）

## 红线核对

- 未改存档 key / `meta.id`；未动题库、seed、判定
- 未改 `src/styles.css` 结算弹窗、`level99.ts`、`quiz99.ts`、`parentAuth.ts`、`home.ts`、`collection.ts`、word-garden tracing、clock-house levels、find-diff
- kit 只 import
