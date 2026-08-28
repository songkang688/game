# 三人组第 6 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`game-1.3 = 3c7fb691`（已含 trio-r5 笔记 + 测试修复员 B 的 r4 走查 4 修复：`fa2c4b47` l99 说明字号回 16px 红线 / `0ebafb31` bubble-aim 管理员门+地图高 clamp / `787abdad` tap-tiles 宿主实宽 / `23afd009` red-blue-tug 拉绳实宽）。
> 衔接：r5 抽验（N-1…N-24 + 配方 D/E/F）→ 本轮先对账 r5 playbook 哪些已落地，再抽 r4/r5 都没碰过的款与视口组合找新伤。**测试修复员 B 正在并行执行 r4/r5 休闲项**，本对账以 `3c7fb691` 时点为准，B 后续合入的修复以他的报告为准、别按本表重复立项。
> 本轮交付两份文档 + r5 playbook 对账标注。`src/**` 一行未动。

## 一、抽验方式（可复现）

- `npm ci && npm run build && npx vite preview --port 4173`，headless Chrome（`/usr/local/bin/google-chrome` + puppeteer-core，脚本放 /tmp 不进库）。
- 视口：**915×412**（矮横屏主档，本轮任务点名）为主，390×844 / 1024×768 / 412×915 做对照与复核。
- 量四个数（口径同 r4/r5）：`.game-stage` `scrollHeight − clientHeight`（裁切）；折叠线下可点控件数（`rect.top ≥ 视口高`）；canvas 出屏量；自滚容器逐元素扫（r5 新口径，`scrollHeight − clientHeight > 20`）。
- **本轮新增两件源码面工装（都只在 /tmp 跑，不进库）**：
  1. **modebar 全库扫描**：遍历 `src/games/*/index.ts|view.ts` 的 CSS 串，凡 `display:flex` 的 `modebar|modes|bar` 族类名查同文件有无 `[hidden]{display:none}`——r5 第四节守门建议的原型，真跑了一遍（结果见第三节 N-28：抓到 adventure-king 漏网；bba-modes/cds-modes/bvp-bar/dvs-bar 四条命中经人工核实为误报——各自有视图级显隐或本就是常驻 HUD，守门测试落地时要按「元素被设过 `.hidden=true`」收窄口径）。
  2. **管理员门接入审计**：全库扫 `isRootOpen` 引用 —— 8 款自建选关（bubble-aim/candy-swing/fruit-slice/garden-guard/ocean-munch/rainbow-run/sling-birds/sprout-defense）已全部接入，l99 框架款由框架托管。**该账随 `0ebafb31`（最后一块 bubble-aim）收口，下轮不用再查**。
- 带模式菜单的款（fight-king/dot-maze/duo-vs-star）逐模式点进玩法态再量——r4/r5 的通用脚本只走 `.l99-continue`，这类款的玩法态一直漏测（本轮 3 款全部量出新伤，见第三节）。
- 进场水位：`npm test` 于 `3c7fb691` 全绿（1090 文件 / 19242 用例，与 B 的 r4 报告交卷水位一致）；`npm run build` 通过。

## 二、r5 playbook 对账（对照 `3c7fb691` 源码 + 实测）

r5 基线 `22a5be93` 之后 `src/**` 只动了 6 个文件（bubble-aim×3 / level99 / red-blue-tug / tap-tiles），对账很干净：

