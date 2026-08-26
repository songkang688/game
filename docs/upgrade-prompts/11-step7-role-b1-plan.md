# 1.1 第 7 步 · 角色 B1 开工记录 —— 金矿钩钩（gold-hook）

## 基线

- 分支：`game-1.1`（`origin/game-1.1` = a873ac3「泡泡炸弹人手机竖屏一屏放下棋盘和方向盘」）
- 开工时全仓 `npm test`：**123 个测试文件 / 3284 个用例全绿**
- 独占目录：**`src/games/gold-hook/`**，一个字节都不碰别人的 `src/games/*`
- 明确不改：`src/ui/home.ts`（glob 自动发现）、`src/games/level99.ts`（只 import 使用）

## 要做的东西

一款矿洞钩爪游戏：钩子在矿洞顶端来回摆动，按一下放绳，钩到什么就往回拉，
重的东西拉得慢。关内金币可以在商店换炸药 / 力量水 / 幸运石。
角色沿用朵朵与星星，全部命名原创，面向小学中高年级。

### 文件划分

| 文件 | 职责 |
| --- | --- |
| `meta.ts` | 纯数据：id / title / emoji / category / color / blurb / modes / levels，不 import 任何玩法代码 |
| `logic.ts` | 纯函数玩法核心：摆角、回收速度、矿物估值、商店、贪心模拟器 |
| `levels.ts` | 8 个主题章节（和恰好 188）、每关矿场生成与目标金额、无尽矿层 |
| `guide.ts` | 一本 `GuideBook`，8 条章节攻略 + 通用心得 |
| `index.ts` | 顶部 `export { meta }`，模式选择（闯关 / 无尽）+ canvas 渲染 + 触屏与键盘 |
| `logic.test.ts` / `levels.test.ts` | 合计 ≥15 个用例，实际按 ≥40 写 |

### 纯函数（必须单测）

1. `swingAngle(t, cfg)`：三角波摆动，角速度恒定，到端点折返；
2. `timeToAngle(now, target, cfg)`：等到钩子指向某个角度还要多久（贪心模拟器要用）；
3. `retractSpeed(weight, strength)`：越重越慢、力量水越多越快，上下都有夹逼；
4. `haulValue(kind, luck, roll)`：幸运石只加成矿物、不加成石头；
5. `shopPrice(kind, owned)` / `buyItem(state, kind)`：关内金币买三样道具，买不起原样返回；
6. `simulateRun(field, opts)`：确定性贪心模拟器，用来证明每关目标金额可达。

### 关卡设计

- 8 章：浅层矿洞 24 / 潮汐溶洞 24 / 深海矿脉 24 / 熔岩矿坑 23 / 冰晶矿窟 23 /
  水晶回廊 23 / 云顶浮矿 24 / 星空矿场 23 = **188**
- 每关的矿场由 `mulberry32(seed)` 生成，同一关每次布局完全一致；
- 目标金额 = 贪心模拟器算出的可得金额 × 难度系数（0.42 → 0.72 逐关抬升），
  所以「目标一定拿得到」是构造出来的，不是拍脑袋定的；
- 单测再用「带时间损耗的模拟器」跑一遍全部 188 关，证明手慢一点也过得去；
  反向再证明「只钩石头」这种摆烂策略一定过不去。

### 无尽模式

矿层无限下探：每一层有配额，达标就下潜一层，层数越深摆得越快、石头越多。
成绩走平台 `save.recordEndlessBest`，单位是总金币。

## 收尾

`git fetch origin game-1.1` → rebase → `npm test` 与 `npm run build` 全绿 → 普通推送
`git push origin HEAD:game-1.1`，不 force、不合 main。
