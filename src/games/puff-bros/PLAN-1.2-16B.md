# 1.2 第 16 步 · B 档 —— `puff-bros`「噗噗兄弟」升级计划

规格全文：`docs/plan-1.2-step16-B-puff-bros.md`。本文件是动代码之前的现状交底 + 施工清单，
只覆盖 `src/games/puff-bros/**` 与 `scripts/smoke-puff-bros.mjs`，别人的目录一个字不碰。
工作分支只有一条：`game-1.2-window3`。

## 一、开工前现状审查（规格第三节六问，逐条实答）

### 1. 跳跃手感常量在哪？有没有单测？

在 `logic.ts` 顶部：`GRAVITY = 1750`、`MOVE_SPEED = 195`、`JUMP_V = 690`、`AIR_CONTROL = 7`
（空中横向的跟随系数）、`MAX_SUBSTEP = 1/120`。派生量有纯函数 `jumpApex()` / `jumpRange()`，
`logic.test.ts` 的「几何红线」组断言了「起跳最高点 > 层高」「一次跳跨得过同层缝」。

缺的三样：

- **没有二段跳**。`applyActions()` 里起跳条件写死 `input.up && !p.prevUp && p.onGround`。
- **没有土狼时间**。走出台沿的下一帧 `onGround` 就是 false，那一下按跳直接吞掉。
- **没有跳跃缓冲**。落地前一两帧按的跳同样吞掉，孩子按早一点就得重按。

帧率无关只做了一半：`stepWorld()` 会把任意 dt 切成 ≤ `MAX_SUBSTEP` 的子步，已有「大 dt 切小步」
的用例，但**没有 30fps 与 60fps 位移对比的用例**。

### 2. 「噗」的推力机制怎么算的？有没有冷却？

现在的「噗」（`sub` 键）只有**一个**用途：`applyActions()` 里遍历泡泡，
`distToBox(b.x, b.y, playerBox(p)) <= BUBBLE_R + POP_RANGE` 就 `popBubble()`，冷却 `POP_CD = 0.18`。

- **推自己**：没有。
- **推别人**：没有。对手只能被泡泡「裹」住，不会被气流推开。
- **推箱子**：场上根本没有可推物件。

唯一沾边的两处「推」是间接的：竖直速度超过 `PUFF_VY = 260` 撞到咕噜怪会把它推开 `PUFF_PUSH = 26`；
`hurt()` 会给挨打的人一个 170/-240 的击退。都没有前摇，也没有各自的冷却。

### 3. `arena.ts` 的对战胜负条件是什么？五种模式是否都能玩到结算？

`buildVersusArena()` 给的是 `roundTarget = VERSUS_ROUND_TARGET = 3`、`timeLimit = VERSUS_ROUND_SECONDS = 75`。
`checkVersusGoal()`：先戳破对手 3 次赢下这一局；时间到按 pops 比大小，一样就 `roundWinner = -1` 平局。
外层 `MatchState` 是三局两胜（`ROUNDS_TO_WIN = 2`），一直平也不会没完没了（`MAX_ROUNDS = 5` 后按总分定）。

五模式（`meta.modes = campaign / versus / endless / coop / twoPlayer`）现状：

| 模式 | 入口 | 结算 |
| --- | --- | --- |
| campaign | 188 关地图 | 清空咕噜怪 → 三星；心用完 / 超时 → 失败 |
| coop / twoPlayer | 模式条上「闯关：一个人 / 两个人」那颗按钮来回切 | 同上，两人共用心 |
| versus | 「双人对战」「人机三档」 | 三局两胜 |
| endless | 「噗噗不停」波次制 | 心用完结算，`save.recordEndlessBest` 记分 |

**都玩得到结算**，声明不用删。但 coop 与 twoPlayer 共用一颗切换按钮，不是两个独立入口。

### 4. 188 关的机关种类有几种？后段是不是只是变长变窄？

