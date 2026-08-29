# 三人组第 32 轮 · 测试修复员 B（N-156 / N-157）

> 同分支。Playbook：`trio-r32-playbook.md`。N-80 钉底不回退。`.dvs-pad` 42 保留。N-105 零 hunk。

## 号账

| # | 修法 |
| --- | --- |
| **N-156** | 仓鼠 `max-height:500px` `grid-auto-rows` 40→44；`.bh-key` 钉 44 |
| **N-157** | `.fs-act` 基础档与 420/720 媒体走 `min-height:${TOUCH_MIN_PX}`；`.dvs-over button` 补 44 |

## 三视口

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.bh-key` | **671–769 h46 w50 IN** | **298–390 h44 w56 IN** | **579–689 h52 w56 IN** |
| `.fs-act` | **750–814 h64 IN** | **294–338 h44 IN** | **669–733 h64 IN** |
| `.dvs-over button` | CSS min-height 44；915 **184–228 h44 IN** | **184–228 h44 IN** | **362–406 h44 IN** |

## 测试

`hotspot.r31b.test.ts`。fishing `shell.test` / `stageFit` 仍绿。
