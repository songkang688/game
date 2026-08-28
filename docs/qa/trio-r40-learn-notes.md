# r40 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r40-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r39 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**（N-174…176 拔河 pick/btn）与 **r39**（N-177…179 教案钮 / 大厅模式卡）。本轮第一次点名 **贪吃蛇大厅 `.sn-open`**（N-147 只钉 `.sn-back`；N-149 首例是 `.sks-mode` 胶囊）以及 **冲刺菜单软钮基规则**（N-87 只在 `max-height:500` 里补 44）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r40 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B duo-vs 开打+芯片 / 赛中键 | 只回归 |
| N-95～N-108 / C-5 / N-29 尾款 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | PR **#87**；A **#94**、B **#96** | 勿重做 |
| N-125…128 | PR **#90** r22 | 勿重开 |
| N-129…131 | PR **#91** r23 | 勿重开 |
| N-132…134 | PR **#92** r24 | 勿重开（`.shr-toggle` 仍 36 走 **N-134**） |
| N-135…137 | PR **#93** r25 | 勿重开 |
| N-138…140 | PR **#95** r26 | 勿重开 |
| N-141…143 | PR **#97** r27 | 勿重开 |
| N-144…146 | PR **#98** r28 | 勿重开 |
| N-147…149 | PR **#100** r29 | 勿重开（N-147 = **`.sn-back` / `.pz-back`**；N-149 首例 **`.sks-mode`**） |
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
| **N-180 起** | **本轮新开** | 见 §2 |

**并号（r22–r39 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135（含 `.bl-back` / `.fs-back` / `.oa-back` / `.bd-back`）；mole 盘面 **C-5** / rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bh-mode` 已由 `visual.ts` 钉 44。`.bba-swap` → N-132。fruit-catch `.frc-open`/`.frc-back` → **N-121**（#96 在途）。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` 出屏 → **N-95**。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**（**保龄 `.bl-btn` 仍红走旧号**）。`.l99-tool`/tab/continue/ov-btn → **N-138**。`.sks-mode` 胶囊 → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单矮横屏 sticky**（不是 390 竖屏基规则）。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pcp-act` / `.pzt-eye` → **N-151**。`.clf-pick` / `.sks-opt` 已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` 巡检 → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.as-open,.as-back` 同文件已钉 44。`.fdf-btn` 已 44。`.snk-toggle` 已 44。`.pz-open` / `.pz-back` 现测已 44（N-147 返回段；入口已绿）。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#112** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r39 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| N-108 | puzzle-tiles **无尽**（A 文档 + B 源码） | r21 改义作废 |
| `.dvs-pick` | **N-94** 已 44 | r29 N-148，取先合 |
| `.bc-pick` | **N-102** 已 44 | N-145 碰碰车段作废 |
| `.dvs-lessonbtn` / `.dvs-mode` | **仍无 min-height** | r39 N-177/178，未合主干 |
| `.sn-open` | **仍无 min-height** | r29 N-149 巡检漏网实例 |
| `.dr-softbtn` 基规则 | 无 min-height | N-87 只写进矮横屏 media |

### 1.2 r22–r39 已交卷（均未合主干）

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
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.dvs-lessonbtn` / `.dvs-mode` | N-177/178 |
| `.dvs-pick` / `.dvs-go` / `.dvs-over button` | N-94 / N-173 / N-157 |
| `.sn-back` | **N-147**（仍红走旧号） |
| `.sks-mode` | **N-149** |
| `.frc-open` / `.frc-back` | N-121（#96） |
| `.bl-btn` | **N-145** 仍红 |
| `.rbg-pick` / `.rbg-btn` | N-174/175 |
| `.gdh-tally` / `.ak-card` / `.pk-go` | N-171/172/173 |
| `.xq-start` | N-95；矮横屏 padding 收档勿撞旧号 |
| `.dc-mode` / `.dmz-mode` / `.jq-mode` | padding **14** 大卡；r39 已记并 N-146/N-149 边缘 |
| `.fk-mode` | N-142 |
| `.shr-toggle` | **N-134**（现状 `min-height:36`） |
| `.shr-back` | N-134 |
| `.fs-back` / `.bl-back` / `.oa-back` / `.bd-back` | N-135 |
| `*-veil-btn` 各实例 | N-152 |
| `.bh-mode` / `.bh-btn` | visual.ts 已钉 44；N-47 |
| `.as-open,.as-back` | 同文件已 44 |
| `.fdf-btn` / `.fdf-zoomer` | 已 44 / `TOOL_MIN_H` |
| `.snk-toggle` | 已 44 |
| `.pz-open` / `.pz-back` | 已 44 |
| `.bwl-undo` | 写死 `height:44px` |
| `.mg-mile` | 里程碑飘卡，非大厅 CTA |
| `.dr-start` | padding 15 + 字号 20 估高过线；矮横屏走 N-87 |
| `.dr-rules-close` / `.dr-resume` | N-165/166 |
| 坦克双垫 / 消消乐钳高 | PR #107 |

