# 三人组第 8 轮 · 测试修复员 A 记录(A 的第 3 轮)

基线:进场 `game-1.3`(含 A 第 2 轮:首页首屏、l99 SVG、modebar 收尾、竞技场钳高)。
分支:`cursor/tester-a-r7-fixes-def4`,目标合入 `game-1.3`。
执行依据:`docs/qa/trio-r8-playbook.md`(r7 playbook 原编号继续有效)+ `docs/qa/trio-r6-tester-A.md` 遗留。
方法:源码对账 → 修复 → Vitest 守门 → puppeteer-core + `/usr/local/bin/google-chrome` 真机量三视口(390×844 / 1024×768 / **915×412 主档**),深关用 `localStorage` 进度路直达(存档 key 一字未改),root 验收用密码 `kangkang` 路。
特殊情况:本轮与并行 r11–r14 批次大面积撞车,严格按「后合者拉最新、撞车取先合版」纪律处理,两次 merge 的取舍明细见「撞车对账」节。

## 水位

- 进场:`npm test` 全绿基线(r8 playbook 口径 1090 文件 / 19248 用例)。
- 交卷:**1185 文件 / 19500 用例:19498 过 / 1 失败(上游自带,见下)/ 1 跳过**;`npm run build` 全绿(PWA precache 200 entries)。
- 唯一失败 `src/games/casualFit.r10b.test.ts`(duo-rush 菜单开跑钮断言)**是 `game-1.3` 底座自带**:本分支对 `duo-rush/**` 与该测试文件零改动(`git diff origin/game-1.3 -- src/games/duo-rush` 为空可复证)。duo-rush 是休闲款,B 工位,A 不越界修,记账待派。

## 撞车对账(先合版赢,本分支不重复带上去的)

本轮开工在 r11–r14 并行批次之前,交卷时它们已先合入 `game-1.3`。凡撞车一律 checkout 上游版、删掉我方冗余守门测试:

| 项 | 我方实现 | 处理 |
| --- | --- | --- |
| N-16 走廊引擎钳高双栏 | `corridorFit.ts` + 双栏 CSS | 上游同款先合,取上游,删本地 `corridorFit`/`castleShell` 旧测试 |
| N-30 古堡 13 控件 / N-32 战斗三钮 / N-27 dot-maze | 双栏 + sticky | 上游先合,取上游 |
| L-2 faceLift 序列化 / L-3 贴纸补章 | 同款 | 上游先合,取上游本体;我方**新增守门测试留下**(`faceLift.test.ts` +40 行断言) |
| N-63 l99 地图钳高 / N-68 find-diff 三图并排 / N-73 音乐星星进阶双栏 | 同款思路 | 上游先合(`mapClampPx` / `miniCellPxRow` / `mst-scoreplay`),取上游;`music-stars/ui.ts` 手工合并:保我方 L-1 块 + 取上游 N-73 块 |
| C-6 推理关双栏 | `as-deduce` 专属档 | 上游 r13/r14「pads sticky + 舞台余量钳高」先合,取上游底座;**但先合版有残留死角,本轮补修**(见下) |
| N-47 古堡钮 44px | `min-height:44px` | 上游 r14 同款先合,取上游;我方守门测试 `hotzone44.r8.test.ts` 留下 |

## 修了什么(相对 `game-1.3` 的净贡献,13 文件 +299/−8)

### L-1 音乐星星关卡壳矮横屏双栏 ✅(r4 原账「再听一遍/声音芯片线下」)

