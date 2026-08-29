# 三人组 r52 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。执行即将文档的 r51 **N-215** 大厅 `*-open` 巡检。排除 `.l99-*`。气球 `.blp-open`、砖塔 `.brk-open` 归 B。不回退 overlay / 安全区 / N-205 大厅 `*-back` 闸。N-105 无第四版。

## 本拍（N-215）

静态扫可点 `*-open` ≥44（或 TOUCH 插值）。排除 `.l99-*`、`.blp-open`、`.brk-open`、B 白名单文件。

缺 44 的大厅入口（只加 `min-height:44px`，不改 padding）：

`frc-open`（接水果）`bbp-open`（泡泡，`visual.ts` 已有 TOUCH 抬升，本拍把 `index.ts` 主规则也写上）`mp-open`（地鼠主规则；后面 `.mp-open,.mp-back{min-height:44px}` 仍在）。

未改：`balloon-pop`、`brick-break`、combo-clash / mahjong-bloom 字号（N-105）。

闸：`src/games/lobbyOpen.n215.test.ts`。N-205 `lobbyBack.n205.test.ts` 不回退。
