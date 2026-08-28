# 三人组第 11 轮 · 测试修复员 A 记录

基线：进场时 `game-1.3` 已含 r10 合入（N-39 / S-4 / N-16 / L-2 / L-3 **禁止重做**）。
分支：`cursor/trio-r11-tester-a-7779`，目标合入 `game-1.3`。
执行依据：用户派发（r10 playbook 编号）+ `docs/qa/trio-r11-playbook.md`。
**编号红线**：N-40 是 duo-rush，不是 color-fun。N-45 gold-hook 商店是 B，本分支零触碰。

本环境与并行代理共享 `/workspace`，曾发生 rebase / 切分支冲掉未提交改动，故实现写在隔离 worktree `/tmp/trio-r11-a`。

## 对账：已合入、不重做

`git log origin/game-1.3` 可见 `16e55f2a` / `f1fd57d8` 已把 N-43/N-44 主修复合入主干：

- **N-43**：`color-fun/index.ts` 操作排收到 `.clf-ops`；`ui.ts` 矮横屏双栏（画布 `grid-area:stage` 左、`.clf-ops` sticky 右）。判定 / `mix.ts` / 线稿零触碰。
- **N-44**：`quiz99` 紧凑档扩到 `.mtf-vert` / `.mtf-illus`；`runner.ts` 竖式字号；`farmScene.ts` 作物卡钳高。题目数据 / 对错零触碰。

本轮 **不回滚** 先合版结构，只补验收缺口。

## 本轮补丁（在先合版上）

### N-43 补：矮横屏 `.clf-scrolly` 不许把操作排卷走

- **缺口**：JS `fitColoringStage` 仍可能给 `.clf-wrap` 挂 `overflow:auto` + `clf-scrolly`，双栏后操作排仍可能被整块卷走。
- **修**：`ui.ts` 在 `@media (max-height:500px) and (min-width:640px)` 写 `.clf-wrap.clf-scrolly{overflow:hidden;}`。热区 44px、混色表未动。
- **验收口径**：7 关型共用 `.clf-wrap` + `.clf-ops`；915×412 双栏；`clf-palette` / `.clf-mixer` 在右栏。源码守门 `shortLandscape.r11.test.ts`。
- **未做真机 CDP 七关矩阵**（本环境无稳定浏览器验收会话）；数字以 CSS 守门为准：dock 列 `minmax(220px,38%)`，画布 `max-height:min(260px,calc(100dvh - 88px))`。

### N-44 补：第 1 关数一数勿劣化

- **缺口**：先合版 `.mtf-illus { max-height:56px }` 与 `.mtf-illus-unit { 16px }` 会连数一数贴纸行一起收，915×412 第 1 关可能裁贴纸。
- **修**：钳位改 `.mtf-illus:not(.mtf-illus-count)`；quiz 紧凑档同样排除 count。竖式 `.mtf-vert` 仍钳 64px。木牌 `min-height:46px` ≥44。
- **第 1 关**：`kindPool(0)` 仍是 `count`，不走竖式字号。

### N-37 × pinyin 限时 135 复测

- `:has(.l99-jump)`、`.tm-bar` 矮屏、`pyt-scene` 72px、拼写/全选双栏均在。倒计时接线未改。
- 新增 `src/games/pinyin-train/timed135.r11.test.ts`。未做 915×412 真机点票坐标。

### N-45

- 未打开 `gold-hook/index.ts` / `style.ts`。

## 未做（r11 playbook 其余 A 项）

N-39 聚焦、N-16 走廊三态、L-3 贴纸、C-6 推理关：用户本轮优先 N-43/N-44，未开。S-4 `.qz-jump-input` 主干已是 44px。

## 红线

- 存档 key / `meta.id` / 题库 seed / 混色表 / gold-hook 商店逻辑未改。
- kit 只 import。
- 测试只增不减（+1 文件 timed135；既有 r11 守门用例补断言）。

## 完成定义对账

| 编号 | 状态 |
|------|------|
| N-43 | ✅ 先合版 + 本轮 scrolly overflow 补笔 |
| N-44 | ✅ 先合版 + 本轮排除第 1 关 count |
| N-37×135 | ✅ 源码复测，真机票坐标未量 |
| N-45 | ⬜ B 范围，未碰 |
| N-40 | ⬜ duo-rush，不是 color-fun |

水位：见交卷 `npm test` / `npm run build`。
