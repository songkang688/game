# r39 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r39-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r38 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。r37/r38 把 **`.dvs-lessonbtn` 记成「不新开」**；本轮第一次给它独立号，并顺带点名同款大厅 **两行模式卡** `.dvs-mode`（N-149 原文只扫 `*-open` 胶囊；N-94 已钉开打 CTA 与 `.dvs-pick`，**不含**这两颗）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r39 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B duo-vs 开打+芯片 / 赛中键 | 只回归；**不含** `.dvs-mode` / `.dvs-lessonbtn` |
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
| N-147…149 | PR **#100** r29 | 勿重开（N-149 原文 = **`*-open`**） |
| N-150…152 | PR **#101** r30 | 勿重开 |
| N-153…155 | PR **#102** r31 | 勿重开 |
| N-156…158 | PR **#103** r32 | 勿重开 |
| N-159…161 | PR **#105** r33 | 勿重开 |
| N-162…164 | PR **#106** r34 | 勿重开 |
| N-165…167 | PR **#108** r35 | 勿重开 |
| N-168…170 | PR **#109** r36 | 勿重开 |
| N-171…173 | PR **#110** r37 | 勿重开 |
| N-174…176 | PR **#111** r38 | 勿重开 |
| **N-177 起** | **本轮新开** | 见 §2 |

**并号（r22–r38 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135（含 `.bl-back`）；mole 盘面 **C-5** / rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bh-mode` 已由 `visual.ts` `touchUpliftCss`+`min-height:44` 钉绿。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**（#96 在途）。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` 出屏 → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**（bumper 段已销，**保龄 `.bl-btn` 仍红走旧号**）。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` 胶囊 → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单** CTA。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pcp-act` / `.pzt-eye` → **N-151**。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` 巡检 → **N-174/175/176**。`.as-open,.as-back` 同文件已钉 44。`.fdf-btn` 已 44。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#111** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r22–r38 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 | puzzle-tiles **无尽**（A 文档 + B 源码） | r21 改义作废 |
| `.dvs-pick` | **N-94** 已 44 | r29 N-148，取先合 |
| `.bc-pick` | **N-102** 已 44 | N-145 碰碰车段作废 |
| `.dvs-lessonbtn` / `.dvs-mode` | **仍无 min-height** | r37/r38 暂缓，本轮开 |

### 1.2 r22–r38 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22 | #90 | N-125…128 | 字号 / 农场 / 写死 14px |
| r23 | #91 | N-129…131 | 农场 `--k` |
| r24 | #92 | N-132…134 | bba-swap / rbe-back / shr-back |
| r25 | #93 | N-135…137 | 四款返回 / 写死宽高 |
| r26 | #95 | N-138…140 | l99 壳 / mole / sp-key |
| r27 | #97 | N-141…143 | ld-btn / fk-mode / 40/42 |
| r28 | #98 | N-144…146 | fk-ch / bowling / 缺 min-height |
| r29 | #100 | N-147…149 | snake/puzzle 返回 / hh-catch / `*-open` |
| r30 | #101 | N-150…152 | brave-path / pzt-eye+pcp-act / `*-veil-btn` |
| r31 | #102 | N-153…155 | `--k` |
| r32 | #103 | N-156…158 | 仓鼠格子 / fs-act+dvs-over / grid-auto-rows |
| r33 | #105 | N-159…161 | 花园花 / clf-work / 写死宽高 |
| r34 | #106 | N-162…164 | summary |
| r35 | #108 | N-165…167 | rules-close / resume |
| r36 | #109 | N-168…170 | bvp-opt / pfb-pick / `*-opt` |
| r37 | #110 | N-171…173 | gdh-tally / ak-card / `*-go` |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.dvs-pick` / `.dvs-go` / `.dvs-over button` | N-94 / N-173 / N-157 |
| `.bh-mode` / `.bh-btn` | visual.ts 已钉 44；N-47 |
| `.as-open,.as-back` | 同文件已 44 |
| `.bl-btn` | **N-145** 仍红，勿新开 |
| `.bl-back` | N-135 |
| `.frc-open` / `.frc-back` | N-121（#96） |
| `.rbg-pick` / `.rbg-btn` | N-174/175 |
| `.gdh-tally` / `.ak-card` / `.pk-go` | N-171/172/173 |
| `.xq-start` | N-95 |
| `.sks-mode` | N-149 胶囊 |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding 14 大卡；并 N-146/N-149 边缘 |
| `*-veil-btn` 各实例 | N-152 |
| `.fdf-btn` / `.fdf-zoomer` | 已 44 / `TOOL_MIN_H` |
| `.hp-hot` / `.fc-token` / `.hh-card` / `.mst-star` | 整面热区 / 棋子 / 牌面 / 琴键，不当 CTA |
| 坦克双垫 / 消消乐钳高 | PR #107 |

