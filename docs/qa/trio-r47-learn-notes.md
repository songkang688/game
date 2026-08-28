# r47 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r47-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**。r20–r46 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑。读 **r38**～**r46**。

**纪律（本轮再钉一次）**：**凡 `.l99-*` 一律给 A**。r45 N-196 把 `.l99-continue` 标给 B **对 B 作废**（r46 已勘误）。**B 禁止改 `level99.ts`。**

---

## 0. 号段权威（先合版）

| 段 | 权威 | r47 动作 |
| --- | --- | --- |
| N-94～N-108 / C-5 / N-29 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | #87 / #94 / #96 | 勿重做 |
| N-125…137 | #90～#93 | 勿重开 |
| N-138…140 | #95 r26 | `.l99-*` **只 A** |
| N-141…194 | #97～#117 | 勿重开 |
| N-195 | #118 r45 | `.shr-back` **B**，仍有效 |
| N-196 | #118 r45 | **对 B 作废**；continue 并入 N-198 A |
| N-197 | #118 r45 | A `*-continue` 仍有效 |
| N-198 | #119 r46 | A 全部 `.l99-*`，**勿重开、勿派 B** |
| N-199 | #119 r46 | B `.bl-btn`，仍有效 |
| N-200 | #119 r46 | = B 去修 N-195，不新开选择器 |
| **N-201 起** | **本轮新开** | 见 §2 |

**并号（勿新开）**：r46 §0 仍适用。**`.l99-back` / tool / tab / ov-btn / continue / node → 只 A（N-138 / N-198）**。`.shr-toggle` → N-134（36）。`.pk-go` → N-173。`.ba-lv` → N-192。`.bl-btn` → **N-199**（旧捆 N-145）。`.bl-pick` 已 44。`.shr-back` → **N-195**。四款返回 **N-135**：fruit-stack `.fs-back` **主干已 44**；bowling / fishing / orb / block-drop 仍红，本轮只拆两颗（§2），**不要**再把整捆重开一遍。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#119** / **#107**。

---

## 1. 读 r38–r46 与主干

### 1.1 勘误

| 项 | 错写 | 本轮 |
| --- | --- | --- |
| `.l99-*` | r45 把 continue 给 B | **一律 A**；N-198 收口 |
| N-200 | 空号歧义 | 并账 N-195，下一空号从 **N-201** 起 |

### 1.2 r38–r46 交卷（均未合主干）

| 轮 | PR | 号 |
| --- | --- | --- |
| r38 | #111 | N-174…176 |
| r39 | #112 | N-177…179 |
| r40 | #113 | N-180…182 |
| r41 | #114 | N-183…185 |
| r42 | #115 | N-186…188 |
| r43 | #116 | N-189…191 |
| r44 | #117 | N-192…194 |
| r45 | #118 | N-195…197（continue 误标 B） |
| r46 | #119 | N-198…N-200 |

### 1.3 壳层实测口径

`src/styles.css` 已有 `.l99-wrap .l99-tab/.l99-tool/.l99-back/.l99-continue { min-height:44px }` 与 `.l99-ov-btn` 48。**`level99.ts` 内联 CSS 仍无 min-height**（r26 静态断言扫的是字符串）。A 仍须在 **N-198** 把地板写进 `level99.ts`，不要派 B 去改 styles 补丁层。`.l99-node` 补丁层已 44×44，**不要派 B**。

### 1.4 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| 全部 `.l99-*` | **N-198 / A** |
| `.shr-back` / `.shr-toggle` | N-195 / N-134（36） |
| `.bl-btn` | **N-199** |
| `.bl-pick` / `.bl-roll` | 已 44 |
| `.pk-go` | N-173 |
| `.ba-lv` / `.cs-lv` | N-192/193 |
| `.bl-back` | 仍走 **N-135**（本轮不拆第三颗） |
| fruit-stack `.fs-back` | **主干已 44** |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding 14；并 N-146/N-149 边缘 |
| `.mg-mile` | 庆祝层 |
| 坦克双垫 / `.tkb-mini-btn` | 已 44；双垫走 **#107** |

