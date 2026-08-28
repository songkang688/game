# 三人组第 6 轮 · 测试修复员 A/B 任务清单（playbook）

> **r7 对账（基线 `43a79eb9`，逐项核过源码+实测，全表见 `trio-r7-learn-notes.md` 第二节）**：L-4 已由测试员 A `640b3242` 的 `regrowCellPx` 以修代裁结案 ✅；其余 S/L/C/N 条目全部未动，原文继续有效。补测护栏：fight-king 无尽连胜与 duo-vs-star 非闯关五模式干净/轻伤，修 N-25/N-26 别扩大化；N-27 扩围至 dot-maze 四模式（无尽 121 / 抢豆 143 也中）；N-16 确认 adventure-king 走廊引擎三态（闯关/无尽遗迹/计时速通）一次修全。新发现 N-30（ak 无尽古堡）/ N-31（fk 训练场）/ N-32（bvp 无尽战斗）见 `trio-r7-playbook.md`。
> 依据：`trio-r6-learn-notes.md`（基线 `game-1.3 = 3c7fb691`，全部条目带实测数字与截图核验）。
> **只列仍未落地的 🔧**。r5 playbook 里被 `0ebafb31`（bubble-aim clamp + root）等收掉的部分见 learn-notes 第二节对账表；r4/r5 原编号（S-x/L-x/C-x/N-1…N-24）继续有效，本清单不重开新号、新发现从 N-25 续编。
> **注意撞车**：测试修复员 B 正在并行执行 r4/r5 休闲项。动手前先 `git fetch` 对最新 `game-1.3`，凡 B 已合入的按「后合者拉最新、撞车取先合版」纪律处理，别按本表重复修。
> 分工建议：**A = 壳层 + 闯关学习**，**B = 休闲对战动手**。
> 修补配方 A/B/C 见 r4 learn-notes 第六节，D/E/F 见 r5 learn-notes 第四节，G/H 与 C-1 守门口径修正见 r6 learn-notes 第四节。

## 通用纪律（与 r4/r5 一字不差的红线）

- **不改存档 key**：`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>` / 平台钱包 key、`meta.id` 一个字符不动。
- **不动题库/判定/关卡生成**：`levels.ts` 数据、seed 链路、win/lose 判定零触碰。
- **测试只增不减**：进场先 `npm test` 记水位；每条修复配 1 份小测试；交卷水位 ≥ 进场。
- **kit 冻结**：`src/art/kit/` 已有文件只 import 不改（stickers.ts 扩容例外）。
- **宽屏零回归**：钳高改动在 412×915 与 1280×800 复测「修前修后一致」。
- 收尾：fetch → rebase → `npm test` / `npm run build` 全绿 → 普通 push，禁 force。

## 测试步骤备忘

- 本地起服：`npm run build && npx vite preview --port 4173`；无头验证 puppeteer-core + `/usr/local/bin/google-chrome`。
- 视口五档：360×640 / 390×844 / 412×915 / **915×412（本轮新伤全在此档）** / 1024×768；宽屏对照 1280×800。
- **管理员直达**：家长面板 → 管理员权限 → 密码 `kangkang`（可选时长或永久；开着时选关全解锁 + 关内「🎫 直达」；8 款自建选关也已全部认门）。直达与解锁不写星级存档。
- 量裁切口径同 r4（`.game-stage` clientHeight）；「crop=0 但控件够不着」先扫自滚容器（r5 口径）；**带模式菜单的款逐模式点进玩法态再量**（r6 模式 H：fight-king/dot-maze/duo-vs-star 的新伤全是这么漏掉的）。

---

## 壳层（给 A）

### S-1（续）首页首屏看不到游戏卡——三档一次修净 🔧

- r4 立项、r5 加档，本轮核实 `styles.css`/`home.ts` 仍零改动。实测数：360×640 首屏 0 卡（首卡 top=722）、390×844 只露 127px 半张（top=717）、**915×412 横屏 0 卡（top=557）**；1024×768 无伤。
- **改哪**：`src/styles.css`（必要时 `src/ui/home.ts` 结构顺序）。竖屏 `@media (max-height:740px)` 收 hero+筛选条；横屏补 `@media (max-height:500px)`。方向对齐「hero 是论点」：首屏主角是「最近玩过/继续玩」。
- **验收**：三档首屏（不滚）完整露出首行卡上半张（卡 top ≤ 视口高 − 100）；筛选条 ≥44px；1280×800 零回归。

### S-2（续）l99 星级字符星 → 12×12 内联 SVG 🔧 + S-4 `.l99-jump-input` 38→44 顺手项

- 本轮核实 `level99.ts:469` `starRowHTML` 仍 ★ 字符、`:529` 仍 `min-height:38px`。配方 = 窗口 1 r1 learner P7（双态 fill `#ffb937`/`#e3ddef`，`.l99-node-stars`/`.l99-beststars`/`.l99-ov-stars` 三处一次改净）。

