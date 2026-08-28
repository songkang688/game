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

---

# 追记 · 第 9 轮 A 的**真机复测**（分支 `cursor/trio-r9-tester-a-d909`）

上面那份是同一轮另一位 A（分支 `…-7779`）交的，方法写得很清楚：**源码对账 + Vitest 纯函数/CSS 守门**，
没有真机跑。它已经合进 `game-1.3`，后面 r10–r14 又在上面叠了很多。

我这一支进场时基线还停在 r8 合入点，等我把六条各自做完一遍、交卷前 `git fetch` 才发现
基线已经跑到 **r14（`5cbb6a80`）**，六条**全都有人修过了**。于是本支转成一件事：
**把这六条搬到真 Chrome 上、按派单的五档视口逐条复量**，看修法是不是真的成立。

结论：**四条真成立，两条没成立**（`N-36`、`N-37`）——都是「纯函数/CSS 守门测试是绿的，
但真机上量出来没生效」的那一类。两条已修，见下。

## 怎么测的

- `npm run build` 出 dist，`python3 -m http.server` 静态挂两份：`4183` 我的分支、`4193` 原样 `origin/game-1.3`，同机 A/B。
- puppeteer-core + `/usr/local/bin/google-chrome`（headless new），视口 360×640 / 390×844 / 412×915 / **915×412** / 1024×768，对照 1280×800，另加 844×390 加压。
- 深关走 `localStorage` 进度路（`yiduo-yixing.l99.<id>` 只读不改写语义），免 root 抬头干扰；root 路单独种 permanent 会话，专供 N-37。
- 量的是：`.game-stage` 裁切、控件是否落在舞台可视底之下 / 被切半、宿主与弹窗内滚、`.wgd-pad` 出屏。

## 复测结论逐条

| 编号 | 上游修法 | 真机复测 | 处置 |
|------|----------|----------|------|
| N-33 结算弹窗必点钮 | `.dialog-buttons` sticky bottom:0 + 白底罩 | ✅ 成立 | 只补守门测试 |
| N-38 永久态直达小字 | `rootJumpNote` 永久态走 `rootStatusLine` | ✅ 成立 | 只补守门测试 |
| 收藏册热区 40→44 / 36→44 | 已扩容 | ✅ 成立 | 只补守门测试 |
| S-4 扩容 `.qz-jump-input` 38→44 | 已扩容 | ✅ 成立 | 只补守门测试 |
| **N-36 描红米字格** | `padSidePx` 按可视余量算边长 | ❌ **反而把格子做小了，且矮横屏仍被切** | **已修** |
| **N-37 root 抬头挤压** | `:has(.l99-jump)` 收抬头 | ❌ **抬头反而 56→100px，math-farm 答案钮照旧线下** | **已修** |

### N-33 / N-38 / 两条热区：复测通过

把一份**真实结算弹窗 DOM** 原样重放到八档视口（配方 I）：

- 修前 915×412 弹窗 16–396、内滚 119px，两颗必点钮在 395–439 / 451–495，**整整两颗在弹窗可视底之外**；
- 上游修后同档 **够不着 2→0 / 切半 2→0**（钮回到 276–320、332–376，都在弹窗里）；844×390 同样 2→0；320×568 切半 1→0；
- 390×844 / 412×915 / 1024×768 / 1280×800 / 360×640 **逐像素一模一样**（本来就不溢出）。

N-38 用真实永久会话跑：`rootRemainMs` 确实是 400 万分钟量级，而小字稳定输出「管理员权限已永久开启」，
与地图侧 `rootStatusLine` 同一句，不再各说各话。

### N-36 描红米字格：修法方向对，尺子量错了 —— 已修

上游 `padSidePx` 的思路对（按可视余量算边长），但调用点传的 `chrome` 是
**「宿主里除格子以外的全部内容」**——把**格子下面**的花园与提示行也算成了竞争者。
那两块往下滚一屏就是，替它们让位等于把描红本身做小。真机第 102 关量到两笔账：

- **360×640 竖屏：米字格 191×191** —— 低于 `MIN_PAD_PX` 这条「手机 360px 规格底线」；
  而这一档余量本来就够，修前修后都是整格可见，收它纯亏。
- **844×390 矮横屏：240×240 但底沿切掉 12px** —— 可视段自己都装不下 240 还留着 240。
  格子写着 `touch-action:none`，手指落上去只描红、不带着壳滚，**切掉就等于描不了**。

改法三条（`tracing.ts`）：

