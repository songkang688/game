# 三人组第 33 轮 · 测试修复员 B（N-159 / N-160）

> 同分支。Playbook：`trio-r33-playbook.md`。不改描红画板；不改 `clf-tight` 里 tool/swatch 热区。N-105 零 hunk。

## 号账

| # | 修法 |
| --- | --- |
| **N-159** | `.wgd-garden-flower` 34→44；花行 `min-height` 同步 44 |
| **N-160** | `.clf-work` 补 `min-width/min-height:44px` |

## 三视口

花钮与作品缩略图均为写死 44 边长 / min-height 44。实机注入花钮后边长 44；画廊空态无 `.clf-work` 实例时以 CSS 守门。`clf-tight` 注释仍写明 tool/swatch/primary/zoom 44 不动。

## 测试

`hotspot.r31b.test.ts`。color-fun `stageFit` / `visual13` 绿。
