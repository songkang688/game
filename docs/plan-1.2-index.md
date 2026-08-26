# 一朵一星 1.2 · 提示词目录（`docs/plan-1.2-*`）

> **本目录是 1.2 唯一有效的提示词入口。** 旧的 `docs/game-1.2/`（一步一份、步号跳到 57、编号有空隙）**作废**，
> 只作历史参考，不再更新、不再按它派发。以后凡是 1.2 的派发脚本，一律看 `docs/plan-1.2-*` 这一组文件。
>
> 命名照抄 1.1 的成功做法（`docs/plan-1.1-step10-A-fight-king.md`）：**一步一档一份文件**。
>
> **总步数定稿 29 步**（1 + 7 + 18 + 3）。主管初稿曾写 30 步（多一个独立冲突步），C 档把冲突/接线拆进三轮验收，**以本目录与已落地的 87 份 `plan-1.2-step*` 为准**。

| 入口 | 文件 | 谁写 |
| --- | --- | --- |
| 主管职责 / 派发规则 / 全量总表 | [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) | A 档（主管） |
| 多窗口登记（防重派） | [`plan-1.2-tracker.md`](./plan-1.2-tracker.md) | A 档（主管），派发时逐行更新 |
| 本目录 | `plan-1.2-index.md` | A 档（主管） |
| 新游戏 21 款 id 对照 | [`plan-1.2-new-games-table.md`](./plan-1.2-new-games-table.md) | B 档 |
| 升级 + 验收目录 | [`plan-1.2-upgrades-index.md`](./plan-1.2-upgrades-index.md) | C 档 |
| 1.1 对照 · 派发脚本 | `docs/upgrade-prompts/11-game-1.1-dispatch-prompts.md`（`origin/game-1.1`） | 1.1 主管 |
| 1.1 对照 · 单档计划样板 | `docs/plan-1.1-step10-A-fight-king.md` / `-B-duo-vs-star.md` / `-C-shooting.md` | 1.1 各档 |

---

## 一、文件命名规范

```
docs/plan-1.2-step<步号>-<档>-<英文短名>.md
```

- 步号：**1 到 29 的连续整数**，不跳号、不留空隙。
- 档：`A` / `B` / `C` 三选一，大写。
- 英文短名：小写连字符，能一眼看出这份文件干什么（例：`root-gate`、`orb-arena`、`tester`）。
- 文件第一行标题固定写法：

```
# 1.2 第 <N> 步 · <A|B|C> 档 —— <中文主题>
```

一步三份文件，**29 步共 87 份**（第 15 步 C 档一份文件装 `bumper-cars` + `bowling-lane` 两款）。每份文件里必须包含**一段可以整段复制粘贴的执行提示词**，
开头四行逐字照 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) 第二节的口令，不许改字、不许加方括号。

---

## 二、三档提示词工程（已写完）

| 档 | 负责步号 | 独占文件 | 状态 |
| --- | --- | --- | --- |
| **A 主管** | 第 1 步 + 总纲 | `plan-1.2-supervisor.md`、`plan-1.2-tracker.md`、`plan-1.2-index.md`、`plan-1.2-step1-A/B/C-*.md` | ✅ |
| **B 新游戏** | **第 2–8 步**（21 款） | `docs/plan-1.2-step2-*.md` … `docs/plan-1.2-step8-*.md` | ✅ |
| **C 升级 + 验收** | **第 9–29 步**（55 款精细化 + 3 轮验收） | `docs/plan-1.2-step9-*.md` … `docs/plan-1.2-step29-*.md` | ✅ |

提示词阶段已结束。下一步是按登记表派云端子代理**改代码**（全部推 `game-1.2`，不改 `main`）。

---

## 三、29 步总表（连续编号，无空隙）

升级顺序以 C 档实际文件为准（55 款不重不漏）。新游戏 id 以 [`plan-1.2-new-games-table.md`](./plan-1.2-new-games-table.md) 为准。

### 阶段一 · 平台基建（第 1 步）

| 步 | A 档 | B 档 | C 档 |
| --- | --- | --- | --- |
| 1 | [root 管理员门 + 直达第 N 关](./plan-1.2-step1-A-root-gate.md) | [手游 / 端游筛选 + 手机文字](./plan-1.2-step1-B-platform-filter.md) | [闯关 / 对战 / 无尽口径 + 2.5D 基建](./plan-1.2-step1-C-modes-view.md) |

### 阶段二 · 21 款新游戏接入（第 2–8 步）

