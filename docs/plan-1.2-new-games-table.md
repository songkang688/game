# 1.2 B 档 · 21 款新游戏对照表

> **B 档独占。** 写提示词时 A 的 `docs/plan-1.2-supervisor.md` 尚未定稿（并行），本表自行拍板 21 个 id。A 收口时对照；施工以本表为准，除非 A 明示改名且尚未派发。
> 假设 `origin/game-1.1` @ `8867138` 的 **55** 款已全部做完。本表 21 个 id 与那 55 个 **零撞车**。
> 象棋 `xiangqi` **不新建**，名额换成排行榜棋牌 `dark-chess`「翻翻暗棋」。

## 〇、步号

新游戏接入是 1.2 的 **第 2–8 步**（7 步 × 3 档 = 21 文件）。不要写 step1（A 的平台），不要写 step9 及以后（C 的升级）。

| 1.2 步 | 档 | 文件 | id | 中文 title |
| ---: | --- | --- | --- | --- |
| 2 | A | `docs/plan-1.2-step2-A-orb-arena.md` | `orb-arena` | 圆圆大作战 |
| 2 | B | `docs/plan-1.2-step2-B-snake-royale.md` | `snake-royale` | 长蛇争霸 |
| 2 | C | `docs/plan-1.2-step2-C-block-drop.md` | `block-drop` | 方块叠叠乐 |
| 3 | A | `docs/plan-1.2-step3-A-combo-clash.md` | `combo-clash` | 连招对决 |
| 3 | B | `docs/plan-1.2-step3-B-mahjong-bloom.md` | `mahjong-bloom` | 花开麻将 |
| 3 | C | `docs/plan-1.2-step3-C-star-estate.md` | `star-estate` | 朵星地产 |
| 4 | A | `docs/plan-1.2-step4-A-hero-cards.md` | `hero-cards` | 英杰令 |
| 4 | B | `docs/plan-1.2-step4-B-weiqi-garden.md` | `weiqi-garden` | 围子花园 |
| 4 | C | `docs/plan-1.2-step4-C-flight-chess.md` | `flight-chess` | 飞行棋乐园 |
| 5 | A | `docs/plan-1.2-step5-A-merge-2048.md` | `merge-2048` | 星星合成 |
| 5 | B | `docs/plan-1.2-step5-B-mine-garden.md` | `mine-garden` | 扫雷花园 |
| 5 | C | `docs/plan-1.2-step5-C-sudoku-petal.md` | `sudoku-petal` | 数独花田 |
| 6 | A | `docs/plan-1.2-step6-A-dot-maze.md` | `dot-maze` | 豆豆迷宫 |
| 6 | B | `docs/plan-1.2-step6-B-fruit-stack.md` | `fruit-stack` | 果果合成 |
| 6 | C | `docs/plan-1.2-step6-C-pool-stars.md` | `pool-stars` | 朵星台球 |
| 7 | A | `docs/plan-1.2-step7-A-hue-hand.md` | `hue-hand` | 花色接龙 |
| 7 | B | `docs/plan-1.2-step7-B-junqi-camp.md` | `junqi-camp` | 军旗对决 |
| 7 | C | `docs/plan-1.2-step7-C-chess-garden.md` | `chess-garden` | 国际象棋 |
| 8 | A | `docs/plan-1.2-step8-A-dark-chess.md` | `dark-chess` | 翻翻暗棋 |
| 8 | B | `docs/plan-1.2-step8-B-hop-pads.md` | `hop-pads` | 跳跳台 |
| 8 | C | `docs/plan-1.2-step8-C-tap-tiles.md` | `tap-tiles` | 音符下落 |

一步三个文件，不是一步一个文件。派发顺序：第 2 步 → 第 8 步，上一步三人 `npm test` / `npm run build` 全绿再派下一步。

## 一、必覆盖玩法

