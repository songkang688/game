# 一朵一星 1.2 · B 档 · 21 款新游戏接入提示词

> 本目录是 **B 档独占路径**。只写派发给执行者的提示词 Markdown，**不实现游戏**。
> A 档写 `docs/game-1.2/00-*.md`（本目录不碰）；C 档写 `docs/game-1.2/upgrades/`（本目录不碰）。
> 象棋 `xiangqi` **已在仓库**（1.1 对战棋），本阶段 **不新建**，留给 C 档升级；第 8 个必覆盖玩法名额用 `dark-chess`「翻翻暗棋」补上。

---

## 〇、本阶段怎么切

| 项 | 约定 |
| --- | --- |
| 步数 | **7 步**（第 10–16 步），**不要硬套 33** |
| 每步 | **3 个子代理 A/B/C**，通常各做 **1 款**新游戏 |
| 文件 | `step-10.md` … `step-16.md`，连续编号从 **10** 起 |
| 每步文档 | 含 A/B/C **三段完整可复制派发提示词**（各包在 `~~~~text` 里） |
| 合计 | **21 个全新 id**，与 `origin/game-1.1` / `origin/game-1.2` 现有 `src/games/*/meta.ts` **零撞车** |
| 执行模型 | 提示词正文指定 slug：`claude-opus-5-thinking-high-fast` |
| 分支 | 全部工作推 `game-1.2`，禁止改 main、禁止 force |

### 派发顺序

第 10 步 → 第 16 步，**禁止跳步、禁止乱序**。上一步三人全部推完、`origin/game-1.2` 上 `npm test` 与 `npm run build` 都绿，才派下一步。每步三人文件清单互不相交，可真并行。

---

## 一、调研结论（现有 id 黑名单）

已在 `origin/game-1.2` 与 `origin/game-1.1` 出现的 id（**全部避开**）：

`adventure-king` `alien-seek` `balloon-pop` `bomb-buddies` `box-hamster` `brave-path` `brick-break` `bubble-aim` `bubble-pop` `bumper-cars`（仅 1.1）`candy-swing` `clock-house` `color-fun` `duo-arena` `duo-rush` `duo-vs-star` `fight-king` `find-diff` `fishing-star` `fruit-catch` `fruit-slice` `garden-guard` `gold-hook` `gomoku` `ice-fire-forest` `kitty-care` `landlord-cards` `lianliankan` `match-stars` `math-farm` `memory-cards` `mole-pop` `monster-crisis` `music-stars` `ocean-munch` `pinyin-train` `poop-hero` `prince-princess` `puff-bros` `puzzle-tiles` `rainbow-run` `red-blue-race` `red-blue-tap` `red-blue-tug` `shape-kingdom` `shoot-range` `sky-squad` `sling-birds` `snake-snack` `snow-fight` `sprout-defense` `tank-battle` `word-garden` `xiangqi`

因此：

- **不新建象棋**（`xiangqi` 已在）。README 声明：**留给 C 档升级**（AI 档位、残局 188、长考提示等）。
- **不新建斗地主**（`landlord-cards` 已在）。
- **不新建推箱子**（`box-hamster` 已在）。
- **不复刻** `ocean-munch`（大鱼吃小鱼）当「球球」；不复刻 `snake-snack`（迷宫贪吃虫）当「蛇蛇大乱斗」；不加深 `fight-king` 目录，格斗用 **新 id**。

---

## 二、21 款对照表（A/B/C 分配）

