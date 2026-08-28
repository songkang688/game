# 三人组 r45 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。playbook：PR #118。不回退安全区 / `--vv-h` / CTA 回卷 / 平板 wrap 760 / 既有闸。不改 B 的 `.shr-back`（N-195）。N-105 无第四版。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-196 | `.l99-continue` 已有 `min-height:44px`（N-138），只回归。不改 padding、不抢 `.l99-back`/tool/tab。 |
| N-197 | 静态扫可点 `*-continue` ≥44。库内仅 `.l99-continue` 且已绿。不扫 `.shr-back`。 |

## 上拍：915/1024 刘海与 home 条

Chrome（preview `:4188`，时钟小屋，CDP `setSafeAreaInsetsOverride`）：左右 47 + 底 21 时返回仍 ≥44 可点，继续在地图盒顶（915：66–110，1024：110–154），不被 home 条挡住。壳层 CSS 不改。
