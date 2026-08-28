# 三人组第 11 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

**编号更正（父监督合入时）**：并行 r10 补测已占用 N-46 sky-squad 六键 / N-47 模式芯片。本文件原 N-46…N-51 改为 **N-52 duo-arena / N-53 tank 双人 / N-54 hop-pads 双人画布 / N-55 snow-fight 十二键 / N-56 sky-squad 合作热区 / N-57 训练场选人开打**。
**主干已合（学习员基线之后）**：N-39、S-4 `.qz-jump-input`、N-16 走廊、L-2/L-3 已在 A 第 10 轮进 `game-1.3`，不必按「仍开」重做。

> 基线：`game-1.3 = 0a8c0344`（含 r9 A/B 修复合入 + r10 学习笔记 N-43…N-45）。
> **编号红线**：N-40=duo-rush 工具条，N-41=麻将牌宽，N-42=puff 热区（r9 补测）；N-43=color-fun，N-44=math-farm 竖式，N-45=gold-hook 商店（r10）。**本轮新伤从 N-52 起。**
> 主力抽测：r9/r10 没量过的 **商店/失败后再玩**、**双人 915 未测款**、**其它 `isXxxLevel`**、**开关态**。主档 **915×412**。`src/**` 一行未动。
>
> **R3 学习员补测计划（不覆盖上文 N-52…N-57，不改 r9/r10 文件）**：派发写从 N-48 起，树上 r11 已用到 N-57，本补测从 **N-58** 续编。避开 color-fun 关型、竖式、金钩商店、sky-squad、模式芯片。抓手：未抽过的 1.3 窗口 id、双人分屏剩余款、结算后再玩循环；N-31 关内若仍伤只复证不换号。对账 A/B 第 10 轮 `928aa663`/`d8697ac3`。工装 `/tmp/trio-r11-*`。零改 `src/**`。

## 一、抽验方式（可复现）

- 独立 clone 于 `0a8c0344`：`npm run build && npx vite preview --port 4180`（不碰工作区 :4173）。
- headless Chrome + puppeteer-core；脚本/截图 `/tmp/trio-r11-audit.mjs` `/tmp/r11-shots/` `/tmp/r11-audit.json` **不进库**。
- 量法同 r4–r10：`.game-stage` 裁切；折叠线下（`rect.top ≥ 视口高`）；canvas 出屏；自滚；veil/弹窗内按钮；另扫 **h<44** 热区。
- **工装**：每一案独立 `browser.createBrowserContext()`；`localStorage` 只在同源页（`#/game/...`）上 `clear`/种种子——`about:blank` 上读 storage 会 `SecurityError`（本轮第一遍全红，修好才出数）。
- 进度路：`yiduo-yixing.l99.<id> = Array(N).fill(1)` 再点 `.l99-continue`，默认 **不开 root**。root 加重档单独 context。

## 二、对账：哪些 N 已在 `src` 落地（✅/❌）

对照 `0a8c0344` 源码 + 本轮 915×412 抽测。已合入的 **不要重做**。

### 壳 / 学习（多属 A）

