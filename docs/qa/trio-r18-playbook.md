# 三人组 99 轮战役 · 第 1 轮（trio-r18）· 下一轮测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r18-learn-notes.md`。基线 `e58ccceb`；进场水位 **1193 files / 19489 tests，其中 2 文件 / 5 用例红**（= N-99 主干红灯，B 先抢修）。
> **禁止重做**：N-47/63/68/73/77、C-6、N-37、N-75…N-88、N-89（`10022068` 已合）、N-40 赛道 sticky、N-32、
> `OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、balloon-pop `SKY_H=420`。
> **不覆盖** r14–r17 笔记原文。**勿与在途抢文件**：本拍 r18 测试员 A（占 `home.ts`/`styles.css`/壳层与选关滚动）、
> r18 测试员 B（占 duo-rush / fight-king / brave-path 回归）可能尚未合入 —— 动手前先 `git fetch` 看主干有没有他们的 commit，撞车取先合版。
> A = 壳+闯关学习；B = 休闲对战动手。本轮新伤 **N-92…N-98**（学习员实测数字见 learn-notes 第三节）。

## 纪律

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。禁 force。测试只增不减。
- 验收 **915×412** `getBoundingClientRect` 留数字；N-92/93/95 另附 390×844 与 1024×768 不回退数字。
- root 档独立 context（`yiduo-yixing.root.v1` 永久档）；开/关各一档。
- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。

---

## 壳层（A）—— 独占 `src/games/level99.ts`、`src/ui/*`、`src/styles.css`

### N-92 915×412 进场「开始冒险 ▶」+ 工具行卷出视口顶 🔧（主攻）

- 现象：章节 tab 折多行的款，进场 `.l99-view` 被当前关 scrollIntoView 卷到 300+，`.l99-continue` / `.l99-tools`
  （跳到当前关、攻略、跳过）全在视口上方。实测：word-garden -154、ice-fire-forest -104、xiangqi -50、
  landlord-cards -52、bumper-cars -39；**root 加重**：pinyin-train 的「🎫 直达」-54、「⏭️ 跳过（管理员）」-106。
- 修法方向（选其一，先小后大）：
  1. 进场滚动锚定改为「当前关在 `.l99-map` 盒内居中、`.l99-view` 顶不动」（例如对 `.l99-map` 自建滚动，或 scroll 计算 clamp 到工具行以下）；
  2. 或把 `.l99-continue`+`.l99-tools` 行在 `max-height:500px` 档 sticky 到 `.l99-view` 顶。
- **红线**：不改 `showMap(true)` 四处调用（N-39/N-63 前车）；模式芯片行（`.ld-open`/`.bc-open`/`.xq-mode`）实测 IN，勿动；
  不碰 `OA_SHORT_PANE_H` 等 paneH 常量。若在途 r18-A 的「选关滚动」已合类似修法，先 915 回归再决定要不要补。
- 验收：上述 6 款 915×412 进场 `.l99-continue` 与 root「🎫 直达」top ≥ 0；390×844（pinyin-train CTA 43~87）与
  1024×768（match-stars 162~206）不回退；当前关节点仍在屏内。

### 回归（只留数字，不改代码）

- N-89 壳标题收高（`10022068`）；N-77 相册；N-63 保龄/hop-pads 地图模式钮 IN + scrollTop 0。

---

## 休闲对战（B）—— 独占 `src/games/{duo-vs-star,bumper-cars,ice-fire-forest,xiangqi,landlord-cards}`

优先级从高到低：

### N-99 主干红灯抢修 🔧（第一优先，先于一切新伤）

- PR #78 `81b228c2` 的 `@media (max-height:500px)` 把 `combo-clash .cc-info`、`mahjong-bloom .mj-goal` 调到 **14px**
  （`.mj-goal` 还锁 nowrap），破 360px 文字 ≥16px 守门：`src/ui/mobileText.test.ts` 3 例 + `src/games/window1-mobile-text.test.ts` 2 例红。
- 修法：两处媒体查询字号回 **16px**、`.mj-goal` 解 nowrap（可 `max-height:2.8em` 两行截断）；矮横屏高度紧就收 padding/max-height，不动字号。
- **红线**：不许砍/放宽守门测试；不许回退 N-75/N-76 的 fixed 手牌与键排布局。
- 验收：`npx vitest run` 全绿（1193 files / 19489 tests，0 红）+ 915×412 复量 `.cc-info`/`.mj-goal` 仍在屏。

### N-94 duo-vs-star 赛中触屏键柱全线下 🔧（重，先做）

- 双人对战开打后 915×412：canvas 122~302 IN，但两列 ◀▲▼▶✋💥🤝（h=46）**400~746 全 OUT**，触屏两人没法打。
- 修法参照 N-75 麻将手牌 fixed / N-40 sticky：矮横屏把两列键柱放 canvas 左右两侧（915 宽横向有余量 x:294~622 之外全空），
  或 `@media (max-height:500px)` 压缩键距钉进 412。**勿改**出招判定、`battle.ts` 状态机、键盘映射。
- 验收：915×412 十四键 bottom ≤ 412、h ≥ 44；390×844 竖屏键位不回退。

### N-93 duo-vs-star 选人屏 CTA 线下 + 触区 🔧

- 「两人就位，开打 ▶」`.dvs-go` 439~488 OUT；`.dvs-pick` h=30、`.dvs-back` h=40。
- 修法：矮横屏 `.dvs-go` sticky 底（参照 N-87 `.dr-menu-cta` 先例）；`.dvs-pick` min-height 提到 44（横屏两行放得下，165~330 有空间）。
- 验收：915×412 `.dvs-go` 全钮 IN；390×844 631~680 不回退；六模式卡 165~370 IN 不回退。

### N-97 xiangqi 自由对战面板横屏分栏 🔧

- 单列 207px 窄卡两侧全空白，「开始下棋 ▶」701~755 OUT（滚两屏半）。
- 修法：`@media (min-width:700px) and (max-height:500px)` 把难度/先手/CTA 分 2~3 栏横排，或 CTA sticky 底。
  **勿改**六档 AI 难度、先手逻辑、残局课数据。
- 验收：915×412 `.xq-start` IN；模式芯片 66~110 不回退。

### N-95 bumper-cars 对战画布过小 + 触区 🔧

- 915×412 画布 140×140（390 竖屏同局 331×331），圆台缩成小块；`.bc-open` h=34、`.bc-pick` h=32；
  1024×768 两颗「🛑刹车」741~785 底切 17px。
- 修法：矮横屏 fit 改按「可用高 − 键排」计算而非按宽缩；触区 min-height 44；1024 档让键排进 768。**勿改**碰撞世界尺寸与回合逻辑。
- 验收：915×412 画布显示边 ≥ 260px 且 IN；三视口冲撞/刹车全 IN h≥44。

### N-96 ice-fire-forest 闯关画布底切 🔧

- 915×412 第 1 关主画布 232~471（切 59px），谜题下几行看不见；键垫 253~393 IN 没事。
- 修法：矮横屏钳画布显示高（参照 C-8「只改显示、不改世界」口径）或把画布上移贴 HUD。**勿改**关卡网格数据与双人判定。
- 验收：915×412 canvas bottom ≤ 412；390×844 不回退。

### N-98 landlord-cards「◀ 回选关」触区 33px 🔧（轻，顺手）

- `.ld-back` h=33 → min-height 44；叫分行 299~347、暂停 350~394 已绿勿动。

### 旧号余力（r17 口径，未销则做）

- N-90 tap-tiles、N-91 fruit-catch、N-60/61/62 贴线、N-12 台球、N-10 围棋、N-3 star-estate、N-55 snow 对战、C-8 气球显示高。
  全部按 `trio-r17-playbook.md` 的红线执行（禁改 `SKY_H`、禁改 `*_SHORT_PANE_H`）。若 r17/r18 在途 B 已合，只留回归数字。

---

## 完成定义

1. B 先把 N-99 红灯修绿；然后 N-94/N-93/N-97 必做，N-95/N-96/N-98 做或书面降级；旧号做或说明。A：N-92 修掉或书面说明「在途 r18-A 已消化，附回归数字」。
2. `npm test` 全绿且 ≥ **1193 files / 19489 tests**，只增不减；`npm run build` 绿；每修一处配守门测试（断言 CSS/结构意图，别钉死像素）。
3. 每条留 915×412 top/bottom 数字；N-92/93/95 附 390×844 + 1024×768 数字。撞车取先合进 `game-1.3` 的版本，勿第二套。
4. 观察项（sprout-defense / ocean-munch 全 canvas 内部热区）不开号，下轮学习员带像素级抽验工装再定。
