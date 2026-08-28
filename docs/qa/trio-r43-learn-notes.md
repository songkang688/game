# r43 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r43-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r42 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**（N-174…176）、**r39**（N-177…179）、**r40**（N-180…182）、**r41**（N-183…185）、**r42**（N-186…188）。本轮兑现 r42 记下的下一空号：红蓝点 **对战结算 `.rbt-vs-btn`** 与闯关 overlay 复制体 **`.rte-btn`**（padding 12 + 字 16，估高 ≈43.2）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r43 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B | 只回归 |
| N-95～N-108 / C-5 / N-29 尾款 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | PR **#87**；A **#94**、B **#96** | 勿重做 |
| N-125…128 | PR **#90** r22 | 勿重开 |
| N-129…131 | PR **#91** r23 | 勿重开 |
| N-132…134 | PR **#92** r24 | 勿重开 |
| N-135…137 | PR **#93** r25 | 勿重开 |
| N-138…140 | PR **#95** r26 | 勿重开 |
| N-141…143 | PR **#97** r27 | 勿重开 |
| N-144…146 | PR **#98** r28 | 勿重开 |
| N-147…149 | PR **#100** r29 | 勿重开 |
| N-150…152 | PR **#101** r30 | 勿重开 |
| N-153…155 | PR **#102** r31 | 勿重开 |
| N-156…158 | PR **#103** r32 | 勿重开 |
| N-159…161 | PR **#105** r33 | 勿重开 |
| N-162…164 | PR **#106** r34 | 勿重开 |
| N-165…167 | PR **#108** r35 | 勿重开 |
| N-168…170 | PR **#109** r36 | 勿重开 |
| N-171…173 | PR **#110** r37 | 勿重开 |
| N-174…176 | PR **#111** r38 | 勿重开 |
| N-177…179 | PR **#112** r39 | 勿重开 |
| N-180…182 | PR **#113** r40 | 勿重开 |
| N-183…185 | PR **#114** r41 | 勿重开 |
| N-186…188 | PR **#115** r42 | 勿重开 |
| **N-189 起** | **本轮新开** | 见 §2 |

**并号（r22–r42 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole 盘面 **C-5** / rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bh-mode` 已钉 44。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.clf-primary` 父盒已 44。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺菜单矮横屏 sticky。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pzt-eye`/`.pzt-undo`/`.pz-hint`/`.pz-back` 主干已 44。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.sn-open` / `.dr-softbtn` / `*-softbtn` → **N-180/181/182**。`.sn-back` / `.pz-back` → **N-147**。`.pcp-act` → **N-183**。`.hh-catch` / `*-catch` → **N-184/185**。`.mmc-open` / `.mmc-toggle` / `*-toggle` → **N-186/187/188**。`.as-open,.as-back` 已 44（kit）。`.fdf-btn` 已 44。`.snk-toggle` 已 44。`.rbg-toggle` `TOGGLE_MIN_H=44`。`.clk-toggle` 已 44。糖果 `.cs-btn` 仅与 `.cds-tap`（已 44）同挂。`.rbt-vs-back` / `.rbt-vs-mode` 已 `TOUCH_MIN_PX`。红蓝跑 `.rbe-over-btn` / `.rbv-over-btn` 已 `min-height:48`。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#115** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r42 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 | puzzle-tiles **无尽**；`.pzt-eye` / `.pz-hint` / `.pz-back` 已 44 | r21 改义作废 |
| `.hh-catch` / `.pcp-act` | 仍无 min-height | r41 N-184/183，未合 |
| `.sn-open` / `.sks-mode` | 仍无基规则 44 | N-180 / N-149，未合 |
| `.mmc-open` / `.mmc-toggle` | 仍无 min-height | r42 N-186/187，未合 |
| `.rbt-vs-btn` / `.rte-btn` | 仍无 min-height | r42 记下、本轮新开 |

