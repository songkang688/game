# 三人组第 14 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `5cbb6a80`（r14 学习笔记已合）。
范围：休闲 / 对战。**未改** A 独占：collection / level99 / quiz；`styles.css` 只在末尾追加 N-66 花园象棋矮屏，未动 r2-2 解锁。
**未重做** N-52/53 源码、N-60/61/62 整钮、N-40/41/45、N-50 与 N-74 分测。

## 本轮已关（源码护栏；915 浏览器数字交卷后补）

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-69** | memory-cards 双人翻 | 4×4 竖卡 crop 947 | 矮横屏钳卡高 `clamp(48px,16dvh,72px)` |
| **N-70** | sudoku 双人同屏 | 数字 394 / 工具 452 | 键改 3×3 靠盘；≠ N-49 |
| **N-49** | 数独对战竞速 | 两盘折行 crop 1046 | 分座阈值 720→640 + nowrap + 按高钳格 |
| **N-71** | mine 双人末行 | 7–9 行切/线下 | 按 `innerHeight-168` 钳格 ≥28 |
| **N-72** | lianliankan | 盘 crop 496 | 只钳 `.llk-board` max-width，工具不挤 |
| **N-74** | block-drop 双人 | 井顶 −50 / crop 237 | 640 分栏、叠井分余量、`WELL_DUO_MIN` 120 |
| **N-50** | 闯关七键 | 419 | `.bd-pad` sticky |
| **N-64/65** | 军旗/暗棋 | 确认 485 / 暂停 518 | 收盘 + 工具 sticky |
| **N-66/67** | 花园象棋 / 五子开始 | 末行 / CTA 431 | 盘 58dvh；设置页 `:has(.gmk-start)` 放宽 |
| **N-54** | hop-pads 双人 | 上半 −78 | CSS 钳 36dvh + innerHeight 兜底 |
| **N-2/3/4** | 掷骰/地产/确定 | 锁舞台后仍 FOLD | wrap 再钳 `100dvh-76` |

## 未做 / 降级

N-55 十二键、N-60/61/62 贴线 28px、N-10 围棋出屏、N-11/12、C-8。Chrome 915 `getBoundingClientRect` 以本机预览为准；本工位以源码函数 + CSS 字符串守门。

## 测试（只增）

`*.r14.test.ts`：memory-cards / sudoku-petal / mine-garden / lianliankan / block-drop / junqi-camp / dark-chess / gomoku / chess-garden / hop-pads / flight-chess / star-estate / hero-cards。

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负；测试只增；禁 force。
