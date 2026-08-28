# 三人组第 42 轮 · 测试修复员 B（N-186 / N-187）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：PR #115 `trio-r42-playbook.md`。
> r39–r41 B 已合。不回退 820 中间档。不改 `level99` / `home` / `kit` / viewport。N-105 零 hunk。N-188 归 A。

## 号账

| # | 修法 |
| --- | --- |
| **N-186** | `.mmc-open` 补 `min-height:44px` + inline-flex；N-69 卡钳原文 |
| **N-187** | `.mmc-toggle` 同样 44；不改 `.shr-toggle` / `.snk-toggle` |

## 三视口（无头 Chrome · 大厅）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.mmc-open` | **h44 IN**（无尽 / 双人） | **h44 IN** | **h44 IN** |
| `.mmc-toggle` | **h44 IN**（辅助） | **h44 IN** | **h44 IN** |

## 测试

`src/games/hotspot.r42b.test.ts`。`npm run build` 绿。
