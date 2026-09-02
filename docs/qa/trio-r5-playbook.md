# 三人组第 5 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r5-learn-notes.md`（基线 `game-1.3 = 22a5be93`，全部条目带实测数字与截图核验）。
> **r6 对账（基线 3c7fb691，B 的 r4 走查 4 修复合入后逐项核过源码+实测，全表见 `trio-r6-learn-notes.md` 第二节）**：N-23 之 bubble-aim「520px 定死」已改 clamp 🔶（矮横屏下限 420>412 死角 + focusCurrent 三款仍缺，转 r6 N-23 补充版）；其余 S/L/C/N 条目全部未动、原文继续有效。新发现 N-25…N-29（fight-king 塔/duo-vs-star 闯关/dot-maze/adventure-king 模式条/bubble-aim 关内）与配方 G/H 见 `trio-r6-playbook.md`。B 正在并行执行本清单，动手前先对最新 game-1.3。
> 只列**仍未落地**的 🔧。r4 playbook 里已被 PR48–50 收掉的部分见 learn-notes 第二节对账表，r4 原编号（S-1…C-9）继续有效，本清单不重开新号、只写增量与新发现（N-x 编号见 learn-notes 第三节）。
> 分工建议：**A = 壳层 + 闯关学习**，**B = 休闲对战动手**。B 的量最大：先做 C-1 收尾（半小时级）与 N-1（全场最重），再按配方分组打包啃。
> 修补配方 A/B/C 见 r4 learn-notes 第六节，新配方 D/E/F 见 r5 learn-notes 第四节，条目里只写「走配方 X」。

## 通用纪律（每条任务默认附带，与 r4 一字不差的红线）

- **不改存档 key**：`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>` / 平台钱包 key、`meta.id` 一个字符不动。
- **不动题库/判定/关卡生成**：`levels.ts` 数据、seed 链路、win/lose 判定零触碰。
- **测试只增不减**：进场先 `npm test` 记水位；每条修复配 1 份小测试；交卷水位 ≥ 进场。
- **kit 冻结**：`src/art/kit/` 已有文件只 import 不改（stickers.ts 扩容例外）。
- **宽屏零回归**：钳高改动在 412×915 与 1280×800 复测「修前修后一致」。
- 收尾：fetch → rebase → `npm test` / `npm run build` 全绿 → 普通 push，禁 force。

## 测试步骤备忘

- 本地起服：`npm run build && npx vite preview --port 4173`；无头验证 puppeteer-core + `/usr/local/bin/google-chrome`。
- 视口**五档**（本轮起加两档）：360×640 / 390×844（新）/ 412×915 / 915×412 / **1024×768（新，iPad 横屏，本轮 9 款在此档中招）**；宽屏对照 1280×800。
- **管理员直达**：家长面板 → 管理员权限 → 密码 `kangkang`（PR48 后可选时长或永久；开着时选关地图全解锁 + 关内工具行「🎫 直达」）。直达与解锁均不写星级存档。
- 量裁切口径同 r4（`.game-stage` clientHeight，别用 rect.bottom）；**新增**：凡「crop=0 但控件够不着」，逐元素扫 `scrollHeight − clientHeight > 20` 找自滚容器（tank-battle `.tkb-root` 就是这么漏掉的）。

---

## S 组 · 壳层（给 A）

### S-1（续）首页首屏看不到游戏卡——加横屏档一次修净 🔧

- **现象**：r4 实测 360×640 首屏 0 卡（首卡 top=722）；r5 补测 **390×844 首卡 top=717 只露 127px 半张**、**915×412 横屏首屏 0 卡（首卡 top=557 > 412）**；1024×768 无伤。
- **视口**：360×640 / 390×844 / 915×412。
- **改哪**：`src/styles.css`（必要时 `src/ui/home.ts` 结构顺序）。竖屏走 r4 S-1 配方（`@media (max-height:740px)` 收 hero + 筛选条）；横屏补 `@media (max-height:500px)`：hero 只留一句欢迎语、header 与筛选条再收。方向对齐 frontend-design「hero 是论点」：首屏主角是「最近玩过/继续玩」，不是插图。
- **验收**：三档首屏（不滚）至少完整露出首行卡上半张（卡 top ≤ 视口高 − 100）；筛选条仍 ≥44px 可点；1280×800 零回归；首页相关用例全绿。

