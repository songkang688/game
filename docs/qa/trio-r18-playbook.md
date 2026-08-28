# 三人组第 18 轮 · 测试修复员 A/B 任务清单（playbook · UX-99）

> 依据：`trio-r18-learn-notes.md`。基线 `origin/game-1.3 = c8a3d154`。
> **禁止重做（已合 N 号）**：N-47/63/68/73/77、C-6、N-37、N-75…N-88、N-86、N-69…74、**N-89**（壳标题 `10022068`）、N-40 赛道 sticky、N-32 无尽战斗三钮、`OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、`casualFit.r10b` 新断言（`dcfacba0`）。
> **本轮由学习员实测已可直接结案（只落回归数字，禁止再修）**：N-60 / N-61 / N-62 / N-90 / N-91——N-89 收壳后 915 全部进 412（键 288–334、tap-tiles crop 0、frc-canvas 194–354）。**给这批加第二套垫 = 打回**。
> **不覆盖** r14…r17 笔记原文。撞车取先合进 `game-1.3` 的版本。
> 本工位新伤 **N-98 / N-99**；r17 遗留 **N-94…N-97** 一并在此派发。

## A / B 独占（防撞车，动了对方文件 = 打回）

| 工位 | 独占文件 | 本轮任务号 |
| --- | --- | --- |
| **A**（壳+闯关学习） | `src/styles.css`、`src/ui/**`、`src/games/{level99*,quiz99*,word-garden,pinyin-train,clock-house,find-diff,math-farm,shape-kingdom,sudoku-petal}/**` | **N-97**（math-farm root×深关）、**N-99**（sudoku-petal，新）+ A 面结案回归落账 |
| **B**（休闲对战动手） | `src/games/{hue-hand,pool-stars,star-estate,snow-fight,balloon-pop,weiqi-garden,duo-vs-star,xiangqi,bomb-buddies,fight-king,duo-rush,fruit-catch}/**` | **N-98**（hue-hand，新）、**N-94/N-95/N-96**（r17 遗留）、旧号 N-12/N-3/N-55/C-8 + B 面结案回归落账 |

彼此不碰对方目录；公共 `src/engine/**`、`src/art/kit/**` 谁都不动（kit 只 import）。

## 红线（一字不差）

- 不改存档 key / `meta.id` / 题库 / seed / 胜负判定。测试只增不减，每条修复配小测试。
- **管理员密码 `kangkang` 全解锁**：默认 **1 小时**，密码门里可改 30 分钟 / 4 小时 / **永久**；密码不落盘（只存 `{expiresAt, mode}`）。量 root 态可直接种 `yiduo-yixing.root.v1 = {"expiresAt":253370764800000,"mode":"permanent"}`。
- 视口两档都要绿：**手机竖屏 390×844 必须能划到底**（键排允许在滚动流里，但必须滚得到）；**平板/手机横屏 915×412 关卡地图与按钮不得裁切**（1024×768 抽验地图观感）。
- **控件别太小**：修复后的可点热区 **≥ 44px**（本轮实测全库已达标，别开倒车）。
- 验收 915×412 `getBoundingClientRect`，每条留 top/bottom 数字。开/关、root 每档独立 context。
- 收尾：`git fetch origin game-1.3` → rebase → `npm test` && `npm run build` 全绿（水位 ≥ **1182 files / 19477 tests**，进场以主干最新实测为准）→ 禁 force，`git push origin HEAD:game-1.3` 或开 PR 指向 `game-1.3`。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`，每案独立 context。
- 进游戏：`#/game/<id>`；闯关点 `.l99-node-cur`；量前如需解锁种 root 永久档即可（勿走 UI 连点）。
- sticky 失效先量裁切祖先（overflow-y + scrollHeight/clientHeight），再决定 fixed / 收内容，不要盲加第二套键排。

---

## 壳层 + 闯关学习（A）

### N-99 sudoku-petal 数独花田盘底两行滚不到 🔧（新；本轮最重的 A 项）

- 复现：915×412 → `#/game/sudoku-petal` → 点 `.l99-node-cur` 进第 1 关。
- 实测：盘格两排 **391–447 / 448–504** 线下；`.sp-wrap` overflow-y:hidden 且 scrollHeight 446 > clientHeight 178，**滚不到**；数字键 `.sp-pad` 340–384 在屏（别动它）。
- 修法建议：矮横屏（`max-height:500px` 档已存在，449 行起）按可视余量钳格子尺寸——照 N-68 `miniCellPxRow` / N-63 `mapClampPx` 的纯函数配方；或该档把 `.sp-wrap` 改 `overflow:auto` 内滚。**题库/seed/判定零触碰**；390×844 已绿（pad 722–768 IN），别回退。
- 验收：915 盘 81 格全部可见或可滚到，`.sp-pad`/`.sp-tools` 仍 ≤412、热区 ≥44；390 复测 fold 0。

### N-97 math-farm root×深关选项 🔧（r17 遗留）

- 云学习员实测：末章末关选项 top **416**。收农田行高；L1 勿动；题库零触碰。验收：root 永久档 + 末关选项 bottom ≤ 412。

### A 面结案落账（只写数字，不改码）

- N-60/61/62/N-90/N-91 在 A 交卷报告里登记本轮 915 回归数字（学习员数字可引用，若重测以重测为准）。N-63/N-77/N-68/N-73/C-6/N-37/N-16/S-1…S-4 ✅ 只许回归。

---

## 休闲对战动手（B）

### N-98 hue-hand 花色接龙三键线下 🔧（新；唯一 CTA 出屏）

- 复现：915×412 → `#/game/hue-hand` → 点「开始」进对局。
- 实测：「🎴 抽牌 / ✅ 出牌 / ⏸ 暂停」top **422–466** 全线下；`.hh-btns` 已是 sticky（源码 317 行 `@media (max-height:500px)` 档），但裁切祖先 `.l99-host` overflow-y:hidden（668>334）令 sticky 失效——**N-75 麻将手牌同病**。
- 修法建议：照 N-75 配方，矮横屏把 `.hh-btns` 改 **`position:fixed` 钉视口底**（补左右定位与背景垫），或收 `.hh-table`/手牌区高度让 `.hh-wrap`（596 高）进 334 余量。勿改牌序/规则/出牌动画时长。
- 验收：915 三键 bottom ≤ 412、热区 ≥44；390×844 三键 713–757 已绿不许回退。

### N-95 xiangqi 自由对战设置屏 🔧（r17 遗留；最重）

- 「开始下棋」top **713**，overflow hidden 滚不到。收进 412 或该屏独立卷轴 + CTA 钉底。注意：**残局学堂已绿**（`.l99-view` 可滚、当前课 218–298 IN），别误伤。

### N-94 duo-vs-star 双人选人「开打 ▶」🔧（r17 遗留；≠ N-88）

- top **451**。照 N-88 选人壳 sticky 配方钉进 412；芯片 h30 抬到 44。

### N-96 bomb-buddies 双人棋盘 🔧（r17 遗留）

- 画布底 **475** 出屏 63px。钳显示高；三键已在屏勿动。

### N-12 pool-stars 🔧（旧号；两档视口一起修）

- 915：力度条 **519–563**、蓄力击球 **570–620**、暂停 **627–671** 线下，canvas 切 100。**390×844 也坏**：击球 **884–934**、暂停 **941–985** 线下。
- 修法：补 `max-height` 媒体（源码现在一条都没有）——canvas 显示高按余量钳 + `.ps-bars`/击球/暂停钉底。**两档视口都要留验收数字**。勿改台面物理/球速。

### N-3 star-estate 🔧（旧号；两档视口一起修）

- 915：棋盘 **343–516** 切 104、24 格线下、骰子切 2。390：掷骰/购买 **808–854**、结束回合 **862–908** 线下。
- 只动棋盘显示高与操作行钉底；**勿把 `max-height:min(156px,38dvh)` 再砍小**（地格 13px 已在下限）。

### N-55 snow-fight 对战十二键 🔧（旧号；只差 16px）

- 第二排键 **382–428** 底切 16。`data-duo` 排收一档 gap/padding 即可；**禁止**重写键排或动闯关 N-85。

### C-8 balloon-pop 闯关天空 🔧（旧号）

- `.blp-sky` 178–598 底切 **186**，两颗可点气球线下。只钳 CSS 显示高（`max-height` ≈ 412 − 壳），**禁止改 `logic.ts` 的 `SKY_H=420`**（walkthrough 钉死上升时间）。

### N-10 weiqi-garden 残余 🟡（可降级）

- 工具行已随 N-89 进 412（**284–336 IN**）；残余 canvas 底切 **31**。余力再收 `.wq-scroll` 一档，没余力书面降级（盘可滚、工具可点，不挡玩）。

### B 面结案落账

- N-60/61/62/N-90/N-91 的 B 侧口径同 A：只登记回归数字。N-87/88/86/75–85 ✅ 只许回归；赛道 `.dr-btns` sticky 禁止回退。

---

## 收口要求（本轮是战役收口轮）

1. 新伤 N-98/N-99 与遗留 N-94…N-97：修掉或**书面降级**（写清「病灶 + 为何不修 + 复现数字」进各自交卷报告），不许静默漏项。
2. 旧号 N-12/N-3/N-55/C-8/N-10：同上，做或书面降级。
3. 干净清单（学习员已量，下轮不必再测）：landlord-cards 915、暂停覆盖层、root×bowling 直达条（27–71 h44 + 永久文案）、root×xiangqi 残局学堂、bowling 1024×768 地图、hue-hand/sudoku 390 竖屏。
4. 每条修复：915 前后数字 + 小测试；`npm test`/`npm run build` 只增不减。
5. 交卷报告写 `docs/qa/trio-r18-tester-A.md` / `trio-r18-tester-B.md`（新文件，勿覆盖他人）。

---

# 附录 · 第二学习员补充派单（N-100…N-105；与上文同轮，优先级并入）

> 依据本文件同名笔记的「附录」段（分支 `cursor/trio-r18-learner-c337`，基线 `e58ccceb` 实测）。
> 撞号已让位先合版；以下全部是上文没有的**新伤**。独占面在上表基础上**追加**：
> A 追加 `src/games/level99.ts`（N-100）；B 追加 `src/games/{combo-clash,mahjong-bloom,bumper-cars,ice-fire-forest,landlord-cards}/**`（N-101…N-105）。

## B 第零优先 · N-105 主干红灯抢修 🔧（先于一切）

- `e58ccceb` 起 `npx vitest run` 即红：**2 文件 / 5 用例**——PR #78 `81b228c2` 的 `@media (max-height:500px)` 把
  `combo-clash .cc-info`、`mahjong-bloom .mj-goal` 调到 **14px**（`.mj-goal` 还锁 nowrap），破 360px 文字 ≥16px 守门
  （`src/ui/mobileText.test.ts` 3 例 + `src/games/window1-mobile-text.test.ts` 2 例）。
- 修法：两处字号回 **16px**、`.mj-goal` 解 nowrap（高度紧就收 padding/max-height 两行截断），**不许砍/放宽守门测试**，不许回退 N-75/76 键排。
- 验收：全量 vitest 全绿（**1193 files / 19489 tests**，此为 `e58ccceb` 实测总数；上文红线里的 1182/19477 是 PR #78 合入前旧水位）+ 915×412 复量 `.cc-info`/`.mj-goal` 仍在屏。

## A · N-100 level99 进场「开始冒险 ▶」+ 工具行卷出视口顶 🔧

- 章节 tab 折多行的款，915×412 进场 `.l99-view` 被当前关 scrollIntoView 卷到 300+：word-garden `.l99-continue` **-154**、
  ice-fire-forest **-104**、xiangqi **-50**、landlord-cards **-52**、bumper-cars **-39**；root×pinyin-train「🎫 直达」**-54**。
  bowling 等 tab 单行款不触发（干净清单 27~71 IN 不矛盾）。
- 修法（选其一）：进场滚动锚定 clamp 到工具行以下 / 当前关只在 `.l99-map` 盒内居中；或 `max-height:500px` 档把
  `.l99-continue`+`.l99-tools` sticky 到 `.l99-view` 顶。**红线**：不动 `showMap(true)` 四处调用（N-39/N-63 前车）、
  模式芯片行（`.ld-open`/`.bc-open`/`.xq-mode` 实测 IN）勿动、paneH 常量勿碰。
- 验收：上述 6 款 915 进场 `.l99-continue` 与 root 直达条 top ≥ 0、当前关仍在屏；390×844（pinyin-train CTA 43~87）与
  1024×768（match-stars 162~206）不回退。

## B · N-101 duo-vs-star 赛中触屏键柱全线下 🔧（重；与 N-94 连修）

- 双人对战开打后 915×412：canvas 122~302 IN，两列 ◀▲▼▶✋💥🤝（h=46）**400~746 全 OUT**，触屏两人没法打。
- 修法参照 N-75 fixed 配方：矮横屏两列键柱放 canvas 左右（x:294~622 之外全空），或压缩键距钉进 412。**勿改** `battle.ts` 状态机/键盘映射/出招判定。
- 验收：915 十四键 bottom ≤ 412、h ≥ 44；390×844 竖屏不回退。修 N-94 时顺带把 `.dvs-pick` 30 / `.dvs-back` 40 抬到 44。

## B · N-102 bumper-cars 对战画布过小 + 触区 🔧

- 915×412 画布 **140×140**（390 竖屏同局 331×331）；`.bc-open` h=**34**、`.bc-pick` h=**32**；1024×768 两颗「🛑刹车」**741~785** 底切 17px。
- 修法：矮横屏 fit 按「可用高 − 键排」算而非按宽缩；触区 min-height 44；1024 档键排进 768。**勿改**碰撞世界尺寸/回合逻辑。
- 验收：915 画布显示边 ≥ 260px 且 IN；三视口冲撞/刹车全 IN h≥44（390 现绿 705~799 勿回退）。

## B · N-103 ice-fire-forest 闯关画布底切 59px 🔧

- 915×412 L1 主画布 **232~471**（切 59），谜题下几行看不见；键垫 253~393 IN 勿动。
- 修法：矮横屏钳画布显示高（「改显示不改世界」口径）或画布上移贴 HUD。**勿改**关卡网格数据/双人判定。
- 验收：915 canvas bottom ≤ 412；390×844 不回退。

## B · N-104 landlord-cards「◀ 回选关」触区 33px 🔧（轻，顺手）

- `.ld-back` h=**33** → min-height 44；叫分行 299~347、暂停 350~394 已绿勿动。

## 附录收口

1. B 先 N-105 修绿主干，再 N-98 / N-95 / N-94（+N-101）/ N-96，随后 N-102/N-103/N-104 与旧号，做或书面降级。
2. A 在 N-99 / N-97 之外把 N-100 修掉或书面说明；若在途 r18-A 的「选关滚动」已合类似修法，先回归再决定。
3. 完成水位以 **1193 / 19489 全绿**为底线（含 N-105 修复），只增不减。
4. 观察项（sprout-defense / ocean-munch 全 canvas 内部热区）不开号，下轮学习员带像素级抽验工装再定。

---

# 附录二 · 第三学习员补充派单（**N-106 / N-107** + 并号复证；详见笔记附录二）

> 撞号两让后从 N-106 续编；正文与附录一原文一字不动。B 独占面再追加 `src/games/{monster-crisis,fruit-stack,mole-pop,candy-swing,sling-birds,bubble-aim,hop-pads}/**`；A 无新增（本节 A 面抽验全绿）。

## 并号复证（修对应号时一并吃进验收）

- **N-105**：本工位在更晚基线 `c8a3d154` 复跑同红（1193 files / 19489 tests，5 红）——跨基线坐实，第零优先不变。
- **N-103 加深关档**：root×冰火之心 188 画布 **276~515 出屏 103**（L1 59），两套 pad「向下」行 **393~437 切 25px**。病根补：深关 root 工具行（118~162）没进高度预算。**验收必须含 root×188：pad 三行与画布 bottom ≤ 412**（root 走 UI：🔑 → `kangkang` → 1 小时 → 打开）。
- **N-104**：地主出牌阶段 `◀ 回选关` 同 h=33，一处修两态。
- 触区 <44 再加一处：bubble-aim 关内/无尽「回地图/换弹/🔄」h=**40**（修 N-29 尾款顺手抬）。

## B · N-107 fruit-stack 双人同屏六键整排线下 🔧（本节最重）

- 复现：915×412 → `#/game/fruit-stack` → 「👫 双人同屏」。朵朵/星星 ◀▶放下 `.fs-key` **522~566 全 OUT**，crop 0 滚不到；双画布 212~409 IN。
- 修法：键排照 N-75/N-101 的 fixed/sticky 钉底配方进 412（双画布可让高）；勿改合成判定/先赢局数。人机对战、无尽果盆同壳顺手复测。
- 验收：915 六键 bottom ≤ 412、h ≥ 44；390×844 不回退。

## B · N-106 monster-crisis 双人合作摇杆/甩弹切底 🔧

- 复现：915×412 → `#/game/monster-crisis` → 「🤝 双人合作」。双摇杆 `.mcr-stick` **370~462**、双甩弹 `.mcr-fire` **379~453** 切底约 50px，crop 0。
- 修法：摇杆/甩弹整体抬进 412 或画布（154~360 IN）让高；技能三卡（262~400 IN）勿动；闯关（r14 绿）勿动。
- 验收：915 摇杆与甩弹 bottom ≤ 412；技能卡选层仍整卡在屏。

## B · C-5 mole-pop 地鼠洞不可达 🔧（r4 老账重挂，根因分支从未合）

- L1 九洞 **250~894**（6/9 整洞线下），root×月夜手电筒 167 **294~938**；**390×844 绿，别修反**。
- 修法：`.mp-hole{aspect-ratio:1}` 由 3 列宽驱动、无矮屏媒体——矮横屏按「余高 ÷ 3 行」反推 `.mp-board` 宽或洞径。别把 `casual-duo-fit-r5-b-4683` 整支翻出来合（会倒删 N-75+），只取思路。
- 验收：915 L1 与 root×167 九洞全部可见可点；390 竖屏不回退。

## B · N-29 族收尾 🔧（bubble-aim 已绿销账勿动）

- sling-birds：重来/选关 **368~416** 只差 4px，垫一档即结案。
- candy-swing：画布 **166~660 出屏 248**、crop 300——`.cs-canvas` 补显示高钳，勿改关卡物理。

## 附录二结案（浏览器已绿，只落回归数字，禁止再修）

- **N-29 bubble-aim 关内**（画布 126~356）、**N-54 hop-pads 双人**（双画布+热区全 IN）、**地主双人出牌阶段**（键排 299~394）、**root×pinyin 188 / root×clock 出发到达站 100 关内**（选项在屏、crop 0）、**bubble-aim 无尽墙**、**mole-pop 390 竖屏**。

## 附录二收口

1. B 顺位照附录一（N-105 第零优先），随后把 **N-107 / N-106 / C-5 / N-29 尾款**排进本轮，做或书面降级。
2. 双人款验收统一贴「键排 bottom ≤ 412」实测值（N-101/106/107 同族守则）。
