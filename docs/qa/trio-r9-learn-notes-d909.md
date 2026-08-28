# 三人组第 9 轮（d909 组）· 学习优化员抽验笔记（本轮只学习、只记录，零玩法代码改动）

> **文件名带 `-d909` 的原因**：本仓当前有多组三人组并行（分支后缀 `-d909` / `-65de` / `-7779` / `-c14c`），`docs/qa/trio-r9-learn-notes.md` 与 `trio-r9-playbook.md` 已被另一组占用（同基线 `6a9f42d0`，内容不同）。**不覆盖别人的报告**是纪律，因此本组另立文件名。
> **编号从 N-59 起**：任务书原写「从 N-39 续编」，但落笔时 `origin/game-1.3` 上 **N-1…N-58 已全部被各组占用**（跨全部 `docs/qa/*.md` 实扫得到的最大号 = N-58）。为了不撞号，本组新伤从 **N-59** 续编，并在下表逐条写明与已占号段的关系。
>
> **两个基线，都要写清楚**（本轮踩到的最大坑就是「基线会动」）：
> - **入场基线 `6a9f42d0`** = 任务书说的「最新 `origin/game-1.3`」，= r8 笔记合入 + 测试修复员 A 第 2 轮（`58ca016f`…`3469af36`）合入之后。r8 playbook 的对账以它为准。
> - **交卷时实况 `bf4d84ac`**（写稿当天 `origin/game-1.3` 的 HEAD）。写稿过程中 game-1.3 前移了 **20 个提交 / 83 个源文件 / +2240 行**（其它组的 r9–r11 成果陆续合入）。**本笔记的每条新伤都在 `bf4d84ac` 上复测过一遍**，只有仍然复现的才留号。
>
> 交付：本文件 + `trio-r9-playbook-d909.md`。`src/**` 一行未动（工装脚本与截图全在 `/tmp/r9/`，不进库）。

## 一、抽验方式（可复现）

- 起服：`npm run build && npx vite preview --port <port>`；无头验证 puppeteer-core + `/usr/local/bin/google-chrome`（puppeteer-core 装在 `/tmp/r9/node_modules`，**不进仓库 package.json**）。
- 视口：**915×412 主档**；新伤跨 390×844 / 412×915 / 1024×768 复核，另加 360×640 与 1280×800 对照。
- 量四个数（口径同 r4–r8）+ r8 的弹窗口径（配方 I）+ **本轮新增两条口径**，见第四节模式 L / M。
- **本轮工装的关键改良（建议 r10 A/B 照抄，能省掉一整轮误判）**：

  1. **每档一个全新浏览器实例**。同一个 browser 里开多个 page 共享同源 localStorage——「全新档案」会被上一档的存档污染。本轮就是因为这条，先量出一批错数，重做后才发现真账（见 N-59）。
  2. **给被测版本钉一个独立 worktree + 独立端口**。本仓是多智能体共用同一个 `/workspace`，测试员会在你量到一半的时候 `git commit` + `npm run build` 把 `dist/` 换掉。本轮实测到了这个：14:22 有人合入 `.dialog-buttons` sticky，我 14:35 量到的「N-33 已经好了」其实是量了别人的新版本。**修法**：`git worktree add --detach /tmp/<name> <commit>` + `ln -s /workspace/node_modules` + 各自 `vite preview --port`，本轮同时挂了 4181/4182/4183/4184 四个版本对照，结论才敢写。
  3. **「够不着」要算容器剪裁，不能只算出视口**。控件 `top < 视口高` 但被某个可滚祖先的可视框切掉，一样点不着（本轮 alien-seek 1024×768 就是这种：`crop=282`、6 个控件出视口，另有 4 个「在视口里、在容器外」）。判据：向上找有 `overflow-y:auto|scroll` 且真的能滚的祖先，比 `el.top >= 祖先.bottom`。
