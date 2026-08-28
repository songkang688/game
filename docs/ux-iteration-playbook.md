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
- **第 2 轮对账修订**：竖屏 390×844 与 915×412 部分与旧号 **N-3 撞号**（r18 playbook 已按 N-3 派给 B，数字一致：掷骰/购买 808–854）。以 N-3 为准；**U-1 收窄为「平板横屏 1024×768 / 1180×820 两档」的增量视口义务**——B 修 N-3 时把媒体档开到能覆盖这两档，四视口一起验收即可一票结案。

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

## 附：第 1 轮环境水位

- `npm run build` ✅（vite + PWA precache 200 entries）。
- `npm test`（基线 `e58ccceb`，本轮零改 src）：**1193 文件 / 19489 用例，其中 2 文件 5 例既有失败**（即 U-6：combo-clash/mahjong-bloom 14px 正文），其余 19484 全绿。下一轮以「U-6 修复后全绿」为交卷水位。
- 预览：`npx vite preview --port 4173`；Chrome：`/usr/local/bin/google-chrome`；puppeteer-core 临时安装（`--no-save`，不进 package.json）。

---

# 第 2 轮增补（学习优化-C · 监督轮次第 2 轮）

> 基线：`game-1.3 = 8b23ab11`（已含 r18 学习笔记 + playbook，N 系列用到 **N-99**）。本轮 `src/**` 仍零改动。
> 抽测范围：第 1 轮未覆盖的 20 款（闯关 l99 / 双人对战 / 画布 / 棋牌 sticky）× **5 视口**（四视口 + 915×412），共 190 条测量；对出屏控件另做「可滚祖先链」复核（工装 `/tmp/ux-c-r2.mjs`、`/tmp/ux-c-verify.mjs` 不进库）。
> **与 r18 对账**：N-94…N-99 已被 wave1 学习员占用并派发（xiangqi / duo-vs-star / bomb-buddies / math-farm / hue-hand / sudoku-petal），本文不重复；本轮新伤继续用 **U-7 起**。U-7…U-11 的对象目录均**不在 r18 A/B 独占清单内**，可安全并行；唯 U-9 动 `src/styles.css`（A 独占）。

## 八、结构性根因（本轮最重要的发现，写给所有后续轮次）

**`level99.ts` 的 `pinL99Host()` 会给「游戏自带滚动容器」打上 `.l99-host` 类，而 `.l99-host` 是 `overflow:hidden`。**

实证：tank-battle 自带 `.tkb-root{height:100%;overflow-y:auto}`（index.ts:116），挂进关卡后 DOM 上是 `.tkb-root.l99-host`，实测 `overflow-y:hidden`、sh 798 > ch 730——自带滚动被框架打死。r18 的 N-98（hue-hand）、N-75（麻将手牌）与本轮 U-7/U-8 全是同族病。

**由此固化一条军规**：l99 闯关游戏关内的一切超高救济，**只有两条合法路径**——
1. **钳内容高**（画布/棋盘按余量收，参照 `canvasDisplayCapPx` / `fitPanesToStage`）；
2. **`position:fixed` 钉视口底**（参照 N-75 手牌配方，补左右定位与背景垫）。
`position:sticky` 与「自身 overflow-y:auto」在 `.l99-host`/`.l99-stage{overflow:hidden}` 链里**一律失效**，写了等于没写；review 时看到 l99 游戏里新增 sticky 底键直接打回。

## 九、第 2 轮新伤（U-7…U-12）

### U-7 tank-battle 双人对战操控键不可达 🔧【P0 · B】

