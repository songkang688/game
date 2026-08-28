# UX 优化 playbook（学习员 #3 · 技能对照版，零 src 改动）

> **第 6 轮更新**。基线：`origin/game-1.3 = e140c26b`（**N-100…N-105 已定名**：c337 学习员让位先合版、独有发现改号附录并入；`trio-supervisor-99r.md` 上树——B 第零优先 N-105 红灯、A 主攻 N-99/N-100）。
> **定位**：与 `trio-rN-learn-notes/playbook` 的逐案抽验并行，本文是「模式层」清单。**任务号以主干 r18 playbook（主文+附录）为权威**，本文叠加 U-x 模式层与竖屏首扫。
> **编号纪律**：本文条目一律用 **U-x**，不占 N 号。⚠️ 撞号仍在发生（A 自编 N-92/93/94、862b 的 r19 改号 N-103…N-107 又撞主干），动手前必看 **§3.0 消歧表**；新伤一律只记「文件+数字」待统编。
> ⚠️ **U 号撞车**：并行学习员 `docs/ux-iteration-playbook.md`（在途）的 U-1…U-6 与本文定义不同。消歧：先合版为准；引用对方写「**迭代U-x**」，本文写「U-x」。#1（A）领 U-101…，#2（B）领 U-201…。
> **对账纪律**：动手前 `git log --oneline -20` + 查对应 `*.test.ts`；**红灯修复已堆到五路重复、数独三路、模式键三路**（见 §3.0）——先合版生效，其余 rebase 丢弃。
> **视口口径（父监督红线）**：主测 = 手机竖屏 **390×844**（必须能划到底）+ 平板横屏 **915×412**（地图/按钮不裁切）；切底伤加测 **1024×768**。管理员密码 `kangkang`；量 root 态直接种 `yiduo-yixing.root.v1 = {"expiresAt":253370764800000,"mode":"permanent"}`。

## 一、学习来源（30 秒版）

- `.cursor/skills/1.3-visual/frontend-design`：文案=动作本身、错误给出路、质量地板（响应到手机、focus 可见、reduced-motion）。
- `theme-factory` / `canvas-design`：token 化配色、先立视觉方针再动手——对应壳层 `styles.css` 的 CSS 变量体系。
- 仓库自家最佳实践（历轮配方，**优先照抄不再发明**）：
  - **配方 B**（钳画布显示高）：量画布下方家当实高从可用高扣掉，共享工具 `src/engine/stageRoom.ts` 的 `stagePlayRoom()`；样板 dot-maze `a16caf46`。
  - **sticky 底控制排**（r5②/r6②）：操作行 `position:sticky;bottom:0` + 不透明底与上缘阴影；样板 `styles.css:3302` chess-garden `.cg-tools`。
  - **双栏横屏**（r6①）：915 宽横向余量大，D-pad/触控键挪画布左右两侧。
  - **touch-action**（r4）：根容器 `pan-y`，只有真吃拖动手势的 canvas/摇杆保留 `none`。
  - **容器内滚动**（r5 / N-63）：`scrollIntoView` 只许发生在自家滚动盒（`level99.ts` `.l99-view`），禁止卷走 `.game-stage`。
  - **弹窗按钮粘底**（配方 I / N-33）：`styles.css:972` 一带。
- **第 2 轮新教训（r18 进场红灯事故）**：r15 B `81b228c2` 在 `@media (max-height:500px)` 把 combo-clash `.cc-info`、mahjong-bloom `.mj-goal` 压到 14px 并加 `nowrap`，撞 16px 正文红线守门（`mobileText.test` ×3 + `window1-mobile-text` ×2 红），且 A/B 双双抢修**同两个文件**撞车。沉淀两条：
  - **收缩红线**：矮屏媒体查询只许收 margin/padding/装饰/隐藏小字，**禁止**把正文压到 <16px、控件 <14px、给说明文字加 `white-space:nowrap`（`level99.ts` 注释「16px 红线矮屏也算数」是项目共识）。
  - **红灯认领**：主干进场即红时，先 `git log` + 查在途分支谁已认领，报告里写「红灯由 X 修」，不双开同文件补丁。
