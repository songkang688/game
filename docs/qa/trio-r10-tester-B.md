# 三人组第 10 轮 · 测试修复员 B（7779）

基线：`origin/game-1.3` @ `6d6e9f3a`（已含 r9 B `323ac8cc`，以及 **c14c 第 10 轮合入** `2752a179`）。
范围：休闲 / 对战 / 动手。未碰壳层 / `level99.ts` / 纯学习款。未重做 N-25/31/1/32/26/27/29+N-23。

对账：`trio-r9-playbook.md` + `trio-r10-playbook.md`。**#60 c14c 已合入主干**，本 PR 不重做其 N-40/41/42/N-2/3/4/N-10 主体，只补缺口。

## 已在主干（c14c，本 PR 不重写）

| 编号 | 状态 |
|---|---|
| N-40 duo-rush `.dr-btns` sticky | ✅ c14c；本 PR 只加菜单 `.dr-start` sticky |
| N-41 麻将 `min-width:44` | ✅ c14c |
| N-42 puff 暂停/模式 44 + 矮横屏双栏 | ✅ c14c；本 PR 补 `fitCanvas` 不顶破余量、`--k:46→44`、`.pfb-open` 44 |
| N-10 棋类收盘 | ✅ c14c；本 PR 象棋工具行 sticky、weiqi 下限 180→156 |
| N-2/3/4 | ✅ c14c |
| C-8 ice-fire 双垫侧栏 | ✅ c14c；本 PR 补短边 `boardHeightBudget` |

## 本 PR 新关

| 编号 | 怎么修 |
|---|---|
| **N-13** fruit-stack | 配方 F：`stagePlayRoom.h` 减 HUD/提示/◀▶放下 |
| **N-14** bumper-cars | 配方 F：减 HUD+摇杆；暂停/回选关 `min-height:44`；矮横屏 pads sticky |
| **N-45** gold-hook 商店 | 配方 I：货架 `.gdh-shoplist` 内滚，`.gdh-shopfoot` 钉「接着挖」；`SHOP`/买卖零触碰 |
| **C-8** duo-arena / duo-rush 菜单 | 开擂/开跑 sticky |

## 未关

snow-fight / shoot-range / puzzle-tiles / balloon-pop 菜单开跑；N-15 bomb-buddies 对战×915。

## 红线

不改存档 key、题库、判定、kit。测试只增。`match.ts` 零触碰。

## 水位

`npm test` **1123 文件 / 19361 用例**全绿（进场基线 r9 playbook 记 1095/19288）。`npm run build` 见交卷前跑次。
