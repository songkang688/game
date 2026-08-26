# 1.2 主管文档 —— 一朵一星提示词重做（A 档）

> 你正在读的是 1.2 的**统筹主管文档**。本文件规定谁派、按什么顺序派、文件归谁、21 款施工 id、法律 / root / 筛选纪律、怎样才算过关。
>
> **旧目录 `docs/game-1.2/` 已作废。** 那一批是在 1.1 尚未更新完时写的，细节已经错了（步号跳到 10/30、id 对照互相打架、没接到更新后的 `parentAuth` / 188 关 / collection / 2.5D）。**不要再派 `docs/game-1.2/` 里的任何文件。** 以本目录 `docs/plan-1.2-*` 为准。旧文件先留着，**不要删大段**，避免和其他窗口冲突。
>
> 本档作者只写提示词 Markdown，**禁止实现任何游戏代码**，禁止再派生云端子代理去写代码。

目录：[`plan-1.2-index.md`](./plan-1.2-index.md) · 多人窗口登记：[`plan-1.2-tracker.md`](./plan-1.2-tracker.md) · 第 1 步三档：[`plan-1.2-step1-A-root-gate.md`](./plan-1.2-step1-A-root-gate.md) · [`plan-1.2-step1-B-platform-filter.md`](./plan-1.2-step1-B-platform-filter.md) · [`plan-1.2-step1-C-modes-view.md`](./plan-1.2-step1-C-modes-view.md)

---

## 〇、一句话

1.2 全部工作推到 **`game-1.2`**。不要改 `main`，不要 merge 进 `main`。每步同时派 3 个云端子代理（A / B / C），文件所有权互不相交。上一步三人的提交都在 `origin/game-1.2` 上、且 `npm test` / `npm run build` 全绿，才允许派下一步。

执行子代理的模型 slug **只写进提示词正文**：`claude-opus-5-thinking-high-fast`（不要带方括号）。主管 / 编排员自己 inherit 父模型，不要把自己的 Task 模型设成这个 slug。

---

## 一、主管职责（必须始终 3 个子进程在做）

主管（按本档派发的人，以及用户开的多个窗口）只做编排，不写游戏实现。

1. **任何时刻执行线上应有 3 个云端子代理在跑。** 单位是「一步的 A / B / C」，不是「一个窗口里串行打三个提示词」。派完一步的三人后，等三人全部推上 `origin/game-1.2` 并且测试构建全绿，再派下一步的三人。禁止跳步、禁止跨步并发、禁止一步只派 1 人或 2 人就接着往下走。
2. **派下一步之前先登记 tracker。** 打开 [`plan-1.2-tracker.md`](./plan-1.2-tracker.md)，确认该 `stepN-X` 状态是「空闲」（或「失败重做」），写上窗口 / 人名、开始时间、工作分支，把状态改成「已派」，子代理开工后再改「进行中」，推上 `game-1.2` 后改「已推」。
3. **多窗口先看 tracker 再派。** 用户可能同时开多个窗口。同一 `stepN-X` **不能派第二次**，除非该行已标记「失败重做」。漏派（某档一直空闲而另两档已推）由主管补派，不要让另一步的人去「顺手帮忙」。
4. **按步串行。** 完整顺序是 1 → 30，中间不要跳号。禁止把第 2 步和新游戏、第 9 步和升级、第 28 步和验收交叉着派。
5. **检查三人都推上了 `game-1.2`。** 每人收尾必须 `git fetch origin game-1.2` → `git rebase origin/game-1.2` → 重跑测试构建 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase，**禁止 `--force`**。
6. **`npm test` / `npm run build` 全绿才下一步。** 只许加测试，不许删测试、不许调低断言。基线以 `origin/game-1.1` @ `8867138` 合入 `game-1.2` 之后的实测为准（见第四节）。
7. **文件所有权冲突仲裁。** 两人改了同一路径：以「该步文档里写明的独占者」为准，另一方必须 revert 自己的越界 diff。公共契约文件（内容逐字相同）rebase 时会自动跳过，不算冲突。
8. **商标扫描。** 每步合入后至少 `rg` 一遍第八节黑名单。命中则打回，不准进入下一步。面向孩子的文案 / 注释禁止商标。
9. **不写游戏代码、不套娃。** 主管自己若被当成云端子代理，禁止再用 Task 派生执行者；派发方才用 Task。B 档从第 2 步写新游戏提示词，C 档从第 9 步写升级提示词 + 最后 3 步验收提示词。A 档（本档）只写主管三件套 + 第 1 步三档，**不要写 `docs/plan-1.2-step2-*` 及以后**。

