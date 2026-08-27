#!/usr/bin/env python3
"""Generate five copy-paste dispatch prompts for 1.2 windows."""
from pathlib import Path

COMMON_RULES = r'''
【读到这段话的你，就是被派发的那个窗口执行者。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手把本窗口全部任务做完，禁止再用 Task 派生任何云端子代理。】

仓库：https://github.com/songkang688/game
产品：「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）
基线分支：**`origin/game-1.2`**（步 0 已完成：最新 1.1 代码已合入，库存 55 款，`npm test` 158 文件 / 4456 用例）。
**不要改 `main`。不要 force push。不要用 `gh` 开/改/合 PR。**

## 〇、你是谁、怎么开工

1. `git fetch origin game-1.2`
2. `git checkout -B {branch} origin/game-1.2`
3. **动代码前先提交一条**「窗口{n} · 工作计划」commit，再开始改 `src/`。
4. 全程只推 **`{branch}`**。主管负责监督检查、把窗口分支合回 `game-1.2`。你空出来就在本窗口收尾报告里写「已空闲，可再派」，**不许抢别的窗口的步号或游戏目录**。
5. 每做完一款（或第 1 步的一个平台模块）：`npm test && npm run build` 必须全绿，再继续下一款。用例总数只增不减。
6. 收尾：`git fetch origin {branch}`（若主管有回写）→ 以 `origin/game-1.2` 为参照 rebase 解决冲突（先保自己独占文件）→ 再全绿 → `git push -u origin {branch}`。被拒就再 fetch+rebase，禁止 `--force`。
7. 做完后回复必须写：窗口号、实际模型 slug、改了哪些文件、每款新增用例数、最终 `npm test` 文件/用例数、`npm run build` 是否通过、分支 SHA、三轮验收报告路径。

## 一、规格在哪（必须打开对着做，不许凭记忆）

每一格的完整规则、meta、188 关章节、测试下限、独占文件清单，都在仓库里已经写好的 Markdown。你的任务是**按文件实现代码**，不是再写一份提示词。

- 总目录：`docs/plan-1.2-index.md`
- 主管红线：`docs/plan-1.2-supervisor.md` 第八、九节
- 新游戏 id 表：`docs/plan-1.2-new-games-table.md`
- 升级目录：`docs/plan-1.2-upgrades-index.md`

**原计划第 27–29 步全局三人组已经取消。** 每个窗口在自己的实现步全部做完之后，加做 **1 个额外包**：对本窗口范围内的产物，自己连做三轮「测试员 / 学习优化员 / 监督修复员」。不要去做别人窗口里的游戏，也不要改 `docs/plan-1.2-step27-*` 那些全局稿的报告路径。

## 二、公共硬约束（每一款都适用）

- 面向孩子的文案和代码注释禁止商标。黑名单至少扫：`愤怒的小鸟` `植物大战僵尸` `水果忍者` `地铁跑酷` `森林冰火人` `屁王兄弟` `拳皇` `街霸` `超级玛丽` `马里奥` `割绳子` `俄罗斯方块` `Tetris` `贪吃蛇大作战` `球球大作战` `我的世界` `Minecraft` `三国杀` `大富翁` `斗地主` `Pac-Man` `吃豆人` `宝可梦` `皮卡丘` `奥特曼` `喜羊羊` `蛋仔` `原神` `王者荣耀`。命中即自己改掉再交。
- 角色只用鸭梨 / 康康及本作原创配角。无血、无死亡描写。失败只鼓励。
- 无广告、无内购、无账号、无联网上报。IO 类本地人机，禁止 Socket。
- **禁止 three.js**、禁止 CDN 字体/外链音源/统计 SDK。离线可玩。
- 不把 `dist/`、`release/`、安装包、APK、大视频推进 git。
- 目录：`src/games/<id>/meta.ts` 纯数据、禁止 import 玩法；`index.ts` 顶部 `export {{ meta }} from "./meta"`，导出 `mount(api): {{ destroy }}`。
- 存档 key 只增不改：`yiduo-yixing.save.v1`、`l99.<id>`、`l99skip.<id>`、`collection.v1`、`fav.v1`、`recent.v1`、1.2 新增 `root.v1`（密码绝不能写入任何 storage）。
- 闯关走 `level99.ts`（188 关）；答题走 `quiz99.ts`；音效只用 `api.play(...)`。
- 双人键位：鸭梨 `WASD+F+G`，康康 `方向键+L+K`，`Esc` 暂停；手机必须有触屏等价。
- `destroy` 必须拆掉监听 / timer / rAF / AudioContext。
- 每款都要能回答：能闯关吗？能对战吗？能无尽吗？并把 `meta.modes`、`meta.platform`（缺省当 `both`）填准。
- 新游戏每款 ≥ 15 个单测；升级每款新增 ≥ 8 个单测。
- 360px 宽文字不溢出。UI 注释禁止商标。

## 三、文件所有权（并行五窗，越界即事故）

**只改本窗口清单里的路径。** 别人的 `src/games/<id>/` 一个字都不要碰。

公共文件默认规则：

- `src/ui/home.ts`、`src/ui/root12Contract.ts`、`src/ui/rootGate.ts`、筛选芯片、`src/engine/playModes.ts`、`src/engine/view25d.ts`（或提示词里写的等价路径）：**窗口 1 独占**。其他窗口若要用 `meta.platform` / `meta.modes`，只改自己游戏的 `meta.ts`，按第 1 步文档的字段形状填写；平台模块还没合进来也不许自己再造一套。
- 首页能列出新游戏是因为 `import.meta.glob("../games/*/meta.ts")`，**不必改 loader 也能上首页**。
- `src/styles.css`：只允许在文件末尾追加本窗口游戏用的选择器；不要重排别人的规则。
- 测试红在别人的文件里：写进回复交给主管，自己不许越界去改（除非是你引入的类型错误波及全库，只许改类型进口，并在回复里点名）。

'''

