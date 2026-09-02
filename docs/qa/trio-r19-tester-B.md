# 三人组 r19 · 测试修复员 B 交卷（第 4 轮收口）

> 进场基线:`origin/game-1.3` @ `206d0522`,全量 `npx vitest run` = **1201 文件 / 19504 过 + 2 跳过** 全绿。
> 交卷水位:**1202 文件 / 19528 过 + 2 跳过** 全绿(+1 钉子文件 24 例;两处存量断言随修抬档,只改数值不删例)。
> 独占面:其余 `src/games/**`;`src/ui`、`level99/quiz99`、学习七款零改动。工装 `/tmp/qa/*` 不进库。
> 量法:主档 **915×412**,对照 **390×844**(+N-102 专项 1024×768);沿用 r19 笔记的可达性判据(初见 rect + scrollIntoView 后 reach)。

## 零、N-105 与 r18 合入项 915 回归(禁第二套,一行未动)

- **N-105**:进场全量跑即绿——r18 B 的 combo/mahjong 16px 修复合入后该红灯已灭,无需再修。
- | 旧号 | 实测(915×412) | 结论 |
  |---|---|---|
  | N-12 pool-stars | 台面 191~362 IN;力度/击球/旋转/暂停各排 170~318 全 IN(390 初见线下但滚得到 776~826,收口口径 🟡 不返修) | ✅ |
  | N-10 weiqi-garden | 自由对战(开始 ▶ 后):盘 118~381 IN;停一手/数一数/暂停 354~398 h=44 IN | ✅ |
  | N-3 star-estate | 骰/购买/结束行 276~322 IN;盘初见 343~516、滚后 163~336 reach ✓(降级台账口径) | ✅ |
  | N-55 snow-fight | 对战 12 键两排 306~402 h=46 全 IN | ✅ |
  | N-81 snake-snack | 无尽画布 214~342 IN;四方向键 304~406 h=48 IN | ✅ |
  | C-8 balloon-pop | `.blp-sky` 166~278 IN(SKY_H=420 未动) | ✅ |
  | N-90 tap-tiles | 判定区 182~372 IN | ✅ |
  | combo/mahjong | `.cc-info` / `.mj-goal` font-size 16px ✓,`.mj-goal` 146~166 IN | ✅ |

## 一、本轮修复(全部实测转绿)

| 编号 | 款 | 修前(915×412) | 修法 | 修后实测 |
|---|---|---|---|---|
| N-98 | hue-hand | 对战/无尽三键 422~466 线下且 `.l99-host`(hidden)里 sticky 失效 | 矮横屏 `.hh-wrap` 自己收成滚动容器(sticky 有了钉底面),`.hh-one` 改钉视口 | L1 280~324 / 对战 335~379 / 无尽 338~382 全 IN |
| N-95 | xiangqi | 自由对战设置屏「开始下棋」701 线下滚不到 | 设置屏 wrap(`:has(>.xq-panel)`)单独放宽开卷轴,CTA sticky 钉卷轴底;对局盘不吃这一档 | 开始下棋 327~370 IN;seg 键 44px 全 IN;残局学堂零触碰 |
| N-94 | duo-vs-star | 唯一 CTA「开打 ▶」439 线下;角色芯片 30px | CTA 矮横屏 fixed 钉视口底;`.dvs-pick`/`.dvs-back` 抬 44px | CTA 357~406 IN;芯片 167~211 h=44 IN |
| N-101 | duo-vs-star | 赛中 14 键 400~746 线下,触屏两人没法打 | 键排 fixed 钉视口底,两组 7 键横排分居左右 | 14 键 364~408 h=44 全 IN,画布 66~242 IN |
| N-96 | bomb-buddies | 对战画布底排切 63 | 真余量装不下时整块缩「显示」,cell/坐标/判定全不动 | 画布 166~388 IN(390:215~556 IN) |
| N-107 | fruit-stack | 双人六键 522~566 线下 | 外层键排 fixed 钉底,果盆按「键排顶 − 果盆顶」实测余量让高 | 六键 360~404 h=44 IN,双盆 212~409 IN |
| N-106 | monster-crisis | 双摇杆 370~462 / 甩弹 379~453 切底 | 两组操控 fixed 钉视口左右下角(两侧空地,盖不到战场) | 摇杆 320~404、甩弹 330~394 IN |
| N-108 | puzzle-tiles | 无尽拼块 2/3 排 491~918 滚不到;五热区 30~38px | 无尽盘宽按余量反推(闯关不吃);`.pz-back`/`.pzt-eye`/`.pzt-undo`/`.pz-hint`/`.pz-open` 抬 44 | 前两排 IN、第三排滚后 347~400 reach ✓;热区全 44 IN;seed/判定零触碰 |
| N-102 | bumper-cars | 画布 140×140;`.bc-open` 34/`.bc-pick` 32;1024 刹车切 17 | 矮横屏摇杆列挪场地两侧(grid),layout() 按侧栏取余量 + 场地高按「视口底 − 场地顶」封顶;热区抬 44 | 915 画布 h=208、全键 44 IN;1024 画布 h=370、刹车 667~733 IN |
| N-103 | ice-fire-forest | L1 画布切 59;**root×188** 画布切 103、pad「向下」行切 25 | 画布预算按「视口高 − 画布实际 top」封一刀(root 直达行自动进预算);pad 名牌让位+行距收档,44px 不降 | L1 画布 232~404、pads 249~340 IN;**root×188 画布 268~404、18 键 268~404 全 IN** |
| N-104 | landlord-cards | `.ld-back` h=33 | 抬 min-height 44(开局+出牌两态一处修) | 76~120 h=44 IN(390:300~344 IN) |
| C-5 | mole-pop | 九洞 250~894(6/9 线下),root×167 更差 | 矮横屏两栏 + 盘宽 CSS 档反推;再加 `fitBoard()` 按盘顶实测 top 反推盘宽(root 浮动壳头全兜住),destroy 摘 resize | **L1 九洞 192~404 h=65 全 IN;root×167 236~404 h=51 全 IN;390 h=94 全 IN 未修反** |
| N-29 尾款 | sling-birds / candy-swing / bubble-aim | 重来/选关 368~416 差 4px;画布 166~660 出屏 248;工具排 h=40 | 矮横屏垫一档;画布钳显示高保长宽比;工具排抬 44 | 348~392 IN;162~396 IN;78~122 h=44 IN |