- **坏在哪**:915×412 滚动窗约 208px,徽章+键盘+两条工具行纵排塞不进,「再听一遍」半截、声音设置四钮折叠线下;键位 rise=60 再把「哆」压出屏 22px。
- **怎么修**:`ui.ts` 关卡壳挂 `mst-level` 标记(advanced/沙盒不卷入),`(max-height:500px) and (min-width:700px)` 切「徽章+键盘左(恒 ≥360px 键排零裁)/工具行右」grid 双栏;矮横屏 rise 60→`SHORT_RISE_PX=28`(音高单调关系与热区不变)。
- **真机**:第 1/70/90 关键位底边 382/374/374 ≤412,第 167 关(上游 `mst-scoreplay` 档)411 ≤412;裁 0 线下 0;390×844 / 1024×768 原样。
- **测试**:`levelLandscape.test.ts`。

### L-1 quiz99 矮横屏双栏补账 ✅ + N-37 残余行缝

- **坏在哪**:r5 紧凑档(先合)收完 915×412 仍差 43px——题面 76+选项 46+消息 18 纵排 > 202px 可视窗,选项钮下缘裁 11、答后反馈整行线下;root×深关再叠 ~100px 抬头。
- **怎么修**:紧凑档内再切「题面左 / 问句+朗读+选项+消息右」grid 双栏,`span 4` 恰好盖住右栏常驻项(跨到空行 Chrome 会把题面高摊进去凭空长高),可选行(跳关说明/直达)整行横跨;行缝 6→4px 给 root×深关让出余量。
- **真机**:math-farm/word-garden/clock-house/shape-kingdom 四款 915×412 选项底边 304/326/263/315,消息 ≤348,全部裁 0 线下 0;shape-kingdom root 永久 × 第 100 关深关选项 269..315 整排在屏;390×844 / 1024×768 原样。
- **测试**:`quiz99.test.ts` 扩展断言。

### ocean-munch 节点图 ✅(r4 遗留,同 garden-guard 法)

- **坏在哪**:前九章各 11 关的小海域按大海域的 4 列排,3 行小圆点缩在画布正中显得空。
- **怎么修**:`mapFit.ts` 新增 `mapCols`(小海域竖屏 3 列/横屏 6 列,大海域原样)与 `nodeRadiusCap`(小海域 28→36,点击区同步变大)两个纯函数。
- **真机**:第 2 章 11 关三视口截图核形——915×412 横 6 列 2 行、390×844 竖 3 列 4 行、1024×768 横 6 列,节点+星级全屏内。ocean-munch 是纯 canvas 游戏,节点图不走 l99 DOM,验收以截图为准。
- **测试**:`mapFit.test.ts` 扩展断言。

### N-30/N-47 收尾:古堡「打开陈列」滚不到的死角 ✅(本轮新修,合并终态复测揪出)

- **坏在哪**:上游 N-30 双栏档给壳层写 `max-height:100%;overflow:hidden`,但 `.l99-host` 无定高、百分比绑不住——壳长到 408px 被 322px 宿主裁 86px,第 6 行「🏛️ 打开陈列」top 436 永远线下且**用户滚不到**(overflow:hidden 手势滚不动)。
- **怎么修**:壳层换 `calc(100dvh - 90px)` 钳高 + `overflow-y:auto` 自滚;album 行加 `min-height:48px` 托底(**overflow:auto 的自动最小尺寸是 0,壳层一钳高网格就把整行压塌成 0 高**);开馆态挂 `advk-album-open` 把行托满 28dvh(上游本来给的上限),展柜别在 48px 缝里内滚 712px。
- **真机**:915×412 壳滚 89px、按钮滚后 346..390 全入屏、开馆窗口 115px 展柜四列可见、收起钮可点;默认视野 9 方向键+复位/小地图/结束/回选关一个不动(三档全 h44);390×844 / 1024×768 零变化。
- **测试**:`hotzone44.r8.test.ts` 补 3 条(dvh 钳高、min-height 托底、开馆态)。

### C-6 残留:推理关工具行/提示滚不到的死角 ✅(本轮新修,合并终态复测揪出)

