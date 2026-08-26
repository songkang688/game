# 1.2 新游戏 21 款 · id 对照表（B 档）

> 本表是 1.2 **B 档 · 新游戏**这一轮重做稿的 id 权威表。
> 21 份完整派发提示词是 `docs/plan-1.2-step{2..8}-{A|B|C}-{id}.md`，**一档一份**，格式学 `docs/plan-1.1-step10-A-fight-king.md` / `docs/plan-1.1-step10-C-shooting.md`。
> B 档只写 Markdown 提示词，**不实现任何游戏代码**，也不派生子代理去写代码。

## 一、id 从哪来

**照抄 A 档主管的 id 表。** 本轮 A 档主管文档 `docs/plan-1.2-supervisor.md` 第四节「步号 1→30 连续总表」与第五节 21 款定稿表里的 21 个 id，与上一轮收口稿 `docs/game-1.2/00-id-map.md` 的「施工 id」完全一致，本表逐字照抄，不另开第三套目录、不改名：

- **步号与 A/B/C 位也照抄主管总表**（第 2–8 步，一步三款；第 1 步平台归 A 档，第 9 步以后升级归 C 档，都不在本档范围内）。
- 各 id 的**中文名与玩法细节以本档的 21 份提示词为准**，主管表与旧 catalog 里的中文名（圆圆吞星场 / 长蛇争星场 / 方块落落乐 / 连招擂台 / 星光地产街 / 英雄牌局 / 围棋小院 / 飞行棋小站 / 翻倍方块 / 花园探雷 / 花瓣数独 / 点点迷宫 / 水果叠叠高 / 星星桌球 / 军棋营地 / 国际象棋花园 / 翻翻棋 / 跳跳格子 / 节拍方块 / 调色小手，以及 `orb-royale` `snake-clash` `combo-arena` 这类旧别名）**只作别名**。
- 三处玩法口径以本档为准并写明理由：`hue-hand` 做**色彩手牌接龙**而不是配色练习（配色已有 `color-fun`）；`tap-tiles` 做**下落音符点击**而不是节拍创作（创作已有 `music-stars`）；`fruit-stack` 做**物理合成**而不是叠高塔（合成链与 `merge-2048` 的网格合成互不重复）。

象棋：**不新建**。`xiangqi` 已在仓库（1.1 的对战象棋），留给 C 档升级。第 21 个名额由 `dark-chess`「翻翻暗棋」补上——同一套棋子的另一种大众玩法，与明棋象棋不共用任何逻辑文件。

## 二、21 款 × 7 步（第 2–8 步，一步三款）

| # | 步 | 档 | id | 中文名 | emoji | category | platform | 提示词文件 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | A | `orb-arena` | 圆圆大作战 | 🟣 | action | both | [plan-1.2-step2-A-orb-arena.md](./plan-1.2-step2-A-orb-arena.md) |
| 2 | 2 | B | `snake-royale` | 长蛇争霸 | 🐍 | action | both | [plan-1.2-step2-B-snake-royale.md](./plan-1.2-step2-B-snake-royale.md) |
| 3 | 2 | C | `block-drop` | 方块叠叠乐 | 🧱 | casual | both | [plan-1.2-step2-C-block-drop.md](./plan-1.2-step2-C-block-drop.md) |
| 4 | 3 | A | `combo-clash` | 连招对决 | 💫 | party | both | [plan-1.2-step3-A-combo-clash.md](./plan-1.2-step3-A-combo-clash.md) |
| 5 | 3 | B | `mahjong-bloom` | 花开麻将 | 🀄 | party | both | [plan-1.2-step3-B-mahjong-bloom.md](./plan-1.2-step3-B-mahjong-bloom.md) |
| 6 | 3 | C | `star-estate` | 朵星地产 | 🏦 | party | both | [plan-1.2-step3-C-star-estate.md](./plan-1.2-step3-C-star-estate.md) |
| 7 | 4 | A | `hero-cards` | 英杰令 | 🎴 | party | both | [plan-1.2-step4-A-hero-cards.md](./plan-1.2-step4-A-hero-cards.md) |
| 8 | 4 | B | `weiqi-garden` | 围子花园 | ⚫ | party | both | [plan-1.2-step4-B-weiqi-garden.md](./plan-1.2-step4-B-weiqi-garden.md) |
| 9 | 4 | C | `flight-chess` | 飞行棋乐园 | ✈️ | party | both | [plan-1.2-step4-C-flight-chess.md](./plan-1.2-step4-C-flight-chess.md) |
| 10 | 5 | A | `merge-2048` | 星星合成 | 🔢 | casual | both | [plan-1.2-step5-A-merge-2048.md](./plan-1.2-step5-A-merge-2048.md) |
| 11 | 5 | B | `mine-garden` | 扫雷花园 | 🌼 | casual | both | [plan-1.2-step5-B-mine-garden.md](./plan-1.2-step5-B-mine-garden.md) |
| 12 | 5 | C | `sudoku-petal` | 数独花田 | 9️⃣ | edu | both | [plan-1.2-step5-C-sudoku-petal.md](./plan-1.2-step5-C-sudoku-petal.md) |
| 13 | 6 | A | `dot-maze` | 豆豆迷宫 | 🟡 | action | both | [plan-1.2-step6-A-dot-maze.md](./plan-1.2-step6-A-dot-maze.md) |
| 14 | 6 | B | `fruit-stack` | 果果合成 | 🍉 | casual | both | [plan-1.2-step6-B-fruit-stack.md](./plan-1.2-step6-B-fruit-stack.md) |
| 15 | 6 | C | `pool-stars` | 朵星台球 | 🎱 | casual | both | [plan-1.2-step6-C-pool-stars.md](./plan-1.2-step6-C-pool-stars.md) |
| 16 | 7 | A | `junqi-camp` | 军旗对决 | 🎖️ | party | both | [plan-1.2-step7-A-junqi-camp.md](./plan-1.2-step7-A-junqi-camp.md) |
| 17 | 7 | B | `chess-garden` | 花园国际象棋 | ♔ | party | both | [plan-1.2-step7-B-chess-garden.md](./plan-1.2-step7-B-chess-garden.md) |
| 18 | 7 | C | `dark-chess` | 翻翻暗棋 | 🀄️ | party | both | [plan-1.2-step7-C-dark-chess.md](./plan-1.2-step7-C-dark-chess.md) |
| 19 | 8 | A | `hue-hand` | 花色接龙 | 🌈 | party | both | [plan-1.2-step8-A-hue-hand.md](./plan-1.2-step8-A-hue-hand.md) |
| 20 | 8 | B | `hop-pads` | 跳跳台 | ⭕ | casual | both（手游优先） | [plan-1.2-step8-B-hop-pads.md](./plan-1.2-step8-B-hop-pads.md) |
| 21 | 8 | C | `tap-tiles` | 音符下落 | 🎹 | casual | both（手游优先） | [plan-1.2-step8-C-tap-tiles.md](./plan-1.2-step8-C-tap-tiles.md) |