- 深关直达统一走 **localStorage 进度路**（`yiduo-yixing.l99.<id>` = `Array(N-1).fill(1)`），免 root 抬头污染；进关钮认 **`.l99-continue` 类名**，别认文案——有进度时它显示的是「继续 第102关 ▶」而不是「开始冒险 ▶」。
- **进场水位（`6a9f42d0`，`npm test`）= 1095 文件 / 19288 用例**，与 A 第 2 轮交卷水位一字不差。`npm run build` 通过。
  - ⚠️ **水位有个坑要写进纪律**：本机 4 核，默认并发下 `npm test` 会**假红 6 文件 / 7 用例**（`snake-snack/qaC1`、`bomb-buddies/ai`、`snake-royale/ai`×2、`sudoku-petal/solver`、`window1-smoke-seeds` 全是 `Test timed out in 5000ms`；`gomoku/tiers` 是 `expected 7 to be >= 9`——它的地狱档吃 CPU 时间预算，被抢核就打不赢）。**同样 6 个文件 `--maxWorkers=1` 单跑 147 用例全绿**。r10 A/B 遇到这批红别去改代码，先单跑复验。

## 二、r8 playbook 对账（入场 `6a9f42d0` → 交卷实况 `bf4d84ac`）

**一句话对账：r8 playbook 的 14 项里 11 项已结案，只剩 3 项没动；但结案不等于没事——S-1 与 N-25 两条是「修了一半」，账要接着记（N-59 与下表 N-25 行）。**

r8 笔记写在 `77c89fc8`，其「r7 playbook 全部原样有效」的结论在 A 第 2 轮合入后就过期了。以下逐条以源码位 + 浏览器实测双证。

