# 三人组第 9 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`game-1.3 = 6a9f42d0`（= r8 笔记合入 + **测试修复员 A 第 2 轮 `d451c32d` 合入之后**）。
> **重要对账更正**：r8 笔记写于 A 第 2 轮合入之前，其「r7 playbook 全部原样有效」的结论已过期——A 的 8 个代码提交（`58ca016f`…`3469af36`）已把 S-1/S-2/S-3/S-4(l99 侧)/L-1/C-1(含 ak-bar) 与两条 r4 遗留全部修掉。本轮第一件事就是把这些项标 ✅，测试员别再重复做。
> 主力抽测：r8 模式 J 的最后一块空档——**root 态 × 深关关型交叉**、**攻略抽屉窄屏 sheet 态**（76 款共享件从未量过）、首页搜索态、以及 r5 干净名单复证。新伤从 **N-39** 续编。
> 本轮交付两份文档 + r8/r7 playbook 对账标注。`src/**` 一行未动。

## 一、抽验方式（可复现）

- `npm ci && npm run build && npx vite preview --port 4173`，headless Chrome（`/usr/local/bin/google-chrome` + puppeteer-core，脚本与截图放 /tmp 不进库）。
- 视口：**915×412** 主档；新伤跨 390×844 / 412×915 / 1024×768 复核。量法口径同 r4–r8（stage 裁切 / 自滚容器 / 「按钮 top ≥ 视口高」计线下）。
- **本轮工装新纪律（血的教训）**：多状态抽验（root 开/关、进度深浅）**每个状态一个隔离 incognito context 或先 `localStorage.clear()`**。本轮第一遍跑限时关「基线」时，上一档种下的 root 永久态从同源 localStorage 漏了下来，把干净基线量成了 crop 294 + 三票线下，差点把 r8 的「限时关干净」误判成回归。隔离重跑后基线 crop 6、全在屏——**凡「基线 vs 状态态」对照，两档共用浏览器 profile 就是无效实验**。
- root 态直达：种 `yiduo-yixing.root.v1 = {"expiresAt":9999999999999,"mode":"permanent"}`；深关进度：种 `yiduo-yixing.l99.<id> = Array(N-1).fill(1)` 走正常解锁再点格子（两条路口径见 r8 模式 J）。
- 进场水位：`npm test` 于 `6a9f42d0` 全绿（**1095 文件 / 19288 用例**，与 A 第 2 轮交卷水位一致）；`npm run build` 通过。

## 二、r8/r7 playbook 对账（对照 `6a9f42d0` 源码 + git + 浏览器复证）

### 已被 A 第 2 轮修掉的（✅ 标进 r7/r8 playbook，别重复做）

| 项 | 证据（源码 + 本轮浏览器复证） |
| --- | --- |
| **S-1 首页首屏** ✅ | 浏览器复证三档：915×412 首卡 top=304（≤312 达标）、390×844 top=496、360×640 top=493——与 A 报告数字逐位一致；`styles.css` 两段新媒体查询在位 |
| **S-2 l99 星级 SVG** ✅ | `level99.ts:517` `starRowHTML` 已是 12×12 内联 SVG（行号从 469 漂到 517，A 加了 fitPane 等函数） |
| **S-3 parentAuth 跨路由残留** ✅ | `parentAuth.ts:592/:602` hashchange 监听在位，finish 里同步摘除 |
| **S-4 l99 侧跳关输入热区** ✅（扩容项另账） | `level99.ts:579` `.l99-jump-input` `min-height:44px`；**但 r8 点名的扩容 `.qz-jump-input` 仍 38px（`quiz99.ts:153`），这半条还开着** |
| **L-1 学习款横屏** ✅ | 浏览器复证：shape-kingdom 第 1 关 915×412 crop 0、三个选项钮 bottom 405 ≤ 412、线下 0;find-diff 第 1 关双图并排（两 panel top 同 206、左 220/405）、`.fdf-viewport` 自滚 0。quiz99 紧凑档（`@media (max-height:500px)`）在位 |
| **C-1 modebar `[hidden]` 四款 + 守门测试** ✅（N-28 同步销账） | box-hamster / prince-princess / sudoku-petal / adventure-king `.ak-bar` 各补一行;守门测试 `src/games/modebarHidden.guard.test.ts` 已合入（r6 口径） |
| **r4 遗留 · 竞技场卡底留白** ✅ | orb-arena / snake-royale 走 `level99.ts` `fitPaneH/fitPanesToStage` 钳高，A 报告 390×844 缺口 250/219→6px |
| **r4 遗留 · garden-guard 节点图** ✅ | `mapFit.ts` `mapCols/nodeRadiusCap` 已合入 |
| **N-24 首页横屏 0 卡**（r5，并入 S-1） ✅ | 见 S-1 复证 915×412 top=304 |