- **实测**（点「⚔️ 双人对战」后）：390×844 双方 D-pad+武器键 12 枚 @795–888 出屏；1024×768 15 枚 @739–907；1180×820 15 枚 @778–946；915×412 16 枚（小地图 @395–439、暂停 @453–497、方向 @424–519）。五视口仅 768×1024 幸免。祖先链全是 `overflow:hidden`（`.tkb-root.l99-host` sh798/ch730；915 还叠 `.tkb-wrap` sh404/ch304）——**滚不动，双人根本没法打**。
- **根因**：`src/games/tank-battle/index.ts` 的 sticky/钳高救济只在 `@media (max-height:500px)` 档（223–231 行），且该档的 sticky 在 `.l99-host` 链里本就失效（第八节）；对战画布高未按余量预留双 D-pad。
- **修法**：照 N-75 配方把 `.tkb-pads-two`（+ `.tkb-acts`）改 **fixed 钉视口底**（媒体档扩到覆盖 844/768/820 高），并在 JS 画布高预算里减去双垫高度（223 行注释说明 N-53 时已有此机制，扩档即可）；或按第八节路径 1 钳 `.tkb-canvas` 显示高。**勿动** `campaignPad.r15.test.ts` / `shortLandscape.r11.test.ts` 守门与闯关单人档。
- **验收**：五视口双人对战两套方向键+武器键 bottom ≤ 视口底、热区 ≥44；闯关模式回归数字不变。

### U-8 mole-pop 关内洞格出屏滚不动 🔧【P0 · B】

- **实测**：915×412 九宫洞下两排 @469–894 出屏（`.mp-wrap` sh754/ch208 `overflow:hidden`）——**9 洞只能看到第一排，玩不了**；1024×768 / 1180×820 末排 @724–928 出屏。390×844、768×1024 干净。
- **根因**：`src/games/mole-pop/index.ts` `.mp-board{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}`（95 行）无任何钳宽/钳高档，洞格 `aspect-ratio:1` 随舞台宽等比放大（915 宽 → 单洞 206px 高 → 板高 ~650px）。
- **修法**（第八节路径 1）：给 `.mp-board` 补 `max-width:min(100%, calc(100dvh - 240px));margin-inline:auto`（240 为壳+HUD 预算，量后调），必要时加 `(max-height:500px)` 档再收。**红线**：洞热区 ≥56px（74 行注释 + `visual.qa1.test.ts` 守门），390×844 已绿档零回退，勿改升降时序 `rhythm.ts`。
- **验收**：五视口 9 洞全部 bottom ≤ 舞台可视底、单洞 ≥56px。

### U-9 chess-garden 平板横屏「重摆题面」不可达 🔧【P1 · A】

- **实测**：1024×768 与 1180×820 关内「♻️ 重摆题面」@816–860 出屏（`.l99-stage` sh710/ch590 hidden）；双人同屏态同炸。915×412 命中 N-66 档正常（末行棋盘格 30px 属观察豁免）。
- **根因**：N-66 配方（`src/styles.css:3320` 起）媒体条件是 `(min-width:700px) and (max-height:500px)`，平板横屏不命中 → 8×8 棋盘全尺寸把工具行顶出裁切区。
- **修法**：styles.css 该段**加一档** `(min-width:700px) and (max-height:840px)`：`.cg-wrap .cg-board{max-width:min(420px,60dvh)}` + `.cg-wrap .cg-tools` 同款 sticky（sticky 在此有效——`.cg-tools` 的滚动/裁切祖先正是 `.l99-stage`，sticky 相对裁切盒仍钉可视底；若实测不钉，退回钳 board 一条路）。**勿改** 500 档现值（N-66 守门 `duoFit.r14.test.ts`）。
- **验收**：1024×768 / 1180×820 单人与双人同屏「重摆题面」bottom ≤ 舞台可视底；915×412 回归数字不变。

### U-10 box-hamster 关内 D-pad 40px 高 🔧【P2 · B】

- **实测**：915×412 关内 ⬆◀⬇▶ 四键 **56×40**（<44 红线）。390×844 等其余视口达标。
- **根因**：`src/games/box-hamster/index.ts` `.bh-pad` 默认 `grid-auto-rows:52px`（117 行）、窄屏档 46px（137 行），但矮横屏某档把行高压到了 40（测试员先 `rg -n "40px|auto-rows" src/games/box-hamster/index.ts` 定位）。
- **修法**：该档行高提到 44px 并给 `.bh-btn` 补 `min-height:44px`。若挤不下就收 `.bh-wrap` 别处（实测该档仅溢出 19px，余量足够）。
- **验收**：915×412 四键 ≥44px 且整排在屏；对账 N-47（那是**菜单**芯片 40→44，已合勿动，本条是**关内 D-pad**，别并错账）。

