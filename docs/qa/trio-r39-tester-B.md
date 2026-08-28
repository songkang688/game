# 三人组第 39–41 轮 · 测试修复员 B

> 同分支 `cursor/trio-r21-tester-b-1cd5`。Playbook：PR #112–#114（`trio-r39`…`trio-r41-playbook.md`）。
> 不改 A 的 `level99` / `home` / `src/art/kit/**`。不回退 N-174/175 与 820 中间档。N-105 零 hunk。

## 号账

| # | 修法 |
| --- | --- |
| **N-177** | `.dvs-lessonbtn` 补 `min-height:44px` |
| **N-178** | `.dvs-mode` 补 `min-height:44px`；`.dvs-pick` / `.dvs-go` / `.dvs-over button` / `.dvs-pad` 原文 |
| **N-180** | `.sn-open` 补 44 + inline-flex；`.sn-back` / `.snk-toggle` 不动 |
| **N-181** | 本分支基规则已 44，只回归；不回退 N-87 顶钉 / N-122 竖钉 / N-165/166 |
| **N-183** | `.pcp-act` 本分支已 44（N-151），只回归 |
| **N-184** | `.hh-catch` 本分支已 44（N-148），只回归 |

## 测试

`src/games/hotspot.r39b.test.ts`。