| 编号 | r8 状态 | 现在（`bf4d84ac`） | 证据 |
| --- | --- | --- | --- |
| S-1 首页三档首屏 | 🔧 | ⚠️ **半结案** | 全新档案实测 915×412 top=304 / 390×844 496 / 360×640 493，与 A 报告一字不差 ✅；但**验收口径漏了「最近玩过」行**，孩子玩过一款之后三档重新破线 → 新账 **N-59** |
| S-2 l99 星级 → 内联 SVG | 🔧 | ✅ 结案 | `3aa37163`，`starRowHTML` 已是 12×12 viewBox |
| S-3 parentAuth 跨路由残留 | 🔧 | ✅ 结案 | `b38450f7` 补 hashchange；本轮 hash 往返抽验零残留（第三节） |
| S-4 `.l99-jump-input` 38→44 | 🔧 | ✅ 结案 | `3aa37163`，`level99.ts` 已 `min-height:44px` |
| S-4 扩容 `.qz-jump-input` 38→44 | 🔧 | ✅ 结案 | `quiz99.ts:153` 已 44px（入场时还是 38px，写稿期间被别组合入） |
| L-1 学习款横屏（shape-kingdom / find-diff） | 🔧 | ✅ 结案 | `1a79eab4`；find-diff 原生横屏实测两图并排、自滚 0、线下 0。**但旋转进来不复排** → 新账 **N-61** |
| L-1 余下（color-fun / music-stars） | 🔧 | ❌ 未动 | A 判为动手款、划出范围。**这个划法要复议**：两款挂在「学习」页签下，孩子从学习入口进得去，范围该按孩子看到的分类算，不按内部目录算 |
| L-2 clock-house 题面钟两代同堂 | 🔧 | ❌ 未动 | `clock-house/levels.ts` 里 `arrowHandD` / `hubSVG` 零命中 |
| L-3 find-diff 盘面贴纸补 4–10 章 | 🔧 | ❌ 未动 | `boardArt.ts` 头注原样 |
| C-1 modebar `[hidden]` 四款 + 守门测试 | 🔧 | ✅ 结案 | `9e08e4f3` + `3469af36`，`modebarHidden.guard.test.ts` 在库 |
| **N-33 壳层结算弹窗**（r8 最重） | 🔧 | ✅ **结案，走的正是配方 I ①** | `7baf86de`。**修前修后双侧实测**：入场版 915×412 弹窗框 16..396、`.dialog-buttons` 落在 **395..495**（两个必点钮全在框外）；修后 `.dialog-buttons{position:sticky;bottom:var(--dialog-pad-b,24px)}` + `::before` 上缘渐隐 + `::after` 下摆，同一局结算钮回到 **260..360**，全在框内。文案加长到 3 行、五档视口重跑，末钮一律不出框 |
| **N-25 fight-king 格斗塔**（连续四轮最重） | 🔧 | ⚠️ **各组进度不一致，game-1.3 上只关了一半** | 入场 `6a9f42d0`：crop **498**、轻击/重击/必杀/防御四钮 top 674/724 线下。d909 组测试员 B 的 `13a4e38e`：crop **6**、线下 **0**（真结案）。**但当前 `game-1.3 = bf4d84ac` 实测 crop 仍 371、四个必点钮仍在 663/713 线下**——合进主干的是另一组的另一版修法，没关净 |
| N-1 fruit-catch（四轮未动） | 🔧 | ✅ 结案 | 入场 crop **741** / 画布 644×823 出屏 617；`bf4d84ac` 上 crop **86**、画布 644×160、线下 0 |
| N-34 拼写关 / N-35 全选关 | 🔧 | ✅ 结案 | 入场 450（11 张票 + 3 个车厢槽够不着）/ 179（6 张票 + ✅就挑这些）；`13a4e38e` 后两关型 crop 均 **0**、线下 **0** |
| N-36 word-garden 描红关 | 🔧 | ✅ 结案 | 入场 `.wgd-pad` 150..450 出屏 38、宿主自滚 279；`bf4d84ac` 上 `.wgd-pad` 150..390 全进屏、自滚降到 183（修法是给 pad 加了 `--wgd-pad-room` 高度尺，与 r8 建议同向） |
| N-37 root 态挤压 quiz 族 | 🔧 | ✅ 结案（随 N-38 同批） | 见下行 |
| N-38 关内直达永久态文案 | 🔧 | ✅ 结案 | `level99.ts:473` `rootJumpNote` 已有 `if (isRootPermanent(nowMs)) return rootStatusLine(nowMs)` |
| 收藏册 40px 关闭钮 / 36px 解锁钮 | 🔧 | ✅ 结案 | `collection.ts:351` 44×44、`:381` `min-height:44px` |

> **给 r10 的对账纪律（本轮血泪）**：多组并行时，「r8 playbook 说没修」和「我拉下来的 game-1.3 上没修」是两回事，「某个组的分支上修好了」和「主干上修好了」又是两回事。**动手前先在自己钉住的 commit 上跑一遍复现脚本**，复现不出来就别修，复现得出来也要先 `git log -S` 查是不是别人正在改同一处。

## 三、新抽验结论（本轮选的六个维度，都是 r4–r8 没覆盖过的）

### 干净、可以放心的（本轮补测结案，下轮不用再量）

