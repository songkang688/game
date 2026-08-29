# 三人组第 29 轮 · 测试修复员 B（N-147 / N-148）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：`trio-r29-playbook.md`。
> 不碰 N-108 拼图无尽画廊逻辑。`.dvs-pad` `min-height:42px` **原文保留**。N-94/101 只回归。N-105 零 hunk。

## 本轮号账

| # | 状态 |
| --- | --- |
| **N-147** | snake-snack `.sn-back`、puzzle-tiles `.pz-back` 补 44 |
| **N-148** | hue-hand `.hh-catch`、duo-vs-star `.dvs-pick` 补 44 |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.sn-back` | **173–217 h44 IN** | **91–135 h44 IN** | **173–217 h44 IN** |
| `.pz-back` | **157–201 h44 IN** | **66–110 h44 IN** | **96–140 h44 IN** |
| `.dvs-pick` 选角 | **215–259 h44 IN** | **167–211 h44 IN** | **197–241 h44 IN** |
| `.hh-catch` | 夹具三档均为 **h44 IN**（局内轮到抓牌才挂钮；CSS `min-height:44px`） | 同左 | 同左 |

`.dvs-pad button` 仍为 `min-height:42px`（playbook 明确勿抬）。

## 测试

`hotspot.r27b.test.ts`。vitest / build 见 r27 交卷。
