# r38 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r38-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B 文档 + 源码：N-94～N-108 / N-29 尾款 / C-5）。其下仍含 r19 A `17356717`（N-99/97/100/109）。r20–r37 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。本轮第一次把 **拔河选对手 `*-pick`（N-145/148/169 未点名的那颗）** 与 **同款结算 `.rbg-btn`** 当独立热区族扫（N-170 明文不扫 `*-pick`；N-94 已钉 `.dvs-pick`；N-102 已钉 `.bc-pick`）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r38 动作 |
| --- | --- | --- |
| N-94 / N-101 | **主干 r19 B** duo-vs 开打+芯片 / 赛中键 | 只回归；学习号 **N-148** 的 `.dvs-pick` 被 N-94 先合销账 |
| N-95 | 主干 r19 B 象棋设置屏 CTA sticky | 只回归（勿把 `.xq-start` 再开热区号） |
| N-96 / N-107 / N-106 | 主干 r19 B bomb / fruit-stack / monster | 只回归 |
| N-98 | 主干 r19 B hue-hand | 只回归 |
| N-99 / N-97 / N-100 / N-109 | 主干 r19 A | 只回归 |
| N-102 | 主干 r19 B bumper 画布+`.bc-open`/`.bc-pick` 44 | 只回归；学习号 **N-145** 碰碰车段被先合销账 |
| N-103 | 主干 r19 B ice-fire 画布+pad | 只回归 |
| N-104 | 主干 r19 B `.ld-back` 44 | 只回归 |
| N-108 | 主干 r19 **B+A 同义**：puzzle-tiles **无尽**（B 还抬了五热区 44） | 只回归；勿用 r21 草稿改义 |
| C-5 / N-29 尾款 | 主干 r19 B mole `fitBoard` / sling·candy·bubble | 只回归 |
| N-105 | 主干已绿（r18 combo/mahjong 16px） | 只回归；禁第四份 14→16 hunk |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | PR **#87** r21；A **#94**、B **#96** 在途 | 勿重做 |
| N-125…128 | PR **#90** r22 | 勿重开 |
| N-129…131 | PR **#91** r23 | 勿重开 |
| N-132…134 | PR **#92** r24 | 勿重开 |
| N-135…137 | PR **#93** r25 | 勿重开 |
| N-138…140 | PR **#95** r26 | 勿重开 |
| N-141…143 | PR **#97** r27 | 勿重开 |
| N-144…146 | PR **#98** r28 | 勿重开（bowling 段仍在；bumper 已由 N-102 销） |
| N-147…149 | PR **#100** r29 | 勿重开（`.dvs-pick` 除外：走主干 N-94） |
| N-150…152 | PR **#101** r30 | 勿重开 |
| N-153…155 | PR **#102** r31 | 勿重开 |
| N-156…158 | PR **#103** r32 | 勿重开 |
| N-159…161 | PR **#105** r33 | 勿重开 |
| N-162…164 | PR **#106** r34 | 勿重开 |
| N-165…167 | PR **#108** r35 | 勿重开 |
| N-168…170 | PR **#109** r36 | 勿重开 |
| N-171…173 | PR **#110** r37 | 勿重开 |
| **N-174 起** | **本轮新开** | 见 §2 |

**并号（r22–r37 已占 + 主干先合，勿新开）**：`.dvs-back`/pad → **N-94/101 主干**；`.dvs-pick` → **N-94**（勿再用 N-148）；`.ld-back` → **N-104 主干**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole/rbv-foe → N-139（mole 盘面走 **C-5**）；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bba-swap` → N-132（B 已抬工具排 44，只回归）；fruit-catch 开/返回 → N-121；`.se-deed` 并 G-3；`.hh-back*` 牌背豁免；象棋 `.xq-seg` 主干已钉 44（N-95）；poop `MIN_HOT_DUO=34` 仅注释遗物。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135。排行榜 / 象棋记谱 `<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**（仅保龄，勿再打碰碰车）。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单** CTA。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pcp-act` / `.pzt-eye` → **N-151**（`.pzt-eye` 亦被 N-108 B 抬 44，只回归）。`.clf-pick` 已钉 `SWATCH_MIN_PX`。`.sks-opt` 已钉 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-open` / `.rbg-back` / `.rbg-toggle` 已 `TOGGLE_MIN_H=44`（`touchTargets.test.ts` 已钉这三颗，**不含** `.rbg-pick` / `.rbg-btn`）。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** N-117/118/120；**#96** N-121/122/124；**#99** 与主干 N-99 可能重叠；PR **#104** 平板横屏 / 16px / l99 可滚；PR **#105**～**#110** 学习号；PR **#107** `cursor/ux-tablet-p0-5359`（坦克双垫 / 消消乐与地鼠钳高 / 底栏 840）—— r38 **不要**另开同义号。

