# 三人组第 9 轮 · 测试修复员 A 记录

基线:进场 `game-1.3 = a74e4868`（r8 学习笔记 + 父监督 10 轮计划已合入，`src/**` 相对 r8 仍为零代码改动）。
分支:`cursor/trio-r9-tester-a-7779`，目标合入 `game-1.3`。
执行依据:`docs/qa/trio-r8-playbook.md` + `docs/qa/trio-r6-tester-A.md` 对账；r7 playbook 的 N-30 原文。
方法:源码对账 + Vitest 纯函数/CSS 守门；视口口径仍以 915×412 为主档。本环境与并行 B 共享工作区，曾发生分支被切走、未提交改动被冲掉，故中途先提交再测。
水位:交卷前 `npm test` / `npm run build` 见文末。进场目标水位约 **1095 文件 / 19288+ 用例**（r6-A 交卷）；本轮只增 6 个测试文件。

## 已合入、禁止重做（对账）

`git log origin/game-1.3` 与 r6-A 记录一致，下列已在 `game-1.3` 上，本轮零重做：

- S-1 首页首屏、S-2 星级 SVG、S-3 parentAuth hashchange、S-4 `.l99-jump-input` 44px
- L-1 quiz99 矮屏 + find-diff 横屏并排
- C-1 modebar `[hidden]`（含 `.ak-bar`）
- orb-arena / snake-royale `fitPane`
- garden-guard 小章节点图

进场 `git diff origin/game-1.3 -- src/` 为空。S-4 扩容（`quiz99.ts` `.qz-jump-input` 38px）r8 仍列 🔧，本轮未动（用户点名已合的是 l99 那条）。

## 修了什么（按 playbook 编号）

### N-38 关内直达小字永久态 ✅

- **坏在哪**:`rootJumpNote(remainMs)` 无永久分支，远未来时间戳被 `rootRemainMinutes` 换成「4193047370 分钟」。地图侧已有 `rootStatusLine` / `ROOT_PERMANENT_NOTE`。
- **怎么修**:`rootJumpNote` 在 `isRootPermanent(nowMs)` 时走 `rootStatusLine`；限时态文案「管理员权限还剩 N 分钟」不动。调用点仍只 `attachRootJump` 一处。
- **测试**:`src/games/level99.r9.test.ts`（永久取反 + 不含超长数字；限时回归）。

### N-33 壳层结算弹窗 915×412 两钮折线下 ✅（配方 I）

- **坏在哪**:`.dialog{max-height:86dvh;overflow-y:auto}`，结算竖排约 511px，按钮列在滚线下。
- **怎么修**:`src/styles.css` `.dialog-buttons{position:sticky;bottom:0}` + `#ffffff` 不透明底 + 上缘白阴影。`dialogs.ts` 按钮语义、`isGuardedClick`、焦点陷阱零触碰。
- **验收口径**:915×412 不滚可点「再玩一次/回首页」；暂停/家长门同受益不劣化；390×844 / 1280×800 规则仍是同一公共类。
- **测试**:`src/ui/dialogSticky.r9.test.ts`。

### 收藏册热区两条 ✅

- `.collection-close` 40→44；`.card-btn` `min-height` 36→44。面板布局其余未动。
- **测试**:`src/ui/collectionHit.r9.test.ts`。

### N-37 管理员开启态挤压 quiz 族关内 ✅

- **坏在哪**:root 开着多「跳过（管理员）」+「直达」约 100px，math-farm 三钮在 915×412 整排线下。
- **怎么修**:`level99.ts` `@media (max-height:500px)` 且 **仅** `.l99-stagebar:has(.l99-jump)`：工具行 nowrap、小字隐藏、跳过钮略收。root 关没有 `.l99-jump`，`:has` 整段不生效。
- **矩阵**:math-farm / word-garden / pinyin-train / clock-house 共用 l99 抬头，root 开走同一规则、root 关布局与修前一致。答题判定零触碰。
- **测试**:同 `level99.r9.test.ts` CSS 守门。

