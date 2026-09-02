# 三人组 r19 · 测试员 A 第 9 轮（本机）

基线：含 B 第 7 轮 N-113。无头 Chrome 915×412 / 390×844。未 seed root。

## 闸

N-99/100/109 源码仍在（本轮未改 sudoku / level99 / rootGate）。

## 本轮

| 号 | 款 | 修前 915 | 修法 | 修后 |
| --- | --- | --- | --- | --- |
| **N-114** | quiz99（形状王国 L1 现形） | 末选项 `.qz-choice` **405~457**；501–840 才 sticky，**412 吃不到** | `@media (max-height: 500px)` 给 `.qz-choices` 同样 sticky | 三选项 **342~394 全 IN** |

390 选项 522~586 IN。`deepChoice.r14` 仍禁止 review.ts 写 `500px and min-width:640px`，本修在公共 `quiz99.ts`。

## 测试只增

`src/games/quiz99.n114.test.ts`