QA_EXTRA = r'''
## 五、额外第 {extra} 包 · 本窗口三轮验收（5+1 里的「+1」）

实现步全部做完、测试构建全绿之后，**才开始**这一包。你一个人连做三轮，每轮都要依次当测试员、学习优化员、监督修复员。范围**仅限本窗口清单里的游戏/平台**，不要去验 76 款全集（那是主管以后的事）。

参照（读思路，但报告路径不要用全局的 `1.2-roundN-*`）：

- 测试员：`docs/plan-1.2-step27-A-tester.md` / `step28-A-tester.md` / `step29-A-tester.md`
- 学习优化员：`docs/plan-1.2-step27-B-learner.md` 等
- 监督修复员：`docs/plan-1.2-step27-C-fixer.md` 等

本窗口报告必须写成这 9 个文件（可以先建目录）：

```
docs/qa/1.2-window{n}-round1-tester.md
docs/qa/1.2-window{n}-round1-learner.md
docs/qa/1.2-window{n}-round1-fixer.md
docs/qa/1.2-window{n}-round2-tester.md
docs/qa/1.2-window{n}-round2-learner.md
docs/qa/1.2-window{n}-round2-fixer.md
docs/qa/1.2-window{n}-round3-tester.md
docs/qa/1.2-window{n}-round3-learner.md
docs/qa/1.2-window{n}-round3-fixer.md
```

### 第 1 轮

- **测试员**：本窗口每一款都要从首页进入、玩到真实胜负（赢一次输一次）、有战役的试第 1 / 100 / 188 关；有对战/无尽/双人的每种模式玩到结算；360px 走一遍。平台能力若是窗口 1 做的，按 root 门 / 手游端游筛选 / 2.5D 基建逐条取证。点名项若落在本窗口，必须做专项（见下）。
- **学习优化员**：针对本窗口玩法，列出至少 8 条可落地的手感/关卡/AI 改进，并真正改代码落地其中至少 3 条（有测试）。
- **监督修复员**：把本轮测试员记的阻断/严重全部修掉，商标扫描 0 命中，`destroy` 无泄漏，再全绿。

### 第 2 轮（换样本）

换一批关卡/模式再玩（不要只玩第 1 关）。查难度曲线、竞态、教育正确性（学习类）、无尽是否能持续。学习优化员再落地一批改进。监督修复员清零本轮新问题。

### 第 3 轮（本窗口收官）

本窗口清单一款不漏再过一遍；遗留问题必须有最终结论（已修或标明原因交给主管）。写清：能否发布本窗口这一批。

### 点名五项（谁的窗口谁负责，其他人跳过）

| 项 | 窗口 | 硬要求 |
| --- | --- | --- |
| `gomoku` | 2 | 解局关 + 菜鸟到地狱，固定 seed 相邻档对下 20 局强度单调 |
| `match-stars` | 2 | 消除→下落→补位三个可观察阶段，瞬变即阻断 |
| `rainbow-run` | 2 | 接住 1.1 的 `view3d.ts` / `controls.ts` / `endless.ts`，禁止推倒重来、禁止 three.js |
| `ocean-munch` | 2 | 无尽 + 纪录存档 |
| `xiangqi` | 2 | 只升级已有目录，多档 AI + 残局 |

窗口 1 额外必验：root 密码 `kangkang`、电话 `18438037080`、1 小时过期、可手动关、密码不落盘、直达第 N 关；家长算术门原样保留。

## 六、做完怎么停

- 全部实现 + 三轮 9 份报告都在 `{branch}` 上。
- `npm test` / `npm run build` 全绿。
- 回复主管：已空闲。**没有主管新指令，不要开始第 27–29 步，也不要去改其他窗口的游戏。**
'''

