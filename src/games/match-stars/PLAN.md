# 星星消消乐 `match-stars` · 窗口 2 · 9B 工作计划

本步只干一件核心的事：**把「消除 → 重力下落 → 顶部补块」从瞬变改成一条看得见的时间线**，
顺带把对战与无尽两个模式补齐。前 99 关的生成参数与 seed 一个字都不动。

## 一、现状硬伤（读完 engine.ts / index.ts / levels.ts 的结论）

1. `clearCells()` 把匹配格直接写成 `EMPTY`，`applyGravity()` 紧接着在同一个 `grid[]` 上
   把幸存值往下压、把空位就地填成新随机值。**状态 A 直接跳到状态 B，中间没有任何位移信息。**
2. `index.ts` 的 `resolveCascade()` 高亮 `boomSet` 220 毫秒之后，调 `applyGravity()` 再 `render()`
   整盘重绘：方块不是「从旧格滑到新格」，而是**原地换了个 emoji**。新块也不是从棋盘顶外掉进来的。
3. 非法交换直接把两格换回去再 `render()`，没有「换过去 → 停一下 → 换回来」的回弹。
4. `shiftBelt()` 整行瞬移，同样没有滑移过程。
5. `modes` 只有 `campaign`，`meta.blurb` 也只提闯关。
6. 8×8 棋盘 + 目标徽章换行，360px 上最底行要滚动才点得到。

## 二、时间线状态机怎么拆

一次出手被拆成**一串有时长的段**，由 `anim.ts` 的 `Runner` 顺序播放，每段结束才允许进下一段。
所有段共用同一张时长表 `timings(reduced)`，`prefers-reduced-motion` 只是把表里的数字压到 1 帧，
**状态机本身一段都不少走**——不存在「reduced 就瞬变」的第二条代码路径。

```
idle
 ├─ 点两格相邻 → swap(140ms，两块互相滑过去)
 │    ├─ 无匹配 → revert(140ms，原路滑回来) → idle          不计步
 │    └─ 有匹配 → 计步 → boom
 ├─ boom(200ms，匹配格缩放淡出)
 ├─ fall(planGravity + planRefill 里最晚一条 tween 的结束时刻)
 │    每列独立：幸存块 fromRow→toRow，每格 70ms，同列自下而上错开 20ms；
 │    新块从 -1、-2、-3… 行落进来，接着同一条错峰队列
 ├─ land(90ms，落地压扁 8% 回弹；reduced 下不形变但这一段照走)
 ├─ 回到 boom（连锁，不计步），直到没有匹配
 ├─ belt(200ms，传送带整行滑移；滑完若又凑出三连回到 boom)
 └─ settle → 结算订单 / 石巨人 / 胜负 → idle
```

`fall` 段里方块的视觉行是 `tweenRow(tw, elapsed)` 算出来的浮点数，逻辑行早已是终值 `toRow`。
**这一段没走完，视觉坐标就必然不等于逻辑坐标**——验收铁则由 `view.test.ts` 拿虚拟时钟断言。

## 三、必须新增的纯函数（`anim.ts`，不改规则、不吃随机）

```
planGravity(before, after, cols, opts?) : FallTween[]
   before = 消除完、还没压实的盘面（空位是 EMPTY）
   after  = 压实之后的盘面（补不补新块都行，配对只看自下而上的第 k 个）
   FallTween = { cell, fromRow, toRow, col, delayMs, durMs }

planRefill(settled, cols, opts?) : SpawnTween[]
   settled = 压实之后、还没补块的盘面；每个空位配一个从 -1、-2… 行落入的新块

tweenRow(tw, elapsed) : number        某一时刻的视觉行（浮点）
planEndMs(tweens)     : number        整段下落什么时候结束
```

`opts.blocked` 传「不参与下落的格子」（冰块 / 藤蔓 / 挡板），两个函数都不碰随机数。

## 四、模块切分

| 文件 | 负责 |
| --- | --- |
| `meta.ts` | 纯数据；补 `modes` 与 `platform`，`blurb` 写上对战 / 无尽 |
| `board.ts` | 尺寸无关的棋盘核心：匹配 / 压实 / 补块 / 特殊块引爆 / 挡板 |
| `engine.ts` | 闯关规则（照旧）：改成调用 `board.ts`，随机数调用顺序一字不差 |
| `anim.ts` | `planGravity` / `planRefill` / `tweenRow` / `Runner` 时间线（纯） |
| `duel.ts` | 订单队列、对战胜负、无尽计分、人机三档（纯） |
| `view.ts` | 会下落的棋盘组件：DOM + 时间线，闯关 / 对战 / 无尽共用同一份 |
| `levels.ts` | 188 关照旧；末章尾部加「挡板」新机制 |
| `index.ts` | 四个入口接线：188 关闯关 / 对战 / 无尽 / 双人同屏 |
| `domStub.ts` | 只给单测用的极简 DOM 桩（不参与打包） |

## 五、随机数顺序为什么能保住 seed

`applyGravity()` 拆成 `settle()`（只挪）+ `refill()`（只补）两步之后，
`refill()` 仍旧按「列 0→7、每列自下而上」的顺序取随机数，
和拆之前那个单层循环取数的顺序完全一致，所以 `simulateLevel()` 的结果一位不变。
前 99 关的生成指纹 `285e1b7c` 由 `levels188.test.ts` 继续守着。

## 六、模式

- **闯关 188**：保留。末章（云顶石巨人）尾段加挡板：挡板不透重力，上面的星星落不下去，
  得先在它旁边消一次把它敲掉。这是新机制，不是把数值调大；前 99 关一个字段都没多。
- **对战**：左右各一块 6×6（窄屏改上下）。谁先清完 3 张订单谁赢。
  人机三档：`rookie` 随机合法滑 / `normal` 会看一步连锁 / `expert` 会囤 4 连。
- **无尽**：订单队列无限，每清 1 张 +1 步；难度来自订单更苛刻，没有倒计时。
  最高分走 `save.recordEndlessBest("match-stars", n)`。
- **双人同屏**：鸭梨 `WASD + F`、康康 方向键 `+ L`；手机上下半屏各自触控。

## 七、2.5D 决策

**保持 2D 正交格子。** 立体感只加两样：棋子左上角一点高光、落地一次 8% 压扁回弹。
`prefers-reduced-motion` 下压扁取消，但 `land` 这一段照走，终态完全一致。

## 八、360px

棋盘优先占宽；目标条改成**一行可横滑的芯片**，绝不换行；步数字号 18px；
格子最小边长 40px + `gap` 4px，8 列在 360px 上是 40.5px，热区连同 `padding` ≥ 44px，
最底行不用滚动就点得到。