| r5 编号 | r6 核实 | 判定 |
| --- | --- | --- |
| N-23 之 bubble-aim 地图 | `.ba-map` 定死 520px 已改 `clamp(420px, calc(100dvh − 150px), 960px)`（`0ebafb31`），390×844 高竖屏白板消失（B 复验 520→694px）✅；**但矮横屏是死角**：915×412 下 `calc(100dvh−150px)=262px` 被 clamp 下限 420px 顶回，实测 `.ba-map` max-height=420 > 视口 412，stage 仍裁 150、地图内滚 3178px；`showMap` 仍无 `scrollIntoView`，**focusCurrent 三款（bubble-aim/candy-swing/sling-birds）源码零改动** | 🔶 部分（矮横屏+定位账仍开，见 N-23 补充） |
| C-1 残余 3 款 | box-hamster `.bh-modebar` / prince-princess `.pcp-modebar` / sudoku-petal `.sp-modebar` 源码仍无 `[hidden]` 兜底，13 款测试欠账原样 | ❌ 未动（且新增漏网 1 款，见 N-28） |
| S-1 / S-2 / S-3 / S-4 | styles.css 无矮屏/横屏 hero 压缩；`level99.ts:469` `starRowHTML` 仍 ★ 字符、`:529` 仍 `min-height:38px`；parentAuth 仍无 hashchange | ❌ 未动 |
| L-1 / L-2 / L-3 / L-4 | 四款学习横屏 0 diff；`clock-house/levels.ts` `clockSVG` 原样；`find-diff/boardArt.ts` 头注原样；无新裁决文档 | ❌ 未动 |
| N-1 fruit-catch … N-22 | 各款目录零提交（`git diff 22a5be93..3c7fb691 -- src/` 可证），实测数字继续有效 | ❌ 未动 |
| r4 重申项 C-2…C-9 | 同上，零提交 | ❌ 未动 |

**r5 清单之外顺手收掉的（B 的 r4 走查自查项，下轮不要重复做）**：

1. bubble-aim 选关接入管理员门（root 开则 188 关全开）——顺带把「8 款自建选关全部接 root」的一致性账收口。
2. tap-tiles 画布按宿主实宽收窄（390×844 最左轨不再被裁 17px）；本轮 915×412 复测关内裁 66、无控件折叠线下、canvas 出屏 0，未回归。
3. red-blue-tug 拉绳按 `.rbg-ctrl` 实宽排布（1024×768 两钮 38→168px）；本轮 915×412 复测关内裁 6，干净。
4. l99 `.l99-jump-note` 矮屏 14px 回修 16px（基线测试红线，非 r5 立项）。

## 三、新抽验结论（模式菜单款玩法态 + 915×412 空白补测）

**三档全绿、可以放心的**：fruit-slice / garden-guard / ocean-munch / rainbow-run / sprout-defense（单画布款，915×412 画布 0 出屏——地图/关内/HUD 同一张 canvas，r5 的选关页 ✅ 可外推到玩法态）；clock-house 关内 915×412 干净（题面钟 + 三个答案钮全部首屏内）；fight-king 人机/双人对战态 915×412 裁 21 干净；dot-maze / duo-vs-star 的 390×844 与 1024×768 两档干净；kitty-care / red-blue-tug 915×412 关内裁 ≤6。

**新发现（编号续 r5，N-25 起，全部带截图证据）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-25 | fight-king **格斗塔**关内 | 915×412 裁 498 / canvas 出屏 335 / **轻击·重击·必杀·防御·⏸ 全部折叠线下**；**390×844 主流竖屏也裁 123（必杀/防御折叠线下）**；1024×768 干净。人机/双人对战态干净（裁 21）——病灶在塔模式独有的「出战角色」八宫格（约 230px）常驻在 l99 抬头与战场之间，`fitStage` 的 `FIGHT_MIN_H=150` 下限保画布后把超出量交给舞台滚动，实时格斗不能滚 | 🔧 本轮最重 |
| N-26 | duo-vs-star **闯关**关内 | 915×412 裁 310 / canvas 出屏 111 / **七个触控键（◀▲▼▶✋💥🤝）整排折叠线下**（截图实锤：擂台只露天空，两个小人都看不见）；390×844 与 1024×768 干净。r4 C-9 只记了 `.dvs-back` 32px，玩法态横屏从没量过 | 🔧 |
| N-27 | dot-maze 闯关 + 双人追逃 | 915×412：单人裁 167（⏸▲◀▼▶ 五键折叠线下）、双人裁 143（**两套方向键 9 控件全线下**，PR50 新加的双人触控键盘恰好是受害者）；其余两档干净。`layout.canvasDisplayCapPx` 的 `MIN_CANVAS_DISPLAY_PX` 下限保住迷宫却把键盘挤下线——追逃玩法不能滚 | 🔧 |
| N-28 | adventure-king `.ak-bar` 模式条 | 进无尽遗迹/无尽古堡/计时速通后 `bar.hidden=true` 但 `.ak-bar{display:flex}` 顶掉 UA 规则：实测 412×915 残留 88px、1024×768 残留 40px（截图：无尽玩法上方还挂着三颗模式大按钮）。**C-1 族第 19 款**，r4 的 18 款名单漏网（当年只扫了 `-modebar` 后缀，这款类名叫 `.ak-bar`）；本轮全库扫描抓出，其余命中均为误报 | 🔧 并入 C-1 收尾 |
| N-29 | bubble-aim **关内**横屏 | 915×412 进第 1 关：canvas 显示高 480 > 视口 412，出屏 206，**发射台（拖拽瞄准的起点）整个在折叠线下**——泡泡墙看得见、炮打不着（截图实锤）。r4/r5 都只量过它的地图页 | 🔧 |

