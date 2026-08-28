# r37 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r37-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`17356717`**（r19 文档；`b7677155` 已合 N-99/97/100/109）。r20–r36 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。本轮第一次把 **结算跳数 `*-tally`**、**古堡选章 `*-card` 大厅钮**、**`*-go` 开打/提交钮** 当独立热区族扫（N-146 扫「完全没写 min-height」时豁免 padding≥14 大卡，且不点名跳数 **div**；N-149 只扫 `*-open`/`*-mode`；N-87 只钉冲刺 **菜单** CTA）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r37 动作 |
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
| N-168…170 | PR **#109** r36 | 勿重开 |
| **N-171 起** | **本轮新开** | 见 §2 |

**并号（r22–r36 已占，勿新开）**：`.dvs-back`/pad → N-94/101；`.dvs-pick` → N-148；`.ld-back` → N-104；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole/rbv-foe → N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**；`.bba-swap` → N-132；fruit-catch 开/返回 → N-121；`.se-deed` 并 G-3；`.hh-back*` 牌背豁免；象棋 `.xq-seg` 估高已绿；poop `MIN_HOT_DUO=34` 仅注释遗物。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135。排行榜 / 象棋记谱 `<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` / bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/continue → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单** CTA。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**（**不含** `.bvp-opt`）。`.pcp-act` / `.pzt-eye` → **N-151**。`.clf-pick` 已钉 `SWATCH_MIN_PX`。`.sks-opt` 已钉 44。`.bvp-opt` / `.pfb-pick` / `*-opt` 巡检 → **N-168/169/170**。`.gdh-card` / `.gdh-buy` / `.gdh-btn` 已走 `TOUCH_MIN=44`（`feel12.test.ts` 已钉这几颗，**不含** `.gdh-tally`）。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109。

**在途勿重做**：PR **#94** N-117/118/120；**#96** N-121/122/124；**#99** 与主干已合的 N-99 族可能重叠；PR **#104** 平板横屏 / 16px / l99 可滚；PR **#105** N-159…161；PR **#106** N-162…164；PR **#108** N-165…167；PR **#109** N-168…170；PR **#107** `cursor/ux-tablet-p0-5359`（坦克双垫 / 消消乐与地鼠钳高 / r18-B 摘合）—— r37 **不要**另开同义号。

---

## 1. 读 r22–r36 与主干

### 1.1 主干相对 r21 学习草稿

| 主题 | 主干 | 学习草稿曾误写 |
| --- | --- | --- |
| N-99 | `l99-board` 可滚 | 「未合」 |
| N-97 | 农场钉底 | 「未合」 |
| N-100 | 进场锚定 | 「未合」 |
| N-109 | root 门已销 | 「未销」 |
| N-108 | puzzle-tiles 无尽 | r21 草稿改义，作废 |

### 1.2 r22–r36 已交卷（均未合主干）

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

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.gdh-card` / `.gdh-buy` / `.gdh-btn` / `.gdh-kit` | 已 `TOUCH_MIN`；`feel12.test.ts` 已钉 |
| `.gdh-tally-fly` | 44×140 **画布**，展示用，不是钮 |
| `.als-item` | 清单 **div**，不是 button |
| `.bmb-act` | `ACT_PX=46`，已 ≥44 |
| `.tkb-mini-btn` / `.tkb-act` / `.tkb-back` | 已 44；坦克双垫走 PR #107 |
| `.mcr-card` | 已 `min-height:44px` |
| `.clf-swatch` / `.clf-primary` | 已 `SWATCH_MIN_PX` |
| `.clf-work` | N-160 |
| `.wgd-say` / `.bc-say` / `.pk-say` / `.pyt-say` | 已 44 / CHIP |
| `.mg-say` / `.wq-say` | 读屏裁切，不是热区 |
| `.mg-mile` | 里程碑飘条，动画后淡出，不是常驻钮 |
| `.dvs-pick` | N-148 |
| `.dvs-mode` | N-149 `*-mode` |
| `.dvs-lessonbtn` | 两行标题+副文，padding 11；可并 N-146 大卡边缘，**不**新开。修 N-172 时勿顺手改教案列表（不同屏） |
| `.dvs-back` | N-94/101 |
| `.bvp-opt` / `.pfb-pick` | N-168/169 |
| `.pcp-act` | N-151 |
| `.l99-ov-btn` | padding 12 + 字号 17，估高贴 44；并 N-138 壳层 overlay，不新开 |
| `.xq-start` | padding 14 大卡；`.xq-seg` 估高已绿 |
| `.pk-chip` | 已 min-height 56 |
| `.pyt-go` | 已 `CHIP_MIN_PX`（N-173 对照绿样） |
| `.mj-btn.mj-go` / `.jq-btn.jq-go` | 修饰类，父钮已 44 |
| `.hh-card` / `.hc-card` / `.ld-card` | 牌面，不当大厅 CTA |
| 坦克双垫 / 消消乐·地鼠钳高 | PR #107，勿撞 |
| 平板横屏 / 16px / l99 可滚 | PR #104 / 主干 N-99 |

---

## 2. 本轮新开（N-171 起）

### N-171 · B · gold-hook 结算跳数 `.gdh-tally`

**证据**：`src/games/gold-hook/style.ts` 约 L108：

```text
.gdh-tally{font-size:26px;font-weight:900;color:#B37514;cursor:pointer;line-height:1.2;
  display:flex;align-items:center;justify-content:center;gap:6px;}