---

## 二、派发方式

### 2.1 给派发方看的口令

每步对三个子代理各发一段。指定模型 slug：`claude-opus-5-thinking-high-fast`。工作必须落在 `game-1.2` 持续优化线上。

每段**执行**提示词的**开头必须逐字**是：

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

紧接着必须写清：

> 【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

### 2.2 收尾 rebase 口令（每步、每人）

```bash
git fetch origin game-1.2
git rebase origin/game-1.2        # 有冲突就解冲突，绝不 force
npm test && npm run build         # rebase 后必须重跑，必须全绿
git push origin HEAD:game-1.2     # 普通推送；被拒就再 fetch+rebase 重来
```

禁止：`git push --force`、`git push --force-with-lease`、改 `main`、merge 进 `main`、用 `gh` 开/改/合 PR（`gh` 只读，只用于查 CI 日志）。

### 2.3 开工 git 记录

每个执行子代理开工前：从 `origin/game-1.2` 拉工作分支 → **先提交一条「工作计划 / 基线」commit** → 再改代码。

### 2.4 文档形态（给 B / C 写提示词时抄）

- 一步三档 = **三个文件**，文件名：
  `docs/plan-1.2-step{N}-{A|B|C}-{短英文slug}.md`
  例如 `docs/plan-1.2-step1-A-root-gate.md`
- 步号从 **1 连续到 30**，中间不要跳号（不要再 01 然后 10 然后 30）。
- 标题形态仿 1.1：`# 1.2 第 N 步 · X 档工作计划 —— ...`
- 粒度仿 `docs/plan-1.1-step10-A-fight-king.md`：独占文件、验收、测试命令、不要做什么，写到可施工。
- 不要改 `docs/plan-1.1-*`。

---

## 三、1.1 基准（假设已经做完）

派第 1 步之前，执行侧必须能在 `origin/game-1.2` 上读到 **更新后的 1.1**。基准点：

| 项 | 值 |
| --- | --- |
| 1.1 完成点 | `origin/game-1.1` @ `8867138`（`8867138c62b8de030d160e8ac969a413b508e5b8`） |
| 介绍 | `docs(1.1): 聚合最终版介绍为 1.1.0——55 款/188 关` |
| 游戏数 | **55** 个 `src/games/*/meta.ts`（含 `bowling-lane`、`bumper-cars`、`xiangqi`、`fight-king`） |
| 战役框架 | `src/games/level99.ts`：`TOTAL_LEVELS = 188`，`LEGACY_TOTAL_LEVELS = 99` |
| 家长门 | `src/ui/parentAuth.ts`：`basic` / `high`，授权 **5 分钟内存**，不写 localStorage |
| 跳关 | 并存小数组 `yiduo-yixing.l99skip.<id>`；`loadSkips` / `markSkipped` / `furthestPlayable` |
| 攻略 | `src/ui/guide.ts` + 每款 `src/games/<id>/guide.ts` |
| 首页 | 分类页签 + 玩法芯片（闯关 / 对战 / 无尽 / 双人）+ 搜索 + 收藏，逻辑在 `homeFilters.ts` |
| 2.5D | `src/games/rainbow-run/view3d.ts` + `controls.ts`（土狼 90ms、缓冲 120ms）；`duo-rush` 已 2.5D 分屏 |
| 小屋 | `src/engine/collection.ts`，key `yiduo-yixing.collection.v1`，满级加成 ≤ +35% |
| 契约 | `src/ui/level188Contract.ts`：`mountGuide` / `requestSkip` |

当前 `origin/game-1.2` **落后 1.1 约 25 个提交**（缺 `bumper-cars`、缺 `rainbow-run/view3d.ts` 等）。**派第 1 步之前**，由执行方（或主管指定的一次单独合入，仍推 `game-1.2`、禁止 force）把 `origin/game-1.1` @ `8867138` rebase / merge 进 `game-1.2`，再跑绿 `npm test` && `npm run build`。这是 1.1 已完成库存，不是 1.2 新游戏。合入之后第 1 步三档才能对接真实的 `parentAuth` / 188 / collection / 2.5D，而不是再发明一套互相打架的门。

