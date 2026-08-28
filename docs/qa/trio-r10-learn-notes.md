# 三人组第 10 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`game-1.3 = 4b3a4cab`（已含 r9 学习笔记合入 `3c9902cb` + 父监督 15min 对账）。`src/**` 相对 r9 笔记时点仍无新合入。
> **为什么是 r10**：派发时要求写 r9 笔记，但 r9 已由并行学习员合入（N-39 蓝本地图聚焦、配方 K、A 第 2 轮九项 ✅）。本轮不覆盖那两份文档，只补 r9 **没抽到的面**（创作皮肤深关、窗口视觉 vs 点触、双人竖屏、关内商店/内嵌暂停），新伤从 **N-43** 续编（r9 补测已占用 N-40 duo-rush / N-41 麻将 / N-42 puff）。
> 衔接：r9 对账把 S/L/C 已合项销账 → 本轮再对账 **并行 A/B 在途分支**（法律上未合入，playbook 标「在途」）+ 新抽验。`src/**` 一行未动。
>
> **R2 学习员补测计划（不覆盖上文 N-43…N-45）**：`origin/game-1.3` 现已含 A `39d61b50` + B `b2c07a6e`。本补测只换面：1.3 窗口款关内操作排 / 双人分屏（r9 未抽 id）、N-33 结算 sticky 复证（仍开不换号）、棋类 N-10 复证、失败只鼓励、商标扫描（排除 `.cursor/skills`）、未量过的模式菜单、root×另一深关。新伤从 **N-46** 续编。工装 `/tmp/trio-r10-*`。零改 `src/**`。

## 一、抽验方式（可复现）

- `npm run build && npx vite preview --port 4173`，headless Chrome（`/usr/local/bin/google-chrome` + puppeteer-core，脚本与截图放 `/tmp/r9-audit.*` `/tmp/r9-shots/` **不进库**）。
- 视口：**915×412** 主档；新伤跨 390×844 / 412×915 / 1024×768。
- 量法同 r4–r9：`.game-stage` 裁切；折叠线下控件（`rect.top ≥ 视口高`）；canvas 出屏；自滚容器；弹窗/veil 内滚与「覆盖层内不滚够不着的钮」。
- **本轮抓手（r4–r9 没量过或只浅量）**：
  1. 创作/学习皮肤深关：`color-fun` 七关型（mix/number/memory/shade/rule/legend/limited）、`music-stars` 四关型（rhythm/interval/duet/score）、`math-farm` 第 100+ 章（竖式插图）、`kitty-care` 养成关、`shape-kingdom` `isDrawLevel` 作图关。进度路：`yiduo-yixing.l99.<id> = Array(N).fill(1)` 后 `.l99-continue`，**不开 root**（免把关型账和 N-37 搅在一起）。
  2. 窗口 8 视觉改过的 4 款 vs 玩法 UX：red-blue-tap 闯关/对战、kitty-care 养成、math-farm 第 1 关、color-fun 第 1 关。
  3. 双人同时操作 **390×844**：puff-bros / bomb-buddies / red-blue-tap / red-blue-race / red-blue-tug（同屏双人）。
  4. 失败/过关之外的覆盖层：gold-hook 关内商店 veil、gold-hook 内嵌暂停、garden-guard 关内 ⏸/1×/2×、brave-path 备战商店列表、bubble-aim root 态自建地图。
- 进场水位：`npm test` 于当时工作树 **1095 文件 / 19288 用例** 中 2 红（`bomb-buddies/ai.test.ts` 5s 超时、`gomoku/tiers.test.ts` 随机胜率），**未为变绿改测试**；`npm run build` 通过。

## 二、r9 playbook 对账（对照 `origin/game-1.3` + fetch 后的 `origin/cursor/*`）

### 已合入 game-1.3（✅，r9 已销，本轮复证源码仍在）