| # | 状态 | 证据 |
| --- | --- | --- |
| S-1 / S-2 / S-3 / S-4（l99 `.l99-jump-input` 44） | ✅ | `d451c32d`；r9 浏览器复证 |
| S-4 扩容 `.qz-jump-input` | ❌ | `quiz99.ts:153` 仍 `min-height:38px`；本轮 root×拼音 135 量到直达框 **38×76**、直达钮高 **32** |
| N-24 | ✅ | 并入 S-1 |
| L-1 答题紧凑 + find-diff 并排 | ✅ | quiz99 `@media (max-height:500px)`；color-fun **改走 N-43**，不要再打整条 L-1 |
| L-2 clock-house 两代钟 | ✅ | `faceLift.ts` + `runner.ts` `mountFaceLift` 在主干；勿再改 `clockSVG` 题库串 |
| L-3 find-diff 贴纸 4–10 章 | ❌ | `boardArt.ts` 头注仍写第 4–10 章挂轮 |
| C-1 / N-28 `[hidden]` | ✅ | 四款 + `modebarHidden.guard.test.ts`（全库一份） |
| 竞技场留白 / garden-guard 小章图 | ✅ | r6-A |
| N-33 结算 `.dialog-buttons` sticky | ✅ | `styles.css` + `dialogSticky.r9.test.ts` |
| N-38 永久直达文案 | ✅ | `rootJumpNote` → `isRootPermanent` / `rootStatusLine` |
| 收藏册 40/36→44 | ✅ | `collection.ts` + `collectionHit.r9.test.ts` |
| N-37 root 抬头 | ✅ | `:has(.l99-jump)` 矮屏规则；本轮 **root×拼音 135**：crop 6、票不在折叠线下（r9 加重档 294/票 top 608 **已消**）。残余只剩 S-4 扩容那 38px 框 |
| N-34 / N-35 拼音拼写/全选 | ✅ | 本轮拼写关 101：crop 6、折叠 0 |
| N-36 描红 pad | ✅ | 本轮描红 102：crop 0、折叠 0 |
| N-30 古堡 `advk-shell` | ✅ | `castleShell.r9.test.ts` |
| N-39 蓝本 `showMap(true)` | ❌ | 初次 `showMap()`（`:1100`）、过关/失败「回地图」（`:993/:1024`）、关内「选关」（`:1053`）仍默认 false。切章 `:866` **保持 false**。本轮 hop-pads 首图 `.l99-node-cur` **426–502 整格线下**，与 r9 逐位 |
| N-43 color-fun 七关型 | ❌ | `clf-scrolly` 仍把色盘卷进自滚；r10 数字有效 |
| N-44 math-farm 竖式 | ❌ | 紧凑档仍只钳 `.qz-prompt svg/img`，竖式 DOM 插图不走该选择器 |
| N-16 走廊三态 | ❌ | `ak-pad` 无古堡那套 grid；A r9 书面留下 |

### 休闲对战动手（多属 B）

| # | 状态 | 证据 |
| --- | --- | --- |
| N-25 格斗塔壳 | ✅ | `showTower` 折叠出战；`shell.r9.test.ts` |
| N-31 训练场 **关内**触屏键 | ✅ / 残余见 N-57 | 本轮滚到「开打」后进场：八键 top 294–344 **在屏**。选人壳「开打 ▶」自身仍线下 → **N-57** |
| N-1 fruit-catch 画布钳高 | ✅ | `canvasDisplayCapPx`；双人抢果 915 crop 73、折叠 0（观察，不新开号） |
| N-32 无尽战斗 sticky | ✅ | `.bvp-endless-fight` |
| N-26 + C-9 dvs | ✅ | 矮横屏双栏 + `.dvs-back` min-height 40 |
| N-27 dot-maze 四模式 | ✅ | `landscape.r9.test.ts` |
| N-29 + N-23 补充 | ✅ | `ba-canvas` 钳高 + 三款 `scrollIntoView({block:"center"})` |
| N-40 duo-rush `.dr-btns` | ❌ | 仍普通纵向 flex，无 sticky |
| N-41 mahjong `.mj-tile` 宽 34 | ❌ | `width:34px` 原样 |
| N-42 puff `.pfb-btn` padding 5px | ❌ | 无 44 地板 |
| N-45 gold-hook 商店 veil | ❌ | 本轮复证：**第三件 buy top 416、接着挖 top 513、veil 内滚 230**，与 r10 逐位 |
| N-10 棋类三款 | ❌ | r9 补测数字仍开；本轮未复量 |
| N-13 fruit-stack / N-14 bumper | ❌ | bumper 本轮对战：crop 226、出屏 56、暂停 **31×60**、回选关 **30**，与 r9 同账 |
| N-15 bomb-buddies 915 双人 | ❌ | r10 已量六键线下；本轮未复量 |
| N-17 prince 六键 | ❌ | 教学关 0 与 Boss 关 27 **同一刀**：crop 185、六键 top 467+，关型差不改变布局 |
| N-2 / N-3 / N-4 回合必点 | ❌ | 主干无配方 E 落地痕迹 |
| C-2…C-7 / C-8 ice-fire | ❌ | brick-break 无余量钳高；C-8 未动 |
| `casual-duo-fit-r5-b-4683` | 未合入 | 仍按 r9/r10 撞车说明 rebase；守门只留 `modebarHidden.guard.test.ts` |

## 三、新抽验结论（915×412）

**干净、本轮结案（下轮不要再量）**：

