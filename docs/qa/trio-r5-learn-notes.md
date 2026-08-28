# 三人组第 5 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`game-1.3 = 22a5be93`（已含 trio-r4 笔记 + PR48 管理员门时长/永久与选关全解锁 + PR49 闯关学习走查 + PR50 休闲对战走查）。
> 衔接：r4 抽验（modebar `[hidden]` ×18 / 横屏矮屏重灾名单 / 首页首屏 0 卡）→ 本轮先对账 r4 playbook 哪些已被 PR48–50 收掉，再抽 r4 没碰过的游戏与视口。
> 本轮交付仅两份文档 + r4 playbook 的对账标注。`src/**` 一行未动。

## 一、抽验方式（可复现）

- `npm ci && npm run build && npx vite preview --port 4173`，headless Chrome（`/usr/local/bin/google-chrome` + `puppeteer-core`，脚本放 /tmp 不进库——r4 有误提交审计脚本被撤的前科 `7bcde99a`）。
- 视口三档（**全部是 r4 没测过或没铺满的档**）：**390×844**（iPhone 12–15 主流档；r4 只测过 360×640/412×915）/ **1024×768**（iPad 横屏档；r4 只测过 1280×800 宽屏）/ **915×412**（横屏矮屏，r4 重灾档，用于复测已修款与补测未点名款）。
- 量四个数（口径同 r4）：`.game-stage` 的 `scrollHeight − clientHeight`（裁切）；折叠线下可点控件数（`rect.top ≥ 视口高`）；canvas 出屏量；modebar 点模式钮后的 `computedStyle.display` 与残留高度。
- l99 款点 `.l99-continue` 进第 1 关再量；深关用管理员密码 `kangkang`（家长面板 → 管理员权限，PR48 后可选时长/永久，开着时选关地图全解锁，不写星级存档）。
- **本轮新增口径——自滚容器探查**：逐元素找 `scrollHeight − clientHeight > 20` 的真滚动层。教训：tank-battle 的 `.tkb-root` 自带 `overflow-y:auto`，`.game-stage` 口径量它裁切=0，但 D-pad 实际在折叠线下（915×412 按钮 top 503–552 > 412）。**A/B 复测时凡「crop=0 但控件够不着」先查内层滚动容器**。

## 二、r4 playbook 对账（哪些已被 PR48–50 收掉）

| r4 编号 | r5 核实（对照 `22a5be93` 源码 + 实测） | 判定 |
| --- | --- | --- |
| C-1 modebar `[hidden]` ×18 | **大头已落地**：18 款名单里 15 款已带 `.xx-modebar[hidden]{display:none}`（`b9399df8`/`e71a836c`/`d4ca9e4b`），额外还给 brick-break `.brk-bar`、snake-snack `.sn-bar-modes`、hue-hand `.hh-bar` 等补了。运行时验证 merge-2048/snake-royale/hero-cards 进模式后 `display:none`、高度 0。**残余 3 款**：box-hamster `.bh-modebar`（进模式残留 40px）、prince-princess `.pcp-modebar`（82px，单人模式连 `hidden` 都没设）、sudoku-petal `.sp-modebar`（154px，全场最高）。**测试欠账**：新修 15 款只有 snake-royale/orb-arena 在 index.test.ts 带了断言，其余 13 款没配蓝本测试（r4 验收线「测试逐款有」没走完） | ✅ 主体（残 3 款+测试） |
| C-4 snake-royale | 「进关收模式条 + scrollIntoView 滚到战场」已上（`c0b9c62b`）；钳高没做：915×412 仍裁 262 / canvas 出屏 150 / 加速急停折叠线下（r4 时 474/362，有缓解未闭账） | 🔶 部分 |
| C-8 之 hue-hand / orb-arena | 进关收模式条已上：hue-hand 915×412 裁切 387→335（🎴✅⏸ 三钮仍折叠线下）、orb-arena 337→249/出屏 138（技能钮仍折叠线下） | 🔶 部分 |
| S-1 首页首屏 | `styles.css`/`home.ts` 无矮屏压缩（PR48 只改了管理员钥匙态与安全区 env()）。**新增实测**：390×844 首卡 top=717（只露 127px 半张）；**915×412 横屏首屏 0 卡**（首卡 top=557 > 412）；1024×768 可见（top=557 < 768） | ❌ 未动（横屏加重） |
| S-2 l99 星级 SVG | `level99.ts:469` `starRowHTML` 仍 ★ 字符；:515/:542/:565 字号 11/12/10px 原样 | ❌ 未动 |
| S-3 parentAuth 跨路由 | `src/ui` 里只有 app.ts 挂 hashchange，parentAuth.ts 原样 | ❌ 未动 |
| S-4 `.l99-jump-input` | level99.ts:529 仍 `min-height:38px` | ❌ 未动 |
| L-1 学习 4 款横屏 | shape-kingdom/color-fun/music-stars/find-diff 自 `1fd33b5e` 起 0 diff | ❌ 未动 |
| L-2 clock-house 钟面 | levels.ts:78 `clockSVG` 仍细线针 + 9px 刻度，无 arrowHandD/hubSVG | ❌ 未动 |
| L-3 find-diff 贴纸 | boardArt.ts:16 头注仍「第 4–10 章贴纸挂第 3 轮」 | ❌ 未动 |
| L-4 26px 裁决记录 | docs/qa 无新裁决文档 | ❌ 未动 |
| C-2 brick-break | index.ts:119 `touch-action:none` 原样、无钳高 | ❌ 未动 |
| C-3 snake-snack | 只加了 canvas `touch-action:none`（防划动误滚，好事）+ modebar 兜底；钳高没做 | ❌ 未动 |
| C-5 mole-pop / C-6 alien-seek | 各 +2 行 modebar 兜底，钳高没做 | ❌ 未动 |
| C-7 match-stars / C-9 duo-vs-star | 0 diff；`.dvs-back` 仍无 min-height | ❌ 未动 |
| C-8 其余（puzzle-tiles/balloon-pop/shoot-range/snow-fight/ice-fire-forest/monster-crisis/puff-bros/duo-rush/duo-arena/brave-path） | 0 diff | ❌ 未动 |