- **关内暂停 → 再开 → hash 往返**（fight-king 格斗塔 + clock-house，915×412）：⏸ 暂停 / ▶ 继续来回一遍，再 `history.back()` → `history.forward()` → 暂停中直接 `location.hash="#/"` → 再回游戏，全程 `.game-stage` 恒为 1、`.dialog-backdrop` 恒为 0、`document.body` 无 overflow 残留。**离场无泄漏**：给 `requestAnimationFrame` / `setInterval` 装计数探针，关内活着 1 个 rAF，回首页立刻归 0。S-3 那类「弹窗跨路由残留」在暂停面板上不复发。唯一的行为特征是 forward 回来落在模式菜单/地图而不是原来那一关（壳层重挂，非缺陷，别当 bug 修）。
- **关内键盘可达性**（shape-kingdom 关内，915×412，Tab×14）：焦点环 **0 缺失**、热区 **0 个 <44px**、Tab 序合理（跳过链接 → 顶栏 5 键 → 关内工具 3 键 → 三个答案钮 → 回卷）。全局 `:focus-visible{outline:3px solid var(--focus-ring)}` 在关内一路生效。
- **shape-kingdom 作图关（第 102 关族，`isDrawLevel`）**：四档 crop 全 0、线下钮全 0。915×412 下 `.shk-dock`（💡提示 / 🧹重来 / ✅我摆好了）**`position:sticky;bottom:0` 真的钉住**，实测恒在 278..386；点阵最后一行 7 颗点要滚 270px 才够着，但 `.shk-fit-scroll .shk-board{touch-action:pan-y}` 给了逃生门。这是 W5R2 写在源码注释里的**已知设计取舍**（竖着按住拖会变成滚动，点两个点是主路），**不立项**。
- **首页筛选组合 × 空状态**（7 种组合 × 5 档视口）：全部组合零横向滚动；空组合（动手+端游）落到空态文案「🌱 端游里还没有双人玩法的游戏,换个筛选试试吧!」——**有方向、不甩锅，符合 frontend-design「空屏是邀请去做一件事」**，照抄这句的语气就行。
- **N-34 / N-35 / N-36 / N-33 修后回归**：见第二节，四条都在 915×412 复测过修前修后两侧数字。

### 新发现（编号从 N-59 续编，全部在 `bf4d84ac` 上复现过）

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| **N-59** | **首页首屏验收漏掉「最近玩过」行**（S-1 的后半本账） | 同一份 CSS、同一档视口，只差有没有玩过一款：<br>· 915×412　全新 top=**304** ✅ → 玩过一款后 **407**（判据 ≤312，**差 95px**）<br>· 360×640　全新 **493** ✅ → **603**（判据 ≤540，**差 63px**）<br>· 1024×768　全新 **557** ✅ → **691**（判据 ≤668，**差 23px**）<br>· 390×844 / 412×915 / 1280×800 两种状态都过<br>「最近玩过」整块吃掉 **+103…+134px**，而它正是**孩子第二次打开 App 起的常态**——全新档案才是那个罕见状态。每档一个全新浏览器实例量的，排除了 localStorage 串档 | 🔧 **本轮最重**：验收口径写错，等于 S-1 只对第一次开机的孩子有效 |
| **N-60** | **旋转后画布不复算**（`fitPanesToStage` 只在进关量一次，无 resize 监听） | 竖屏进关再转横屏（不重载），对照同视口原生直进：<br>· orb-arena　旋后 crop **757** / 画布 648×**873** / 出屏 **646**　‖ 原生横 crop **127** / 画布 648×**243** / 出屏 16 → **差 630**<br>· snake-royale　旋后 **706** / 648×**821** / 出屏 594　‖ 原生横 **128** / 648×243 / 出屏 16 → **差 578**<br>机理：`level99.ts` 的 `fitPanesToStage(wrap, canvases, paneW, paneH)` 在 `orb-arena/index.ts:359` 与 `snake-royale/index.ts:426` 各调一次，按**竖屏**壳卡缺口把画布逻辑高补满；转横屏后画布显示宽 311→648（2.08×），等比锁死的高度跟着 419→873，缺口修正量被整个放大一遍。**A 第 2 轮那次修复把竖屏白底从 250px 收到 6px 是真的好，但也把旋转路径的账放大了约 3 倍** | 🔧 |
| **N-61** | **旋转后 find-diff 不复排**（`fitViewport` 复算高度，`panelsSideBySide` 不复算） | · **竖 → 横**：停在上下两图（面板 y=187 / y=419），文案还写「找出**下**图不一样的」，`.fdf-viewport` 自滚 **311**（比 r7 修之前的 203 还差），**下图 9 个格子全在折叠线下**（top 463/511）；同档原生直进则并排、自滚 0、线下 0<br>· **横 → 竖**：反过来停在并排，390 宽屏上**左图 x=−42（左边切掉 42px）、右图右缘 432（右边切掉 42px）**，两张要比对的图各缺一角<br>机理：`find-diff/index.ts:817` 有 `win?.addEventListener("resize", fitViewport)`，但 `fitViewport` 只钳 viewport 高；决定行/列的 `panelsSideBySide` 在建面板时算一次就定死 | 🔧 |
| **N-62** | **首页搜索框键盘焦点不可见**（全库唯一一处） | 915×412 首页 Tab×24 逐个量 `getComputedStyle().outline`：**只有搜索输入框 `outline: NONE`**，其余 23 个可聚焦件全有 3px 焦点环。病根：`ui/home.ts:103` `.home-search-input{...;outline:0;...}` 与全局 `styles.css:73` `:focus-visible{outline:3px solid var(--focus-ring)}` 同特异度，靠后者失效；包裹层 `.home-search` 也没有 `:focus-within` 兜底。<br>**全库扫过一遍，这是唯一没补偿的一处**：`.gate-input`（家长算术门）同样 `outline:none`，但配了 `:focus{border-color:var(--pink)}` 兜底；`.pz-piece` 那条是选中态不是焦点态 | 🔧 一行级 |