### U-11 brick-break 画布底切、挡板区不可见 🔧【P1 · B】

- **实测**：1024×768 画布 bottom 838 / 舞台可视底 746（**切 92px**）；1180×820 切 92px；915×412 画布 bottom 440 / 396（切 44px）。左右控制键已 sticky 在屏（⬅️ 278–334 ✅）。挡板画在画布底部——**切掉的正是挡板与接球区**。
- **根因**：`src/games/brick-break/index.ts:125` `.brk-canvas{max-height:calc(100dvh - 168px)}` 的 168px 预算只够壳顶栏，没算 l99 关内 stagebar/HUD/控制键（实际 chrome ≈260px）。
- **修法**：预算改 `calc(100dvh - 260px)` 并按视口档微调；更稳做法照 fruit-catch `canvasDisplayCapPx()` 进关量 `.game-stage` 实际缺口钳显示高（第八节路径 1）。`object-fit:contain` 保留，`.brk-ctrl` sticky 勿动，物理/球速零触碰。
- **验收**：五视口画布 bottom ≤ 舞台可视底（挡板全程可见）；对账旧号 **C-2**（r16 观察 crop 172，一并结案）。

### U-12 snake-snack 关内画布底切 26px 👀【P3 · 观察，不立修】

- 915×412 画布 bottom 422 / 舞台 396。操控键已进屏（N-61 已按 r18 结案，**禁止二套垫**）。只登记：若后续实测蛇的世界底行被裁影响判断，再立号走「钳显示高」路径，勿碰 `SR_SHORT_PANE_H=200`。

### 旧号增补数字（不开新号，验收时引用）

- **U-2 追加对象**：brick-break「♾️ 无尽砖塔」105×40（五视口同值）。r18 红线写「全库热区已达标」与实测不符——A/B 验收时以 `getBoundingClientRect` 实测为准。
- **U-6 增补**：915×412 实况渲染 `mahjong-bloom .mj-goal` = **14px**、`combo-clash .cc-info` = **14px**（此前只有 360px 单测断言，现补矮横屏实测）；其余四视口均 16px。修法不变（提基档字号、去 nowrap）。
- **N-55（r18 已派 B）**：本轮复测五视口，仅 915×412 中招（第二排 @382–428 切 16px），四视口全绿——修完只需回归 915。
- **mahjong-bloom 手牌**：915×412 手牌 bottom 400 / 舞台 396，贴线 4px，噪声级不立号；修 U-6 时顺手确认。

## 十、第 2 轮干净清单（五视口全测过，下轮不必重量）

merge-2048 / orb-arena / gomoku / landlord-cards / duo-arena（开擂 CTA 344–400 在屏）/ fight-king 入口 / brave-path（N-86 大厅回归绿）/ garden-guard / fruit-slice / gold-hook / rainbow-run / snake-snack（除 U-12 观察）/ box-hamster 地图态 / mole-pop 地图态 / tank-battle 闯关态与地图态 / snow-fight 闯关态（对战即 N-55）——地图 `.l99-view` 可滚、锁定格在滚动流内、`.l99-node-cur` 全部在屏（N-39 口径五视口零违例）。
第 1 轮已绿基线维持：balloon-pop / hop-pads / fruit-catch / tap-tiles 的地图与第 1 关。

## 十一、第 2 轮给测试员 A/B 的任务单（精确路径 + 验收步骤）

