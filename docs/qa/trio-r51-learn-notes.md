# r51 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r51-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。r20–r50 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑。读 **r38**～**r50**、tester A r47–r51。

**纪律**：**凡 `.l99-*` 只给 A**。不要重复已落地的 `*-back` 与壳层号。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r51 动作 |
| --- | --- | --- |
| N-94～N-200 | 主干 / #87～#119 | 只回归 / 勿重开 |
| **N-201～N-204** | **tester A 壳层** | 横滑 / 暂停弹窗 / overlay 可滚 / 钉 CTA。**勿占** |
| N-205 | tester A r51 大厅 `*-back` 闸 | 本分支 overlay 号已占 203；A 用 **N-205** 扫 back。**学习勿再派 back 清单** |
| N-206 | r48 学习让路号 | 勿重开 |
| N-207 / N-208 | r49 + **B 已落地** | **`.oa-back`、钓鱼 `.fs-back` 勿再派** |
| N-209 / N-212 | r49/r50 `*-back` 巡检 | 勿再开同义号 |
| N-210 / N-211 | r50 #123 | `.bd-back` / `.bl-back` **勿再派**（A r51 亦在抬 `bl-back`） |
| **N-213 起** | **本轮新开** | 见 §2，**大厅 `*-open`**，不是 back、不是壳层 |

**并号 / 已落地 back 勿重派**：`.oa-back`、钓鱼 `.fs-back`、fruit-stack `.fs-back`、`.shr-back`（N-195）、`.bd-back`（N-210）、`.bl-back`（N-211 / A 清单）、A r51 清单 `as-back blp-back brk-back bbp-back frc-back ld-back mp-back pz-back rbe-back sn-back`。`.l99-back` → N-198。`.bl-btn` → N-199。N-201～204 壳层。

**在途**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#123** / **#107**。A `lobbyBack.n205.test.ts` / `shell.r47`～`r50` 勿回退。

---

## 1. 读 r38–r50 与主干

### 1.1 不要再派

| 主题 | 理由 |
| --- | --- |
| 壳层横滑 / 暂停 / overlay | N-201～204 |
| 全部 `.l99-*` | N-198，只 A |
| 上表 back 清单 | 已落地或已开号 |
| `.bl-btn` | N-199 |
| 坦克双垫 | #107 |
| balloon **C-8** `SKY_H` | 禁改 |

### 1.2 本轮新扫到、但**不开 back 号**

`touchUpliftCss([".blp-open",".blp-back"])` / `brk-open` 同款：补丁层可能已 44，但**本地规则块仍无 min-height**（与 l99 内联 CSS 同病）。A 已收 **back**；本轮只拆 **open**。

---

## 2. 本轮新开（N-213 起）

### N-213 · B · balloon-pop 大厅入口 `.blp-open`

**证据**：`src/games/balloon-pop/index.ts` ≈L169：

```text
.blp-open { … padding: 9px 14px; font-size: 14px; … cursor: pointer; … }
```

规则内无 `min-height`。估高 `9×2 + 14×1.2 ≈ 34.8`。挂载 ≈L1144 无尽、≈L874 再来。同文件 L195 有 `touchUpliftCss`，静态扫本地块仍红。

**边界**：**不要**改 `.blp-back`（A r51 / 已开 back）。**勿改 `SKY_H`**（C-8）。N-180 是 `.sn-open`。N-149 首例 `.sks-mode`。若 N-149 先合且已含 `.blp-open` 44，本号销。

**建议**：`.blp-open { min-height: 44px; }`。测无尽入口。勿改气球物理。

### N-214 · B · brick-break 大厅入口 `.brk-open`

**证据**：`src/games/brick-break/index.ts` ≈L133 同套 padding 9+字 14，无 min-height。挂载 ≈L1674 无尽、≈L1377 再来。L143 `touchUpliftCss([".brk-open",".brk-back"])`。

**边界**：勿改 `.brk-back`（A 清单）。`.brk-btn` 已 56 高。若与 N-213 同游戏族可分 PR。

**建议**：`.brk-open { min-height: 44px; }`。勿改砖塔判定。

### N-215 · A · 大厅 `*-open` 巡检（不含 `.l99-*`、不含已开 back）

扫 `.-open{` 可点块须 `min-height`≥44（或 TOUCH 插值写在**本规则**）。**排除** `.l99-*`。已开实例：`.sn-open` N-180、`.mmc-open` N-186、`.fs-open`/多数 `min-height:44`。本轮应变绿：N-213 / N-214。

**不要**把本号写成 `*-back` 巡检（N-205 / N-209 / N-212）。不要测暂停/overlay。

---

## 3. 给 A / B

- **A**：守 N-201～205 壳层/back 闸 + N-198。收 **N-215**。不要改 B 的 open 文件抢修 back。
- **B**：**只** N-213 / N-214。不要再提任何 `*-back`、不要改 `SKY_H`、不要改 `level99.ts`。
- N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-216**。N-213…N-215 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r51-learn-notes-1cd5`