制作方法必须仿 1.1（逐份读再仿，不要抄过时的 `docs/game-1.2/`）：

- 派发总脚本：`docs/upgrade-prompts/11-game-1.1-dispatch-prompts.md`（15 步 × 每步 3 人；总则、独占文件、禁止套娃）
- 基线：`docs/upgrade-prompts/10-game-1.1-baseline.md`
- 一档一份文件：`docs/plan-1.1-step10-A-fight-king.md`、`docs/plan-1.1-step10-B-duo-vs-star.md`、`docs/plan-1.1-step10-C-shooting.md`、`docs/plan-1.1-step6-A-rainbow-run-2.5d.md` 等

---

## 四、已有 55 款真实 id（`origin/game-1.1` @ `8867138`）

分类含义见 `src/engine/types.ts`：`action=闯关 casual=休闲 party=对战 edu=学习 create=动手`。玩法芯片认 `meta.modes`：`campaign` / `versus` / `endless` / `coop` / `twoPlayer`。

| id | 标题 | category |
| --- | --- | --- |
| `adventure-king` | 冒险小王 | action |
| `alien-seek` | 寻找外星朋友 | casual |
| `balloon-pop` | 气球砰砰 | casual |
| `bomb-buddies` | 泡泡炸弹人 | action |
| `bowling-lane` | 保龄球小馆 | casual |
| `box-hamster` | 推箱小仓鼠 | action |
| `brave-path` | 勇者小路 | action |
| `brick-break` | 碰碰砖块 | casual |
| `bubble-aim` | 泡泡瞄准手 | casual |
| `bubble-pop` | 泡泡噗噗 | casual |
| `bumper-cars` | 碰碰车大乱斗 | party |
| `candy-swing` | 糖果秋千 | action |
| `clock-house` | 时钟小屋 | edu |
| `color-fun` | 涂色小屋 | create |
| `duo-arena` | 朵星擂台 | party |
| `duo-rush` | 朵星双人冲刺 | party |
| `duo-vs-star` | 朵朵大战星星 | party |
| `fight-king` | 朵星格斗王 | party |
| `find-diff` | 找不同 | edu |
| `fishing-star` | 钓鱼小达人 | casual |
| `fruit-catch` | 接住小水果 | casual |
| `fruit-slice` | 水果切切乐 | action |
| `garden-guard` | 花园守卫 | action |
| `gold-hook` | 金矿钩钩 | action |
| `gomoku` | 五子棋 | party |
| `ice-fire-forest` | 冰冰火火森林 | action |
| `kitty-care` | 萌猫小屋 | casual |
| `landlord-cards` | 朵朵抢地主 | party |
| `lianliankan` | 连连看 | casual |
| `match-stars` | 星星消消乐 | casual |
| `math-farm` | 算数小农场 | edu |
| `memory-cards` | 记忆翻翻乐 | casual |
| `mole-pop` | 地鼠嘭嘭 | casual |
| `monster-crisis` | 小怪物危机 | action |
| `music-stars` | 音乐星星 | create |
| `ocean-munch` | 海底大胃王 | action |
| `pinyin-train` | 拼音小火车 | edu |
| `poop-hero` | 便便超人 | action |
| `prince-princess` | 王子公主大冒险 | action |
| `puff-bros` | 噗噗兄弟 | party |
| `puzzle-tiles` | 拼图乐园 | casual |
| `rainbow-run` | 彩虹跑跑 | action |
| `red-blue-race` | 红蓝赛跑 | party |
| `red-blue-tap` | 红蓝点点 | party |
| `red-blue-tug` | 红蓝拔河 | party |
| `shape-kingdom` | 形状王国 | edu |
| `shoot-range` | 星星射击场 | casual |
| `sky-squad` | 飞机小队 | action |
| `sling-birds` | 弹弹小鸟 | action |
| `snake-snack` | 贪吃毛毛虫 | casual |
| `snow-fight` | 雪球大作战 | party |
| `sprout-defense` | 绿芽保卫战 | action |
| `tank-battle` | 铁皮坦克大战 | action |
| `word-garden` | 识字小花园 | edu |
| `xiangqi` | 朵朵星星象棋 | party |

