# 三人组第 11 轮 · 测试修复员 A 记录

基线:进场 `origin/game-1.3 = 463a3ed4`（r10 A/B 已合入，含 N-39/L-2/L-3/S-4/N-16）。
分支:`cursor/trio-r11-tester-a-c14c`，目标合入 `game-1.3`。
执行依据:`docs/qa/trio-r10-playbook.md` 剩余壳层+闯关学习项。
方法:源码对账 + Vitest 守门 + preview **4179** + `/usr/local/bin/google-chrome` + puppeteer-core。主档 **915×412**；进度路 `yiduo-yixing.l99.<id> = Array(N).fill(1)` 后点 `.l99-continue`（N-44 / N-43 深关不开 root）。
水位:交卷 `npm test` = **1124 文件 / 19360 用例全绿**（相对本轮进场主干只增 2 个测试文件 +6 条；`quiz99.test.ts` 只加断言不减用例）。偶发红（五子棋随机 / bomb 超时）未为变绿改那些用例。`npm run build` 全绿。

## 已合入、禁止重做（对账）

未重做 N-39、L-2、L-3、S-4、N-33/36/37/38。S-4 `.qz-jump-input` 仍是主干的 **44px**。未碰 B 范围 fight-king / duo-rush / gold-hook。kit 零改动。

## 修了什么

### N-43 color-fun 七关型 915×412 色盘/调色锅线下 ✅（配方 G/J）

- **坏在哪**:画布 `min-height:55vh` + 操作排竖叠，`.clf-wrap.clf-scrolly` 自滚；limited 最重（撤销/重做/五原色/三色票整排线下）。
- **怎么修**:
  - `index.ts` 把 chips/tools/mixer/palette/msg 收进 `.clf-ops`（画布仍是 wrap 直接子节点，`fitColoringStage` / `tallestTailPx` 不断）。
  - `ui.ts` `@media (max-height:500px) and (min-width:640px)` 双栏：画布左、操作排右 sticky；右栏 ≥280px 让五颗原色 nowrap。矮横屏装不下时 `overflow:hidden`，**不再挂 `.clf-scrolly`**。
- 判定 / `mix.ts` / `linework.ts` / `levels.ts` 零触碰。
- **验收（915×412，进度路）**:七关型 + 第 1 关折叠线下 **0**、limited **display:grid 且无 clf-scrolly**；色票 top=304 / 锅 216 / 撤销 123，中心 `elementFromPoint` 命中自身（dot/pot/undo）。390×844 / 412×915 / 1024×768 的 memory/limited 线下 0。

### N-44 math-farm 第 100 关族竖式答案钮线下 ✅

- **坏在哪**:quiz99 紧凑档只钳 `.qz-prompt svg`；竖式是 `.mtf-vert` DOM + 题下 `.mtf-illus` 作物卡。
- **怎么修**:紧凑档增 `.qz-prompt .mtf-vert, .qz-wrap > .mtf-illus { max-height:64px }`；`farmScene` 矮屏作物卡 **40px**、木牌 `min-height:46px`（≥44）；`runner` `.mtf-vert-row` 走 `MIN_VERT_PX`。`gen.ts` / 判定零触碰。
- **验收**:进度路第 100 关 915×412 三枚 `.qz-choice` top=366 / mid=389 < 舞台裁切 404，可点；第 1 关 top=293 不劣化。

### N-37 加重档复测 ✅（未新开号）

- root 限时 × `pinyin-train` 第 135 关 915×412：`.l99-jump` 在场；三票 top=352 / bottom=400 / mid=376，线下 0。N-37 `:has(.l99-jump)` 规则仍有效，本轮零改 `level99.ts`。

## 红线

- 存档 key、题库/seed/胜负、`src/art/kit/` 未改。
- 测试只增不减。禁 force。工作区曾被并行 B 切走，本轮在独立 worktree 提交，未带走 gold-hook 等 B 文件。

## 完成定义对账

| 编号 | 状态 |
| --- | --- |
| N-43 | ✅ 关（limited 最严档 915×412 干净） |
| N-44 | ✅ 关（进度路第 100 关） |
| N-37 加重 | ✅ 复测过，未改代码 |
| N-45 / fight-king / duo-rush | B 范围，未动 |
| N-39 / L-2 / L-3 / S-4 / N-33…38 | 基线已有，跳过 |
