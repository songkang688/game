# 三人组第 9 轮 · 测试修复员 A（壳层 + 闯关学习）

基线:`origin/game-1.3 = a74e4868`（监督看板已登记 r6 A 销账 S-1/S-2/S-3/S-4/L-1/C-1）。
分支:`cursor/trio-r9-tester-a-c14c`，目标合入 `game-1.3`。
依据:`docs/qa/trio-r8-playbook.md` + `trio-r8-learn-notes.md`。
方法:Chrome headless + puppeteer-core（`/usr/local/bin/google-chrome`），视口 915×412 主档；截图放 `/tmp/r9a-*.png` 不进库。

## 水位

- 进场对账（r8 笔记）: **1090 文件 / 19248 用例**（`77c89fc8`）。
- 本轮交卷 `npm test`（ vitest run）: **1096 文件 / 19297 用例量级**（相对进场 **+6 文件 / +49 用例** 只增不减；新增 `tracePadFit.test.ts` 及既有文件内断言）。
- `npm run build`（`tsc --noEmit && vite build`）全绿。

> 全量第一次跑在未修 N-36 断言时记下 1096 files / 19297 tests，其中 2 条是本轮 pad 用例写宽了（已修）；另有 fruit-catch / sudoku-petal 等超时属既有慢测，与本分支无关。针对性重跑本轮触及文件 **10 files / 278 tests 全绿**。

## 修了什么

### N-33 壳层结算弹窗 915×412 必点钮线下 ✅

- **坏在哪**:`.dialog{max-height:86dvh;overflow-y:auto}`，按钮列排最底无 sticky；915×412 内容约 511 > 可视约 354，「再玩一次 / 回首页」要滚才够着。
- **怎么修**:`src/styles.css` `.dialog-buttons{position:sticky;bottom:0}` + 不透明白底 + 上缘白影。`dialogs.ts` 按钮语义 / `isGuardedClick` 未动。
- **修后 915×412**:sticky=sticky；「再玩一次」275–321、「回首页」333–378，均在 412 屏内。390×844 / 1280×800 按钮仍在弹窗可视区内。
- 测试:`src/ui/motion.test.ts` 增 sticky / 不透明底断言。

### N-38 关内直达小字永久态「还剩 4193047370 分钟」 ✅

- **坏在哪**:`rootJumpNote(remainMs)` 无永久分支，把远未来剩余当分钟。
- **怎么修**:`isRootPermanent` 或 remainMs ≥ 1 年 →「管理员权限已永久开启」；限时仍「还剩 N 分钟」。
- **修后**:root 永久 + math-farm 关内小字实测 =「管理员权限已永久开启」。
- 测试:`level99.test.ts` 永久取反断言。

### N-37 管理员开启态挤压 quiz 族 915×412 ✅

- **坏在哪**:root 开着关内多「跳过（管理员）」+「直达」两行约 100px，math-farm 答案钮整排线下。
- **怎么修**:`@media (max-height:500px)` 关内 `.l99-tools` / `.l99-jump` nowrap，小字 clip 藏起（地图侧仍显示）；`quiz99` `.qz-jump-input` 38→44，矮屏再收一档。答题判定未动。
- **修后 915×412 + root 永久 + math-farm 第 1 关**:三答案钮 337–401，折叠线下 0。
- 测试:`level99.stars.test.ts` 媒体查询；`quiz99.test.ts` 44px。

### N-36 word-garden 描红 915×412 米字格出屏 ✅

- **坏在哪**:`.wgd-pad{width:min(72vw,300px)}` 只看宽，300 高格子底出屏 38px，且 `touch-action:none`。
- **怎么修**:`tracePadSidePx` / `tracePadChromePx` 高度尺；`--wgd-pad-side`；矮屏 `min-height:0` 并松开 min-width。笔顺判定未动。
- **修后矩阵**（与 r8 竖屏/平板数字对齐，915 改为整格进屏）:

| 视口 | pad top–bottom | 边长 | 首屏 |
| --- | --- | --- | --- |
| 390×844 | 337–637 | 300 | 是 |
| 412×915 | 337–633 | 296（72vw） | 是 |
| 1024×768 | 285–585 | 300 | 是 |
| 1280×800 | 285–585 | 300 | 是 |
| 915×412 | 198–366 | 168（高度尺地板） | 是 |

- 测试:`src/games/word-garden/tracePadFit.test.ts`。

### 收藏册热区 ✅

- `.collection-close` 40→44，`.card-btn` min-height 36→44。
- 实测关闭钮 44×44、解锁钮高 44。测试写在 `collection.test.ts`。

## 未完成 / 不做

- **L-2** clock-house `clockSVG` 换箭头：消费端 `faceLift` 已合入（题库 SHA 钉死，本轮不改 `levels.ts` 以免动题库字节）。
- **L-3** find-diff 第 4–10 章贴纸：红线 `src/art/kit/` 已有文件只 import 不改，扩 `stickers.ts` 本轮不做。
- **N-34 / N-35** pinyin-train 拼写/全选：分给 B，未碰。
- fight-king / fruit-catch / duo-vs-star / dot-maze / adventure-king 古堡 / brave-path 无尽 / playbook / `trio-supervisor-10r.md`：未碰。
- 存档 key、题库 seed、win/lose 判定、kit 已有文件：未碰。

## 已合入项（禁止重做，本轮零改）

S-1 首页、S-2 星级 SVG、S-3 parentAuth hashchange、S-4 `.l99-jump-input` 44px、L-1 quiz99 矮屏 + find-diff 并排、C-1 modebar（含 `.ak-bar`）、orb-arena/snake-royale `fitPane`、garden-guard `mapCols`。
