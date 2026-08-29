# 三人组第 34 轮 · 测试修复员 B（N-162 / N-163）

> 同分支。Playbook：`trio-r34-playbook.md`。不改 `.oa-back`（N-135）、不改棋盘 `.cg-sq`。N-105 零 hunk。
> `src/styles.css` 只动 `.cg-log-sum` 高度，字号 14 提级段保留。

## 号账

| # | 修法 |
| --- | --- |
| **N-162** | `.oa-board summary` / `.sr-board summary` 补 min-height 44 + flex 居中 |
| **N-163** | `.cg-log-sum` 与 `.cg-wrap .cg-log-sum` 补 44 |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.oa-board summary` | **494–538 h44 IN** | **170–214 h44 IN** | **293–337 h44 IN** |
| `.sr-board summary` | （进混战后同规则） | **173–217 h44 IN** | **221–265 h44 IN** |
| `.cg-log-sum` | 高 **44** | 高 **44**（515 落在 412 折下，可滚记谱区） | 高 **44** |

## 护栏（r31–r34）

未改存档 / 题库 / seed / 胜负 / 物理 / `SKY_H` / combo-clash / mahjong-bloom / kit / `level99.ts` / `home.ts`。