### 口径更新（不给新号，接在老账上）

- **C-6 alien-seek**（r4 老账，数字重量 + 覆盖面扩大）：915×412 关内 crop **598**、`＋ − ⤢ 🔭望远镜 ▲ ◀ ✓ ▶` 共 **10 个控件线下**，画布 186..621 出屏 209。**新事实：1024×768 平板也中**——crop **282**、▲◀✓▶▼⏸ 六个控件出视口，另有 ＋/−/⤢/🔭 四个「在视口里但被壳卡剪掉」。r4 只记了矮横屏。`bf4d84ac` 上一字未改。
- **配方 J 的关型矩阵可以剪枝**（省 r10 一大截时间）：alien-seek 推理关（第 122 关族，`isDeduceLevel`）实测 crop **598**，同款找物关（第 1 关）**608**——差 10px，即**关型本身没有独立的账，全是款级老账**。shape-kingdom 作图关同理（四档全 0）。**新判据：抽深关时先与同款第 1 关做差，差 <30px 就归款级老账、不单独立项**；只有像 pinyin-train 拼写/全选那样「第 1 关 0、深关 450」的才值一个新号。
- **N-25 在主干上只关了一半**：见第二节表。d909 组测试员 B 的 `13a4e38e` 已关净（6 / 0），主干 `bf4d84ac` 仍 371 / 4 线下。

## 四、系统性模式提炼（r4 A/B/C、r5 D/E/F、r6 G/H、r8 I/J 仍有效，本轮补三条）

### 模式 L · 「量一次定死」的修法都欠一笔旋转账（N-60 / N-61 机理）

- **机理**：本库钳高/换排的修法分两类。**一类是 CSS 媒体查询**（A 的 `quiz99` 矮屏紧凑档、B 的 fight-king / fruit-catch / pinyin-train 双栏），浏览器在旋转时自己重算，天然免疫；**另一类是 JS 进场量一次**（`fitPanesToStage`、`panelsSideBySide`、`fitIntoStage`），旋转后既不重量也不重排，**留在原地的那个值还会被新的宽高比放大**——orb-arena 就是被放大了 2.08 倍。
- **判据（一句话）**：凡是在「建完 DOM 之后读 `getBoundingClientRect` / `clientHeight` 再写回尺寸或改结构」的地方，都要问一句「转屏之后谁来再调一次」。
- **配方**：① 有 resize 监听的（find-diff）把**决定结构的那个判断**也搬进回调，别只搬钳高；② 没有监听的（`fitPanesToStage` 两款）挂一个 `ResizeObserver` 观察 `.game-stage`，或在 `window.resize` 上防抖 150ms 重跑一次同一个纯函数——**纯函数本身不用改，只补触发点**，测试也只需加「换个尺寸再调一次、结果跟着变」一条。
- **验收判据**：**旋后数 == 原生直进数**（本轮全部用这个判据出数，`差` 那一列就是它）。差 0 即结案。