### S-2（续）l99 星级字符星 → 12×12 内联 SVG 🔧

- r4 原文有效（`level99.ts` `starRowHTML` + `.l99-node-stars`/`.l99-beststars`/`.l99-ov-stars`，配方=窗口 1 r1 learner P7）。本轮核实一行未动。做时顺手带走 S-4（`level99.ts:529` 的 38 → 44）。

### S-3（续）parentAuth 弹窗跨路由残留 🔧

- r4 原文有效（`src/ui/parentAuth.ts` 监听 hashchange 即 `finish(false)`；密码不落存储的约定一字不动）。本轮核实一行未动。

---

## L 组 · 闯关学习（给 A）

### L-1（续）学习 4 款横屏答题控件折叠线下 🔧

- r4 原文有效：915×412 下 shape-kingdom 3 钮 / color-fun 7 控 / music-stars 4 控 / find-diff 9 格在折叠线下。本轮核实四款 0 diff。走配方 B。

### L-2（续）clock-house 前 99 关题面钟两代同堂 🔧

- r4 原文有效（`levels.ts:78` `clockSVG` 换 arrowHandD/hubSVG/11px 刻度，`data-h`/`data-q` 与角度公式零触碰）。本轮核实一行未动。

### L-3（续）find-diff 盘面贴纸补第 4–10 章 🔧

- r4 原文有效（净活=stickers.ts 补图 + boardArt.ts 映射加行，门控逻辑不改）。本轮核实 boardArt.ts 头注原样。

### L-4（续）find-diff 26px 盘面格裁决记录 💡

- r4 原文有效：按 BL-W6-03 结案格式写一页裁决，核销编号，不动格子。

---

## C 组 · 休闲对战动手（给 B）

### C-1（收尾）modebar `[hidden]` 残余 3 款 + 全库守门测试 🔧（先做，半小时级）（r6 核对：三款原样未动，另抓漏网第 4 款 adventure-king `.ak-bar` 残留 88px，守门正则口径要加「被设过 hidden」条件防 4 条误报——扩容明细见 r6 playbook C-1）

- **现象**：运行时实测进模式后残留条——box-hamster `.bh-modebar` 40px、prince-princess `.pcp-modebar` 82px（单人模式连 `bar.hidden` 都没设，顺手补上）、sudoku-petal `.sp-modebar` 154px（全场最高）。另 13 款新兜底没配蓝本测试（r4 验收线没走完）。
- **视口**：任意，412×915 即可。
- **改哪**：三款各自 `index.ts` 的 CSS 补 `.xx-modebar[hidden]{display:none;}`（照抄 `poop-hero/index.ts` 写法）；prince-princess 进模式处补 `bar.hidden = true`（退出还原）。测试欠账建议别逐款抄 18 份，写**一份全库扫描测试**：遍历 `src/games/*/index.ts|view.ts` 的 CSS 串，凡 `display:flex` 的 modebar 族类名必须同文件有 `[hidden]{display:none}` 兜底（细节见 learn-notes 第四节守门建议；未修前三款会当场红，正好当验收）。
- **验收**：三款进模式后 `getComputedStyle(bar).display === "none"`、高度 0，退出原样回来；守门测试全库绿；modebar 本体样式 0 diff。

### N-1 fruit-catch 横屏+平板画布出屏 🔧（单款最重）

- **现象**：915×412 裁 741 / canvas 出屏 617 / ⬅️➡️ 折叠线下（截图：只见树梢不见果篮）；1024×768 也裁 415 / 出屏 281。实时接水果不能滚。
- **视口**：915×412 / 1024×768。
- **改哪**：`src/games/fruit-catch/index.ts`。走配方 B 之 1 + F：canvas 显示高按可视余量钳 `max-height`（量 `.game-stage` clientHeight 减自家徽章排与 ⬅️➡️ 排高），resize 重量、destroy 摘监听；物理分辨率与接果判定坐标不动。
- **验收**：两档 ⬅️➡️ 可见可点、canvas 出屏 0；390×844 与 412×915 零回归；新增 stageFit 纯函数测试。