---

## 2. 本轮新开（N-201 起）

### N-201 · B · orb-arena 大厅返回 `.oa-back`

**纪律**：不是 `.l99-*`。

**证据**：`src/games/orb-arena/index.ts` ≈L115：

```text
.oa-back{…padding:7px 13px;font-size:14px;…cursor:pointer;…}
```

无 `min-height`。估高 `7×2 + 14×1.2 ≈ 30.8`。挂载 ≈L953 `className = "oa-back"`。同文件 `.oa-open` / `.oa-btn` 已 ≥44。

**与旧号边界**：N-135 原文捆 bowling / fishing / orb / block-drop 四款返回。fruit-stack 另有一颗同名 `.fs-back` **已绿，勿动**。本号只打 **光球 `.oa-back`**。若 N-135 先合且已含本选择器 44，本号销。

**建议**：`.oa-back { min-height: 44px; }`。测选关点返回。勿改技能键 / `.oa-open` / 判定。

### N-202 · B · fishing-star 大厅返回 `.fs-back`

**证据**：`src/games/fishing-star/index.ts` ≈L227：

```text
.fs-back{…padding:6px 12px;font-size:13px;…cursor:pointer;…}
```

无 `min-height`。估高 `6×2 + 13×1.2 ≈ 27.6`。挂载 ≈L2035 `button("fs-back", "◀ 回选关")`。`.fs-open` 已 `TOUCH_MIN_PX`；`.fs-act` 走 **N-157**（矮档砍垫）。

**与旧号边界**：N-135 捆了本选择器。`src/games/fruit-stack/index.ts` 的 `.fs-back` **已 44**，类名碰巧相同，**禁止**当成同一颗去改。本号只改 **钓鱼** 那份。若 N-135 先合且已钉钓鱼 `.fs-back`，本号销。

**建议**：`.fs-back { min-height: 44px; }`。测图鉴/装备页返回选关。勿改收线 / `.fs-act`。

### N-203 · A · 游戏内大厅 `*-back` 静态巡检（不含 `.l99-*`）

**纪律**：扫描结果里若出现 `.l99-back`，**并入 N-198，不要给 B 开单**。

**证据**：主干仍红的大厅返回（均无 min-height）：

| 选择器 | 文件 | 号 |
| --- | --- | --- |
| `.oa-back` | orb-arena | 本轮 N-201 |
| `.fs-back` | **fishing-star** | 本轮 N-202 |
| `.bl-back` | bowling-lane | 仍 **N-135** |
| `.bd-back` | block-drop | 仍 **N-135** |
| `.l99-back` | level99.ts | **N-198 A**，本号不扫给 B |

绿对照：`.sr-back` / `.as-back` / `.tkb-back` / fruit-stack `.fs-back` / `.sn-back`（N-147）/ `.pz-back`。

N-147 原文 = 蛇/拼图；N-135 是四款捆；N-195 是射击。本号扫 **`.-back{` 且 cursor:pointer / button**，必须 `min-height`≥44。豁免：牌背 `.hh-back*`、非按钮。

**建议**：N-201/202 修完应变绿两颗。`.bl-back` / `.bd-back` 仍红不算本号失败，记在 N-135。N-198 修完 `.l99-back` 应变绿。勿与 N-135/147/195/198 并号。

---

## 3. 给 A / B

- **A**：N-198（所有 `.l99-*`）+ N-197 + **N-203**。不要等 B。不要把 `.l99-*` 写进 B 的 PR。
- **B**：N-195（`.shr-back`）+ N-199（`.bl-btn`）+ **N-201**（`.oa-back`）+ **N-202**（钓鱼 `.fs-back`）。**零改 `level99.ts`。** 不要改 `SKY_H`、不要抬 `.shr-toggle`、不要跟 #107 抢坦克。`.bl-back` / `.bd-back` 本轮仍走 N-135，勿另开。
- **C-8** 禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-204**。N-201…N-203 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r47-learn-notes-1cd5`