- **失败后再玩（quiz 族）**：clock-house 点错只标 `.qz-wrong`，关不结束、无 `.l99-overlay`；选项 top 307 在屏。再点对/错都还在同一屏。壳层结算仍走已合的 N-33，不必为「失败后再玩」新开号。
- **combo-clash 双人同屏 / 训练场开打后**：crop ≤3、折叠 0。
- **fight-king 训练场关内**（能点到开打之后）：触屏八键在屏。N-31 关内验收过。
- **pinyin 拼写 101 / word-garden 描红 102 / N-37×限时 135 root**：见上表 ✅。
- **sky-squad Boss 23 / monster-crisis Boss 23**：折叠 0，与首关同族轻裁，不单独立项。
- **garden-guard 关内 1×/2×**：crop 0，r10 结案仍成立。

**新发现（N-52 起）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-52 | **duo-arena** 从未量过的 915：菜单 CTA + 开打后下半场 | 菜单：「开擂 ▶」top **527**、「怎么玩」top **471** 整钮线下，crop 199。开打后：**上半场**方向/抓/技能在屏（226–301）；**下半场整套** 419–494 线下；暂停/规则/退出擂台 top **549** 线下。菜单账 ≠ 对局账（同 N-40） | 🔧 配方 L + C-8 分屏 |
| N-53 | **tank-battle 双人对战** | 两套 D-pad+开火 **top 607–656 全线下**；画布出屏 **113**；`.tkb-root` 自滚 307。暂停 **32×109**、回选关 **33**、地图/陪练芯片 **32** | 🔧 配方 G + 热区 |
| N-54 | **hop-pads 双人同屏**（单人关内 r9 已绿） | crop **261**、画布底出屏 **208**、折叠钮 0——手势面出屏，滚不到（`touch-action` 舞台） | 🔧 配方 B/F |
| N-55 | **snow-fight 双人对战** | 十二键（两人各 6）top **481–531 全线下**，crop 191 | 🔧 配方 G |
| N-56 | **sky-squad 双人合作** 开关+摇杆热区 | 折叠 0、玩法在屏，但暂停 **33**、判定点/手指上方开关 **31**、摇杆 **36×36** | 🔧 热区（勿重钳已在屏的画布） |
| N-57 | **fight-king 训练场选人壳「开打 ▶」** | 不滚时「开打」top **531**、假人三钮 top **447** 且高 **38**。N-31 没覆盖这层；用脚本 `scrollIntoView` 后关内已绿 | 🔧 一行级壳，配方 L |

**观察（不立项）**：

- fruit-catch 双人抢果 crop 73、回地图 34px——N-1 钳高后轻伤，修热区时顺手。
- monster-crisis 双人合作 crop 141、折叠 0。
- music-stars 音量芯片 top 428：r10 观察仍在。
- sudoku 第 1 关盘+数字键线下 crop 401：历轮盘面账，不新开号。
- brave-path 备战「买」长列表 crop 1860、买钮高 **40**：r10/r7 已定性浏览面；40px 可跟 N-32 同 PR 顺手抬到 44，不单开号。
- alien-seek 推理关 121：工具+D-pad 全线下 crop 608 → **并进仍开的 C-6**，验收矩阵补「`isDeduceLevel` 关」。
- prince 教学关 = Boss 关同一套六键线下 → 仍 **N-17**，`isTeachLevel` / `isBossLevel` 不另立。

## 四、系统性模式提炼

r4 A–C、r5 D–F、r6 G/H、r8 I/J、r9 K/L 仍有效。**不新开字母**。

### 配方 L 补笔 · 分屏双人要量「另一半」

- duo-arena 上半场全绿会被判可玩，下半场+暂停整排在 412 线下——和 N-40「手势在屏、工具条不在」同构，只是第二套垫在纵轴更底下。
- **验收**：915×412 不滚能点到 **两套** 垫和暂停；菜单「开擂」单独一档。

### 配方 H 补笔 · `isXxxLevel` 若只换数据不换壳，别新开号

- prince 教学/Boss、sky/monster Boss：壳同一套，数字几乎一样。
- 例外：alien-seek 推理关 **多一排工具**，把 C-6 从「找物」加重到工具+D-pad 全没——验收要含 `isDeduceLevel` 样本（进度格 **121**，ch6 idx 2）。

### 配方 I 补笔 · 失败后再玩 ≠ 过关结算

- quiz 点错不弹 `.l99-overlay`，还在题面；「再试本关」只在 **整关失败** 路径。抽测失败面先确认有没有 overlay，没有就不要用 N-33 口径去套。

## 五、skills 可执行修法（只记增量）

