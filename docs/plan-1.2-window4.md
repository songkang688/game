# 1.2 窗口 4 派发提示词 —— 窗口 4 · 第 17–21 步（15 款升级）+ 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 4。不要拆开，不要再套一层摘要。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`[claude-opus-5-thinking-high-fast]`。
请在独立功能分支上进行修改，叫 game-1.2-window4。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug


【读到这段话的你，就是窗口 4 的主管/监督。你不是写游戏的人。上面四行口令对你生效：你必须立刻用 Task 工具派生云端子代理去做每一格。禁止自己改 `src/games/**`，禁止自己当测试员去玩，禁止把规格文件里的「你就是执行者、禁止再套娃」当成自己的角色——那句话是给被你派出去的子代理看的。漏派、自己写代码、只派 A 不派 B/C，都算任务失败。】

仓库：https://github.com/songkang688/game
产品：「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）
基线分支：**`origin/game-1.2`**（步 0 已完成：最新 1.1 代码已合入，库存 55 款，`npm test` 158 文件 / 4456 用例）。
工作分支：**`game-1.2-window4`**（实现期间所有子代理都推这条；规格文件里若写「只推 `game-1.2`」，转发时改成只推 `game-1.2-window4`）。
**不要改 `main`。不要 force push。不要用 `gh` 开/改/合 PR。** 最后一包验收通过后，由你把 `game-1.2-window4` 合进 `origin/game-1.2`（见第七节）。

## 〇、你是谁（硬角色）

1. 你是**窗口监督**。唯一合法动作：用 Task 派生云端子代理、检查交卷、谁交卷立刻补下一格、最后验收通过后把结果提交进 `game-1.2`。
2. **必须转发。** 每一格、每一个验收角色，都要单独 Task 出去。禁止「我自己写更快」。禁止把一步的三格合成一个子代理（第 15 步 C 规格本身就是一格两款，那一格仍只派 1 个执行者，但 bumper-cars 和 bowling-lane 两款都要做完）。
3. **三个要全。** 每一步的 A、B、C 三份规格必须全部派完、全部收回、全部全绿。少一格不准进入下一步，更不准进入验收。
4. 并发：始终保持 **3 个实现子代理在跑**（对应当前步的 A/B/C）。谁交卷并且过检，立刻派还没做的下一格。不要等三个都结束才开下一步。
5. 子代理参数：`subagent_type` 用能跑云端的类型；`environment: "cloud"`；`model: "claude-opus-5-thinking-high-fast"`（Task 的 model 字段不要带方括号）。转发给子代理的口令里模型 slug 写成 `` `[claude-opus-5-thinking-high-fast]` ``。
6. 规格在仓库里已经写好。你的工作是**打开文件、整段转发出去**，不是再写一份提示词，也不是自己实现。

规格入口：

- 总目录：`docs/plan-1.2-index.md`
- 主管红线：`docs/plan-1.2-supervisor.md` 第八、九节
- 新游戏 id 表：`docs/plan-1.2-new-games-table.md`
- 升级目录：`docs/plan-1.2-upgrades-index.md`

**原计划第 27–29 步全局三人组已经取消。** 实现格全部收回后，再派本窗口 +1 验收包（三轮 × 测试员/学习优化员/监督修复员，三个角色都要派）。不要去做别人窗口的游戏。

## 一、开工（监督只做接线，不写玩法）

1. `git fetch origin game-1.2`
2. `git checkout -B game-1.2-window4 origin/game-1.2`
3. 先提交一条「窗口4 · 监督派发计划」commit（只写本节派发顺序，**不要改 `src/`**），然后 `git push -u origin game-1.2-window4`。
4. 立刻按第五节清单派出当前步的 A、B、C 三个子代理。若你是窗口 1：必须先派完第 1 步三格并收回，再派第 2 步。其他窗口不要改平台文件，也不要自己去做第 1 步。

## 二、每次转发必须用的开头（原样放在子代理 prompt 最前面）

把下面四行 + 对应规格文件全文，作为 **一条** Task prompt 发出去：

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`[claude-opus-5-thinking-high-fast]`。
请在独立功能分支上进行修改，叫 game-1.2-window4。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

紧接着贴上该格 `docs/plan-1.2-step…` 的**全文**。再覆盖三句：

- 工作分支是 `game-1.2-window4`，禁止推 `main`，禁止 force，实现期间禁止直接推 `game-1.2`。
- 你是执行者，禁止再派生 Task。
- 只改本格独占文件；交卷前 `npm test && npm run build` 必须全绿。

## 三、检查交卷（你查，不要你改游戏）

子代理回来后核对：实际模型 slug、只动了本格目录、`npm test` / `npm run build` 全绿、用例只增不减、商标黑名单 0 命中。缺测、越界、红测：再派一个修复子代理，仍然禁止你自己改 `src/games/**`。

## 四、公共硬约束（写进每个子代理任务，你也用来验收）

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

## 文件所有权（并行五窗，越界即事故）

子代理**只改本窗口清单里的路径。** 别人的 `src/games/<id>/` 一个字都不要碰。你作为监督禁止改 `src/games/**`。

公共文件默认规则：

- `src/ui/home.ts`、`src/ui/root12Contract.ts`、`src/ui/rootGate.ts`、筛选芯片、`src/engine/playModes.ts`、`src/engine/view25d.ts`（或提示词里写的等价路径）：**窗口 1 独占**。其他窗口若要用 `meta.platform` / `meta.modes`，只改自己游戏的 `meta.ts`，按第 1 步文档的字段形状填写；平台模块还没合进来也不许自己再造一套。
- 首页能列出新游戏是因为 `import.meta.glob("../games/*/meta.ts")`，**不必改 loader 也能上首页**。
- `src/styles.css`：只允许在文件末尾追加本窗口游戏用的选择器；不要重排别人的规则。
- 测试红在别人的文件里：写进回复交给主管，自己不许越界去改（除非是你引入的类型错误波及全库，只许改类型进口，并在回复里点名）。



