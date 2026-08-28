# r36 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r36-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`17356717`**（r19 文档；`b7677155` 已合 N-99/97/100/109）。r20–r35 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。本轮第一次把 **`*-opt` 选项钮** 当独立热区族扫（N-149 只扫 `*-open`/`*-mode`；N-150 只点名 brave-path 的 `btn`/`act`，不含 `.bvp-opt`）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r36 动作 |
| --- | --- | --- |
| N-100…N-107 | 主干 r18 | 只回归 |
| N-108 | 主干 r19 = puzzle-tiles **无尽画廊** | 只回归 |
| N-109 | root 门，已销 | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | PR **#87** r21；A **#94**、B **#96** 在途 | 勿重做 |
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
| **N-168 起** | **本轮新开** | 见 §2 |

**并号（r22–r35 已占，勿新开）**：`.dvs-back`/pad → N-94/101；`.dvs-pick` → N-148；`.ld-back` → N-104；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole/rbv-foe → N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bba-swap` → N-132；fruit-catch 开/返回 → N-121；`.se-deed` 并 G-3；`.hh-back*` 牌背豁免；象棋 `.xq-seg` 估高已绿；poop `MIN_HOT_DUO=34` 仅注释遗物。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135。排行榜 / 象棋记谱 `<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` / bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/continue → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单** CTA。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**（**不含** `.bvp-opt`）。`.pcp-act` / `.pzt-eye` → **N-151**。`.clf-pick` 已钉 `SWATCH_MIN_PX`。`.sks-opt` 已钉 44。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109。

**在途勿重做**：PR **#94** N-117/118/120；**#96** N-121/122/124；**#99** 与主干已合的 N-99 族可能重叠；PR **#104** 平板横屏 / 16px / l99 可滚；PR **#105** N-159…161；PR **#106** N-162…164；PR **#108** N-165…167；PR **#107** `cursor/ux-tablet-p0-5359`（坦克双垫 / 消消乐与地鼠钳高 / r18-B 摘合）—— r36 **不要**另开同义号。

---

## 1. 读 r22–r35 与主干

### 1.1 主干相对 r21 学习草稿

| 主题 | 主干 | 学习草稿曾误写 |
| --- | --- | --- |
| N-99 | `l99-board` 可滚 | 「未合」 |
| N-97 | 农场钉底 | 「未合」 |
| N-100 | 进场锚定 | 「未合」 |
| N-109 | root 门已销 | 「未销」 |
| N-108 | puzzle-tiles 无尽 | r21 草稿改义，作废 |

### 1.2 r22–r35 已交卷（均未合主干）

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

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.sks-opt` | 已 `min-height:44px`（约 L138） |
| `.clf-pick` | 已 `min-height:${SWATCH_MIN_PX}` |
| `.als-item` | 清单 **div**，不是 button |
| `.bvp-btn` / `.bvp-btn-sm` / `.bvp-act` | N-150 |
| `.bvp-mode` | N-149 / N-150 可并；矮档已钉 44 |
| `.bc-pick` / `.bl-pick` | N-145（bowling 现测已 44；bumper 仍走旧号） |
| `.dvs-pick` | N-148 |
| `.dr-rules-close` / `.dr-resume` | N-165/166 |
| `.oa-board summary` / `.cg-log-sum` | N-162/163 |
| 坦克双垫 / 消消乐·地鼠钳高 | PR #107，勿撞 |
| 平板横屏 / 16px / l99 可滚 | PR #104 / 主干 N-99 |

---

## 2. 本轮新开（N-168 起）

### N-168 · B · brave-path 岔路选项 `.bvp-opt`

**证据**：`src/games/brave-path/index.ts` 约 L239：

```text
.bvp-opt{border:none;border-radius:16px;padding:13px;cursor:pointer;…display:flex;gap:10px;align-items:center;}
```

无 `min-height`。子件 `.bvp-opt-em` 写死 **34×34**（约 L242），是卡内图标，不是整钮热区。选项钮本身只靠 padding 13 + 两行字撑高。

**与旧号边界**：N-150 点名 `.bvp-btn` / `.bvp-btn-sm` / `.bvp-act`，并允许把大厅 `.bvp-mode` 并进去——**没有** `.bvp-opt`。N-149 扫 `*-mode` 胶囊，不是局内岔路卡。N-146 豁免 padding≥14 的大卡，本钮 **13px** 贴线。

**建议**：`.bvp-opt { min-height: 44px; }`。测闯关岔路口点选项。勿改战斗公式 / 关卡表 / N-150 顶栏。

### N-169 · B · puff-bros 选角 `.pfb-pick`

**证据**：`src/games/puff-bros/index.ts` 约 L251：

```text
.pfb-pick{…padding:12px 16px;min-width:132px;cursor:pointer;…}
```

无 `min-height`。有 `.pfb-pick-name` + `.pfb-pick-sub` 两行，390 上通常够高，但 **空态 / 单行 / 字号收档** 没有 CSS 地板。`.pfb-open` 已走 `TOUCH_MIN=44`。

**与旧号边界**：N-145 是 bowling / bumper **选车/选瓶**；N-148 是 `.dvs-pick` + `.hh-catch`；N-152 是 `.pfb-veil-btn`。本号只打 **选角色卡**。

**建议**：`.pfb-pick { min-height: 44px; }`。测模式页点角色。勿改 puff 物理 / 摇杆 `--k`。

### N-170 · A · `*-opt` 必须 min-height≥44 静态巡检

**证据**：N-149 扫 `*-open`/`*-mode`；N-150 不扫 `opt`。全库 button 规则目前两处：`.sks-opt` 已绿、**`.bvp-opt` 红**。`-optbar` 是容器，不是钮。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-opt{` / `.-opt,` 且指向 **button**（或 `cursor:pointer` 的可点块）必须 `min-height`≥44，或 `TOUCH_MIN`/`MIN_HIT_PX` 插值。豁免：`.xxx-optbar` 容器、`.xxx-opt-em` 图标、`pointer-events:none`。N-168 修完应变绿。勿与 N-149/150/164/167 并号。

---

## 3. 给 A / B

- **A**：先合 N-170（或与 B 并行，巡检应对 `.bvp-opt` 现状为红、`.sks-opt` 绿）。
- **B**：N-168 与 N-169 可同一 PR 分两段验收。不要改 `SKY_H`。不要碰 N-108 无尽画廊。不要跟 PR #107 抢坦克双垫 / 消消乐钳高。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-171**。N-168…N-170 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r36-learn-notes-1cd5`