**象棋只升级已有 `xiangqi`，1.2 不许新建第二个象棋 id。**

`ocean-munch` 是「大鱼吃小鱼」战役，**不是**球球 IO。`snake-snack` 是关卡制毛毛虫，**不是**蛇蛇 IO。`fight-king` 已有 2D 格斗塔，1.2 要更深的格斗必须用**新 id**。

---

## 五、21 款新游戏施工 id（B 必须逐字抄）

主管定稿。B 写第 2–8 步提示词时 **id / 中文标题 / 禁止撞车的旧 id** 必须与下表一致，不许自行改名。面向孩子的文案和注释禁止商标（研究玩法可以，结论只许体现为结构）。

| # | 施工 id | 中文标题 | 玩法（内部研究口径，文案禁用右列商标） | 避开 |
| --- | --- | --- | --- | --- |
| 1 | `orb-tide` | 球球潮汐 | IO 圆球吞噬 / 分裂 / 刺球，仿腾讯系球球 IO 手感 | 不是 `ocean-munch` |
| 2 | `coil-tide` | 彩带贪吃潮 | IO 细长体吃点变长、绕杀，仿腾讯系蛇蛇 IO 手感 | 不是 `snake-snack` |
| 3 | `block-town` | 方块小镇 | 沙盒方块建造 + 轻冒险（迷你沙盒，不是推倒 `puzzle-tiles`） | — |
| 4 | `combo-dojo` | 连段武馆 | 比 `fight-king` 更深的帧对打：取消表、连段练习器、角色差异更大 | 新 id，不改 `fight-king` |
| 5 | `mahjong-stars` | 麻将小屋 | 国标基础番型 + 188 关牌谱 + 人机三档 | 禁「欢乐麻将」等商标 |
| 6 | `fortune-walk` | 富路棋 | 掷骰买地盖楼收过路费的派对棋 | 禁「大富翁」「地产大亨」 |
| 7 | `camp-cards` | 阵营卡牌 | 身份 / 锦囊 / 武器 / 距离的三国杀结构 | 禁「三国杀」「英雄杀」 |
| 8 | `go-garden` | 围围小园 | 19/13/9 路围棋 + 死活题 188 道 | 不是 `gomoku` |
| 9 | `aero-chess` | 飞行棋派对 | 四人飞行棋，可人机可同屏 | — |
| 10 | `cube-drop` | 方块掉落 | 七种方块下落消行（经典方块，原创名） | 禁「俄罗斯方块」 |
| 11 | `bean-dash` | 圆豆冲冲 | 软体障碍赛跑、关卡淘汰（派对跑） | 禁「蛋仔派对」 |
| 12 | `kart-stars` | 朵星卡丁 | 俯视/3/4 视角卡丁竞速、漂移、道具 | 禁「跑跑卡丁车」；不是 `bumper-cars` |
| 13 | `merge-melon` | 合成大果 | 同级果碰撞合成，无尽 + 闯关目标 | 禁「合成大西瓜」 |
| 14 | `pixel-roam` | 像素巡游 | 房间清怪 + 武器合成的地牢巡游 | 禁「元气骑士」 |
| 15 | `tiny-diner` | 忙乱小食堂 | 双人同屏做菜上菜，合作闯关 | — |
| 16 | `glow-soar` | 暖光同游 | 双人飞行收集光点、不战斗 | 禁「光遇」 |
| 17 | `auto-minis` | 小兵自走棋 | 自走棋：站位、羁绊、升星 | 禁「金铲铲」「云顶之弈」 |
| 18 | `lane-clash` | 双路争冠 | 双路出兵 + 塔 + 手牌周期 | 禁「皇室战争」 |
| 19 | `sudoku-garden` | 数独小园 | 数独 188 题， uniquely 可解 | — |
| 20 | `world-chess` | 国际象棋 | 人机三档 + 残局 188 道 | 不是 `xiangqi` / `gomoku` |
| 21 | `beat-tiles` | 音跃方块 | 下落音块点按，内置合成音无外链 | 禁「钢琴块」 |

