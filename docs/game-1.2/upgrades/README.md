# 一朵一星 1.2 · C 档全量游戏审查与精细化升级提示词

> 本目录是 1.2 **升级执行脚本**。只含提示词 Markdown，不含游戏实现。
> 派发方按 `step-30.md` → 最后一步 **严格顺序** 派发；每步同时 3 个云端子代理，**每代理只升级 1 款游戏**。
> 执行者禁止再套娃派生；全部推到 `game-1.2`，禁止 force，禁止改 main。

**id 以主管 catalog（`docs/game-1.2/00-catalog.md`）定稿为准。** 本目录写稿时该文件尚未合入，新 21 款使用**暂定 id**（见下表「暂定」列）。执行前必须对照 catalog：若 id 不同，只改目录名 / `meta.id` / 存档后缀，玩法规格不变。

---

## 一、怎么算步数（不要硬套 33）

```
游戏步数 = ceil(需要升级的游戏数 / 3)
总步数   = 游戏步数 + 冲突/串味/回归 1 步 + 验收三人组 2 轮
```

本轮清单：

| 来源 | 数量 | 依据 |
| --- | --- | --- |
| 现有游戏（假设 1.1 已做完） | **54** | `origin/game-1.1` 的 `src/games/*/meta.ts`（比 `origin/game-1.2` 多 `bumper-cars`） |
| 1.2 将新增 | **21** | 用户必含玩法 + 补齐缺口；象棋已有 `xiangqi`，只升级不新建 |
| **合计要升级** | **75** | |
| 游戏步 | **25** | `ceil(75/3)=25` → `step-30` … `step-54` |
| 冲突/串味/回归 | **1** | `step-55` |
| 验收三人组（测/学/修） | **2** | `step-56` 第 1 轮、`step-57` 第 2 轮 |
| **文档总数** | **28 步 + 本 README** | `step-30.md` … `step-57.md` |

编号从 **30** 起，是为了给 A 档平台步、B 档新游戏接入步让出 01–29。

---

## 二、现有 54 款（真实 id，来自 meta.ts）

`origin/game-1.2` 上 53 款；`origin/game-1.1` 另有 `bumper-cars`。升级时按 1.1 已合入处理。

### action 闯关（18）

`adventure-king` 冒险小王 · `bomb-buddies` 泡泡炸弹人 · `box-hamster` 推箱小仓鼠 · `brave-path` 勇者小路 · `candy-swing` 糖果秋千 · `fruit-slice` 水果切切乐 · `garden-guard` 花园守卫 · `gold-hook` 金矿钩钩 · `ice-fire-forest` 冰冰火火森林 · `monster-crisis` 小怪物危机 · `ocean-munch` 海底大胃王 · `poop-hero` 便便超人 · `prince-princess` 王子公主大冒险 · `rainbow-run` 彩虹跑跑 · `sky-squad` 飞机小队 · `sling-birds` 弹弹小鸟 · `sprout-defense` 绿芽保卫战 · `tank-battle` 铁皮坦克大战

### casual 休闲（16）

`alien-seek` 寻找外星朋友 · `balloon-pop` 气球砰砰 · `brick-break` 碰碰砖块 · `bubble-aim` 泡泡瞄准手 · `bubble-pop` 泡泡噗噗 · `fishing-star` 钓鱼小达人 · `fruit-catch` 接住小水果 · `kitty-care` 萌猫小屋 · `lianliankan` 连连看 · `match-stars` 星星消消乐 · `memory-cards` 记忆翻翻乐 · `mole-pop` 地鼠嘭嘭 · `puzzle-tiles` 拼图乐园 · `shoot-range` 星星射击场 · `snake-snack` 贪吃毛毛虫

### party 对战（13）

`bumper-cars` 碰碰车大乱斗 · `duo-arena` 朵星擂台 · `duo-rush` 朵星双人冲刺 · `duo-vs-star` 朵朵大战星星 · `fight-king` 朵星格斗王 · `gomoku` 五子棋 · `landlord-cards` 朵朵抢地主 · `puff-bros` 噗噗兄弟 · `red-blue-race` 红蓝赛跑 · `red-blue-tap` 红蓝点点 · `red-blue-tug` 红蓝拔河 · `snow-fight` 雪球大作战 · `xiangqi` 朵朵星星象棋

### edu 学习（6）

`clock-house` 时钟小屋 · `find-diff` 找不同 · `math-farm` 算数小农场 · `pinyin-train` 拼音小火车 · `shape-kingdom` 形状王国 · `word-garden` 识字小花园

### create 动手（2）

`color-fun` 涂色小屋 · `music-stars` 音乐星星

