# UX 迭代 Playbook（学习优化-C 交卷 · 供下一轮两个测试修复代理执行）

> 编写：云端子代理「学习优化-C」（claude-fable-5）。基线：`game-1.3 = e58ccceb`（含 N-89 壳标题收高 `10022068`、UX-99 派发表 PR #81）。
> 本轮 `src/**` 零改动（遵守学习员红线；派发表规定学习员只写 docs）。所有新数字来自本机无头 Chrome 实测（vite preview :4173 + puppeteer-core，工装 `/tmp/ux-c-measure.mjs` 不进库）。
> **编号纪律**：N 系列已用到 N-91（N-89 已修，N-90/N-91 由 wave1 测试员 B 在途）。为避免与并行 r18 学习员撞号，本文新伤一律用 **U 系列（U-1 起）**；若后续对账发现同一伤已有 N 号，以先合入 `game-1.3` 的编号为准，本文条目作废并在下一份笔记登记映射。

---

## 〇、仓库结构速查（下一轮代理先读这段）

- **技术栈**：Vite + TypeScript 纯 DOM/canvas，无框架。入口 `src/main.ts` → `src/ui/app.ts`（hash 路由 `#/game/<id>`）→ 首页 `src/ui/home.ts` / 游戏壳 `src/ui/gameShell.ts`。
- **游戏**：`src/games/<id>/`（约 110 款，meta.ts 提供 id/标题）。闯关款走 `src/games/level99.ts` 的 188 关框架（存档 key 仍叫 `l99`）。
- **样式分两层**：壳层/首页在 `src/styles.css`（3336 行）；各游戏样式为**游戏内联 CSS 字符串**（`const CSS = \`...\``），改游戏布局 = 改该游戏 `index.ts`（或 `view.ts`）里的 CSS 串。
- **滚动容器权属（最重要的一条架构事实）**：
  - `.game-screen` = 100dvh flex 列；`.game-topbar` 固定高；**`.game-stage` 是关内唯一滚动容器**（`overflow-y:auto`）。
  - **l99 闯关例外（N-63）**：`.game-stage--l99` 是 `overflow-y:hidden`，滚动权移交内部 `.l99-view`；`.l99-stage`（单关舞台）是 `overflow:hidden` —— **单关内容超高时既裁切又滚不动**，只能靠钳高 + sticky 钉底救。
- **测试**：vitest（本轮实测水位见文末）；守门测试直接断言源码字符串（例：`casualFit.r10b.test.ts`、`orb-arena/campaignPad.r12.test.ts` 钉死 `OA_SHORT_PANE_H=200`）。改布局前先 `rg` 相关守门测试，**测试只增不减**。

### 全仓媒体断点现状（546 处游戏内联 @media 统计）

| 档位 | 用途 | 覆盖 |
| --- | --- | --- |
| `max-width:420/400/380/360/340` | 窄竖屏手机 | 多数游戏有 |
| `max-height:500`（部分带 `min-width:640/700`） | 矮横屏手机（915×412） | r4–r17 修出来的主力档 |
| `max-height:740/720/660/620/560/520` | 竖屏矮机 / 分屏 | 零散 |
| **平板档（768×1024 / 1024×768 / 1180×820）** | **几乎全部不命中任何档** | 仅首页 `.grid` 有一条 `700–1024px` 档 |

**结论：平板四视口目前吃的是「桌面默认布局」。** 多数游戏因舞台高（662–918px）足够而没事，但凡是「默认布局总高 > 舞台高」且救济只写在 `max-height:500px` 档的游戏，平板横屏必切底（实测见 U-1）。这是本轮最大的结构性发现。

---

## 一、skills 提炼（`.cursor/skills/1.3-visual/`，只取能直接落到游戏 UX 的）