覆盖了用户点名的：球球 IO、蛇蛇 IO、方块（沙盒 `block-town` + 下落 `cube-drop`）、更深格斗、麻将、大富翁结构、三国杀类、围棋、飞行棋。其余名额按 2026 休闲 / 儿童向热门结构补，全部避开已有 55 个 id。

---

## 六、步数总表（1..30，连续不跳号）

合计 **30 步**，不是 33，也不是上一波的 36。1 + 7×新游戏 + 19×升级/收口 + 3×验收。

### 6.1 第 1 步 · 平台（本档已写完提示词）

| 档 | 主题 | 提示词 | 独占路径（摘要） |
| --- | --- | --- | --- |
| A | root 高权限门 | [`plan-1.2-step1-A-root-gate.md`](./plan-1.2-step1-A-root-gate.md) | `src/ui/rootGate.ts`、`src/ui/rootGate.test.ts`、`src/games/level99.ts`、`src/games/level99.test.ts`、`src/ui/level188Contract.ts`、`src/ui/gameShell.ts`、`src/ui/parentGate.ts` |
| B | 首页手游/端游筛选 + 手机文字 | [`plan-1.2-step1-B-platform-filter.md`](./plan-1.2-step1-B-platform-filter.md) | `src/engine/types.ts`、`src/ui/home.ts`、`src/ui/homeFilters.ts`、`src/ui/homeFilters.test.ts`、`src/styles.css`、`src/ui/contrast.ts`、已有 55 款 `meta.ts` 的 `platform` 字段 |
| C | 闯关/对战/无尽契约 + 2.5D 共享基建 | [`plan-1.2-step1-C-modes-view.md`](./plan-1.2-step1-C-modes-view.md) | `src/engine/lane25d.ts`、`src/engine/lane25d.test.ts`、`src/engine/runFeel.ts`、`src/engine/runFeel.test.ts`、`src/ui/playModes.ts`、`src/ui/playModes.test.ts` |

### 6.2 第 2–8 步 · 21 款新游戏（B 写 21 个文件）

每步 A / B / C 各 1 款。新游戏统一约定抄 1.1 第 7 步：`meta.ts` 纯数据、`index.ts` 懒加载、`logic`/`levels` 纯函数、每款 ≥ 15 用例、闯关走 `level99` 做满 188 / ≥8 章、不改 `home.ts`（第 1 步 B 已把首页 glob 与筛选做好，新游戏填好 `meta.platform` / `meta.modes` 即可被收集）、`destroy` 清干净、只用内置音效、双人键位统一、无外部依赖。

| 步 | A | B | C | B 将写入的文件 |
| --- | --- | --- | --- | --- |
| 2 | `orb-tide` 球球潮汐 | `coil-tide` 彩带贪吃潮 | `block-town` 方块小镇 | `docs/plan-1.2-step2-A-orb-tide.md` 等三份 |
| 3 | `combo-dojo` 连段武馆 | `mahjong-stars` 麻将小屋 | `fortune-walk` 富路棋 | `docs/plan-1.2-step3-A-combo-dojo.md` 等 |
| 4 | `camp-cards` 阵营卡牌 | `go-garden` 围围小园 | `aero-chess` 飞行棋派对 | `docs/plan-1.2-step4-A-camp-cards.md` 等 |
| 5 | `cube-drop` 方块掉落 | `bean-dash` 圆豆冲冲 | `kart-stars` 朵星卡丁 | `docs/plan-1.2-step5-A-cube-drop.md` 等 |
| 6 | `merge-melon` 合成大果 | `pixel-roam` 像素巡游 | `tiny-diner` 忙乱小食堂 | `docs/plan-1.2-step6-A-merge-melon.md` 等 |
| 7 | `glow-soar` 暖光同游 | `auto-minis` 小兵自走棋 | `lane-clash` 双路争冠 | `docs/plan-1.2-step7-A-glow-soar.md` 等 |
| 8 | `sudoku-garden` 数独小园 | `world-chess` 国际象棋 | `beat-tiles` 音跃方块 | `docs/plan-1.2-step8-A-sudoku-garden.md` 等 |

