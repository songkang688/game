# 三人组 r19 · 测试员 A 第 8 轮（本机，云额度耗尽）

基线：`origin/game-1.3` @ `1e45c64`（含 B 第 5 轮 N-110/N-111）。
无头 Chrome 915×412 · **未 seed root**。点首页 🔑 打开门，未改 storage。

## 闸（只增不减，本轮零改源码）

| 号 | 文件 | 结果 |
| --- | --- | --- |
| N-99 | `sudoku-petal/wrapScroll.n99.test.ts` | 绿（进关后 `.sp-wrap` 矮屏 `overflow:auto` 仍在树上） |
| N-100 | `level99.n100.test.ts` | 绿 |
| N-109 | `src/ui/rootGate.n109.test.ts` | 绿 |
| N-117/118/120 | `level99.r22.test.ts` | 绿 |

`npx vitest run` 上述 A 闸：**15 例全绿**。

## 915×412 实测

| 面 | 数字 |
| --- | --- |
| 首页 🔑 | 10~54 h=44 IN |
| `.rootgate` 盒 | 53~359 h=305 IN（N-109 仍成立） |
| sudoku-petal `.l99-continue` | 168~212 IN |
| math-farm / word-garden `.l99-continue` | 80~124 IN |

学习七款舞台钮无「滚不到」。B 面本轮零碰。

## 未做

root×math-farm 深关 N-97 真机点进（门已能量到，未输密码走 188）。额度恢复后再派云 A。
