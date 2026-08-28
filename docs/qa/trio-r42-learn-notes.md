# r42 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r42-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r41 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**（N-174…176）、**r39**（N-177…179）、**r40**（N-180…182）、**r41**（N-183…185）。明显仍红的 CTA 多数已有旧号；本轮第一次把 **N-149 捆号里仍红的记忆翻牌大厅入口 `.mmc-open`** 拆开（N-149 首例是 `.sks-mode`；`.sn-open` 已被 r40 拆成 N-180），并给同款 **回选关 / 主题 / 辅助 `.mmc-toggle`** 独立号（`.snk-toggle` 已 44，`.shr-toggle` 走 N-134）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r42 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B | 只回归 |
| N-95～N-108 / C-5 / N-29 尾款 | 主干 r19 B | 只回归（拼图 `.pzt-eye`/`.pz-hint`/`.pz-back` 主干已 44） |
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
| N-147…149 | PR **#100** r29 | 勿重开 **整捆重做**；`.mmc-open` 见 §2 N-186 |
| N-150…152 | PR **#101** r30 | 勿重开 **`.bvp-btn`/`*-veil-btn`/` .pcp-act` 捆**；`.pcp-act` 见 r41 N-183 |
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
| **N-186 起** | **本轮新开** | 见 §2 |

**并号（r22–r41 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole 盘面 **C-5** / rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bh-mode` 已钉 44。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.clf-primary` 父盒已 44（圆点只是视觉）。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺菜单矮横屏 sticky。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**（`.bvp-btn` 另有 kit `touchUpliftCss` 追加 44；残红主要是 `.bvp-act`）。`.pzt-eye`/`.pzt-undo`/`.pz-hint`/`.pz-back` 主干已 44。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.sn-open` / `.dr-softbtn` / `*-softbtn` → **N-180/181/182**。`.sn-back` / `.pz-back` → **N-147**。`.pcp-act` → **N-183**。`.hh-catch` / `*-catch` → **N-184/185**。`.as-open,.as-back` 已 44（kit）。`.fdf-btn` 已 44。`.snk-toggle` 已 44。`.rbg-toggle` `TOGGLE_MIN_H=44`。`.clk-toggle` 已 44。糖果 `.cs-btn` 仅与 `.cds-tap`（已 44）同挂。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#114** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r41 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 | puzzle-tiles **无尽**；`.pzt-eye` / `.pz-hint` / `.pz-back` 已 `min-height:44` | r21 改义作废；热区尾款已合 |
| `.dvs-pick` | **N-94** 已 44 | r29 N-148 一半被先合 |
| `.hh-catch` | **仍无 min-height** | r41 N-184，未合 |
| `.pcp-act` | **仍无 min-height** | r41 N-183 / 原 N-151，未合 |
| `.sn-open` / `.dr-softbtn` | 仍无基规则 44 | r40 N-180/181，未合 |
| `.sks-mode` | **仍无 min-height**（padding 8） | N-149，未合 |
| `.mmc-open` / `.mmc-toggle` | **仍无 min-height** | 本轮新拆 |

### 1.2 r22–r41 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22…r37 | #90～#110 | N-125…173 | 见 r40 表 |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |
| r40 | #113 | N-180…182 | sn-open / dr-softbtn / `*-softbtn` |
| r41 | #114 | N-183…185 | pcp-act / hh-catch / `*-catch` |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.sn-open` / `.dr-softbtn` | N-180/181 |
| `.sn-back` | **N-147** |
| `.sks-mode` | **N-149** |
| `.dvs-lessonbtn` / `.dvs-mode` | N-177/178 |
| `.bl-btn` | **N-145** |
| `.rbg-pick` / `.rbg-btn` | N-174/175 |
| `.bvp-btn` / `.bvp-act` | **N-150** |
| `.pzt-eye` / `.pzt-undo` / `.pz-hint` / `.pz-back` | 主干已 44 |
| `*-veil-btn` | **N-152** |
| `.frc-open` / `.frc-back` | N-121 |
| `.xq-start` | N-95 |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding 14；并 N-146/N-149 边缘 |
| `.clf-primary` / `.clf-primary-dot` | 父按钮已 `min-height:44` |
| `.wgd-garden-flower` | **N-159**（34×34 写死） |
| `.shr-toggle` | **N-134**（`min-height:36`） |
| `.fs-act` | **N-157** |
| `.gdh-tally` / `.ak-card` | N-171/172 |
| `.dr-start` | padding 15 估高过线；矮横屏走 N-87 |
| `.pcp-act` / `.hh-catch` | N-183/184 |
| `.rbt-vs-btn` / `.rte-btn` | padding 12 + 字 16 估高 ≈43.2，略低于 44；**不新开**，留给下一空号，避免本轮超过 2B+1A |
| `.cs-btn` | 仅与已 44 的 `.cds-tap` 同挂 |
| 坦克双垫 / 消消乐钳高 | PR #107 |