**PR48–50 额外收掉的（r4 没立项但同族，本轮实测确认，下一轮不要重复做）**：

1. merge-2048 盘面按舞台实宽算格（`a6dc5b9e`）：390×844 关内 0 裁切 ✅。
2. xiangqi/weiqi 平板横屏收棋盘（`66601b46`，条件 `min-width:700 且 max-height:840`）：**1024×768 达标**（xiangqi 裁 121、折叠线下 0）✅；但 915×412 仍重伤（见新发现 N-10）。
3. candy-swing 宽屏 `width:100%` + 平板放宽：1024×768 关内干净 ✅。
4. dot-maze 双人触控键盘、sprout-defense/fruit-slice/garden-guard/ocean-munch/rainbow-run 接 mapFit：915×412 选关页 0 裁切 ✅。
5. hero-cards 手牌换行钉测试：390×844 横向 0 溢出 ✅（纵向另有新伤，见 N-4）。
6. sky-squad HUD 换行：915×412 关内裁 71（无控件折叠线下）✅。
7. 壳层安全区 env() 追加（`.screen`/`.home-screen`/`.overlay`）与管理员钥匙亮态 ✅。

## 三、新视口抽验结论（32 款 r4 未点名 + 23 款已修复核）

三档全绿、可以放心的：math-farm / word-garden / pinyin-train（学习组三档 0 裁切）、fishing-star（landscapeFit 生效）、poop-hero、tap-tiles、kitty-care、landlord-cards、red-blue-race / red-blue-tap / red-blue-tug、dark-chess、junqi-camp、gold-hook、sling-birds（进关后）、bubble-pop 竖屏、mahjong-bloom、weiqi-garden 竖屏、hop-pads、candy-swing 关内、adventure-king 竖屏/平板。