**只有一种地形元素**：单向浮台 `PlatformDef`（能顶穿上去、能蹲跳穿下来）。
`buildLevel()` 的全部变量是：层数（章节配方里 2 或 3）、每层块数、浮台宽度、
怪物三种（walker / hopper / chaser）、怪物数量与速度、糖果数。

所以答案是：**是的，后段只是怪更多更快、浮台更密**。没有任何机关。

### 5. 掉落 / 出界后怎么处理？

**不存在出界**。场地四面是封死的：`WALL` 夹住 `p.x`，`CEILING_Y` 顶住头，`FLOOR_Y` 永远接住脚。
从浮台上掉下去只是落回地板，既没有惩罚也没有任何表现。

### 6. 双人 + 触屏是否互不抢占？

键位是两套：`KEY_MAP` 里鸭梨 `WASD + F/G`、康康 `↑←↓→ + L/K`；`keyToAction(code, playerCount, humanCount)`
在一个人玩时把两套都归 0 号，人机对战时方向键那套也归真人。触屏 `pb-pads` 按 `humans` 渲染 1 或 2 套，
每颗按钮的 `pointerdown / pointerup` 只写自己那一路 `inputs[player]`——**互不抢占，这条是过的**。

两个真问题：

- 两套并排时 `--k` 缩到 **36px**，360px 上热区不到 44px。
- `window` 上的 `pointerup` / `blur` 一律 `releaseAll()`，一个人抬手会把**另一个人**按着的键也清掉。

## 二、施工清单

| # | 项 | 落在哪 |
| --- | --- | --- |
| 1 | 手感常量化：重力 / 初速 / 二段跳 / 土狼 90ms / 缓冲 120ms / 空中控制系数，全部纯函数 | 新 `feel.ts` |
| 2 | 帧率无关：30fps 与 60fps 位移差 < 2% | `feel.ts` + `logic.ts` 定步长 |
| 3 | 推力系统：自我加速（空中一次）/ 推开对手 / 推动物件，各自冷却 + 前摇 | 新 `push.ts` |
| 4 | 五种机关：气流管 / 可推箱 / 脆弱地板（踩两次碎，先裂后碎）/ 弹簧云 / 传送泡 | 新 `gadgets.ts` |
| 5 | 出界两段式：先打转（还能自救一次）再出局 | 新 `bounds.ts` |
| 6 | 无尽「上升气流」：一路往上爬，掉出屏底结束，高度进 `recordEndlessBest` | 新 `updraft.ts` |
| 7 | 对战场镜像对称：出生点 / 浮台 / 道具刷新点 / 坑位全部关于中线对称，写断言 | `arena.ts` |
| 8 | 后 89 关摆机关（**前 99 关一格不动**，用指纹钉死） | `arena.ts` |
| 9 | 世界接线：手感 / 推力 / 机关 / 出界进 `stepWorld` | `logic.ts` |
| 10 | 画面：气流环 + `api.play("pop")`、被推形变、落地压扁回弹 8%、脆弱地板裂纹预警、背景视差 | `index.ts` |
| 11 | 360px：左右半屏各一套 3×2 控件（方向 + 跳 + 吹 + 噗），热区 ≥ 44px 不重叠；HUD 一行 ≥ 14px | `index.ts` CSS |
| 12 | 平台接线：`openCampaignLevel(n)` / `initialLevel` / `?level=`；直达关卡的 Skip 走 `requestSkip` | `index.ts` |
| 13 | CSS 前缀换成 `pfb-`；两套键位与全部监听 `destroy` 时归零 | `index.ts` |

## 三、几条自己给自己划的红线

- **既有 86 条用例一条都不删**，新增 ≥ 20 条。
- **前 99 关的关卡数据一格不许动**：新增字段一律给空数组，再用逐关指纹把它钉死。
- 188 关可解性、无尽波次可清、对战人机三档强弱排序这几组老用例是硬约束，
  机关的摆放必须绕开机器人的赶路通道（浮台中点、怪物巡逻带、出生角落）。
- 「噗噗」是气泡和空气，不是别的什么；无血无伤无死亡，失败只鼓励；不蹭任何商标。
- 不引入依赖。
