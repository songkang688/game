# r50 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r50-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。r20–r49 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑。读 **r38**～**r49**。

**纪律**：**凡 `.l99-*` 只给 A**。B 禁止改 `level99.ts` / `dialogs.ts` / 暂停 overlay / 首页 `touch-action`。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r50 动作 |
| --- | --- | --- |
| N-94～N-108 / C-5 / N-29 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…197 | #87 / #90～#118 | 勿重开 |
| N-198 | #119 r46 | A `.l99-*` 热区地板 |
| N-199 | #119 r46 | B `.bl-btn`（≠ `.bl-back`） |
| N-200 | #119 r46 | = B 修 N-195 |
| **N-201～N-204** | **tester A 壳层** | 横滑 / 暂停弹窗 / overlay 可滚 / overlay 矮档钉 CTA。**学习勿占这些义** |
| N-205 / N-206 | r48 学习（#121） | 让路过，勿重开 |
| N-207 / N-208 | r49 #122 + **B 已落地** | **`.oa-back`、钓鱼 `.fs-back` 不要再派** |
| N-209 | r49 #122 | `*-back` 巡检；本轮用 N-212 续扫余量 |
| **N-210 起** | **本轮新开** | 见 §2 |

**并号**：**`.l99-*` → 只 A**。N-201～204 壳层勿重写。`.oa-back` / 钓鱼 `.fs-back` **本轮零工单**。`.shr-toggle` → N-134（36）。`.pk-go` → N-173。`.ba-lv` → N-192。`.bl-btn` → N-199。`.shr-back` → N-195。fruit-stack `.fs-back` 主干已 44。`.dc-mode` 族 padding 14。

**在途**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#122** / **#107**。A 的 `shell.r47`～`r50.test.ts` 勿回退。

---

## 1. 读 r38–r49 与主干

### 1.1 不要再派

| 选择器 / 义 | 理由 |
| --- | --- |
| 首页横滑 / 暂停弹窗 / overlay 可滚 / 钉 CTA | N-201～204，只 A |
| 全部 `.l99-*` | N-198，只 A |
| `.oa-back` | **B 已落地**（r49 N-207） |
| 钓鱼 `.fs-back` | **B 已落地**（r49 N-208）；fruit-stack 同名已绿 |
| `.shr-back` / `.bl-btn` | N-195 / N-199 |
| 坦克双垫 | #107 |

### 1.2 学习交卷（均未合主干）

| 轮 | PR | 号 |
| --- | --- | --- |
| r38…r46 | #111～#119 | N-174…200 |
| r47 | #120 | 201–203 与 A 撞号 |
| r48 | #121 | 204–206；204 与 A overlay 矮档撞 |
| r49 | #122 | 207–209；其中 207/208 选择器 B 已落地 |

### 1.3 主干仍红、本轮可拆

N-135 原文捆 bowling / fishing / orb / block-drop 四款返回。fruit-stack 另文件 `.fs-back` 已 44。光球与钓鱼 B 已落地。**余两颗**仍无 min-height：`.bd-back`、`.bl-back`。

---

## 2. 本轮新开（N-210 起）

**禁止**：暂停、overlay、横滑、`.l99-*` 给 B、再派 `.oa-back` / 钓鱼 `.fs-back`。

### N-210 · B · block-drop `.bd-back`

**证据**：`src/games/block-drop/index.ts` ≈L173：

```text
.bd-back{…padding:7px 13px;font-size:14px;…cursor:pointer;…}
```

无 `min-height`。估高 `7×2 + 14×1.2 ≈ 30.8`。挂载 ≈L1113 `className = "bd-back"`。`.bd-open` 已 44。

**边界**：N-135 捆号余量。本号只打 **方块掉落大厅返回**。勿改 `.bd-open` / 落子。若 N-135 先合已含 44，本号销。

**建议**：`.bd-back { min-height: 44px; }`。

### N-211 · B · bowling-lane `.bl-back`

**证据**：`src/games/bowling-lane/index.ts` ≈L161：

```text
.bl-back{…padding:6px 12px;font-size:13px;…cursor:pointer;…}
```

无 `min-height`。估高 `6×2 + 13×1.2 ≈ 27.6`。挂载 ≈L1187 `button("bl-back", "◀ 回选关")`。`.bl-pick` / `.bl-roll` 已 44；`.bl-btn` 走 **N-199**，本号不要动 HUD 暂停/继续。

**边界**：N-135 余量。≠ N-199。若 N-135 先合已钉，本号销。

**建议**：`.bl-back { min-height: 44px; }`。勿改投球。

### N-212 · A · `*-back` 巡检续扫（不含 `.l99-*`）

续 r49 N-209。**禁止**写成 overlay 可滚或暂停收边。

扫 `.-back{` 可点块须 `min-height`≥44。**排除全部 `.l99-*`**。本轮 **不要**再要求 B 改 `.oa-back` / 钓鱼 `.fs-back`（已落地；主干未合则闸可标 skip 或对 B 分支断言）。

本轮应变绿：N-210 / N-211。绿对照：`.sr-back` / `.as-back` / `.tkb-back` / fruit-stack `.fs-back`。

---

## 3. 给 A / B

- **A**：守 N-201～N-204 + N-198。收 **N-212**。不要等 B。不要把 `.l99-*` 派 B。
- **B**：N-195、N-199 若仍未合则继续；**新单只有 N-210 / N-211**。不要再提 `.oa-back` / 钓鱼 `.fs-back`。不要改 `SKY_H` / 暂停 overlay / 首页横滑。
- **C-8** 禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-213**。N-210…N-212 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r50-learn-notes-1cd5`