### 没动的（原样有效，行号按 `6a9f42d0` 校准）

- **L-2**：`clock-house/levels.ts:78` `clockSVG` 原样。**L-3**：`boardArt.ts` 头注原样。
- **N-33 壳层结算弹窗**：`styles.css:926` `.dialog` 无 sticky、`dialogs.ts` 零提交;A 的 +222 行全是首页规则，grep 无一行 dialog。**口径修正一笔**：915×412 命中的是 `styles.css:1774` `@media (max-height:560px)` 的 `max-height:92dvh`（≈379px 可视），不是 r8 写的 86dvh 基础档——病根与修法不变（滚动边界切在读/按之间），验收数字按 92dvh 算。
- **N-34/N-35/N-36**：`spell.ts` / `pickAll.ts` / `tracing.ts`（`.wgd-pad` 仍 `min(72vw,300px)` + `touch-action:none`）零提交。
- **N-37**：本轮实测还加重了一档，见第三节。
- **N-38**：`level99.ts:469` `rootJumpNote` 仍无永久分支（行号 430→469）;本轮截图再实锤：种永久态后关内小字显示「管理员权限还剩 136867925 分钟」。
- **收藏册热区**：`collection.ts:351` 40×40 / `:381` 36px 原样。
- **N-25/N-26/N-27/N-29/N-30/N-31/N-32、N-2…N-23、C-2…C-9、N-10**：对应目录在 `77c89fc8..6a9f42d0` 零提交（`git diff --stat` 全表可证），原样有效——**其中一批已在 B 的在途分支上，见下**。

### B 在途分支撞车警报（`cursor/casual-duo-fit-r5-b-4683`，3 提交，**未合入**）

- 覆盖面（按提交说明与 diff）：**N-1**（fruit-catch 三模式钳高）、**C-2/C-3/C-5/C-6/C-7**（brick-break/snake-snack/mole-pop/alien-seek/match-stars 舞台余量钳高）、**N-11…N-15 + N-19**（配方 F 六款 room 改量真实余量）、**N-16/N-17/N-18**（ak 走廊钳高 + 古堡盘宽让右翼 / prince-princess / box-hamster）、`[hidden]` 追加（ak-bar/sr-skins/sp-hintbox/tt-sum-bar）+ 守门测试。
- **撞车点 1**：B 分支基于 A 合入前的基线，box-hamster / prince-princess / sudoku-petal / adventure-king 的 `index.ts` 与 A 已合入的 `[hidden]` 行重叠，rebase 必冲突——按纪律「后合者拉最新、撞车取先合版」，A 已合入 = 先合版，B 侧重复行应弃。
- **撞车点 2**：B 的守门测试是新文件 `src/games/__tests__/modebar-hidden-guard.test.ts`，与 A 已合入的 `src/games/modebarHidden.guard.test.ts` 同职能不同文件不同口径——**合入前必须二合一**（建议保 A 版口径、把 B 新增的提名并进去），别让库里躺两份守门各说各话。
- 对账留白：这些项在 playbook 里标「B 在途」，**下一轮以 B 实际合入的批次为准销账**；B 未合入前它们法律上仍是开账。
- 顺带核实：`casual-duo-layout-fit-dd16`（象棋/围棋平板横屏 `66601b46`）**早已全部合入**，r5 的 N-10 就是按它量的（412px 高仍不够），N-10 状态不变。

## 三、新抽验结论（root×关型交叉 / 共享覆盖层 / 复证,主档 915×412）

**干净、可以放心的（本轮补测结案，下轮不用再量）**：