---

## 1. 读 r22–r37 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿曾误写 / 并号 |
| --- | --- | --- |
| N-99 / 97 / 100 / 109 | r19 A 已销 | r21 曾写「未合」 |
| N-108 | puzzle-tiles **无尽**（A 文档 + B 源码） | r21 草稿改义，作废 |
| `.dvs-pick` | **N-94** 已 44 | r29 学习号 N-148，取先合 N-94 |
| `.bc-pick` / `.bc-open` | **N-102** 已 44 | r28 学习号 N-145 碰碰车段作废 |
| `.ld-back` | **N-104** 已 44 | 学习 N-104 同义，只回归 |
| `.xq-start` 出屏 | N-95 sticky 已合 | 勿再开「开始下棋出屏」 |

### 1.2 r22–r37 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22 | #90 | N-125…128 | 字号 / 农场按钮 / 写死 14px |
| r23 | #91 | N-129…131 | 农场 `--k` / 农场键盘 / `--k` 巡检 |
| r24 | #92 | N-132…134 | bba-swap / rbe-back / shr-back |
| r25 | #93 | N-135…137 | 四款返回 / 写死宽高 / `min-height` 扫描 |
| r26 | #95 | N-138…140 | l99 壳层钮 / mole / sp-key |
| r27 | #97 | N-141…143 | ld-btn / fk-mode / 写死 40/42 |
| r28 | #98 | N-144…146 | fk-ch / bowling / 缺 min-height |
| r29 | #100 | N-147…149 | snake/puzzle 返回 / hh-catch+dvs-pick / `*-open` |
| r30 | #101 | N-150…152 | brave-path btn/act / pzt-eye+pcp-act / `*-veil-btn` |
| r31 | #102 | N-153…155 | sky-squad `--k` / 王子格子 / `--k:\d+px` |
| r32 | #103 | N-156…158 | 仓鼠 grid-auto-rows / fs-act+dvs-over / `grid-auto-rows` |
| r33 | #105 | N-159…161 | wgd-garden-flower / clf-work / 写死宽高 button |
| r34 | #106 | N-162…164 | 排行榜 summary / cg-log-sum / summary 巡检 |
| r35 | #108 | N-165…167 | dr-rules-close / dr-resume / rules-close·resume 巡检 |
| r36 | #109 | N-168…170 | bvp-opt / pfb-pick / `*-opt` 巡检 |
| r37 | #110 | N-171…173 | gdh-tally / ak-card / `*-go` 巡检 |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.rbg-open` / `.rbg-back` / `.rbg-toggle` | 已 `TOGGLE_MIN_H` |
| `.rbg-picks` / `.fk-pick` / `.cc-pick` | **容器**，不是钮 |
| `.dvs-pick` / `.bc-pick` / `.bl-pick` / `.ps-pick` / `.jq-pick` / `.fs-pick` / `.fc-pick` / `.dc-pick` / `.cg-pick` / `.bmb-pick` / `.bc-pick` | 已 44 或已销号 |
| `.clf-pick` | 已 `SWATCH_MIN_PX` |
| `.pfb-pick` | N-169 |
| `.dvs-go` / `.pk-go` | N-173 |
| `.dvs-over button` | N-157 |
| `.dvs-lessonbtn` | r37 已记「不新开」；两行大卡，可并 N-146 |
| `.gdh-tally` / `.ak-card` | N-171/172 |
| `.xq-start` | N-95 已合 sticky；矮横屏 `padding:10px` 估高贴线，**勿撞 N-95** |
| `.xq-seg button` | N-95 已钉 44 |
| `.l99-ov-btn` / `.l99-tab` | N-138 |
| `.pzt-eye` | N-108 B + N-151，只回归 |
| 坦克双垫 / 消消乐·地鼠钳高 / 底栏 840 | PR #107 |
| 平板横屏 / 16px / l99 可滚 | PR #104 / 主干 N-99 |