### 模式 M · 「验收状态」要挑常态，不是挑干净态（N-59 机理）

- **机理**：S-1 的判据「首卡 top ≤ 视口高 − 100」本身没错，错在**量它的时候用的是全新档案**。而首页有一整块内容是随使用长出来的（最近玩过、收藏、进度徽标），孩子玩过一次之后它就永远在那儿。**用全新档案验收首页，等于只验收了孩子拥有这个 App 的第一分钟。**
- **推广**：这条对 r6 模式 H 的「状态清单」是补一维——H 说的是「模式/开关/权限/关型」这些**用户当场切换**的态，M 说的是**随时间长出来的态**：最近玩过（+103…134px）、收藏册有货、188 关走到深章、错题本攒了题、成绩单有记录。
- **配方**：验收脚本一律跑**两遍**——`全新档案` 与 `用过一阵`（脚本造：进一款 → 点 `.l99-continue` → 回首页），两遍都过才算过。造数据只写公开存档 key，**不改 key 名、不写星级**。
- **顺带一条工装铁律**：造「全新档案」必须**换一个 browser 实例**，同 browser 的多个 page 共享同源 localStorage。本轮先量出一批错数就是栽在这里。

### 模式 N · 多智能体共用一个 worktree 时，「我量的是哪个版本」必须先钉死

- **机理**：本仓同时有 4 组三人组在同一个 `/workspace` 上干活。本轮实测到的时间线：13:52 我建分支 → 14:22 别组测试员在**同一个 worktree、同一个分支**上 commit 了 `.dialog-buttons` sticky 并 `npm run build` 换掉 `dist/` → 14:35 我量到「N-33 已经好了」。**如果就这么写进笔记，就会得出「N-33 自己好了」这种鬼话。**
- **配方（本轮实操，建议写进 r10 纪律）**：
  1. `git worktree add --detach /tmp/wt-<tag> <commit>`，`ln -s /workspace/node_modules`，各自 `npm run build`，各自 `vite preview --port`；本轮同时挂 4181=入场 `6a9f42d0` / 4182 / 4183=在途 / 4184=交卷实况 `bf4d84ac`。
  2. 每个数字都标「在哪个 commit 上量的」。
  3. **别动共用 worktree 的 HEAD**——别人的未提交改动就在里面。本轮全程没碰 `/workspace` 的 HEAD 和索引。
- **同一条纪律的文档面**：交卷前 `git ls-tree origin/game-1.3 docs/qa` 看一眼文件名有没有被占、`rg -o "N-[0-9]+"` 扫一遍全部 qa 文档取最大号再续编。本轮两样都撞上了（文件名被占、N-39…N-58 被占）。

### 模式 H / J 各补一笔

- **H（状态清单）** 再加一维「**成长态**」，见模式 M。至此状态矩阵 = 游戏 × 模式 × 视口 × 开关态 × 权限态 × 关型 × **朝向路径** × **成长态**。后两维都是本轮加的，也都是本轮出数最多的两维。
- **J（深关关型矩阵）** 加剪枝判据：**深关先与同款第 1 关做差，差 <30px 归款级老账**。本轮据此把 alien-seek 推理关、shape-kingdom 作图关两个关型从「待立项」直接判成「老账/干净」，省下的是 r10 两条假清单。

## 五、skills 增量提炼（r4–r8 已写的不重复；只写能落到本库的）