- **坏在哪**:先合版(r13/r14)把五键+暂停用 sticky 钉进了屏,但右栏在 `overflow:hidden` 的 wrap 里还欠 327px:工具行(缩放/**望远镜**)402..498、提示 672 线下,滚也滚不到——望远镜是玩法道具,丢了算功能缺失。
- **怎么修**:把 r8 验证过的 `as-deduce` 专属档按先合版底座重新安上(sticky/钳高/overflow 一行不删,只加规则):右栏放宽 300px 起、画布显式跨满右栏四行(`1/-1` 在隐式网格里只占第 1 行,画布把 row1 撑到 208px 才把工具顶下去)、D-pad 压成一行(3×3 占位 span 在 flex 里零宽,热区 44 不动)、工具行不换行可横滑、线索盒收矮内滚。
- **真机**:915×412 第 122 关溢出 327→4,线索 190..242 / 工具 246..290 / 五键 317..361 / 提示 365..398 全入屏,线下按钮清零;find 关/竖屏/平板零变化;对战双 pad 不受波及(`buildVersusRound` 永远 `deduce:false`,无尽每 4 轮的推理轮是单人)。
- **测试**:`deduceLandscape.r8.test.ts`(含「先合版底座没被动」取反断言)。

### L-2 / N-47 守门测试补齐(本体先合,断言留档)

- `clock-house/faceLift.test.ts`:+40 行序列化形态断言(DOM 序列化成 `</line>` 自闭合两种结尾都认,防「一根针都换不到」回归)。
- `adventure-king/hotzone44.r8.test.ts`:`.ak-back` / `.advk-tool` 44px 红线断言(本体上游 r14 已合,断言对上游版生效)。

## 合并终态浏览器抽验(全部在两次 merge 之后复测)

- **N-63**:bowling-lane / hop-pads / music-stars 三视口 `.l99-node-cur` 整格在屏、舞台滚 0、`.bl-open` 三钮在屏可点。
- **N-68**:find-diff 第 100/110 关 915×412 三图并排(格子 250..336 全在屏,`playBelow 0`),第 1/40 关双图并排零回归,390×844 竖排原样,1024×768 并排同绿。
- **N-73**:music-stars 第 167 关 `mst-scoreplay` 档裁 0 线下 0(自滚 87 在键盘 sticky 档内,可滚可玩)。
- **N-37 残余**:shape-kingdom root 永久 × 深关 100,选项整排 269..315 在屏。
- 古堡/推理关/节点图数字见上节。

## 新发现(记账待派,本轮不越界)

1. **alien-seek find 单人关同款死角**:915×412 第 121 关(find)`als-tools` 402..498、「🔭 望远镜 2」top 452 线下滚不到(wrap overflow:hidden 欠 327px),缩放行只露 10px。**没跟 C-6 一起修的原因**:find 的 pads/tools 结构与对战(players:2,双 pad)共用,`as-deduce` 那套「D-pad 压一行」推给 find 会把对战双 pad 挤爆——对战是 B 工位。建议下轮单独开档(如 `as-find-solo` 标记)或由 B 连对战一起量。
2. **duo-rush `casualFit.r10b.test.ts` 断言失败**:`game-1.3` 底座自带(期望 `.dr-start { position` sticky 写法),休闲款 B 工位。
3. r8 playbook 我名下其余项(N-33/N-36/N-38/N-34/N-35/收藏册热区/S-4 扩容)**均已被并行批次先合销账**,合并终态源码对账 + 抽验通过,本轮零重做。

## 红线

- 存档 key `yiduo-yixing.l99.<id>` / skip key / `meta.id`:一字未改(验收注入走既有 key 只读写测试浏览器)。
- 题库 / seed / 判定 / 关卡生成:零触碰(全部改动是壳层 CSS + 标记类 + 纯函数)。
- `src/art/kit/`:只 import 未改。
- 测试只增不减:净增 3 个测试文件(`levelLandscape` / `hotzone44.r8` / `deduceLandscape.r8`)+ 3 个既有测试文件扩展断言。
- 休闲/对战/动手目录:零提交(唯一失败测试也不代修)。
