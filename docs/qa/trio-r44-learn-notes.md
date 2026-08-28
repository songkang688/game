# r44 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r44-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r43 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**（N-174…176）、**r39**（N-177…179）、**r40**（N-180…182）、**r41**（N-183…185）、**r42**（N-186…188）、**r43**（N-189…191）。大厅入口/结算 overlay 已拆多轮；本轮第一次点名 **地图关卡格 `*-lv`**：泡泡瞄准 `.ba-lv` 与糖果秋千 `.cs-lv`（N-144 只打 fight-king `.fk-ch`；kit 只抬了 `.ba-btn`/`.bba-mode`，不含关卡格）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r44 动作 |
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
| N-144…146 | PR **#98** r28 | 勿重开 **`.fk-ch`**；`*-lv` 见 §2 |
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
| N-189…191 | PR **#116** r43 | 勿重开 |
| **N-192 起** | **本轮新开** | 见 §2 |

**并号（r22–r43 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → **N-144**；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole 盘面 **C-5**（`.mp-open`/`.mp-back` 主干已叠 44）；rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.clf-primary` 父盒已 44。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**（`.bwl-undo` 已 `height:44`）。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺菜单矮横屏 sticky。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pzt-eye`/`.pzt-undo`/`.pz-hint`/`.pz-back` 主干已 44。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.sn-open` / `.dr-softbtn` / `*-softbtn` → **N-180/181/182**。`.sn-back` / `.pz-back` → **N-147**。`.pcp-act` → **N-183**。`.hh-catch` / `*-catch` → **N-184/185**。`.mmc-open` / `.mmc-toggle` / `*-toggle` → **N-186/187/188**。`.rbt-vs-btn` / `.rte-btn` / overlay 复制体 → **N-189/190/191**。`.as-open,.as-back` 已 44（kit）。`.fdf-btn` 已 44。`.snk-toggle` 已 44。糖果 `.cs-btn` 仅与 `.cds-tap`（已 44）同挂。`.rbt-vs-back` 已 TOUCH。`.rbe-over-btn` / `.rbv-over-btn` 已 48。`.ba-btn` / `.bba-mode` 已 44（N-29 尾款）。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#116** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r43 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 / C-5 | 拼图热区已 44；地鼠 `.mp-open`/`.mp-back` 已 44 | 勿再挂热区号 |
| `.hh-catch` / `.pcp-act` | 仍无 min-height | r41，未合 |
| `.mmc-open` / `.mmc-toggle` | 仍无 | r42，未合 |
| `.rbt-vs-btn` / `.rte-btn` | 仍无 | r43，未合 |
| `.ba-lv` / `.cs-lv` | **仍无 min-height** | 本轮新开 |

### 1.2 r22–r43 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22…r37 | #90～#110 | N-125…173 | 见 r40 表 |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |
| r40 | #113 | N-180…182 | sn-open / dr-softbtn / `*-softbtn` |
| r41 | #114 | N-183…185 | pcp-act / hh-catch / `*-catch` |
| r42 | #115 | N-186…188 | mmc-open / mmc-toggle / `*-toggle` |
| r43 | #116 | N-189…191 | rbt-vs-btn / rte-btn / overlay 复制体 |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.rbt-vs-btn` / `.rte-btn` | N-189/190 |
| `.mmc-open` / `.mmc-toggle` | N-186/187 |
| `.sn-open` / `.sks-mode` | N-180 / **N-149** |
| `.pcp-act` / `.hh-catch` | N-183/184 |
| `.bl-btn` | **N-145** |
| `.bvp-act` | **N-150** |
| `.fk-ch` | **N-144** |
| `.ak-card` | **N-172** |
| `.mp-open` / `.mp-back` | 主干已 44 |
| `.mg-mile` | 庆祝层：44px SVG 星 + 文案，`aria-hidden`，点跳过；不是常驻 CTA |
| `.rbg-pull` | 蓄力大键，JS `--rbg-pull-h` 已按舞台量高 |
| `.cs-btn` | 仅与 `.cds-tap` 同挂 |
| `.dc-mode` 族 | padding 14 |
| 坦克双垫 | PR #107 |

---

## 2. 本轮新开（N-192 起）

### N-192 · B · bubble-aim 地图关卡格 `.ba-lv`

**证据**：`src/games/bubble-aim/index.ts` 约 L307：

```text
.ba-lv { … padding: 8px 2px 6px; … cursor: pointer; display: flex; flex-direction: column; … }
```

无 `min-height`。子行 `.num` 15px / `.stars` 10px / `.mech` `min-height:13px`。三行撑满时估高可能过 44，但 **没有地板**：若以后收行或 locked 少一行就会掉。kit `touchUpliftCss` 只点了 `.ba-btn` / `.bba-mode` / `.bba-swap`。挂载约 L450。padding 块方向 8+6，不在 N-146「单行 padding≥14」豁免。

**与旧号边界**：N-29 尾款是关内工具排。N-132 是 `.bba-swap`。N-144 是 `.fk-ch`。N-168 是 `.bvp-opt`。本号只打 **瞄准地图格子**。

**建议**：`.ba-lv { min-height: 44px; box-sizing: border-box; }`。测地图点一关、锁定格不可进。勿改 188 关表 / 弹道。

### N-193 · B · candy-swing 地图关卡格 `.cs-lv`

**证据**：`src/games/candy-swing/index.ts` 约 L443：

```text
.cs-lv { … padding: 7px 2px 5px; … cursor: pointer; display: flex; flex-direction: column; … }
```

无 `min-height`。`.n` 16px + `.s` 10px + padding 12 + gap 1，估高 **贴 44 线**。挂载约 L576。`.cds-mode` / `.cds-tap` 已 44，不含关卡格。

**与旧号边界**：N-144 是格斗章节 `.fk-ch`，不是糖果。N-192 只管 `.ba-lv`。若 N-144 先合且误含 `.cs-lv`，本号销。

**建议**：`.cs-lv { min-height: 44px; box-sizing: border-box; }`。测选关点已解锁格。勿改关卡物理 / 星星判定。

### N-194 · A · `*-lv` 必须 min-height≥44 静态巡检

**证据**：全库 `.-lv{` 可点关卡格仅两处，均红：`.ba-lv`、`.cs-lv`。N-144 扫的是 `-ch`；N-149 扫 open/mode；N-170 扫 `-opt`。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-lv{` 且 `cursor:pointer`（或 button）必须 `min-height`≥44。豁免：非按钮装饰、已 `locked` 且 `cursor:default` 可仍要求同样高度以免格子参差。N-192/193 修完应变绿。勿与 N-144 并号。

---

## 3. 给 A / B

- **A**：先合 N-194（或与 B 并行）。
- **B**：N-192（bubble-aim）与 N-193（candy-swing）分 PR。不要改 `SKY_H`。不要跟 #107 抢坦克/消消乐钳高。`.fk-ch` 走 **N-144**。`.rbt-vs-btn` 走 **N-189**。`.mmc-open` 走 **N-186**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-195**。N-192…N-194 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r44-learn-notes-1cd5`