| # | 步 | 档 | id | 中文 title | emoji | category | 对标玩法（研究用，文案禁用商标） | 端 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 10 | A | `orb-arena` | 圆圆大作战 | 🟣 | action | 腾讯 IO 吞噬 / 刺球 / 分身 / 排行榜（不是大鱼吃小鱼） | 双端 |
| 2 | 10 | B | `snake-royale` | 长蛇争霸 | 🐍 | action | 腾讯 IO 蛇蛇大乱斗：加速、击杀吃光、皮肤长度 | 双端 |
| 3 | 10 | C | `block-drop` | 方块叠叠乐 | 🧱 | casual | SRS / 7-bag / hold / ghost / 消行动画 | 双端 |
| 4 | 11 | A | `combo-clash` | 连招对决 | 💫 | party | 格斗：连招、取消、跳投、超必、血条 1v1（比 `fight-king` 更深） | 双端 |
| 5 | 11 | B | `mahjong-bloom` | 花开麻将 | 🀄 | party | 国标简化落地：吃碰杠胡、81 番种表、AI | 双端 |
| 6 | 11 | C | `star-estate` | 朵星地产 | 🏦 | party | 棋盘地产、机会/命运、破产；**原创地图** | 双端 |
| 7 | 12 | A | `hero-cards` | 英杰令 | 🎴 | party | 身份场简化单机：牌堆、距离、技能；**原创武将名** | 双端 |
| 8 | 12 | B | `weiqi-garden` | 围子花园 | ⚫ | party | 围棋 19/13/9 路、打劫、数目/点目；9 路 AI 能玩 | 双端 |
| 9 | 12 | C | `flight-chess` | 飞行棋乐园 | ✈️ | party | 四人、掷骰、安全区、叠子、快捷 | 双端 |
| 10 | 13 | A | `merge-2048` | 星星合成 | 🔢 | casual | 2048（经典益智榜常客） | 双端 |
| 11 | 13 | B | `mine-garden` | 扫雷花园 | 🌼 | casual | 扫雷（Windows / 益智榜常客） | 双端 |
| 12 | 13 | C | `sudoku-petal` | 数独花田 | 9️⃣ | edu | 数独（App Store 益智榜常客） | 双端 |
| 13 | 14 | A | `dot-maze` | 豆豆迷宫 | 🟡 | action | 吃豆人迷宫（街机 / Steam 休闲常客） | 双端 |
| 14 | 14 | B | `fruit-stack` | 果果合成 | 🍉 | casual | 合成大西瓜 / 物理合成（小程序爆款） | 双端 |
| 15 | 14 | C | `pool-stars` | 朵星台球 | 🎱 | casual | 八球台球（Steam / 街机休闲榜） | 双端 |
| 16 | 15 | A | `hue-hand` | 花色接龙 | 🌈 | party | UNO 式色彩手牌（棋牌榜常客） | 双端 |
| 17 | 15 | B | `junqi-camp` | 军旗对决 | 🎖️ | party | 军棋/陆战棋（棋牌榜常客） | 双端 |
| 18 | 15 | C | `chess-garden` | 国际象棋 | ♔ | party | 国际象棋（Steam / 益智棋类榜） | 双端 |
| 19 | 16 | A | `dark-chess` | 翻翻暗棋 | 🀄️ | party | **补象棋名额**：中国象棋暗棋/揭棋（棋牌） | 双端 |
| 20 | 16 | B | `hop-pads` | 跳跳台 | ⭕ | casual | 跳一跳类蓄力跳跃（微信小游戏榜常客） | 手游优先、双端 |
| 21 | 16 | C | `tap-tiles` | 音符下落 | 🎹 | casual | 钢琴块 / 别踩白块类（休闲节奏榜常客） | 手游优先、双端 |

**象棋声明**：`xiangqi` 留给 C 档升级。本阶段用 `dark-chess` 补满 21 个新 id。

### 必覆盖玩法对照（用户点名 10 条）

| 点名玩法 | 本阶段处理 |
| --- | --- |
| 1 球球大作战 | `orb-arena` 圆圆大作战 |
| 2 贪吃蛇大作战 | `snake-royale` 长蛇争霸（≠ `snake-snack`） |
| 3 俄罗斯方块 | `block-drop` 方块叠叠乐 |
| 4 拳皇对战 | `combo-clash` 连招对决（≠ `fight-king`） |
| 5 麻将 | `mahjong-bloom` 花开麻将 |
| 6 大富翁 | `star-estate` 朵星地产 |
| 7 三国杀 | `hero-cards` 英杰令 |
| 8 象棋 | **不新建**，C 档升级 `xiangqi`；名额由 `dark-chess` 补 |
| 9 围棋 | `weiqi-garden` 围子花园 |
| 10 飞行棋 | `flight-chess` 飞行棋乐园 |

