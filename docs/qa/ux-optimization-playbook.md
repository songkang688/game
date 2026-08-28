# UX 优化 playbook（学习员 #3 · 技能对照版，零 src 改动）

> **第 2 轮更新**。基线：`origin/game-1.3 = c8a3d154`（已含 r17 全部：N-89 壳标题、N-75…N-85 源码 PR #78、N-77/N-87/N-88/N-86、云学习员撞号改 N-94…N-97）。
> **定位**：与 `trio-rN-learn-notes/playbook` 的逐案抽验并行，本文是「模式层」清单——把 `.cursor/skills`、r4–r17 沉淀配方与当前实现对照出的**系统性差距**，写成两个测试代理可直接执行的条目。
> **编号纪律**：本文条目一律用 **U-x**，不占 N 号。**N 号水位：N-97 已用**（N-90/N-91 r17 B 在途、N-92/N-93 归 r18 学习员与已销守门红、N-94…N-97 已收录 `c8a3d154`）。#1（A 壳+学习）领 **U-101…**，#2（B 休闲对战）领 **U-201…**，共通项 U-1…。测试中发现的**新伤只记数字与文件**，N 号交学习员统一编，避免撞号。
> **对账纪律**：动手前 `git log --oneline -20` + 查对应 `*.test.ts` 是否已在树。**在途撞车警示（本拍）**：`cursor/tester-b-r17-fixes-3c67` 已带 N-78/N-79/N-83/N-84/N-85/N-55 修复（shoot-range / prince-princess / gomoku / snow-fight / tank-battle，双栏横屏方案）未合——碰这五款前先看该分支，撞车取先合版。
> **视口口径（父监督红线，替代第 1 轮的 412×915）**：主测 = 手机竖屏 **390×844**（必须能划到底）+ 平板横屏 **915×412**（地图/按钮不裁切）；加抽 360×800 与 768×1024。管理员密码 `kangkang`，默认 1 小时、可永久，密码不落盘。

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

## 二、差距表：别人做得好 vs 我们缺什么

| # | 别人做得好 | 我们现状 | 缺口 |
| --- | --- | --- | --- |
| G-1 | 安全区四边都躲（skills 质量地板；本仓 `.overlay` 已四边 `styles.css:3297`） | `.screen` 只垫顶（3288），水平 padding 是 `clamp(14px,4vw,32px)`（261 行） | 横屏刘海 inset 可达 44px+，32px 顶不住：**左右 inset 未接** |
| G-2 | 逐面回归（本仓 915×412 已刷 17 轮） | 竖屏无一轮系统抽验（1.2 只守 360 文本红线）；父监督已把竖屏 **390×844** 钉为主测视口，r18 A 首次列入走查计划 | 竖屏账**本波开建**：D-pad、手牌、盘类的 390×844 数字仍空白，U-101/U-201 落地 |
| G-3 | 修复走共享工具（`stagePlayRoom`、mobileText 常量） | 各游戏 fit CSS 手写魔法数（`min(248px,58dvh)` 式散在 20+ 文件） | 新修复不引用工具就会继续攒魔法数；**修复必须引用配方编号** |
| G-4 | 选关地图密度随屏幕走 | `.l99-grid` 固定 5 列（`level99.ts:568`），无守门测试钉死 | 平板横屏浪费一半宽、竖屏滚动长一倍；可加列但格子须保 ≥44px |
| G-5 | reduced-motion 全覆盖 | 壳层/styles.css 有 8 处 guard；**59 款**游戏文件带 `animation:`，仅 ~10 文件有 `prefers-reduced-motion` | 装饰动画（浮动、脉冲）大面积无 guard |
| G-6 | 色彩 token 单一来源 | 壳层用 `--ink/--ink-soft` 等变量；游戏内联 CSS 各自硬编码粉彩 hex | 仅列为「触碰该文件时顺手」项，不专开 PR |

## 三、P0 可玩性 / 滚动 / 过小

### 3.1 号池现状（第 2 轮对账后；先对账再动手，量法与数字出处 r15–r17 notes）

**已合只回归（禁止第二套实现）**：N-75…N-85 源码（PR #78）、N-89 壳标题（`10022068`）、N-77/N-86/N-87/N-88、C-6/N-37/N-63/N-68/N-73。回归口径：915×412 逐款留数字；**N-79/N-81/N-82/N-83 r15 未稳定进局**，必须进局实测（进对局/无尽场，菜单绿不算），未绿则修。