| 步 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- |
| 2 | [`orb-arena` 圆圆大作战](./plan-1.2-step2-A-orb-arena.md) | [`snake-royale` 长蛇争霸](./plan-1.2-step2-B-snake-royale.md) | [`block-drop` 方块叠叠乐](./plan-1.2-step2-C-block-drop.md) |
| 3 | [`combo-clash` 连招对决](./plan-1.2-step3-A-combo-clash.md) | [`mahjong-bloom` 花开麻将](./plan-1.2-step3-B-mahjong-bloom.md) | [`star-estate` 朵星地产](./plan-1.2-step3-C-star-estate.md) |
| 4 | [`hero-cards` 英杰令](./plan-1.2-step4-A-hero-cards.md) | [`weiqi-garden` 围子花园](./plan-1.2-step4-B-weiqi-garden.md) | [`flight-chess` 飞行棋乐园](./plan-1.2-step4-C-flight-chess.md) |
| 5 | [`merge-2048` 星星合成](./plan-1.2-step5-A-merge-2048.md) | [`mine-garden` 扫雷花园](./plan-1.2-step5-B-mine-garden.md) | [`sudoku-petal` 数独花田](./plan-1.2-step5-C-sudoku-petal.md) |
| 6 | [`dot-maze` 豆豆迷宫](./plan-1.2-step6-A-dot-maze.md) | [`fruit-stack` 果果合成](./plan-1.2-step6-B-fruit-stack.md) | [`pool-stars` 朵星台球](./plan-1.2-step6-C-pool-stars.md) |
| 7 | [`junqi-camp` 军旗对决](./plan-1.2-step7-A-junqi-camp.md) | [`chess-garden` 花园国际象棋](./plan-1.2-step7-B-chess-garden.md) | [`dark-chess` 翻翻暗棋](./plan-1.2-step7-C-dark-chess.md) |
| 8 | [`hue-hand` 花色接龙](./plan-1.2-step8-A-hue-hand.md) | [`hop-pads` 跳跳台](./plan-1.2-step8-B-hop-pads.md) | [`tap-tiles` 音符下落](./plan-1.2-step8-C-tap-tiles.md) |

### 阶段三 · 55 款老游戏精细化升级（第 9–26 步）

| 步 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- |
| 9 | [`gomoku`](./plan-1.2-step9-A-gomoku.md) | [`match-stars`](./plan-1.2-step9-B-match-stars.md) | [`rainbow-run`](./plan-1.2-step9-C-rainbow-run.md) |
| 10 | [`ocean-munch`](./plan-1.2-step10-A-ocean-munch.md) | [`xiangqi`](./plan-1.2-step10-B-xiangqi.md)（**只升级**） | [`fight-king`](./plan-1.2-step10-C-fight-king.md) |
| 11 | [`duo-rush`](./plan-1.2-step11-A-duo-rush.md) | [`duo-arena`](./plan-1.2-step11-B-duo-arena.md) | [`duo-vs-star`](./plan-1.2-step11-C-duo-vs-star.md) |
| 12 | [`sling-birds`](./plan-1.2-step12-A-sling-birds.md) | [`candy-swing`](./plan-1.2-step12-B-candy-swing.md) | [`gold-hook`](./plan-1.2-step12-C-gold-hook.md) |
| 13 | [`garden-guard`](./plan-1.2-step13-A-garden-guard.md) | [`sprout-defense`](./plan-1.2-step13-B-sprout-defense.md) | [`monster-crisis`](./plan-1.2-step13-C-monster-crisis.md) |
| 14 | [`shoot-range`](./plan-1.2-step14-A-shoot-range.md) | [`sky-squad`](./plan-1.2-step14-B-sky-squad.md) | [`tank-battle`](./plan-1.2-step14-C-tank-battle.md) |
| 15 | [`bomb-buddies`](./plan-1.2-step15-A-bomb-buddies.md) | [`snow-fight`](./plan-1.2-step15-B-snow-fight.md) | [`bumper-cars` + `bowling-lane`](./plan-1.2-step15-C-bumper-cars.md)（唯一两款位） |
| 16 | [`ice-fire-forest`](./plan-1.2-step16-A-ice-fire-forest.md) | [`puff-bros`](./plan-1.2-step16-B-puff-bros.md) | [`prince-princess`](./plan-1.2-step16-C-prince-princess.md) |
| 17 | [`brave-path`](./plan-1.2-step17-A-brave-path.md) | [`adventure-king`](./plan-1.2-step17-B-adventure-king.md) | [`alien-seek`](./plan-1.2-step17-C-alien-seek.md) |
| 18 | [`brick-break`](./plan-1.2-step18-A-brick-break.md) | [`mole-pop`](./plan-1.2-step18-B-mole-pop.md) | [`box-hamster`](./plan-1.2-step18-C-box-hamster.md) |
| 19 | [`balloon-pop`](./plan-1.2-step19-A-balloon-pop.md) | [`bubble-pop`](./plan-1.2-step19-B-bubble-pop.md) | [`bubble-aim`](./plan-1.2-step19-C-bubble-aim.md) |
| 20 | [`fruit-catch`](./plan-1.2-step20-A-fruit-catch.md) | [`fruit-slice`](./plan-1.2-step20-B-fruit-slice.md) | [`snake-snack`](./plan-1.2-step20-C-snake-snack.md) |
| 21 | [`lianliankan`](./plan-1.2-step21-A-lianliankan.md) | [`puzzle-tiles`](./plan-1.2-step21-B-puzzle-tiles.md) | [`memory-cards`](./plan-1.2-step21-C-memory-cards.md) |
| 22 | [`landlord-cards`](./plan-1.2-step22-A-landlord-cards.md) | [`fishing-star`](./plan-1.2-step22-B-fishing-star.md) | [`poop-hero`](./plan-1.2-step22-C-poop-hero.md) |
| 23 | [`red-blue-race`](./plan-1.2-step23-A-red-blue-race.md) | [`red-blue-tap`](./plan-1.2-step23-B-red-blue-tap.md) | [`red-blue-tug`](./plan-1.2-step23-C-red-blue-tug.md) |
| 24 | [`clock-house`](./plan-1.2-step24-A-clock-house.md) | [`math-farm`](./plan-1.2-step24-B-math-farm.md) | [`pinyin-train`](./plan-1.2-step24-C-pinyin-train.md) |
| 25 | [`word-garden`](./plan-1.2-step25-A-word-garden.md) | [`shape-kingdom`](./plan-1.2-step25-B-shape-kingdom.md) | [`find-diff`](./plan-1.2-step25-C-find-diff.md) |
| 26 | [`color-fun`](./plan-1.2-step26-A-color-fun.md) | [`music-stars`](./plan-1.2-step26-B-music-stars.md) | [`kitty-care`](./plan-1.2-step26-C-kitty-care.md) |