| 项 | 判定 |
| --- | --- |
| S-1 / S-2 / S-3 / S-4（l99 侧） / L-1（shape-kingdom 答题 + find-diff） / C-1 含 `.ak-bar`=N-28 / orb-arena·snake-royale 留白 / garden-guard 小章 | ✅ 合入 `d451c32d` 批次，r9 浏览器复证过 |
| N-24 首页横屏 | ✅ 并入 S-1 |

**L-1 口径更正（r9 销账过宽）**：A 第 2 轮自己写明 color-fun / music-stars「属动手款，范围外跳过」。r9 用 shape-kingdom 第 1 关 + find-diff 把 **整条 L-1 标 ✅** 是错的。本轮 915×412 复测 color-fun **七关型色盘/调色锅全线下**（见 N-43）；music-stars 节奏/双声部玩法键在屏、只有设置芯片线下（观察，不新开号）。

### r8 新号 N-33…N-38 已由测试员 A 第 9 轮合入 game-1.3 ✅

父监督已将 `cursor/trio-r9-tester-a-7779` 合入 `game-1.3`。学习员交卷时点仍写「未合」，以主干为准。

### 在途（未合入，playbook 不要当成「未动去重做」，先 fetch）

| 分支 | 覆盖 | 注意 |
| --- | --- | --- |
| `origin/cursor/trio-r9-tester-a-7779` | N-33/34/35/36/37/38/30/收藏册 | **已合入 game-1.3**。限时 135 仍要按 r9 加重档复测 |
| `origin/cursor/tester-a-r7-fixes-def4` | **N-30 古堡双栏（另一份）**、**N-32** 无尽战斗 sticky、**N-27** 豆迷宫四模式键排、**L-2** clock-house `faceLift` 序列化补丁 | 与 r9-A **双改 N-30**，合入取先合版 |
| `origin/cursor/casual-duo-fit-r5-b-4683` | N-1、C-2/3/5/6/7、C-4/C-8/C-9 一批、N-2/3/4、配方 F、N-16/17/18、bomb-buddies 等；另有第二份守门测试 | r9 已写撞车：`[hidden]` 与 `modebarHidden.guard` 必须二合一 |

**N-39**（r9 新号，蓝本 `showMap(true)` 四调用点）：主干仍未接线，A 的 r9-A 批次也没动它 → 仍开给 A。

## 三、新抽验结论（主档 915×412，数字来自 `/tmp/r9-audit.json`）

**干净、可以放心的（本轮补测结案，下轮不要再量）**：

- `shape-kingdom` **作图关**（第 102 关族，`isDrawLevel`）：915×412 裁 0 / 折叠线下 0，「提示/重来/我摆好了」在屏；竖屏/平板三档干净。宿主 `.shk-draw` 自滚 270 是点阵区设计内。
- `kitty-care` **养成关内**（第 1 关与深关）：915×412 折叠线下 0；道具贴纸化后没有「好看但点不到」。相册网格自滚（换装钮在列表里）= 收藏册同族浏览面，不立项。
- `math-farm` **第 1 关**（无竖式插图）：915×412 裁 0 线下 0——L-1 quiz 紧凑档在这一型成立。
- `music-stars` **音程 / 简谱** 两关型：915×412 玩法键在屏。节奏/双声部鼓键、琴键在屏（截图实锤），仅音量/音色芯片 top 431–452 线下 → 观察，修创作皮肤时顺手收，不新开号。
- `red-blue-tap` 闯关 + 对战 915×412、以及 **五款双人 390×844**（puff-bros / bomb-buddies / red-blue-tap / red-blue-race / red-blue-tug 同屏）：裁 0 线下 0。窗口 8 贴纸/剪影升级没有把热区做丢。
- `garden-guard` 关内速度条（canvas 上 ⏸/1×/2×）：915×412 裁 0。
- gold-hook **模式选单** 915×412 干净（r9 复证仍成立）；**真正的商店要先闯关再点🛒**（见 N-45）。
- `red-blue-race` 对战场 915×412 线下 0（wrap 自滚 128 属轻伤观察）。