IO 两款（第 2 步 A/B）必须是**真 IO**：程序化圆形场地、多人 AI 同场、体积/长度成长、无尽为主、可选「挑战赛」闯关；禁止做成 `ocean-munch` 或 `snake-snack` 的换皮。`combo-dojo` 必须在帧数据 / 取消表 / 连段练习器上明显深于已有 `fight-king`，并且**新建目录**。

### 6.3 第 9–27 步 · 全量升级（C 写；每档 1 款游戏）

55 款已有游戏全部升级。步号连续。第 9–26 步 = 54 款（每步 3 档 × 1 款）。第 27 步 A = 最后 1 款 `snow-fight`；B / C = 升级收口（不是新游戏，也不抢第 1 步的平台文件——只做 76 款规模下的校对）。

升级最低口径（C 写进每一份提示词，可按游戏加码，不许减码）：

- 前 188 关（或该游戏现有关卡表）**一个字都不许为了「重做」而打乱**；只许在末尾追加或在不改 seed 的前提下加深机制。没有 188 的纯对战款（如 `xiangqi`、`duo-arena`）升级 AI / 模式 / 2.5D 复用 / 攻略，不伪造关卡表。
- `xiangqi` **只升级已有目录**，加残局塔或无尽让子等，仍用 id `xiangqi`。
- 能接第 1 步 C 的 `lane25d` / `playModes` 的（跑酷、卡丁、IO 俯视）就接，不许每款再造一套透视相机。
- 能接 `collection.collectionEffects()` 的就接，满级加成仍 ≤ +35%。
- 文案六年级化、攻略补章节、`meta.platform` / `meta.modes` 据实填（第 1 步 B 已加字段；升级时按真实实现校对）。
- 只增测试不删测试。

| 步 | A | B | C |
| --- | --- | --- | --- |
| 9 | `garden-guard` | `ocean-munch` | `sprout-defense` |
| 10 | `rainbow-run` | `fruit-slice` | `candy-swing` |
| 11 | `sling-birds` | `bubble-aim` | `gomoku` |
| 12 | `balloon-pop` | `brick-break` | `bubble-pop` |
| 13 | `fruit-catch` | `kitty-care` | `lianliankan` |
| 14 | `match-stars` | `memory-cards` | `mole-pop` |
| 15 | `puzzle-tiles` | `snake-snack` | **`xiangqi`**（只升级） |
| 16 | `clock-house` | `math-farm` | `shape-kingdom` |
| 17 | `find-diff` | `pinyin-train` | `word-garden` |
| 18 | `color-fun` | `music-stars` | `duo-arena` |
| 19 | `duo-rush` | `red-blue-race` | `red-blue-tap` |
| 20 | `red-blue-tug` | `landlord-cards` | `gold-hook` |
| 21 | `fishing-star` | `bumper-cars` | `bowling-lane` |
| 22 | `ice-fire-forest` | `puff-bros` | `prince-princess` |
| 23 | `box-hamster` | `poop-hero` | `brave-path` |
| 24 | `adventure-king` | `alien-seek` | `fight-king` |
| 25 | `duo-vs-star` | `shoot-range` | `sky-squad` |
| 26 | `monster-crisis` | `bomb-buddies` | `tank-battle` |
| 27 | `snow-fight` | 升级收口：76 款 `meta.platform` / 拼音表 / 筛选实测 | 升级收口：`copy.test.ts` 黑名单扩到 1.2 新玩法词 + 漏网 `guide.ts` |

第 27 步 B 独占：`src/ui/homeFilters.ts` 的拼音补字、`PINYIN_INITIALS` / `INITIALS_ALIASES`；可扫全部 `meta.ts` 把漏填的 `platform` 补上（第 9–26 步已结束，不再与单款升级抢活）。**不要改第 1 步 A 的 root 门，不要改 `lane25d.ts`。**

第 27 步 C 独占：`src/games/copy.test.ts` 及漏网 `src/games/*/guide.ts`（只补空 / 只改字符串）。**不要改玩法逻辑。**

C 将写入的文件名规范：`docs/plan-1.2-step{N}-{A|B|C}-{id}.md`，第 27 步 B/C 用 `docs/plan-1.2-step27-B-meta-audit.md`、`docs/plan-1.2-step27-C-copy-audit.md`。