**共同准备**：`git fetch origin game-1.3` → rebase → `npm run build && npx vite preview --port 4173` → puppeteer-core + `/usr/local/bin/google-chrome`，每案独立 context；五视口 = 390×844 / 768×1024 / 1024×768 / 1180×820 / 915×412；每条修复留 top/bottom 前后数字 + 配套小测试；`npm test` 只增不减（进场水位 19484 绿 + U-6 的 5 红，修完 U-6 应全绿）。

### A（壳层 + 闯关框架；独占 `src/styles.css`、`src/ui/**`、`src/games/level99*`）

| 序 | 项 | 文件 | 步骤 |
| --- | --- | --- | --- |
| 1 | **U-9** chess-garden 平板横屏工具行 | `src/styles.css`（3320 行 N-66 段后追加新档） | ① 复现：1024×768 → `#/game/chess-garden` → 点 `.l99-continue` → 量「重摆题面」top/bottom；② 加 `(min-width:700px) and (max-height:840px)` 档钳 `.cg-board` + 工具钉底；③ 五视口验收 + 915 回归 N-66 数字；④ 补一条 styles.css 断言测试（存在新档、500 档原文未动） |
| 2 | **U-4** 首页 hero 平板横屏收紧 | `src/styles.css`（S-1 段附近追加） | 见第四节 U-4；1024×768 首卡 top ≤500，480/500 档零回退 |
| 3 | 第八节军规落地 | `docs/qa/`（文档）+ 可选 `src/games/level99.stars.test.ts` 同级新测试 | 把「l99 内 sticky/自滚失效」写进下一份 learn-notes；可选:加一条源码扫描测试,断言 l99 游戏内联 CSS 新增 `position:sticky.*bottom` 时必须带注释说明滚动祖先(轻量守门,拿不准就只写文档) |

### B（休闲对战动手；独占 `src/games/**` 中下列目录，避开 r18 B 组的 12 个目录）

| 序 | 项 | 文件 | 步骤 |
| --- | --- | --- | --- |
| 1 | **U-7** tank-battle 双人操控 | `src/games/tank-battle/index.ts`（116/143/223–231 行档位） | ① 复现：任一视口 → `#/game/tank-battle` → 点「⚔️ 双人对战」→ 量最底一排键；② `.tkb-pads-two`/`.tkb-acts` fixed 钉底 + 画布预算减双垫高（扩媒体档覆盖 844/768/820）；③ 五视口 + 闯关回归；④ 小测试断言新档存在且 `campaignPad.r15` 原断言不动 |
| 2 | **U-8** mole-pop 洞格 | `src/games/mole-pop/index.ts`（95 行 `.mp-board`） | ① 复现：915×412 进第 1 关量第 2/3 排洞 top；② `.mp-board` 钳 `max-width:min(100%,calc(100dvh - 240px))` 居中；③ 五视口 9 洞在屏、洞 ≥56px（`visual.qa1.test.ts` 保绿）；④ 390/768 档零回退 |
| 3 | **U-11** brick-break 画布/挡板 | `src/games/brick-break/index.ts`（125 行 `.brk-canvas`） | ① 复现：1024×768 进第 1 关量 canvas bottom vs `.game-stage` 可视底；② 预算 168→按实测 chrome（或抄 `canvasDisplayCapPx` 动态钳）；③ 五视口挡板可见；④ 结案 C-2 并留数字 |
| 4 | **U-6** combo-clash / mahjong-bloom 正文 14px | `src/games/combo-clash/index.ts`（`.cc-info`）、`src/games/mahjong-bloom/index.ts`（`.mj-goal`） | ① 先跑 `npx vitest run src/ui/mobileText.test.ts src/games/window1-mobile-text.test.ts` 看 5 红；② 字号 14→16、`.mj-goal` 去 nowrap 补 `overflow-wrap:anywhere`；③ 两测试文件全绿 = 全库回绿；④ 390 与 915 实测渲染 ≥16px |
| 5 | **U-2** 模式键 44px | `src/games/{fruit-catch,balloon-pop,brick-break}/index.ts`（duo-rush 归 r18 B 独占，留给他们） | ① 每款量 modebar 键 offsetHeight；② 补 `min-height:44px;box-sizing:border-box`；③ 先 `rg` 各款 visual/copy 测试有没有断言 padding 原文；④ 五视口复量 |
| 6 | **U-10** box-hamster D-pad | `src/games/box-hamster/index.ts`（`.bh-pad` 矮屏档） | ① `rg -n "40px\|auto-rows" src/games/box-hamster/index.ts` 定位 40 来源；② 行高 ≥44 + `.bh-btn min-height:44px`；③ 915 验收整排在屏 |

