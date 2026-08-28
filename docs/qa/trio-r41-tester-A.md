# 三人组 r41 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。playbook：PR #114。不回退平板 wrap 760、CTA 回卷、N-176/179/182。不改 B 游戏文件（N-183 `.pcp-act`、N-184 `.hh-catch`）。N-105 无第四版。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-185 | 静态扫可点 `*-catch` ≥44 或 TOUCH 插值。库内仅 `.hh-catch`（`padding:4px 9px`，无 min-height），走 B 文件白名单。不扫 `.hh-deck` / `.hh-back*` / `.hh-card`。不替代 N-148/184。 |

闸在 `level99.r38.test.ts`。未改 `hue-hand/index.ts`。

## 壳层安全区 / 地址栏（本拍）

`.screen.game-screen`：左右 `max(原 padding, env(safe-area-inset-*))`，底仍 `safe-area-inset-bottom`。顶沿用已有 `.screen { padding-top: max(18px, env(safe-area-inset-top)) }`，刘海不挡「返回」。`--vv-h` 跟 `visualViewport.height`；未注入时 `max-height: 100svh`，避免 390 竖屏地址栏展开后 100dvh 仍按大视口裁 `.l99-view`。不回退 CTA 回卷、平板 wrap 760、N-118。

Chrome 390×844 时钟小屋：`--vv-h:844px`，返回 top=33 可点，继续 top=148 可点。模拟地址栏 `--vv-h:700px` 后 `.game-screen` 高 700（不再卡 844），`.l99-view` 出现 66px 余量可滚，继续/返回仍 hitSelf。
