# 三人组 r19 · 测试修复员 B(#2 休闲对战)交卷报告

> 分支 `cursor/tester2-mobile-fit-9ad5` → PR 对准 `game-1.3`。基线:合并当日最新 `game-1.3 = 206d0522`(含 r18 B 的 N-105/N-12/N-10/N-3/N-55/N-81 与 C-8/N-90 摘合)。
> 工具:vite preview :4173 + puppeteer-core + 无头 Chrome,工装留 `/tmp` 不进库。视口:390×844 / 915×412 / 1024×768,root 走首页 🔑 UI 门(`kangkang`),每案独立 context。

## 一、进场对账

- 首轮(wave1 #2)分支未合入,已按纪律先交卷:merge 最新 `game-1.3`,combo-clash / mahjong-bloom 两处冲突**取先合版**(r18 N-105 版),合并后 16px 守门 5 文件 74 例全绿。
- 封存项零动作:N-105(已合只回归)、N-99 / N-100(A 面)、N-12 / N-10 / N-3、N-55 / N-81、C-8、N-90。本轮只做回归,未改一行。
- 环境曾重置(node_modules 清空),`npm ci` 重建。

## 二、修复清单(按派发顺序,全部带修前/修后 915×412 数字与守门测试)

| # | 游戏 | 修前(实测) | 修法 | 修后 | 守门 |
| --- | --- | --- | --- | --- | --- |
| N-98 | hue-hand | 三键 sticky 只钉 `.hh-wrap` 裁切盒还压住手牌(274~326 叠手牌 240~344);wrap 573/208 hidden 滚不到对手行 | 500 高档 `.hh-wrap>.hh-btns` fixed 钉视口底 + wrap 自己开内滚(N-75 配方) | 三键 348~404 IN 不遮牌;wrap auto 458/208 可滚;390 键 652~696 / 1024 键 633~677 不回退 | `shortLandscape.r12.test.ts` 更新+新增 1 例 |
| N-95 | xiangqi | 自由对战设置面板吃了棋盘的 248px 钳宽,六档一列纵排 765px,「开始下棋」滚不到 | 设置态挂 `.xq-setup` 修饰类:放宽 `min(680px,94%)` 多栏 + `max-height:calc(100dvh-140px)` 内滚,开局摘类;248 棋盘钳宽原文保留 | 开始下棋 318~372 IN,回残局学堂滚达 348~394;390:696~750 / 1024:620~674 全 IN | 新增 `freeSetup.r19.test.ts` |
| N-94+N-101 | duo-vs-star | 选人「开打▶」439~488 线下;赛中 14 键 400~746 全线下(旧网格把 `.dvs-pads` 放 grid-row:4);`.dvs-pick` 30 / `.dvs-back` 40 | 520 横屏档 `.dvs-pads{display:contents}`,两垫 2×4 入格分居画布左右;`.dvs-menu .dvs-go` sticky 钉底;pick/back 补 `min-height:44px` | 开打 sticky 345~394;14 键 145~341 与画布(159~308)同屏;pick 全 44px;390 pads 476~614 / 1024 653~699 IN | `landscape.r9.test.ts` 更新+新增 1 例;`window4-visual-scan-r3` 40→44 对齐 |
| N-107 | fruit-stack | 双人六键 `.fs-key` 522~566 全 OUT(`l99-host:hidden:520/334`) | 每座位键组 `.fs-pad>.fs-pad` fixed 钉视口两侧垂直居中(P0 左/P1 右);z=5 压在 `.fs-veil`(z6) 下,暂停遮罩仍盖住键 | 双人 6 键 132~280 IN 双侧;闯关单座右侧 132~280;390 流内 710~806 不回退 | 新增 `duoKeys.r19.test.ts`(3 例) |
| N-96 | bomb-buddies | 棋盘 24px 格按行数长高,画布底 439 出屏 27(格径 MIN_CELL_PX=24 兜底后仍装不下) | 500 横屏档纯显示钳:`width/height:auto!important + max-height:max(160px,calc(100dvh-182px))`,内在比例等比收,格子逻辑/常量零触碰 | 画布 230×230 等比 178~408 IN;双人 166~396 IN;390 画布 351px 不回退;1024 不命中档零变化 | 新增 `boardCap.r19.test.ts`(2 例) |
| N-106 | monster-crisis | 双人摇杆 370~462 / 甩弹 379~453 切底(技能三卡 262~400 在屏勿动 ✓) | 500 横屏档 `.mcr-pad` fixed 钉两下角(z5<`.mcr-layer` z9,浮层照旧盖住);单人态 stick/fire 直挂 `.mcr-pads` 下,补直系选择器同钉 | 双人杆 304~396 / 🎨 313~387 IN;单人杆左下 306~398 / 🎨 右下 316~390;技能卡浮层在键上层可点 | 新增 `padsFixed.r19.test.ts`(3 例) |
| N-103 | ice-fire-forest | L1 画布 232~471 切 59;root×188 画布 276~515 / pad 行 393~437 被 `.l99-stage`(底 342) 裁 | ① `layout()` 铺完量画布底对舞台可视底缺口,超了按缺口二次收(root 工具行自动进预算,下限 96);② 换人条挪进右栏,棋盘头顶只剩 HUD;③ 双垫 fixed 钉视口右下(旧「进右栏」配方 root 态实测被裁,两条 C-8 守门按新配方更新) | L1 画布 180~336 IN、pad 三排 256~393 IN;root×188 画布 224~336、pad 末行 304~348 全 IN;390 画布 353~598 / 1024 画布 274~582 正常 | 新增 `boardFit.r19.test.ts`(3 例);landscapePads.r10/r11 更新 |
| N-102 | bumper-cars | 915 画布 140×140 过小;1024 刹车排切 17;(bc-open/bc-pick 44 已在本分支首轮修过) | ① 500 档双垫 fixed 钉两下角+tip/legend 让位;② `layout()` 感知双垫 fixed 不再按 118 预算扣场地;③ 铺完量 wrap 底缺口二次收(extraCut) | 画布 140→230×159(+87% 面积),底 336 IN;1024 刹车 671~715 IN;双人对战 213×213 双杆 306~392 IN | 新增 `fieldFit.r19.test.ts`(2 例) |
| N-104 | landlord-cards | `.ld-back` h=33(<44 红线) | 基档补 `min-height:44px`(无尽/对战两态共用一条规则) | 两态 76~120 h=44 | 新增 `backHit.r19.test.ts` |

## 三、回归

- **全量 vitest:1211 文件 / 19532 用例全绿**(进场水位 19489+5红 → 修 N-105 已在主干,本轮净增 43 例守门,只增不减;两处旧断言按 r19 指令对齐:`.dvs-back` 40→44、C-8 双垫配方)。
- `npm run build` ✅(vite + PWA)。
- 冒烟:9 款触及游戏 + 7 款封存项(combo-clash / mahjong-bloom / balloon-pop / tap-tiles / snow-fight / pool-stars / star-estate)× 3 视口,共 48 条——控制台零错误、文档横向溢出 0、L1 可进。
- root 契约:UI 门开 root → 直达 188 → 权限行/画布/键排全 IN(见 N-103);localStorage 无密码残留(走 UI 门,未 seed)。

## 四、结构性发现(留给 playbook)

1. **`.l99-stage` 高度会因内容/root 行在两次挂载间变化**(实测同游戏 342 与 ≥393 两个值),凡「进右栏/流内排布」的救济在 root 态都可能被重新裁掉——键排类救济一律 fixed 钉视口(军规路径 2),棋盘类一律「铺完量实测缺口二次收」(N-103/N-102 的 `extraCut` 配方,比静态比例/静态预算稳)。
2. **单/双人 DOM 形态差异是复发源**:monster-crisis 单人态键不包 `.mcr-pad`、fruit-stack 内外层同名 `.fs-pad`——写角落钉底选择器必须两态各验一次(`:first-child/:last-child` 要配 `left/right:auto` 防单实例双边拉伸)。
3. 显示钳 canvas 时若 JS 写了内联宽高,样式表 `width:auto` 无效,需 `!important` 或改 JS(bomb-buddies 教训)。

## 五、残留(给下一轮)

- **N-108 puzzle-tiles 无尽画廊**、**C-5 mole-pop**、**N-29 尾款(sling-birds/candy-swing)**:本轮按用户派发顺序未排入,r19 任务单原文仍有效,未动一行,无冲突。
- xiangqi 自由对战**开局后**的棋盘态 915 悔棋排 481~649 出屏 = **N-10 残余,已书面降级不再派**(本轮零动作,数字记此供对账)。
- 1024×768 平板横屏若干游戏仍吃桌面档(U-1 族),r19 未派、留待战役后续。