### S-3（续）parentAuth 弹窗跨路由残留 🔧

- 本轮核实 `src/ui/parentAuth.ts` 仍无 hashchange 处理。r4 原文有效（hashchange 即 `finish(false)`；密码不落存储的约定一字不动）。

---

## 闯关学习（给 A）

### L-1（续）学习 4 款横屏答题控件折叠线下 🔧

- 本轮核实 shape-kingdom/color-fun/music-stars/find-diff 四款 0 diff。r4 原文有效：915×412 下 3 钮 / 7 控 / 4 控 / 9 格在折叠线下。走配方 B。（clock-house 关内 915×412 本轮实测干净，别扩大化。）

### L-2（续）clock-house 前 99 关题面钟两代同堂 🔧

- 本轮核实 `levels.ts:78` `clockSVG` 原样。r4 原文有效（换 arrowHandD/hubSVG/11px 刻度，`data-h`/`data-q` 与角度公式零触碰）。

### L-3（续）find-diff 盘面贴纸补第 4–10 章 🔧

- 本轮核实 `boardArt.ts` 头注原样。净活 = stickers.ts 补图 + boardArt.ts 映射加行，门控逻辑不改。

### L-4（续）find-diff 26px 盘面格裁决记录 💡 → ✅ r7 对账：已由 A `640b3242` 以修代裁结案

- ~~按 BL-W6-03 结案格式写一页裁决核销编号，不动格子。~~ 病根（首帧空骨架假余量钳死 26px）已被 `regrowCellPx()` 修掉，390×844 / 1024×768 回涨 44px、+6 用例，无需再写裁决记录。

---

## 休闲对战动手（给 B）

> 先与最新 `game-1.3` 对账：B 自己 r4/r5 批次里已修的项按已合入版为准。

### N-25 fight-king 格斗塔关内两档折叠线下 🔧（本轮最重，走配方 G）

- **现象**：915×412 进塔第 1 关裁 498 / canvas 出屏 335 / 轻击·重击·必杀·防御·⏸ 全部折叠线下；**390×844 也裁 123（必杀/防御折叠线下）**；1024×768 干净；人机/双人对战态干净（裁 21）。
- **机理**：塔模式独有的「出战角色」八宫格（约 230px）常驻在 l99 抬头与战场之间；`fitStage` 的 `FIGHT_MIN_H=150` 下限触发后把超出量交给舞台滚动——实时格斗不能滚。
- **改哪**：`src/games/fight-king/index.ts` 塔模式壳（`showTower` 一带）。矮屏（如 `max-height:600px` 或量可视余量）把出战角色八宫格折叠成一行「当前出战：×× · 换人 ▾」，展开才显示全宫格；或触屏按键排 sticky 置底。`stageMaxWidthPx`/`FIGHT_MIN_H` 本体与判定零触碰，`stageFit.test.ts` 既有用例零改动。
- **验收**：915×412 与 390×844 塔内不滚就能按到全部触屏按键、canvas 出屏 0；人机/双人态与 1024×768 零回归；新增塔壳折叠断言。

### N-26 duo-vs-star 闯关关内 915×412 七键折叠线下 🔧（连同 r4 C-9 一次清账）

- **现象**：915×412 进闯关第 1 关裁 310 / canvas 出屏 111 / ◀▲▼▶✋💥🤝 七键整排折叠线下（截图：擂台只露天空）；390×844 与 1024×768 干净。
- **改哪**：`src/games/duo-vs-star/index.ts`。走配方 G：横屏矮屏触控键分列画布两侧（双人本就一人一套），或钳 `.dvs-canvas` 显示高让键排进屏。顺手把 r4 C-9 的 `.dvs-back` 补 `min-height:40px`、取反 `window4-visual-scan-r3.test.ts` 登记断言。
- **验收**：915×412 七键全在屏可点、canvas 出屏 0；竖屏/平板零回归；C-9 断言转绿。

### N-27 dot-maze 闯关 + 双人追逃 915×412 方向键折叠线下 🔧（走配方 G）

- **现象**：单人裁 167（⏸▲◀▼▶ 五键线下）、双人追逃裁 143（两套方向键 9 控件全线下——PR50 新加的双人键盘正是受害者）；其余两档干净。
- **机理**：`layout.canvasDisplayCapPx` 的 `MIN_CANVAS_DISPLAY_PX` 下限保迷宫、键盘被挤下线。
- **改哪**：`src/games/dot-maze/index.ts`（键盘排布局）。横屏双栏：单人 D-pad 挪画布右侧，双人一人一侧（915 宽横向余量充足）；`canvasDisplayCapPx` 纯函数与判定零触碰。
- **验收**：915×412 单人 5 键/双人 9 键全在屏、迷宫主体 ≥60% 可见；竖屏零回归;补横屏排布断言。

