# 三人组第 21 轮 · 测试修复员 B（P1/P2 · N-119…N-124 错开 A）

> 基线 `origin/game-1.3` @ `206d0522`。工位分支 `cursor/trio-r21-tester-b-1cd5`（`ee4ebe70`）。
> 角色：测试修复 B。Playbook：PR #87 `trio-r21-playbook.md`（主干当时尚未合入，从该 PR 读单）。
> 三视口：390×844 / 915×412 / 1024×768。工装 `/tmp/` + puppeteer-core，不进库。Chrome `/usr/local/bin/google-chrome`。

## 错开与红线

| 号 | 本工位 | 原因 |
| --- | --- | --- |
| **N-119** | 未改 | 地图观感在 `level99.ts`，A 独占 |
| **N-120** | 未改 | `.l99-view` 触摸滚动，A 独占 |
| **N-121** | 已修 | fruit-catch / balloon-pop / duo-rush |
| **N-122** | 已修 | duo-rush 390 CTA |
| **N-123** | 未改 | `src/ui/home.ts`，A 独占 |
| **N-124** | 抽验 B 款 | merge-2048、shoot-range（word-garden / sudoku-petal 留给 A） |
| **N-105** | **零 hunk** | 禁止第四版；主干 `.cc-info`/`.mj-goal` 已 16px，未再改 combo-clash / mahjong-bloom |
| r18 单款 | 未回退 | C-8 `SKY_H=420` + `.blp-sky` 钳高、N-87 `.dr-menu-cta` 顶钉、N-40 `.dr-btns` sticky、N-62 `.mg-pad` 500 档、N-78 画布 `min(140px,36dvh)` 原文保留 |

未动：`src/styles.css`、`src/ui/**`、`src/games/level99.ts`、存档 key / meta.id / 题库 / seed / 胜负。

## 水位

- 进场主干 `206d0522`
- `npx vitest run` @ `ee4ebe70`：**1206 files 全绿 / 19512 tests（19510 绿 + 2 skip）**
- `npm run build`：tsc + vite 绿
- 未 drop 任何 hunk（本 PR 无 N-105）

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 | 三视口数字（修后） |
| --- | --- | --- | --- | --- |
| **N-121** | fruit-catch | `.frc-open` 无 min-height，笔记 37px | `.frc-open`/`.frc-back` `min-height:44` | 390/915/1024 双人抢果、无尽水果雨皆 **t96–140 / t66–110 / t96–140，h44 IN** |
| **N-121** | balloon-pop | kit `touchUpliftCss` 只到 40 | 保留 kit 调用，叠 `.blp-open,.blp-back{min-height:44px}`；**不改 SKY_H** | 无尽气球节 390 **96–140**、915 **66–110**、1024 **96–140** h44 IN |
| **N-121** | duo-rush | 开跑/怎么玩/关规则无统一 44 | `.dr-start` `.dr-softbtn` `.dr-rules-close` 补 44 | 三视口开跑/怎么玩 h≥44 IN |
| **N-122** | duo-rush 390 | 500 档不命中竖屏，菜单长、CTA 易落折下 | `@media (max-width:430px) and (min-height:700px)` 钉 `.dr-menu-cta` sticky 底。N-87 顶钉不回退 | **390 开跑 768–822 IN**；怎么玩 680–724；收藏册 724–768。915 仍走 N-87 **开跑 90–134 IN** |
| **N-124** | merge-2048 | 768 不命中 500 档 | `@media (max-height:820px) and (pointer:coarse)` 四向钉底 + 键 44；**500 档原文不动** | 关内四向 390 **704–750**、915 **290–334**、1024 **632–676** 全 IN h46 |
| **N-124** | shoot-range | 预览钮 36；1024 开火行 crop | 预览/暂停基础 44；820 粗指针钉 `.shr-pads`；501–820 档画布 `min(200px,36dvh)` 不覆盖 500 的 140 钳 | 390 预览 **324–368 h44**；1024 六键 **594–740 全 IN**（修前末行 crop80）。915 六键 **230–376 IN**，画布仍 140 档 **222–318** |

## 书面降级 / 未做

- **N-119 / N-120 / N-123**：A 文件，本 PR 零改，避免撞车。
- P1 的 N-102/103/104/106 不在「N-119…N-124」本拍范围，未动 bumper-cars / ice-fire-forest / monster-crisis / landlord-cards。
- N-124 其余 31 款中间档未铺，只抽验 playbook 点名的 merge-2048、shoot-range。
- 1024 打靶画布实测仍约 320px 高（501 档在包内），键排靠 sticky 进屏；未再加压以免打 500 档。

## 测试（只增）

- `src/games/fruit-catch/modeTouch.r21.test.ts`
- `src/games/balloon-pop/modeTouch.r21.test.ts`
- `src/games/duo-rush/modeTouch.r21.test.ts`
- `src/games/merge-2048/tabletCoarse.r21.test.ts`
- `src/games/shoot-range/tabletCoarse.r21.test.ts`

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负；测试只增不减；禁 force；N-105 不另出第四版。
