# r51 Playbook · 测试员 C → A/B

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。零改 `src/**`（本文档作者）。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。C-8 禁改 `SKY_H`。

**本轮新号**：**N-213**（B `.blp-open`）、**N-214**（B `.brk-open`）、**N-215**（A `*-open` 巡检）。下一空号 **N-216**。

**纪律**：`.l99-*` **只给 A**。不要重复已落地 back / N-201～204 壳层。

**撞车**：先合入 `game-1.3` 的为准。

---

## 红线

1. C 只交两份 md。
2. **B 禁止改 `level99.ts`、暂停 overlay、`dialogs.ts`、首页 touch-action、任何已开 `*-back`。**
3. 勿再派：`.oa-back`、钓鱼 `.fs-back`、`.bd-back`、`.bl-back`、A r51 back 清单、`.bl-btn`（N-199）。
4. 在途：#94 / #96 / #99 / #104 / **#105～#123** / #107。
5. balloon **勿改 `SKY_H`**。

---

## 本轮工单

### N-213 · B · `.blp-open`

| 项 | 内容 |
| --- | --- |
| 文件 | `src/games/balloon-pop/index.ts` ≈L169；挂载 ≈L1144 / L874 |
| 现状 | padding 9+字 14，规则内无 min-height |
| 不做 | 不改 `.blp-back` / `SKY_H` / 气球物理 |
| 验收 | 大厅无尽入口 ≥44 |

### N-214 · B · `.brk-open`

| 项 | 内容 |
| --- | --- |
| 文件 | `src/games/brick-break/index.ts` ≈L133；挂载 ≈L1674 / L1377 |
| 现状 | 同套 padding，规则内无 min-height |
| 不做 | 不改 `.brk-back` / `.brk-btn` / 砖塔判定 |
| 验收 | 大厅无尽入口 ≥44 |

### N-215 · A · `*-open` 巡检

| 项 | 内容 |
| --- | --- |
| 范围 | `src/games/**/*.{css,ts}` |
| 规则 | `.-open{` 可点块须 min-height≥44 |
| **排除** | `.l99-*`；不扫 `*-back`（N-205） |
| 本轮应变绿 | N-213 / N-214 |

---

## 建议顺序

1. A 守壳层与 back 闸，并行 N-215。
2. B 分 PR 修气球 / 砖塔 **open**。
3. 回归：back 清单不要回退、暂停 58、overlay 可滚、C-8 天空高度。

---

## 本拍未覆盖

无头 Chrome 未跑。B 补测两款大厅无尽入口。