## 二、root 纪律(收口口径复核)

- 全程 **UI 密码门**解锁(首页 🔑 → `kangkang` → 1 小时 → 打开),**未 seed / 未改任何 storage key**。
- 解锁后全量 dump:**无密码字符串残留**,仅 `yiduo-yixing.root.v1 = {"expiresAt":…,"mode":"timed"}`(契约合法落盘)。
- root×188(ice-fire-forest)与 root×167(mole-pop)均按上述门后直达实测,数字见上表。

## 三、390×844 对照(别修反)

hue-hand / xiangqi / duo-vs-star / bomb-buddies / fruit-stack / monster-crisis / puzzle-tiles / bumper-cars / ice-fire-forest / mole-pop / sling-birds / candy-swing / bubble-aim / landlord-cards 全部复测:关键件全 IN(duo 选人「回模式选择」初见 826~870、滚后 782~826 reach ✓,与修前同性质不立项)。矮横屏档位全部挂在 `max-height:500px`(多数再加 `min-width:640px`),竖屏一条不吃。

## 四、测试只增不减

- **新增** `src/games/trioR19FixB.test.ts`(24 例):逐项钉住本轮全部修复的源码标记。
- **随修抬档(只改数值,不删例)**:`__tests__/window4-visual-scan-r3.test.ts` 与 `duo-vs-star/landscape.r9.test.ts` 的 `.dvs-back` 断言 40→44;后者键排断言从「侧栏双栏」改钉「fixed 钉底横排」(N-101 修法变更,原断言与新布局互斥)。
- 插曲:注释里一枚 🎫 曾把 ice-fire-forest 的 emoji 水位 guard(28)顶爆,已改回纯文字——水位表一个数没动。

## 五、文件清单

- `src/games/{hue-hand,duo-vs-star,bomb-buddies,fruit-stack,monster-crisis,puzzle-tiles,bumper-cars,ice-fire-forest,landlord-cards,mole-pop,sling-birds,candy-swing,bubble-aim}/index.ts`、`src/games/xiangqi/view.ts`
- `src/games/trioR19FixB.test.ts`(新增)
- `src/games/__tests__/window4-visual-scan-r3.test.ts`、`src/games/duo-vs-star/landscape.r9.test.ts`(断言随修抬档)
- `docs/qa/trio-r19-tester-B.md`(本记录)
