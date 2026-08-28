# 三人组第 11 轮 · 测试修复员 A 记录

基线:本分支从 `game-1.3` 拉出时为 `463a3ed4`；交卷前已 **merge 最新 `origin/game-1.3`（含 7779 先合版）**。
分支:`cursor/trio-r11-tester-a-c14c`，目标再合入 `game-1.3`。
执行依据:`docs/qa/trio-r10-playbook.md`。
方法:源码对账 + Vitest + preview **4179** + `/usr/local/bin/google-chrome`（`setBypassServiceWorker`）。主档 **915×412**；进度路 `Array(N).fill(1)` 后 `.l99-continue`。
水位:merge 前本分支 `npm test` **1124 / 19360** 全绿、`npm run build` 绿。主干此时已报 1128 / 19369。测试只增不减。

## 对账

- **未重做** N-39 / L-2 / L-3 / S-4 / N-33…38。`.qz-jump-input` 仍 44px。
- **先合版**（`16e55f2a` 已在主干）：N-43 `.clf-ops` + 双栏；N-44 quiz 扩 `.mtf-vert` / `.mtf-illus`。
- **7779 补笔已在主干**：`.clf-wrap.clf-scrolly{overflow:hidden}`；N-44 排除 `.mtf-illus-count`；`timed135.r11.test.ts`。
- 未碰 B：fight-king / duo-rush / gold-hook。kit 零改。

## 本分支在先合版上的增量（c14c）

### N-43 limited 最严档 ✅

- 右栏 `minmax(280px,42%)`，锅/工具/五原色 **nowrap**，画布 `max-height:min(200px, calc(100dvh - 120px))`。
- `fitColoringStage` 在矮横屏 dock 上 **不挂 `.clf-scrolly`**（CSS 的 `overflow:hidden` 一并保留）。
- **915×412 Chrome**：七关型 + 第 1 关线下 0；limited `display:grid`、无 scrolly；色票 top=304 / 锅 216 / 撤销 123，`elementFromPoint` 命中自身。390×844 / 412×915 / 1024×768 memory+limited 线下 0。

### N-44 竖式三钮 ✅

- 保留主干 `:not(.mtf-illus-count)`，不回收数一数贴纸。
- **915×412 进度路第 100 关**：三枚 `.qz-choice` top=366 / mid=389 < 舞台裁切 404，`elementFromPoint` 命中；第 1 关 top=293。

### N-37 加重档复测 ✅（未新开号、未改 `level99.ts`）

- root 限时 × pinyin-train 135：`.l99-jump` 在场；三票 top=352 / bottom=400 / mid=376，命中 `qz-choice`。

## 完成定义

| 编号 | 状态 |
| --- | --- |
| N-43 | ✅ 先合版 + 本分支 limited 右栏/nowrap + 真机数字 |
| N-44 | ✅ 先合版 + count 排除保留 + 第 100 关真机数字 |
| N-37×135 | ✅ 真机三票可点 |
| N-45 | B 范围，未动 |