### 阶段四 · 三轮验收（第 27–29 步）

冲突 / 首页接线 / 全局回归**没有独立第 30 步**，已拆进三轮验收（第 27 步盘子清点与接线，第 29 步终审）。

| 步 | 轮次 | A 测试员 | B 学习优化员 | C 监督修复员 |
| --- | --- | --- | --- | --- |
| 27 | 第 1 轮：盘子清点 + 21 款新游戏 + 点名五项 | [tester](./plan-1.2-step27-A-tester.md) | [learner](./plan-1.2-step27-B-learner.md) | [fixer](./plan-1.2-step27-C-fixer.md) |
| 28 | 第 2 轮：换样本 + 难度 / 手感 / 教育正确性 | [tester](./plan-1.2-step28-A-tester.md) | [learner](./plan-1.2-step28-B-learner.md) | [fixer](./plan-1.2-step28-C-fixer.md) |
| 29 | 第 3 轮：76 款终检 + 文档收口 | [tester](./plan-1.2-step29-A-tester.md) | [learner](./plan-1.2-step29-B-learner.md) | [fixer](./plan-1.2-step29-C-fixer.md) |

合计：1 + 7 + 18 + 3 = **29 步**，游戏 55 + 21 = **76 款**。

---

## 四、派发前必读

1. 先读 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md)（职责、并发规则、法律红线、收口）。
2. 再看 [`plan-1.2-tracker.md`](./plan-1.2-tracker.md) 确认这一格**没人在做**，登记后再派——防重派全靠这张表。
3. 全部工作在分支 `game-1.2`，不改 `main`。
4. 执行子代理的模型 slug 一律 `claude-opus-5-thinking-high-fast`（不带方括号）。
5. 步 0（合入最新 `game-1.1` 代码）**已经做完**：库存 55 款，`npm test` 158 文件 / 4456 用例。
6. **五窗口并行派发（现行）：** 说明见 [`plan-1.2-windows.md`](./plan-1.2-windows.md)。复制 [`plan-1.2-window1.md`](./plan-1.2-window1.md) … [`window5.md`](./plan-1.2-window5.md) 发给五个窗口。窗口是监督，必须用 Task 转发；每步 A/B/C 三个都要派全；本窗三轮验收通过后由窗口把结果提交进 `game-1.2`。第 27–29 步不再单派。规格文件里的「你是执行者、禁止再套娃」是给被窗口派下去的子代理看的。