### C-1（收尾扩容）modebar `[hidden]` 残余 4 款 + 修正口径守门测试 🔧（先做，半小时级）

- **名单更新**：box-hamster `.bh-modebar`（40px）/ prince-princess `.pcp-modebar`（82px，进模式还要补 `bar.hidden=true`）/ sudoku-petal `.sp-modebar`（154px）/ **adventure-king `.ak-bar`（N-28 新抓，412×915 残留 88px、1024×768 残留 40px——r4 名单只扫了 `-modebar` 后缀漏掉它）**。
- **改哪**：四款各自 `index.ts` CSS 补 `.xx[hidden]{display:none;}`（照抄 poop-hero）。守门测试按 r6 修正口径写：CSS 有 `display:flex` 的 modebar 族类名 **且** 同文件对该元素设过 `.hidden = true` 才纳管（初版正则会把 bba-modes/cds-modes/bvp-bar/dvs-bar 四个误报也拉进来，别用）。13 款 r4 测试欠账一并补或由守门测试统一覆盖。
- **验收**：四款进模式后 `getComputedStyle(bar).display === "none"`、高度 0，退出还原；守门测试全库绿（未修前四款当场红，正好当验收）。

### N-29 bubble-aim 关内横屏发射台出屏 🔧

- **现象**：915×412 进第 1 关 canvas 显示高 480 > 视口 412、出屏 206，发射台（拖拽瞄准起点）整个在折叠线下——泡泡墙看得见、炮打不着。
- **改哪**：`src/games/bubble-aim/index.ts`。配方 B 之 1：`.ba-canvas` 显示高按可视余量钳 max-height（canvas 是 replaced 元素会连宽等比收，物理分辨率与命中判定零触碰）；resize 重量、destroy 摘监听。
- **验收**：915×412 发射台与泡泡墙同屏可见、拖拽可发射；竖屏/平板零回归；新增 stageFit 纯函数测试。

### N-23（补充版）自绘选关地图三款 focusCurrent + bubble-aim clamp 矮横屏死角 🔧（走配方 D）

- **现象更新**：bubble-aim `.ba-map` 的新 clamp 在 915×412 下限 420px > 视口 412，stage 仍裁 150、内滚 3178px；`showMap` 仍无 `scrollIntoView`。candy-swing `.cs-map`（915×412 选关页裁 1879）与 sling-birds `.slb-map` 零改动。
- **改哪**：三款地图渲染后当前关节点 `scrollIntoView({block:"center"})`（蓝本 `level99.ts:871`）；bubble-aim 的 clamp 下限改按可视余量取小（`min(420px, stage 可视高 − 地图外家当)` 一类，别让下限反超视口）。解锁判定与存档 key 零触碰。
- **验收**：开 `kangkang` 全解锁点高关后退出重进，当前关无需手滚即在视野中；915×412 选关页 stage 裁切 0。

### r5 未动项重申（原编号有效，本清单不重抄）

- **N-1 fruit-catch**（裁 741/出屏 617 + 平板 415/281，r5 单款最重）、**N-2/N-3/N-4 回合必点组**（flight-chess/star-estate/hero-cards，配方 E）、**N-5…N-9、N-20 盘面完整可见组**（memory-cards/lianliankan/bubble-pop/chess-garden/sudoku-petal/mine-garden，配方 B 之 3）、**N-10 棋类三款横屏**、**N-11…N-15 + N-19 stagePlayRoom 家当组**（配方 F）、**N-16/N-17/N-18 实时触控键组**、**N-21/N-22 已修款横屏残余**（block-drop/combo-clash——机理即 r6 模式 G 的下限触发，复核时一并读）、**S-1 之 N-24 首页横屏**（并入 S-1）。全部照 r5 playbook 原文执行。
- **r4 未动项**：C-2 brick-break / C-3 snake-snack / C-4 snake-royale（新基数 262/150）/ C-5 mole-pop / C-6 alien-seek / C-7 match-stars / C-8 名单（hue-hand 335 / orb-arena 249 等）/ C-9（并入 N-26）。照 r4 playbook 原文执行。

---

## 完成定义（两人共用）

1. 全部 🔧 关账或书面降级（降级写数学/物理理由，照 BL-W6-03 格式）；💡 至少给裁决记录。
2. `npm test` / `npm run build` 全绿，用例水位只增不减；每条修复有配套测试或取反断言。
3. 本轮新重灾款（N-25 fight-king、N-26 duo-vs-star、N-27 dot-maze、N-29 bubble-aim）在 915×412 复测截图或数字留档，逐条对账 N 编号。
4. 报告按既有命名续档，对账本 playbook 与 r4/r5 playbook 三方编号；与 B 并行批次撞车的按「先合版」纪律记录明细。
