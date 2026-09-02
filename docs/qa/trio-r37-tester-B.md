# 三人组第 37 轮 · 测试修复员 B（N-171 / N-172）

> 同分支。Playbook：`trio-r37-playbook.md`。不改 `TALLY_MS`、`.gdh-tally-fly`、走廊 `.advk-pad2`、章节表。N-105 零 hunk。
> **r38 playbook 不存在**，无额外 B 项。

## 号账

| # | 修法 |
| --- | --- |
| **N-171** | `.gdh-tally` 补 `min-height:${TOUCH_MIN}px` |
| **N-172** | `.ak-card` 补 `min-height:44px`；390 两列 / 560 四列网格原文 |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.gdh-tally` | **96–140 h44 IN** | **66–110 h44 IN** | **96–140 h44 IN** |
| `.ak-card` | **96–156 h60 IN** | **66–126 h60 IN** | **96–156 h60 IN** |

## 测试

`hotspot.r35b.test.ts`。targeted + `npm run build` 绿。