**新发现（按重灾排序，编号 N-x，供 r5 playbook 引用）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-1 | fruit-catch | 915×412 裁 741 / canvas 出屏 617 / ⬅️➡️ 折叠线下（截图实锤：只见树梢不见果篮）；**1024×768 平板也裁 415 / 出屏 281**。实时接水果不能滚 | 🔧 全场最重 |
| N-2 | flight-chess | 🎲 掷骰子 + 4 个棋子钮**三档全部折叠线下**：915×412 裁 751、390×844 裁 437、1024×768 裁 435。每回合必点的钮要滚着找 | 🔧 |
| N-3 | star-estate | 915×412 裁 715（33 个元素折叠线下）、1024×768 裁 399、390×844 裁 276（⏭️ 结束回合折叠线下） | 🔧 |
| N-4 | hero-cards | **390×844 主流竖屏裁 464，13 张手牌整排折叠线下**（截图实锤：屏幕到战报为止，手牌全看不见）；915×412 裁 395。出牌是核心交互 | 🔧 |
| N-5 | memory-cards | 915×412 裁 496 / canvas 出屏 434、1024×768 裁 173 / 出屏 101——翻牌记位置必须整盘可见；另截图见**关内模式条（记忆挑战/双人轮流翻）没收** | 🔧 |
| N-6 | lianliankan | 915×412 裁 496（18 个图案格折叠线下）、1024×768 裁 172。连连看要整盘规划 | 🔧 |
| N-7 | bubble-pop | 915×412 裁 533（40 个泡折叠线下）、1024×768 裁 209（8 个）。BL-W6-03 裁决的是 44px 格下限，横屏裁切是另一笔账 | 🔧 |
| N-8 | chess-garden | 915×412 裁 436（33 格折叠线下）、1024×768 裁 120（♻️ 重摆钮） | 🔧 |
| N-9 | sudoku-petal | 915×412 裁 401（15 格折叠线下）、390×844 裁 131；叠加 modebar 残留 154px | 🔧 |
| N-10 | xiangqi / gomoku / weiqi-garden 横屏矮屏 | 915×412：裁 437/331/188，棋盘出屏 245/216/43，悔棋·确认落子·提示·重摆整排折叠线下。`66601b46` 的 380px 收幅在 412px 高时不够 | 🔧 |
| N-11 | bowling-lane | **390×844 裁 198，◀ 🎳停 ▶ ↩ 四钮折叠线下（截图实锤）**；915×412 裁 237、1024×768 裁 179。已接 stagePlayRoom 但 room.h 没减自家按钮/徽章排 | 🔧 |
| N-12 | pool-stars | 390×844 裁 241（🎯 蓄力击球/⏸ 折叠线下）；915×412 裁 340 / 出屏 112；1024×768 干净。同 N-11 口径 | 🔧 |
| N-13 | fruit-stack | 三档全中：390×844 裁 141（◀▶放下）、915×412 裁 143/出屏 48、1024×768 裁 171/出屏 49 | 🔧 |
| N-14 | bumper-cars | 915×412 裁 180（💥冲撞/🛑刹车折叠线下）、1024×768 裁 113。`7ee559b2` 只顾了竖屏 | 🔧 |
| N-15 | bomb-buddies | 915×412 裁 187（🫧🦵📡 三技能钮）、1024×768 裁 75 | 🔧 |
| N-16 | adventure-king | 915×412 裁 332 / 出屏 204 / ◀▶⤴🪃🪝⏸ 六控件折叠线下 | 🔧 |
| N-17 | prince-princess | 915×412 裁 173（6 个触控键折叠线下）+ modebar 残留 82px | 🔧 |
| N-18 | box-hamster | 915×412 裁 316（⬆◀⬇▶ 折叠线下）+ modebar 残留 40px | 🔧 |
| N-19 | tank-battle | 915×412 与 1024×768 D-pad 折叠线下（**`.tkb-root` 自滚，`.game-stage` 口径量不到**，见第一节陷阱）。已接 stagePlayRoom 但没减按钮排 | 🔧 |
| N-20 | mine-garden | 915×412 裁 162（第 5 行格 + 🖐 长按钮折叠线下） | 🔧 |
| N-21 | block-drop 残余 | 915×412 仍裁 111（◀▶↻↺▼⤓ 七键折叠线下）——`3978c344` 修后残余，钳制参数没吃到横屏矮档 | 🔧 |
| N-22 | combo-clash 残余 | 915×412 仍裁 131（轻/重/必杀折叠线下）——`62d90a4b` 修后残余 | 🔧 |
| N-23 | 自绘选关地图三款 | bubble-aim `.ba-map`：**固定 `max-height:520px`** + 内滚 3096px（390×844），打开永远停第 1 关，无「滚到当前关」；candy-swing `.cs-map`：10 章全部纵向铺开（915×412 选关页裁 1879）无定位；sling-birds `.slb-map` 同族无定位。共享 l99 的蓝本就在 `level99.ts:871`（`showMap(focusCurrent)` → `cur.scrollIntoView({block:"center"})`） | 🔧 |
| N-24 | 首页横屏 | 915×412 首屏 0 张游戏卡（并入 S-1 一起修，别开新账） | 🔧 并入 S-1 |