| 技能 | 可执行原则 | 对应本仓实践 |
| --- | --- | --- |
| frontend-design | **唯一 CTA 必须首屏可见**；控件文案 = 动作本身（「开打」「开跑」），全流程同词；结构元素要编码信息而非装饰 | N-87 冲刺菜单 CTA、N-88 开打钉底；本文 U-4 竖屏菜单 CTA 沿用同款配方 |
| frontend-design | 响应式到手机 + 可见键盘焦点 + reduced-motion 是「不宣布的质量底线」 | `:focus-visible` 3px 描边、`prefers-reduced-motion` 双保险（窗口2基线 B16）已是全仓约定，新修不得回退 |
| theme-factory | 色板/字体 token 化，套主题不改结构 | 窗口2基线 B1–B7 粉彩 token（朵朵 `#a8306a`/星星 `#28568f` 等）；修布局**只动几何，不另起新色** |
| canvas-design | **世界常量与显示裁切分离**；一切元素不得溢出画布边界、留呼吸边距 | C-8 口径：`SKY_H=420` 是逻辑世界高，只许 `max-height` 裁显示；fruit-catch `canvasDisplayCapPx()` 同理 |
| algorithmic-art | seeded 可复现 + 「可调参数」显式化 | `mulberry32` 确定性关卡；`OA_SHORT_PANE_H` 等常量 + 守门测试 = 参数显式化的本仓形态，禁改常量绕过守门 |
| character-sprite-maker | 身份一致性靠 canonical base 锚定 | 朵朵/星星头像走 `src/ui/avatars.ts` 单源；游戏内双人配色引 B1 token，不复制粘贴色值 |

---

## 二、可复制的优秀配方（改哪抄哪）

1. **sticky 底部工具条**（矮屏保底键）：`duo-rush/index.ts` `.dr-btns`——`position:sticky;bottom:0;z-index:7` + 半透明渐变背景防透字 + 顶部负阴影提示可滚。同款：`fruit-catch` `.frc-ctrl`@520、`chess-garden` `.cg-tools`（styles.css 末尾 N-66 段）。
2. **sticky 顶部 CTA**（菜单态）：`duo-rush` `.dr-menu-cta`——`order:-1` 提到 flex 顶 + `position:sticky;top:0`，一条规则同时解决「首屏可见」和「滚动不丢」。
3. **画布显示高钳制**：`fruit-catch/index.ts` `canvasDisplayCapPx(nativeH, roomPx, min)`——纯函数、带下限（`MIN_CANVAS_DISPLAY_PX=160`，防篮口与果子重叠），钳不动时**宁可交给舞台滚动**。改画布类游戏优先抄它，不要改逻辑分辨率。
4. **进关量缺口回填画布**：`level99.ts` `fitPanesToStage()/fitPaneH()`——挂载后量 `.game-stage` 底部缺口，按显示宽比例回填 canvas 逻辑高，钳 `[min(原高,240), 960]`。
5. **矮屏 paneH 常量 + 守门**：`orb-arena` `OA_SHORT_PANE_H=200`（`campaignPad.r12.test.ts` 钉死）。需要再让位时**动壳或动垫，不动常量**（N-89 即壳层让 28px 的正确示范，见 styles.css:1915）。
6. **选关地图列数**：`level99.ts` `mapColumns(width)`：≤320→4 列、≤420→5、≤560→6、≤760→7、>760→8；resize 时 JS 重写 `grid-template-columns`。
7. **首页首屏配方（S-1）**：`styles.css` 480/500 两档——hero 插图 `display:none`、筛选两排并一排、`home-count` 隐藏；红线是筛选/搜索热区 ≥44px。
8. **安全区**：全部用 `max(基础值, env(safe-area-inset-*))`（styles.css:3303 起），普通浏览器零变化。
9. **root 解锁视觉**：`.l99-node-rootopen` 白底粉虚线 + 🔓，与真实进度一眼区分；权限过期地图重画自然消失。
10. **结算冷静期**：`isGuardedClick()`——狂点型关卡结算刚弹出的一小会儿不吃点击，防误触「下一关」。

## 三、「不要再犯」清单（历史轮次 + 本轮对比提炼）

