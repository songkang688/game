# 三人组第 43–44 轮 · 测试修复员 B

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：PR #116 `trio-r43-playbook.md`、r44 `trio-r44-playbook.md`。
> 不回退已关热区与 820 中间档。不改 `level99` / `home` / `kit` / viewport。N-105 零 hunk。

## 号账

| # | 修法 |
| --- | --- |
| **N-189** | `.rbt-vs-btn` 补 `min-height:${TOUCH_MIN_PX}`；JS 已挂 class |
| **N-190** | `.rte-btn` 规则补 44；本文件 JS **仍不挂**（无结算 overlay 按钮），大厅入口继续 `.rte-open` |
| **N-192** | `.ba-lv` 补 min-height/min-width 44 |
| **N-193** | `.cs-lv` 同样 44；不改 `.cds-tap` / `.fk-ch` |

## 三视口（无头 Chrome · 地图已解锁格）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.ba-lv` | **59×65 IN** | **59×77 IN** | **59×77 IN** |
| `.cs-lv` | **44×57 IN** | **44×77 IN** | **44×77 IN** |
| `.rbt-vs-btn` | CSS `TOUCH_MIN_PX`；进对战结算才挂 | 同左 | 同左 |
| `.rte-btn` | 规则 44；大厅入口仍 `.rte-open` h44 | 同左 | 同左 |

## 测试

`src/games/hotspot.r43b.test.ts`。`npm run build` 绿。
