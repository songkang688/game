# 一朵一星 1.2 · 多窗口派发登记表

> **这张表是唯一的防重派机制。** 派发前先在表里把那一格从「未派」改成「在跑」并提交，再去开子代理；
> 没登记就派 = 重派事故。主管文档见 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md)，目录见 [`plan-1.2-index.md`](./plan-1.2-index.md)。

## 〇、怎么用

1. **同一时刻只有 3 个窗口在跑**（W1 / W2 / W3）。窗口空出来 → 从下面表里从上往下找第一格「未派且依赖已满足」的 → 先登记 → 再派。
2. 一行 = 一格 = 「某一步的某一档」。**一格只许一个窗口**；已经写了窗口号的行，任何人不许再派。
3. 状态只能是这五种：

   | 状态 | 含义 | 谁能改 |
   | --- | --- | --- |
   | `未派` | 还没人做 | 主管 |
   | `在跑` | 已派给某窗口，子代理正在做 | 主管（派发时） |
   | `待验` | 子代理说做完了，主管还没核 | 主管（收到回复时） |
   | `已验收` | 提交在 `origin/game-1.2` 上、测试构建全绿、独占文件没越界、商标 0 命中 | 主管（核完） |
   | `打回` | 有问题，退回原窗口重做（不算新格，不占新窗口） | 主管 |

4. 每次改状态都要**单独提交一次**（`docs(1.2 tracker): 第 N 步 X 档 → 在跑/已验收`），这样两个人同时操作时 git 会拦下冲突。
5. 「用例水位」列填该格合入后 `npm test` 的用例总数。下一格必须 ≥ 这个数。

## 一、依赖闸门（派发前先对照）

| 闸门 | 规则 |
| --- | --- |
| 步 0 · 对齐基线 | **已做完**（已合入 `origin/game-1.1` @ `0b2df9c`）。本分支合进 `game-1.2` 后才允许登记第 1 步任何一格 |
| 第 1 步 | 三格**全部已验收**，才允许开第 2 步 |
| 第 2–8 步 | 21 格互不相交，**可以跨步流水**，谁空谁取 |
| 第 9 步开始 | 必须第 2–8 步 **21 格全部已验收** |
| 第 9–26 步 | 53 格单款 + 第 15 步 C 位两款，互不相交，可跨步流水 |
| 第 27 / 28 / 29 步 | 必须第 1–26 步 **78 格全部已验收**。三轮严格串行，一轮三格全绿才开下一轮 |

## 二、当前水位

| 项 | 值 | 记录时间 |
| --- | --- | --- |
| 分支 | `game-1.2` | 2026-08-26 |
| 对齐基线前 `origin/game-1.2` | `71eb519`，142 测试文件 / 3918 用例 | 1.2 基线记录时 |
| 对齐基线后（合入 `origin/game-1.1` @ `0b2df9c`） | 158 测试文件 / 4456 用例，`npm run build` 通过 | 2026-08-26 |
| 最新用例水位 | **4456** | 2026-08-26 |
| 库存游戏数 | **55**（含 `bumper-cars`、`bowling-lane`） | 2026-08-26 |
| 总步数 | **29 步 × 3 档 = 87 格** | 2026-08-26 收口 |

---

## 三、登记表（29 步 × 3 档 = 87 格）

提示词文档已全部写完。下面「状态」列是**改代码派发**用的，现在一律 `未派`。

### 阶段一 · 平台基建

| 步 | 档 | 主题 / 施工 id | 提示词文档 | 窗口 | 状态 | 派发时间 | 推送 SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 主管 | 对齐基线：merge `origin/game-1.1` | 本表第二节 | — | **已做** | 2026-08-26 | | 4456 | 库存 55；缺的 2.5D / 碰碰车 / 保龄球已补 |
| 1 | A | root 管理员门 + 直达第 N 关 | [step1-A](./plan-1.2-step1-A-root-gate.md) | | 未派 | | | | 契约 `root12Contract.ts` 以本档为准 |
| 1 | B | 手游 / 端游筛选 + 手机文字 | [step1-B](./plan-1.2-step1-B-platform-filter.md) | | 未派 | | | | |
| 1 | C | 模式口径 + 2.5D 基建 | [step1-C](./plan-1.2-step1-C-modes-view.md) | | 未派 | | | | |