**优先顺序**：B 先 U-6（红灯挡交卷）→ U-7 → U-8 → U-11 → U-2 → U-10；A 先 U-9 → U-4。撞车规则不变：同一元素先合版为准；r18 在途的 N-94…N-99 与 N-3/N-12/N-55/C-8/N-10 **本任务单一律不碰**。

## 附：第 2 轮环境水位

- 环境曾在两轮之间重置（node_modules 清空），`npm ci` + `npm run build` 重建后全绿；本轮未重跑全量 vitest（零改 src，水位沿用第 1 轮：19484 绿 + U-6 5 红）。
- 抽测统计：20 款 × 5 视口 × entry/level1/duo ≈ 190 条测量 + 9 条可滚祖先链复核，全部留档在本文件。

---

# 第 3 轮增补（学习优化-C · 监督轮次第 3 轮）

> 基线：`game-1.3 = 6982da7e`（r18 playbook 已扩两份附录，N 系列用到 **N-107**）。本轮 `src/**` 仍零改动。
> 抽测：剩余 28 款未覆盖游戏（双人 / l99 高 HUD / 商店底栏 / 选关地图）× 5 视口，320 条测量；出屏控件全部带「可滚祖先」内联复核（HARD-OUT = 出屏且无任何可滚祖先 = 真不可达；工装 `/tmp/ux-c-r3.mjs` 不进库）。

## 十二、第 2 轮编号对账勘误（先合版占号，本文让号）

| 本文原号 | 先合版编号 | 说明 |
| --- | --- | --- |
| **U-6** | **N-105**（r18 附录一，B 第零优先） | 同一主干红灯；r18 侧还查明病根提交（PR #78 `81b228c2` 的 500 档字号）。**待 B 认领 N-105**，本文 U-6 条目改作旁证（915 实况 14px 数字仍有效） |
| **U-8** | **C-5**（r18 附录二，B） | mole-pop 洞格同伤（r4 老账重挂）；r18 侧补了 root×167 加深档。**待 B 认领 C-5**；本文增量：**1024×768 / 1180×820 末排 @724–928 也出屏**，修 C-5 时媒体档须覆盖平板横屏，四视口一起验收 |
| **U-7** | 无撞号，保留 | tank-battle 双人对战不在任何在途派单（r18 B 独占追加清单亦无 tank-battle）。**待 B 认领 U-7** |
| U-12 观察 | 维持观察 | snake-snack 画布 26px 底切，勿动 N-61 结案 |

第 2 轮任务单（第十一节）照此更新：B 序 2（U-8）与序 4（U-6）执行时以 C-5 / N-105 号记账，验收口径按本文补充的平板增量跑全。

## 十三、第 3 轮新伤（U-13…U-21；HARD-OUT 全部二次复核）

> 编号从 U-13 起；对象目录均不在 r18 A/B 独占清单（含两份附录追加）内。列出的每个数字都是「出屏且滚不到」，除非另注。

### U-13 bowling-lane 关内投球 CTA 出屏 🔧【P0 · B】

