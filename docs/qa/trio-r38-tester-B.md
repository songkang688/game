# 三人组第 38 轮 · 测试修复员 B（N-174 / N-175 + 抽验裁切）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：`trio-r38-playbook.md`。
> 不改 A 的 `level99` / `home` / `src/art/kit/**`。已关热区号不回退。N-105 零 hunk。
> 500 档原文不动；中间档 `@media (max-height:820px) and (pointer:coarse)`；竖屏钉底抄 N-122。

## 号账

| # | 修法 |
| --- | --- |
| **N-174** | `.rbg-pick` 补 `min-height:${TOGGLE_MIN_H}px`（flex 列） |
| **N-175** | `.rbg-btn` 补同样 min-height；open/back/toggle 原文 |
| **抽验** | fruit-stack / alien-seek / ice-fire-forest / star-estate / flight-chess / hero-cards / junqi-camp / pool-stars：820 粗指针钉 CTA 或复用矮横屏双栏；390 用 `max-width:430px and min-height:700px` 钉底 |

## 故意没做

- N-176（A 的 `*-pick` 巡检）
- 连连看格子、combo-clash / mahjong-bloom
- 全局 `.game-stage`

## 测试

`src/games/hotspot.r38b.test.ts` + 各款既有 500 档守门。
