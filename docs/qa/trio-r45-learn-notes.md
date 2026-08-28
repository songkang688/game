# r45 学习笔记 · 测试员 C

**角色**：只交本文 + `trio-r45-playbook.md`。**零改 `src/**`**。三视口 390×844 / 915×412 / 1024×768。热区 ≥44。中文简体。

**基线**：`origin/game-1.3` @ **`f7dbe72e`**（r19 B：N-94～N-108 / N-29 尾款 / C-5；其下 r19 A `17356717` 销 N-99/97/100/109）。r20–r44 学习文档均未合入主干。

**本轮抽验**：2026-08-28。无头 Chrome 本拍未跑；新伤给选择器 + 行号。读 **r38**～**r44**。地图格已由 r44 点名；本轮拆两处半残捆号：**射击 `.shr-back` 仍无 44**（N-134 另一半 `.shr-toggle` 故意 36），以及 **level99 地图「继续」`.l99-continue`**（N-138 捆了 back/tool/tab/ov-btn/continue，跳关输入框已 44）。

---

## 0. 号段权威（先合版）

| 段 | 权威 | r45 动作 |
| --- | --- | --- |
| N-94 / N-101 | 主干 r19 B | 只回归 |
| N-95～N-108 / C-5 / N-29 尾款 | 主干 r19 B | 只回归 |
| N-99 / 97 / 100 / 109 | 主干 r19 A | 只回归 |
| N-110…116 | 永久跳过 | 勿开 |
| N-117…124 | PR **#87**；A **#94**、B **#96** | 勿重做 |
| N-125…128 | PR **#90** r22 | 勿重开 |
| N-129…131 | PR **#91** r23 | 勿重开 |
| N-132…134 | PR **#92** r24 | 勿重开 **整捆**；`.shr-back` 见 §2 |
| N-135…137 | PR **#93** r25 | 勿重开 |
| N-138…140 | PR **#95** r26 | 勿重开 **整捆**；`.l99-continue` 见 §2 |
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
| N-171…173 | PR **#110** r37 | 勿重开（`.pk-go` 仍走 N-173） |
| N-174…176 | PR **#111** r38 | 勿重开 |
| N-177…179 | PR **#112** r39 | 勿重开 |
| N-180…182 | PR **#113** r40 | 勿重开 |
| N-183…185 | PR **#114** r41 | 勿重开 |
| N-186…188 | PR **#115** r42 | 勿重开 |
| N-189…191 | PR **#116** r43 | 勿重开 |
| N-192…194 | PR **#117** r44 | 勿重开 |
| **N-195 起** | **本轮新开** | 见 §2 |

**并号（r22–r44 + 主干先合，勿新开）**：`.dvs-back`/pad/`.dvs-pick` → **N-94/101**；`.dvs-go` → **N-173**；`.dvs-over button` → **N-157**；`.dvs-lessonbtn` / `.dvs-mode` → **N-177/178**；`.ld-back` → **N-104**；`.ld-btn` → N-141；`.fk-mode` → N-142；`.fk-ch` → **N-144**；`.rbe-back` → N-133；`.shr-toggle` → **N-134**（36）；四款返回 bowling/fishing/orb/block-drop → **N-135**；mole 盘面 **C-5**（`.mp-open`/`.mp-back` 已 44）；rbv-foe N-139；`.sp-key` → N-140；仓鼠 `.bh-btn` → **N-47**。`.bba-swap` → N-132。fruit-catch 开/返回 → **N-121**。`.se-deed` 并 G-3。`.hh-back*` 牌背豁免。象棋 `.xq-seg`/`.xq-start` → **N-95**。仓鼠 `--cell` → N-80 / **N-156**。`.wgd-garden-flower` → **N-159**。`.clf-work` → **N-160**。`.clf-primary` 父盒已 44。`<summary>` → **N-162/163**。`.bc-open`/`.bc-pick` → **N-102**。bowling `.bl-btn`+pick → **N-145**。`.l99-tool`/tab/back/ov-btn → **N-138**（**不含**本轮 `.l99-continue`）。`.sks-mode` → **N-149**。`*-veil-btn` → **N-152**。N-87 冲刺菜单 sticky。`.dr-rules-close` / `.dr-resume` → **N-165/166**。`.bvp-btn` / `.bvp-act` → **N-150**。`.pzt-eye` 等拼图热区主干已 44。`.bvp-opt` / `.pfb-pick` / `*-opt` → **N-168/169/170**。`.gdh-tally` / `.ak-card` / `*-go` → **N-171/172/173**。`.rbg-pick` / `.rbg-btn` / `*-pick` → **N-174/175/176**。`*-lessonbtn` → **N-179**。`.sn-open` / `.dr-softbtn` / `*-softbtn` → **N-180/181/182**。`.sn-back` / `.pz-back` → **N-147**。`.pcp-act` → **N-183**。`.hh-catch` / `*-catch` → **N-184/185**。`.mmc-open` / `.mmc-toggle` / `*-toggle` → **N-186/187/188**。`.rbt-vs-btn` / `.rte-btn` → **N-189/190/191**。`.ba-lv` / `.cs-lv` / `*-lv` → **N-192/193/194**。`.pk-go` → **N-173**。`.pyt-go` 已 CHIP_MIN。`.as-open,.as-back` / `.ak-open,.ak-back` / `.tkb-back` / `.hp-back` / `.iff-btn` / `.mcr-btn` 已 44。`.fdf-btn` 已 44。

**已合只回归**：N-12/10/3/55/81、C-8、N-90、N-105、N-75…N-91、N-60/61/62、N-87/88、N-99/97/100/109、**N-94～N-108（B）**、C-5、N-29 尾款。