1. **不要写第二套同功能的垫/键**：撞车取先合版（N-57 vs N-88、N-40 vs N-87 都是「同构不同面」，先确认是不是同一元素再开号）。
2. **不要改逻辑世界常量来修显示**：`balloon-pop SKY_H=420`、各 `*_PANE_H=200`、题库/seed/胜负/存档 key/`meta.id` 全部禁改。
3. **不要把救济只写在 `max-height:500px` 档就当修完**：平板横屏（768/820 高）不命中该档（U-1 的根因）。新修一律按「四视口验收」跑完再交。
4. **不要让 sticky 死在错误的滚动容器里**：sticky 相对最近可滚祖先生效；l99 单关里 `.l99-stage` 是 `overflow:hidden`，sticky 底=无效，要么改 fixed（参考 N-75 手牌 fixed 进视口底），要么钳内容高。weiqi-garden N-10 即此坑。
5. **不要用 `scrollIntoView` 滚外层舞台**：会把模式条卷出屏（N-63 教训）；l99 已把滚动权交给 `.l99-view` 并在聚焦后把 stage.scrollTop 归零，勿回退。
6. **不要删 `min-width:700` 一类护栏去救横屏**：会误伤窄竖屏（N-10 明令）。加档不改档。
7. **不要把说明文字压到 16px 以下**（`mobileText` 红线）、不要把星星 SVG 压到 12px 以下、热区 44px 红线只有两类豁免：棋盘观察格（红蓝点 22px、星地产地格 26px 口径）与装饰字符。
8. **不要在 flex 容器上依赖 `hidden` 属性**：`display:flex` 会压过 UA 的 `display:none`，要补 `[hidden]{display:none}`（fruit-catch `.frc-modebar[hidden]` 示范）。
9. **不要引入 `perspective/rotate3d/matrix3d/translateZ`**（窗口2 B27 机器闸一票否决）；翻面一律压扁实现。
10. **不要整 PR 回滚式合并**：PR #76/#77/#79/#80 偏旧禁再合；rebase 后 `npm test && npm run build`，测试只增不减。
11. **学习员不改 `src/**`**；测试工装（measure 脚本、截图）一律留 `/tmp`，不进库。

---

## 四、本轮四视口实测：分游戏痛点与修法（U 系列新伤 + 在途旧号）

主测视口：**390×844 竖屏、768×1024 竖屏、1024×768 横屏、1180×820 横屏**（本文口径）；**915×412** 为历史主档，回归不得回退。测法：`getBoundingClientRect`，进关前视需要种 `yiduo-yixing.l99.<id>` 存档并换 hash 重挂；管理员密码 `kangkang`（默认 1 小时够用）。

### U-1 star-estate（朵星地产）平板横屏切底且滚不动 🔧【P0 · B】

- **实测**：1024×768 关内「🎲 掷骰 / 🏠 购买」top 746 bottom **794**（舞台底 754，切 26px）；1180×820 top 796 bottom **844**（切 24px）；`.l99-view` sh==ch（654/654、706/706）——**不可滚，键的下半永远点不到**。390×844 竖屏同构：掷骰 top 808 bottom **854**（vh 844，切 10px，同样滚不动）。
- **根因**：`star-estate/index.ts` 的 N-3 配方 E（`.se-pad` sticky 钉底 + `.se-board-wrap` 钳 `min(200px,42dvh)`）只写在 `@media (max-height:500px)`；默认布局总高 ≈866px，而 l99 单关 `.l99-stage` overflow:hidden。
- **修法**：在该游戏内联 CSS **新增一档** `@media (max-height:900px)`（或拆 `(max-height:900px) and (min-width:700px)` + `(max-width:480px)` 两档）套用同款配方：`.se-pad{position:sticky;bottom:0}` + `.se-board-wrap{max-height:min(280px,52dvh)}`（数值按视口余高调，board 别小于现有 500 档的 156px 口径）。**勿动** 500 档现值与 `stickyPad.r10.test.ts`、`viewportCap.r14.test.ts` 守门；地格 26px 维持棋盘观察豁免，只放大当前格预览（N-3 口径）。
- **验收**：四视口掷骰/购买/结束回合 bottom ≤ 舞台底；500 档回归数字不变。

