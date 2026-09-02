# 三人组 r19 · 测试员 B 第 8 轮（本机）

基线：`0534636a`（N-113）。915×412：记忆翻翻末卡 **353~419** 切 7px，`scrollIntoView` 后可及。

## 本轮

| 号 | 修法 | 修后 |
| --- | --- | --- |
| **N-115** | N-69 档 `.mmc-board` 加 `overflow-y:auto`，钳卡高原文不动 | overflow `auto`；滚后末卡 **334~400 IN**。1024×768 无不可达钮 |

390 未吃 500×640 档。N-69 `duoFit.r14` 仍绿。

`src/games/memory-cards/boardScroll.n115.test.ts`
