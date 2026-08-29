# 三人组 r21 测试员 A · P0 交卷（N-117 / N-118 / N-120）

> 基线 `origin/game-1.3` @ `206d0522`。执行 `docs/qa/trio-r21-playbook.md` P0 中 **A 独占的壳+地图** 三条。
> **N-105 未开新修复版**（监督：先合者生效；本工位 drop 全部 14px→16px hunk）。
> **不回退** r18 壳层：N-63 `.l99-view` 内部滚、`game-stage--l99`、四处 `showMap(true)`、N-39 聚焦。本树尚未合入 4e78，本拍只删 136px 硬钳，不改 `.l99-stage` 关内 overflow。

## 本拍做了什么

| # | 改动 | 文件 |
| --- | --- | --- |
| N-117 | 章节页签徽章收纳：非当前章仅 emoji；当前章 emoji+名；锁标 `<span class="l99-tab-lockmark">`；`aria-label` 仍带全名。`rootUnlock` 优先摘节点，文本 🔒 作兜底。 | `src/games/level99.ts`、`src/ui/rootUnlock.ts` |
| N-118 | 删除 `@media (max-height:500px)` 里 `.l99-wrap{max-height:calc(100dvh - 136px)}`，高度交给 `.l99-host>.l99-wrap` flex。`mapColumns` 改传 `mapLayoutWidth()`（`.l99-map`/`wrap` clientWidth）。**断点数值未改**。 | `src/games/level99.ts` |
| N-120 | `.l99-view` 补 `touch-action:pan-y; overscroll-behavior:contain`。竖屏 auto 滚已在基线，不重写 4e78 关内 `.l99-stage`。 | `src/games/level99.ts` |

未做：N-105 第四版、N-101 duo-vs-star、N-107 fruit-stack（B）、N-119 观感（P2）。

## 三视口口径

| # | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| N-117 | 8 章单行 ≤52px：非当前 36×44 + 当前章名；`flex-wrap:wrap` 保留、无 `overflow-x:auto` | 徽章单行，减轻 N-100 折行把 `.l99-continue` 卷到负 top | 单行 |
| N-118 | flex 吃满 host | 去掉 412−136=276 盲区，触摸可滚到末行 | 列数按容器宽（≤680 为 7 列），不按 1024 误排 8 列 |
| N-120 | `.l99-view` pan-y + contain；外层 stage hidden（N-63） | 同左 | 同左 |

## 测试

增量：`src/games/level99.r21.test.ts`、`rootUnlock.test.ts` N-117 span 摘锁。
本地 `npx vitest run`：**1202 files / 19513 tests** 全绿（2 skipped）；`npm run build` 绿。相对 playbook 参考水位 1193/19489 只增不减。

## 未能点按

本云环境未跑稳定 Chrome 触摸拖动。N-120 靠 CSS 守门；合入后请抽验 word-garden 915 `.l99-continue` top≥0 与地图末行 bottom≤412。