**新发现（编号续编 N-43 起；N-40…42 留给 r9 补测）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-43 | **color-fun 全关型** 矮横屏色盘/调色锅线下（L-1 动手半壁，配方 J 扩到涂色） | 915×412 七关型全部中招：mix 9 控、number 6、memory 7、shade 8、rule 5、legend 6、**limited 10 控（撤销/重做 + 红黄蓝白黑锅 + 三色票，top 508–655）**。stage 裁切仅 6，真账在 `.clf-wrap.clf-scrolly` 自滚 161–352，画布看得见、**全部上色交互件在折叠线下**。390×844 limited 轻伤（3 票 top 852）；412×915 / 1024×768 memory 干净、limited 基本可玩。第 1 关 guide 同样 7 控线下——不是深关才坏 | 🔧 |
| N-44 | **math-farm 第 100+ 关竖式插图** 把 L-1 紧凑预算吃光 | 进度路进第 100 关族、不开 root：915×412 裁 0，但三枚 `.qz-choice` **整排 top 481 线下**，宿主 `.mtf-quizhost` 自滚 183。截图：竖式 `46+28` 题卡完整、答案钮只露一条边。同视口第 1 关（无线上插图）全绿。quiz99 `@media (max-height:500px)` 只把 `.qz-prompt svg` 限高 64px，**竖式 DOM 插图不走这条选择器**。ch8/ch9/ch10 抽样本轮碰巧没抽到超高插图（线下 0），验收仍按「有 `kind:vertical` 的关」 | 🔧 |
| N-45 | **gold-hook 关内商店 veil** 必点钮在覆盖层滚线下 | 闯关进关后点🛒：`.gdh-veil` 173–343、内滚 230；第三件商品 buy 钮 top 416 线下；**「接着挖 ▶」top 513 整钮线下**。底栏 HUD（放绳/商店/暂停）还压在 veil 下沿。390 未复测商店（先修主档）。暂停 veil 点得到。配方 I 的游戏内嵌版：滚动边界要切在货架与「接着挖」之间，或 veil 给 footer sticky，且别让 HUD 挡住关闭钮 | 🔧 |

**观察项（不立项）**：

- puff-bros 双人 915×412 裁 42、线下 0——轻伤，C-8 家族。
- bomb-buddies 双人 915×412 **六键（每边放泡/踢泡/拍破）top 489–591 线下 + canvas 出屏 60**——即 r5 **N-15**，390×844 本轮干净；B 在途分支已动 `bomb-buddies/index.ts`，合入后复测 915 双人态即可。
- red-blue-tug 915×412 模式卡「同屏双人」top 429 切半——选单轻伤，进局后未单列。
- prince-princess 第 1 关 915×412 六键线下 + 裁 185 = **N-17**，B 在途。
- bubble-aim root 地图节点大量线下：`.ba-map` 自滚 3678，属长地图设计内（真账仍是 N-23 缺 focusCurrent）。
- brave-path 备战「买」钮长列表：r7 已定性设计内。
- 攻略抽屉 915 侧栏 r8 已结案；sheet 态 r9 已结案。

## 四、系统性模式提炼

r4 A/B/C、r5 D/E/F、r6 G/H、r8 I/J、r9 K 仍有效。本轮 **不新开字母**：机理都能归进旧配方。

### 配方 J 补笔 · quiz/创作皮肤的「插图规格」也是关型

- color-fun 七 `mode`、math-farm `illustrationPlan(vertical)` 与第 1 关答题 **不是同一屏**。L-1 只钳 `.qz-prompt svg { max-height:64px }` 救不了自定义插图宿主。
- **验收**：凡 runner 里 `cfg.mode` / `spec.kind` / `isXxxLevel` 分支，矩阵按「关型 × 视口」；修 quiz 紧凑档时用**最高插图**那一关当验收样本（math-farm 竖式、color-fun limited）。

### 配方 I 补笔 · 关内 veil/商店 = 结算弹窗的弟弟

- gold-hook `.gdh-veil` 与 `.dialog` 同构：内容可滚、关闭/购买钮排在文档流最底。攻略 drawer 的 footer 钉住仍是正面样板。
- 叠加病：底栏 HUD `position` 盖住 veil 下沿——sticky footer 要垫在 HUD 之上（`z-index` + `padding-bottom: HUD高`）。