其余 11 款来自「经典小游戏排行 / Steam·App Store 休闲 / 棋牌 IO 益智」：2048、扫雷、数独、吃豆迷宫、果果合成、台球、花色接龙、军棋、国际象棋、跳跳台、音符下落。跳过斗地主（已有）、推箱子（已有）。

---

## 三、模块与纪律（所有步骤提示词已内嵌）

- 目录 `src/games/<id>/`：`meta.ts` 纯数据（不许 import 玩法）+ `index.ts` `export { meta } from "./meta"` + `mount(api): { destroy }` 懒加载。
- 闯关走 `src/games/level99.ts`（188 关，`assertTotal(chapters, 188)`）。
- 离线；音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`；禁止外部资源与运行时依赖。
- 键位：朵朵 `WASD`+`F`/`G`，星星 方向键+`L`/`K`，`Esc` 暂停；手机必须有等价触屏。
- `destroy` 必须清 listener / timer / rAF / AudioContext。
- 禁止商标文案（含注释）：「拳皇」「俄罗斯方块」「三国杀」「球球大作战」等官方名一律不准出现。
- 首页 glob 自动收集，**不要改** `src/ui/home.ts`。
- 每款 ≥ 15 用例；只增测试不删测试。
- 窄屏 **360px** 正文可读（游戏内 HUD 字号 ≥ 13px，按钮热区 ≥ 44px）。
- 可参考 GitHub 开源项目**只作结构参考**，不抄商标素材，不引入运行时依赖。

---

## 四、文件清单（本目录）

| 文件 | 内容 |
| --- | --- |
| `README.md` | 本文件：步数、21 款对照、象棋声明 |
| `step-10.md` | A 圆圆 / B 长蛇 / C 方块 |
| `step-11.md` | A 连招 / B 麻将 / C 地产 |
| `step-12.md` | A 英杰令 / B 围棋 / C 飞行棋 |
| `step-13.md` | A 2048 / B 扫雷 / C 数独 |
| `step-14.md` | A 豆豆迷宫 / B 果果合成 / C 台球 |
| `step-15.md` | A 花色接龙 / B 军棋 / C 国际象棋 |
| `step-16.md` | A 暗棋（补象棋名额）/ B 跳跳台 / C 音符下落 |

---

## 五、工作计划（已完成）

1. `rg` / `ls` 核对 `origin/game-1.2` 与 `origin/game-1.1` 的 `src/games/*/meta.ts`，避开全部已有 id。
2. 对照 `docs/upgrade-prompts/11-game-1.1-dispatch-prompts.md` 第 7–11 步的完整度，以及 `docs/plan-1.1-step10-C-shooting.md` 的系统表 / 章节表 / 模式表粒度。
3. 联网核对 IO / 格斗 / 国标麻将 / 地产 / 身份卡牌 / 围棋 / 飞行棋 / SRS 方块等真实规则后再写进提示词。
4. 写出 7 个步骤文档，每步 A/B/C 三段可整段复制的派发提示词，每款写到能直接施工。
5. 对 `game-1.2` 开 draft PR。

## 六、文档自检

| 项 | 结果 |
| --- | --- |
| 步数 | 7 步（step-10 … step-16），每步 A/B/C 各 1 款 |
| 新 id | 21 个，互不重复，与 1.1/1.2 现有 `meta.ts` 零撞车 |
| 象棋 | 不新建；`dark-chess` 补名额；README 声明留给 C 档升级 `xiangqi` |
| 开头套话 | 21 段提示词均含用户指定的 4 行 Task/slug/`game-1.2`/回复要求，逐字一致 |
| 执行纪律 | 每段都写「你就是执行者，禁止再派生」；只推 `game-1.2`；禁止 force |
| 独占路径 | 只写本目录；提示词禁止执行者改 `docs/game-1.2/00-*` 与 `upgrades/` |
| 施工粒度 | 每款含 meta、完整规则、模式表、章节表（188 和）、系统表、360px、AI、GitHub 参考、文件清单、≥15 用例、destroy、验收 checkbox、测试命令 |
| 必覆盖 | IO 双雄、方块 SRS、更深格斗、麻将、地产、英杰令、围棋、飞行棋均有；商标名只作研究对照，执行者禁止写入代码/文案 |
| 未实现游戏 | 本目录只有 Markdown，无 `src/games` 改动 |
