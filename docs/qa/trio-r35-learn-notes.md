# r35 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r35-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`17356717`**（r19 文档；`b7677155` 已合 N-99/97/100/109）。r20–r34 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。本轮第一次把 **规则层关闭钮 / 暂停「继续」** 当独立热区族扫（r22–r34 的 N-136/146/149/152/164 都不专扫 `*-rules-close` / `*-resume`）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r35 动作 |
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
| **N-165 起** | **本轮新开** | 见 §2 |

**并号（r22–r34 已占，勿新开）**：`.dvs-back`/pad → N-94/101；`.dvs-pick` → N-148；`.ld-back` → N-104；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole/rbv-foe → N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**（PR #79）；`.bba-swap` → N-132；fruit-catch 开/返回 → N-121；`.se-deed` 并 G-3；`.hh-back*` 牌背豁免；象棋 `.xq-seg` 估高≈44.8 现测已绿；poop `MIN_HOT_DUO=34` 仅注释遗物。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135。排行榜 / 象棋记谱 `<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-145**。`.l99-tool`/tab/continue → **N-138**。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺 **菜单** CTA（`.dr-start` / `.dr-softbtn`），**不含** 规则关闭 / 暂停继续。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109。

**在途勿重做**：PR **#94** N-117/118/120；**#96** N-121/122/124；**#99** 与主干已合的 N-99 族可能重叠；PR **#104** `cursor/qa-b-tablet-landscape-5f46`（平板横屏 / 16px / l99 可滚）；PR **#105** N-159…161；PR **#106** N-162…164。

---

## 1. 读 r22–r34 与主干

### 1.1 主干相对 r21 学习草稿

| 主题 | 主干 | 学习草稿曾误写 |
| --- | --- | --- |
| N-99 | `l99-board` 可滚 | 「未合」 |
| N-97 | 农场钉底 | 「未合」 |
| N-100 | 进场锚定 | 「未合」 |
| N-109 | root 门已销 | 「未销」 |
| N-108 | puzzle-tiles 无尽 | r21 草稿改义，作废 |

### 1.2 r22–r34 已交卷（均未合主干）

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
| r30 | #101 | N-150…152 | brave-path / pzt-eye+pcp-act / `*-veil-btn` |
| r31 | #102 | N-153…155 | sky-squad `--k` / 王子格子 / `--k:\d+px` |
| r32 | #103 | N-156…158 | 仓鼠 grid-auto-rows / fs-act+dvs-over / `grid-auto-rows` |
| r33 | #105 | N-159…161 | wgd-garden-flower / clf-work / 写死宽高 button |
| r34 | #106 | N-162…164 | 排行榜 summary / cg-log-sum / summary 巡检 |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.as-back` | 同文件 `touchUpliftCss` + `.as-open,.as-back{min-height:44px}`（约 L184） |
| `.xq-rules-close` / `.dua-rules-close` | 已 `MIN_HIT_PX` / `min-height:44` |
| `.dua-resume` | 落在 `.dua-splash .row button{min-height:44px}` |
| `.guide-close` | 基础规则 38×38，但后段 `min-height`/`min-width` 44 抬住 |
| `.pk-go` / `.pyt-go` | 估高 ≥44 或已钉 `CHIP_MIN_PX` |
| `.slb-coach-dot` / `.bc-knob` / `.fk-stick-dot` | 装饰或摇杆内 |
| `.cg-sq` / `.se-tile` / 仓鼠迷宫格 | 棋盘/地格/迷宫豁免 |
| `.wgd-garden-flower` / `.clf-work` | N-159 / N-160 |
| `.oa-board summary` / `.cg-log-sum` | N-162 / N-163 |
| 平板横屏 / 16px / l99 可滚 | PR #104 / 主干 N-99 |

---

## 2. 本轮新开（N-165 起）

### N-165 · B · duo-rush 规则层 `.dr-rules-close`

**证据**：`src/games/duo-rush/index.ts` 约 L421：

```text
.dr-rules-close { … font-size: 15px; font-weight: 800; padding: 9px 16px; cursor: pointer; … }
```

无 `min-height`。节点约 L516 `<button class="dr-rules-close">✖ 关闭</button>`。估高 ≈ padding 18 + 15px 行框 ≈ **36–40**，低于 44。

同仓库对照：象棋 `.xq-rules-close`、擂台 `.dua-rules-close` **已经**钉 44。本款抄了结构、漏了高度。

**与旧号边界**：N-87 是冲刺 **菜单** CTA（怎么玩/收藏/开跑），不是规则浮层关闭。N-135 不含 duo-rush。N-147 是 snake/puzzle 返回。

**建议**：`.dr-rules-close { min-height: 44px; }`（可 `inline-flex` 垂直居中）。测打开「怎么玩」再点关闭。勿改赛道物理 / N-87 菜单钉顶。

### N-166 · B · duo-rush 暂停 `.dr-resume`

**证据**：同文件约 L417：

```text
.dr-resume { … padding: 13px 28px; font-size: 17px; … cursor: pointer; … }
```

无 `min-height`。节点约 L512 `▶ 继续比赛`。padding 13 估高贴线（约 13+13+20 ≈ 43），窄字体/缩放会掉到 44 下。**不是** `.dr-btns button`（那条已 46）。

**与旧号边界**：N-152 是 `*-veil-btn`（puff/sky/poop 结算罩）。N-87 不管暂停罩。擂台 `.dua-resume` 已吃 splash 行 44，**本号只打冲刺暂停继续**。

**建议**：`.dr-resume { min-height: 44px; }`。测暂停再点继续。可与 N-165 同一 PR，**不要并号**（规则层 ≠ 暂停罩）。

### N-167 · A · `*-rules-close` / `*-resume` 必须 min-height≥44 静态巡检

**证据**：N-146 扫「缺 min-height」但豁免 padding≥14 的大卡，`.dr-resume` 的 13px padding 贴着豁免线；规则关闭写在 `index.ts` 内联 `<style>`，只扫独立 `.css` 会漏。N-149 只扫 `*-open`/`*-mode`。N-164 只扫 `<summary>`。

全库现测：关闭钮三处（xq/dua 已绿、**dr 红**）；继续钮两处（dua 绿、**dr 红**）。以后新对战款复制这套浮层会再漏。

**建议**：扫描 `src/games/**/*.{css,ts}`：选择器匹配 `rules-close` / `-resume` 的 **button** 规则必须 `min-height`≥44，或紧随 `touchUpliftCss` / `MIN_HIT_PX`/`TOUCH_MIN` 插值。豁免：非按钮、被父选择器 `button{min-height:≥44}` 覆盖且本规则不把高度压回去。N-165/166 修完应变绿。勿与 N-146/164 并号。

---

## 3. 给 A / B

- **A**：先合 N-167（或与 B 并行，巡检应能把 N-165/166 现状打红）。
- **B**：N-165 与 N-166 可同一 PR、分两个 commit/验收段。不要改 `SKY_H`。不要碰 N-108 无尽画廊语义。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-168**。N-165…N-167 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r35-learn-notes-1cd5`