---

## 2. 本轮新开（N-180 起）

### N-180 · B · snake-snack 大厅入口 `.sn-open`

**证据**：`src/games/snake-snack/index.ts` 约 L114：

```text
.sn-open { … padding: 9px 18px; font-size: 15px; … cursor: pointer; … }
```

无 `min-height`，也无 `touchUpliftCss`。估高 `9×2 + 15×1.2 ≈ 36`，低于 44。约 L842 大厅「无尽花园」是真正的 `<button class="sn-open">`；约 L775 无尽结算「再来」复用同一类。同文件 `.snk-toggle` 已钉 44；`.pz-open`（拼图）已 44。padding **9**，不在 N-146「≥14」豁免里。

**与旧号边界**：N-147 明文只打 **`.sn-back` / `.pz-back`**。N-149 巡检首例是 **`.sks-mode` 胶囊**；`.sn-open` 从未点名。N-121 是 fruit-catch。N-173 是 `*-go`。本号只打 **贪吃蛇 `.sn-open`**。`.sn-back` 仍红继续走 N-147，勿并号。

**建议**：`.sn-open { min-height: 44px; }`。测大厅点无尽 + 无尽结算再来。勿改蛇步进 / 花园题库 / `.snk-toggle` 文案。

### N-181 · B · duo-rush 菜单软钮 `.dr-softbtn`

**证据**：`src/games/duo-rush/index.ts` 约 L380：

```text
.dr-softbtn { … padding: 12px; font-size: 16px; … cursor: pointer; … width: 100%; … }
```

基规则无 `min-height`。估高 `12×2 + 16×1.2 ≈ 43.2`，贴线不够。约 L477–478：`.dr-rulesbtn` / `.dr-collectbtn` 都挂在 `.dr-softbtn` 上。N-87 只在 **`@media (max-height: 500px)`** 里给 `.dr-menu-cta .dr-softbtn` 写 `min-height: 44px`。**390×844 竖屏不进该媒体查询**，基规则仍红。

**与旧号边界**：N-87 是矮横屏 **菜单 CTA sticky 出屏**，已合主干；不要回退 `.dr-btns`。N-165/166 是规则关闭 / 暂停继续。N-180 是贪吃蛇。本号只打 **冲刺菜单软钮的 CSS 地板**（怎么玩 / 收藏册）。勿改赛道物理。

**建议**：基规则 `.dr-softbtn { min-height: 44px; }`（或 `box-sizing:border-box` 后仍 ≥44）。测 390×844 点怎么玩 / 收藏册；915 矮横屏回归 N-87 钉顶。

### N-182 · A · `*-softbtn` 必须 min-height≥44 静态巡检

**证据**：全库仅 **`.dr-softbtn` 一处** `.-softbtn` 规则，现状红。N-149/170/173/176/179 都不扫这个后缀。`.dr-start` 不进本扫描（估高过线；布局走 N-87）。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-softbtn{` 且指向 **button** 必须 `min-height`≥44 或 TOUCH 插值。N-181 修完应变绿。勿与 N-87/181 并号（87 管矮横屏布局；181 管实例；本号管**漏网后缀**）。

---

## 3. 给 A / B

- **A**：先合 N-182（或与 B 并行；应对 `.dr-softbtn` 现状为红）。
- **B**：N-180 与 N-181 可分 PR（两款游戏）。不要改 `SKY_H`。不要回退 N-87 sticky。不要把 `.sn-back` 改挂到 N-180。不要跟 PR #107 抢坦克双垫。bowling `.bl-btn` 仍走 **N-145**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-183**。N-180…N-182 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r40-learn-notes-1cd5`