- **实测**（闯关第 1 关与「⚔️ 双人对战」两态同炸）：「◀ / 🎳 停!(蓄力) / ▶ / ↩ 重来」390×844 @930–974；1024×768 @851–895；1180×820 @851–895；915×412 @587–631（双人第二排 @684–728）；768×1024 幸免。另：915 画布底切 33px；「⏸ 暂停」67×34、「◀ 回选关」74×30 触区不足。
- **对账**：r18 干净清单的 bowling 条目是**地图态**（root 直达条 / 1024 地图）；关内投球排此前无人测过。N-63（模式条卷走）勿回退。
- **修法**：`src/games/bowling-lane/index.ts`——投球排照第八节路径 2 fixed 钉视口底（球道 canvas 让高），或钳球道显示高；顺手抬暂停/回选关到 44。
- **验收**：五视口闯关与双人两态投球排 bottom ≤ 视口底、热区 ≥44；地图态回归数字不变。

### U-14 flight-chess 关内掷骰/机架排出屏 🔧【P0 · B】

- **实测**（单人与「👫 双人同屏」同炸）：390×844 掷骰子 @987–1035、机架四排 @1041–1135；1024×768 / 1180×820 掷骰 @886–934 + 机架 @1038–1082；768×1024 机架 @1038–1082；915×412 机架徽记跨线 @405–440。掷骰是唯一 CTA。
- **对账**：N-2（r14「flight-chess 闯关折叠 0 @915」）只结了 915 档当时的折叠口径——本伤是四视口 HARD-OUT，别当 N-2 回归打发。
- **修法**：`src/games/flight-chess/index.ts`——掷骰+机架行 fixed 钉底或棋盘按余高钳（第八节两条路径）；徽记 ×2（12–29px）属棋盘观察记号豁免，不用抬 44。
- **验收**：五视口掷骰子/机架排 bottom ≤ 视口底；双人同屏同验；勿改棋规/骰序。

### U-15 hero-cards 手牌与回合键出屏 🔧【P1 · B】

- **实测**：390×844 十张手牌 @848–1030 HARD-OUT；1024×768「✅ 确定 / ↩️ 取消 / ⏭️ 结束回合」@732–778。915×412 本轮绿（N-4 已修档有效）。
- **修法**：`src/games/hero-cards/index.ts`——把 N-4 的矮横屏救济扩档到竖屏手机与平板横屏（手牌行横向滚动化或 fixed 钉底）。
- **验收**：五视口手牌与回合三键可达；915 回归 N-4 数字。

### U-16 memory-cards 卡片网格出屏 + 模式键 36px 🔧【P1 · B】

- **实测**：1024×768 单人卡 @593–869、双人卡 @522–847；1180×820 双人 @563–1213；768×1024 双人 @909–1128；915×412 双人 @338–476——全部 HARD-OUT。模式键「记忆挑战/双人轮流翻/记忆辅助」36px、「回选关/动物园」35px（五视口同值）。
- **修法**：`src/games/memory-cards/index.ts`——卡片网格套第十四节军规（高度反推钳）；模式键补 `min-height:44px`。勿改翻牌配对逻辑与洗牌 seed。
- **验收**：五视口单人/双人全部卡片可见可点、卡 ≥44px；模式键 ≥44。

### U-17 puzzle-tiles 拼块出屏 🔧【P1 · B】

- **实测**：915×412 九块只见首排（@322–749 HARD-OUT）；1024×768 @579–1000；1180×820 @793–1000。「💡 提示 x3」102×34、「🔍 角落小图」101×32、模式键 38px 触区不足。
- **修法**：`src/games/puzzle-tiles/index.ts`——拼图盘高度反推钳（第十四节）；工具键抬 44。勿改拼图切片/求解逻辑。
- **验收**：五视口整盘拼块可见；工具键 ≥44。

### U-18 match-stars 消除盘出屏 🔧【P0 · B】

- **实测**：915×412 第 2 行起全部出屏（@382–463 HARD-OUT，6×6 盘只见 1 行，**没法玩**）；1024×768 / 1180×820 第 6 行 @743–823。390×844、768×1024 绿。
- **修法**：`src/games/match-stars/index.ts`——盘面高度反推钳（第十四节）。勿改三消判定/掉落顺序。
- **验收**：五视口 6×6 全盘可见；格子保持 ≥44 或按棋盘观察口径记录。