- **攻略抽屉窄屏 sheet 态**（`GUIDE_SHEET_QUERY = max-width:640px`，76 款全有 guide.ts 的共享件，历轮只量过 915×412 侧栏形态）：412×915 / 390×844 / 360×640 三档 `.guide-drawer--sheet` 底部半屏正常升起，**「知道啦」（44px 高）与「✕」（44×44）钉在不滚动的 footer/header 里三档全在屏**（855–899 / 784–828 / 580–624），`.guide-body` 内滚 262/306/508 属读为主设计内——结构上把「读的滚、按的钉」做对了，正是 N-33 该抄的作业，可在修 N-33 时当参照件引用。
- **首页搜索态 915×412**（A 新紧凑头下从未量过）：搜「拼」出 2 卡、首卡 top=273 在屏、输入框 44px、清除钮 44×44，干净。
- **组字关（word-garden 172）root 态**：915×412 贴线幸存——`bc-pick` 部件票 bottom 400 ≤ 412、按钮线下 0（root 把 `.bc-wrap` 自滚从 124 顶到 226，但交互件都还在屏）;412×915 root 态干净。与 N-37 里 word-garden 答题关「贴线幸存」同命，不立项。
- **限时关（pinyin-train 135）基线四档干净**：915×412 crop 6 / `pyt-quizskin` 自滚 142 但全部票在屏;390×844 / 412×915 / 1024×768 crop 0 线下 0——**r8 的「限时关干净」复证仍成立**（root 态是另一回事，见 N-37 加重档）。
- **gold-hook 915×412 复证干净**（r5 干净名单抽检，A 的全局 styles 改动无副作用）。

**新发现（编号续 r8，N-39 起,均有截图与数字留档）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-39 | **l99 蓝本地图首次进图 / 回地图不聚焦当前关**（全部 l99 款共享） | 915×412 首次进图,当前关格子（`.l99-node-cur`,76px 高）位置：hop-pads **426–502 整格线下**、red-blue-race **412–488 整格线下**、poop-hero **412–488 整格线下**;math-farm / clock-house / word-garden 408–484、pinyin-train 408–484、tap-tiles 410–486 **切半**——抽测 8 款 8 中,仅程度不同;1024×768 全部在屏。首屏被「章节页签 + 模式页签 + 图例提示行」吃满（hop-pads 还多一排弹簧台/一次台/跳跳杯页签,所以最深）,孩子进游戏第一眼看不到那个能点的关。病根：`level99.ts:782` `showMap(focusCurrent = false)` 默认不聚焦;聚焦机制本身现成（`:921` 对 `.l99-node-cur` `scrollIntoView({block:"center"}) + focus`）,但只在直达（`:820`）与跳过（`:824/:1054`）路径传 true,**初次进图（`:1085`）与三处「回地图」（`:978/:1009/:1038`）都走默认 false**。修法：这四处调用补 `showMap(true)`（行为与直达路径完全一致,零新机制）;或矮横屏把图例/提示行折叠。蓝本一处修,全部 l99 款受益。**别与 N-23 补充版混账**：N-23 是 bubble-aim 族三款自建地图压根没这机制,N-39 是蓝本有机制没接线 | 🔧 一行级 × 4 处,拉绿组 |

**N-37 加重档（不另立号,并进 N-37 的验收矩阵）**：root 永久 + 915×412 进 pinyin-train **限时关 135**：crop 6→**294**,三张答案票 `pyt-ticket` **整排线下（top 608）**,qz 直达行也在线下（461）——比 r8 N-37 记录的首关「车票 374–454 切半」重一整档（root 抬头 + 计时条 + 火车画布带三层叠加）。N-37 的验收矩阵从「4 quiz 皮肤 × root 开关」扩成「4 皮肤 × root 开关 **+ 深关限时档（135 关族）**」。

**观察项（不立项，留档防重查）**：

- 组字关 root 态自滚 124→226：交互件全在屏,N-37 修掉 root 抬头后自动缓解。
- hop-pads 地图头部比其他 l99 款多一排玩法页签,是 N-39 里它垫底（426）的原因——修 N-39 时它是最佳验收样本。
- 限时关 root 态里 `.qz-jump-input`（38px 热区）与直达钮一起沉在线下——修 S-4 扩容时顺带就好,不重复挂号。

## 四、系统性模式提炼（r4 A/B/C、r5 D/E/F、r6 G/H、r8 I/J 仍有效，本轮补一条）

### 模式 K · 共享蓝本的机制要看「接线」，不只看「存在」（N-39 机理）

- **机理**：l99 蓝本明明内建了 focusCurrent（scrollIntoView + focus），但默认参数 false、只有两条路径传 true——「机制存在」和「机制在此路径生效」是两回事。与 C-1 的 `[hidden]`（UA 规则存在、被 `display:flex` 顶掉）、r7 N-31 的显隐开关（控件存在、开了才占位）同构：**验收共享件时,按「调用路径 × 默认参数」铺矩阵,别看见机制就打绿**。
- **配方**：审计共享函数的布尔参数默认值——凡「体验型参数」（聚焦/滚动/动画/朗读）默认关,就把每个调用点过一遍问「这里为什么不开」。修复时优先改调用点而不是改默认值（改默认值会波及没量过的路径）。
- **修好判据（N-39 专用）**：915×412 首次进 hop-pads/red-blue-race/poop-hero,不滚就能看见并点到当前关格子;过关→回地图同样;1024×768 与竖屏零回归（本来就在屏,居中一下不算回归）。