### 6.4 第 28–30 步 · 三角色验证（C 写，仿 1.1 第 13–15 步）

每步仍是 3 人并行，角色固定：

| 档 | 角色 | 报告路径（每轮换 round 号） |
| --- | --- | --- |
| A | 测试员 | `docs/qa/1.2-round{1\|2\|3}-tester.md` |
| B | 学习优化员 | `docs/qa/1.2-round{1\|2\|3}-learner.md` |
| C | 监督修复员 | `docs/qa/1.2-round{1\|2\|3}-fixer.md` |

| 步 | 轮 | C 将写入 |
| --- | --- | --- |
| 28 | 第 1 轮 | `docs/plan-1.2-step28-A-tester.md`、`step28-B-learner.md`、`step28-C-fixer.md` |
| 29 | 第 2 轮 | `docs/plan-1.2-step29-A-tester.md` 等 |
| 30 | 第 3 轮（收官） | `docs/plan-1.2-step30-A-tester.md` 等 |

口径对齐 1.1 第 13–15 步：测试员只写报告 + 补 `*.test.ts`；学习优化员找外部优点并落地小 diff；监督修复员按严重度修、先红后绿、三方合并态复验。第 30 步结束时 1.2 必须「随时可发布」：76 款每款都至少被走查一次，阻断 / 严重 / 一般清零。

---

## 七、法律 / root / 筛选纪律

### 7.1 法律红线（违反即打回）

面向孩子的任何可见文案（`title` / `blurb` / 章节名 / 角色名 / 提示语 / 攻略）以及**代码注释**，禁止出现商业商标或官方角色名。内部可以研究原作玩法（自己玩、非商业发行），结论只许体现为结构。

角色只用本作原创：朵朵、星星、糯糯、云云、墩墩、闪闪、绿绿豆、啾啾，以及 1.1 已用的泡泡、团团、麦麦、灯灯、凛凛、焰焰等。

1.1 已有巡检：`src/games/copy.test.ts` 的 `BRAND_WORDS`。1.2 至少再补（第 27 步 C / 验收时落地，提示词里先写进黑名单口径）：

`球球大作战`、`贪吃蛇大作战`、`迷你世界`、`我的世界`、`俄罗斯方块`、`地铁跑酷`、`神庙逃亡`、`跑跑卡丁车`、`蛋仔派对`、`元气骑士`、`光遇`、`金铲铲`、`云顶之弈`、`皇室战争`、`部落冲突`、`三国杀`、`英雄杀`、`欢乐麻将`、`大富翁`、`地产大亨`、`合成大西瓜`、`钢琴块`、`跳一跳`、`拳皇`、`街头霸王`、`森林冰火人`、`超级玛丽`、`超级马里奥`、`植物大战僵尸`、`愤怒的小鸟`、`水果忍者`、`割绳子`、`吃豆人`

### 7.2 root 门纪律（第 1 步 A，后续各步只读）

- 密码默认 `kangkang`。**界面上不许展示这个密码**，孩子看见的是「打开请联系管理员 18438037080」。
- 可关；**一小时默认关**（内存会话，TTL 3600_000 ms，刷新页面也关）。
- 打开后：任意跳关、直达第 N 关。
- **必须对接 1.1 已有的 `parentAuth` / `level99` skip**，不要再发明一套 `l99skip` 之外的门。root 打开时 `requestSkip` 直接放行；root 关闭时仍走 `requestParentAuth("high")`。直达第 N 关只 `markSkipped` 前面未通关的关，**不许写假星星**。
- 入口放在家长面板里（先过 `basic` 档），不要做首页常驻大按钮。

### 7.3 筛选纪律（第 1 步 B）

- 在 1.1 已有分类页签 + 玩法芯片之上**加**「手游 / 端游」，不要推倒。
- `meta.platform` 缺省视为 `both`，老卡片不会被筛没。
- 手机文字：360px 宽、正文 ≥ 16px、对比度 ≥ 4.5:1、安全区 `env(safe-area-inset-*)`。沿用 `src/ui/contrast.ts` 的 AA 断言，只增不减。

### 7.4 模式 / 2.5D 纪律（第 1 步 C）