### U-19 sky-squad D-pad 38–42px + 915 整排切底 🔧【P1 · B】

- **实测**：D-pad+武器 ◀▲▼▶💠💣 六键 390×844 = 38×38，其余视口 42×42（<44 红线，这是**主操作键**不是观察格，不豁免）；915×412 整排 @396–438 切底 26px（单人/双人合作同炸）；模式键「云海远征/双人合作/双人同屏」32–36px。
- **修法**：`src/games/sky-squad/index.ts`——键抬到 ≥44 并 fixed 钉底（915 档），画布让高；模式键补 min-height:44。
- **验收**：五视口六键 ≥44 且 bottom ≤ 视口底。

### U-20 prince-princess 平板横屏键排出屏 🔧【P2 · B】

- **实测**：仅 1024×768 中招：◀⬇▶🔁 @732–784 HARD-OUT（闯关与「两人一起」同值）；其余四视口绿。
- **修法**：`src/games/prince-princess/index.ts`——现有矮屏档扩到 `(max-height:800px) and (min-width:700px)` 或键排 fixed；幅度小（52px）。
- **验收**：1024×768 键排在屏；其余视口零回退。

### U-21 mine-garden 矮横屏下三行出屏 🔧【P1 · B；若 r14 已有号则并号】

- **实测**：915×412 单人与双人同屏第 4 行起 @358–448 HARD-OUT（扫雷盘只见 3 行）；四视口绿。
- **对账**：r14/r15 量过「扫雷双人」未见立号修复；测试员先 `rg "mine-garden" docs/qa/trio-r1[4-8]*` 对账，有号并号、无号用 U-21。
- **修法**：`src/games/mine-garden/index.ts`——盘面高度反推钳（第十四节）。勿改地雷布点 seed。
- **验收**：915 全盘可见（格子可按观察口径 <44，但须可点）。

### 旧号增补 / 观察（不开新号）

- **C-6 增补（归 A）**：alien-seek 关内 L1 —— 915×412「＋－⤢」@394–438、「🔭 望远镜」@446–490；1024×768 @755–924；1180×820 @831–973 全 HARD-OUT。C-6 历史修的是「pads 钉舞台」，r15 曾复点仍开；本数字说明 L1 四视口仍病，**修 C-6 时以本表为验收基线**，不另立号。
- **U-2 扩面（第 3 轮新增对象）**：shoot-range「👆 预览」73×36、「⏸️」41×36、「← 返回」72×35（五视口）；bowling-lane「⏸ 暂停」67×34、「◀ 回选关」74×30；puzzle-tiles 工具键 32–38；memory-cards 模式键 35–36；sky-squad 模式键 32–36。修各自 U 号时一并抬 44。
- **观察（豁免口径，不修）**：red-blue-tap 🔵22（棋子观察，r16 已豁免）；dark-chess 暗子 22–37、bubble-pop 泡泡 19–36、lianliankan 图案格 25、flight-chess ×2 徽记 12–29——均为盘面观察记号；junqi-camp 双人暂停键与 music-stars 工具排为 soft-out（可滚达），不立号。

## 十四、新框架军规（第 2 条）：宽度驱动的网格必须做「高度反推钳」

**病理**：`aspect-ratio:1` 的格子网格（洞 / 卡片 / 拼块 / 消除珠 / 雷区）尺寸由「容器宽 ÷ 列数」驱动。矮横屏（915×412）与平板横屏（1024×768、1180×820）下容器宽 ≫ 可用高，网格总高按宽等比膨胀，直接顶穿 `overflow:hidden` 的 l99 舞台——本轮 C-5（mole-pop）、U-16（memory）、U-17（puzzle）、U-18（match-stars）、U-21（mine-garden）五款同族，无一例外。

**军规**：任何行数固定的 aspect-ratio 网格容器必须带**高度反推钳**：

```css
.xx-board {
  max-width: min(100%, calc((100dvh - CHROME预算px) * 列数 / 行数));
  margin-inline: auto;
}
```