### 工装纪律补一条（写给下一轮的自己与 A/B）

- **状态对照实验必须隔离存档**：同一浏览器 profile 里跑「root=false → root=true」两档,localStorage 会把前一档的种子漏给后一档（本轮 T7 差点误报）。每档一个 incognito context,或进场先 `localStorage.clear()` 再种当档种子。A/B 的修复验收脚本同样适用——**尤其 N-37/N-39 这类要量「开/关对照」的**。

## 五、skills 增量提炼（r4–r8 已写的不重复）

| skill | 本轮新提炼 | 落点 |
| --- | --- | --- |
| `frontend-design` | 「首屏必须有那个唯一行动点」的地图版：选关地图的第一屏若全是页签/图例,等于首屏没有 CTA——聚焦当前关不是锦上添花,是矮屏下的可用性底线 | N-39 |
| `frontend-design` | 「读的滚、按的钉」有正面样板了:攻略抽屉 sheet 态(footer 常驻 + body 内滚)三档全绿——修 N-33 结算弹窗时按它抄结构,不用发明新方案 | 攻略 sheet 结案 |
| `algorithmic-art` | 无头多状态抽验:一态一 context;「基线 vs 状态态」共用 profile = 无效实验。另:通用量尺要把「容器自己就是滚动者」算进去(stage 本身 overflow:auto,只扫子元素会把可滚误判成不可达) | 第一节工装 |
| `canvas-design` | 布尔体验参数默认关的共享件,验收按「调用路径 × 参数」矩阵铺,机制存在 ≠ 路径生效 | 模式 K |

## 六、已收口账目汇总（下一轮不要重复做）

1. **A 第 2 轮九项全部 ✅ 复证结案**：S-1（三档数字复证）/ S-2 / S-3 / S-4(l99 侧) / L-1（shape-kingdom + find-diff 双档复证）/ C-1 四款含 N-28 / 竞技场留白 / garden-guard 节点图 / N-24。
2. 攻略抽屉 sheet 态三档（412×915 / 390×844 / 360×640）——76 款共享件干净结案,且是 N-33 的正面参照件。
3. 首页搜索态 915×412、组字关 root 态两档、限时关基线四档、gold-hook 复证——干净结案。
4. N-33 口径修正:915×412 生效档是 `styles.css:1774` 的 92dvh（≈379px 可视）,不是 86dvh 基础档;账本身原样。
5. N-10 对账:`66601b46` 早已合入且 r5 就是按它量的,状态不变,别当在途批次重查。
6. r8 笔记第六节的收口全部继续有效（l99 过关/失败覆盖层、rootgate、root 地图、组字/限时基线、收藏册两档、描红三档、结算弹窗竖屏）。

## 七、下一轮 A/B 最该先做的 10 条（与 r9 playbook 排序一致）

1. **N-33 壳层结算弹窗矮横屏必点钮线下**（共享件一处修 76 款受益,连续两轮最重;正面样板 = 攻略抽屉 sheet）
2. N-25 fight-king 格斗塔（**连续四轮最重未动**,915×412 裁 498）
3. N-34 拼写关 + N-35 全选关（学习款交互件全线下,一个 PR）
4. **N-39 蓝本地图聚焦当前关**（一行级 × 4 调用点,全部 l99 款受益,先做拉绿）
5. N-30 adventure-king 无尽古堡 13 控件（**注意:B 在途分支已动古堡盘宽,先 fetch 对账再动,撞车取先合版**）
6. N-26 duo-vs-star 七键 + N-27 dot-maze 四模式（r6 老账;若 B 合入批次未覆盖再动手）
7. N-36 word-garden 描红关矮横屏（手势面无逃生门）
8. **N-38 永久文案一行修 + S-4 扩容 `.qz-jump-input` 44px + 收藏册 40/36px 热区**（半小时级凑一批拉绿）
9. N-37 root 态挤压（验收矩阵含新加的限时深关档;工装用隔离 context）
10. L-2 题面钟 / L-3 贴纸补章 + B 合入时守门测试二合一（`__tests__/modebar-hidden-guard` 并进 `modebarHidden.guard`）
