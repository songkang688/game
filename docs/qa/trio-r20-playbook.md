# 三人组第 20 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r20-learn-notes.md`（含四线编号对账矩阵）。基线 `origin/game-1.3 = 8b23ab11`。
> 本单新伤 **N-108…N-116**（N-113 = 主干红灯最优先）；续办 r19 的 N-103…N-107 与 r18 未销项。
> **禁止重做（已合/已结案）**：N-47/63/68/73/77/89、C-6、N-37、N-75…N-88、N-86、N-69…74、
> **N-60/61/62/90/91（r18 结案）**、N-40 赛道 sticky、`OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、`SKY_H=420`。
> **弃用号**：N-100…N-102 谁都不许用；N-92/N-93 归 r18 tester A 在途，勿抢勿重定义。
> A = 壳层 + 闯关学习（`src/styles.css`、`src/ui/**`、`level99.ts`/quiz99 与学习款）；
> B = 休闲 / 对战 / 动手（各游戏目录）。撞车取先合进 `game-1.3` 的版本。

## 进场对账（先做，红灯不清不动布局）

1. `git fetch origin` 后核对主干与四条在途线（r18 tester A `4970d8ef` / tester B `1c93b984` / c337 `f9cd2577` / U 系 `1c522fb3` / r19 `c33650c1`）谁已合入：
   - **已合的号只回归**；c337 版 r18 笔记若后合，其 N-92…N-99 语义作废（对账矩阵见 learn-notes 第一节）。
   - tester B `1c93b984` 含 **N-81 无尽花园 / N-55 十二键 fixed 钉底**——已合则 N-55 只回归。
2. **N-113 主干红灯**（P0 第一件事）：主干水位 **1193 files / 19489 tests 含 2 文件 5 用例红**（`.cc-info`/`.mj-goal` 14px 破 360 守门）。tester A `46b26d1e` 与 tester B `18c63e9d` 在途已各修一版——**优先合先到者**；两版都没到就由 B 抢修（两处字号回 16px、`.mj-goal` 去 nowrap 补 `overflow-wrap:anywhere`），**不许砍守门测试**，也别回退 N-75/76 键排。红灯不清，后续交卷全部被挡。

## 红线（一字不差）

- 不改存档 key / `meta.id` / 题库 / seed / 胜负 / 按键映射。测试只增不减；改守门意图交卷写明。
- 管理员密码 `kangkang`；量 root 态种 `yiduo-yixing.root.v1 = {"expiresAt":253370764800000,"mode":"permanent"}`。
- 热区 ≥44px（豁免仅棋盘观察格与装饰字符）；说明文字最后生效块 ≥16px、控件 ≥14px。
- 新增动效带 `prefers-reduced-motion` 降级；禁用会波及祖先的 `scrollIntoView`（N-63）。
- 修「切底」类伤的救济档一律用 `max-height` 口径（如 `(max-height:900px)`），**不要只写 500 档**（平板档缺口，learn-notes 2.3-1）。
- 收尾：rebase → `npm test` && `npm run build`（以「N-113 修复后全绿」为交卷水位）→ 禁 force。

## 测试步骤（先测什么）

1. `npm test`（确认红灯状态）→ N-113 处置 → `npm run build` + `npx vite preview --port 4173`。
2. 视口：**390×844 竖屏 → 915×412 横屏**主档，**1024×768 修复必测第三档**（本轮起），1180×820 抽验。
3. 触摸用 `page.touchscreen` 实测；「滚不动」类先量裁切祖先（overflow + scrollHeight/clientHeight），再决定钳高还是 fixed，**不要盲加第二套键**。
4. 每条留主档两组 + 平板一组 top/bottom 数字。

---

## 壳层 + 闯关学习（A）

### N-108 l99 地图进场卷顶 🔧（P0；新）

- **实测**（c337，915×412）：多章节款进场「开始冒险/继续 ▶」与工具行被卷出视口顶——word-garden **−154~−110**、ice-fire-forest −104、xiangqi −50、landlord −52、bumper-cars −39；root×pinyin-train「🎫 直达」−54 全不可见。390×844 / 1024×768 全 IN。
- **根因**：`level99.ts` L986–1014 `showMap(true)` 对当前关 `scrollIntoView({block:"center"})`——地图总高超视口时 center 把 head 推出 `.l99-view` 顶。
- **修法**：进场（`mountLevelGame` 尾部 L1176 的 `showMap(true)`）滚动策略改「head 优先」：当前关改 `block:"nearest"`，或聚焦后钳 `view.scrollTop = Math.min(view.scrollTop, headBottom)` 保 head 可见；「🎯 跳到当前关」按钮路径（L882–887）**保留 center 居中**（那是用户主动要求聚焦）。`.game-stage` 归零逻辑（N-63，L999–1013）一行不动。
- **禁止**：动 `showMap(true)` 四处调用点的语义；回退 N-63/N-39。
- **验收**：915×412 上述 5 款 + root×pinyin-train 进场即见「继续 ▶」（top ≥0）与工具行；点「跳到当前关」当前格仍居中；390/1024 不回退。

### 续办 N-103/N-104/N-105（r19 在途，若未合照 r19 playbook 原文执行）

- N-103 页签 emoji 徽章收纳（守门联动三条见 r19）、N-104 密度+136px 常数、N-105 `touch-action:pan-y`+滑到底实测。**N-108 与 N-103 互补**：先修 N-108（进场可见性），N-103 落地后地图总高下降会进一步减轻卷顶——两者都做，验收分开记。

### N-116 首页 hero 平板横屏偏肥 🔧（P2）

- 1024×768 首卡 top **557**。styles.css 新增 `(min-width:700px) and (max-height:840px)` 档只收 `.home-hero` 边距与 `.hero-figure`（或复用 S-1 隐藏插图方案）。S-1 的 480/500 档零回退；筛选热区 ≥44 不变。
- 验收：1024×768 首卡 top ≤500；390×844 / 768×1024 数字不回退。

### A 面回归

- N-99 sudoku / N-97 math-farm（r18 单）以主干对账；N-63/N-89/N-92/N-93（若 tester A 已合）只回归。

---

## 休闲 / 对战 / 动手（B）

### N-113 主干红灯 🔧（P0 最优先，见「进场对账」第 2 条）

### N-109 duo-vs-star 赛中 14 键全线下 🔧（P0；重；≠ N-94 选人屏）

- 915×412 键柱 **400~746 OUT**（`.game-stage` 滚 334/711），触屏两人没法打；canvas 122~302 IN。
- 修法：双列虚拟键照 N-75/N-40 配方 sticky/fixed 进 412（键可适当收尺寸但 ≥44）；canvas 显示高相应让位。**勿改按键映射/判定/canvas 逻辑分辨率**。390×844 赛中未量过——修完两档都留数字。
- 验收：915 十四键全部 bottom ≤412 且 ≥44；390 赛中键排 IN；选人屏（N-94）另验。

### N-94 duo-vs-star 选人（r17 遗留 + c337 补充数字）

- `.dvs-go` 439~488 OUT 钉进 412（N-88 配方）；`.dvs-pick` h=30、`.dvs-back` h=40 抬到 44。390 已绿（631~680）勿回退。

### N-95 xiangqi 设置屏（r17 遗留 + c337 补充）

- `.xq-start` **701~755 OUT**、先手行 587~689 OUT（`.l99-host` 滚 334/765）。横屏改两栏（难度左、先手+CTA 右）或独立卷轴 + CTA 钉底。模式芯片行 66~110 IN、残局学堂已绿——都别误伤。

### N-110 bumper-cars 🔧（P1；r19 名单实锤）

- 915 画布 **140×140** 太小（390 同局 331×331 正常）：按 `fitPanesToStage`/显示放大口径把画布吃满余量，**碰撞世界尺寸不动**；`.bc-open` h=34、`.bc-pick` h=32 抬 44；1024×768 两颗刹车切 17 一并收。
- 验收：915 画布 ≥240px 见方且不切；三档视口刹车/芯片 IN 且 ≥44。

### N-111 ice-fire-forest 🔧（P1；名单实锤）

- 915 主画布 232~471 底切 **59**（`.l99-stage` 滚 220/394——裁切链定性见 learn-notes 2.3-2）。钳显示高进 412 或回填口径；键垫 253~393 IN 勿动。

### N-114 模式键 44px 通病 🔧（P1；跨款）

- 已实锤：fruit-catch h=37、balloon-pop h=40、duo-rush h=43。逐款内联 CSS 补 `min-height:44px;box-sizing:border-box`；先 `rg` 各款 visual/copy 守门是否钉 padding 原文；**一次提交 ≤6 款**防撞车。修完 `rg -n "padding:9px" src/games/*/index.ts` 扫同类写法登记（不必本轮全修）。
- 验收：修过款所有可见模式键 `offsetHeight ≥44`（390 与 915 两档）。

### N-3 star-estate 验收面扩大（U-1 归并）

- 除 915/390 外，**1024×768（切 26）与 1180×820（切 24）也要修**：新增 `(max-height:900px)` 档套用 500 档同款 `.se-pad` sticky + `.se-board-wrap` 钳 `min(280px,52dvh)`。**勿动** 500 档现值与 `stickyPad.r10`/`viewportCap.r14` 守门；地格 26px 观察豁免维持。
- 验收：四视口掷骰/购买/结束回合 bottom ≤ 舞台底；500 档回归数字不变。

### N-112 landlord `.ld-back` h=33 🔧（P2，轻）

- min-height:44 一行；叫分/暂停 IN 勿动。

### N-115 duo-rush 竖屏菜单 🔧（P2；先量再修）

- 390「开跑」先量：线下才把 `.dr-menu-cta` sticky 从 500 档扩到 `(max-width:480px)` 档（一行媒体条件）；收藏册 816~859 可滚达非硬伤。`.dr-btns` sticky（N-40）零回退。

### B 面续办与名单

- r18 未销项：N-98 hue-hand、N-96 bomb-buddies、N-12 pool-stars（两档）、N-55（tester B 在途已修则回归）、C-8、N-10 残余——以主干对账，未合照 r18 playbook 原文。
- r19「9 款未量名单」更新：bumper-cars/ice-fire-forest 已实锤开号，**剩 7 款**（block-drop、box-hamster、dark-chess、prince-princess、shoot-range、snake-snack、tank-battle）继续按 r19 口径抽验，坏则套 N-75/N-99 配方、新伤记候补号不自行开号。

---

## 不要动什么（划重点）

1. 玩法/数值/胜负/seed/题库/存档 key/`meta.id`/按键映射——一个字不动。
2. `SKY_H=420`、`*_SHORT_PANE_H=200`、N-40/N-63/N-89 配方、r18 结案批（N-60/61/62/90/91）。
3. `showMap(true)` 四处调用语义与 `.game-stage` 归零（N-108 只改滚动策略）；`.l99-tab`/`.l99-node-lock`/`.l99-jump-input` 类名。
4. 在途 16px 红线修复（`.cc-info`/`.mj-goal`/brave-path）rebase 撞车保先合版；不写第三版 N-113。
5. sprout-defense/ocean-munch 的 canvas 内部热区本轮不动（无头量不到，留人工抽验）。
6. N-100…N-102 弃用号；r14–r20 已有笔记原文；工装不进库；系统字体缩放 rem 化仍禁动。

## 完成定义

1. **N-113 清红是交卷前提**（合先到者或 B 抢修）。
2. A：N-108 落地（进场即见 CTA，5 款 + root 态数字）；N-103…N-105 以主干对账续办；N-116 做或降级。
3. B：N-109（重）、N-94/N-95 落地；N-110/N-111/N-114/N-3 平板扩面做或书面降级；N-112/N-115 轻项顺手；7 款名单继续消化。
4. `npm test` / `npm run build` 全绿只增不减；每条修复配小测试；救济档新增一律含 `max-height` 口径说明。
5. 每条留 390×844 + 915×412 + 1024×768 三组数字；交卷写 `docs/qa/trio-r20-tester-A.md` / `trio-r20-tester-B.md`（新文件），改守门意图写明。