- **双栏横屏配方已有落地样板**（r17 B 在途 `tester-b-r17-fixes-3c67`）：shoot-range「键左靶场中键右」、gomoku「盘左工具右」、prince-princess「键左画布中键右」——修 D-pad 类优先抄这套，合入后即为标准样板。
- **第 3 轮新教训（N-89 整族结案，r18 笔记 §三）**：壳层标题条一处收高（N-89）让 r16 量到的「技能键 top 394–398 贴线族」N-60/61/62/N-90/N-91 **全部进 412**，各游戏侧的「再垫一档」方案全部作废。沉淀：**修贴线族先查壳层高度预算**（顶栏/标题/stagebar），一处收壳优于十处垫游戏；结案后「加第二套垫 = 打回」。
- **第 3 轮新诊断法（r18 笔记 N-98/N-99 用法）**：sticky/滚动失效先量**裁切祖先链**——逐层看 computed `overflow-y` + `scrollHeight/clientHeight`，找到真正裁人的那层（如 `.l99-host` hidden 吃掉 sticky、`.sp-wrap` hidden 锁死盘面），再决定 fixed / 内滚 / 钳内容，不盲加第二套键排。
- **第 4 轮新结构性事实（迭代 playbook 546 处 @media 统计）**：全仓救济档集中在 `max-height:500px`（矮横屏）与 `max-width:420` 族（窄竖屏），**平板视口（768/820/1024 高）几乎不命中任何档**，吃的是桌面默认布局——凡「默认布局总高 > 舞台高」的游戏平板必切底（star-estate 即样板：1024×768 掷骰切 26 且 `.l99-view` 滚不动）。沉淀：**修切底伤时救济档要按四视口覆盖**（加档不改档，勿动 500 档已有值与守门）。
- **第 4 轮自我更正（撤回本文 U-3）**：`level99.ts:111` 已有 `mapColumns(width)`（≤320→4 / ≤420→5 / ≤560→6 / ≤760→7 / >760→8 列），渲染与 resize 都用 JS 内联覆盖 CSS 的 `repeat(5,1fr)`——第 1 轮 G-4「固定 5 列」判断**错误**，915 视口实际已是 8 列、节点宽 77–78px ≥44 ✅。U-3「加 7 列媒体查询」作废；改列数只许改 `mapColumns`，不许另写 grid。

## 二、差距表：别人做得好 vs 我们缺什么

| # | 别人做得好 | 我们现状 | 缺口 |
| --- | --- | --- | --- |
| G-1 | 安全区四边都躲（skills 质量地板；本仓 `.overlay` 已四边 `styles.css:3297`） | `.screen` 只垫顶（3288），水平 padding 是 `clamp(14px,4vw,32px)`（261 行） | 横屏刘海 inset 可达 44px+，32px 顶不住：**左右 inset 未接** |
| G-2 | 逐面回归（本仓 915×412 已刷 18 轮） | r18 学习员已交首批 390×844 对照数字：N-12/N-3 **竖屏也坏**（击球 884–934、掷骰 808–854 线下），N-98/N-99 竖屏正常 | 竖屏账已开建但只覆盖抽到的款；U-101/U-201 首扫补全 D-pad/手牌/盘类面 |
| G-3 | 修复走共享工具（`stagePlayRoom`、mobileText 常量） | 各游戏 fit CSS 手写魔法数（`min(248px,58dvh)` 式散在 20+ 文件） | 新修复不引用工具就会继续攒魔法数；**修复必须引用配方编号** |
| G-4 | 救济媒体档覆盖所有真机档位 | ~~固定 5 列~~（**第 4 轮更正**：`mapColumns` 已动态 4–8 列，l99 地图无此缺口）；真缺口是**游戏内联 CSS 的救济只写 500px 档**，平板高度带（768–1024）不命中 | 修切底伤按四视口验收（§6.2 + 迭代 playbook 1024×768/1180×820 数字）；星地产是首例 |
| G-5 | reduced-motion 全覆盖 | 壳层/styles.css 有 8 处 guard；**59 款**游戏文件带 `animation:`，仅 ~10 文件有 `prefers-reduced-motion` | 装饰动画（浮动、脉冲）大面积无 guard |
| G-6 | 色彩 token 单一来源 | 壳层用 `--ink/--ink-soft` 等变量；游戏内联 CSS 各自硬编码粉彩 hex | 仅列为「触碰该文件时顺手」项，不专开 PR |

## 三、P0 可玩性 / 滚动 / 过小

### 3.0 号池消歧表（第 6 轮，动手前必读）