### N-36 word-garden 描红关 915×412 米字格出屏 ✅

- **坏在哪**:`.wgd-pad{width:min(72vw,300px)}` 只按宽；412 高档 300px 格底出屏 38px，且 `touch-action:none` 无法「滚一下再描」。
- **怎么修**:导出 `padSidePx(vw, visibleRoomPx, chromePx)`：`min(72vw, 300, 余量−头提示花园)`；低于 240 可收到 120；再矮才 `MIN_PAD_PX` + 允许滚动。`runTracing` 量祖先裁切线后写 pad 宽高。矮屏 `.wgd-trace{min-height:0}`。`strokes.ts` 笔顺判定零触碰。
- **测试**:`src/games/word-garden/padSide.r9.test.ts`。

### N-34 + N-35 pinyin-train 拼写/全选 915×412 ✅（配方 G/J；playbook 写在 B 节，用户本轮明确派 A）

- **坏在哪**:拼写关裁 ~450、11 票全线下；全选关裁 ~179、票全线下。火车舞台 132px + `min-height:380`。
- **怎么修**:
  - `scene.ts` 矮屏舞台 72px（限时关 135+ 同缩高，倒计时接线未动）。
  - `spell.ts` / `pickAll.ts`：矮屏 `min-height:0`；`max-height:500px and min-width:640px` 双栏（舞台左、车厢/票右）；发车/提交钮 sticky 底。
- **深关直达**:验收应用 `localStorage.setItem("yiduo-yixing.l99.pinyin-train", JSON.stringify(Array(N-1).fill(1)))` 走进度路（拼写 101、全选 103），免 root 抬头干扰。存档 key 一字未改。
- **测试**:`src/games/pinyin-train/shortLandscape.r9.test.ts`。

### N-30 adventure-king 无尽古堡 13 控件线下 ✅（配方 G）

- **坏在哪**:915×412 裁 394，D-pad + 复位/小地图/结束/陈列共 13 控件全线下。N-28 `.ak-bar[hidden]` 已在 r6-A 合入。
- **怎么修**:`mountCastle` 根节点加 `advk-shell`；矮屏 CSS grid：工具行置顶、房间左、D-pad 右、图鉴底。走廊引擎另外两个 `ak-mode` **不**挂 `advk-shell`。`explore.ts` 房间生成 / `stepMove` 钥匙判定零触碰。
- **测试**:`src/games/adventure-king/castleShell.r9.test.ts`。

## 还剩什么

- **N-16 走廊引擎三态**（无尽遗迹 / 计时速通 / 闯关同伤）:本轮时间给古堡壳，走廊 `ak-pad` 未改。书面留下，下一轮按 r5/r7 原文一次修三态，勿与 N-30 古堡混改。
- **L-2 clock-house 钟面美术、L-3 find-diff 贴纸补章**:非「不好用立刻修」优先级，未动。kit `stickers.ts` 未扩容。
- **quiz99 `.qz-jump-input` 38px**（r8 S-4 扩容）:未动。
- 休闲/对战/动手（fight-king、fruit-catch、duo-vs-star、dot-maze、bubble-aim 等）:B 范围，本分支未提交那些文件。并行 B 曾在同一工作区改过它们，A 提交前已避开。

## 红线

- 存档 key `yiduo-yixing.l99.<id>` / skip key、`meta.id`、题库/seed/胜负判定未改。
- `src/art/kit/` 只 import 不改。
- 测试只增不减（+6 文件）。

## 完成定义对账

| 编号 | 状态 |
|------|------|
| N-38 | ✅ 关 |
| N-33 | ✅ 关 |
| 收藏册热区 | ✅ 关 |
| N-37 | ✅ 关 |
| N-36 | ✅ 关 |
| N-34 | ✅ 关 |
| N-35 | ✅ 关 |
| N-30 | ✅ 关 |
| N-16 | ⬜ 未关（书面留下） |
| L-2 / L-3 | ⬜ 未关 |
| S-1…S-4 / L-1 / C-1 | 已在基线，跳过 |