**#2（B 休闲对战）仍开**：

- [ ] N-94 duo-vs-star 双人选人「开打 ▶」top 451（≠ N-88；sticky 底或并排）
- [ ] N-95 xiangqi 自由对战设置屏「开始下棋」713、overflow hidden **滚不到**（最重：先给设置屏滚动盒，再钉 CTA；≠ N-67）
- [ ] N-96 bomb-buddies 双人棋盘画布底 475 出屏 63px（配方 B 钳画布）
- [ ] N-60/61/62 orb/snake-royale/merge-2048 贴线残余：键顶 394–398 仍切 28–32px（**只再垫**，禁改 `*_SHORT_PANE_H=200` 守门、禁按整钮线下重写）
- [ ] N-12 pool-stars 击球 425/暂停 482（矮横屏无媒体查询）；N-10 weiqi-garden 工具 450、盘出屏 43（配方 B）
- [ ] N-3 star-estate 地格 13px@429（「过小」红线：热区 ≥44 或整体缩格）
- [ ] N-55/N-78/N-79/N-83/N-84/N-85：**r17 B 在途分支已修**（双栏横屏），先对账 `tester-b-r17-fixes-3c67` 合入状态；已合只回归，未合勿双开

**#1（A 壳+学习）仍开**：

- [ ] N-97 math-farm root×深关选项 top 416（≠ N-37 shape；L1 绿，必须 root 直达深关后量）
- [ ] N-11 bowling 关内 587（勿回滚 `showMap(true)`）
- [ ] C-8 balloon-pop **闯关** 气球 455（无尽是 N-82，勿混账）
- [ ] N-46/N-56 残余 sky-squad 闯关六键 408 + h42
- [ ] N-90 tap-tiles / N-91 fruit-catch：r17 B 在途，**不认领**，只在报告记合入状态

### 3.2 U-1 竖屏 390×844 首扫（G-2 落地；视口从第 1 轮的 412×915 改为父口径 390×844）

- [ ] **U-101（#1）**：壳层+学习类 6 款竖屏量点：首页首屏（首卡 top ≤ 844）、l99 选关地图（`.l99-node-cur` 在可视区）、find-diff 三图关、shape-kingdom 深关选项、music-stars 视奏、clock-house。r18 A 的 390/915/360×800/768×1024 壳层走查若已交数字，只补缺口不重量。
- [ ] **U-201（#2）**：操作密集 8 款竖屏量点：box-hamster / prince-princess / tank-battle / snow-fight / shoot-range（D-pad 类，先对账 r17 B 双栏方案在竖屏的表现）、mahjong-bloom / landlord-cards（手牌类）、gomoku（盘类）。
- 量法同 r4：`getBoundingClientRect` 控制排与画布，`crop = scrollHeight − clientHeight`，折叠数；每档独立 `createBrowserContext()`。
- **红线**：竖屏下控制排必须整排可点（top+h ≤ 844）、必须能划到底（见 §六.3）、热区 ≥44px、画布不出屏；正文 ≥16px、控件字 ≥14px（`src/ui/mobileText.ts` 常量）。
- 发现新伤：只在报告里记「文件 + 数字」，勿自编 N 号（水位已到 N-97，统编归学习员）。

## 四、P1 关卡排布 / 安全区

- [ ] **U-2（#1）横屏左右安全区**：`src/styles.css:261` `.screen` 的水平 padding 改为 `max(clamp(14px,4vw,32px), env(safe-area-inset-left,0px))`（右同理，用 padding-inline 两值写法）。无 inset 浏览器 `max()` 落回原值，布局零变。验收：DevTools iPhone 横屏模拟，返回按钮/暂停钮不入刘海带；1024×768 布局零回归。
- [ ] **U-3（#2）l99 地图平板密度**：`src/games/level99.ts` `.l99-grid` 固定 5 列，加 `@media (min-width:700px){.l99-grid{grid-template-columns:repeat(7,1fr);}}`（或 auto-fill minmax(56px,1fr)）。验收：915×412 章节页滚距减半；`.l99-node` 实测宽 ≥44px；420px 以下 5 列不变；无守门测试钉列数，但需**新增**一条断言媒体查询存在。
- [ ] **U-4（#1）地图当前关首屏回归**：进任一 188 关地图（bowling、hop-pads、rainbow-run 抽 3 款），`.l99-node-cur` 必须在可视区（`scrollIntoView({block:"center"})` 已做，补 915×412 与 390×844 两档数字回归即可）。
- [ ] **U-5（#2）选关格「过小」下限**：抽 3 款自带选关 UI 的游戏（candy-swing `.cs-map`、bubble-aim `.ba-map`、brave-path），量节点热区 ≥44px、星标 ≥12px；小于就按配方 B 之 3 缩列不缩格。