## 四、系统性模式与修补配方（r4 配方 A/B/C 仍有效，本轮新增三条）

### 模式 D · 自绘选关地图不定位当前关（N-23）

- **机理**：candy-swing/sling-birds/bubble-aim 没走共享 l99 地图，自绘长列表既无章节分页也无 `focusCurrent`；bubble-aim 还把地图滚动窗定死 `max-height:520px`（横屏矮屏 412px 高时反把壳层撑破）。
- **配方**：照抄 `level99.ts:871`——渲染完地图后找当前关节点 `scrollIntoView({block:"center"})`（滚动发生在自家 `.xx-map` 容器内，不惊动壳层）；bubble-aim 的 520px 改按可视余量（`stagePlayRoom` 或 `min(520px, .game-stage clientHeight − 地图外家当)`）。**只动展示层，解锁判定与存档 key 零触碰**。
- **修好判据**：把存档推进到第 50+ 关（或开 `kangkang` 全解锁后点高关），退出重进地图，当前关无需手滚即在视野中央。

### 模式 E · 「每回合必点」控件掉折叠线下（回合制的可滚 ≠ 可藏）

- **机理**：回合制（flight-chess/star-estate/hero-cards/hue-hand/棋类工具行）一直被当「可滚容忍」，但**掷骰子/结束回合/出牌/悔棋是每回合都要点的**，每回合滚一次等于把回合时长翻倍，孩子直接流失。r4 只给 hue-hand 提过 sticky 建议，本轮实测这是一族病（N-2/3/4/10）。
- **配方（二选一）**：① 操作行 `position:sticky; bottom:0`（背景加不透明底+上缘阴影，别压住盘面）；② 盘面钳高让操作行进屏（配方 B 之 3）。手牌类（hero-cards/hue-hand）建议手牌区贴底常驻 + 战况区钳高滚动。
- **修好判据**：进关不滚动就能看见并点到「本回合必点」钮；盘面主体≥60% 可见；412×915 与 1280×800 布局与修前一致。

### 模式 F · stagePlayRoom 只减壳层抬头，不减自家按钮排（N-11…N-15、N-19 共因）

- **机理**：`src/engine/stageRoom.ts` 的 `stagePlayRoom(host)` 返回「stage 高 − l99 抬头 − 16」，**各款自家的徽章排/按钮排/蓄力条要自己再减**。bowling-lane/bumper-cars/bomb-buddies/tank-battle/pool-stars 都接了工具却拿 room.h 直接铺 canvas，按钮排被顶出屏。
- **配方**：照 dot-maze `a16caf46` 的 `below` 变量——量画布下方家当实高从 room.h 里扣掉，再钳 canvas 显示高（物理分辨率与判定坐标不动）；resize 重量、destroy 摘监听。每款配 stageFit 纯函数测试（样板已有 8 份）。
- **修好判据**：三档（390×844/915×412/1024×768）折叠线下可点控件 = 0、canvas 出屏 = 0。
- **附注**：给 stageRoom.ts 本体加「减自家家当」参数属于共享件改动，动之前先数一遍 6 个调用方都要过测试；更稳的做法是各款在自家文件里减（不动共享件）。

### 全库守门建议（配方 A 的收尾）

frontend-design skill 里点名的「CSS 类互相抵消」正是 modebar 病灶的教科书条目。与其 76 款逐个补测试，建议 A/B 收 C-1 尾账时写**一份全库扫描测试**：遍历 `src/games/*/index.ts|view.ts` 的 CSS 模板串，凡匹配 `\.[\w-]+(modebar|bar-modes|-bar)\{[^}]*display:flex` 的类名必须同文件存在 `.同名[hidden]{display:none}`——一份测试锁住全库，新游戏也逃不掉。（box-hamster/prince-princess/sudoku-petal 会当场红，正好当验收。）

## 五、skills 增量提炼（r4 已写的不重复）