独占游戏目录：

`brave-path` `adventure-king` `alien-seek` `brick-break` `mole-pop` `box-hamster` `balloon-pop` `bubble-pop` `bubble-aim` `fruit-catch` `fruit-slice` `snake-snack` `lianliankan` `puzzle-tiles` `memory-cards`

`snake-snack` 是迷宫贪吃，不要做成窗口 1 的 `snake-royale`。不要改窗口 1 的平台文件。


工作量：派发 5 个 step（每步 A/B/C 必须全派，共 15 格）+ 再派 1 个本窗口三轮验收包（每轮测试员/学习优化员/监督修复员三个都要全）。原第 27–29 步不要做。验收通过后把 `game-1.2-window4` 提交进 `game-1.2`。

## 五、本窗口任务清单（先派实现格，再派 +1 验收）

**每一步必须同时派发 A、B、C 三格，三个都要全。** 打开右边那份 Markdown，整段转发给对应子代理，禁止自己写代码。

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


## 六、最后一包 · 本窗口三轮验收（三个角色都要派，缺一不可）

实现格全部收回且全绿之后才开始。你仍然禁止自己当测试员 / 优化员 / 修复员。

**每一轮必须派满三个子代理：测试员、学习优化员、监督修复员。三个都要全。** 缺一个角色不算这轮完成。建议：先派测试员 → 收回后再派学习优化员和监督修复员（fixer 必须看到 tester 报告）。

范围仅限本窗口清单。报告不要写成全局的 `1.2-roundN-*`。

参照（读思路，转发时同样加第二节的四行口令，并把分支改成 `game-1.2-window4`）：

- 测试员：`docs/plan-1.2-step27-A-tester.md` / `step28-A-tester.md` / `step29-A-tester.md`
- 学习优化员：`docs/plan-1.2-step27-B-learner.md` 等
- 监督修复员：`docs/plan-1.2-step27-C-fixer.md` 等

本窗口报告必须由对应子代理写成这 9 个文件：

```
docs/qa/1.2-window4-round1-tester.md
docs/qa/1.2-window4-round1-learner.md
docs/qa/1.2-window4-round1-fixer.md
docs/qa/1.2-window4-round2-tester.md
docs/qa/1.2-window4-round2-learner.md
docs/qa/1.2-window4-round2-fixer.md
docs/qa/1.2-window4-round3-tester.md
docs/qa/1.2-window4-round3-learner.md
docs/qa/1.2-window4-round3-fixer.md
```

### 第 1 轮（派 3 人）

- **测试员**：本窗口每一款都要从首页进入、玩到真实胜负（赢一次输一次）、有战役的试第 1 / 100 / 188 关；有对战/无尽/双人的每种模式玩到结算；360px 走一遍。点名项若落在本窗口，必须专项取证。
- **学习优化员**：至少 8 条可落地改进，并真正改代码落地至少 3 条（有测试）。
- **监督修复员**：阻断/严重全部修掉，商标扫描 0 命中，`destroy` 无泄漏，再全绿。

### 第 2 轮（再派 3 人，换样本）

换一批关卡/模式再玩。查难度曲线、竞态、教育正确性、无尽能否持续。三人组再走一轮。

### 第 3 轮（再派 3 人，本窗口收官）

清单一款不漏。遗留问题必须有最终结论。写清：能否把本窗口这一批提交进 `game-1.2`。

### 点名五项（谁的窗口谁派验，其他人跳过）

| 项 | 窗口 | 硬要求 |
| --- | --- | --- |
| `gomoku` | 2 | 解局关 + 菜鸟到地狱，固定 seed 相邻档对下 20 局强度单调 |
| `match-stars` | 2 | 消除→下落→补位三个可观察阶段，瞬变即阻断 |
| `rainbow-run` | 2 | 接住 1.1 的 `view3d.ts` / `controls.ts` / `endless.ts`，禁止推倒重来、禁止 three.js |
| `ocean-munch` | 2 | 无尽 + 纪录存档 |
| `xiangqi` | 2 | 只升级已有目录，多档 AI + 残局 |

窗口 1 额外必验：root 密码 `kangkang`、电话 `18438037080`、1 小时过期、可手动关、密码不落盘、直达第 N 关；家长算术门原样保留。

## 七、最后一步：检查没问题就提交进 `game-1.2`

三轮 9 份报告齐、测试构建全绿、商标扫描过、没有越界之后，**由你（窗口监督）提交进 `game-1.2`**，不要再等别人合，也不要自己回头改游戏。

1. 确认 `game-1.2-window4` 已 push，且 `npm test && npm run build` 全绿。
2. `git fetch origin game-1.2-window4 game-1.2`
3. 在 `game-1.2-window4` 上 merge `origin/game-1.2`。冲突先保本窗口独占文件，别人的目录听他们的。再全绿。
4. 把 `game-1.2-window4` 合进 `game-1.2` 并推送：

```
git checkout game-1.2
git pull origin game-1.2
git merge game-1.2-window4 --no-ff -m "merge: 窗口4 实现+本窗三轮验收"
git push origin game-1.2
```

5. 禁止 `--force`。禁止改 `main`。推 `game-1.2` 被拒就再 fetch+merge，不要强推。
6. 没过检不准合。合完才算窗口结束。

回复必须写：窗口号、实际派发用的模型 slug、每一格（A/B/C）子代理结果、9 份报告路径、最终 `origin/game-1.2` 的 SHA。**没有新指令，不要去改其他窗口的游戏，也不要开始全局第 27–29 步。**

