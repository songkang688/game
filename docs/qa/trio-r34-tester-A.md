# 三人组 r34 测试员 A

> 同分支。不抢 N-162 排行榜 summary、N-163 `.cg-log-sum`。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-164 | 静态扫 `src/games/**/*.{ts,css}` 与 `src/styles.css` 里 `summary` / 可点 `*-sum`。须 `min-height`≥44 或 padding+字号估高 ≥44。内联 CSS 与 `.css` 一起扫。N-162/163 选择器白名单；扫描器单测证明裸 summary 会判红。 |

不替代 N-161。装饰 span 不扫。
