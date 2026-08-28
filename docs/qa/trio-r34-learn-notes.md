# r34 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r34-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`17356717`**（r19 文档；`b7677155` 已合 N-99/97/100/109）。r20–r33 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。本轮第一次把 `<summary>` 当独立热区族扫（r22–r33 的 N-136/143/146/149/152/155/158/161 都不扫折叠标题）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r34 动作 |
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
| **N-162 起** | **本轮新开** | 见 §2 |

**并号（r22–r33 已占，勿新开）**：`.dvs-back`/pad → N-94/101；`.dvs-pick` → N-148；`.ld-back` → N-104；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → N-144；`.rbe-back` → N-133；`.shr-back`/toggle → N-134；四款返回 bowling/fishing/orb/block-drop → N-135；mole/rbv-foe → N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**（PR #79）；`.bba-swap` → N-132；fruit-catch 开/返回 → N-121；`.se-deed` 并 G-3；`.hh-back*` 牌背豁免；象棋 `.xq-seg` 估高≈44.8 现测已绿；poop `MIN_HOT_DUO=34` 仅注释遗物。仓鼠 `--cell` / `grid-auto-rows:40px` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.oa-back` → N-135（**不含** `.oa-board summary`）。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109。

**在途勿重做**：PR **#94** N-117/118/120；**#96** N-121/122/124；**#99** 与主干已合的 N-99 族可能重叠；PR **#104** `cursor/qa-b-tablet-landscape-5f46`（平板横屏 / 16px / l99 可滚）—— r34 **不要**另开同义号。

---

## 1. 读 r22–r33 与主干

### 1.1 主干相对 r21 学习草稿

| 主题 | 主干 | 学习草稿曾误写 |
| --- | --- | --- |
| N-99 | `l99-board` 可滚 | 「未合」 |
| N-97 | 农场钉底 | 「未合」 |
| N-100 | 进场锚定 | 「未合」 |
| N-109 | root 门已销 | 「未销」 |
| N-108 | puzzle-tiles 无尽 | r21 草稿改义，作废 |

### 1.2 r22–r33 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22 | #90 | N-125…128 | 字号 / 农场按钮 / 写死 14px |
| r23 | #91 | N-129…131 | 农场 `--k` / 农场键盘 / `--k` 巡检 |
| r24 | #92 | N-132…134 | bba-swap / rbe-back / shr-back |
| r25 | #93 | N-135…137 | 四款返回 / 写死宽高 / `min-height` 扫描 |
| r26 | #95 | N-138…140 | 农场 `--k` 复核 / mole / sp-key |
| r27 | #97 | N-141…143 | ld-btn / fk-mode / 写死 40/42 |
| r28 | #98 | N-144…146 | fk-ch / bowling / 缺 min-height |
| r29 | #100 | N-147…149 | snake/puzzle 返回 / hh-catch+dvs-pick / `*-open` |
| r30 | #101 | N-150…152 | brave-path / pzt-eye+pcp-act / `*-veil-btn` |
| r31 | #102 | N-153…155 | sky-squad `--k` / 王子格子 / `--k:\d+px` |
| r32 | #103 | N-156…158 | 仓鼠 grid-auto-rows / fs-act+dvs-over / `grid-auto-rows` |
| r33 | #105 | N-159…161 | wgd-garden-flower / clf-work / 写死宽高 button |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.slb-coach-dot` | 装饰 span，非整控件 |
| `.bc-knob` / `.fk-stick-dot` | 嵌在大摇杆内 |
| `.pk-go` | 估高 ≈45.6，现测已绿 |
| `.ktc-cat` | 整猫 SVG，通常够高 |
| `.cg-sq` | 棋盘格 40，沿用豁免 |
| `.oa-back` | 已占 N-135 |
| 仓鼠迷宫格 | N-80 / N-156 |
| `.wgd-garden-flower` | N-159 |
| 平板横屏 / 16px / l99 可滚 | PR #104 / 主干 N-99，勿撞 |

---

## 2. 本轮新开（N-162 起）

### N-162 · B · 排行榜 `<summary>` 无高度

**证据**：

- `src/games/orb-arena/index.ts` 约 L97：`.oa-board summary{cursor:pointer;font-size:16px;}` —— 无 padding、无 min-height。
- `src/games/snake-royale/index.ts` 约 L111：`.sr-board summary{cursor:pointer;font-size:16px;}` —— 同上。

**与旧号边界**：N-135 只管 `.oa-back` / 钓鱼 / bowling / block-drop **返回钮**，不含折叠标题。N-147 只管 snake/puzzle **返回**，不含 royale 排行榜折叠。

**建议**：两选择器统一 `min-height:44px` + 足够 padding；可共用一条规则或分别改。测 orb-arena 与 snake-royale 打开排行榜折叠。

### N-163 · B · 象棋记谱折叠 `.cg-log-sum`

**证据**：`src/styles.css` 约 L2331：`.cg-log-sum { font-size:13px; }`（约 L3260 `.cg-wrap .cg-log-sum` 已把字号提级到 14，**仍无 min-height**）。节点来自 `chess-garden/view.ts` 约 L183 `el("summary","cg-log-sum")`。

**与旧号边界**：N-140 是 `.sp-key`；象棋 `.xq-seg` 估高已绿、不新开。本号只打 **记谱 `<summary>`**。

**建议**：`.cg-log-sum { min-height:44px; }`，必要时把 13px 并进字号债（已有 N-125 族则只补高度、勿重复开字号）。测棋园打开记谱折叠。

### N-164 · A · `<summary>` 必须 `min-height`≥44 静态巡检

**证据**：r25–r33 的巡检都不扫 `<summary>`。全库至少还有 orb-arena、snake-royale、chess-garden 三处折叠标题裸奔。以后新游戏用 `<details>/<summary>` 会再次漏网。

**建议**：静态扫描 `src/games/**/*.{css,ts}` 与 `src/styles.css` 里 `summary` / `*-sum` 规则：若选择器点到可点折叠标题且无 `min-height`≥44（或等价 padding 估高≥44），失败。豁免：纯装饰、禁用、被更大热区包裹且自身不可点。本库 orb/snake 排行榜 CSS 写在 `index.ts` 内联样式，只扫 `.css` 会漏。

---

## 3. 给 A / B

- **A**：先合 N-164 巡检，避免 B 补完 N-162/163 后新游戏再漏。可与 N-161 写死宽高扫描并列，勿合并成一个号。
- **B**：N-162 两款排行榜可同一 PR；N-163 象棋记谱单独测。不要改 `SKY_H`。不要碰 N-108 无尽画廊语义。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-165**。N-162…N-164 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r34-learn-notes-1cd5`
