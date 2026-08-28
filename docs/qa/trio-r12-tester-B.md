# 三人组第 12 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `a2372650`（r11 N-52…57 已合）。
范围：休闲 / 对战。**未改** A 独占：collection / level99 / quiz / styles.css。
**未重做** N-25/31 关内、N-45、N-40 赛道、N-52…57。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-60** | orb-arena 闯关 | 分身/吐孢子 top 436；双人四键已绿 | 配方 H：矮横屏闯关 `orbPaneH` 改 200（与双人同档）；`.oa-pad` sticky。`orbPaneH(2)` 恒 200 |
| **N-61** | snake-royale 闯关 | 加速/急停 top 436；回选关 30 | 同档短画布 + `.sr-pad` sticky；`.sr-back` min-height 44。双人 224 零动 |
| **N-62** | merge-2048 | 四向 top 392 | `TABLE_CHROME_PX` 170→216 再让盘面；`.mg-pad` sticky。规则/seed 零触碰 |
| **N-2** | flight-chess | 掷骰 525；sticky 钉在自滚 stage 里 | wrap `overflow:hidden;height:100%`，盘 `max-height:42dvh`，再 sticky |
| **N-3** | star-estate | 地产格 448 | 同上 |
| **N-4** | hero-cards | 确定 511 | 同上 |

## 余力

- **N-10** 象棋：500px 档 wrap 再按 `52dvh` 收；保留 248 字符串。
- **C-8** hue-hand：`.hh-btns` sticky。
- **N-49** 数独：`.sp-pad/.sp-tools` sticky（对战竞速同源键排）。

交卷 `npm test`：1148 files 中 2 个超时 flake（`snake-snack/qaC1`、`bomb-buddies/ai` 一类），复跑全绿。本轮相关单测 86 绿。`npm run build` 通过。

N-52 对局复测、N-46/47、N-12/13。Chrome 915 实测量交卷后补；以源码函数断言护栏。

## 测试（只增）

- `orb-arena/campaignPad.r12.test.ts`
- `snake-royale/campaignPad.r12.test.ts`
- `merge-2048/padFit.r12.test.ts`
- `flight-chess/stageLock.r12.test.ts`
- `star-estate/stageLock.r12.test.ts`
- `hero-cards/stageLock.r12.test.ts`
- `hue-hand/shortLandscape.r12.test.ts`

## 护栏

不改存档 key / meta.id / 题库 / seed；测试只增不减；禁 force。