## 五、P2 视觉

- [ ] **U-6（#2）reduced-motion 扫描**：`rg -l "animation:" src/games -g '!*.test.ts'` 得 59 文件，对照 `rg -l "prefers-reduced-motion"` 差集；只给**纯装饰**动画（浮动/脉冲/彩带）补 `@media (prefers-reduced-motion:reduce){...animation:none}`，与玩法判定绑定的动画不动。每款一行 guard + 一条断言。
- [ ] **U-7（#1）文案 review 红线**（frontend-design skill）：本轮所有新增/改动按钮，文案=动作本身（「继续玩」不是「确定」）；错误态必须给出路（「先玩别的吧」式）。列入 PR 自查，不单独开条。
- [ ] **U-8（两位顺手）色彩 token**：触碰某游戏 CSS 时，与壳层 `--ink/--ink-soft/--shadow-soft` 重复的 hex 顺手改引用变量；**不专开 PR、不扫全库**。

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

## 七、第 2 轮给 #1/#2 的可勾选执行清单

**#1（A 壳+学习）**——基于 `game-1.3` 最新（≥ `c8a3d154`），按序执行：

- [ ] 对账：`git log --oneline -20`；r18 A 自己的红灯修复（combo/mahjong 16px）若未合先合；确认 N-89/N-77 等已合号只回归
- [ ] N-97 math-farm root×深关选项 416（root 直达深关后量，≠ N-37；修复配小测试）
- [ ] N-11 bowling 关内 587、C-8 balloon-pop 闯关 455、N-46/N-56 残余 sky-squad 408+h42（仍开则修）
- [ ] U-101 竖屏 390×844 首扫（§3.2 的 6 款；与 r18 A 走查对表，只补缺口）
- [ ] U-2 横屏左右安全区（`styles.css:261`，验收 §6.5）
- [ ] U-4 地图当前关两主档回归（bowling / hop-pads / rainbow-run）
- [ ] U-7 文案自查（新增按钮=动作本身、错误给出路）
- [ ] 交卷：§6.1 水位 ≥ 1193/19489；每条两主档数字；报告写进 `docs/qa/trio-rN-tester-A.md` 当轮文件

**#2（B 休闲对战）**——基于 `game-1.3` 最新（≥ `c8a3d154`），按序执行：

- [ ] 对账：`tester-b-r17-fixes-3c67`（N-78/79/83/84/85/55 双栏方案）合入没有；已合只回归，未合**不双开**
- [ ] N-95 xiangqi 设置屏 713 滚不到（最重，阻断级：先滚动盒后钉 CTA）
- [ ] N-94 duo-vs-star 开打 451、N-96 bomb-buddies 画布出屏 63（配方 B / sticky 底）
- [ ] N-75…N-85 进局回归留数字（重点 N-79/81/82/83 进局实测，菜单绿不算）
- [ ] N-60/61/62 贴线只再垫（禁改 `*_SHORT_PANE_H=200` 守门）；N-12 / N-10 / N-3 仍开则修
- [ ] U-201 竖屏 390×844 首扫（§3.2 的 8 款，D-pad 类顺带验双栏方案竖屏表现）
- [ ] U-3 l99 平板 7 列（新增媒体查询断言）、U-5 选关格 44px 下限抽查
- [ ] U-6 reduced-motion 扫描（纯装饰动画限定，每款一行 guard + 一条断言）
- [ ] 交卷：§6.1 水位只增不减；每条两主档数字；报告写进当轮 `docs/qa/trio-rN-tester-B.md`

**两位共通**：矮屏收缩红线 §6.6 逢改必查；新伤只记「文件+数字」勿自编 N 号；撞车取先合版。
