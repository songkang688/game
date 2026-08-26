# 1.2 窗口 2 派发提示词 —— 窗口 2 · 第 6–10 步（9 款新游戏 + 6 款升级含点名五项）+ 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 2。不要拆开，不要再套一层摘要。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`[claude-opus-5-thinking-high-fast]`。
请在独立功能分支上进行修改，叫 game-1.2-window2。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug


【读到这段话的你，就是被派发的那个窗口执行者。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手把本窗口全部任务做完，禁止再用 Task 派生任何云端子代理。】

仓库：https://github.com/songkang688/game
产品：「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）
基线分支：**`origin/game-1.2`**（步 0 已完成：最新 1.1 代码已合入，库存 55 款，`npm test` 158 文件 / 4456 用例）。
**不要改 `main`。不要 force push。不要用 `gh` 开/改/合 PR。**

## 〇、你是谁、怎么开工

1. `git fetch origin game-1.2`
2. `git checkout -B game-1.2-window2 origin/game-1.2`
3. **动代码前先提交一条**「窗口2 · 工作计划」commit，再开始改 `src/`。
4. 全程只推 **`game-1.2-window2`**。主管负责监督检查、把窗口分支合回 `game-1.2`。你空出来就在本窗口收尾报告里写「已空闲，可再派」，**不许抢别的窗口的步号或游戏目录**。
5. 每做完一款（或第 1 步的一个平台模块）：`npm test && npm run build` 必须全绿，再继续下一款。用例总数只增不减。
6. 收尾：`git fetch origin game-1.2-window2`（若主管有回写）→ 以 `origin/game-1.2` 为参照 rebase 解决冲突（先保自己独占文件）→ 再全绿 → `git push -u origin game-1.2-window2`。被拒就再 fetch+rebase，禁止 `--force`。
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
- 角色只用朵朵 / 星星及本作原创配角。无血、无死亡描写。失败只鼓励。
- 无广告、无内购、无账号、无联网上报。IO 类本地人机，禁止 Socket。
- **禁止 three.js**、禁止 CDN 字体/外链音源/统计 SDK。离线可玩。
- 不把 `dist/`、`release/`、安装包、APK、大视频推进 git。
- 目录：`src/games/<id>/meta.ts` 纯数据、禁止 import 玩法；`index.ts` 顶部 `export { meta } from "./meta"`，导出 `mount(api): { destroy }`。
- 存档 key 只增不改：`yiduo-yixing.save.v1`、`l99.<id>`、`l99skip.<id>`、`collection.v1`、`fav.v1`、`recent.v1`、1.2 新增 `root.v1`（密码绝不能写入任何 storage）。
- 闯关走 `level99.ts`（188 关）；答题走 `quiz99.ts`；音效只用 `api.play(...)`。
- 双人键位：朵朵 `WASD+F+G`，星星 `方向键+L+K`，`Esc` 暂停；手机必须有触屏等价。
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



独占游戏目录：

- 新游戏：`dot-maze` `fruit-stack` `pool-stars` `junqi-camp` `chess-garden` `dark-chess` `hue-hand` `hop-pads` `tap-tiles`
- 升级：`gomoku` `match-stars` `rainbow-run` `ocean-munch` `xiangqi` `fight-king`

**`xiangqi` 只升级已有目录，禁止新建第二个象棋。** 点名五项全在本窗口，验收时必须专项取证。
不要改窗口 1 的平台文件。`meta.platform` / `meta.modes` 按第 1 步文档的字段写在自己的 `meta.ts` 里即可。


工作量：实现 5 个 step（每步 A/B/C 共 15 格）+ 1 个本窗口三轮验收包。原第 27–29 步不要做。

## 四、本窗口任务清单（先 5 步实现，再 +1 验收）

### 第 6 步 · 新游戏

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `dot-maze` 豆豆迷宫 | `docs/plan-1.2-step6-A-dot-maze.md` |
| B | `fruit-stack` 果果合成 | `docs/plan-1.2-step6-B-fruit-stack.md` |
| C | `pool-stars` 朵星台球 | `docs/plan-1.2-step6-C-pool-stars.md` |

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


## 五、额外第 6 包 · 本窗口三轮验收（5+1 里的「+1」）

实现步全部做完、测试构建全绿之后，**才开始**这一包。你一个人连做三轮，每轮都要依次当测试员、学习优化员、监督修复员。范围**仅限本窗口清单里的游戏/平台**，不要去验 76 款全集（那是主管以后的事）。

参照（读思路，但报告路径不要用全局的 `1.2-roundN-*`）：

- 测试员：`docs/plan-1.2-step27-A-tester.md` / `step28-A-tester.md` / `step29-A-tester.md`
- 学习优化员：`docs/plan-1.2-step27-B-learner.md` 等
- 监督修复员：`docs/plan-1.2-step27-C-fixer.md` 等

本窗口报告必须写成这 9 个文件（可以先建目录）：

```
docs/qa/1.2-window2-round1-tester.md
docs/qa/1.2-window2-round1-learner.md
docs/qa/1.2-window2-round1-fixer.md
docs/qa/1.2-window2-round2-tester.md
docs/qa/1.2-window2-round2-learner.md
docs/qa/1.2-window2-round2-fixer.md
docs/qa/1.2-window2-round3-tester.md
docs/qa/1.2-window2-round3-learner.md
docs/qa/1.2-window2-round3-fixer.md
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

- 全部实现 + 三轮 9 份报告都在 `game-1.2-window2` 上。
- `npm test` / `npm run build` 全绿。
- 回复主管：已空闲。**没有主管新指令，不要开始第 27–29 步，也不要去改其他窗口的游戏。**

