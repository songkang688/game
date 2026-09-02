# 一朵一星 · 三人组第 4 轮走查(测试修复员 B · 休闲/对战/动手组)

- 基线:`origin/game-1.3`(已含管理员门 kangkang、闯关学习 UX 走查、矮屏审计合并);
  中途 A 组「休闲对战动手 UX 走查修复」(`499323b6`)合入,按「后合者拉最新」纪律并入本分支,
  与 A 组撞车的同题修复弃用自己的版本、取 A 组已合入版(明细见下)。
- 方法:`npm run build` + `vite preview`,Chrome 无头实玩(真实指针/触屏事件)。
  **48 款休闲 + 对战 + 动手游戏 × 两个视口(390×844 手机竖屏 / 1024×768 平板)全量走查**:
  每款进选关地图 → 进第 1 关 → 自动体检(横向溢出 / 元素被 overflow 祖先裁切 / canvas 出屏或过小 /
  按钮热区过小 / 舞台 touch-action 划不划得动) → 两页截图;重点款再人工深玩到真实出牌/拉绳/发射。
  走查脚本为临时脚本,按纪律不入库;全程收集 pageerror / console.error,**两轮全量均为零错误**。
- 覆盖清单(48 款):match-stars, memory-cards, fruit-catch, mole-pop, puzzle-tiles, bubble-pop,
  snake-snack, brick-break, lianliankan, kitty-care, balloon-pop, bubble-aim, alien-seek, fishing-star,
  shoot-range, bowling-lane, block-drop, fruit-stack, hop-pads, merge-2048, mine-garden, pool-stars,
  red-blue-tug, red-blue-tap, red-blue-race, duo-arena, duo-rush, xiangqi, landlord-cards, bumper-cars,
  puff-bros, duo-vs-star, fight-king, snow-fight, gomoku, chess-garden, combo-clash, dark-chess,
  flight-chess, hero-cards, tap-tiles, junqi-camp, mahjong-bloom, star-estate, weiqi-garden,
  color-fun, hue-hand, music-stars。

## 一、本分支修复(4 项,均已实测复验)

### 缺陷 1(S2):泡泡瞄准手选关地图不认管理员门,높关无法直达

- **复现**(390×844 与 1024×768 均中):bubble-aim 是自建选关(不走 l99 框架),
  `unlocked(i)` 只看 `progress.stars`,**kangkang 管理员门开着也只能玩第 1 关**,
  187 个锁一个不开——与 l99 框架和 7 款自建解锁游戏「root 开则全开」的口径不一致。
- **修复**:照 candy-swing 模式加 `rootUnlock.ts`(`unlockedWithRoot` 纯函数 + 单测),
  `unlocked(i)` 合流 `isRootOpen()`。
- **复验**:门关着 locked=187/188 不变;注入管理员会话后 locked=0/188,
  直接点第 188 关能进、能发射,零错误。

### 缺陷 2(S3):泡泡瞄准手选关地图写死 520px,高个子屏幕下半截白板

- **复现**(390×844):`.ba-map{max-height:520px}`,舞台 738px 高,地图卡片下面
  空出约 190px 白板,188 关全靠在 520px 的小窗里滚,「石头城堡」标题被拦腰截断。
- **修复**:补一条 `max-height:clamp(420px, calc(100dvh - 150px), 960px)`(老内核不认
  dvh/clamp 时整条失效,自动退回原 520px 兜底)。
- **复验**:手机 520→694px、平板 520→618px,下方白板消失;
  地图触屏滚动实测 scrollTop 0→251 正常(触摸事件真实模拟)。

### 缺陷 3(S2):钢琴块画布按视口宽算,手机上最左轨被裁 35px 点不着

- **复现**(390×844,tap-tiles 进第 1 关):画布宽 = `innerWidth - 24` = 366px,
  但平台壳层四周还有约 60px 白边,容器 `.tt-wrap`(overflow:hidden)只有 331px——
  **画布左右各被裁 17px,最左轨的音符切走小半个,孩子看不全也点不准**。
- **修复**:`resize()` 里加 `hostWidthPx()` 量 wrap 的真实内容宽,和视口口径取小
  (量不到时退回视口口径,domStub 测试不受影响)。
- **复验**:画布 366→320px 完整收进容器(左右各余 5px),最左轨触屏点击正常,零错误。

### 缺陷 4(S1):红蓝拔河平板上两颗「拉绳」大按钮被裁得只剩一条边

- **复现**(1024×768,进第 1 关):`sideLayout(viewportWidth())` 按视口 1024 算排布,
  隔离带被撑到 664px,而关卡容器(l99)只有 680px——两颗拉绳按钮被 flex 挤成 38px 宽
  且各有 30px 悬在 overflow:hidden 的舞台外,**双人对战两只手都没地方按**。
  手机(390)上容器 ≈ 视口所以从没暴露。