**权威序（主干 `e140c26b`）**：N-94…N-97 = duo-vs-star 选人开打 / xiangqi 设置屏 / bomb-buddies 画布 / math-farm 深关；N-98 = hue-hand 三键；N-99 = sudoku-petal 盘面；**N-100 = l99 进场卷顶（A）；N-101 = dvs 赛中键柱（B 重）；N-102 = bumper-cars 画布+触区（B）；N-103 = ice-fire 画布切 59（B）；N-104 = landlord 回选关 h33（B 轻）；N-105 = 主干红灯（B 第零优先）**。撞号者合入时必须改号（先例两次：c8a3d154、e140c26b）。

| 在途出处 | 其自编号 | 内容 | 消歧结论 |
| --- | --- | --- | --- |
| #1 A `980945e8`/`4970d8ef`/`c2a21b4c` | N-92 / N-93 / N-94 | root 管理员行 / 密码门收屏 / 挑拣车厢 fitQuizHost 钳高 | 前两个占弃用号可先合定名；**「N-94」撞主干（dvs 选人）**，合入须改号或写明「（挑拣车厢）」 |
| 学习员 862b `c33650c1`（r19 笔记） | N-103…N-107 | 选关地图 UX 族（页签堆高/136px/pan-y/视觉/mapColumns） | **改号后仍撞主干 N-103…N-105**，再让位：预期落 N-106+；内容已收 §3.1/§五（标〔862b〕） |
| 红灯（=N-105） | — | combo/mahjong 14px+nowrap | **五路重复在途**：`46b26d1e`/`18c63e9d`/`9124d56b`/4e78/b255——先合版生效，其余全弃 |
| sudoku 盘面（=N-99） | — | 5c27 被派 / 4e78「数独内部滚动」/ b255「sudoku 模式条收一行」 | **三路踩同款**：修盘面滚动的先合版生效；b255 的模式条是另一伤面可共存，合并时人工核对选择器 |
| l99 进场卷顶（=N-100） | — | 5c27 被派 / b255「当前关可见时不再误滚地图」 | **两路踩同款**：先合版生效 |
| 模式键 44px（=N-102 芯片/迭代U-2） | — | tester2-9ad5 `51f8fcc6` 已修 bumper-cars/fruit-catch/memory-cards/sky-squad 四款 | 与迭代U-2 三款清单重叠：**9ad5 若先合，迭代U-2 只剩 balloon-pop/duo-rush 复测** |
| #2 B `1c93b984` vs r17B `3c67` | N-81 / N-55 | B=fixed 钉底；3c67=两列/一行 | 同伤双方案在途，先合版生效 |
| tester2-9ad5 `7a4f732e` | — | l99 胜负弹层矮横屏按钮进屏（safe center+可滚+z30）+ 320px 弹窗不出右界 | 新伤新修一体，在途；与 N-33/配方 I 弹窗账相邻，合入后回归结算弹窗 |
| 4e78 `6f971780` | — | l99 钳高只限地图态、舞台可竖滚；连连看/数独内滚；搜索框藏原生双叉 | **大杂烩单**：与 N-99/N-100 部分重叠，合并时按伤拆账 |

### 3.1 号池现状（任务归属与独占文件以 `trio-r18-playbook.md` 为准）

**整族结案（只落回归数字，加第二套垫 = 打回）**：N-60/61/62/N-90/N-91——N-89 收壳后 915 实测键 288–334 IN、crop 0（r18 笔记 §三）。**N-10 降级小残余**（工具行 284–336 IN，仅 canvas 底切 31，盘可滚）。
**已合只回归（禁止第二套实现）**：N-75…N-85 源码（PR #78）、N-89、N-77/N-86/N-87/N-88、C-6/N-37/N-63/N-68/N-73；N-87 守门断言（`dcfacba0`）已换钉 `.dr-menu-cta`，勿回退。

**#2（B 休闲对战）仍开**（独占：hue-hand/pool-stars/star-estate/snow-fight/balloon-pop/weiqi-garden/duo-vs-star/xiangqi/bomb-buddies/fight-king/duo-rush/fruit-catch）：

