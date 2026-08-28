# r49 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r49-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。r20–r48 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑。读 **r38**～**r48** 与 tester A r47–r50。

**纪律**：**凡 `.l99-*` 只给 A**。B 禁止改 `level99.ts` / `dialogs.ts` / 暂停 overlay / 首页 `touch-action`。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r49 动作 |
| --- | --- | --- |
| N-94～N-108 / C-5 / N-29 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…197 | #87 / #90～#118 | 勿重开 |
| N-198 | #119 r46 | A `.l99-*` 热区地板 |
| N-199 | #119 r46 | B `.bl-btn` |
| N-200 | #119 r46 | = B 修 N-195 |
| **N-201** | **tester A r47** | **首页横滑 `pan-x pan-y` + 暂停 `.btn` 58**。学习勿占此义 |
| **N-202** | **tester A r48** | **暂停弹窗矮横屏收边**。学习勿占此义 |
| **N-203** | **tester A r49** | **结算 overlay 可滚**。学习勿占此义 |
| **N-204** | **tester A r50** | **overlay 矮档钉 CTA + pan-y**。r48 学习把本号写成 `.oa-back` **作废** |
| N-205 / N-206 | r48 学习热区（#121） | 本轮改挂 N-208 / N-209，避免贴着 A 的 201–204 壳层号 |
| **N-207 起** | **本轮新开** | 见 §2，全是游戏内大厅返回，**不是**暂停/overlay/横滑 |

**并号**：r48 §0 并号仍适用。**`.l99-*` → 只 A（N-138 / N-198）**。N-201～N-204 **不要**再写成返回钮、巡检、暂停或 overlay。`.shr-toggle` → N-134（36）。`.pk-go` → N-173。`.ba-lv` → N-192。`.bl-btn` → N-199。`.shr-back` → N-195。`.bl-back` / `.bd-back` → 仍 **N-135**。fruit-stack `.fs-back` 主干已 44。

**在途**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#121** / **#107**。A 的 `shell.r47`～`r50.test.ts` 勿回退。

---

## 1. 读 r38–r48 与主干

### 1.1 勘误

| 号 | 曾写 | 先合 / A | 本轮 |
| --- | --- | --- | --- |
| N-201 | r47 `.oa-back` | A 横滑+暂停 58 | **勿再派** |
| N-202 | r47 钓鱼 `.fs-back` | A 暂停弹窗 | **勿再派** |
| N-203 | r47 `*-back` 巡检 | A overlay 可滚 | **勿再派** |
| N-204 | r48 `.oa-back` | A overlay 矮档钉 CTA | **学习义作废**；光球返回改 **N-207** |
| N-205 | r48 钓鱼 `.fs-back` | 未与 A 撞义，但贴壳层号 | 改 **N-208** |
| N-206 | r48 `*-back` 巡检 | 易被当成 overlay 号 | 改 **N-209** |

### 1.2 学习交卷（均未合主干）

| 轮 | PR | 号 |
| --- | --- | --- |
| r38…r46 | #111～#119 | N-174…200 |
| r47 | #120 | 自称 201–203，与 A 全撞 |
| r48 | #121 | 自称 204–206；204 与 A overlay 矮档撞号 |

### 1.3 本轮新扫到、但**不开号**

| 主题 | 理由 |
| --- | --- |
| `.l99-*` / overlay 可滚 / 矮档钉 CTA | N-198 / N-203 / A 的 N-204，只 A |
| 首页横滑 / 暂停弹窗 / `.btn` 58 | N-201 / N-202 |
| `.shr-back` / `.bl-btn` | N-195 / N-199 |
| `.bl-back` / `.bd-back` | N-135 |
| fruit-stack `.fs-back` | 主干已 44 |
| `.dc-mode` 族 | padding 14 |
| 坦克双垫 | #107 |

---

## 2. 本轮新开（N-207 起）

**禁止**：暂停弹窗、结算 overlay 可滚/钉 CTA、首页横滑、任何 `.l99-*` 给 B。

### N-207 · B · orb-arena `.oa-back`

r47/r48 误挂在 N-201 / N-204 上。**证据**：`src/games/orb-arena/index.ts` ≈L115 `padding:7px 13px;font-size:14px`，无 min-height，估高 ≈30.8。挂载 ≈L953。`.oa-open` / `.oa-btn` 已 ≥44。

**边界**：N-135 捆四款返回，本号只打光球。若 N-135 先合已含 44，本号销。

**建议**：`.oa-back { min-height: 44px; }`。勿改技能 / overlay / `level99.ts`。

### N-208 · B · fishing-star `.fs-back`

r47/r48 误挂在 N-202 / N-205。**证据**：`src/games/fishing-star/index.ts` ≈L227 `padding:6px 12px;font-size:13px`，无 min-height，估高 ≈27.6。挂载 ≈L2035「◀ 回选关」。

**边界**：不是暂停弹窗。`fruit-stack` 同名 `.fs-back` 已 44，禁止改。`.fs-act` → N-157。

**建议**：`.fs-back { min-height: 44px; }`。勿改收线。

### N-209 · A · 游戏内大厅 `*-back` 巡检（不含 `.l99-*`）

r47/r48 误挂在 N-203 / N-206。**禁止**写成 overlay `overflow-y:auto` 或暂停收边。

扫 `src/games/**/*.{css,ts}` 的 `.-back{` 可点块须 `min-height`≥44。**排除全部 `.l99-*`**。`.l99-overlay` 可滚是 **N-203**。

本轮应变绿：N-207 / N-208。仍可红：`.bl-back` / `.bd-back`（N-135）。绿对照：`.sr-back` / `.as-back` / `.tkb-back` / fruit-stack `.fs-back`。

---

## 3. 给 A / B

- **A**：守 N-201～N-204 壳层（横滑、暂停、overlay 可滚/钉 CTA）+ N-198 + **N-209**。不要等 B。
- **B**：N-195、N-199、**N-207**（`.oa-back`）、**N-208**（钓鱼 `.fs-back`）。**零改 `level99.ts` / `dialogs.ts` / `.home-screen` touch-action。** 不要改 `SKY_H`。不要抬 `.shr-toggle`。
- **C-8** 禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-210**。N-207…N-209 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r49-learn-notes-1cd5`
