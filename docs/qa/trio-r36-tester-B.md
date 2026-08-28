# 三人组第 36 轮 · 测试修复员 B（N-168 / N-169）

> 同分支。Playbook：`trio-r36-playbook.md`。不改 N-150 `.bvp-btn/.bvp-act`；不改 `.bvp-opt-em` 34；不改 `.pfb-veil-btn` / `.pfb-open` / `--k`。N-105 零 hunk。

## 号账

| # | 修法 |
| --- | --- |
| **N-168** | `.bvp-opt` 补 `min-height:44px` |
| **N-169** | `.pfb-pick` 补 `min-height:${TOUCH_MIN}px` |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.bvp-opt` | **96–156 h60 IN** | **66–126 h60 IN** | **96–156 h60 IN** |
| `.pfb-pick` | **96–142 h46 IN** | **66–112 h46 IN** | **96–142 h46 IN** |

kit `touchUpliftCss([".bvp-btn"])` 与 N-150 叠层仍在。