| skill | 本轮新提炼 | 落点 |
| --- | --- | --- |
| `frontend-design` | 「**Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected**」——这三条本库前两条各破了一处：`visible keyboard focus` 破在搜索框（N-62，全库唯一），`responsive` 破在旋转路径（N-60/N-61）。**质量地板要按「路径」验收，不是按「终态」验收**：同一个 915×412 终态，直接进来是合格的，转过来就不是 | N-60/N-61/N-62 |
| `frontend-design` | 「**Treat failure and emptiness as moments for direction, not mood. An empty screen is an invitation to act**」——本库首页空态「🌱 端游里还没有双人玩法的游戏,换个筛选试试吧!」正是这条的正面样板：说清为什么空 + 下一步怎么办。**新写空态照抄这句的结构**（现状 + 出路），别写「暂无数据」 | 第三节干净名单 |
| `frontend-design` | 「**An action keeps the same name through the whole flow**」——find-diff 旋转后文案退回「找出**下**图不一样的」而布局仍是并排/或反之，**名字和画面对不上**。修 N-61 时文案跟着布局走是硬要求，不是顺手项 | N-61 |
| `canvas-design` | 「**nothing falls off the page … every element must be contained within the canvas boundaries with proper margins**」的**双向**版：本轮 find-diff 横→竖把左图推到 x=−42、右图推出右缘 42px，**两边同时越界**。画布类验收要同时量左右缘，本库现有脚本只量了下缘（`crop`）——建议 r10 的工装把 `x<0 || right>vw` 也纳入 | N-61 / 工装 |
| `canvas-design` | 「手势面必须整格可见」（r8 由 N-36 提炼）本轮得到反证与边界：shape-kingdom 作图板**故意**在钳位档把 `touch-action` 从 `none` 放宽到 `pan-y`，用「让出竖向」换来滚动逃生门，源码注释写明代价（竖着拖会变成滚动，点两个点是主路）。**结论修正为**：手势面没有逃生门时必须整格可见；有逃生门且主路不依赖被让出的那个方向时，可以接受滚动——**判据是「主路手势还在不在」，不是「格子全不全」** | 模式 J / N-36 收口 |
| `theme-factory` | 主张「一套主题 = 配色 + 字体配对，一次选定、全篇一致」。本库对应物是 `styles.css` 的 `:root` 变量 + `.dialog` / `.btn` / `.tab` 公共类。**本轮的 N-33 修法（`.dialog-buttons` 一处 sticky，76 款结算/暂停/家长面板全受益）就是这条的胜利**；反过来 N-62 是同一件事的失败面——`.home-search-input` 用 `outline:0` 从公共主题里**局部逃逸**，逃逸处没补偿就出洞。**落到本库的规矩：凡在组件里写 `outline:0` / `box-shadow:none` 覆盖公共焦点态的，同一块 CSS 里必须就近补一条 `:focus-visible` 或 `:focus-within`**，可以做成守门测试（照 `modebarHidden.guard.test.ts` 的写法） | N-62 / 守门测试建议 |
| `algorithmic-art` | 「**Same seed ALWAYS produces identical output**」的测试面推论：本库有一批 AI 对局测试（gomoku `tiers`、snake-royale `ai`、bomb-buddies `ai`）名义上是固定 seed，实际**吃 wall-clock 时间预算**，抢核时地狱档变弱、断言就红（本轮实测 `expected 7 to be >= 9`，单跑即绿）。**真·可复现要么按步数预算、要么按 seed 展开，不能按毫秒**。这是给 r10 的一条「测试稳定性」候选项，不属于 UI 账 | 第一节水位坑 |
| `character-sprite-maker` | 「**Deterministic validation is necessary but not sufficient — 还要看 contact-sheet / GIF 再收货**」。对应到本库：`crop=0` 是必要不充分条件——本轮 shape-kingdom 作图关四档 `crop=0`，截图一看最后一行点阵在容器外；alien-seek 1024×768 也是「出视口 6 个 + 容器内被剪 4 个」。**验收脚本出的数必须配一张 915×412 截图人眼过一遍**，本轮每条新伤都留了图（`/tmp/r9/*.png`） | 第一节口径 3 |

## 六、已收口账目汇总（下一轮不要重复做）

