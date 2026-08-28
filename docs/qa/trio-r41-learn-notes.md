# r41 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r41-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r40 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**（N-174…176）、**r39**（N-177…179）、**r40**（N-180…182）。明显仍红的 CTA 多数已有旧号；本轮第一次把 **N-151 捆号里仍红的王子结算 `.pcp-act`** 拆开（拼图 `.pzt-eye` 主干已 44），并给 **hue-hand 接牌 `.hh-catch`** 独立号（N-148 另一半 `.dvs-pick` 已被主干 N-94 销）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r41 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B | 只回归 |
| N-95～N-108 / C-5 / N-29 尾款 | 主干 r19 B | 只回归（`.pzt-eye` 已 44） |
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
| N-147…149 | PR **#100** r29 | 勿重开 **整捆重做**；`.hh-catch` 见 §2 N-184 |
| N-150…152 | PR **#101** r30 | 勿重开 **`.bvp-btn`/`*-veil-btn`**；`.pcp-act` 见 §2 |
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
| **N-183 起** | **本轮新开** | 见 §2 |

**并号（r22–r40 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole 盘面 **C-5** / rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bh-mode` 已钉 44。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.clf-primary` 父盒已 44（圆点只是视觉，见 §1.3）。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺菜单矮横屏 sticky。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**（**不含**本轮点名的 `.pcp-act`）。`.pzt-eye`/`.pzt-undo` 主干已 44。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.sn-open` / `.dr-softbtn` / `*-softbtn` → **N-180/181/182**。`.sn-back` → **N-147**。`.as-open,.as-back` 已 44。`.fdf-btn` 已 44。`.snk-toggle` 已 44。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#113** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r40 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 | puzzle-tiles **无尽**；`.pzt-eye` 已 `min-height:44` | r21 改义作废 |
| `.dvs-pick` | **N-94** 已 44 | r29 N-148 一半被先合 |
| `.hh-catch` | **仍无 min-height** | N-148 另一半，未合 |
| `.pcp-act` | **仍无 min-height** | N-151 捆号，未合 |
| `.sn-open` / `.dr-softbtn` | 仍无基规则 44 | r40 N-180/181，未合 |

### 1.2 r22–r40 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22…r37 | #90～#110 | N-125…173 | 见 r40 表 |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |
| r40 | #113 | N-180…182 | sn-open / dr-softbtn / `*-softbtn` |

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
| `.pzt-eye` / `.pzt-undo` | 主干已 44；勿再挂 N-151 拼图段 |
| `*-veil-btn` | **N-152** |
| `.frc-open` / `.frc-back` | N-121 |
| `.xq-start` | N-95 |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding 14；并 N-146/N-149 边缘 |
| `.clf-primary` / `.clf-primary-dot` | 父按钮已 `min-height:44`；`ui.ts` 写明只收视觉圆点 |
| `.wgd-garden-flower` | **N-159**（34×34 写死） |
| `.shr-toggle` | **N-134**（36px） |
| `.fs-act` | **N-157** |
| `.gdh-tally` / `.ak-card` | N-171/172 |
| `.dr-start` | padding 15 估高过线；矮横屏走 N-87 |
| 坦克双垫 / 消消乐钳高 | PR #107 |

---

## 2. 本轮新开（N-183 起）

### N-183 · B · prince-princess 结算 CTA `.pcp-act`

**证据**：`src/games/prince-princess/index.ts` 约 L256：

```text
.pcp-act{border:none;border-radius:16px;padding:9px 18px;font-size:14px;…cursor:pointer;…}
```

无 `min-height`。估高 `9×2 + 14×1.2 ≈ 34.8`，低于 44。约 L2212 `<button class="pcp-act">` 挂在结算 overlay。同文件 `.pcp-btn` 已 44。padding **9**，不在 N-146「≥14」豁免里。

**与旧号边界**：N-151 原文捆 **`.pzt-eye`/`.pzt-undo` + `.pcp-act`**。主干 `.pzt-eye,.pzt-undo` 已写 `min-height:44px`。N-150 是 brave-path `.bvp-act`。N-152 是 `*-veil-btn`（含 `.pcp-veil-btn`）。N-157 是 `.dvs-over button`。本号只打 **王子结算那排**。若 N-151 先合且已含 `.pcp-act`，本号销。

**建议**：`.pcp-act { min-height: 44px; }`。测一局结束点再来/回选。勿改王子关卡表 / 双人 `--k`（N-154）。

### N-184 · B · hue-hand 接牌 `.hh-catch`

**证据**：`src/games/hue-hand/index.ts` 约 L183：

```text
.hh-catch{…padding:4px 9px;font-size:14px;…cursor:pointer;…}
```

无 `min-height`。估高 `4×2 + 14×1.2 ≈ 24.8`。同文件 `.hh-btn`/`.hh-open`/`.hh-goback` 已 44。padding **4**。

**与旧号边界**：N-148 原文捆 **`.hh-catch` + `.dvs-pick`**。`.dvs-pick` 已被主干 **N-94** 销。本号把仍红的接牌 CTA 拆出来，避免半残捆号。N-94 不含本颗。`.hh-deck` 是 66×96 牌堆，豁免。若 N-148 先合且已抬 `.hh-catch`，本号销。

**建议**：`.hh-catch { min-height: 44px; }`。测对局点「接牌」。勿改花色规则 / 牌背 `.hh-back*`。

### N-185 · A · `*-catch` 必须 min-height≥44 静态巡检

**证据**：全库仅 **`.hh-catch` 一处** `.-catch{` 可点规则，现状红。N-149/170/173/176/179/182 都不扫这个后缀。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-catch{` 且指向 **button** 必须 `min-height`≥44 或 TOUCH 插值。豁免：非按钮、整面热区。N-184 修完应变绿。勿与 N-148/184 并号（148 是旧捆；184 管实例；本号管漏网后缀）。

---

## 3. 给 A / B

- **A**：先合 N-185（或与 B 并行；应对 `.hh-catch` 现状为红）。
- **B**：N-183 与 N-184 分 PR（两款游戏）。不要改 `SKY_H`。不要回退 N-94 `.dvs-pick`。不要把 `.pzt-eye` 再改一遍。不要跟 PR #107 抢坦克双垫。bowling `.bl-btn` 仍走 **N-145**。`.sn-open` 走 **N-180**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-186**。N-183…N-185 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r41-learn-notes-1cd5`