### 配方 H 补笔 · 双人竖屏绿 ≠ 双人横屏绿

- 五款 390×844 双人全绿，bomb-buddies 一转到 915×412 六键全没。修 N-15 时验收必须含 **对战态 × 915×412**，不能只拿竖屏截图结案。

## 五、skills 增量（r4–r9 写过的不重复）

| skill | 本轮新提炼 | 落点 |
| --- | --- | --- |
| `frontend-design` | 窗口视觉轮把贴纸/剪影做 dense 了，验收仍只问「那一排操作还在不在第一屏」——color-fun 画室氛围完整、色盘整排在线下，就是「好看但点不到」 | N-43 |
| `canvas-design` | 「nothing falls off the page」对 **DOM 插图**同样成立：竖式题卡比 SVG 题面高一截，紧凑媒体查询漏选器 = 假绿 | N-44 |
| `theme-factory` | 章节主色可以变，**操作区几何不能跟主题走**：limited 关多出来的调色锅是玩法不是装饰，不能当氛围一起卷进 scrolly | N-43 |
| `algorithmic-art` | 用 `CHAPTERS` 尺寸 + `mode:` 字段反推关号（color-fun 34/51/84/99/121/143/166，music 99/121/143/166，shape draw = 章≥6 且 `index%5===2` → 102），比盲扫 188 关快 | 第一节 |
| `character-sprite-maker` | 仍不适用本库矢量工序；kitty-care 本轮只确认道具贴纸没有挡热区 | 已收口 |

外部休闲小游戏「操作区常驻、内容区可滚」：与配方 I/E 同句，gold-hook 商店是新样本，不新开 K（K 已被 r9 占用）。

## 六、已收口（下一轮不要重复做）

1. r9 已销的 S-1/S-2/S-3/S-4(l99)/C-1/N-28/竞技场留白/garden-guard/N-24/L-1 的 **shape-kingdom 答题 + find-diff**（不要重做；color-fun 改走 N-43）。
2. shape-kingdom 作图关、kitty-care 养成关、math-farm 第 1 关、music-stars 玩法键、双人竖屏五款、garden-guard 速度条、red-blue-tap 两态 915、gold-hook 模式选单。
3. r8/r9 干净名单继续有效（过关失败覆盖层、攻略两形态、rootgate、组字/限时**基线**、结算弹窗竖屏）。
4. 不要把 B/A 在途分支上的修复当成主干已合。
5. **R2 补测追加收口**：N-33 结算 sticky 浏览器实锤（再玩一次 276–320 / 回首页 332–376 均 `inView`）；N-38 永久文案「管理员权限已永久开启」；fruit-slice / rainbow-run / poop-hero / garden-guard 关内 / kitty-care 关内 915×412 干净；失败文案无责骂词；`src/**` 面向孩子文案商标扫描干净（排除测试黑名单与 `.cursor/skills`）。

## 七、下一轮 A/B 最该先做的（与更新后的 r10 playbook 一致）

1. **先 fetch 最新 `game-1.3`**：A `39d61b50`、B `b2c07a6e` **已经合入**，N-33/34/35/36/37/38/30/收藏册/N-25/N-31 源码声称/N-1/N-32/N-26/N-27/N-29/N-23 **禁止再写第三份**。
2. **N-39**（主干 `showMap()` 四处仍默认 false；hop-pads 地图当前关 426–502 整格线下）。
3. **N-43 / N-44**（A 创作/竖式）+ **S-4 `.qz-jump-input` 38px** + **L-2/L-3**。
4. **N-45** gold-hook 商店 + **N-10** 棋类 + **N-40** duo-rush 工具条 + **N-15** 泡泡双人六键。
5. **N-46** sky-squad 六键切半（r5 曾标干净，本轮关内操作排抓手）。
6. **N-47** 模式菜单芯片 <44px（bowling 34 / 王子公主 37 / 坦克模式 38）。
7. 旧号复证仍开：N-11 bowling 关内、N-19 tank D-pad、N-22 combo 三钮、C-8 snow-fight/shoot-range/hue-hand、N-16 走廊、N-17 王子关内、N-31 训练场假人行仍线下。