| skill | 本轮新提炼 | 落点 |
| --- | --- | --- |
| `frontend-design` | 「hero 是论点」：首屏要开门见山给出页面唯一任务。儿童游戏首页的唯一任务是「马上玩」——修 S-1 时别只做 CSS 减法，方向是把「最近玩过/继续玩」提成首屏主角，hero 插图降级为陪衬 | S-1 修法方向 |
| `frontend-design` | 「CSS 特异性互相抵消」明确点名了 section 级样式互吃——modebar `[hidden]` 病灶同源，固化为全库守门测试（见第四节） | C-1 收尾 |
| `frontend-design` | 写作节：「按钮动词全流程一致」（掷骰子→掷出 3）、「错误指路不道歉」。抽查本库结算/失败文案已达标，不立项 | 无 |
| `canvas-design` | 「nothing falls off the page」进一步细读：**margins 和 breathing room 是「非谈判项」**。游戏 UI 的「page」= 首屏可视区，不是可滚整页——这就是模式 E 的理论依据 | 模式 E |
| `theme-factory` / `algorithmic-art` / `character-sprite-maker` | 维持 r4 结论无新增可执行项；algorithmic-art 的「参数化探索」思路本轮已用于抽测工装（视口×游戏矩阵脚本），工装留 /tmp 不进库 | 无 |

## 六、外部儿童游戏 UX 实践（新增对照，r4 表格之外）

| 实践 | 通行做法 | 本库现状（本轮实测） | 判定 |
| --- | --- | --- | --- |
| 平板横屏是儿童默认拿法 | 儿童 App 头部作品全横屏适配；iPad 是低龄孩子第一设备，1024×768 是「默认拿法」不是边缘档 | 本轮 1024×768 抽出 9 款有伤（N-1/2/3/5/6/7/8/13/14），横屏是系统性盲区 | 🔧 1024×768 升为常规验收档 |
| saga 选关地图打开即定位当前关 | Candy Crush 族地图永远停在最新关，孩子零成本续玩 | 共享 l99 有 focusCurrent ✅；自绘三款（bubble-aim/candy-swing/sling-birds）缺位 | 🔧 N-23 |
| 回合制主操作钮常驻 | 牌类 App 手牌永远贴底、骰子钮永远在拇指区 | flight-chess/hero-cards/star-estate 反例（N-2/3/4） | 🔧 模式 E |
| 实时玩法「不能边玩边滚」 | 街机/动作类控件必须首屏全可见 | r4 已立此线；本轮又抓 12 款（N-1、N-11…N-22） | 🔧 |

## 七、已收口账目汇总（下一轮不要重复做）

1. modebar `[hidden]` 主体 15/18 + brick-break/snake-snack/hue-hand 等额外款（运行时验证过）。
2. merge-2048 舞台实宽、candy-swing 平板、xiangqi/weiqi 的 1024×768 档、sky-squad HUD、hero-cards 手牌横向换行。
3. dot-maze/sprout-defense/fruit-slice/garden-guard/ocean-munch/rainbow-run 选关地图横屏 0 裁切。
4. snake-royale/orb-arena/hue-hand「进关收模式条」（裁切数已更新，钳高账还开着）。
5. 管理员门时长/永久 + 全解锁（PR48）：测试步骤可直接用 `kangkang` 开永久全解锁抽深关。
6. 学习组 math-farm/word-garden/pinyin-train 三档全绿；fishing-star/poop-hero/tap-tiles/red-blue 系/kitty-care/landlord-cards/dark-chess/junqi-camp/gold-hook 三档干净。

## 八、下一轮 A/B 最该先做的 10 条（与 r5 playbook 排序一致）

1. fruit-catch 横屏+平板双档画布出屏（N-1，裁 741/出屏 617，全场最重）
2. flight-chess 掷骰子钮三档折叠线下（N-2，390×844 主流竖屏也中）
3. hero-cards 390×844 手牌整排折叠线下（N-4，13 张全看不见）
4. star-estate 结束回合钮三档折叠线下（N-3，915 裁 715）
5. memory-cards + lianliankan 横屏盘面折叠线下（N-5/N-6，记忆与连线玩法必须整盘可见）
6. bowling-lane / pool-stars / fruit-stack 主流竖屏 390×844 主操作钮折叠线下（N-11/12/13，共因=room.h 没减自家按钮排,配方 F）
7. C-1 收尾:box-hamster/prince-princess/sudoku-petal 三款兜底 + 13 款测试欠账 + 全库守门测试（配方 A 收尾）
8. 自绘选关地图三款接 focusCurrent（N-23，bubble-aim 内滚 3096px/candy-swing 1879px）
9. 棋类三款 915×412 棋盘出屏+工具行折叠线下（N-10，`66601b46` 只救了 1024×768）
10. 首页 S-1 加档：915×412 横屏首屏 0 卡、390×844 首卡只露半张（连同 r4 的 360×640 一次修净）
