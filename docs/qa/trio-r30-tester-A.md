# 三人组 r30 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。N-149 见 `trio-r29-tester-A.md`。
> **不抢** B：N-121/122/124/125/126/129/133/134/135 保龄钓鱼/139；N-150 brave-path 顶栏技能、N-151 `.pzt-eye`/`.pcp-act` 不改。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-152 | 静态巡检 `*-veil-btn` + `cursor:pointer` 须 `min-height`≥44。抽验 `sky-squad` `.sks-veil-btn`。同模板补 `poop-hero` / `puff-bros` / `prince-princess` 结算钮；打靶只动 `.shr-veil-btn`（不改 `.shr-back`/`.shr-toggle`）。`.bh-veil-btn` 白名单走 N-47。 |

## 三视口口径（Chrome headless，`#/game/sky-squad`）

| 视口 | `.sks-mode`（3 颗） | `.sks-veil-btn` |
| --- | --- | --- |
| 390×844 | 44 / 44 / 44 | 44 |
| 915×412 | 44 / 44 / 44 | 44 |
| 1024×768 | 44 / 44 / 44 | 44 |

`.sks-veil-btn` 大厅默认隐藏，同页注入同 class 探针量的是已挂 CSS。`.bh-veil-btn` 仍属 N-47，未改。