### U-2 模式条/菜单按钮热区 <44px（跨游戏通病）🔧【P1 · B 为主】

- **实测**（390×844 与四视口一致，元素是同一批）：fruit-catch「👫 双人抢果 / ♾️ 无尽水果雨」h=**37**；balloon-pop「♾️ 无尽气球节」h=**40**；duo-rush「怎么玩 / 收藏册」h=**43**。
- **根因**：各游戏 modebar 按钮用 padding 撑高没设 `min-height:44px`（对照首页 chips 全部显式 `min-height:44px`）。
- **修法**：逐游戏在内联 CSS 给模式键补 `min-height:44px;box-sizing:border-box`（fruit-catch `.frc-open/.frc-back`、balloon-pop 对应模式键、duo-rush `.dr-softbtn`——注意 duo-rush 500 档 `.dr-menu-cta` 里已写 `min-height:44px`，只补默认档）。**先 `rg` 各游戏 visual/copy 守门测试是否断言了 padding 原文**。改后顺手全库扫一遍：同类 modebar 键很多游戏都有（抽验 3 款即中 3 款）。
- **验收**：四视口所有可见模式键 `offsetHeight ≥ 44`。

### U-3 duo-rush 竖屏菜单 CTA 半屏外 🔧【P2 · B】

- **实测**：390×844 菜单态「🎁 我的收藏册」top 816 bottom **859**（切 15px；`.game-stage` sh 837 > ch 730，**划得动**，非硬伤）；「开跑」CTA 位置未及量，下轮先量。
- **修法**：若「开跑」也在首屏线下，把 N-87 的 `.dr-menu-cta`（order:-1 + sticky top）从 `max-height:500px` 档扩到 `(max-width:480px)` 档即可，一行媒体条件的事。**勿回退** `.dr-btns` sticky（N-40）与 500 档现状。
- **验收**：390×844 菜单态不滚动即可见「开跑」，收藏册可滚达且热区 ≥44。

### U-4 首页 hero 在平板横屏偏肥 👀【P2 · A】

- **实测**：1024×768 首卡 top **557**（首屏只露 211px 高的半行卡）；1180×820 类似；768×1024 竖屏 top 623 但 vh 1024，首行完整可见，**可接受**。390×844 top 496、可滚 ✅（S-1 已修档位不回退）。
- **修法**（打磨级，别抢 P0/P1 的空间）：给 styles.css 新增 `@media (min-width:700px) and (max-height:840px)` 档，只收 `.home-hero` 上下边距与 `.hero-figure` 尺寸（或复用 S-1 的隐藏插图方案）。**不动** 480/500 两档已有规则，筛选热区 ≥44 红线不变。
- **验收**：1024×768 首卡 top ≤ 500 且 390×844/768×1024 数字不回退。

### U-5 平板横屏舞台大面积留白 👀【P3 · 观察，本轮不修】

- **实测**：tap-tiles 关内画布 460px 宽居中在 960px 宽舞台；pool-stars 680×340 画布上下留 ~300px。不裁不挡，只是不好看。留给后续视觉轮统一决策（如画布 `max-width` 抬到 `min(720px, 90%)`），**不要**在修切底的同一批提交里顺手放大画布，会牵动 fitPanesToStage 的回填数字。

### U-6 主干既有红灯：combo-clash / mahjong-bloom 正文 14px 🔧【P1 · B】