- 先读 1.1 第 6 步已落地的 `rainbow-run/view3d.ts`、`rainbow-run/controls.ts`、`duo-rush`、`src/engine/collection.ts`。
- 共享基建建成**新文件**，本步不要改 `rainbow-run/` / `duo-rush/` / `collection.ts`（这些游戏的切换放到第 10 / 19 步升级）。新游戏从第 2 步起直接 import 共享模块。
- 不许引入 three.js 或任何运行时依赖。

### 7.5 存档 key（只增不改）

| key | 含义 |
| --- | --- |
| `yiduo-yixing.save.v1` | 钱包与最好成绩 |
| `yiduo-yixing.l99.<id>` | 每关星级（99→188 后面补 0） |
| `yiduo-yixing.l99skip.<id>` | 家长 / root 跳关标记 |
| `yiduo-yixing.collection.v1` | 小屋收藏 |
| `yiduo-yixing.fav.v1` | 首页心形收藏 |

root 会话、密码、授权状态**一律不写 localStorage**。

### 7.6 双人键位（全体新游戏 / 升级双人模式）

- 朵朵 = `W A S D` + `F`（动作）+ `G`（副动作）
- 星星 = `↑ ← ↓ →` + `L`（动作）+ `K`（副动作）
- `Esc` 暂停
- 手机必须有等价触屏（这是 PWA，不能只支持键盘）

### 7.7 分级

无血、无伤、无死亡描写。被击中只有星星飞溅、眩晕、弹开、冒烟迫降、变花。便便题材必须干净可爱。失败文案只鼓励不批评。

---

## 八、全局技术约定（执行提示词共享）

1. 游戏模块：`src/games/<id>/meta.ts` 纯数据（首页 eager glob）+ `index.ts` 顶部 `export { meta } from "./meta"` + `mount(api): { destroy }` 懒加载。
2. 音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。
3. 不引入外部运行时依赖；无广告、无内购、无账号、无联网上报。
4. 不把 `dist/`、`release/`、安装包、APK、大图或视频提交进 git。
5. 年龄定位约小学六年级：不要「宝宝」「乖乖」「小笨蛋」和肉麻叠词，保持中文粉彩萌系。
6. 每款游戏都要能回答：能闯关吗？能对战吗？能无尽吗？（不适用的写明理由，并在 `meta.modes` 据实填写。）

---

## 九、收口清单（主管在派下一步 / 1.2 收官时勾）

- [ ] `origin/game-1.2` 已包含 `origin/game-1.1` @ `8867138`（55 款齐，含 `bumper-cars` / `view3d.ts`）
- [ ] tracker 上第 1 步 A/B/C 均为「已推」，`npm test` / `npm run build` 绿
- [ ] 第 2–8 步 21 个目录均存在且 id 与第五节一字不差
- [ ] 第 9–27 步 55 款升级均已推；第 27 步收口完成
- [ ] 第 28–30 步三轮 QA 报告齐，阻断 / 严重 / 一般为 0
- [ ] 全库 `rg` 第八节商标黑名单 0 命中（含注释）
- [ ] 存档 key 语义未改；root 会话未落盘
- [ ] 首页手游/端游筛选与 360px 手机文字仍可用
- [ ] 主 chunk 仍按游戏拆包；gzip 主包保持可接受（1.1 口径主 chunk gzip 不超过 60 kB 量级，1.2 只许小幅涨）
- [ ] 没有人改 `main`，没有 force push
- [ ] `docs/game-1.2/` 仍在（作废但未删），人类只从 `docs/plan-1.2-index.md` 进入

---

## 十、本档作者不要做的事

- ❌ 不要实现游戏、不要改 `src/**` 玩法代码（本档只提交 `docs/plan-1.2-supervisor.md` / `tracker.md` / `index.md` / `step1-A|B|C-*.md`）
- ❌ 不要写 `docs/plan-1.2-step2-*` 及以后（那是 B / C 的活）
- ❌ 不要改 `docs/plan-1.1-*`
- ❌ 不要删大段 `docs/game-1.2/`
- ❌ 不要把自己的 Task 模型设成 `claude-opus-5-thinking-high-fast`；那个 slug 只写进提示词正文给以后的执行者
- ❌ 不要再派生云端子代理去写代码