### 阶段二 · 21 款新游戏

| 步 | 档 | 主题 / 施工 id | 提示词文档 | 窗口 | 状态 | 派发时间 | 推送 SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | A | `orb-arena` 圆圆大作战 | [step2-A](./plan-1.2-step2-A-orb-arena.md) | | 未派 | | | | 本地人机，禁 Socket |
| 2 | B | `snake-royale` 长蛇争霸 | [step2-B](./plan-1.2-step2-B-snake-royale.md) | | 未派 | | | | |
| 2 | C | `block-drop` 方块叠叠乐 | [step2-C](./plan-1.2-step2-C-block-drop.md) | | 未派 | | | | 中文名禁用原作名 |
| 3 | A | `combo-clash` 连招对决 | [step3-A](./plan-1.2-step3-A-combo-clash.md) | | 未派 | | | | 必须比 `fight-king` 更深 |
| 3 | B | `mahjong-bloom` 花开麻将 | [step3-B](./plan-1.2-step3-B-mahjong-bloom.md) | | 未派 | | | | |
| 3 | C | `star-estate` 朵星地产 | [step3-C](./plan-1.2-step3-C-star-estate.md) | | 未派 | | | | |
| 4 | A | `hero-cards` 英杰令 | [step4-A](./plan-1.2-step4-A-hero-cards.md) | | 未派 | | | | 原创英杰名 |
| 4 | B | `weiqi-garden` 围子花园 | [step4-B](./plan-1.2-step4-B-weiqi-garden.md) | | 未派 | | | | |
| 4 | C | `flight-chess` 飞行棋乐园 | [step4-C](./plan-1.2-step4-C-flight-chess.md) | | 未派 | | | | |
| 5 | A | `merge-2048` 星星合成 | [step5-A](./plan-1.2-step5-A-merge-2048.md) | | 未派 | | | | |
| 5 | B | `mine-garden` 扫雷花园 | [step5-B](./plan-1.2-step5-B-mine-garden.md) | | 未派 | | | | 首点安全 + 可无猜 |
| 5 | C | `sudoku-petal` 数独花田 | [step5-C](./plan-1.2-step5-C-sudoku-petal.md) | | 未派 | | | | 唯一解，提示不给答案 |
| 6 | A | `dot-maze` 豆豆迷宫 | [step6-A](./plan-1.2-step6-A-dot-maze.md) | | 未派 | | | | 追逐者必须原创造型 |
| 6 | B | `fruit-stack` 果果合成 | [step6-B](./plan-1.2-step6-B-fruit-stack.md) | | 未派 | | | | |
| 6 | C | `pool-stars` 朵星台球 | [step6-C](./plan-1.2-step6-C-pool-stars.md) | | 未派 | | | | |
| 7 | A | `junqi-camp` 军旗对决 | [step7-A](./plan-1.2-step7-A-junqi-camp.md) | | 未派 | | | | |
| 7 | B | `chess-garden` 花园国际象棋 | [step7-B](./plan-1.2-step7-B-chess-garden.md) | | 未派 | | | | 王车易位 / 吃过路兵 / 升变 |
| 7 | C | `dark-chess` 翻翻暗棋 | [step7-C](./plan-1.2-step7-C-dark-chess.md) | | 未派 | | | | |
| 8 | A | `hue-hand` 花色接龙 | [step8-A](./plan-1.2-step8-A-hue-hand.md) | | 未派 | | | | |
| 8 | B | `hop-pads` 跳跳台 | [step8-B](./plan-1.2-step8-B-hop-pads.md) | | 未派 | | | | |
| 8 | C | `tap-tiles` 音符下落 | [step8-C](./plan-1.2-step8-C-tap-tiles.md) | | 未派 | | | | 谱面纯数据，禁外部音源 |