**在途勿重做**：PR **#94** / **#96** / **#99** / **#104** / **#105**～**#117** / **#107**（坦克双垫 / 消消乐·地鼠钳高 / 底栏 840）。

---

## 1. 读 r38–r44 与主干

### 1.1 主干相对学习草稿

| 主题 | 主干 `f7dbe72e` | 学习草稿 |
| --- | --- | --- |
| `.shr-toggle` | 仍 `min-height:36` | N-134，勿抬到 44 |
| `.shr-back` | **仍无 min-height** | N-134 一半未合；本轮拆出 |
| `.l99-continue` | **仍无 min-height** | N-138 捆号，未合 |
| `.ba-lv` / `.cs-lv` | 仍无 | r44，未合 |
| `.pk-go` | 仍无 | **N-173**，勿再开 |

### 1.2 r22–r44 已交卷（均未合主干）

| 轮 | PR | 号 | 主题 |
| --- | --- | --- | --- |
| r22…r37 | #90～#110 | N-125…173 | 见 r40/r44 表 |
| r38 | #111 | N-174…176 | rbg-pick / rbg-btn / `*-pick` |
| r39 | #112 | N-177…179 | dvs-lessonbtn / dvs-mode / `*-lessonbtn` |
| r40 | #113 | N-180…182 | sn-open / dr-softbtn / `*-softbtn` |
| r41 | #114 | N-183…185 | pcp-act / hh-catch / `*-catch` |
| r42 | #115 | N-186…188 | mmc-open / mmc-toggle / `*-toggle` |
| r43 | #116 | N-189…191 | rbt-vs-btn / rte-btn |
| r44 | #117 | N-192…194 | ba-lv / cs-lv / `*-lv` |

### 1.3 本轮新扫到、但**不开号**

| 选择器 | 理由 |
| --- | --- |
| `.ba-lv` / `.cs-lv` | N-192/193 |
| `.rbt-vs-btn` / `.rte-btn` | N-189/190 |
| `.mmc-open` / `.pk-go` / `.dvs-go` | N-186 / **N-173** |
| `.sks-mode` / `.sn-open` | N-149 / N-180 |
| `.pcp-act` / `.hh-catch` | N-183/184 |
| `.bl-btn` | **N-145** |
| `.oa-back` / `.bl-back` / `.fs-back` / `.bd-back` | **N-135** |
| `.l99-back` / `.l99-tool` / `.l99-tab` / `.l99-ov-btn` | **N-138** |
| `.shr-toggle` | **N-134**（36） |
| `.fk-ch` | **N-144** |
| `.rbg-supply` | 盘面补给 emoji，并 G-3 口径 |
| `.mg-mile` | 庆祝层 |
| 坦克双垫 | PR #107 |

---

## 2. 本轮新开（N-195 起）

### N-195 · B · shoot-range 返回 `.shr-back`

**证据**：`src/games/shoot-range/index.ts` 约 L190：

```text
.shr-back{…padding:8px 13px;font-size:14px;…cursor:pointer;…}
```

无 `min-height`。估高 `8×2 + 14×1.2 ≈ 32.8`。挂载约 L1377「← 返回」。同文件 `.shr-mode` 已 44；`.shr-toggle` 注释写明垫到 **36**。

**与旧号边界**：N-134 原文捆 **`.shr-back` + toggle**。toggle 仍走 N-134、**不要抬到 44**。本号只打 **返回钮**。N-147 是蛇/拼图大厅返回。N-135 是保龄/钓鱼/光球/方块。若 N-134 先合且已含 `.shr-back` 44，本号销。

**建议**：`.shr-back { min-height: 44px; }`。测选关点返回。勿改靶纸判定 / `.shr-toggle`。

### N-196 · B · level99 地图继续 `.l99-continue`

**证据**：`src/games/level99.ts` 约 L561：

```text
.l99-continue{…padding:8px 16px;font-size:15px;…cursor:pointer;…}
```

无 `min-height`。估高 `8×2 + 15×1.2 ≈ 34`。挂载约 L885。`.l99-jump-input` 已 44。padding **8**。

**与旧号边界**：N-138 原文捆 back/tool/tab/ov-btn/**continue**。本号只拆 **继续冒险那颗**。其余仍走 N-138。若 N-138 先合且已钉 `.l99-continue`，本号销。

**建议**：`.l99-continue { min-height: 44px; }`。测选关地图点继续。勿改 188 关表 / 跳关逻辑。

### N-197 · A · `*-continue` 必须 min-height≥44 静态巡检

**证据**：全库 `.-continue{` 可点规则仅 **`.l99-continue` 一处**，现状红。N-138/173/179/182/185/188/191/194 都不扫这个后缀。

**建议**：扫描 `src/games/**/*.{css,ts}`：`.-continue{` 且指向 button 必须 `min-height`≥44。N-196 修完应变绿。勿与 N-138/196 并号（138 是旧捆；196 管实例；本号管漏网后缀）。

---

## 3. 给 A / B

- **A**：先合 N-197（或与 B 并行）。
- **B**：N-195（shoot-range）与 N-196（level99.ts）分 PR。不要改 `SKY_H`。不要把 `.shr-toggle` 抬到 44。不要跟 #107 抢坦克双垫。`.pk-go` 走 **N-173**。`.ba-lv` 走 **N-192**。`.oa-back` 走 **N-135**。
- **C-8** 仍禁改 `SKY_H`。N-105 禁第四份 14→16 hunk。

---

## 4. 下一空号

**N-198**。N-195…N-197 本轮占用。

---

## 5. 开 PR

`https://github.com/songkang688/game/pull/new/cursor/trio-r45-learn-notes-1cd5`