---

## 2. 本轮新开（N-177 起）

### N-177 · B · duo-vs-star 教案钮 `.dvs-lessonbtn`

**证据**：`src/games/duo-vs-star/index.ts` 约 L231：

```text
.dvs-lessonbtn{border:none;border-radius:16px;padding:11px 12px;cursor:pointer;…text-align:left;}
```

无 `min-height`。约 L1657 是真正的 `<button>`，内嵌 `<b>` 标题 + `<span>` 说明。padding **11**，不在 N-146「≥14」豁免里。单行/字号收档没有 CSS 地板。

**与旧号边界**：r37/r38 只是**本轮暂缓**，不是销号。N-94 点名开打 CTA 与 `.dvs-pick`。N-157 是结算 `.dvs-over button`。N-172 是古堡 `.ak-card`。N-174 是拔河 `.rbg-pick`。本号只打 **双人教案列表**。

**建议**：`.dvs-lessonbtn { min-height: 44px; }`。测协作教案列表点课。勿改对战规则 / N-94 开打钉底 / N-101 键排。

### N-178 · B · duo-vs-star 大厅模式卡 `.dvs-mode`

**证据**：同文件约 L178：

```text
.dvs-mode{…padding:13px 10px;cursor:pointer;…text-align:left;}
```

无 `min-height`。约 L1279 `<button class="dvs-mode">`，两行 `b`+`span`。padding **13**，贴 N-146 豁免线以下。N-94 修了 `.dvs-go` 矮横屏 fixed，**没给**模式卡地板。

**与旧号边界**：N-149 原文扫 **`*-open` 胶囊**（后来有人把 `.sks-mode` 并进去）。`.dvs-mode` 是 grid **两行大卡**，不是 `border-radius:999` 胶囊。N-142 是 fight-king `.fk-mode`。N-177 是教案列表（另一屏）。本号只打 **大厅模式格**。

**建议**：`.dvs-mode { min-height: 44px; }`。测进对战大厅点模式卡。勿改 `.dvs-go`（N-173）/ `.dvs-pick`（N-94）。

### N-179 · A · `*-lessonbtn` 必须 min-height≥44 静态巡检

**证据**：全库仅 **`.dvs-lessonbtn` 一处** `.-lessonbtn{` 规则，现状红。N-149/170/173/176 都不扫这个后缀。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-lessonbtn{` 且指向 **button** 必须 `min-height`≥44 或 TOUCH 插值。N-177 修完应变绿。勿与 N-149/177/178 并号（178 是 `*-mode` 大卡，不进本扫描）。

---

## 3. 给 A / B

- **A**：先合 N-179（或与 B 并行；应对 `.dvs-lessonbtn` 现状为红）。
- **B**：N-177 与 N-178 可同一 PR（同一文件两段：教案列表 / 大厅模式格）。不要改 `SKY_H`。不要回退 N-94/101。不要跟 PR #107 抢坦克双垫。bowling `.bl-btn` 仍走 **N-145**，别新开。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-180**。N-177…N-179 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r39-learn-notes-1cd5`