### 阶段三 · 55 款精细化升级（顺序以 C 档实际文件为准）

| 步 | 档 | 施工 id | 提示词文档 | 窗口 | 状态 | 派发时间 | 推送 SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | A | `gomoku` | [step9-A](./plan-1.2-step9-A-gomoku.md) | | 未派 | | | | 解局 + 菜鸟到地狱 |
| 9 | B | `match-stars` | [step9-B](./plan-1.2-step9-B-match-stars.md) | | 未派 | | | | 必须可见下落补位 |
| 9 | C | `rainbow-run` | [step9-C](./plan-1.2-step9-C-rainbow-run.md) | | 未派 | | | | 接 1.1 的 `view3d.ts` |
| 10 | A | `ocean-munch` | [step10-A](./plan-1.2-step10-A-ocean-munch.md) | | 未派 | | | | 无尽 |
| 10 | B | `xiangqi` | [step10-B](./plan-1.2-step10-B-xiangqi.md) | | 未派 | | | | **只升级，禁止新建第二个象棋** |
| 10 | C | `fight-king` | [step10-C](./plan-1.2-step10-C-fight-king.md) | | 未派 | | | | 与 `combo-clash` 分工写清 |
| 11 | A | `duo-rush` | [step11-A](./plan-1.2-step11-A-duo-rush.md) | | 未派 | | | | |
| 11 | B | `duo-arena` | [step11-B](./plan-1.2-step11-B-duo-arena.md) | | 未派 | | | | |
| 11 | C | `duo-vs-star` | [step11-C](./plan-1.2-step11-C-duo-vs-star.md) | | 未派 | | | | |
| 12 | A | `sling-birds` | [step12-A](./plan-1.2-step12-A-sling-birds.md) | | 未派 | | | | |
| 12 | B | `candy-swing` | [step12-B](./plan-1.2-step12-B-candy-swing.md) | | 未派 | | | | |
| 12 | C | `gold-hook` | [step12-C](./plan-1.2-step12-C-gold-hook.md) | | 未派 | | | | |
| 13 | A | `garden-guard` | [step13-A](./plan-1.2-step13-A-garden-guard.md) | | 未派 | | | | |
| 13 | B | `sprout-defense` | [step13-B](./plan-1.2-step13-B-sprout-defense.md) | | 未派 | | | | |
| 13 | C | `monster-crisis` | [step13-C](./plan-1.2-step13-C-monster-crisis.md) | | 未派 | | | | |
| 14 | A | `shoot-range` | [step14-A](./plan-1.2-step14-A-shoot-range.md) | | 未派 | | | | |
| 14 | B | `sky-squad` | [step14-B](./plan-1.2-step14-B-sky-squad.md) | | 未派 | | | | |
| 14 | C | `tank-battle` | [step14-C](./plan-1.2-step14-C-tank-battle.md) | | 未派 | | | | |
| 15 | A | `bomb-buddies` | [step15-A](./plan-1.2-step15-A-bomb-buddies.md) | | 未派 | | | | |
| 15 | B | `snow-fight` | [step15-B](./plan-1.2-step15-B-snow-fight.md) | | 未派 | | | | |
| 15 | C | `bumper-cars` + `bowling-lane` | [step15-C](./plan-1.2-step15-C-bumper-cars.md) | | 未派 | | | | 全项目唯一的两款位 |
| 16 | A | `ice-fire-forest` | [step16-A](./plan-1.2-step16-A-ice-fire-forest.md) | | 未派 | | | | |
| 16 | B | `puff-bros` | [step16-B](./plan-1.2-step16-B-puff-bros.md) | | 未派 | | | | |
| 16 | C | `prince-princess` | [step16-C](./plan-1.2-step16-C-prince-princess.md) | | 未派 | | | | |
| 17 | A | `brave-path` | [step17-A](./plan-1.2-step17-A-brave-path.md) | | 未派 | | | | |
| 17 | B | `adventure-king` | [step17-B](./plan-1.2-step17-B-adventure-king.md) | | 未派 | | | | |
| 17 | C | `alien-seek` | [step17-C](./plan-1.2-step17-C-alien-seek.md) | | 未派 | | | | |
| 18 | A | `brick-break` | [step18-A](./plan-1.2-step18-A-brick-break.md) | | 未派 | | | | |
| 18 | B | `mole-pop` | [step18-B](./plan-1.2-step18-B-mole-pop.md) | | 未派 | | | | |
| 18 | C | `box-hamster` | [step18-C](./plan-1.2-step18-C-box-hamster.md) | | 未派 | | | | |
| 19 | A | `balloon-pop` | [step19-A](./plan-1.2-step19-A-balloon-pop.md) | | 未派 | | | | |
| 19 | B | `bubble-pop` | [step19-B](./plan-1.2-step19-B-bubble-pop.md) | | 未派 | | | | |
| 19 | C | `bubble-aim` | [step19-C](./plan-1.2-step19-C-bubble-aim.md) | | 未派 | | | | |
| 20 | A | `fruit-catch` | [step20-A](./plan-1.2-step20-A-fruit-catch.md) | | 未派 | | | | |
| 20 | B | `fruit-slice` | [step20-B](./plan-1.2-step20-B-fruit-slice.md) | | 未派 | | | | |
| 20 | C | `snake-snack` | [step20-C](./plan-1.2-step20-C-snake-snack.md) | | 未派 | | | | 与 `snake-royale` 分工写清 |
| 21 | A | `lianliankan` | [step21-A](./plan-1.2-step21-A-lianliankan.md) | | 未派 | | | | |
| 21 | B | `puzzle-tiles` | [step21-B](./plan-1.2-step21-B-puzzle-tiles.md) | | 未派 | | | | |
| 21 | C | `memory-cards` | [step21-C](./plan-1.2-step21-C-memory-cards.md) | | 未派 | | | | |
| 22 | A | `landlord-cards` | [step22-A](./plan-1.2-step22-A-landlord-cards.md) | | 未派 | | | | |
| 22 | B | `fishing-star` | [step22-B](./plan-1.2-step22-B-fishing-star.md) | | 未派 | | | | |
| 22 | C | `poop-hero` | [step22-C](./plan-1.2-step22-C-poop-hero.md) | | 未派 | | | | |
| 23 | A | `red-blue-race` | [step23-A](./plan-1.2-step23-A-red-blue-race.md) | | 未派 | | | | |
| 23 | B | `red-blue-tap` | [step23-B](./plan-1.2-step23-B-red-blue-tap.md) | | 未派 | | | | |
| 23 | C | `red-blue-tug` | [step23-C](./plan-1.2-step23-C-red-blue-tug.md) | | 未派 | | | | |
| 24 | A | `clock-house` | [step24-A](./plan-1.2-step24-A-clock-house.md) | | 未派 | | | | |
| 24 | B | `math-farm` | [step24-B](./plan-1.2-step24-B-math-farm.md) | | 未派 | | | | |
| 24 | C | `pinyin-train` | [step24-C](./plan-1.2-step24-C-pinyin-train.md) | | 未派 | | | | |
| 25 | A | `word-garden` | [step25-A](./plan-1.2-step25-A-word-garden.md) | | 未派 | | | | |
| 25 | B | `shape-kingdom` | [step25-B](./plan-1.2-step25-B-shape-kingdom.md) | | 未派 | | | | |
| 25 | C | `find-diff` | [step25-C](./plan-1.2-step25-C-find-diff.md) | | 未派 | | | | |
| 26 | A | `color-fun` | [step26-A](./plan-1.2-step26-A-color-fun.md) | | 未派 | | | | |
| 26 | B | `music-stars` | [step26-B](./plan-1.2-step26-B-music-stars.md) | | 未派 | | | | |
| 26 | C | `kitty-care` | [step26-C](./plan-1.2-step26-C-kitty-care.md) | | 未派 | | | | |