---

## 三、新 21 款（暂定 id · 升级稿写「第一版接入之后的精细化」）

必含玩法（象棋升级已有 `xiangqi`，不占 21 席）：

| 暂定 id | 中文名 | 对应必含 | 建议 category |
| --- | --- | --- | --- |
| `blob-io` | 球球吞吞 | 球球 IO | party |
| `noodle-io` | 长虫大作战 | 蛇蛇 IO | party |
| `block-drop` | 方块掉掉乐 | 方块 | casual |
| `clash-stars` | 星斗擂台 | 格斗（比 fight-king 深） | party |
| `mahjong-stars` | 朵星麻将 | 麻将 | party |
| `star-estate` | 星星庄园 | 大富翁 | party |
| `hero-cards` | 英雄卡牌会 | 三国杀（儿童化、无血） | party |
| `weiqi` | 星星围棋 | 围棋 | party |
| `flight-chess` | 飞行棋 | 飞行棋 | party |

补齐缺口（1.1 第 7 步曾点名保龄球但仓库里没有；其余填合集空白）：

| 暂定 id | 中文名 | 理由 |
| --- | --- | --- |
| `bowling-lane` | 保龄球小馆 | 1.1 派发过、未落地 |
| `jump-chess` | 跳跳棋 | 经典棋类空白 |
| `animal-chess` | 斗兽棋 | 低门槛策略棋 |
| `merge-stars` | 合合星 | 2048 类数字合成 |
| `sudoku-house` | 数独小屋 | 六年级逻辑 |
| `star-soccer` | 朵星足球 | 球类空白 |
| `star-hoops` | 朵星投篮 | 球类空白 |
| `billiard-stars` | 星星台球 | 物理瞄准空白 |
| `kart-dash` | 彩虹卡丁 | 2.5D 载具，接彩虹跑跑手感 |
| `merge-fruit` | 合成果果 | 物理合成空白 |
| `run-fast-cards` | 跑得快快 | 扑克出牌类（非赌） |
| `navy-grid` | 海战格子 | 猜点对战空白 |

---

## 四、步骤对照表

| 步 | 文件 | A | B | C |
| --- | --- | --- | --- | --- |
| 30 | `step-30.md` | `gomoku` 五子棋 | `match-stars` 星星消消乐 | `rainbow-run` 彩虹跑跑 |
| 31 | `step-31.md` | `ocean-munch` 海底大胃王 | `xiangqi` 象棋 | `fight-king` 朵星格斗王 |
| 32 | `step-32.md` | `blob-io` 球球吞吞 | `noodle-io` 长虫大作战 | `block-drop` 方块掉掉乐 |
| 33 | `step-33.md` | `clash-stars` 星斗擂台 | `mahjong-stars` 朵星麻将 | `star-estate` 星星庄园 |
| 34 | `step-34.md` | `hero-cards` 英雄卡牌会 | `weiqi` 星星围棋 | `flight-chess` 飞行棋 |
| 35 | `step-35.md` | `garden-guard` | `sprout-defense` | `fruit-slice` |
| 36 | `step-36.md` | `sling-birds` | `candy-swing` | `bubble-aim` |
| 37 | `step-37.md` | `duo-rush` | `duo-arena` | `duo-vs-star` |
| 38 | `step-38.md` | `landlord-cards` | `gold-hook` | `bumper-cars` |
| 39 | `step-39.md` | `ice-fire-forest` | `puff-bros` | `prince-princess` |
| 40 | `step-40.md` | `box-hamster` | `poop-hero` | `brave-path` |
| 41 | `step-41.md` | `adventure-king` | `alien-seek` | `bomb-buddies` |
| 42 | `step-42.md` | `monster-crisis` | `tank-battle` | `snow-fight` |
| 43 | `step-43.md` | `shoot-range` | `sky-squad` | `fishing-star` |
| 44 | `step-44.md` | `balloon-pop` | `brick-break` | `bubble-pop` |
| 45 | `step-45.md` | `fruit-catch` | `kitty-care` | `lianliankan` |
| 46 | `step-46.md` | `memory-cards` | `mole-pop` | `puzzle-tiles` |
| 47 | `step-47.md` | `snake-snack` | `clock-house` | `math-farm` |
| 48 | `step-48.md` | `shape-kingdom` | `find-diff` | `pinyin-train` |
| 49 | `step-49.md` | `word-garden` | `color-fun` | `music-stars` |
| 50 | `step-50.md` | `red-blue-race` | `red-blue-tap` | `red-blue-tug` |
| 51 | `step-51.md` | `bowling-lane` | `jump-chess` | `animal-chess` |
| 52 | `step-52.md` | `merge-stars` | `sudoku-house` | `star-soccer` |
| 53 | `step-53.md` | `star-hoops` | `billiard-stars` | `kart-dash` |
| 54 | `step-54.md` | `merge-fruit` | `run-fast-cards` | `navy-grid` |
| 55 | `step-55.md` | 存档 key / 全局 CSS / 快捷键 | BGM / root 跳关 API / 首页筛选 | destroy 泄漏 / 邻接串味 |
| 56 | `step-56.md` | 测试员 R1 | 学习优化员 R1 | 监督修复员 R1 |
| 57 | `step-57.md` | 测试员 R2 | 学习优化员 R2 | 监督修复员 R2 |