---

## 八、R2 学习员换面补测（主档 915×412；`game-1.3` = A+B 第 9 轮已合）

> 基线 commit `c61fb0a5`（本文件计划段）。preview `http://127.0.0.1:4174`（4173 已被占用）+ puppeteer-core + `/usr/local/bin/google-chrome`。脚本/截图 `/tmp/trio-r10-measure.mjs` `/tmp/trio-r10-shots/` **不进库**。每档独立 `createBrowserContext`。
> 进场水位：`bddb8e50` 工作树 **`npm test` 1109 文件 / 19330 用例全绿**；`npm run build` 通过。相对 r9 的 1095/19288 = A/B r9 测试文件入账，只增不减。
> `git diff` 证明本补测 **零改 `src/**`**。不重写上文 N-43…N-45，不重测 r9 已结案的 hop-pads/gold-hook 关内、红蓝同屏、麻将/puff 牌宽（仍开号留给 playbook，不换新号）。

### 8.1 对账：A/B 第 9 轮已在 `origin/game-1.3`

| 批次 | SHA | 本轮判定 |
| --- | --- | --- |
| A r9 `fix(r9-A)` | `39d61b50` | **N-33** 源码 `.dialog-buttons{position:sticky}` + 本轮 duo-rush 结算弹窗两钮在屏、暂停壳层五钮在屏 → **✅ 关账，勿再做 sticky**。**N-38** root 永久小字 ✅。收藏册 44 ✅。**N-34/35/36/30** 源码在，勿重做。**N-37** 源码 `:has(.l99-jump)` 在；root×clock-house L1 关内 crop 0 线下 0；root×math-farm 第 81 关三枚 `.qz-choice` top **381 切底**（见观察，不新开号）。 |
| B r9 `fix(qa-r9)` | `b2c07a6e` | **N-25/N-1/N-32/N-26/N-27/N-29/N-23** 源码合入 → playbook **✅ 勿重写**。**N-31** 源码有 `.fk-train-shell` sticky 注释，但 915×412 训练场「站立/蹲防/随机反击」top **447**、「开打 ▶」top **531** 仍整排线下、钮高 38px → **仍开同一号**。 |
| N-39 | 主干 | `showMap()` 初次 `:1100` 与三处回地图仍默认 false。hop-pads 地图 `.l99-node-cur` **426–502 整格线下**（与 r9 逐位一致）。并行 A 分支或有 HTMLElement 修补，**以 `game-1.3` 为准**。 |
| `.qz-jump-input` | `quiz99.ts:153` | 仍 `min-height:38px`。 |

### 8.2 干净（本抓手结案，下轮不要再量这些 id 的这一态）

- **fruit-slice / rainbow-run / poop-hero / garden-guard 关内 / kitty-care 关内**：915×412 crop 0 或 6，折叠线下 0。
- **N-33**：结算 `position:sticky`，「🔁 再玩一次」top 276、「🏠 回首页」top 332，均 `inView`；坦克关内打开壳层暂停，五钮 108–376 全在屏。
- **失败只鼓励**：`quiz99.ts` `FAIL_LINE` =「这一关的题目有点调皮，我们休息一下再来一次！」；`level99` 失败池含「就快成功了…加油」；`rg` 面向孩子源码无「真笨/真蠢/你不行/废物/YOU LOSE」。clock-house 本轮未打出 lose 弹窗（乱点未触达失败阈值），以源码+扫描为准。
- **商标**：排除 `.cursor/skills`、`*.test.ts`、QA 黑名单表之后，`src/games/**` 孩子可见文案/注释未命中计划黑名单；`candy-swing` 头注已是「划绳物理益智」。命中仅 `src/qa-window2/r3lib.ts` 与 `docs/plan*` / `docs/upgrade-prompts*` 的扫描词表。
- **N-38** 文案：root 永久 × clock-house L1 小字「管理员权限已永久开启」，不再出现上亿分钟。

