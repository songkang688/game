# 三人组 99 轮战役 · 第 1 轮（trio-r18）· 学习优化员抽验笔记

> 基线：`origin/game-1.3 = e58ccceb`（含 r17 学习员笔记、r17 A 的 N-89 壳标题收高 `10022068`、UX-99 监督派发表 PR #81）。
> 模型：`claude-fable-5-thinking-xhigh`。分支 `cursor/trio-r18-learner-c337`。本工位零改 `src/**`。
> **编号**：grep 全部 trio 文档最大号 = **N-91**（r17）。本工位新伤 **N-92…N-99**（N-99 是主干红灯）。
> **不覆盖** `trio-r14*` / `r15*` / `r16*` / `r17*` 原文。工装 `/tmp/r18-scan.mjs`、截图 `/tmp/r18-shots/` 不进库。
> 主档 **915×412**；本轮换抓手补了 **390×844 竖屏地图** 与 **1024×768 平板横屏**。

## 一、抽验方式
    
- 无头 puppeteer-core + `google-chrome 148`，`npm run build` + `vite preview --port 4173`；每案独立 browser context。
- 换面原则：避开已量死的结算弹窗、N-77 相册、N-87/88、r17 三号（N-89/90/91）与 root×钓鱼/花园守卫；
  专挑 r10–r17 提及 ≤2 次的款：`duo-vs-star`（0 次）、`landlord-cards`（0 次）、`bumper-cars`、`ice-fire-forest`、
  `sprout-defense`、`xiangqi`、`match-stars`、`ocean-munch`、`pinyin-train`、`word-garden`、`dot-maze`。
- 实测画面 **20 个**（游戏 × 模式 × 视口 × root 开/关 × 覆盖层），全部 `getBoundingClientRect` 留数字。
- root 档：`localStorage["yiduo-yixing.root.v1"] = {"expiresAt":99999999999999,"mode":"permanent"}` 预注入，独立 context。

## 二、对账（已合入 → ✅，勿再做）

| 批次 | SHA / PR | 结论 |
| --- | --- | --- |
| r17 A（N-89 壳标题收高） | `10022068` | ✅ `@media (max-height:500px)` 顶栏收高已合，勿第二套 |
| r16 摘合 | `30cc10ab` | N-77 相册、N-87 冲刺 CTA、N-88 格斗开打、N-47 芯片 ✅ |
| N-86 大厅卡 | `7a2d560b` | ✅ |
| r15 B | PR #78 `8cbe0441` | N-75…N-85 ✅；N-55 对战十二键仍开 |
| r13/r14 A | `215958e` / `87c5aff` | N-63 / C-6 / N-37 / N-68 / N-73 ✅ |
| UX-99 派发表 | PR #81 `e58ccceb` | 本拍 = 战役第 1 轮；r18 A/B 两测试员在途（A 占壳+学习、B 占休闲对战） |
| 旧 PR #76/#77/#79/#80 | — | 偏旧，**禁止**再合（会倒删 N-75+） |

r17 playbook 旧号（N-60/61/62、N-12、N-10、N-3、N-55、C-8、N-90、N-91）**本轮未复测**、未见新修 commit，仍按 r17 口径开着，勿换号。

## 三、新发现（N-92 起；🔧 = 建议修，观察 = 记录不派）

| # | 对象 | 视口 | 实测（top~bottom） | 性质 |
| --- | --- | --- | --- | --- |
| N-92 | **level99 壳**：多行章节 tab 款进场，「开始冒险 ▶」`.l99-continue` 与「🎯 跳到当前关 / ⏭️ 跳过」工具行被 `.l99-view` 的 scrollIntoView 卷出视口顶 | 915×412 | word-garden **-154~-110 / -104~-60**；ice-fire-forest **-104 / -54**；xiangqi **-50 / 0**；landlord-cards **-52 / -2**；bumper-cars **-39 / +11**；root×pinyin-train 加重：**「🎫 直达」-54~-10、跳过（管理员）-106** 进场全不可见。390×844 与 1024×768 全 IN（match-stars 1024 实测 162~206 IN） | 🔧 A |
| N-93 | **duo-vs-star** 双人对战选人屏：唯一 CTA「两人就位，开打 ▶」`.dvs-go` 整体线下；`.dvs-pick` 触区 h=**30**、`.dvs-back` h=**40** | 915×412 | `.dvs-go` **439~488 OUT**（场地末行 397~427 切）；390×844 绿（**631~680 IN**） | 🔧 B |
| N-94 | **duo-vs-star** 开打后赛中：触屏双列虚拟键（◀▲▼▶✋💥🤝 ×2）**14 键全部线下**，触屏两人没法打；canvas 122~302 IN | 915×412 | 键柱 **400~746 OUT**（`.game-stage` 滚 334/711）；390×844 未复测赛中（选人已绿） | 🔧 B（重） |
| N-95 | **bumper-cars** 对战：915 画布仅 **140×140**（390 竖屏同局 331×331），圆台缩成小块、大量留白；模式芯片 `.bc-open` h=**34**、AI 档 `.bc-pick` h=**32** < 44 | 915×412 / 1024×768 | 画布 177~317 x:388~528；1024×768 两颗「🛑刹车」**741~785**，底切 17px；390×844 绿（键 705~799 IN h=44） | 🔧 B |
| N-96 | **ice-fire-forest** 闯关第 1 关：主画布底切 **59px**（凛凛/焙焙键垫 253~393 IN h=44 没事，但谜题下几行看不见） | 915×412 | canvas **232~471 OUT**（`.l99-stage` 滚 220/394） | 🔧 B |
| N-97 | **xiangqi** 自由对战面板：单列 207px 窄卡居中、两侧大片空白，六档难度+先手+CTA 垂直排两屏半，「开始下棋 ▶」线下 343px | 915×412 | `.xq-start` **701~755 OUT**；⭐ 星海棋神 397~444 切、先手行 587~689 OUT（`.l99-host` 滚 334/765）；模式芯片行 `.xq-mode` 66~110 IN h=44 ✅ | 🔧 B |
| N-98 | **landlord-cards** 对战中「◀ 回选关」`.ld-back` 触区 h=**33** < 44（叫分行本身绿） | 915×412 | `.ld-back` 76~109；叫分 `.ld-btn` 299~347 IN h=48、暂停 350~394 IN ✅ | 🔧 B（轻） |
| N-99 | **主干红灯**：PR #78 `81b228c2` 的矮横屏媒体查询把 `combo-clash .cc-info`、`mahjong-bloom .mj-goal` 调到 **14px**（后者还锁 nowrap），破 360px 文字 ≥16px 守门。r17-A 的绿灯（1182/19477）在 `30cc10ab`，PR #78 在其后合入，故当时没炸 | vitest | `src/ui/mobileText.test.ts` 3 例 + `src/games/window1-mobile-text.test.ts` 2 例红；修法=把两处媒体查询字号回 16px、解 `.mj-goal` nowrap，**不许砍守门测试**，也别回退 N-75/76 键排布局 | 🔧 B（最优先） |
| 观察 | **sprout-defense / ocean-munch** 入场即全 canvas（DOM 仅壳 4 键），画布 66~400 IN；塔选/模式菜单画在 canvas 里，无头工装量不到内部热区 | 915×412 | canvas IN ✅；内部热区尺寸留人工/像素级抽验，本轮不开号 | 观察 |
| 观察 | **word-garden** 攻略覆盖层：✕ 18~62、「知道啦」352~396 全 IN，`.guide-body` 自滚 270/718 ✅ | 915×412 | 绿 | 观察 |

