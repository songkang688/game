# 三人组第 38 轮 · 测试修复员 B（N-174 / N-175 + 抽验裁切）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：`trio-r38-playbook.md`。
> 不改 A 的 `level99` / `home` / `src/art/kit/**`。已关热区号不回退。N-105 零 hunk。
> 500 档原文不动；中间档 `@media (max-height:820px)`（找物不绑 coarse，果盆/星盘仍可绑 coarse）；竖屏钉底抄 N-122。

## 号账

| # | 修法 |
| --- | --- |
| **N-174** | `.rbg-pick` 补 `min-height:${TOGGLE_MIN_H}px`（flex 列） |
| **N-175** | `.rbg-btn` 补同样 min-height；open/back/toggle 原文 |
| **抽验** | 果盆按 `l99-view`/`innerHeight` 收盆高；找物右侧收成 `.as-side` + 820 双栏；冰火 820 并排双垫；星盘 820 锁 wrap；飞行棋/英雄牌/军棋/台球钉 CTA。军棋竖屏媒体用 `max-width:420` 避开 round1 溢出守门 |

## 三视口（无头 Chrome，进无尽/开始冒险后量）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.rbg-pick` | **h55–70 IN** | **h55**；末档可滚（l99-view extra） | **h55 IN** |
| `.fs-key` | **818 h44 IN** | **396 h44 IN** | **746 h44 IN** |
| `.as-btn` / `.als-tool` | 地图态 | **247 / 72 h44 IN** | **601 / 426 h44 IN** |
| `.iff-pad button` | 地图态 | **297 h44 IN** | **339 h44 IN** |
| `.se-btn-go` | 地图态可滚 | **322 h46 IN** | **726 h46 IN**（复测） |

## 故意没做

- N-176（A 的 `*-pick` 巡检）
- 连连看格子、combo-clash / mahjong-bloom
- 全局 `.game-stage` / `level99.ts`

## 测试

`src/games/hotspot.r38b.test.ts` + 各款既有 500 档守门。`npm run build` 绿。
