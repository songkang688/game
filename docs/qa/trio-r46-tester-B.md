# 三人组第 46 轮 · 测试修复员 B（仅 N-199）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：PR #119 `trio-r46-playbook.md`。
> **不改 `.l99-*`**。N-195 `.shr-back` 已关。`.shr-toggle` 保持 N-134 的 44。N-105 零 hunk。不回退中间档。

## 号账

| # | 修法 |
| --- | --- |
| **N-199** | `.bl-btn` 已有 min-height 44（N-145），补 `inline-flex` + `box-sizing` 钉 HUD 点击矩形；不改 `.bl-pick` / `.bl-roll` |
| **N-195** | 上拍已关，本拍零改 |
| **N-198** | 归 A，本拍不做 |

## 三视口（无头 Chrome · `#/game/bowling-lane` 点无尽出现 HUD 暂停）

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.bl-btn` | **44×67.2 IN** | **44×67.2 IN** | **44×67.2 IN** |
| `.bl-pick` | 44×97.6 IN（未改规则） | 同左 | 同左 |

`.l99-*` 本拍零改。

## 抽验 915×412 CTA（尚未动过的三款 · 820 中间档）

修前：砖塔 `.brk-back` top 492 整颗线下；数独 `.sp-key` top 532；怪物 `.mcr-fire` bot 453。不改玩法、不改 `level99`、不改 500 档原文。

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.brk-back` | 40×133.4 IN（uiTouch 40；高 844 不命中 820） | **44×133.4 IN** bot 388 | **44×133.4 IN** |
| `.sp-key` | 46×66.9 IN | **44×44 IN** bot 348 | **44×44 IN** |
| `.mcr-fire` | 64×64 IN | **74×74 IN** bot 381 | **74×74 IN** |

## 抽验二 915×412 CTA（五子棋 / 象棋 / 弹弹小鸟）

不回退上一抽三款 820。不改 `level99` / `home` / `kit`。五子棋·象棋 500/840 原文不动。

修前：五子棋「关（推荐）」top 427；象棋「开始下棋」top 701；小鸟重来 bot 416 贴线。

| 选择器 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| `.gmk-start` | 50×338.8 IN | **48×708 IN** bot 400 | **50×708 IN** |
| `.xq-start` | 54×342.8 IN | **54×632 IN** bot 400 | **54×632 IN** |
| `.slb-retry` | 48×96.5 IN | **48×96.5 IN** bot 358 | **48×96.5 IN** |

设置页后段选项在 wrap 内滚（五子棋 wrap scrollHeight 514 / client 304），开始钮 sticky 在屏。

## 测试

`src/games/hotspot.r46b.test.ts`、`hotspot.r46clip.test.ts`、`hotspot.r46clip3.test.ts`、`gomoku/shortLandscape.r10.test.ts`、`xiangqi/shortLandscape.r10.test.ts`、`xiangqi/shortLandscape.r11.test.ts` 绿。`npm run build` 绿。