---

## 2. 本轮新开（N-186 起）

### N-186 · B · memory-cards 大厅入口 `.mmc-open`

**证据**：`src/games/memory-cards/index.ts` 约 L113：

```text
.mmc-open { … padding: 8px 16px; font-size: 15px; … cursor: pointer; … }
```

无 `min-height`。估高 `8×2 + 15×1.2 ≈ 34`，低于 44。挂载约 L757 / L869（再来）、L932 / L935（无尽 / 对战入口）。同文件 `.mmc-toggle` 见 N-187。padding **8**，不在 N-146「≥14」豁免里。

**与旧号边界**：N-149 原文扫 **`.xxx-open` / `.xxx-mode`**，首例 `.sks-mode`。r40 已把贪吃蛇 `.sn-open` 拆成 **N-180**。本号只打 **记忆翻牌大厅那几颗 `.mmc-open`**。N-121 是 fruit-catch。N-102 是 bumper `.bc-open`。若 N-149 先合且已含 `.mmc-open`，本号销。

**建议**：`.mmc-open { min-height: 44px; }`（可顺手 `inline-flex; align-items: center`）。测选关点无尽/对战、结算点再来。勿改翻牌配对规则 / 牌面尺寸。

### N-187 · B · memory-cards 回选关 / 主题 / 辅助 `.mmc-toggle`

**证据**：同文件约 L115：

```text
.mmc-toggle { … padding: 8px 14px; font-size: 14px; … cursor: pointer; … }
```

无 `min-height`。估高 `8×2 + 14×1.2 ≈ 32.8`。挂载约 L724 / L822（`◀ 回选关`）、L826（主题）、L939（辅助）。padding **8**。

**与旧号边界**：N-134 是射击 `.shr-toggle`（仍写死 36）。`.snk-toggle` / `.clk-toggle` / `.rbg-toggle` 已 44。N-147 是 `.sn-back`/`.pz-back`，不是这颗。本号只打 **mmc 这一种 class**。若有人把 `.mmc-toggle` 并进 N-134，本号销。

**建议**：`.mmc-toggle { min-height: 44px; }`。测回选关、换主题、辅助开关仍可用。勿改记忆翻牌判定。

### N-188 · A · `*-toggle` 必须 min-height≥44 静态巡检

**证据**：`.-toggle{` 可点规则现状：

| 选择器 | 现状 |
| --- | --- |
| `.mmc-toggle` | 红（N-187） |
| `.snk-toggle` | 已 44 |
| `.clk-toggle` | 已 44 |
| `.rbg-toggle` | `TOGGLE_MIN_H=44` |
| `.shr-toggle` | **N-134** 写死 36，豁免本号、勿双修 |

N-149/170/173/176/179/182/185 都不扫这个后缀。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-toggle{` 且指向 **button** 必须 `min-height`≥44 或 TOUCH / `TOGGLE_MIN_H` 插值。豁免：N-134 `.shr-toggle`。N-187 修完 `.mmc-toggle` 应变绿。勿与 N-134/187 并号（134 是射击 36；187 管实例；本号管漏网后缀）。

---

## 3. 给 A / B

- **A**：先合 N-188（或与 B 并行；应对 `.mmc-toggle` 现状为红；`.shr-toggle` 白名单）。
- **B**：N-186 与 N-187 可同一 PR（同一文件），也可分提交。不要改 `SKY_H`。不要回退 N-94 `.dvs-pick`。不要把主干已 44 的 `.pzt-eye` 再改一遍。不要跟 PR #107 抢坦克双垫。bowling `.bl-btn` 仍走 **N-145**。`.sn-open` 走 **N-180**。`.pcp-act` 走 **N-183**。`.hh-catch` 走 **N-184**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-189**。N-186…N-188 本轮占用。下一轮可点 `.rbt-vs-btn` / `.rte-btn`（估高 ≈43.2）。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r42-learn-notes-1cd5`