### N-2/N-3/N-4 回合必点钮组：flight-chess / star-estate / hero-cards 🔧（走配方 E）

| 款 | 现象 | 视口 | 改哪 |
| --- | --- | --- | --- |
| flight-chess | 🎲 掷骰子 + 棋子钮三档折叠线下（915×412 裁 751 / 390×844 裁 437 / 1024×768 裁 435） | 三档 | `src/games/flight-chess/index.ts`：盘面钳高（配方 B）+ 掷骰子行 sticky 置底 |
| star-estate | 915×412 裁 715（33 元素）/ 1024×768 裁 399 / 390×844 裁 276（⏭️ 结束回合折叠线下） | 三档 | `src/games/star-estate/index.ts`：桌面区钳高 + 操作行 sticky |
| hero-cards | 390×844 裁 464、13 张手牌整排折叠线下；915×412 裁 395 | 390×844 / 915×412 | `src/games/hero-cards/index.ts`：战况区（对手卡）钳高滚动，手牌区贴底常驻。手牌换行测试（PR50 钉的）零回归 |

- **统一验收**：进关不滚就能看见并点到「每回合必点」钮（掷骰子/结束回合/任一手牌）；盘面主体 ≥60% 可见；412×915 与 1280×800 零回归;各款补 heightFit/sticky 断言。牌局判定、AI、发牌零触碰。

### N-5/N-6/N-7/N-8/N-9/N-20 盘面完整可见组 🔧（走配方 B 之 3，格边长宽高两把尺取小）

| 款 | 现象（915×412 主档） | 附注 |
| --- | --- | --- |
| memory-cards | 裁 496 / canvas 出屏 434；1024×768 也裁 173/101 | 翻牌记位置必须整盘可见；顺手把关内没收的模式条收了（照 snake-royale `c0b9c62b` 的 playLevel 包装） |
| lianliankan | 裁 496（18 图案格折叠线下）；1024×768 裁 172 | 连线要整盘规划 |
| bubble-pop | 裁 533（40 泡）；1024×768 裁 209 | 格径底线沿 BL-W6-03 的 44px 口径，缩到底线还装不下再书面登记 |
| chess-garden | 裁 436（33 格）；1024×768 裁 120 | DOM 棋盘,格边长按高预算 |
| sudoku-petal | 裁 401（15 格）；390×844 裁 131 | 与 C-1 的 154px 残留条同款先后修,别互相顶 |
| mine-garden | 裁 162（第 5 行 + 🖐 长按钮） | 挖雷格盘,B 之 3 直接适用 |

- **统一验收**：点名视口整盘可见（折叠线下格子数 0）；格子热区尽量保 44px；消除/翻牌/挖雷判定零改动；各款补 heightFit 测试；竖屏零回归。

### N-11…N-15 + N-19 stagePlayRoom 家当组 🔧（走配方 F，共因一个：room.h 没减自家按钮排）

| 款 | 现象 | 视口 |
| --- | --- | --- |
| bowling-lane | 390×844 裁 198：◀ 🎳停 ▶ ↩ 折叠线下（截图实锤）；915×412 裁 237；1024×768 裁 179 | 三档 |
| pool-stars | 390×844 裁 241（🎯 蓄力击球/⏸）；915×412 裁 340 / 出屏 112 | 两档 |
| fruit-stack | 390×844 裁 141 / 915×412 裁 143 / 1024×768 裁 171（◀▶放下 + 出屏 ~50） | 三档 |
| bumper-cars | 915×412 裁 180（💥🛑）；1024×768 裁 113 | 两档 |
| bomb-buddies | 915×412 裁 187（🫧🦵📡）；1024×768 裁 75 | 两档 |
| tank-battle | 915×412 / 1024×768 D-pad 折叠线下；注意 `.tkb-root` 自滚，量测要用内层容器口径 | 两档 |

- **改哪**：各款自家 `index.ts`（pool-stars 在 `view.ts`）。**不动 `src/engine/stageRoom.ts` 共享件**——在各款里把 `stagePlayRoom(host).h` 再减掉自家按钮排/徽章排实高（照 dot-maze `a16caf46` 的 `below` 变量）后再铺 canvas。
- **验收**：点名视口主操作钮全在屏、canvas 出屏 0；每款 stageFit 测试;物理分辨率与判定坐标零改动；412×915 与 1280×800 零回归。