1. **暂停 → 再开 → hash 往返**（back/forward + 暂停中切路由）：`.game-stage` / backdrop / rAF / interval 四项探针全干净，无残留无泄漏。**结案**。
2. **关内键盘可达**（shape-kingdom 915×412）：焦点环 0 缺失、热区 0 个 <44px、Tab 序正确。**结案**（首页那一处例外 = N-62）。
3. **shape-kingdom 作图关（`isDrawLevel`，第 102 关族）** 四档：crop 0 / 线下 0 / dock 真钉底。点阵末行要滚属 W5R2 已记录的设计取舍，**不立项**。
4. **首页 7 种筛选组合 × 5 档视口**：零横向滚动，空组合的空态文案合格。**结案**（首屏那一条 = N-59，与筛选无关，各组合同样破）。
5. **配方 J 剪枝**：alien-seek 推理关、shape-kingdom 作图关与各自第 1 关差 <30px，归款级老账，**不再单独排关型**。
6. r8 的 N-33 / N-34 / N-35 / N-36 / N-37 / N-38 与 S-2 / S-3 / S-4（含 quiz99 扩容）/ C-1 / 收藏册两条热区：**全部结案**，修前修后数字见第二节，别重做。
7. N-1 fruit-catch **结案**（741 → 86）。
8. 壳层结算弹窗在 390×844 / 412×915 / 1024×768 / 360×640 四档 × 文案 1–3 行：末钮一律不出框，**r8 的算术推算已被实测替换，结案**。

## 七、下一轮（r10）A/B 最该先做的 10 条（与 `trio-r9-playbook-d909.md` 排序一致）

1. **N-59 首页首屏漏算「最近玩过」**——S-1 的后半本账，三档破线（915×412 差 95px / 360×640 差 63px / 1024×768 差 23px），且是孩子的常态；同批把验收脚本改成「全新档案 + 用过一阵」两遍跑（模式 M）。**A**
2. **N-25 在主干上收口**——d909 组 `13a4e38e` 已把格斗塔关净（crop 6 / 线下 0），主干 `bf4d84ac` 仍 371 / 四个必点钮线下。**先对账取先合版，别再写第三套修法**。**B**
3. **N-60 旋转不复算 `fitPanesToStage`**（orb-arena 757 vs 原生 127、snake-royale 706 vs 128）——挂 `ResizeObserver`/防抖 resize 重跑同一个纯函数，纯函数零改。**B**
4. **N-61 旋转不复排 find-diff**（竖→横 9 格线下 + 自滚 311；横→竖 左右各切 42px）——把 `panelsSideBySide` 搬进 `fitViewport`，文案跟着布局走。**A**
5. **N-62 首页搜索框焦点环**（一行级，`.home-search:focus-within` 或撤 `outline:0`）+ 顺手加一条「组件里覆盖公共焦点态必须就近补偿」的守门测试。**A**
6. **C-6 alien-seek**（915×412 crop 598 / 10 控件线下；**1024×768 也中**：282 / 6 控件 + 4 个被容器剪）——本轮实测最重的仍未动项，走配方 G。**B**
7. **L-1 余下的 color-fun / music-stars**——A 第 2 轮按内部目录划出了范围，但两款挂在「学习」页签下，按孩子看到的分类它们在 A 的盘子里。**A**
8. **L-2 clock-house 题面钟两代同堂** + **L-3 find-diff 贴纸补 4–10 章**——r4 起挂到现在的两条美术账，`clockSVG` / `boardArt.ts` 均零改动。**A**
9. **模式 L 全库自查**：把「进场量一次」的地方列出来（`fitPanesToStage` / `panelsSideBySide` / `fitIntoStage` 起步）逐个补旋转触发点，验收判据统一成「旋后数 == 原生直进数」。**A+B 分头**
10. **测试稳定性**（非 UI 账，但每轮都在浪费时间）：6 个吃 wall-clock 的 AI 对局测试在 4 核机上默认并发必假红，改成按步数/seed 展开，或标注 `--maxWorkers=1` 才跑。**B**