### 阶段四 · 三轮验收

| 步 | 档 | 主题 | 提示词文档 | 窗口 | 状态 | 派发时间 | 推送 SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 27 | A | QA 第 1 轮 · 测试员 | [step27-A](./plan-1.2-step27-A-tester.md) | | 未派 | | | | 报告 `docs/qa/1.2-round1-tester.md`；含盘子清点与接线 |
| 27 | B | QA 第 1 轮 · 学习优化员 | [step27-B](./plan-1.2-step27-B-learner.md) | | 未派 | | | | `docs/qa/1.2-round1-learner.md` |
| 27 | C | QA 第 1 轮 · 监督修复员 | [step27-C](./plan-1.2-step27-C-fixer.md) | | 未派 | | | | `docs/qa/1.2-round1-fixer.md` |
| 28 | A | QA 第 2 轮 · 测试员 | [step28-A](./plan-1.2-step28-A-tester.md) | | 未派 | | | | |
| 28 | B | QA 第 2 轮 · 学习优化员 | [step28-B](./plan-1.2-step28-B-learner.md) | | 未派 | | | | |
| 28 | C | QA 第 2 轮 · 监督修复员 | [step28-C](./plan-1.2-step28-C-fixer.md) | | 未派 | | | | |
| 29 | A | QA 第 3 轮 · 测试员（收官） | [step29-A](./plan-1.2-step29-A-tester.md) | | 未派 | | | | 末尾给发布结论 |
| 29 | B | QA 第 3 轮 · 学习优化员（收官） | [step29-B](./plan-1.2-step29-B-learner.md) | | 未派 | | | | README / 发布说明 |
| 29 | C | QA 第 3 轮 · 监督修复员（收官） | [step29-C](./plan-1.2-step29-C-fixer.md) | | 未派 | | | | 问题清零 + 最终质量结论 |

