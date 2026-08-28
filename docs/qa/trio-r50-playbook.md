# r50 Playbook · 测试员 C → A/B

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。零改 `src/**`（本文档作者）。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。C-8 禁改 `SKY_H`。

**本轮新号**：**N-210**（B `.bd-back`）、**N-211**（B `.bl-back`）、**N-212**（A `*-back` 续扫）。下一空号 **N-213**。

**纪律**：`.l99-*` **只给 A**。不要占用 N-201～204 壳层义。**不要再派 `.oa-back` / 钓鱼 `.fs-back`（B 已落地）。**

**撞车**：先合入 `game-1.3` 的为准。

---

## 红线

1. C 只交两份 md。
2. **B 禁止修改 `level99.ts`、`.l99-*`、暂停 overlay、`dialogs.ts`、`.home-screen` touch-action。**
3. 勿重开 `.oa-back`、钓鱼 `.fs-back`、N-201～204 壳层。
4. 在途：#94 / #96 / #99 / #104 / **#105～#122** / #107。
5. 勿改 `SKY_H`。勿抬 `.shr-toggle`（36）。`.bl-btn` 走 N-199，不要和 `.bl-back` 捆一单（除非 B 自愿同文件分 commit）。

---

## 本轮工单

### N-210 · B · `.bd-back`

| 项 | 内容 |
| --- | --- |
| 文件 | `src/games/block-drop/index.ts` ≈L173；挂载 ≈L1113 |
| 现状 | padding 7+字 14，无 min-height |
| 不做 | 不改 `.bd-open` / 落子 / overlay |
| 验收 | 大厅返回 ≥44 |

### N-211 · B · `.bl-back`

| 项 | 内容 |
| --- | --- |
| 文件 | `src/games/bowling-lane/index.ts` ≈L161；挂载 ≈L1187 |
| 现状 | padding 6+字 13，无 min-height |
| 不做 | 不改 `.bl-btn`（N-199）/ `.bl-pick` / 投球 |
| 验收 | 「回选关」≥44 |

### N-212 · A · `*-back` 巡检续扫

| 项 | 内容 |
| --- | --- |
| 范围 | `src/games/**/*.{css,ts}` |
| 规则 | `.-back{` 可点块 min-height≥44 |
| **排除** | `.l99-*`；不测暂停/overlay/横滑 |
| **不派 B** | `.oa-back`、钓鱼 `.fs-back` |
| 本轮应变绿 | N-210 / N-211 |

---

## 建议顺序

1. A 守壳层 N-201～204，并行 N-198 / N-212。
2. B 只开 **N-210**、**N-211** 分 PR。
3. 回归：横滑、暂停 58、overlay 可滚、光球/钓鱼返回不要回退。

---

## 本拍未覆盖

无头 Chrome 未跑。B 补测方块/保龄大厅返回。
