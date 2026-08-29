# 三人组第 27 轮 · 测试修复员 B（N-141 / N-142）

> 工位分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：`trio-r27-playbook.md`。
> **不回退** N-121/122/124/125/126/129/133/134/135/139。**不改** A 的 `level99.ts` / `home.ts` / `src/art/kit/**`。
> **N-105 零 hunk**。三视口：390×844 / 915×412 / 1024×768。热区 ≥44。

## 本轮号账

| # | 状态 |
| --- | --- |
| **N-141** | landlord-cards `.ld-btn` 基础档 42→44。**不是** N-104 `.ld-back` |
| **N-142** | fight-king `.fk-mode` 补 `min-height:44px`。N-88 开打 sticky 只回归 |

同 PR 后续拍：N-144/145/147/148/150/151（见 r28–r30 交卷）。

## 三视口（vite preview + puppeteer-core，工装不进库）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.ld-btn` 叫分（不叫 / 1–3 分） | **659–705 h46 IN** | **299–347 h48 IN** | **634–682 h48 IN** |
| `.ld-btn` 出牌（不出 / 提示 / 出牌） | **659–705 h46 IN** | **299–347 h48 IN** | **634–682 h48 IN** |
| `.fk-mode` 模式卡 | **223–296 / 306–378 / 388–461 h72 IN** | **170–242 与 252–324 h72 IN** | **200–272 / 282–354 h72 IN** |

## 测试（只增）

`src/games/hotspot.r27b.test.ts`；landlord `visual22a` / `fit` / `shell` 把 42 地板抬到 44。

## 水位

`npx vitest run`：**1211 files / 19527 绿 + 2 skip**。`npm run build` 绿。
