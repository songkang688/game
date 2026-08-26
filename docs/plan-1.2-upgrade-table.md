# 一朵一星 1.2 · C 档升级对照表（独占）

> 本文件由 **C 档 · 全量升级 + 最后三角色验证** 维护。只声明派发步、施工 id 与提示词路径。
> **以 A/B 施工 id 为准**：新 21 款听 B 档 `docs/game-1.2/new-games/`；1.1 的 55 款听 `origin/game-1.1` @ `8867138` 的真实目录名。A 档 `00-catalog.md` 里的 21 个别名不另开目录。
> 不要改 `docs/game-1.2/00-*`、`step-01.md`、旧 `docs/game-1.2/upgrades/`（作废稿保留，不删）。

## 〇、步数怎么来的（不要硬套 33）

```
要升级 = 1.1 的 55 款 + B 将新增的 21 款 = 76
升级步 = ceil(76 / 3) = 26     → 第 9–34 步
验证步 = 3 轮 × 每轮 A测/B学/C修 → 第 35–37 步
本档不写第 1–8 步（留给 A 平台 + B 新游戏）
```

第 1 步平台 + B 的 21 款接入（7 步）= 8 步，故升级从 **第 9 步** 起连续编号。B 现有文档仍标 step-10–16，收口由主管对齐，本档不改 B 文件。

第 34 步余数：76 % 3 = 1，故 A 升级最后一款 `tap-tiles`；B/C 不做第 77、78 款游戏，改做全库 meta 审计与 view25d 回归（避免突破 21 名额）。

## 一、id 权威

| 种类 | 听谁 |
| --- | --- |
| 1.1 的 55 个目录 | `origin/game-1.1` @ `8867138` 的 `src/games/*/meta.ts`（含 `bumper-cars`、`bowling-lane`） |
| 新 21 个目录 | B 施工 id（下表「B 施工」列） |
| A catalog 21 个别名 | 只作别名，不建第二套目录 |
| 象棋 | 只升级 `xiangqi`，不新建；B 用 `dark-chess` 补名额 |

### 新 21 款对照（施工听 B）

| B 施工 id | 中文 | A catalog 别名 | 旧 C 暂定 | 升级提示词 |
| --- | --- | --- | --- | --- |
| `orb-arena` | 圆圆大作战 | orb-royale | blob-io | step27-B |
| `snake-royale` | 长蛇争霸 | snake-clash | noodle-io | step27-C |
| `block-drop` | 方块叠叠乐 | block-drop | block-drop | step28-A |
| `combo-clash` | 连招对决 | combo-arena | clash-stars | step28-B |
| `mahjong-bloom` | 花开麻将 | mahjong-table | mahjong-stars | step28-C |
| `star-estate` | 朵星地产 | star-mogul | star-estate | step29-A |
| `hero-cards` | 英杰令 | hero-tactics | hero-cards | step29-B |
| `weiqi-garden` | 围子花园 | weiqi-ink | weiqi | step29-C |
| `flight-chess` | 飞行棋乐园 | flight-chess | flight-chess | step30-A |
| `merge-2048` | 星星合成 | merge-2048 | merge-stars | step30-B |
| `mine-garden` | 扫雷花园 | petal-scout | — | step30-C |
| `sudoku-petal` | 数独花田 | sudoku-garden | sudoku-house | step31-A |
| `dot-maze` | 豆豆迷宫 | — | — | step31-B |
| `fruit-stack` | 果果合成 | fruit-orb | merge-fruit | step31-C |
| `pool-stars` | 朵星台球 | table-pool | billiard-stars | step32-A |
| `hue-hand` | 花色接龙 | — | — | step32-B |
| `junqi-camp` | 军旗对决 | — | — | step32-C |
| `chess-garden` | 国际象棋 | — | — | step33-A |
| `dark-chess` | 翻翻暗棋 | （补象棋名额） | — | step33-B |
| `hop-pads` | 跳跳台 | lily-hop | — | step33-C |
| `tap-tiles` | 音符下落 | beat-tap | — | step34-A |

A catalog 另有 `reversi-ink` `klondike-cards` `kart-dash` `glow-survivor` `air-puck` 等 **第一波不做**（B 21 款里没有）。旧 C 补位里的保龄已在 1.1 的 55 款中（`bowling-lane`）。

## 二、升级清单（76 款）