- [ ] **N-98 hue-hand 三键 422–466 全线下**（新，唯一 CTA 出屏；裁切祖先 `.l99-host` hidden 吃 sticky，与 N-75 同病：矮横屏改 fixed 钉视口底，317 行已有 500px 档；390 竖屏 713–757 IN 勿回退）
- [ ] N-95 xiangqi 自由对战设置屏 713 滚不到（阻断级；先滚动盒后钉 CTA；≠ N-67）
- [ ] N-94 duo-vs-star 开打 451、N-96 bomb-buddies 画布底 475 出屏 63（配方 B / sticky 底）
- [ ] N-12 pool-stars **两档都坏**：915 力度条 519–563/击球 570–620/暂停 627–671；390 击球 884–934/暂停 941–985（canvas 按余量钳 + 操作排钉底，一次修两档）
- [ ] N-3 star-estate **四视口一次修**（与迭代U-1 同伤合账）：915 棋盘切 104、24 地格线下；390 掷骰 808–854 且滚不动；1024×768 掷骰/购买切 26、1180×820 切 24，`.l99-view` sh==ch 滚不动。修法照迭代U-1：新增平板高度档套用 500 档同款配方（`.se-pad` sticky + `.se-board-wrap` 钳高），**勿动** 500 档现值与 `stickyPad.r10`/`viewportCap.r14` 守门、勿再砍 `min(156px,38dvh)`
- [ ] N-55 snow-fight 对战第二排 382–428 **只差 16px**（`data-duo` 排收 gap/padding 一档即进 412，禁止重写键排；与 r17 B 在途方案二选一，取先合版）
- [ ] C-8 balloon-pop 闯关 `.blp-sky` 固定 420 底切 186（只钳 CSS 显示高，**禁改 `logic.ts` SKY_H=420**）
- [ ] **迭代U-2 模式键热区 <44px**（fruit-catch「双人抢果/无尽水果雨」h=**37**、balloon-pop「无尽气球节」h=**40**、duo-rush「怎么玩/收藏册」h=**43**）：与 r18 playbook「全库已达标」矛盾——**先复测，<44 就补 `min-height:44px;box-sizing:border-box`**；先 `rg` 各款 visual/copy 守门是否断言 padding 原文；一次提交 ≤6 款防撞车
- [ ] **N-101** duo-vs-star **赛中**触屏 14 键 400–746 全线下（915；canvas 122–302 IN；≠ N-94 选人屏。触屏两人没法打，B 重，与 N-94 同目录连修）
- [ ] **N-102** bumper-cars 画布仅 **140×140**@915（390 竖屏同局 331×331）+ 模式芯片 h=34/32 <44；1024×768 刹车键 741–785 底切 17（只放大显示画布，勿改碰撞世界尺寸；芯片 44px 部分若 tester2-9ad5 先合则只回归）
- [ ] **N-103** ice-fire-forest 闯关 L1 画布底切 **59**（canvas 232–471，`.l99-stage` 滚 220/394；只钳显示高或改 fit，勿动关卡逻辑网格）
- [ ] **N-104** landlord-cards「◀ 回选关」h=**33** <44（轻；叫分/暂停行已绿勿动）
- [ ] ~~N-105 红灯~~：**勿再开**——五路重复在途（§3.0），只等先合版落地后跑守门确认转绿

**#1（A 壳+学习）仍开**（独占：styles.css/ui/level99*/quiz99*/学习款目录+sudoku-petal）：