**观察项（不立项，留档防重查）**：merge-2048 关内 915×412 裁 84、tap-tiles 关内裁 66——都无控件折叠线下、canvas 0 出屏，属「盘面下沿贴线」级轻伤，若 B 顺路可一并收；kitty-care 915×412 食物拖拽排半截进 `ktc-wrap` 自滚区（105px，可滚可玩，拖拽目标碗在首屏内）；clock-house 关内 `clk-quizhost` 自滚 130px 但答案钮全部首屏可点。

## 四、系统性模式提炼（r4 配方 A/B/C、r5 配方 D/E/F 仍有效，本轮补两条）

### 模式 G · 「有 fit、有下限、剩下交给滚动」≠ 实时玩法可玩（N-25/N-27 共因，兼补 N-21/N-22 机理）

- **机理**：8/28 矮屏审计给 fight-king/dot-maze/block-drop/combo-clash 都配了钳高纯函数，但都留了保底下限（`FIGHT_MIN_H=150`、`MIN_CANVAS_DISPLAY_PX` 等），余量不足时超出部分「交给舞台滚动」。竖屏下限很少触发，**915×412 矮横屏几乎必触发**——而这些全是实时款，滚动兜底等于没兜。r5 模式 E 讲的是回合制，这条是它的实时版。
- **配方（按款二选一）**：① 横屏矮屏改**双栏布局**——画布居中，触控键/D-pad 挪到画布左右两侧空白带（915 宽有的是横向余量，dot-maze 双人局天然一人一侧）；② 控件排 `position:sticky; bottom:0` 常驻（fight-king 触屏按键排、bubble-aim 发射台在画布内做不了 sticky，只能钳画布高优先保底部发射区可见）。判定坐标、下限常量本体别动，动的是「下限触发时控件排的去处」。
- **修好判据**：915×412 进玩法态，不滚动就能看见并按到全部触控键；画布主体 ≥60% 可见；竖屏两档与 1280×800 零回归。

### 模式 H · 模式菜单款的玩法态是测试盲区（N-25/N-26/N-27 为什么活到第 6 轮）

- **机理**：r4/r5 的批量脚本只会点 `.l99-continue`，fight-king（先选模式再选人）、duo-vs-star / dot-maze(先选模式)这类「菜单 → 玩法」两跳款，脚本停在菜单层就交卷了；B 的 48 款走查同样只进「选关地图 → 第 1 关」。**凡带自建模式菜单的款，每个模式都是一个独立布局，要逐模式量**。
- **给 A/B 的清单**：本库还有同构菜单的款 = fight-king（5 模式，本轮量了塔/人机）、dot-maze（4 模式，量了闯关/双人追逃，无尽/抢豆对战布局同闯关）、duo-vs-star（3 模式，量了闯关）、adventure-king（3 模式入口）、box-hamster/prince-princess 等 modebar 款（r4 已按模式量过）。复测时照第一节工装的「逐模式点进去再量」执行。