1. `chrome` 只算「必须与格子同框」的：格子上方那几行 + 木桌 `.wgd-desk` 箍在四周的内边距；
2. 余量不够 240、但**可视段自己装得下 240** → 守住底线，其余交给宿主滚（提示行有 `.wgd-scroll` 的 sticky 兜底）；
3. 可视段自己都不到 240 → 才往下收，并且只跟**滚不掉的**木桌边分余量，收到 `SHORT_PAD_MIN_PX`(120) 打住。

修后（修前 → 修后，七档**全部出屏 = 0**）：

| 视口 | 修前 | 修后 |
|------|------|------|
| 360×640 | 191×191（破底线） | **259×259** |
| 844×390 | 240×240，切 12px | **214×214，切 0** |
| 915×412 | 240×240 | 240×240（原样） |
| 390×844 / 412×915 / 1024×768 / 1280×800 | 280 / 296 / 300 / 300 | 逐像素不动 |

判定另测：同一条归一化笔画在 259 / 240 / 300 三种边长上都判「第 1 笔『竖』写好啦」、0/3→1/3。
`padPoint` 按 box 取比例，收边长不动判分；`strokes.ts` 零触碰。

### N-37 root 抬头挤压：`width:100%` 把那一行顶成了独占一行 —— 已修

上游给工具排写了 `.l99-stagebar:has(.l99-jump) .l99-tools{width:100%}`，
`width:100%` 在 `flex-wrap:wrap` 的抬头里等于**强制换行**，于是：

- 915×412 开 root：`.l99-stagebar` **56 → 100px**（不是收了，是更高了），舞台 134–400 缩到 178–400，
  **math-farm 三颗答案钮整排落到舞台底下 33px**，而且宿主自滚 0 —— 够不着，也滚不出来。

改法（`level99.ts` 同一段 `:has(.l99-jump)`）：这一行别再独占。抬头整条 `flex-wrap:nowrap`，
工具排改**按内容宽**、与题名分这一行；题名留 `min-width:120px` 打省略号
（全挤没了家长就不知道孩子卡在哪一关），管理件自己 `overflow-x:auto` 横向滚。
四选一试过：题名不设下限会被挤成 **0 宽**（信息全丢），隐藏星级并不额外让出空间，都没采。

修后（四款 quiz 皮肤 × root 开/关 × 五档视口，共 40 组）：

- 915×412 开 root：抬头 **100→52px**，舞台回到 130–400，四款 **线下 0 / 切半 0**；
- 915×412 关 root：**逐像素与修前一致**（56 / 134–400）——这是本修法的红线，测试里有取反断言；
- 390×844 / 412×915 / 1024×768 / 1280×800 不进这档媒体查询，开关两态全部原样。

## 测试水位

| | 文件 | 用例 |
|------|------|------|
| 进场（`origin/game-1.3` = `5cbb6a80`） | 1151 | 19423 |
| 交卷（本分支） | **1156** | **19469** |

净增 5 个测试文件 / 46 个用例，`npm test` 与 `npm run build` **全绿、0 失败**。

新增：`word-garden/tracePadFit.test.ts`、`rootLevelHeader.test.ts`、`level99.rootNote.test.ts`、
`ui/dialogStickyButtons.test.ts`、`ui/hotzone44.test.ts`。

**改了别人 3 条断言**（场景一条没删，`padSide.r9.test.ts` 用例数 5→8）：
那 3 条把「上游那版量错的行为」钉成了期望值（`132px`、可视段 200 时仍留 240 挨切、
调用签名少一个入参），复测证明是错的，按新口径改写并补了真机数字做注脚。

## 还剩什么

- **844×390 之外没再加压**：派单五档 + 1280×800 对照都干净；844×390 是我自己加的一档，也已收干净。
- **N-30 / L-2 / L-3 未动**：本轮预算全花在「六条复测 + 两条重修」上。
  N-30 adventure-king 无尽古堡上游标 ✅，**但按本轮经验，它同样是「只做了源码守门、没上真机」的那批，建议下一轮先复测再说**。
  L-2 clock-house 钟面、L-3 find-diff 贴纸第 4–10 章同样未动，`kit/stickers.ts` 未扩容。
- **N-16 走廊引擎三态**仍未关（沿用上面那份的书面留下）。

## 红线自查

- 存档 key `yiduo-yixing.l99.<id>` / `l99skip` / 钱包 / `meta.id`：只读不写，一字未改。
- 题库、seed、win/lose 判定：零触碰（`strokes.ts` 笔顺判定、`quiz99` 判分入口都有取反断言守着）。
- `src/art/kit/`：只 import 不改，`stickers.ts` 也没扩容。
- 宽屏 1280×800：N-36 / N-37 / N-33 三条都逐像素复量过，零回归。
- 未改 `main`，未 force push；因为分支已推过，收尾用 **merge** 同步 `origin/game-1.3`（rebase 会要求 force）。