- **修复**:抽 `applySideLayout()`,排布宽改量 `.rbg-ctrl` 真实宽度(量不到退回视口),
  挂载下一帧校一次 + resize 时重算。
- **复验**:平板两颗按钮 38→168×88px、零裁切;手机 133×76px(≥72 红线)不回归;
  触屏按住拉绳 1.2 秒体力 100%→82%,对局真实可玩。

### 附带:修一处基线回归(不算走查缺陷,挡测试门禁)

- `npm test` 在基线上就红一条:`mobileText.test` 钉「`.l99-jump-note`(管理员权限剩余
  时长说明)≥16px」,`f2384935`(舞台可滑修复)在矮屏媒体块把它压到 14px 踩了红线。
  矮屏块改回只收 margin、字号不动。level99.ts 是共享框架文件,本处只回退越线的一条声明。

## 二、与 A 组撞车的同题修复(弃用自己的,取 A 组已合入版并复验)

走查中我与 A 组(`499323b6`,先合入)并行发现并修了同一批问题;按纪律取 A 组版本,
我的过渡实现全部弃用,并在合并态逐一复验 A 组修复有效:

| 问题 | A 组修法(最终树) | 我的复验 |
| --- | --- | --- |
| 麻将手牌 14 张 532px 横滚半副牌看不见 | `.mj-hand` 480px 下折行 | ✅ 14 张全在容器内,点牌出牌正常(弃牌河 0→1) |
| 英杰牌 10 张手牌横向出屏 312px | `.hc-hand` 全宽折行 | ✅ 全部可见,选牌→确定→打出正常(手牌 10→9) |
| 落块/五子棋/麻将/英杰牌等进关模式条不收,井被压成 221px | 进关 `bar.hidden` + `[hidden]{display:none}` 兜底 | ✅ 落块井 221→303px,回地图模式条回来 |
| 五子棋「不指出，继续下」24px 高 | `.gmk-claimbar button` 补 44px 基础样式 | ✅ 44px |
| 射击场预览/暂停开关 29px 高 | `.shr-toggle` min-height:36px | ✅ 36px |

## 三、无缺陷的观察项(不动手,留档)

- **飞行棋棋子按钮 21×21**(390px):底部有「第 1–4 架」44px 大按钮做同功能主路径,
  棋盘格子物理上限就是 24px,不动。
- **大富翁(star-estate)环形地块 26×26**:地块是棋盘信息展示,买地/掷骰走底部大按钮,
  棋盘固有密度,不动。
- **气球嘭嘭气球在天空容器边缘被裁**:气球从底边升起的动画常态,不是缺陷。
- **审计脚本的「canvas 偏小」若干**(memory-cards 卡片 / block-drop 暂存与下一个预览 /
  combo-clash 头像 / alien-seek 缩略图):都是小部件画布,误报。
- **合成水果按钮 fit 中间态 24px**:审计撞上 `fitFieldIntoStage` 布局中间态,
  稳态实测全部 44–50px,误报。

## 四、验收(合并 A 组后的最终态)

- `npm test`:**1090 文件 / 19242 用例全过**(基线红一条已修绿;本分支净增 2 例
  bubble-aim rootUnlock 单测,用例数只增不减)。
- `npm run build`:tsc 无错,vite + PWA(200 项预缓存)构建成功。
- 48 款 × 2 视口全量走查跑两遍(修复前基线一遍、合并态一遍):
  合并态**真缺陷清零**,全程零 pageerror / 零 console.error。
- 定点复验 25/25 通过(泡泡瞄准手 root 解锁与地图高、麻将/英杰牌折行、钢琴块裁切、
  拔河平板/手机、落块收条、射击场/五子棋热区)。
- 交互深玩回归:麻将出牌、英杰牌出牌、钢琴块最左轨点击、拔河按住蓄力、
  落块触屏按钮、泡泡瞄准手发射,全部真实事件驱动通过。

## 五、总结(测了什么、修了什么)

**测了**:休闲/对战/动手全部 48 款,手机竖屏 390×844 与平板 1024×768 两视口,
每款走「选关地图 → 第 1 关」自动体检 + 截图人工复核,重点深玩棋牌 9 款
(象棋/五子棋/围棋/军棋/麻将/暗棋/飞行棋/斗地主/英杰牌)与双人 11 款
(红蓝三连/duo 系/格斗/雪仗/碰碰车等);另用 kangkang 管理员门验证高关直达。

**修了**:①泡泡瞄准手选关接入管理员门(root 开则 188 关全开);②同款地图高度自适应,
高屏不再半截白板;③钢琴块画布按宿主实宽收窄,最左轨不再被裁;④红蓝拔河两侧「拉绳」
按容器实宽排布,平板上不再被挤出舞台;⑤顺手修回基线一条测试红线(l99 管理员剩余时长
说明字号 16px)。与 A 组撞车的 5 处(麻将/英杰牌折行、进关收模式条、五子棋/射击场热区)
按纪律取 A 组版本并全部复验通过。