### C-1 守门测试落地口径修正（给 B，替代 r5 第四节的初版建议）

r5 建议的正则口径（`modebar|bar-modes|-bar` 匹配 `display:flex` 必须有 `[hidden]` 兜底）本轮真跑了一遍：8 条命中里 4 条误报（bubble-aim `.bba-modes`/candy-swing `.cds-modes` 藏在整块地图容器里跟着显隐、brave-path `.bvp-bar` 是逐屏重建的 HUD、duo-vs-star `.dvs-bar` 是常驻标题栏）。**守门测试要加第二个条件**：类名对应的元素在同文件里被设过 `.hidden = true`（或 `hidden` 属性）才纳管。按此口径全库真阳性恰好 4 款 = box-hamster / prince-princess / sudoku-petal / **adventure-king**，一次收净。

## 五、skills 增量提炼（r4/r5 已写的不重复）

| skill | 本轮新提炼 | 落点 |
| --- | --- | --- |
| `frontend-design` | 「状态即布局」：同一款游戏的每个模式/阶段都是独立的一屏，验收要按状态矩阵而不是按路由——正是模式 H 的理论依据 | 模式 H |
| `canvas-design` | 「negative space is a tool」：横屏矮屏的病根是把竖屏的纵向堆叠原样搬进 412px 高，915px 的横向余量全浪费——模式 G 的双栏配方就是把留白用起来 | 模式 G |
| `algorithmic-art` | 参数化探索思路继续用于工装：本轮把「游戏 × 模式 × 视口」三维矩阵脚本化（/tmp 不进库），比 r5 的二维矩阵多抓 3 款玩法态新伤 | 第一节工装 |

## 六、已收口账目汇总（下一轮不要重复做）

1. 8 款自建选关的管理员门接入（`kangkang` root 开则全解锁）随 `0ebafb31` 全库收口。
2. bubble-aim 地图 520px 定死 → clamp（高竖屏白板消失；矮横屏死角转 N-23 补充）。
3. tap-tiles 宿主实宽 / red-blue-tug 拉绳实宽 / l99 说明字号 16px（B 的 r4 自查修复，本轮 915×412 复测无回归）。
4. fruit-slice / garden-guard / ocean-munch / rainbow-run / sprout-defense 五款单画布 915×412 玩法态全绿（本轮补测，连同 r5 的选关页 ✅ 一起结案）。
5. clock-house 关内 915×412 干净；fight-king 人机/双人对战态干净——别把 N-25 扩大化去动对战态。

## 七、下一轮 A/B 最该先做的 10 条（与 r6 playbook 排序一致）

1. N-25 fight-king 格斗塔关内两档折叠线下（915×412 裁 498/出屏 335，390×844 也中，本轮最重）
2. N-1 fruit-catch 横屏+平板画布出屏（r5 全场最重，源码零改动，数字继续有效）
3. N-26 duo-vs-star 闯关关内 915×412 七键折叠线下（连同 r4 C-9 `.dvs-back` 32px 一次清账）
4. N-27 dot-maze 闯关/双人追逃 915×412 方向键折叠线下（双人键盘是 PR50 新家当，走模式 G 双栏）
5. C-1 收尾扩容：残余 4 款（box-hamster / prince-princess / sudoku-petal / **adventure-king N-28**）+ 修正口径的全库守门测试 + 13 款测试欠账
6. N-29 bubble-aim 关内横屏发射台出屏 206（钳画布高优先保发射区）
7. N-2/N-3/N-4 回合必点钮组 flight-chess / star-estate / hero-cards（r5 原文有效，走配方 E）
8. N-23（补充版）自绘地图三款 focusCurrent + bubble-aim clamp 下限在 412 高的死角（420 > 视口，改按可视余量取小）
9. S-1 首页三档一次修净（915×412 首屏 0 卡 / 390×844 半张 / 360×640 0 卡）+ S-2/S-4 l99 星级 SVG 与 38px 顺手带走
10. L-1 学习 4 款横屏答题控件 + L-2 clock-house 两代钟面（A 的闯关学习主菜，r4 原文有效）
