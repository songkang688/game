# 三人组第 45 轮 · 测试修复员 B（仅 N-195）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：PR #118 `trio-r45-playbook.md`。
> **N-196 `.l99-continue` 不改**（壳层归 A）。`.shr-toggle` 保持 N-134 的 44。N-105 零 hunk。不回退中间档。

## 号账

| # | 修法 |
| --- | --- |
| **N-195** | `.shr-back` 已有 min-height 44，补 `inline-flex` + `box-sizing` 钉点击矩形 |
| **N-196** | 本拍不做 |

## 三视口（无头 Chrome · `#/game/shoot-range` 点无尽出现返回）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.shr-back` | **44×71.6 IN** | **44×71.6 IN** | **44×71.6 IN** |
| `.shr-toggle` | CSS 仍 `min-height:44px`（N-134）；局内 HUD 才挂，选关屏无此钮 | 同左 | 同左 |

`.l99-continue` 本拍零改：规则仍无 `min-height:44px`。

## 测试

`src/games/hotspot.r45b.test.ts`、`hotspot.r22b.test.ts`、`shoot-range/tabletCoarse.r21.test.ts` 绿。`npm run build` 绿。