---

## 四、提示词写作进度（已完成）

| 档 | 负责 | 应产出份数 | 已完成 | 状态 |
| --- | --- | --- | --- | --- |
| A 主管 | 三份总纲 + 第 1 步三份 | 6 | 6 | ✅ |
| B 新游戏 | 第 2–8 步 | 21 | 21 | ✅ |
| C 升级 + 验收 | 第 9–29 步 | 63 | 63 | ✅ |

三档独占路径互不相交：A 只碰 `plan-1.2-supervisor/tracker/index` 与 `plan-1.2-step1-*`；
B 只碰 `plan-1.2-step2-*` … `step8-*`；C 只碰 `plan-1.2-step9-*` … `step29-*`。

## 五、事故处理

| 情况 | 怎么办 |
| --- | --- |
| 两个窗口都改了同一格（重派） | 后登记的那个立刻停手；已推的代码由主管挑一份保留，另一份 revert。事故写进本表备注 |
| 子代理越界改了别人的文件 | 打回，让它 revert 越界 diff 再重推；状态回「打回」，仍占原窗口 |
| 子代理 force push | 严重事故：立刻用 `git reflog` / 远端保护恢复 `game-1.2`，该格重做 |
| 子代理去改了 `main` | 打回并 revert；`main` 由用户自己决定何时合 |
| 子代理又用 Task 套娃派了云端子代理 | 打回。执行提示词里那句「请通过 Task 派生」是给派发方看的 |
| 测试红在别人的文件 | 不许越界修，写进回复交主管，主管决定是打回上一格还是并入第 27–29 步验收 |