| 步 | 档 | id | 标题 | emoji | 分类 | 来源 | platform | 2.5D | 提示词 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | A | `gomoku` | 五子棋 | ⚫ | party | 1.1 | `desktop` | keep-2d | `docs/plan-1.2-step9-A-gomoku.md` |
| 9 | B | `match-stars` | 星星消消乐 | ⭐ | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step9-B-match-stars.md` |
| 9 | C | `rainbow-run` | 彩虹跑跑 | 🌈 | action | 1.1 | `mobile` | 25d-continue | `docs/plan-1.2-step9-C-rainbow-run.md` |
| 10 | A | `ocean-munch` | 海底大胃王 | 🐟 | action | 1.1 | `mobile` | keep-2d-parallax | `docs/plan-1.2-step10-A-ocean-munch.md` |
| 10 | B | `xiangqi` | 朵朵星星象棋 | 🐘 | party | 1.1 | `desktop` | keep-2d | `docs/plan-1.2-step10-B-xiangqi.md` |
| 10 | C | `fight-king` | 朵星格斗王 | 🥋 | party | 1.1 | `desktop` | keep-2d | `docs/plan-1.2-step10-C-fight-king.md` |
| 11 | A | `garden-guard` | 花园守卫 | 🌼 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step11-A-garden-guard.md` |
| 11 | B | `sprout-defense` | 绿芽保卫战 | 🌱 | action | 1.1 | `both` | 25d-optional | `docs/plan-1.2-step11-B-sprout-defense.md` |
| 11 | C | `fruit-slice` | 水果切切乐 | 🍑 | action | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step11-C-fruit-slice.md` |
| 12 | A | `sling-birds` | 弹弹小鸟 | 🐦 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step12-A-sling-birds.md` |
| 12 | B | `candy-swing` | 糖果秋千 | 🍬 | action | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step12-B-candy-swing.md` |
| 12 | C | `bubble-aim` | 泡泡瞄准手 | 🫧 | casual | 1.1 | `both` | keep-2d | `docs/plan-1.2-step12-C-bubble-aim.md` |
| 13 | A | `duo-rush` | 朵星双人冲刺 | 🏃 | party | 1.1 | `mobile` | 25d-continue | `docs/plan-1.2-step13-A-duo-rush.md` |
| 13 | B | `duo-arena` | 朵星擂台 | 🥊 | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step13-B-duo-arena.md` |
| 13 | C | `duo-vs-star` | 朵朵大战星星 | 💥 | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step13-C-duo-vs-star.md` |
| 14 | A | `landlord-cards` | 朵朵抢地主 | 🃏 | party | 1.1 | `desktop` | keep-2d | `docs/plan-1.2-step14-A-landlord-cards.md` |
| 14 | B | `gold-hook` | 金矿钩钩 | ⛏️ | action | 1.1 | `mobile` | 25d-optional | `docs/plan-1.2-step14-B-gold-hook.md` |
| 14 | C | `bumper-cars` | 碰碰车大乱斗 | 🚗 | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step14-C-bumper-cars.md` |
| 15 | A | `ice-fire-forest` | 冰冰火火森林 | ❄️ | action | 1.1 | `both` | 25d-optional | `docs/plan-1.2-step15-A-ice-fire-forest.md` |
| 15 | B | `puff-bros` | 噗噗兄弟 | 🫧 | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step15-B-puff-bros.md` |
| 15 | C | `prince-princess` | 王子公主大冒险 | 🤴 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step15-C-prince-princess.md` |
| 16 | A | `box-hamster` | 推箱小仓鼠 | 🐹 | casual | 1.1 | `both` | keep-2d | `docs/plan-1.2-step16-A-box-hamster.md` |
| 16 | B | `poop-hero` | 便便超人 | 🦸 | action | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step16-B-poop-hero.md` |
| 16 | C | `brave-path` | 勇者小路 | 🗡️ | action | 1.1 | `both` | 25d-optional | `docs/plan-1.2-step16-C-brave-path.md` |
| 17 | A | `adventure-king` | 冒险小王 | 🗺️ | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step17-A-adventure-king.md` |
| 17 | B | `alien-seek` | 寻找外星朋友 | 🛸 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step17-B-alien-seek.md` |
| 17 | C | `bomb-buddies` | 泡泡炸弹人 | 🫧 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step17-C-bomb-buddies.md` |
| 18 | A | `monster-crisis` | 小怪物危机 | 👾 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step18-A-monster-crisis.md` |
| 18 | B | `tank-battle` | 铁皮坦克大战 | 🚜 | action | 1.1 | `both` | keep-2d | `docs/plan-1.2-step18-B-tank-battle.md` |
| 18 | C | `snow-fight` | 雪球大作战 | ⛄ | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step18-C-snow-fight.md` |
| 19 | A | `shoot-range` | 星星射击场 | 🎯 | casual | 1.1 | `both` | keep-2d | `docs/plan-1.2-step19-A-shoot-range.md` |
| 19 | B | `sky-squad` | 飞机小队 | ✈️ | action | 1.1 | `mobile` | 25d-optional | `docs/plan-1.2-step19-B-sky-squad.md` |
| 19 | C | `fishing-star` | 钓鱼小达人 | 🎣 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step19-C-fishing-star.md` |
| 20 | A | `balloon-pop` | 气球砰砰 | 🎈 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step20-A-balloon-pop.md` |
| 20 | B | `brick-break` | 碰碰砖块 | 🧱 | casual | 1.1 | `both` | keep-2d | `docs/plan-1.2-step20-B-brick-break.md` |
| 20 | C | `bubble-pop` | 泡泡噗噗 | 🫧 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step20-C-bubble-pop.md` |
| 21 | A | `fruit-catch` | 接住小水果 | 🧺 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step21-A-fruit-catch.md` |
| 21 | B | `kitty-care` | 萌猫小屋 | 🐱 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step21-B-kitty-care.md` |
| 21 | C | `lianliankan` | 连连看 | 🔗 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step21-C-lianliankan.md` |
| 22 | A | `memory-cards` | 记忆翻翻乐 | 🃏 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step22-A-memory-cards.md` |
| 22 | B | `mole-pop` | 地鼠嘭嘭 | 🐹 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step22-B-mole-pop.md` |
| 22 | C | `puzzle-tiles` | 拼图乐园 | 🧩 | casual | 1.1 | `both` | keep-2d | `docs/plan-1.2-step22-C-puzzle-tiles.md` |
| 23 | A | `snake-snack` | 贪吃毛毛虫 | 🐛 | casual | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step23-A-snake-snack.md` |
| 23 | B | `clock-house` | 时钟小屋 | 🕒 | edu | 1.1 | `both` | keep-2d | `docs/plan-1.2-step23-B-clock-house.md` |
| 23 | C | `math-farm` | 算数小农场 | 🐮 | edu | 1.1 | `both` | keep-2d | `docs/plan-1.2-step23-C-math-farm.md` |
| 24 | A | `shape-kingdom` | 形状王国 | 🏰 | edu | 1.1 | `both` | keep-2d | `docs/plan-1.2-step24-A-shape-kingdom.md` |
| 24 | B | `find-diff` | 找不同 | 🔍 | edu | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step24-B-find-diff.md` |
| 24 | C | `pinyin-train` | 拼音小火车 | 🚂 | edu | 1.1 | `both` | keep-2d | `docs/plan-1.2-step24-C-pinyin-train.md` |
| 25 | A | `word-garden` | 识字小花园 | 🌸 | edu | 1.1 | `both` | keep-2d | `docs/plan-1.2-step25-A-word-garden.md` |
| 25 | B | `color-fun` | 涂色小屋 | 🎨 | create | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step25-B-color-fun.md` |
| 25 | C | `music-stars` | 音乐星星 | 🌟 | create | 1.1 | `both` | keep-2d | `docs/plan-1.2-step25-C-music-stars.md` |
| 26 | A | `red-blue-race` | 红蓝赛跑 | 🏁 | party | 1.1 | `both` | keep-2d | `docs/plan-1.2-step26-A-red-blue-race.md` |
| 26 | B | `red-blue-tap` | 红蓝点点 | 🎈 | party | 1.1 | `mobile` | keep-2d | `docs/plan-1.2-step26-B-red-blue-tap.md` |
| 26 | C | `red-blue-tug` | 红蓝拔河 | 🪢 | party | 1.1 | `both` | 25d-optional | `docs/plan-1.2-step26-C-red-blue-tug.md` |
| 27 | A | `bowling-lane` | 保龄球小馆 | 🎳 | casual | 1.1 | `both` | pseudo3d-optional | `docs/plan-1.2-step27-A-bowling-lane.md` |
| 27 | B | `orb-arena` | 圆圆大作战 | 🟣 | action | new | `mobile` | keep-2d | `docs/plan-1.2-step27-B-orb-arena.md` |
| 27 | C | `snake-royale` | 长蛇争霸 | 🐍 | action | new | `mobile` | keep-2d | `docs/plan-1.2-step27-C-snake-royale.md` |
| 28 | A | `block-drop` | 方块叠叠乐 | 🧱 | casual | new | `both` | keep-2d | `docs/plan-1.2-step28-A-block-drop.md` |
| 28 | B | `combo-clash` | 连招对决 | 💫 | party | new | `desktop` | keep-2d | `docs/plan-1.2-step28-B-combo-clash.md` |
| 28 | C | `mahjong-bloom` | 花开麻将 | 🀄 | party | new | `desktop` | keep-2d | `docs/plan-1.2-step28-C-mahjong-bloom.md` |
| 29 | A | `star-estate` | 朵星地产 | 🏦 | party | new | `desktop` | keep-2d | `docs/plan-1.2-step29-A-star-estate.md` |
| 29 | B | `hero-cards` | 英杰令 | 🎴 | party | new | `desktop` | keep-2d | `docs/plan-1.2-step29-B-hero-cards.md` |
| 29 | C | `weiqi-garden` | 围子花园 | ⚫ | party | new | `desktop` | keep-2d | `docs/plan-1.2-step29-C-weiqi-garden.md` |
| 30 | A | `flight-chess` | 飞行棋乐园 | ✈️ | party | new | `both` | keep-2d | `docs/plan-1.2-step30-A-flight-chess.md` |
| 30 | B | `merge-2048` | 星星合成 | 🔢 | casual | new | `mobile` | keep-2d | `docs/plan-1.2-step30-B-merge-2048.md` |
| 30 | C | `mine-garden` | 扫雷花园 | 🌼 | casual | new | `both` | keep-2d | `docs/plan-1.2-step30-C-mine-garden.md` |
| 31 | A | `sudoku-petal` | 数独花田 | 9️⃣ | edu | new | `both` | keep-2d | `docs/plan-1.2-step31-A-sudoku-petal.md` |
| 31 | B | `dot-maze` | 豆豆迷宫 | 🟡 | action | new | `both` | keep-2d | `docs/plan-1.2-step31-B-dot-maze.md` |
| 31 | C | `fruit-stack` | 果果合成 | 🍉 | casual | new | `mobile` | keep-2d | `docs/plan-1.2-step31-C-fruit-stack.md` |
| 32 | A | `pool-stars` | 朵星台球 | 🎱 | casual | new | `desktop` | keep-2d | `docs/plan-1.2-step32-A-pool-stars.md` |
| 32 | B | `hue-hand` | 花色接龙 | 🌈 | party | new | `both` | keep-2d | `docs/plan-1.2-step32-B-hue-hand.md` |
| 32 | C | `junqi-camp` | 军旗对决 | 🎖️ | party | new | `desktop` | keep-2d | `docs/plan-1.2-step32-C-junqi-camp.md` |
| 33 | A | `chess-garden` | 国际象棋 | ♔ | party | new | `desktop` | keep-2d | `docs/plan-1.2-step33-A-chess-garden.md` |
| 33 | B | `dark-chess` | 翻翻暗棋 | 🀄️ | party | new | `both` | keep-2d | `docs/plan-1.2-step33-B-dark-chess.md` |
| 33 | C | `hop-pads` | 跳跳台 | ⭕ | casual | new | `mobile` | 25d-optional | `docs/plan-1.2-step33-C-hop-pads.md` |
| 34 | A | `tap-tiles` | 音符下落 | 🎹 | casual | new | `mobile` | keep-2d | `docs/plan-1.2-step34-A-tap-tiles.md` |
| 34 | B | （余数） | meta 审计 | 📋 | — | 工具 | — | — | `docs/plan-1.2-step34-B-meta-audit.md` |
| 34 | C | （余数） | view25d 回归 | 📷 | — | 工具 | — | — | `docs/plan-1.2-step34-C-view25d-audit.md` |

## 三、三角色验证（第 35–37 步）

每步仍是 A 测试员 / B 学习优化员 / C 监督修复员。三轮样本不重复。全部 `game-1.2`。

| 步 | 轮 | A | B | C |
| --- | --- | --- | --- | --- |
| 35 | 1 | `plan-1.2-step35-A-tester.md` | `plan-1.2-step35-B-learner.md` | `plan-1.2-step35-C-fixer.md` |
| 36 | 2 | `plan-1.2-step36-A-tester.md` | `plan-1.2-step36-B-learner.md` | `plan-1.2-step36-C-fixer.md` |
| 37 | 3 | `plan-1.2-step37-A-tester.md` | `plan-1.2-step37-B-learner.md` | `plan-1.2-step37-C-fixer.md` |

报告路径：`docs/qa/1.2-round{1,2,3}-{tester,learner,fixer}.md`（九份互不相交）。

## 四、派发纪律（执行者提示词里已内嵌）

- 开头四行 Task/slug/`game-1.2`/回复要求，slug **无方括号**。
- 读到的人就是执行者，禁止套娃。
- 每步三人并行；上一步三人 `npm test` / `npm run build` 全绿再派下一步。
- 禁止 force、禁止改 main。

## 五、自检

- [x] 不写 step1–8，不改 supervisor/tracker/step-01，不删旧 upgrades/
- [x] 一步三档三文件，仿 `plan-1.1-step10-A-fight-king.md` 的「一档一份」
- [x] 76 款无重复：55 + 21
- [x] 点名五款写细：gomoku / match-stars / rainbow-run / ocean-munch / xiangqi
- [x] 新 21 款写「接入之后的精细化」，id 听 B
- [x] 最后三步三角色 × 三轮
- [x] 声明以 A/B 施工 id 为准
