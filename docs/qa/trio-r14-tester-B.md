# 三人组 r14 测试修复员 B

基线：`origin/game-1.3` @ `5cbb6a80`。
分支：`cursor/trio-r14-tester-b-c14c`。
范围：N-69 / N-70 / N-71 / N-72 / N-74；顺手 N-49、N-50（分测）。
**未改** find-diff / music-stars / quiz99 / collection。
**未重做** N-52…57（`340fb768`）、N-45、N-40/41/42。N-64/65 无 r13-B 远端分支。
预览 `http://127.0.0.1:4184/`。Chrome `setViewport(915,412)` 时 `innerHeight=412` 才命中 `max-height:500px`。

## 新增测试

- `src/games/memory-cards/duoBoard.r14.test.ts`
- `src/games/sudoku-petal/duoPad.r14.test.ts`（N-70 + N-49）
- `src/games/mine-garden/duoField.r14.test.ts`
- `src/games/lianliankan/boardFit.r14.test.ts`
- `src/games/block-drop/duoWell.r14.test.ts`（N-74 + N-50）

本包单测绿；`npm run build` 通过。

## 915×412 浏览器

| # | 款 | 数字 |
| --- | --- | --- |
| **N-69** | 双人轮流翻 | 8 列两行；行 **191 / 293**；第二行底 **389 在屏**。旧 217/490/763/1036 已消 |
| **N-70** | 双人同屏 | 数字 **77–122 在屏**；铅笔/擦掉/提示 **178 / 228 / 278–322 在屏**；末格 **274–311 在屏**。旧 394/452 已消 |
| **N-49** | 对战竞速 | 末格 **274–311 在屏**（与 N-70 分测）。旧 crop 1046 已消 |
| **N-72** | 连连看关内 | 行 **136 / 187 / 237 / 287**；末格底 **335 在屏**；洗牌/提示 **62–106 在屏**。旧 390+ / crop 496 已消 |
| **N-74** | 方块双人 | 七键 **273–319 在屏**；mode/wrap 锁高 + `scrollTop=0` 再钳井。≠ N-50 |
| **N-50** | 闯关七键 | 同 sticky `.bd-pad` |

N-71：设置「开始 ▶」未改；`cellPx(9,w,250,9)` 列高 ≤250。

## 修法

- N-69 `versusGridCols` + `.mmc-duo`
- N-70/49 `cellPxFor` 吃高度 + 640×500 分座 3×3 键
- N-71 `layout` 余高取格边
- N-72 `boardBoxSize`
- N-74/50 `wellRoomMin`、双井 row、sticky 七键

判定/seed/题库零触碰。

## 未做

N-64/65/66/67、N-54/55、N-2/3/4。误入的 A 侧 n68/n73 空测已 revert。