| skill | 可执行修法 | 落点 |
| --- | --- | --- |
| `frontend-design` | 菜单第一屏必须露出那一个开打 CTA（「开擂 ▶」）；页脚规则链到 471 等于没有主按钮。把规则收进次级、开打钉在 412 内，或矮横屏双栏（预览左、开打右） | N-52 菜单 |
| `frontend-design` | 分屏第二套操作是主操作不是装饰；「读的滚、按的钉」：下半场垫 sticky 或左右分栏，暂停跟垫走 | N-52 对局 / N-55 |
| `canvas-design` | 「nothing falls off the page」：hop-pads 双人上下两块画布合计超 412，钳的是 **每块** 高 `floor((stagePlayRoom.h − 工具条)/2)`，不要只钳单人舞台 | N-54 |
| `theme-factory` | 矮屏压缩不得砸 44px：tank 暂停 32、sky 开关 31、fk 选人假人钮 38、qz-jump 38。主题色可以收，几何地板不能跟走 | N-53 / N-56 / N-57 / S-4 |
| `frontend-design` | 训练场「开打」与关内键排是两屏：N-31 只修了第二屏。选人壳同样走 sticky 底或并排假人+开打 | N-57 |

## 六、已收口（下一轮不要重复做）

1. 第二节所有 ✅。
2. quiz 失败不弹层、combo-clash 双人/训练关内、fk 训练关内垫、拼写/描红、N-37×135、garden-guard 速度条、Boss 关 sky/monster 与首关同壳。
3. r9 攻略 sheet、r10 shape 作图/kitty/math 第 1 关/双人竖屏五款——继续有效。
4. 不要把 `casual-duo-fit-r5-b-4683` 当主干已合。

## 七、下一轮 A/B 最该先做（与 r11 playbook 一致）

1. **N-39** `showMap(true)` 四处（切章保持 false）；hop-pads 首图验收。
2. **N-52** duo-arena 开擂 + 下半场（B，从未量过）。
3. **N-53** tank 双人对战双垫（B）。
4. **N-55** snow-fight 双人十二键（B）。
5. **N-54** hop-pads 双人画布（B；单人勿回退）。
6. **N-43 / N-44 / N-45**（r10 仍开，A/B 按目录）。
7. **N-40 / N-41 / N-42**（r9 补测仍开）。
8. **N-57** 训练场选人开打（B，勿重改已绿的关内垫）。
9. S-4 `.qz-jump-input` 38→44 + N-37 直达钮高 32 顺手（A）。
10. N-16 走廊；L-3 贴纸；C-6 补推理关 121；N-10/13/14/C-8 仍开。

---

## 八、R3 学习员换面补测（主档 915×412；`game-1.3` 已含 A/B 第 10 轮）

> 基线 commit `63b7beae`。preview `:4182`（`npx vite build`，`tsc` 见 N-36 回归）+ puppeteer-core + `/usr/local/bin/google-chrome`。工装 `/tmp/trio-r11-measure.mjs` `/tmp/trio-r11-shots/` **不进库**。每档独立 context。
> 进场水位：`npm test` **1122 文件 / 19354 用例**，其中 **3 红**（均为 5s 超时：`snake-royale/ai.test.ts`「隔一档打…」及同文件另一档次对局；未为变绿改测试）。相对 r10 的 1109/19330 = A/B r10 测试入账。
> 派发写「N-48 起」：树上 r11 已用 **N-52…N-57**，r10 占用 **N-46/N-47**，本补测从 **N-58** 续编。不改 r9/r10 文件，不覆盖上文 N-52…N-57 表。
> `git diff` 证明 **零改 `src/**`**。避开 color-fun 关型、竖式、金钩商店、sky-squad、模式芯片。

### 8.1 对账更正（第二节写于 A/B 第 10 轮合入前，以主干+本轮浏览器为准）

