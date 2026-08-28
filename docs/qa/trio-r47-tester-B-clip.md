# 测试员 B · r47 抽验四（大厅/设置开始钮）

> 同分支 `cursor/trio-r21-tester-b-1cd5`。**不重做** N-201 `.oa-back` / N-202 钓鱼 `.fs-back`。**不回退** 820 档菜单修。**不改** `level99.ts` / `home.ts` / `src/art/kit/**`。**N-105 禁止新版本。** 不改玩法。

## 修前 915×412

| 游戏 | 选择器 | 现象 |
|------|--------|------|
| 朵朵大战星星 | `.dvs-go`「两人就位，开打」 | top **523** / bot **572** 整颗线下 |
| 勇者小路 | `.bvp-btn-go`「开打！」 | top **507** / bot **551** 线下 |
| 红蓝拔河 | `.rbg-pick`「同屏双人」 | top **417** / bot **472** 贴线裁 |

## 改了什么

820 中间档 `max-height:820px and min-width:640px and pointer:coarse`：菜单可滚 + 双栏 / sticky。各款既有 500/520/380 原文不动。

- `duo-vs-star`：`.dvs-menu:has(.dvs-go)` 限高滚动，开打 sticky 底。不改 `.dvs-pad` / 520 横屏竞技场。
- `brave-path`：对战大厅加 `.bvp-arena-setup`，开打行 `order:-1` sticky 顶（避开壳层把底裁掉）。不改 `.bvp-lobby` 500 档、不改无尽 `.bvp-endless-fight`。
- `red-blue-tug`：`.rbg-picks` 双栏。不改关内拉绳 / `.rbg-toggle`。

## 实测

无头 Chrome · `hasTouch`/`isMobile` · 禁 SW。星战点「双人对战」、勇者点「对战」、拔河点「对战」。

| 选择器 | 390×844 | 915×412 | 1024×768 |
|--------|---------|---------|----------|
| `.dvs-go` | **49×322.8 IN** bot 820 | **49×482.9 IN** bot 356 | **49×482.9 IN** bot 742 |
| `.bvp-btn-go` | **44×75 IN** bot 786 | **44×75 IN** bot 186 | **44×75 IN** bot 216 |
| `.rbg-pick` 同屏双人（五档全在屏） | **55×326.8 IN** bot 814 | **55×406.5 IN** bot 388 | **55×461 IN** bot 738 |

## 测试

`hotspot.r47clip.test.ts`、`hotspot.r47b.test.ts`、`hotspot.r46clip4.test.ts`、`hotspot.r39b.test.ts`、`brave-path/lobbyHall.r16`、`lobbyWide.r18`、`red-blue-tug/touchTargets` 绿。`npm run build` 绿。

## 820 / N-105

不回退开擂/围子/音砖。combo-clash 无 820。