- [ ] **N-99 sudoku-petal 盘底两行 391–504 滚不到**（新，本波 A 最重；`.sp-wrap` hidden、scrollHeight 446>178：矮档钳格子尺寸照 `miniCellPxRow`/`mapClampPx` 纯函数配方，或改 overflow:auto 内滚；390 已绿勿回退；题库/seed 零触碰）
- [ ] N-97 math-farm root×深关选项 416（root 永久档直达末章末关量；收农田行高，L1 勿动）
- [ ] N-92（root 管理员行，#1 A 在途 `980945e8`）：横屏收一行、答题区拿回 44px——**A 自己的号自己收口**，合入后在报告落 915 数字
- [ ] **迭代U-4 首页 hero 平板横屏偏肥**：1024×768 首卡 top **557**（首屏只露半行卡）。修法照迭代 playbook：styles.css 新增 `(min-width:700px) and (max-height:840px)` 档只收 hero 边距/插图，**不动** 480/500 两档（S-1 勿回退），筛选热区 ≥44 红线不变
- [ ] **N-100** l99「开始冒险 ▶」与工具行被卷出视口顶（915 进场即负 top：word-garden −154/−104、ice-fire −104、xiangqi −50、landlord −52、bumper −39；root×pinyin「直达」−54——只咬章节 tab 折 2 行以上的款；390/1024 全 IN。修法：聚焦后校正 `.l99-view` scrollTop 或改 `block:"nearest"`；N-63 的 stage 归零勿回退。⚠️ b255 分支已带「不再误滚地图」修复，先合版生效）
- [ ] 〔862b〕l99 章节页签堆高埋网格（390 宽 tabs 4 行 ≈200px；915 更致命。方案「非当前章节收 emoji 徽章」优先；**改 `.l99-tab` DOM 必须联动 `rootUnlock.ts:108` 的 textContent 重写**，否则锁标会被拍平）
- [ ] 〔862b〕`.l99-wrap` `calc(100dvh - 136px)` 常数过时（N-89 收壳后死空间 ~28px，地图首屏应 ≥2 整行）
- [ ] 〔862b〕滚动排查（A 管壳层份）：`.l99-view` 补 `touch-action:pan-y`；全仓扫「设置/选人屏 overflow:hidden 且无矮屏媒体」（N-95 同构族；B 管各游戏份）
- [ ] N-11 bowling 关内 587、N-46/N-56 残余 sky-squad 408+h42（r18 笔记未复测，仍开则修）
- [ ] A 面结案落账：N-60/61/62/N-90/N-91 回归数字写进当轮报告

### 3.2 U-1 竖屏 390×844 首扫（G-2 落地；视口从第 1 轮的 412×915 改为父口径 390×844）

- [ ] **U-101（#1）**：壳层+学习类 6 款竖屏量点：首页首屏（首卡 top ≤ 844）、l99 选关地图（`.l99-node-cur` 在可视区）、find-diff 三图关、shape-kingdom 深关选项、music-stars 视奏、clock-house。r18 A 的 390/915/360×800/768×1024 壳层走查若已交数字，只补缺口不重量。
- [ ] **U-201（#2）**：操作密集 8 款竖屏量点：box-hamster / prince-princess / tank-battle / snow-fight / shoot-range（D-pad 类，先对账 r17 B 双栏方案在竖屏的表现）、mahjong-bloom / landlord-cards（手牌类）、gomoku（盘类）。
- 量法同 r4：`getBoundingClientRect` 控制排与画布，`crop = scrollHeight − clientHeight`，折叠数；每档独立 `createBrowserContext()`。
- **红线**：竖屏下控制排必须整排可点（top+h ≤ 844）、必须能划到底（见 §六.3）、热区 ≥44px、画布不出屏；正文 ≥16px、控件字 ≥14px（`src/ui/mobileText.ts` 常量）。
- 发现新伤：只在报告里记「文件 + 数字」，勿自编 N 号（水位已到 N-97，统编归学习员）。

## 四、P1 关卡排布 / 安全区

- [ ] **U-2（#1）横屏左右安全区**：`src/styles.css:261` `.screen` 的水平 padding 改为 `max(clamp(14px,4vw,32px), env(safe-area-inset-left,0px))`（右同理，用 padding-inline 两值写法）。无 inset 浏览器 `max()` 落回原值，布局零变。验收：DevTools iPhone 横屏模拟，返回按钮/暂停钮不入刘海带；1024×768 布局零回归。
- ~~U-3（#2）l99 地图平板密度~~：**第 4 轮撤回**——`mapColumns()` 已按宽度出 4–8 列（JS 内联覆盖 CSS），915 实测 8 列、节点 77–78px，无缺口。列数需求一律改 `mapColumns` 本体，不另写 grid。
- [ ] **U-4（#1）地图当前关首屏回归**：进任一 188 关地图（bowling、hop-pads、rainbow-run 抽 3 款），`.l99-node-cur` 必须在可视区（`scrollIntoView({block:"center"})` 已做，补 915×412 与 390×844 两档数字回归即可）。
- [ ] **U-5（#2）选关格「过小」下限**：抽 3 款自带选关 UI 的游戏（candy-swing `.cs-map`、bubble-aim `.ba-map`、brave-path），量节点热区 ≥44px、星标 ≥12px；小于就按配方 B 之 3 缩列不缩格。（l99 主地图已由迭代 playbook 实测 390→59–64px、768+→77–78px 全绿，不必重量。）

## 五、P2 视觉

