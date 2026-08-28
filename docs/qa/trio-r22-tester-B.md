# 三人组 r22–r26 · 测试修复员 B（热区票，错开 A）

> 接 r21 B（`1a2be2c9`，N-121/122/124）。playbook：PR #90–#93/#95。
> **不回退** N-121/122/124。**不重做** A 的 N-117/118/120。**N-105 零 hunk**。
> 三视口口径：390×844 / 915×412 / 1024×768。热区 ≥44。

## 本拍号账

| # | 状态 |
| --- | --- |
| N-121 / N-122 / N-124 | 只守门，未改实现 |
| **N-125** | fruit-slice `cardH` 下限 44 |
| **N-126** | fruit-slice / sprout-defense 返回 `hit44`（绘制 32/30/28 不挡种植格） |
| **N-129** | garden-guard 三处返回 + 升级/出售 `hit44` |
| **N-133** | `.rbe-back` 36→44 |
| **N-134** | `.shr-back` 补 44；toggle 沿用 N-124 的 44，500 档 140 钳不回退 |
| **N-135** B | bowling / fishing-star / orb-arena `.*-back` min-height 44 + 字号 ≥14 |
| **N-139** | mole-pop 已有 N-47 后盖 44（只回归）；`.rbv-foe` 40→44 |
| N-119 / N-123 | 仍开放但落在 `level99.ts` / `styles.css`+`home.ts`，与在途 A 同文件，**本拍不改**以免撞 N-117/118/120 |
| N-127 B / N-108 / N-101… | 未做，书面留给下轮 |

## 源码矩形（canvas）

| 款 | 绘制 | 点按 |
| --- | --- | --- |
| fruit-slice 模式卡 | `h = max(44, min(88, …))` | 同矩形 |
| fruit-slice ◀菜单/果园 | 70×32 @ (8,8) | `hit44` → ≥44×44 |
| sprout 地图/局内返回 | 62×30 / 62×28 | `hit44` |
| garden-guard 返回 | 62×30 | `hit44`；升级/出售绘制 92×36，点按 `hit44` |

## CSS 守门

`.rbe-back` / `.rbv-foe` / `.shr-back` / `.bl-back` / `.fs-back` / `.oa-back` / `.mp-open,.mp-back` 后盖均为 min-height 44。

## 测试（只增）

- `fruit-slice/hit44.r22.test.ts`
- `sprout-defense/hit44.r22.test.ts`
- `garden-guard/hit44.r23.test.ts`
- `hotspot.r22b.test.ts`
- `red-blue-race/touch.test.ts` 把 `.rbe-back` 地板从 36 抬到 44

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负 / 塔数值 / 水果回合表；不改 `SKY_H`；不改 kit。
