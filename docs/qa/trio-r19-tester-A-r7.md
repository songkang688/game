# 三人组 r19 · 测试员 A 第 7 轮（本机回归，云额度耗尽）

基线：`origin/game-1.3` @ `d8a8821c`（1.3.4 存档保险箱 + PR #107/#94/#96 回填）。

云子代理因未付账单 ERROR，本轮在父 VM 只做 **A 独占面源码闸核对**（未再开无头 Chrome）。

## 回归（仍在树上，禁止重做）

| 号 | 闸 | 1.3.4 |
| --- | --- | --- |
| N-99 | `wrapScroll.n99.test.ts` + `level99.r22` 矮屏 `.sp-wrap` auto / 竖屏 hidden | ✅ |
| N-100 | `level99.n100.test.ts` `entryAnchorTop` | ✅ |
| N-109 | `rootGate.n109.test.ts` max-height:500px | ✅ |
| N-117/118/120 | `level99.r22.test.ts` | ✅ |

`src/ui/**`、学习关本轮零改动。B 面未碰。

## 未做

915 真机复测留给额度恢复后的云 A。N-97 农场深关本拍未再点进 root UI 门。