- [ ] **U-6（#2）reduced-motion 扫描**：`rg -l "animation:" src/games -g '!*.test.ts'` 得 59 文件，对照 `rg -l "prefers-reduced-motion"` 差集；只给**纯装饰**动画（浮动/脉冲/彩带）补 `@media (prefers-reduced-motion:reduce){...animation:none}`，与玩法判定绑定的动画不动。每款一行 guard + 一条断言。
- [ ] **U-7（#1）文案 review 红线**（frontend-design skill）：本轮所有新增/改动按钮，文案=动作本身（「继续玩」不是「确定」）；错误态必须给出路（「先玩别的吧」式）。列入 PR 自查，不单独开条。
- [ ] **U-8（两位顺手）色彩 token**：触碰某游戏 CSS 时，与壳层 `--ink/--ink-soft/--shadow-soft` 重复的 hex 顺手改引用变量；**不专开 PR、不扫全库**。
- [ ] 〔862b〕选关地图视觉升级（章节色渐变入 `.l99-map`、三星格金描边、页签选中态与首页 `.tab--active` 统一）：纯 CSS/内联 style 零逻辑；排 P1 尾，别抢 P0 空间。
- [ ] 〔862b〕`mapColumns` 按容器宽而非视口宽取列（680px 容器 @915 取 8 列偏挤）：P2，纯函数有单测，改签名同步测试；收益小可书面降级。

## 六、统一验收步骤（第 2 轮补全）

### 6.1 环境与水位

1. `npm test`、`npx tsc --noEmit` 绿；水位只增不减（r18 A 进场实测 **1193 文件 / 19489 用例**，以交卷时主干为准）。
2. `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`；每档独立 `createBrowserContext()`；工装放 `/tmp`，不进库。
3. root 档：同源 `#/game/*` 上写 `yiduo-yixing.root.v1` `{mode:"permanent"}`（或密码 `kangkang` 走门），深关用直达不写星级存档；开/关各独立 context。

### 6.2 视口矩阵（每条修复至少前两档留数字）

| 档 | 尺寸 | 必查 |
| --- | --- | --- |
| 手机竖屏（主） | **390×844** | 能划到底；CTA/控制排整排可点；画布不出屏 |
| 平板横屏（主） | **915×412** | 地图/按钮不裁切；既有 N 号口径 |
| 窄手机 | 360×800 | 文本红线（≥16/14px）、不横向溢出 |
| 平板竖屏 | 768×1024 | 卡片栅格、l99 地图列数不空旷 |
| 桌面 | 1280×800 | 零回归声明档，布局一像素不许因修复变化 |

### 6.3 滚动验收（每次修 crop 类问题必做）

- `.game-stage` 的 `crop = scrollHeight − clientHeight`：目标 0；不为 0 时必须**指内滚动可达**（`touch-action:pan-y` 在根容器、`none` 只在手势面），并且滚动发生在自家盒（`.l99-view` 式），`overscroll-behavior:contain`。
- 竖屏「划到底」：脚本 `el.scrollTo(0, el.scrollHeight)` 后量最底交互件 `getBoundingClientRect().bottom ≤ viewport.h`；被 `overflow:hidden` 锁死滚不到 = 阻断级（N-95 同款）。
- 禁止用 `scrollIntoView` 卷 `.game-stage` 结案；禁止 force click 结案。

### 6.4 关卡格 / 选关地图验收

- 节点热区 ≥44×44（`.l99-node` 与游戏自带地图 `.cs-map`/`.ba-map` 同口径）；星标 ≥12px；锁定态与可玩态肉眼可辨（不只靠颜色）。
- 进地图当前关 `.l99-node-cur` 在可视区（两主档）；章节页签可达且 ≥44px 高；竖屏地图滚到最后一章不被底部安全区盖住。
- 平板横屏若加列（U-3）：改后 `.l99-node` 实测宽仍 ≥44px，420px 以下 5 列不变。

### 6.5 安全区验收

- 顶：`.screen` padding-top 有 `env(safe-area-inset-top)`（已有，回归即可）。底：`.game-screen`/`.home-screen` 的 `env(safe-area-inset-bottom)`（已有）。
- 左右（U-2 新做）：DevTools iPhone 15 Pro 横屏模拟，返回/暂停钮不入刘海带；无 inset 浏览器 `max()` 落回原值，1280×800 截图零 diff。
- 弹窗 `.overlay` 四边已做（`styles.css:3297`），改弹窗时不许退化。