| # | 点名 | 本表处理 |
| ---: | --- | --- |
| 1 | 球球大作战（吞噬、刺球、分身、边界、排行；不是大鱼吃小鱼） | `orb-arena` 圆圆大作战 ≠ `ocean-munch` |
| 2 | 贪吃蛇大作战（IO 大乱斗；不是格子蛇） | `snake-royale` 长蛇争霸 ≠ `snake-snack` |
| 3 | 俄罗斯方块（SRS、7-bag、hold、ghost、消行动画） | `block-drop` 方块叠叠乐 |
| 4 | 拳皇对战（连招/取消/跳投/超必；比 fight-king 更深） | `combo-clash` 连招对决，**新 id**，不改 `fight-king` |
| 5 | 麻将 | `mahjong-bloom` 花开麻将 |
| 6 | 大富翁 | `star-estate` 朵星地产 |
| 7 | 三国杀类 | `hero-cards` 英杰令 |
| 8 | 象棋 | **不新建**。`xiangqi` 留给 C 升级。名额 → `dark-chess` 翻翻暗棋（排行榜棋牌） |
| 9 | 围棋 | `weiqi-garden` 围子花园 |
| 10 | 飞行棋 | `flight-chess` 飞行棋乐园 |

## 二、其余 11 款（经典排行，大人也爱玩）

2048、扫雷、数独、吃豆迷宫、果果合成、台球、花色接龙（UNO 结构）、军棋、国际象棋、跳一跳、音游。跳过已有的斗地主 / 推箱子 / 五子棋。

## 三、必须避开的 55 个已有 id（`origin/game-1.1` @ 8867138）

`adventure-king` `alien-seek` `balloon-pop` `bomb-buddies` `bowling-lane` `box-hamster` `brave-path` `brick-break` `bubble-aim` `bubble-pop` `bumper-cars` `candy-swing` `clock-house` `color-fun` `duo-arena` `duo-rush` `duo-vs-star` `fight-king` `find-diff` `fishing-star` `fruit-catch` `fruit-slice` `garden-guard` `gold-hook` `gomoku` `ice-fire-forest` `kitty-care` `landlord-cards` `lianliankan` `match-stars` `math-farm` `memory-cards` `mole-pop` `monster-crisis` `music-stars` `ocean-munch` `pinyin-train` `poop-hero` `prince-princess` `puff-bros` `puzzle-tiles` `rainbow-run` `red-blue-race` `red-blue-tap` `red-blue-tug` `shape-kingdom` `shoot-range` `sky-squad` `sling-birds` `snake-snack` `snow-fight` `sprout-defense` `tank-battle` `word-garden` `xiangqi`

## 四、执行纪律（每份提示词已内嵌）

- 提示词正文指定模型 slug：`claude-opus-5-thinking-high-fast`（不要方括号）。写提示词的人用 inherit。
- 读到的人就是执行者，禁止再套娃派生云端子代理。
- 推 `game-1.2`，不回 main，禁止 force。
- 独占 `src/games/<id>/**`；不要改 `src/ui/home.ts`（首页 glob 自动收集）。
- `meta.ts` 纯数据懒加载；闯关走 `level99.ts` 188 关或写明不做的理由。
- 键位：朵朵 `WASD`+`F`/`G`，星星方向键+`L`/`K`，`Esc` 暂停；手机等价触屏。
- 收藏：只读 `collectionEffects()` / 可选 `openCollection`，不改 `src/engine/collection.ts` 与 `yiduo-yixing.collection.v1`。
- ≥15 用例；`destroy` 干净；360px 可读；无商标（含注释）；失败只鼓励。
- GitHub 开源只作结构参考，不引入运行时依赖。
- 旧目录 `docs/game-1.2/new-games/` **不要删**（上一波一步一文件，作废但仍保留）。
- 不要改 `docs/plan-1.2-supervisor.md`、`docs/plan-1.2-step1-*`、`docs/plan-1.2-step9-*` 及以后、不要改 1.1 文件。