### 1.2 r22–r42 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22…r37 | #90～#110 | N-125…173 | 见 r40 表 |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |
| r40 | #113 | N-180…182 | sn-open / dr-softbtn / `*-softbtn` |
| r41 | #114 | N-183…185 | pcp-act / hh-catch / `*-catch` |
| r42 | #115 | N-186…188 | mmc-open / mmc-toggle / `*-toggle` |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.mmc-open` / `.mmc-toggle` | N-186/187 |
| `.sn-open` / `.sks-mode` | N-180 / **N-149** |
| `.pcp-act` / `.hh-catch` | N-183/184 |
| `.bl-btn` | **N-145** |
| `.bvp-act` | **N-150** |
| `*-veil-btn` | **N-152** |
| `.shr-toggle` | **N-134** |
| `.fs-act` | **N-157** |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding 14；并 N-146/N-149 边缘 |
| `.rbe-over-btn` / `.rbv-over-btn` | 已 48；同 padding 12/24 模板但已绿 |
| `.rbt-vs-back` | 已 TOUCH |
| `.rte-open` / `.rte-back` | 已 44 |
| 坦克双垫 / 消消乐钳高 | PR #107 |

---

## 2. 本轮新开（N-189 起）

### N-189 · B · red-blue-tap 对战结算 `.rbt-vs-btn`

**证据**：`src/games/red-blue-tap/arena.ts` 约 L213：

```text
.rbt-vs-btn { … padding: 12px 24px; font-size: 16px; … cursor: pointer; … }
```

无 `min-height`。估高 `12×2 + 16×1.2 ≈ 43.2`，低于 44。padding **12**，不在 N-146「≥14」豁免里。挂载约 L637 / L935（再来）、L646 / L944（回关卡 ghost）。同文件 `.rbt-vs-back` 已 TOUCH，不要动。

**与旧号边界**：N-139 是红蓝跑盘面 `.rbv-foe`。N-152 是 `*-veil-btn`。N-157 是 `.dvs-over button`。N-175 是拔河 `.rbg-btn`。本号只打 **对战 overlay 那排**。若有人把本选择器并进 N-139，本号销。

**建议**：`.rbt-vs-btn { min-height: 44px; box-sizing: border-box; }`。测对战/无尽打完点再来、回关卡。勿改点判定 / 双人隔离带。

### N-190 · B · red-blue-tap 闯关 overlay 复制体 `.rte-btn`

**证据**：`src/games/red-blue-tap/index.ts` 约 L160：同套 `padding:12px 24px; font-size:16px`，无 `min-height`。本文件 JS **尚未** `className = "rte-btn"`（大厅只用 `.rte-open`）；CSS 与 `.rbt-vs-btn` 一字不差地抄来，随时会被 overlay 挂上。

**与旧号边界**：`.rte-open`/`.rte-back` 已 44，勿改。N-189 只管 `arena.ts`。本号钉 **闯关文件里这颗 class**，避免死 CSS 变活即红。

**建议**：`.rte-btn { min-height: 44px; box-sizing: border-box; }`。若本轮仍无挂载，静态验收即可。勿改闯关点数规则。

### N-191 · A · 红蓝点 overlay 复制体（`*-vs-btn` / `.rte-btn` / 同模板无 min-height）

**证据**：`padding:12px 24px` + `font-size:16px` + `cursor:pointer` 的 overlay 钮：

| 选择器 | 现状 |
| --- | --- |
| `.rbt-vs-btn` | 红（N-189） |
| `.rte-btn` | 红（N-190，未挂载） |
| `.rbe-over-btn` / `.rbv-over-btn` | 已 48，绿 |

N-152 扫 `*-veil-btn`；N-175 扫拔河 `.rbg-btn`；都不扫 `*-vs-btn`。

**建议**：扫描 `src/games/**/*.{css,ts}`：`.-vs-btn{` 或选择器 `.rte-btn{` 必须 `min-height`≥44。可顺带抽验同 padding/字号模板是否漏写高度（已 48 的 over-btn 当绿对照）。N-189/190 修完应变绿。勿与 N-139/152/175 并号。

---

## 3. 给 A / B

- **A**：先合 N-191（或与 B 并行）。
- **B**：N-189（arena.ts）与 N-190（index.ts）可同一 PR（同一游戏）。不要改 `SKY_H`。不要回退 N-94。不要跟 #107 抢坦克双垫。`.mmc-open` 走 **N-186**。`.bl-btn` 走 **N-145**。`.pcp-act` 走 **N-183**。`.hh-catch` 走 **N-184**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-192**。N-189…N-191 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r43-learn-notes-1cd5`
