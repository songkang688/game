# 三人组 r22–r25 测试员 A 交卷

> 分支 `cursor/trio-r21-p0-n117-1cd5`。基线 `origin/game-1.3` @ `206d0522`。
> **不回退** N-117/118/120。**不碰** B 在途 N-121/122/124，也**不改** N-125/126 的 fruit-slice / sprout-defense。
> **N-105 未开第四版**。

## 本拍号账

| # | 状态 |
| --- | --- |
| N-117 / N-118 / N-120 | 本分支已合，只回归 |
| N-128 | `.l99-host` hidden + `.l99-view` auto 契约测试 |
| N-99 | `.sp-wrap` overflow-y:auto；矮屏 `.sp-key` 40→44 |
| N-131 | `quiz99` `@media (max-height:820px) and (pointer:coarse)` |
| N-127 A | clock-house / find-diff / match-stars 同档 |
| N-132 | `MIN_TOUCH_PX` 40→44 |
| N-137 | `MIN_BODY_FONT_PX` 14→16（仅 kit 常数+消费测试） |
| N-135 A | `.bd-back` min-height:44 |
| N-130 A | `.qz-msg` / `.fdf-msg` / `.mst-msg` ≥16 |
| N-125 / N-126 / N-129 / N-133 / N-134 / N-135 B 三款 | B 独占，书面留给 B |
| N-100 ×17 / N-97 | 无头未点 17 款 continue，降级下轮带 Chrome 抽验 |

## 三视口口径

| 项 | 390×844 | 915×412 | 1024×768 |
| --- | --- | --- | --- |
| N-117 族 | 徽章单行 | 无 136 盲区 + pan-y | 单行 |
| N-99 | wrap 可滚 | 键 sticky+可滚到底 | 同左 |
| N-131/127 | 500 档仍管 412 | 500 档 | 820×coarse 收题面，选项 ≥44 |
| N-135 | `.bd-back` ≥44 | 同左 | 同左 |

## 测试

`npx vitest run` / `npm run build` 本拍增量 `src/games/level99.r22.test.ts`。