第 30–31 步是用户点名的现有深度升级；第 32–34、51–54 步是新 21 款「第一版之后的精细化」（假设 B 档接入步已把能玩的壳合进 `game-1.2`；若目录还不存在，执行者按 catalog 新建完整实现，规格仍以本步提示词为准，禁止只做壳）。

---

## 五、全局纪律（每段提示词都会再写一遍）

### 5.1 派发头（必须逐字出现在每段开头）

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

读到提示词的你就是执行者：**禁止再用 Task 派生云端子代理。** 模型 slug 只出现在提示词正文里，给以后的执行者。

### 5.2 分支

- `git fetch origin game-1.2` → 工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` → 普通 push。**禁止 force。**
- 不要改 main，不要用 `gh` 开/改/合 PR。

### 5.3 文件所有权

- 游戏步：只许碰 `src/games/<id>/` 与该游戏测试。公共框架（`src/games/level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`）**只读**。
- 冲突步 / 验收步：提示词里写清独占路径，互不相交。
- 不要碰 `docs/game-1.2/00-*.md`、`docs/game-1.2/new-games/`、`docs/game-1.2/step-01.md`。

### 5.4 跳关 / 解锁（游戏侧怎么接）

平台门（密码 `kangkang`、管理员 `18438037080`、1 小时自动关）由 **A 档平台步**实现。游戏侧只接 API，**禁止自己做密码框**。

约定（若 A 定稿字段名不同，跟 catalog / 平台契约走，语义不变）：

1. 壳层把「直接玩第 N 关」经 `GameAPI` 下发（建议字段 `initialLevel?: number`，**1 基**）或 hash `#/game/<id>?level=N`。
2. 走 `level99.ts` 的游戏：框架已有 `requestSkip`；本轮要保证 **mount 时若带了关号就直接 `startLevel(N-1)`**，不要先甩一张选关图挡住。
3. 自建战役地图的游戏（`rainbow-run` / `ocean-munch` / `garden-guard` / `sprout-defense` / `fruit-slice` / `sling-birds` / `candy-swing` / `bubble-aim` / `gomoku` 残局 / `fight-king` 格斗塔 / `xiangqi` 残局等）：必须导出或在 `mount` 内实现 `openCampaignLevel(n: number)`，越界 clamp 到 1..total。
4. 纯对战/无尽、没有关卡表的：`level` 映射到「人机档」或「残局序号」，并在回复里写明映射表。
5. 跳过写入仍走 `yiduo-yixing.l99skip.<id>`（0 基）；星级 key 不动。

### 5.5 2.5D / 3D 总原则

- **不要所有游戏都硬上 3D。** 禁止引入 three.js / 任何运行时依赖。
- 适合 2.5D：跑酷、卡丁、部分球类（透视场地）。
- 保持 2D：棋牌、三消、学习、IO 俯视、塔防。
- `rainbow-run`：若 1.1 第 6 步 2.5D 已合入，**在其基础上继续，不要推倒**。

### 5.6 法律、年龄、测试

- 面向孩子的文案与注释禁止商业商标 / 官方角色名。
- 约小学六年级，粉彩萌系，失败只鼓励。
- 无血无伤无死亡描写；便便题材保持干净可爱。
- 只增测试、不删、不调弱；`npm test` 与 `npm run build` 必须绿。
- 360px 窄屏不溢出，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。
- 可引用 GitHub 开源作**结构参考**，不引入运行时依赖、不带商标素材。

---

## 六、自检清单（写稿用）

- [x] 步号从 30 连续编到 57，无跳号
- [x] 每步一文档、每步 A/B/C 三段完整可复制提示词
- [x] 每代理 1 款游戏（55–57 为冲突/验收，仍三人）
- [x] 用户点名：gomoku / match-stars / rainbow-run / ocean-munch / xiangqi 写细
- [x] 新 21 款都有「第一版之后的精细化」
- [x] 派发头四句逐字
- [x] 独占路径仅本目录