WINDOWS = [
    dict(
        n=1,
        branch="game-1.2-window1",
        steps="第 1–5 步",
        extra=6,
        impl_n=5,
        cells=15,
        title="窗口 1 · 第 1–5 步（平台 + 12 款新游戏）+ 本窗三轮验收",
        own="""独占：

- 平台：`src/ui/root12Contract.ts` `src/ui/rootGate.ts` 及测试；`src/games/level99.ts` / `quiz99.ts` 的直达第 N 关接线；首页手游/端游筛选（`src/ui/home.ts` 及相关）；`playModes` / `view25d` 共享模块（路径以第 1 步 C 档文档为准）。
- 新游戏目录：`orb-arena` `snake-royale` `block-drop` `combo-clash` `mahjong-bloom` `star-estate` `hero-cards` `weiqi-garden` `flight-chess` `merge-2048` `mine-garden` `sudoku-petal`
""",
        tasks="""## 四、本窗口任务清单（先 5 步实现，再 +1 验收）

按步号顺序做。每一步里 A→B→C 可以按文件并行理解，但你是一个人，建议一款做完再做下一款。每格先打开右边那份 Markdown，再写代码。

### 第 1 步 · 平台（3 格）——必须最先做完，因为别的窗口会按这些字段写 meta

| 档 | 主题 | 规格文件 |
| --- | --- | --- |
| A | root 管理员门，密码 `kangkang`，1 小时过期，直达第 N 关，电话 18438037080，密码不落盘；**不改** `parentAuth.ts` | `docs/plan-1.2-step1-A-root-gate.md` |
| B | `GameMeta.platform` 缺省当 `both`；首页「全部/手游/端游」；360px 手机文字 | `docs/plan-1.2-step1-B-platform-filter.md` |
| C | `playModes.ts` 统一闯关/对战/无尽；`view25d.ts` 抽 1.1 跑酷/冲冲冲透视，禁 three.js | `docs/plan-1.2-step1-C-modes-view.md` |

### 第 2 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `orb-arena` 圆圆大作战 | `docs/plan-1.2-step2-A-orb-arena.md` |
| B | `snake-royale` 长蛇争霸 | `docs/plan-1.2-step2-B-snake-royale.md` |
| C | `block-drop` 方块叠叠乐 | `docs/plan-1.2-step2-C-block-drop.md` |

### 第 3 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `combo-clash` 连招对决 | `docs/plan-1.2-step3-A-combo-clash.md` |
| B | `mahjong-bloom` 花开麻将 | `docs/plan-1.2-step3-B-mahjong-bloom.md` |
| C | `star-estate` 梨康地产 | `docs/plan-1.2-step3-C-star-estate.md` |

### 第 4 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `hero-cards` 英杰令 | `docs/plan-1.2-step4-A-hero-cards.md` |
| B | `weiqi-garden` 围子花园 | `docs/plan-1.2-step4-B-weiqi-garden.md` |
| C | `flight-chess` 飞行棋乐园 | `docs/plan-1.2-step4-C-flight-chess.md` |

### 第 5 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `merge-2048` 星星合成 | `docs/plan-1.2-step5-A-merge-2048.md` |
| B | `mine-garden` 扫雷花园 | `docs/plan-1.2-step5-B-mine-garden.md` |
| C | `sudoku-petal` 数独花田 | `docs/plan-1.2-step5-C-sudoku-petal.md` |

本窗口实现格数：**15**（5 步 × 3 档）。象棋不新建。IO 必须本地人机。
""",
    ),
    dict(
        n=2,
        branch="game-1.2-window2",
        steps="第 6–10 步",
        extra=6,
        impl_n=5,
        cells=15,
        title="窗口 2 · 第 6–10 步（9 款新游戏 + 6 款升级含点名五项）+ 本窗三轮验收",
        own="""独占游戏目录：

- 新游戏：`dot-maze` `fruit-stack` `pool-stars` `junqi-camp` `chess-garden` `dark-chess` `hue-hand` `hop-pads` `tap-tiles`
- 升级：`gomoku` `match-stars` `rainbow-run` `ocean-munch` `xiangqi` `fight-king`

**`xiangqi` 只升级已有目录，禁止新建第二个象棋。** 点名五项全在本窗口，验收时必须专项取证。
不要改窗口 1 的平台文件。`meta.platform` / `meta.modes` 按第 1 步文档的字段写在自己的 `meta.ts` 里即可。
""",
        tasks="""## 四、本窗口任务清单（先 5 步实现，再 +1 验收）

### 第 6 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `dot-maze` 豆豆迷宫 | `docs/plan-1.2-step6-A-dot-maze.md` |
| B | `fruit-stack` 果果合成 | `docs/plan-1.2-step6-B-fruit-stack.md` |
| C | `pool-stars` 梨康台球 | `docs/plan-1.2-step6-C-pool-stars.md` |

### 第 7 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `junqi-camp` 军旗对决 | `docs/plan-1.2-step7-A-junqi-camp.md` |
| B | `chess-garden` 花园国际象棋 | `docs/plan-1.2-step7-B-chess-garden.md` |
| C | `dark-chess` 翻翻暗棋 | `docs/plan-1.2-step7-C-dark-chess.md` |

### 第 8 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `hue-hand` 花色接龙 | `docs/plan-1.2-step8-A-hue-hand.md` |
| B | `hop-pads` 跳跳台 | `docs/plan-1.2-step8-B-hop-pads.md` |
| C | `tap-tiles` 音符下落 | `docs/plan-1.2-step8-C-tap-tiles.md` |

### 第 9 步 · 升级（点名）

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `gomoku` | `docs/plan-1.2-step9-A-gomoku.md` |
| B | `match-stars` | `docs/plan-1.2-step9-B-match-stars.md` |
| C | `rainbow-run` | `docs/plan-1.2-step9-C-rainbow-run.md` |

### 第 10 步 · 升级（点名）

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `ocean-munch` | `docs/plan-1.2-step10-A-ocean-munch.md` |
| B | `xiangqi`（只升级） | `docs/plan-1.2-step10-B-xiangqi.md` |
| C | `fight-king` | `docs/plan-1.2-step10-C-fight-king.md` |

本窗口实现格数：**15**。`rainbow-run` 先 `git diff origin/game-1.1 -- src/games/rainbow-run` 确认接住 2.5D，禁止重建摄像机。
""",
    ),
    dict(
        n=3,
        branch="game-1.2-window3",
        steps="第 11–16 步",
        extra=7,
        impl_n=6,
        cells=18,
        title="窗口 3 · 第 11–16 步（18 格 / 19 款，含碰碰车+保龄球）+ 本窗三轮验收",
        own="""独占游戏目录：

`duo-rush` `duo-arena` `duo-vs-star` `sling-birds` `candy-swing` `gold-hook` `garden-guard` `sprout-defense` `monster-crisis` `shoot-range` `sky-squad` `tank-battle` `bomb-buddies` `snow-fight` `bumper-cars` `bowling-lane` `ice-fire-forest` `puff-bros` `prince-princess`

第 15 步 C 是全项目唯一「一格两款」：`bumper-cars` + `bowling-lane` 都要做完（代码已在 1.1 合入，本窗口做的是 1.2 升级，不是从零新建）。
不要改窗口 1 的平台文件。
""",
        tasks="""## 四、本窗口任务清单（先 6 步实现，再 +1 验收）

### 第 11 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `duo-rush` | `docs/plan-1.2-step11-A-duo-rush.md` |
| B | `duo-arena` | `docs/plan-1.2-step11-B-duo-arena.md` |
| C | `duo-vs-star` | `docs/plan-1.2-step11-C-duo-vs-star.md` |

### 第 12 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `sling-birds` | `docs/plan-1.2-step12-A-sling-birds.md` |
| B | `candy-swing` | `docs/plan-1.2-step12-B-candy-swing.md` |
| C | `gold-hook` | `docs/plan-1.2-step12-C-gold-hook.md` |

### 第 13 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `garden-guard` | `docs/plan-1.2-step13-A-garden-guard.md` |
| B | `sprout-defense` | `docs/plan-1.2-step13-B-sprout-defense.md` |
| C | `monster-crisis` | `docs/plan-1.2-step13-C-monster-crisis.md` |

### 第 14 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `shoot-range` | `docs/plan-1.2-step14-A-shoot-range.md` |
| B | `sky-squad` | `docs/plan-1.2-step14-B-sky-squad.md` |
| C | `tank-battle` | `docs/plan-1.2-step14-C-tank-battle.md` |

### 第 15 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `bomb-buddies` | `docs/plan-1.2-step15-A-bomb-buddies.md` |
| B | `snow-fight` | `docs/plan-1.2-step15-B-snow-fight.md` |
| C | `bumper-cars` **+** `bowling-lane` | `docs/plan-1.2-step15-C-bumper-cars.md` |

### 第 16 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `ice-fire-forest` | `docs/plan-1.2-step16-A-ice-fire-forest.md` |
| B | `puff-bros` | `docs/plan-1.2-step16-B-puff-bros.md` |
| C | `prince-princess` | `docs/plan-1.2-step16-C-prince-princess.md` |

本窗口实现格数：**18**（6 步 × 3；其中 15-C 一格两款，实际 19 个游戏目录）。
""",
    ),
    dict(
        n=4,
        branch="game-1.2-window4",
        steps="第 17–21 步",
        extra=6,
        impl_n=5,
        cells=15,
        title="窗口 4 · 第 17–21 步（15 款升级）+ 本窗三轮验收",
        own="""独占游戏目录：

`brave-path` `adventure-king` `alien-seek` `brick-break` `mole-pop` `box-hamster` `balloon-pop` `bubble-pop` `bubble-aim` `fruit-catch` `fruit-slice` `snake-snack` `lianliankan` `puzzle-tiles` `memory-cards`

`snake-snack` 是迷宫贪吃，不要做成窗口 1 的 `snake-royale`。不要改窗口 1 的平台文件。
""",
        tasks="""## 四、本窗口任务清单（先 5 步实现，再 +1 验收）

### 第 17 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `brave-path` | `docs/plan-1.2-step17-A-brave-path.md` |
| B | `adventure-king` | `docs/plan-1.2-step17-B-adventure-king.md` |
| C | `alien-seek` | `docs/plan-1.2-step17-C-alien-seek.md` |

### 第 18 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `brick-break` | `docs/plan-1.2-step18-A-brick-break.md` |
| B | `mole-pop` | `docs/plan-1.2-step18-B-mole-pop.md` |
| C | `box-hamster` | `docs/plan-1.2-step18-C-box-hamster.md` |

### 第 19 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `balloon-pop` | `docs/plan-1.2-step19-A-balloon-pop.md` |
| B | `bubble-pop` | `docs/plan-1.2-step19-B-bubble-pop.md` |
| C | `bubble-aim` | `docs/plan-1.2-step19-C-bubble-aim.md` |

### 第 20 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `fruit-catch` | `docs/plan-1.2-step20-A-fruit-catch.md` |
| B | `fruit-slice` | `docs/plan-1.2-step20-B-fruit-slice.md` |
| C | `snake-snack` | `docs/plan-1.2-step20-C-snake-snack.md` |

### 第 21 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `lianliankan` | `docs/plan-1.2-step21-A-lianliankan.md` |
| B | `puzzle-tiles` | `docs/plan-1.2-step21-B-puzzle-tiles.md` |
| C | `memory-cards` | `docs/plan-1.2-step21-C-memory-cards.md` |

本窗口实现格数：**15**。
""",
    ),
    dict(
        n=5,
        branch="game-1.2-window5",
        steps="第 22–26 步",
        extra=6,
        impl_n=5,
        cells=15,
        title="窗口 5 · 第 22–26 步（15 款升级）+ 本窗三轮验收",
        own="""独占游戏目录：

`landlord-cards` `fishing-star` `poop-hero` `red-blue-race` `red-blue-tap` `red-blue-tug` `clock-house` `math-farm` `pinyin-train` `word-garden` `shape-kingdom` `find-diff` `color-fun` `music-stars` `kitty-care`

学习三连（24–25）必须保证题目正确、提示不直接给答案。不要改窗口 1 的平台文件。
""",
        tasks="""## 四、本窗口任务清单（先 5 步实现，再 +1 验收）

### 第 22 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `landlord-cards` | `docs/plan-1.2-step22-A-landlord-cards.md` |
| B | `fishing-star` | `docs/plan-1.2-step22-B-fishing-star.md` |
| C | `poop-hero` | `docs/plan-1.2-step22-C-poop-hero.md` |

### 第 23 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `red-blue-race` | `docs/plan-1.2-step23-A-red-blue-race.md` |
| B | `red-blue-tap` | `docs/plan-1.2-step23-B-red-blue-tap.md` |
| C | `red-blue-tug` | `docs/plan-1.2-step23-C-red-blue-tug.md` |

### 第 24 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `clock-house` | `docs/plan-1.2-step24-A-clock-house.md` |
| B | `math-farm` | `docs/plan-1.2-step24-B-math-farm.md` |
| C | `pinyin-train` | `docs/plan-1.2-step24-C-pinyin-train.md` |

### 第 25 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `word-garden` | `docs/plan-1.2-step25-A-word-garden.md` |
| B | `shape-kingdom` | `docs/plan-1.2-step25-B-shape-kingdom.md` |
| C | `find-diff` | `docs/plan-1.2-step25-C-find-diff.md` |

### 第 26 步

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `color-fun` | `docs/plan-1.2-step26-A-color-fun.md` |
| B | `music-stars` | `docs/plan-1.2-step26-B-music-stars.md` |
| C | `kitty-care` | `docs/plan-1.2-step26-C-kitty-care.md` |

本窗口实现格数：**15**。
""",
    ),
]


