# 三人组第 33 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `17356717`。
> 前文：PR #103 r32（N-156…N-158）… #90 r22；**PR #94** A、**PR #96** B。
> 本轮 `src/**` 零改动。三视口 390×844 / 915×412 / 1024×768。
> **编号从 N-159 起**。撞车取主干先合版。

## 一、抽验方式

- 读 r22–r32。主干未再前进。
- grep：`width:3[0-9]px;height:3[0-9]px` 且 `cursor:pointer` / `button`；画廊缩略图无 `min-height`。
- 未开无头浏览器。

## 二、号段（先合版）

N-99/97/100/109 主干已销。N-108 = 拼图无尽画廊。N-110…116 跳过。N-117…158 在途 PR 已占。本轮 **N-159 起**。

并号：N-94/101/148 dvs；N-104/141 地主；N-142/144 fk；N-133–135；N-145 bowling/bumper；N-147–152；**N-153–155 `--k`**；**N-156–158 仓鼠格子 / fs-act / grid-auto-rows**。仓鼠 `.bh-btn` → N-47；棋盘 `--cell` 是迷宫格（div，走方向键），**不开号**。弹弓 `.slb-coach-dot` 是装饰 span，不开号。碰碰车 `.bc-knob` 热区是整颗摇杆。match-stars 格子走 **N-127**。kit N-132。fruit-catch N-121。

## 三、对账

- 主干 SHA 与 r31/r32 相同。N-105 / N-12 族 / C-8 / N-90 / N-99 族只回归。
- 钓鱼 `@media (max-height:660px)` 已给 `.fs-act` 钉 44；**720 档仍无**（N-157）。
- N-155/158 扫 `--k` / `grid-auto-rows`；本轮 N-161 扫 **写死宽高的 button**。

## 四、新抽验（N-159 起）

### N-159 🔧 B · word-garden 花园花钮 34×34

`word-garden/tracing.ts` ~L138：

```text
.wgd-garden-flower{...;width:34px;height:34px;cursor:pointer;}
```

是真正的 `<button>`，点开花看字/拼音（~L373/390）。不是装饰。抬到 44（可略收花园 `max-height:15vh`，勿改描红判定 / 题库）。390/915 量。

### N-160 🔧 B · color-fun 作品缩略图 `.clf-work` 无 min-height

`.clf-work{padding:2px;cursor:pointer}`，**没有** `min-height`。画廊 `repeat(4,1fr)`（窄屏 3 列）。横构图 SVG 在 390 上高度可能 <44。`clf-tight` 注释写「tool/swatch/primary/zoom 热区不动」，**没覆盖** `.clf-work`。

补 `min-height:44px`（或 `min(100%,44px)` 高度）。勿改调色/关卡图。

### N-161 🔧 A · 写死宽高 <44 的 button 巡检

N-155 扫 `--k`，N-158 扫网格行高。本号：游戏 CSS 里 `button`（或 `cursor:pointer` 且 `type=button` 选择器）同时出现 `width:` 与 `height:` 数字且任一 <44 → 失败。豁免：`pointer-events:none`、摇杆内部装饰点（`.bc-knob` / `.fk-stick-dot`）、非 button 的 span。N-159 修完应变绿。

## 五、r22–r32 只派不换号

A：N-161；N-158/155/152/149；PR #94。  
B：N-159/160；N-156/157/153/154/150/151；N-135 三款；N-125/126/129；N-108；N-127 抽验款。

## 六、纪律

只交本文 + `trio-r33-playbook.md`。下一空号 **N-162**。
