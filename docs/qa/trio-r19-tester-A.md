# 三人组第 19 轮 · 测试修复员 A 交卷报告(收口轮)

> 基线:进场 `origin/game-1.3 = 206d0522`(含 N-89 壳标题、N-105 十六像素守门等已合项,均未重做)。
> 工位独占面:`src/ui/**`、`level99*`、`quiz99*`、学习款七件。**B 的休闲对战文件零触碰**;`quiz99.ts`、`src/styles.css` 本轮也一行未动。
> 主档 915×412,对照 390×844 / 1024×768。工装 `/tmp/r19a/*.mjs` 不进库。
> root 纪律:全程**只走 UI 密码门**(首页 🔑 → 输 `kangkang` → 选「永久」→ 打开),未 seed / 未改任何 storage key;解锁后全量 dump localStorage **无密码残留**,仅 `yiduo-yixing.root.v1 = {"expiresAt":…,"mode":"permanent"}` 合法记录,弹窗即关 ✓。

## 一、修了什么(4 号全清,零降级)

### N-100 level99 进场锚定卷顶 🔧 → ✅(改 `level99.ts` 一处,17 款全愈)

- 病根:`showMap(true)` 的 `cur.scrollIntoView({block:"center"})` 在矮横屏把「开始冒险 ▶」头行与 🎯/📖/⏭️ 工具行卷出 `.l99-view` 视口(实测 word-garden 滚距 230px、continue -154~-110)。
- 修法(两件套,均只在 `@media (max-height:500px)` 生效):
  1. `.l99-map>.l99-head` / `.l99-map>.l99-tools` **sticky 钉 `.l99-view` 顶**(top 0 / 50px,margin 换 padding 流内高度不变),滚多远两行都初见在屏;
  2. 新纯函数 `entryAnchorTop`:进场滚距钳到「当前关贴工具行下沿」,`Math.min(居中, 锚定)` **只减不增**——高 >500px 或没滚动(jsdom)一个像素不动。
- 红线自查:四处 `showMap(true)` 未动、`scrollIntoView({block:"center"})` 原样(n63 测试仍全绿)、模式芯片行未动、paneH 常量未碰。
- 验收(915×412,修后 top~bottom,17/17 PASS,cont/cur 全部初见在屏):

| 游戏 | `.l99-continue` | `.l99-node-cur` |
| --- | --- | --- |
| word-garden | 66~110 | 175~253 |
| ice-fire-forest | 66~110 | 175~253 |
| xiangqi | 121~165 | 230~308 |
| landlord-cards | 118~162 | 227~305 |
| bumper-cars | 142~186 | 251~329 |
| puzzle-tiles | 115~159 | 224~302 |
| brick-break | 116~160 | 225~303 |
| red-blue-tap / lianliankan | 120~164 | 229~307 |
| dot-maze(闯关地图) | 120~164 | 229~307 |
| fishing-star | 117~161 | 226~304 |
| poop-hero / puff-bros / red-blue-race / red-blue-tug | 120~164 | 229~307 |
| mine-garden | 164~208 | 273~351 |

- root 不回退:root×pinyin-train cont 66~110 / 直达行 168~212 IN;root×fishing-star 直达行 219~263 IN;root×bowling-lane cont 171~215 / 直达行 273~317 / cur 332~410 IN(工具行折两行 h=104 也被锚定钳住)。
- 390×844 与 1024×768 抽验(word-garden / puzzle-tiles / mine-garden)六案全 PASS,不回退。
- 测试:`src/games/level99.n100.test.ts`(4 例:sticky 规则、纯函数、只减不增守门、N-63/N-39 契约不回退)。

### N-99 sudoku-petal 盘底两行滚不到 🔧 → ✅(A 最重)

- 复现同 r18:`.sp-wrap` overflow:hidden(L1 sh448/ch178、root×188 sh575/ch134),盘底两排 393~450 / 450~506 用户滚不到(scrollIntoView 能滚是程序滚,手指/滚轮滚不动)。
- 修法:`@media (max-height:500px)` 给 `.sp-wrap{overflow-y:auto}`,滚动交还用户;数字排/工具排沿用既有 sticky 钉底配方,滚盘时一直在手边。题库/seed/判定零触碰。
- 验收 915×412(真实滚轮手势):L1 滚轮 st=270 滚得动,滚到底末格 180~236 全见;root×188(9×9,格径 30)st=441,末格 190~224 全见;`.sp-pad` 全程 203~295 IN h=44、`.sp-tools` 257~305 IN。
- 390×844 不回退:`.sp-wrap` 仍 hidden(基础规则未动),fold 0,pad 726~772、末格 647~703 全屏内。
- 测试:`src/games/sudoku-petal/wrapScroll.n99.test.ts`(3 例:矮档 auto、sticky 不回退、竖屏基线 hidden + CELL_MIN/KEY_MIN 红线)。