- **实测**：基线 `e58ccceb` 上 `npm test` 有 **5 例既有失败**（本轮 docs-only 提交，与本文无关）：`src/games/window1-mobile-text.test.ts` 2 例 + `src/ui/mobileText.test.ts` 3 例——`combo-clash .cc-info → 14px`、`mahjong-bloom .mj-goal → 14px`（且 `.mj-goal` 还锁着 `nowrap`），违反 16px 正文红线。
- **修法**：两款游戏内联 CSS 把该选择器字号提到 16px、`.mj-goal` 去掉 `white-space:nowrap` 补 `overflow-wrap:anywhere`；改后确认窄屏媒体查询里没有再调小的档。这是让全库回绿的最短路径，**优先级摆在 U-2 前面做**（红灯挡交卷）。
- **验收**：`npx vitest run src/ui/mobileText.test.ts src/games/window1-mobile-text.test.ts` 全绿；390×844 量两处文字实际渲染 ≥16px 且不溢出。

### 在途旧号（wave1 测试员 A/B 正在跑，下一轮先对账再动手）

| # | 对象 | 状态口径 |
| --- | --- | --- |
| N-89 | 壳层短横屏标题条 | ✅ 已合（`10022068`，styles.css:1915）。只许回归 |
| N-90 | tap-tiles 矮横屏无救济档 | wave1 B 在途。本轮实测其**竖屏/平板四视口全绿**（画布钳制良好），伤只在 915×412 |
| N-91 | fruit-catch 画布钳高 | wave1 B 在途。四视口实测全绿（竖屏画布 392px、底键在屏） |
| N-60/61/62 贴线、N-12 pool-stars、N-10 weiqi、N-55 snow、C-8 balloon | r17 playbook B 面 | 若 wave1 已交卷则只做回归，否则按 r17 playbook 原文执行（其口径与本文不冲突） |

**本轮四视口实测干净（下一轮不必重量）**：balloon-pop / hop-pads / fruit-catch / tap-tiles / pool-stars 的选关地图与第 1 关（画布、底键、继续按钮全部在屏且 `.l99-view` 可滚）；首页 390×844 与 768×1024 首屏见卡。

---

## 五、关卡排布规则（选关地图统一口径，新游戏/修图照此验收）

1. **网格列数**：由 `level99.ts mapColumns(innerWidth)` 决定——≤320px→**4 列**、≤420→**5**、≤560→**6**、≤760→**7**、>760→**8**；resize 实时重排。实测节点宽：390 视口 59–64px、768+ 视口 77–78px，全部 ≥44 ✅。改列数只许改 `mapColumns`，不许在游戏里另写 grid。
2. **间距**：`.l99-grid` gap **8px**（≤420px 收到 6px）；地图容器 `.l99-map` padding 14px（窄屏 10px）。
3. **最小触控**：关卡格 aspect-ratio:1 且实测 ≥59px；工具键（继续/跳过/直达/攻略）**≥44px**；直达输入框 `min-height:44px`。豁免仅限棋盘观察格与 12px 装饰星。
4. **滚动容器**：地图态滚 **`.l99-view`**（overflow-y:auto + overscroll-behavior:contain）；**不许**滚 `.game-stage`（会卷走模式条，N-63）。当前关用 `scrollIntoView({block:"center"})` 聚焦后必须把 stage.scrollTop 归零。
5. **状态视觉**：解锁格=章节色实底+星行；锁定格=灰底🔒+disabled；跳过格=灰底🏳️；当前关=粉描边脉冲（reduced 停动画）；root 解锁=白底粉虚线🔓。`aria-label` 走 `nodeAriaLabel()`，不要手拼。
6. **章节页眉**：tabs 可换行、锁定章节 `l99-tab-lock`；进度 chips（🚩/⭐）字号 16px 红线。

---

## 六、验收清单（每条修完四视口全跑，记 top/bottom 数字进交卷笔记）

**共同断言**（每视口）：
- [ ] 唯一 CTA（开始/开打/开跑/掷骰/击球）首屏可见或 sticky 钉底，bottom ≤ 滚动容器可视底。
- [ ] 所有可见按钮/输入 `min(width,height) ≥ 44px`（豁免口径见五-3）。
- [ ] 该屏的滚动容器（`.game-stage` 或 `.l99-view`）`scrollHeight > clientHeight` 时真的能滚到底部最后一个控件；`scrollHeight == clientHeight` 时不允许有任何控件溢出裁切。
- [ ] 说明文字 ≥16px、无横向滚动条、`prefers-reduced-motion` 下无残留动画。