### N-16/N-17/N-18 实时触控键组 🔧（配方 B 之 1）

- adventure-king（915×412 裁 332 / 出屏 204 / 六控件）、prince-princess（裁 173 / 6 触控键；modebar 残留在 C-1 一并收）、box-hamster（裁 316 / D-pad；同前）。各款自家 `index.ts` 钳 canvas 显示高。验收同上组。

### N-10 棋类三款横屏矮屏 🔧

- **现象**：915×412 下 xiangqi 裁 437 / 棋盘出屏 245、gomoku 裁 331/216、weiqi-garden 裁 188/43，悔棋·确认落子·提示·重摆整排折叠线下。`66601b46` 的 `@media (min-width:700px) and (max-height:840px)` 收到 380px 在 412px 高时不够（1024×768 已达标勿动）。
- **改哪**：`src/games/xiangqi/view.ts` / `gomoku/view.ts` / `weiqi-garden/index.ts`。再压一档媒体查询（如 `max-height:500px` 时按可视余量收棋盘宽），或改成量高算宽（weiqi 已 import stagePlayRoom，可直接用）。落子判定/坐标换算零触碰。
- **验收**：915×412 整盘 + 工具行同屏可见可点；1024×768 与竖屏零回归；三款各补一条 CSS/尺寸断言。

### N-21/N-22 已修款横屏残余复核 🔧（小活）

- block-drop 915×412 仍裁 111（七键折叠线下）、combo-clash 仍裁 131（轻/重/必杀）。都是修过的款（`3978c344`/`62d90a4b`），钳制参数没吃到横屏矮档——复核 fit 计算里对 `.game-stage` 可视高的取数与下限值，往下再让一档。既有 fit 测试改参数要同步。

### N-23 自绘选关地图三款接「滚到当前关」🔧（走配方 D）（r6 核对 🔶：bubble-aim 520px 已改 `clamp(420px, 100dvh−150px, 960px)`（`0ebafb31`），390×844 白板已消；但 915×412 下限 420>视口 412 仍裁 150/内滚 3178，focusCurrent 三款零改动——按 r6 playbook N-23 补充版执行）

- **现象**：bubble-aim `.ba-map` 固定 `max-height:520px` + 内滚 3096px（390×844），打开永远停第 1 关；candy-swing `.cs-map` 10 章纵铺（915×412 选关页裁 1879）无定位；sling-birds `.slb-map` 同族。
- **改哪**：三款各自 `index.ts` 的地图渲染函数：渲染后当前关节点 `scrollIntoView({block:"center"})`（蓝本 `level99.ts:871`）；bubble-aim 的 520px 改按可视余量。解锁判定与存档 key 零触碰。
- **验收**：开 `kangkang` 全解锁点到高关（或推进存档）后退出重进，当前关无需手滚即在视野中；390×844 与 915×412 选关页可正常滚到全部关卡。

### r4 未动项重申（原编号有效，本清单不重抄）

C-2 brick-break（叠加 `touch-action:none`，仍是单款最重的老账）、C-3 snake-snack、C-4 snake-royale 钳高（新基数：裁 262/出屏 150）、C-5 mole-pop、C-6 alien-seek、C-7 match-stars、C-8 其余名单（hue-hand 新基数 335 / orb-arena 249，其余原数）、C-9 duo-vs-star `.dvs-back`。全部照 r4 playbook 原文执行。

---

## 完成定义（两人共用）

1. 全部 🔧 关账或书面降级（降级写数学/物理理由，照 BL-W6-03 格式）；💡 至少给裁决记录。
2. `npm test` / `npm run build` 全绿，用例水位只增不减；每条修复有配套测试或取反断言。
3. 新重灾款（N-1 fruit-catch、N-2 flight-chess、N-4 hero-cards、N-5 memory-cards、N-11 bowling-lane）在点名视口复测截图或数字留档，逐条对账 N 编号。
4. 报告按既有命名续档，对账本 playbook 与 r4 playbook 双编号。