### 本轮绿档（留数字防回退）

- pinyin-train 390×844 地图：CTA 43~87 IN、tab 全 44px、格子 61~64px、`.l99-view` 自滚 730/793 ✅（竖屏地图滚动、格子、底部 CTA 三项全绿）。
- word-garden 915×412 关内第 1 关：选项 `.qz-choice` 288~336 IN h=48 ✅。
- landlord-cards 915×412 模式芯片 `.ld-open` 66~110 IN h=44 ✅（N-63 口径没回退：模式条不进卷轴）。
- match-stars 1024×768 地图+三芯片 96~140 IN ✅。duo-vs-star 915×412 六模式卡 165~370 IN ✅。
- bumper-cars / duo-vs-star 390×844 全绿（见 N-95/N-93 行内数字）。

## 四、skills / 他窗配方摘记（怎么用到 N-92…98）

- `frontend-design`「唯一 CTA 必须在第一屏」：N-93 `.dvs-go`、N-97 `.xq-start` 就是这条的反例；修法优先 sticky/固定底或横屏分栏，别缩字号硬塞。
- `canvas-design`「视觉层裁显示、不改世界常量」：N-96 只钳 canvas 显示高或改 fit 计算，**别动**冰火关卡逻辑网格；N-95 只放大显示画布，勿改碰撞世界尺寸（参照 C-8 `SKY_H` 前车之鉴）。
- `theme-factory`/宪法第七节：触区 ≥ 44×44 是硬门槛，N-93/95/98 的 30/32/33/34/40 全违宪；修触区优先 padding/min-height，不加第三套渐变。
- 视觉宪法第七节「可点热区 ≥44、HUD 字 ≥14」+ 1.2 窗口配方「矮横屏 @media (max-height:500px) 收壳让舞台」（r15 wrap chrome 76→108、N-89 顶栏收高）是 N-92 的修法参照：先收壳/锚定，不动 paneH 常量。
- 1.2-window 布局配方里「sticky 底部键排」（N-40 赛道、N-75 麻将手牌 fixed）可直接迁移到 N-94 键柱与 N-97 CTA。

## 五、水位（进场 = 交卷，零改动；主干红灯如实上账）

- `npx vitest run` @ `e58ccceb`：**1193 files（1191 绿 + 2 红）/ 19489 tests（19484 绿 + 5 红）**。
  红灯即 N-99（PR #78 带进来的 14px 违反 360px 守门），学习员按纪律**不改测试、不改 src**，只上账派单。
- `npm run build` 绿（tsc + vite，PWA precache 正常）。本工位未改 `src/**`、未改任何测试。

## 六、纪律自查

- 零改 `src/**`；只新增 `trio-r18-learn-notes.md`、`trio-r18-playbook.md`、`trio-supervisor-99r.md`。
- 未覆盖 r14–r17 任何文件；未动 `trio-supervisor-10r.md` / `trio-supervisor-ux99.md` 的对账表。
- N-92 不是 N-63 回退（模式芯片仍钉顶、实测 IN），也不是 N-39（不动聚焦）；修它的人别碰 `showMap(true)` 四处调用。
- 与在途 r18 测试员 A（bc-5ad2f2d2，占壳+学习）/ B（bc-e60fef30，占休闲对战）避让：本工位只交文档；下轮任务单见 `trio-r18-playbook.md`。