### 6.6 矮屏收缩红线（第 2 轮新增，源自 r18 进场红灯）

- 任何 `@media (max-height:*)`/`(max-width:*)` 收缩块：正文 ≥16px、控件字 ≥14px、说明文字禁 `white-space:nowrap`；空间不够收 margin/padding/装饰、藏小字、钳画布，**不碰字号红线**。
- 提交前跑 `npx vitest run src/ui/mobileText.test.ts src/qa-window2` 快查守门。

### 6.7 通用纪律

- 不改存档 key / `meta.id` / 题库 / seed / 胜负；测试只增不减；禁 force；撞车取先合版；改共享 CSS（U-2/U-3）必须首页+任一游戏+任一弹窗三张截图零回归。
- A/B 独占文件表见 `trio-r18-playbook.md`：动了对方目录 = 打回；公共 `src/engine/**`、`src/art/kit/**` 谁都不动。

### 6.8 本 trio 实测账（第 3 轮收录，验收对表用）

| 来源 | 实测 | 状态 |
| --- | --- | --- |
| #1 A `46b26d1e` | 进场水位 **1193 files / 19489 tests**（含 5 守门红）；combo `.cc-info` / mahjong `.mj-goal` 回落 16px 去 nowrap → 守门 5 红转绿 | 在途；同修复另有两路（`18c63e9d` / `9124d56b`）+ 迭代U-6 也点名，先合版生效 |
| #1 A `980945e8` | **N-92** root 开着时关内管理员行横屏收一行，答题区拿回 44px | 在途；号名冲突见头部（r18 曾弃用 N-92） |
| #2 B `a6ed4010` | brave-path 大厅矮屏 nowrap 撑爆网格轨：右列卡溢出 **1104 → 778 进屏**（`lobbyFit.ts` + `lobbyWide.r18.test.ts`） | 在途；≠ N-86 大厅模式卡，勿混账 |
| r18 学习员（已合 `8b23ab11`） | N-60/61/62/N-90/N-91 键 **288–334 IN** crop 0（结案）；N-12/N-3 两档数字、N-55 差 16px、C-8 切 186、N-98 422–466、N-99 391–504 | 主干，§3.1 已收录 |
| 迭代 playbook（在途 `1c522fb3`） | star-estate 平板 1024×768 掷骰切 26 滚不动 / 1180×820 切 24；模式键 h=37/40/43（fruit-catch/balloon-pop/duo-rush）；首页 1024×768 首卡 top 557；l99 节点宽 390→59–64、768+→77–78 全绿；N-90/N-91 四视口绿（伤只在 915） | 在途 `docs/ux-iteration-playbook.md`；引用写「迭代U-x」 |
| #1 A `4970d8ef`（第 5 轮新收） | 「N-93」管理员密码门矮横屏收进一屏，「打开」不再需在弹窗里下滚 | 在途；号名冲突见 §3.0 |
| #2 B `1c93b984`（第 5 轮新收） | N-81 无尽花园 / N-55 对战十二键照麻将配方 **fixed 钉视口底**，915 键排进 412 | 在途；与 r17B `3c67` 两列/一行方案**双开**，先合版生效 |
| 学习员 c337 `f9cd2577` | l99 continue 负 top 族；dvs 赛中 14 键；bumper 画布 140；冰火切 59；landlord h33 | **已合 `e140c26b`，定名 N-100…N-105**（§3.0） |
| 学习员 862b（r19 笔记 `c33650c1`） | 章节页签堆高；136px 常数；pan-y；地图视觉；mapColumns 容器宽（自编 N-103…N-107） | 在途，改号仍撞主干，预期再让位 N-106+ |
| #1 A `c2a21b4c`（第 6 轮新收） | 「N-94（挑拣车厢）」装不下交 fitQuizHost 钳高自滚，提交钮进屏 | 在途；号撞主干 N-94，合入须改名 |
| 另路 A `4e78 6f971780` | l99 钳高只限地图态+舞台可竖滚、连连看/数独内滚、红灯、搜索框双叉 | 在途大杂烩，与 N-99/N-100 重叠按伤拆账 |
| 另路 A `b255 3d579c22` | 390 竖屏：l99 标题条 247→116、当前关可见不误滚、舞台竖滚兜底；sudoku 模式条一行、memory-cards 44 | 在途；与 N-99/N-100 部分重叠 |
| tester2 `9ad5` | l99 胜负弹层矮横屏进屏+320 弹窗；bumper/fruit-catch/memory/sky-squad 模式键 44 | 在途；与 N-102 芯片/迭代U-2 重叠 |

