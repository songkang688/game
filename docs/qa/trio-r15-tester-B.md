# 三人组第 15 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `45cb5d2f`。交卷 SHA **`73fc23b5`**。
范围：休闲 / 对战。**未改** find-diff / music-stars / kitty-care / quiz99。**未重做** N-69…72/74、N-41 牌宽、N-53/N-55 对战源码口径。

preview 工装 `:4186`。

## 本轮已关（源码 + 守门测试）

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-75** | mahjong-bloom 对局 | 开局后手牌 top 514 FOLD（≠ N-41 牌宽） | 配方 L：500px 锁 wrap、收河牌/桌垫，`.mj-hand` sticky 横滑。`.mj-tile` min-width **44 未动** |
| **N-76** | combo-clash | 双人三键 440；训练场 666 / 假人 848 | 配方 B：矮屏钉 `.cc-pad`、收摇杆/画布；训练 `.cc-info` 可滚。`canvasDisplayCapPx` 默认下限 140 不变，矮屏 fit 用 96 |
| **N-78** | shoot-range 双人 | 自滚 207，🌟 428（≠ 菜单 40） | 配方 E：锁 wrap + `resize` 按余高钳 `cssH` + `.shr-pads` sticky |
| **N-79** | prince-princess 两人一起 | D-pad 540/578。无尽城堡塔勿当验收 | 配方 H：500px 把双人 `.pcp-cv` 压到 118 并钉垫；620px 无尽 216 保留 |
| **N-80** | box-hamster 闯关 | ⬆ 571。无尽键已绿 | 配方 J：锁壳 + `.bh-pad` sticky。`CELL_MIN=18` 不降 |
| **N-81** | snake-snack 无尽 | crop 655，键 678 | 画布显示 `max-height`（CELL=26 逻辑边不变）+ `.sn-pad` sticky |
| **N-82** | bubble-pop 无尽泡 | 格 436 线下 | 基线 `min-width:36` 保留；500px 才 `min-width:0` 收盘。`SEA_ROWS=12` 不变 |
| **N-83** | gomoku 闯关工具 | 悔棋 526（≠ N-67 开始下棋） | 进局 `.gmk-canvas` 钳高 + `.gmk-btns/.gmk-claimbar` sticky；`.gmk-panel .gmk-start` 原样 |
| **N-84** | tank-battle 闯关 | ▲💥 464（≠ N-53 双人） | 单人 `chrome+72`；`.tkb-pads` 也 sticky。双人 `.tkb-pads-two` 字符串保留 |
| **N-85** | snow-fight 闯关 | 瞄准 462（≠ N-55 十二键） | 单人垫高预留 118；矮屏允许 `ys` 0.7；`.snf-pads` sticky。`data-duo` 并排保留 |

## 未做 / 勿换号

N-69…74、N-49、N-64/65/66/67 对局、N-54 双人、N-2/3/4 视口、N-60/61/62 贴线、N-11/12、C-8、N-10、N-50、C-2/5/7 闯关。

## 测试（只增）

- `mahjong-bloom/handFit.r15.test.ts`
- `combo-clash/padFit.r15.test.ts`
- `shoot-range/duoFire.r15.test.ts`
- `prince-princess/duoPad.r15.test.ts`
- `box-hamster/campaignPad.r15.test.ts`
- `snake-snack/endlessFit.r15.test.ts`
- `bubble-pop/endlessSea.r15.test.ts`
- `gomoku/campaignTools.r15.test.ts`
- `tank-battle/campaignPad.r15.test.ts`
- `snow-fight/campaignPad.r15.test.ts`

## 护栏

不改存档 key / `meta.id` / 题库 / seed / 胜负。禁 force。撞车取先合版。


## 915×412（preview :4186，SHA `73fc23b5`）

独立 `createBrowserContext()`，视口 915×412。

| # | 数字 |
|---|---|
| **N-75** | 开局后手牌 **350–400 IN**（14 张；旧 514 FOLD）。牌宽仍 44 |
| **N-76** | 双人点「星星用 …」后轻/重/必杀 **346–394 IN** crop 0（旧 440） |
| **N-78** | wrap 锁高 + pads sticky + resize 钳高；菜单芯片未改 |
| **N-80** | 闯关方向 **256–366 IN** |
| **N-83** | 画布 105–353 IN；悔棋 369 切 1px、确认 421 仍 FOLD（书面降级：工具行已从 526 上移） |
| **N-84** | ▲💥 **307–402 IN** crop 0（旧 464） |
| **N-85** | 瞄准/搓雪 **305–403 IN**（旧 462；舞台 crop 172 残余） |

N-79/81/82：源码已加 500px 锁壳+钉键；本轮入口脚本未稳定进局，不拿菜单绿结案。