---

## 2. 本轮新开（N-174 起）

### N-174 · B · red-blue-tug 选对手 `.rbg-pick`

**证据**：`src/games/red-blue-tug/index.ts` 约 L206：

```text
.rbg-pick { … padding: 10px 14px; font-size: 15px; … cursor: pointer; … }
```

无 `min-height`。约 L935 是真正的 `<button type="button">`（对战选 AI 档 / 同屏双人）。同文件 `.rbg-open`/`.rbg-back`/`.rbg-toggle` 已插 `TOGGLE_MIN_H=44`，**漏了**选对手卡。有 `.rbg-pick-note` 第二行时 390 上通常够高，但 CSS 没有地板；单行/字号收档会掉到 44 以下。padding **10**，不在 N-146「padding≥14」豁免里。

**与旧号边界**：N-145 是 bowling /（已销的）bumper 选档；N-148 的 `.dvs-pick` 已被主干 N-94 销；N-169 是 puff 选角。N-149 扫 `*-open`/`*-mode`。本号只打 **拔河选对手卡**。

**建议**：`.rbg-pick { min-height: ${TOGGLE_MIN_H}px; }`（或写死 44）。测对战选档屏。勿改绳子 `TUG12` / AI 表 / 已绿的 open/back/toggle。

### N-175 · B · red-blue-tug 结算 CTA `.rbg-btn`

**证据**：同文件约 L202：

```text
.rbg-btn { … padding: 12px 22px; font-size: 16px; … cursor: pointer; … }
```

无 `min-height`。估高 `12×2 + 16×1.2 ≈ 43.2`，贴线不够。幽灵修饰 `.rbg-ghost2` 只换色。`touchTargets.test.ts` 只断言 toggle/open/back，**不含** `.rbg-btn`。

**与旧号边界**：N-150 是 brave-path `.bvp-btn`。N-157 是 `.dvs-over button`。N-87 是冲刺菜单。本号只打拔河结算/再来一局那颗。

**建议**：`.rbg-btn { min-height: ${TOGGLE_MIN_H}px; }`。测一局结束再来/回选。勿改拉力公式。

### N-176 · A · `*-pick` 必须 min-height≥44 静态巡检

**证据**：N-170 明文不扫 `*-pick`。主干已绿：`.dvs-pick`（N-94）、`.bc-pick`（N-102）、`.ps-pick`/`.jq-pick`/`.fs-pick`/`.fc-pick`/`.dc-pick`/`.cg-pick`/`.bmb-pick`/`.bl-pick`（bowling 现测已 44）。仍红且是 **button**：`.rbg-pick`（N-174）、`.pfb-pick`（N-169）。`.clf-pick` 已 CHIP/SWATCH 插值。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-pick{` / `.-pick,` 且指向 **button**（或 `cursor:pointer` 的可点块）必须 `min-height`≥44 或 TOUCH/TOGGLE/SWATCH/CHIP/MIN_HIT 插值。豁免：`.xxx-picks` / `.fk-pick` / `.cc-pick` **容器**、`pointer-events:none`、牌面格。N-174 修完 `.rbg-pick` 应变绿；`.pfb-pick` 仍红直到 N-169 合入。勿与 N-145/148/169/170 并号（旧号继续管各自实例；本号管**漏网**）。

---

## 3. 给 A / B

- **A**：先合 N-176（或与 B 并行；应对 `.rbg-pick` 红、`.dvs-pick`/`.bc-pick` 绿、`.pfb-pick` 仍红属 N-169）。
- **B**：N-174 与 N-175 可同一 PR（同一文件两段验收）。不要改 `SKY_H`。不要碰 N-108 无尽画廊判定。不要跟 PR #107 抢坦克双垫。不要回退 N-94/102 已钉的 pick。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-177**。N-174…N-176 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r38-learn-notes-1cd5`