第 1 步（平台基建）与第 9 步以后（精细化升级 / 冲突 / 验收）**不归 B 档**，本轮不写。

## 三、用户点名必须覆盖的玩法

| 点名 | 本轮落地 | 说明 |
| --- | --- | --- |
| 球球 IO | `orb-arena` | 俯视吞噬竞技场；**不是** `ocean-munch` 那种侧视大鱼吃小鱼 |
| 蛇蛇 IO | `snake-royale` | 开放场竞技；**不是** `snake-snack` 那种迷宫贪吃虫 |
| 方块 | `block-drop` | SRS 旋转 / 7-bag / hold / ghost / T-spin |
| 更深的格斗（新 id） | `combo-clash` | 相对 `fight-king` 有加深清单，**不许改 `fight-king`** |
| 麻将 | `mahjong-bloom` | 国标简化落地，番种表 |
| 大富翁 | `star-estate` | 原创 40 格地图，抵押 / 拍卖 / 破产两条清偿路径 |
| 三国杀类 | `hero-cards` | 身份场简化单机，**全部原创英杰名** |
| 围棋 | `weiqi-garden` | 9 / 13 / 19 路，打劫、超劫、数目与点目 |
| 飞行棋 | `flight-chess` | 四色四机，叠子、跳格、航线、终点折返 |
| 象棋 | **不新建** | `xiangqi` 留给 C 档升级；名额由 `dark-chess` 补 |

其余 11 款取自经典小游戏 / 益智休闲 / 棋牌榜常客：2048、扫雷、数独、吃豆迷宫、水果合成、八球台球、色彩手牌、军棋、国际象棋、蓄力跳台、下落音符。不重复做斗地主（`landlord-cards` 已有）、推箱子（`box-hamster` 已有）、五子棋（`gomoku` 已有）。

## 四、必须避开的 55 个已有 id

`origin/game-1.1` 与 `origin/game-1.2` 现有 `src/games/*/meta.ts`（含 1.1 已完成但尚未 rebase 进 1.2 的 `bumper-cars`，以及 1.1 第 7 步 C 规划的 `bowling-lane`）：

`adventure-king` `alien-seek` `balloon-pop` `bomb-buddies` `bowling-lane` `box-hamster` `brave-path` `brick-break` `bubble-aim` `bubble-pop` `bumper-cars` `candy-swing` `clock-house` `color-fun` `duo-arena` `duo-rush` `duo-vs-star` `fight-king` `find-diff` `fishing-star` `fruit-catch` `fruit-slice` `garden-guard` `gold-hook` `gomoku` `ice-fire-forest` `kitty-care` `landlord-cards` `lianliankan` `match-stars` `math-farm` `memory-cards` `mole-pop` `monster-crisis` `music-stars` `ocean-munch` `pinyin-train` `poop-hero` `prince-princess` `puff-bros` `puzzle-tiles` `rainbow-run` `red-blue-race` `red-blue-tap` `red-blue-tug` `shape-kingdom` `shoot-range` `sky-squad` `sling-birds` `snake-snack` `snow-fight` `sprout-defense` `tank-battle` `word-garden` `xiangqi`

上面 21 个新 id 与这 55 个**零撞车**。21 款做完，库存 55 + 21 = **76 款**。

## 五、每份提示词长什么样

每份文件 = 一段可整段复制的派发提示词。标题行下面的全部内容都是要复制给执行子代理的正文，开头四行逐字固定：

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

正文固定十六节：分支纪律 / 统一约定 / meta / 这不是什么 / 完整规则 / 系统表 / 模式 / 关卡切分（章节和恒等 188）/ 前端与 360px / AI 档位 / 可参考开源 / 独占文件 / 测试 / 分级红线 / 验收 / 回复要求。

## 六、派发纪律

1. 第 2 步 → 第 8 步**串行**，禁止跳步。每步同时派 A/B/C 三个云端子代理，三人目录互斥可真并行。
2. 上一步三人都推上 `origin/game-1.2`，且那上面 `npm test` 与 `npm run build` 全绿，才允许派下一步。基线水位见 `docs/upgrade-prompts/12-game-1.2-baseline.md`（142 文件 / 3918 用例），**只增不减**。
3. 收尾一律 `git fetch origin game-1.2` → `git rebase origin/game-1.2` → 重跑测试构建 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`，禁止改 `main`，禁止用 `gh` 开/改/合 PR。**
4. 每步合入后 `rg` 一遍商标黑名单（含代码注释）。命中就打回，不进下一步。