### N-97 math-farm root×深关选项线下 🔧 → ✅

- 复现:UI 开 root(永久)→ 直达 188,`.mtf-quizhost` 可视段仅 172~336(壳高预算被 stagebar+直达行吃掉),三块答案木牌 402~451 全线下(r17 数字 416 同病)。
- 修法(全在矮横屏媒体档,`runner.ts`/`farmScene.ts` 自家文件,quiz99 壳零触碰):
  1. `.mtf-quizhost .qz-choices` **sticky 钉宿主可视段底**(L1 装得下时不产生位移);
  2. `.mtf-word` 应用题题面收到正文红线 16px(基础态 19px 不动);
  3. root 开着(`:has(.qz-jump)`)把进度徽章/进度条/朗读/直达 order 到答案后面滚,题面+问句+三块木牌整组进第一屏;root 关着(含 L1)一行不动。
- 验收 915×412:root×188 题面 184~228 可读、选项 265~314 IN h=49 ≥44、选项不压题面(265 ≥ 228);答一题换题后 271~320 仍 IN;L1(root 关)选项 287~336 IN、进度条/徽章原位不动;390×844 选项 413~563 屏内不回退。
- 测试:`src/games/math-farm/deepFit.n97.test.ts`(4 例:钉底、16px、root 态重排、N-44 钳位不回退)。

### N-109 root 密码门矮横屏(余力项,在册降级 → 顺手修掉)

- 复现:915×412 时长四胶囊折两行,「打开/不打开」初见 413~459 折线下(盒内滚得到)。
- 修法:`ROOT_GATE_CSS` 加一档 `@media (max-height:500px)`:`.rootgate` gap 收 6px、胶囊瘦身(padding 0 10px / 字号 14)进一行、空 tip 不占位。输入框 46 / 胶囊 44 / 按钮 46 热区全部不动;密码契约零触碰。
- 验收:915×412 CTA 315~361 IN、时长行 265~309 单行 h=44;390×844(590~636)与 1024×768(552~598)与修前干净清单数字一致,零变化;解锁流程 + storage 无密码残留复验 ✓。
- 测试:`src/ui/rootGate.n109.test.ts`(3 例:收档规则、热区 44/46 不回退、弹窗内容契约不动)。

## 二、水位(只增不减)

- 进场基线 `206d0522` 全库:1201 files / 19505 tests(2 skip,N-105 已由先合的 16px 守门修复,本轮不重做)。
- 交卷全量实跑:**1205 files / 19520 tests 全绿**(2 skip 原样);新增 4 个测试文件 / 15 条用例,未改未删任何既有断言。
- `npm run build`(tsc --noEmit + vite build)绿,PWA precache 200 entries。

## 三、壳层守门建议评估(playbook 观察项,不强制)

「`.l99-host` 直系内容 sh>ch 时必须有可滚层或 fixed 底栏」的静态断言:评估后**本轮不加**——该断言要真实 mount 全部 76 款并逐一量高,属于跨工位集成工装(会把 B 面在修的 N-98/N-101/N-108 直接置红,撞车面大);建议下一战役由学习员先出「壳层可滚性」专用工装再落断言。N-100 的 sticky 钉顶 + 锚定钳滚距已把「map 态」这一半系统病根收掉。

## 四、纪律自查

- 独占面外零改动:`git diff` 仅 `level99.ts`、`sudoku-petal/index.ts`、`math-farm/runner.ts`、`math-farm/farmScene.ts`、`ui/rootGate.ts` + 4 个新测试 + 本报告;B 面文件、`quiz99.ts`、`styles.css`、engine/kit 未碰。
- 不改存档 key / meta.id / 题库 / seed / 胜负判定;root 全程走 UI 门,无 storage seed。
- 撞号自查:交卷前 fetch 对账,N-97/N-99/N-100/N-109 无先合版本,原号销账。