**分视口重点**：
- **390×844 竖屏**：首页首屏见首行卡（S-1 不回退）；选关 5 列、节点 ≥59px；关内竖排能划到底（duo-rush 收藏册、star-estate 掷骰是已知考点）。
- **768×1024 竖屏**：选关 8 列；hero 首行卡完整可见；画布类游戏底键在画布下方在屏（fruit-catch 已绿基线：画布 bottom 896 / 舞台底 1010）。
- **1024×768 横屏**：舞台高 662px——**平板横屏主考点**：凡默认布局总高 >660 的游戏（star-estate 类）必须有 sticky/钳高救济；首页首卡 top ≤500（U-4 修后）。
- **1180×820 横屏**：舞台高 714px，同上放宽 52px 复测；重点回归 U-1 修复值在两个横屏档都成立。
- **915×412（回归档）**：r4–r17 全部已修项不回退；`OA_SHORT_PANE_H=200`、`.dr-btns` sticky、N-89 壳高等守门测试保持绿。

---

## 七、下一轮两个测试修复代理的任务拆分建议

**进场动作（两人相同）**：`git fetch origin game-1.3` 对账最新水位 → 读本文 + `docs/qa/trio-r17-playbook.md` + 最新 `trio-r18-*`（若 wave1 学习员已交卷）→ 确认 N-90/N-91 与 r17 B 面旧号是否已被 wave1 合入，已合的只做回归。

### 测试修复员 A（壳层 + 闯关框架；独占 `src/styles.css`、`src/ui/**`、`level99.ts`）

1. **U-4** 首页 hero 平板横屏收紧（styles.css 新增平板档，480/500 档零回归）。
2. 壳层四视口回归：`.game-topbar` 四档高度、弹窗 `max-height:92dvh`、safe-area；N-89 只回归。
3. l99 地图四视口回归（本文第五节口径逐条断言，重点 8 列档与 `.l99-view` 滚动权）。
4. 余力：为「四视口验收」补一条壳层守门测试（断言 styles.css 平板档存在且不含对 480/500 档的删改）。

### 测试修复员 B（休闲/对战/动手；独占 `src/games/**`）

1. **U-6** 主干红灯 combo-clash / mahjong-bloom 正文 14px（最先做，红灯挡交卷）。
2. **U-1** star-estate 平板横屏+竖屏切底（P0，本文有完整根因与修法；勿动 500 档守门）。
3. **U-2** 模式键 44px：先修实测中招的 fruit-catch / balloon-pop / duo-rush 三款，再 `rg -n "padding:9px|padding: 9px" src/games/*/index.ts` 类似写法扫尾，一次提交 ≤6 款防撞车。
4. **U-3** duo-rush 竖屏菜单 CTA（先量「开跑」，线下才动手）。
5. r17 B 面旧号（N-60/61/62 贴线、N-12、N-10、N-3、N-55、C-8、N-90、N-91）：对账 wave1 交卷情况，未合的按 r17 playbook 原文执行。
6. 每修一款，四视口 + 915×412 五个数字全记进交卷笔记。

**纪律（两人共同）**：不改存档 key/`meta.id`/题库/seed/胜负；禁 force；测试只增不减；rebase 后 `npm test && npm run build`；同一元素撞车取先合版；工装不进库。

---

## 附：本轮环境水位

- `npm run build` ✅（vite + PWA precache 200 entries）。
- `npm test`（基线 `e58ccceb`，本轮零改 src）：**1193 文件 / 19489 用例，其中 2 文件 5 例既有失败**（即 U-6：combo-clash/mahjong-bloom 14px 正文），其余 19484 全绿。下一轮以「U-6 修复后全绿」为交卷水位。
- 预览：`npx vite preview --port 4173`；Chrome：`/usr/local/bin/google-chrome`；puppeteer-core 临时安装（`--no-save`，不进 package.json）。