```

无 `min-height`。26px × 1.2 ≈ **31px** 高。`index.ts` 约 L1035 建的是 **div**（不是 button）；约 L1064 在 `line` 上绑 `click` 跳过跳数（约 L1038 提示「点一下直接看总数」）。父 wrapper 约 L1065 也可点，但可见点目标是这一行数字，不是 44px 的 `.gdh-tally-fly` 画布。

`feel12.test.ts` 只断言 `.gdh-btn` / 买钮 / 模式卡等，**漏了** `.gdh-tally`。

**与旧号边界**：N-161 扫写死 **宽+高** 的 button；本选择器没有 width/height。N-146 偏 button 规则。N-150 的 `*-act` 不是跳数。不要并进 `.gdh-card`（已绿）。

**建议**：`.gdh-tally { min-height: 44px; }`（或改成 `<button type="button">` 并钉 `TOUCH_MIN`）。测一趟结束结算屏：点数字立刻停在终值。勿改钩索物理 / 层深 / `TALLY_MS` 公式。

### N-172 · B · adventure-king 选章 `.ak-card`

**证据**：`src/games/adventure-king/index.ts` 约 L158：

```text
.ak-card{border:none;border-radius:16px;padding:10px;text-align:left;cursor:pointer;…}
```

无 `min-height`。约 L1435 是真正的 `<button type="button">`。两行 `.ak-card-t`（15px）+ `.ak-card-s`（12px + margin-top 3）在 390 上通常够高，但 **CSS 没有地板**：字号收档、单行、或副文被裁时会掉到 44 以下。padding **10**，踩在 N-146「padding≥14 大卡豁免」**之外**。

**与旧号边界**：N-28 / 古堡 modebar 是另一条。N-145/148/169 是选车/选档/选角，不是古堡章节卡。N-149 扫 `*-open`/`*-mode`，本钮是 `*-card`。

**建议**：`.ak-card { min-height: 44px; }`。测无尽/计时选章网格（390 两列、560+ 四列）。勿改走廊物理 / `CHAPTERS` 表 / N-28 `[hidden]`。

### N-173 · A · `*-go` 必须 min-height≥44 静态巡检

**证据**：N-149 扫 `*-open`/`*-mode`，不扫 `*-go`。N-87 只钉冲刺 **菜单** CTA。全库独立 `.-go{` 规则：

| 选择器 | 文件 | 现状 |
| --- | --- | --- |
| `.pk-go` | `pinyin-train/pickAll.ts` ≈L70 | padding 12，**无** min-height（红） |
| `.dvs-go` | `duo-vs-star/index.ts` ≈L192 | padding 13，**无** min-height（红） |
| `.pyt-go` | `pinyin-train/spell.ts` ≈L188 | 已 `min-height:${CHIP_MIN_PX}`（绿） |
| `.mj-btn.mj-go` / `.jq-btn.jq-go` | 修饰类 | 父 `.mj-btn`/`.jq-btn` 已 44，豁免 |

`.pk-go` 与同款 `.pyt-go` 是复制粘贴漏钉。`.dvs-go` 是对战开打条，**不是** N-87 冲刺菜单。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `.-go{` / `.-go,` 且指向 **button** 必须 `min-height`≥44 或 TOUCH/CHIP/MIN_HIT 插值。豁免：`.xxx-btn.xxx-go` 这类挂在已钉 44 的父钮上的修饰类；读屏/非交互。N-173 修完 `.pk-go`/`.dvs-go` 应变绿。勿与 N-87/149/168/170 并号。

---

## 3. 给 A / B

- **A**：先合 N-173（或与 B 并行；应对 `.pk-go`/`.dvs-go` 红、`.pyt-go` 绿）。
- **B**：N-171 与 N-172 可同一 PR 分两段验收。不要改 `SKY_H`。不要碰 N-108 无尽画廊。不要跟 PR #107 抢坦克双垫 / 消消乐钳高。不要把 N-171 做成改 `TALLY_MS`。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-174**。N-171…N-173 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r37-learn-notes-1cd5`