| # | 第二节曾写 | R3 判定 |
| --- | --- | --- |
| **N-39** | ❌ | **✅** `showMap(true)` 初次 `:1130` + 回地图三处；hop-pads `.l99-node-cur` **201–277 在屏** |
| **S-4 `.qz-jump-input`** | ❌ 38 | **✅** `min-height:44px` |
| **N-16** | ❌ | **✅** `.ak-pad{position:sticky;bottom:0}` + `corridorFit.test.ts` |
| **L-3** | ❌ | **✅** `boardArt.ts` 头注「第 1–10 章图集已配齐」 |
| **N-40** | ❌ | **✅** `.dr-btns` 矮屏 sticky；本轮赛道 crop 110、工具条折叠线下 **0** |
| **N-41** | ❌ | **✅** `.mj-tile` `min-width/height:44` |
| **N-42** | ❌ | **✅** `.pfb-btn` `min-height:${TOUCH_MIN}`；本轮双人 crop 35、折叠 0 |
| **N-2/N-3/N-4** | ❌ 无配方 E | B `d8697ac3` **源码已合**，但本轮 915 **仍伤** → **仍开同一号**，勿当未做去写第二套，先复测再补 |
| **N-36** | ✅ 描红布局 | **编译回归**：`tracing.ts` 调用 `applyPadRoom()` 但函数未定义，`tsc --noEmit` 红。布局验收仍绿，**不换号**，A 补回函数或改回 `padSidePx` 接线 |
| **N-31 关内** | ✅ | 复证：`scrollIntoView` 后开打进场，折叠键 0、画布 `offBottom 0`。选人壳仍 **N-57**（开打 top 531、假人 38px） |
| **L-2 / N-33 / N-38** | ✅ | 维持 |

### 8.2 本抓手干净（下轮不要再量这些 id 的这一态）

- **ocean-munch / fishing-star / dark-chess 关内**：crop ≤6，折叠 0。
- **tap-tiles 关内**：crop 66、画布不出屏、折叠 0（与 r6 贴线观察同级，不立项）。
- **snake-royale 双人同屏**：crop 0、两画布不出屏（回选关 30px 观察）。
- **red-blue-tug 同屏**：crop 96、折叠 0。
- **puff-bros 双人**：crop 35、折叠 0（N-42 热区源码已抬）。
- **hop-pads 地图聚焦**：见 N-39 ✅。
- **duo-rush 赛道工具条**：见 N-40 ✅。
- fruit-slice 本轮未打出结算弹窗（局未结束）；quiz 族失败后再玩仍走 §三口径，不新开号。

### 8.3 旧号复证（不换号）

| # | 对象 | 本轮 915×412 |
| --- | --- | --- |
| N-2 | flight-chess | crop 585；掷骰子/暂停 top **525–527**；飞机选择 683 |
| N-3 | star-estate | crop 435；地格 22×22 整排 top **448** |
| N-4 | hero-cards | crop 366；手牌 420 切半；确定/取消/结束回合 top **511** |
| N-12 | pool-stars | crop 340；蓄力击球 425、暂停 482（r5 原账） |
| N-9 族 | sudoku-petal **双人** | crop 491；数字键 394 切半、铅笔/擦掉 452 线下（单人盘面账，不新开号） |
| C-2 | brick-break | crop 172、折叠 0（裁切仍开） |
| C-5 | mole-pop | crop 550；洞 top 438 |
| C-7 | match-stars | crop 577；第 5 行格 378 切底 |
| C-8 | puzzle-tiles / balloon-pop / orb-arena 闯关技能 | 拼图裁 628 下排 514；气球 256/458；技能钮 436 |
| C-8 | ice-fire-forest | crop 182；仅 **▼** top 375 切底（18 控账减轻，仍开） |
| N-57 | fk 选人壳 | 开打 531 / 假人 447 / 38px，与原文逐位 |
| N-18 | box-hamster 关内 | crop 208；撤销/重来 **40px** |
| N-1 | fruit-catch 双人 | crop **199**（r11 曾观察 73，加重，验收别只拿竖屏） |

### 8.4 新发现（N-58）

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-58 | **merge-2048 关内四向键切底**（r6 写「crop 84、无折叠线下」已过期） | 四键 `.mg-btn` top **392** h=46 → bottom 438 切出 26px，crop 仍 84 | 🔧 配方 G：键排 sticky 底或再让盘面；勿动合并规则 |

**未单列**：candy-swing / sling-birds 本轮停在自建地图（continue 未进关），锁格 435 线下属长地图，N-23 聚焦合入后仍应用 `scrollIntoView` 复验，不新开号。orb-arena 双人 crop 335 归 C-4/竞技场钳高残余。

### 8.5 skills

`frontend-design`：回合必点（N-2 掷骰）B 已合配方 E 仍 525 线下——验收必须 915 真机，不能只靠源码断言。`canvas-design`：merge-2048 盘面贴线时四键是主操作不是装饰。