def header(branch: str) -> str:
    return f"""请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`[claude-opus-5-thinking-high-fast]`。
请在独立功能分支上进行修改，叫 {branch}。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
"""


def build(w: dict) -> str:
    n = w["n"]
    branch = w["branch"]
    body = COMMON_RULES.format(branch=branch, n=n)
    extra = QA_EXTRA.format(n=n, extra=w["extra"], branch=branch)
    return f"""# 1.2 窗口 {n} 派发提示词 —— {w['title']}

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 {n}。不要拆开，不要再套一层摘要。

{header(branch)}
{body}

{w['own']}

工作量：实现 {w['impl_n']} 个 step（每步 A/B/C 共 {w['cells']} 格）+ 1 个本窗口三轮验收包。原第 27–29 步不要做。

{w['tasks']}
{extra}
"""


def howto() -> str:
    return """# 1.2 五窗口派发说明（发给谁、复制哪一段）

主管同时开 **5 个窗口**。有空的窗口做完自己的清单后停住等你再派，不要去抢别人的步。

全局第 27–29 步**不再单独派**：每个窗口在自己的 5 或 6 个实现 step 之后，加做 1 包「三轮 × 测试员 / 学习优化员 / 监督修复员」，只验本窗口的游戏。

## 怎么发送

1. 确认 `origin/game-1.2` 已是带 1.1 代码 + 全套 `docs/plan-1.2-step*` 的版本。
2. 开 5 个 Cursor 云端 Agent（或 5 个独立对话），模型选 **claude-opus-5-thinking-high-fast**。
3. 每个窗口粘贴对应文件的**全文**（从「请通过 Task 工具派生」一直到文末）：

| 窗口 | 复制这个文件 | 分支 | 实现 step | 实现格 | +1 |
| --- | --- | --- | --- | --- | --- |
| 1 | [`plan-1.2-window1.md`](./plan-1.2-window1.md) | `game-1.2-window1` | 1–5 | 15 | 本窗三轮验收 |
| 2 | [`plan-1.2-window2.md`](./plan-1.2-window2.md) | `game-1.2-window2` | 6–10 | 15 | 本窗三轮验收 |
| 3 | [`plan-1.2-window3.md`](./plan-1.2-window3.md) | `game-1.2-window3` | 11–16 | 18 | 本窗三轮验收 |
| 4 | [`plan-1.2-window4.md`](./plan-1.2-window4.md) | `game-1.2-window4` | 17–21 | 15 | 本窗三轮验收 |
| 5 | [`plan-1.2-window5.md`](./plan-1.2-window5.md) | `game-1.2-window5` | 22–26 | 15 | 本窗三轮验收 |

4. 仓库选本仓库，基线选 **`game-1.2`**。提示词里会让他们自己 `checkout -B game-1.2-windowN origin/game-1.2`。
5. 你当主管：谁交卷就看测试是否全绿、有没有改别人的目录、商标扫描过不过。空闲了再加任务，不要让他们自己去领 27–29。

合计实现格 15+15+18+15+15 = **78 格**（第 1–26 步），外加 5 个窗口各自的验收包。
"""


def main() -> None:
    docs = Path("docs")
    (docs / "plan-1.2-windows.md").write_text(howto(), encoding="utf-8")
    for w in WINDOWS:
        path = docs / f"plan-1.2-window{w['n']}.md"
        path.write_text(build(w), encoding="utf-8")
        print("wrote", path, "chars", path.stat().st_size)


if __name__ == "__main__":
    main()
