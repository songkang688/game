# 三人组 r51 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。执行 PR #120（r47 学习票）标给 A 的大厅 `*-back` 巡检。不改 B 的钓鱼 `.fs-back`、光球 `.oa-back`。不回退 overlay 竖滚 / 915 收边。N-105 无第四版。

## 号

学习票把「大厅 `*-back`」写成 **N-203**。本分支 **N-203/N-204 已是结算 overlay**，本拍闸用 **N-205**，不改 overlay 号语义去抢票。

## 本拍

静态扫可点 `*-back` ≥44（或 TOUCH 插值）。排除 `.l99-*`、`.fs-back`、`.oa-back`、`.shr-back`、B 白名单文件。

缺 44 的大厅返回（只加 `min-height`，不改 padding）：

`as-back` `blp-back` `bl-back` `brk-back` `bbp-back` `frc-back` `ld-back` `mp-back` `pz-back` `rbe-back`（36→44）`sn-back`。

闸漏的色条 / 双类名（本拍补上，仍不改 padding）：

`xq-back` `gmk-back`（`${MIN_HIT_PX}`）`dua-back` `mn-back` 色条、`slb-back`（钮本身已是 `.slb-btn` 48）。

水果叠叠 `.fs-back` 已有 44，闸按文件排除钓鱼、仍扫叠叠。不改 `fishing-star` / `orb-arena`。

闸：`src/games/lobbyBack.n205.test.ts`。