### 8.3 旧号复证（不换号）

| # | 对象 | 本轮 915×412 | 备注 |
| --- | --- | --- | --- |
| N-10 | xiangqi / gomoku / weiqi-garden | 裁 437 / 331 / 188；canvas 出屏 245 / 216 / 43；工具行 top 687 / 638 / 463 | 与 r9 同数量级 |
| N-40 | duo-rush 赛道 | crop 175；暂停/再来/换玩法 top **462** 整排线下；画布 `offBottom 0` | 配方 L，勿钳已在屏画布 |
| N-15 | bomb-buddies 双人合作 | 六键 top 498–600；canvas 出屏 69 | r10 前文已强调必须含 915 对战态 |
| N-11 | bowling-lane 关内 | crop 237；◀🎳▶↩ top **587**；暂停 34×67 | r5 原数 237 |
| N-19 | tank-battle 闯关 | stage crop 0（`.tkb-root` 自滚）；D-pad/开火 top **503–552**；暂停 **32px** | r5 口径 |
| N-22 | combo-clash 关内 | crop 131；轻/重/必杀 top **451** | r5 原数 131 |
| C-8 | snow-fight 闯关 | crop 172；六钮 462–514 | r4 横屏 172 |
| C-8 | shoot-range 闯关 | crop 339；键 560–660；canvas 出屏 90 | r4 336/87 |
| C-8 | hue-hand 关内 | crop 335；抽牌/出牌/暂停 top **416** | r5 新基数 335 |
| N-17 | prince-princess 闯关 | crop 185；六键 467–513；模式钮 37px | r7 原账 |
| N-16 | adventure-king 走廊/遗迹 | crop 258；六键 top **567**；canvas 出屏 147 | A 只修了古堡 N-30 |
| N-31 | fight-king 训练场 | 假人三钮 + 开打仍线下 | B 合入后 915 未绿 |
| N-39 | hop-pads 地图 | 当前关 426–502 | 配方 K |

### 8.4 新发现（N-46 起；旧账不换号）

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-46 | **sky-squad 关内六键** 915×412 切半（r5 曾写「crop 71、无控件折叠线下」已过期） | 闯关六键 `.sks-key` top **397** h=42 → bottom 439 切出 27px，暂停 33px；**双人同屏** 六键缩到 **36×36**、暂停仍 33，crop 38、折叠线下 0 | 🔧 配方 G：键排贴底或画布再让一档；双人热区抬回 44 |
| N-47 | **模式菜单芯片热区**（本轮才量的开关态，不是关内） | bowling-lane 菜单「双人对战/人机/无尽/三档 AI」**34×102 / 32px 高**；prince-princess 菜单三人模式钮 **37px**；tank-battle 菜单「单人闯关/无尽/对战」**38px**；shoot-range 模式入口 40px（贴线观察） | 🔧 只改菜单芯片 `min-height:44`，勿动关内判定 |

**未单列新号**：music-stars 音量/音色芯片 top 428 线下——r10 前文已观察，修创作皮肤顺手。fight-king 模式卡「训练场…」top 346 切底 crop 248——观察，N-25 合入后菜单层未单独立项。

### 8.5 配方补笔（不新开字母）

- **配方 F** 继续吃 N-11/N-15/N-19：`stagePlayRoom` 没减自家键排。坦克本轮再证实 crop=0 陷阱。
- **配方 L** 继续吃 N-40：手势面在屏 ≠ 工具条在屏。
- **配方 K** 继续吃 N-39。
- **N-46** 归配方 G（矮横屏键排与画布抢高）；r5 的 sky-squad「HUD 换行干净」不能当操作排结案。

### 8.6 skills

`frontend-design`：1.3 窗口款（坦克/雪仗/泡泡/射击/保龄）画布好看，键排在 412 高下沿——与 N-43 同一句「好看但点不到」。`canvas-design`：棋类 N-10 盘面按高仍 >412。不重复 r9 的 K/L 长文。
