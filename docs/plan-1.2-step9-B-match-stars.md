# 1.2 第 9 步 · B 档 —— `match-stars`「星星消消乐」必须有下落过程

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2`，不要改 `main`，不要 force。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.2 第 9 步（共 29 步）· B 档**：升级已有游戏 `match-stars`「星星消消乐」。
本步同时开工：A `gomoku`、C `rainbow-run`。别人的目录你一个字都不许碰。

## 一、分支纪律

- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- **动代码之前先提交一条「B 档 + 消消乐升级计划」的 commit**。
- 只在 `game-1.2` 线上干活：不改 `main`、不 merge 回 `main`、不用 `gh` 开 / 改 / 合 PR。
- 收尾：fetch → `git rebase origin/game-1.2` → `npm test` 与 `npm run build` 全绿 → `git push origin HEAD:game-1.2`。**禁止 force / force-with-lease。**

## 二、开工前必须认的基线

- `origin/game-1.1` 收尾后是 **55 款**。若 `game-1.2` 上本款落后于 `origin/game-1.1`，先对齐再升级，**续写、不推翻**。
- 复用 1.1 已有能力，别重造：188 关框架 `src/games/level99.ts`（星级 key `yiduo-yixing.l99.<id>`、跳关 key `yiduo-yixing.l99skip.<id>`）；收藏册 `src/engine/collection.ts` 只读；家长门 `src/ui/parentAuth.ts`；无尽成绩走 `save.recordEndlessBest(id, score)`。
- 平台契约（`meta.platform`、root 跳关、直开第 N 关）由第 1 步平台档交付；没合进来就 `import(...).catch(() => null)` 兜底。
- 本款在 1.1 的事实：`category: "casual"`、`modes: ["campaign"]`、`levels: 188`（11 章）；目录 `engine.ts` `levels.ts` `index.ts` `meta.ts` `guide.ts` + 测试。
- **不引入任何运行时依赖**（无 Cocos / Godot / 动画库 / three.js）。

## 三、现状审查（先读代码，回复里逐条回答）

通读 `src/games/match-stars/{engine.ts,levels.ts,index.ts,meta.ts,guide.ts,*.test.ts}`。已知硬伤：

1. **消除是瞬变——这是本步第一优先级。** `engine.ts` 里 `clearCells` → `applyGravity` 直接改 `grid[]`，`index.ts` 等一小段 `boomSet` 高亮之后**整盘重绘**。方块没有「从旧格滑到新格」的位移，新块也不是从棋盘顶外掉进来的。用户点名：**消除 → 重力下落 → 顶部补块，必须有可见的时间线，禁止瞬移补位。**
2. 纯函数拆得不错（`findMatches` / `clearCells` / `applyGravity` / `runBelts` / `resolveAll` / `legalSwaps` / `playSwap` / `simulateLevel`），但**只有「状态 A 直接变状态 B」，没有「A→B 的移动清单」**。要新增只算动画计划、不改规则的纯函数。
3. 交换失败没有「换过去再换回来」的回弹，非法交换只是不动。
4. 传送带 `shiftBelt` / `runBelts` 也是整行瞬移。
5. `modes` 只有 `campaign`：没有对战、没有无尽。
6. 360px 上 8×8 棋盘 + 目标条 + 步数会挤，目标徽章换行后最底行要滚动才点得到。

## 四、通行体验：三消标准时间线（顺序不可跳，时长可调）

1. **输入**：点选相邻两格 → 交换动画 120–160ms → 检测匹配。
2. 无匹配 → **回弹动画**（同时长）→ 解锁输入。
3. 有匹配 → 匹配格爆开（缩放 + 淡出 180–220ms，计步）→ 进入 `busy`，不接受输入。
4. **重力**：每列独立算落点，**从旧像素坐标 tween 到新坐标**（每格 60–80ms，同列错开 20ms 出「瀑布感」）。禁止用重排 / `innerHTML` 冒充下落。
5. **补块**：新块在棋盘顶外生成再落入空位；逻辑上先算重力再算补块，表现可重叠。
6. **连锁**：落地稳定后再检测；有匹配回到第 3 步，连锁不耗步，直到稳定。
7. 稳定后才结算传送带 / 订单 / 胜负；传送带同样滑移，不许瞬跳。

`prefers-reduced-motion`：每段时长压到 1 帧（16–32ms），**仍走同一状态机**——不许另写一条「逻辑瞬变」分支，否则 bug 只在动画模式出现。

### 必须新增的纯函数（名字可换，语义不许换）

```
planGravity(before: number[], after: number[], cols: number): FallTween[]   // 每个存活块的 from/to 行
planRefill(after: number[], cols: number): SpawnTween[]                     // 新块从 -1、-2 行落入
```

`FallTween` 至少含 `{ cell, fromRow, toRow, col, delayMs, durMs }`。这两个函数**不改规则、不吃随机**，可以单独单测。

## 五、模式矩阵

| 模式 | 做不做 | 规格 |
| --- | --- | --- |
| 闯关 188 | 保留 | **不许改前 99 关的生成参数与 seed**（老存档的关卡不能变样）。后段可加新机制「下落被挡板拦住，要先消挡板」——是新机制，不是把数值调大。 |
| 对战 | **做** | 双人清订单：左右各 6×6（窄屏改上下），先完成 3 张订单者胜。人机三档：随机合法滑 / 会看一步连锁 / 会囤 4 连。 |
| 无尽 | **做** | 订单队列无限，每清 1 张 +1 步；难度来自「订单更苛刻」，不是倒计时恐慌。最高分 `save.recordEndlessBest("match-stars", n)`。 |
| 双人同屏 | 随对战一起 | 朵朵 `WASD + F`、星星 方向键 `+ L`；手机上下半屏各自触控。 |

特殊块：4 连直线火箭、5 连彩虹（已有则保留）、L/T 炸弹（没有就补一个）。**引爆也必须走同一条时间线**，不许瞬间清盘。

## 六、2.5D / 3D 决策

**保持 2D 正交格子。** 伪 3D 透视会让相邻交换对不齐、手指点不准。允许的立体感只有：棋子轻微高光 + 落地时 1 次压扁回弹（8% 形变，reduced-motion 下取消）。

## 七、视觉 · 建模 · 手感

- 棋子继续用手绘感 Canvas / emoji 矢量，不外链图片。
- 落地要有「咚」的错峰节奏（同列 20ms 错开），连锁 ≥ 3 时轻屏震（reduced-motion 关闭）。
- 冰块 / 藤蔓 / 糖霜叠层后，底下图案仍要能认出来：**不能只靠颜色区分，保留形状差异**。
- 订单完成、Boss 吼叫都排在「稳定之后」，不许打断下落。

## 八、手机 360px

- 棋盘优先占宽；目标条改成可横滑的一行芯片，最多一行；步数字号 ≥ 16px。
- **最底行不用滚动就能点到**，触控热区 ≥ 44px。

## 九、平台接线

- 本款走 `mountLevelGame`：确认 skip 按钮授权成功后确实解锁下一关；壳层给 `initialLevel` 时**直接开打那一关**，不要卡在章节封面。
- 不要自己做密码框，root 门是平台档的事。
- `meta.platform` 填 `"mobile"`（触屏最顺，桌面也能玩就填 `"both"`，按你实测填，别照抄）；`meta.blurb` 与事实对齐（模式补齐后要写上对战 / 无尽）。

## 十、独占文件与冲突

只许改 `src/games/match-stars/**`。不要改 `src/games/level99.ts`，不要碰 `gomoku`、`rainbow-run`。
CSS 类名与动画名一律 `mst-` 前缀；`Esc` 只交给壳层暂停；不要往 `yiduo-yixing.save.v1` 里塞新语义字段。

## 十一、测试（新增 ≥ 25 个用例）

`planGravity` 每列落点正确、`planRefill` 补块数量正确、连锁不耗步、非法交换回弹、**reduced-motion 下走同一状态机且终态一致**、对战胜负、无尽计分、旧关卡 seed 未变（用现有 `simulateLevel` 回归几关）。

**验收铁则**：写一个虚拟时钟 / DOM 测试证明——消除后、重力完成前，方块的**视觉坐标与逻辑坐标不同**。存在「一次 render 直达终态」的路径就算没做完。

## 十二、分级红线

失败只鼓励；无血无伤；文案与注释禁止商业商标与官方角色名。

## 十三、完成后回复

写清：你是 B 档、`match-stars`；时间线状态机怎么拆的、是否还残留瞬变路径；新增了哪些纯函数；对战 / 无尽做成什么样；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