CHROME 预算 = 壳顶栏 + l99 stagebar + HUD + 底部键排的实测高（用 `getBoundingClientRect` 量，别拍脑袋）。行数随关卡变化的游戏在 JS 里算（参照 `fitPaneH` 的钳制思路）。**review 口径**：新增/修改网格布局的提交，没有高度反推钳或等效 JS 钳制的，直接打回。

## 十五、第 3 轮干净清单（五视口全测过，下轮不必重量）

adventure-king / poop-hero / ocean-munch / dot-maze / block-drop / red-blue-race / red-blue-tug / kitty-care / fishing-star（入口与地图；商店入口未在 entry 露出，下轮想测商店需先进关）/ gold-hook 入口 / junqi-camp（双人暂停 soft-out 可滚达）/ dark-chess（暗子豁免外全绿）/ lianliankan 平板竖屏与手机竖屏 / music-stars（工具排可滚达）/ shoot-range 布局（除 U-2 触区）/ puff-bros（双人 @915 底切 7px 贴线观察）。

## 十六、更新版「A/B 立刻动手前 5 项」（覆盖第 2 轮版本）

| 序 | 项 | 工位 | 状态 |
| --- | --- | --- | --- |
| 1 | **N-105**（原 U-6）主干 5 红灯：combo-clash/mahjong-bloom 14px | B | **待认领**（r18 第零优先，先合版占号） |
| 2 | **U-13** bowling-lane 投球 CTA 四视口不可达 | B | 新（本轮，P0） |
| 3 | **U-14** flight-chess 掷骰/机架四视口不可达 | B | 新（本轮，P0） |
| 4 | **U-18** match-stars 915 只见 1 行 + **U-7** tank-battle 双人操控不可达 | B | U-18 新；U-7 **待认领**（第 2 轮） |
| 5 | **U-9** chess-garden 平板横屏工具行（styles.css）+ **C-5**（原 U-8）mole-pop 洞格 | A / B | U-9 待认领；C-5 待认领（并号后按四视口验收） |

同族打包提示：U-16/U-17/U-18/U-21 与 C-5 全走第十四节「高度反推钳」，B 可一口气按同一配方连修五款（每款独立提交 + 独立回归数字）。

## 十七、本机监督对账（云端额度耗尽后的续修，PR #107）

已推进、待合入 `game-1.3`：U-1/U-2(部分)/U-3/U-4/U-7/U-9/U-10/U-11/U-13(摘合)/U-14(摘合)/U-15/U-16(模式键+棋盘限宽)/U-17(钳盘+工具 44)/U-18/U-19/U-20/U-21/C-5；N-105 主干已绿。

本机续修增量：N-100 选关头/工具 sticky 扩到 `840 && min-height:501`（不覆盖 500 档）；仓鼠/围棋/翻翻乐/扫雷双人/勇者大厅平板钉底或钳盘；保龄暂停/回选、射击预览、红蓝竞速返回、对数对决返回、数独键 后盖 44；贪吃蛇 840 加 `min-height:501` 以免盖掉 N-81 的 fixed。

再推：保龄/碰碰车/钓鱼 720 收档扩到 `840 && min-height:721`（1024×768 原不命中 720）；点点迷宫/对数对决横屏分栏扩到 `840 && min-height:521`；勇者无尽战报钳高；选关地图宽屏 wrap 820→960 减留白。下一轮优先：U-5 画布封顶（tap-tiles `stageWidth(1200)=460` 有守门，勿改数字）、商店底栏、云端 A/B 四视口实测。

## 附：第 3 轮环境水位

- 环境再次重置后 `npm ci` + `npm run build` 全绿；零改 src，未重跑全量 vitest（水位沿用：19484 绿 + N-105 的 5 红）。
- 抽测统计：28 款 × 5 视口 × entry/level1/双人二跳 = 320 条测量；HARD-OUT 判定内置可滚祖先复核，soft-out（可滚达）一律不立号。