## 七、第 6 轮给 #1/#2 的可勾选执行清单

任务号与独占以主干 r18 playbook（主文+附录）为权威；**动手前先读 §3.0 消歧表**（红灯×5、数独×3、误滚×2、模式键×3 都在途）。视口红线：**390×844 划到底 + 915×412 不裁切**，每条两档留数字；切底伤加测 1024×768。

**#1（A 壳+学习）**——基于 `game-1.3` 最新（≥ `e140c26b`），按序执行：

- [ ] **先交卷压箱货**（四单，越压越被撞）：红灯 `46b26d1e`（若他路已先合则 rebase 弃）→「root 管理员行」`980945e8` →「密码门」`4970d8ef` →「挑拣车厢」`c2a21b4c`（**改号**，勿用 N-94）
- [ ] **N-99 sudoku-petal**（滚动类最重）：盘底两行 391–504 滚不到 → 钳格或 `.sp-wrap` 内滚；⚠️ 4e78/b255 有重叠修复，先 `git log` 对账，已合只回归
- [ ] **N-100** l99 进场卷顶（滚动类，一处壳修六款）：§3.1 修法；⚠️ b255 有重叠，先合版生效
- [ ] N-97 math-farm 深关选项 416；迭代U-4 首页平板 hero（首卡 557→≤500，只加档）
- [ ] 〔862b〕壳层滚动排查：`.l99-view` 补 `touch-action:pan-y`；章节页签堆高与 136px 常数（改 `.l99-tab` DOM 必联动 `rootUnlock.ts:108`；862b r19 在途有同题内容，动手前对账）
- [ ] A 面结案落账：N-60/61/62/N-90/N-91 回归数字（禁再修）；N-11/N-46/N-56 复测仍开则修
- [ ] U-101 竖屏首扫（只补缺口）；U-2 横屏左右安全区（`styles.css:261`）
- [ ] 交卷：水位 ≥ 1193/19489 且 N-105 守门 5 红转绿；报告进当轮 tester-A 文件

**#2（B 休闲对战）**——基于 `game-1.3` 最新（≥ `e140c26b`），按序执行：

- [ ] **先交卷压箱货**：brave-path 大厅 `a6ed4010` + N-81/N-55 fixed 方案 `1c93b984`（与 r17B `3c67` 双开，先合版生效）
- [ ] **N-105 红灯**：勿再写第六份——对账 §3.0 五路在途，先合版落地后跑 `npx vitest run src/ui/mobileText.test.ts src/games/window1-mobile-text.test.ts` 确认转绿即可
- [ ] **滚动/CTA 出屏族（按序）**：N-98 hue-hand 三键 422–466（sticky→fixed）→ N-95 xiangqi 设置屏 713 滚不到（阻断级）→ N-94 dvs 选人开打 451 → **N-101 dvs 赛中 14 键 400–746**（与 N-94 同目录连修）→ N-96 bomb-buddies 画布 63
- [ ] **N-3 star-estate 四视口一次修**（§3.1 修法；500 档守门勿动）；N-12 pool-stars 两档修
- [ ] N-103 ice-fire 画布切 59；N-102 bumper 画布 140（芯片 44 若 9ad5 先合只回归）；N-104 landlord 回选关 h33
- [ ] 迭代U-2 模式键复测（9ad5 先合则只剩 balloon-pop/duo-rush）；C-8 只钳 `.blp-sky` 显示高
- [ ] 〔862b〕各游戏份滚动排查：扫「设置/选人屏 overflow:hidden 且无矮屏媒体」（N-95 同构族）
- [ ] U-201 竖屏首扫（8 款）；U-5 选关格 44px 抽查；U-6 reduced-motion 扫描
- [ ] 交卷：水位只增不减；每条两档数字（切底伤加 1024×768）；报告进当轮 tester-B 文件

**两位共通**：§3.0 先读；贴线族先查壳层预算（N-89 教训）；sticky 失效先量裁切祖先链；救济档四视口覆盖、加档不改档；矮屏收缩红线 §6.6 逢改必查；新伤只记「文件+数字」待统编；撞车取先合版。
