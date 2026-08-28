# 三人组 r42 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。playbook：PR #115。不回退安全区 / `--vv-h` / CTA 回卷 / 平板 wrap 760 / N-176…185。不改 B 游戏文件（N-186 `.mmc-open`、N-187 `.mmc-toggle`）。`.shr-toggle` 仍归 N-134。N-105 无第四版。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-188 | 静态扫可点 `*-toggle` ≥44 或 `TOGGLE_MIN_H` 插值。`.mmc-toggle` 走 memory-cards 白名单。不扫 `.shr-toggle`。对照绿 `.snk-toggle`。不替代 N-134/187。 |

闸在 `level99.r38.test.ts`。未改 `memory-cards/index.ts`、`shoot-range/index.ts`。
