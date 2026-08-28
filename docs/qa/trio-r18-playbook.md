# 三人组第 18 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r18-learn-notes.md`。主干 `c8a3d154`。
> 本轮主攻用户三连痛点：「**划不动、太小、关卡不好看**」。
> 新伤 **N-98…N-102**（A 面为主）；续办 **N-90/N-91/N-94…N-97** 与旧号余力。
> **禁止重做**：N-47/63/68/73/77/89、C-6、N-37、N-75…N-88、N-86、N-69…74、N-40 赛道 sticky、
> `OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、`balloon-pop` 的 `SKY_H=420`。
> A = 壳层 + 闯关学习（独占 `src/styles.css`、`src/ui/**`、`level99.ts`/quiz99 与学习款）；
> B = 休闲 / 对战 / 动手（各游戏目录）。

## 纪律（红线，违者打回）

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。测试只增不减；改守门**意图**须在交卷文档写明（先例：`casualFit.r10b`、r17 A 第 4 轮）。
- 验收一律 `getBoundingClientRect` 留数字。禁 force。撞车取先合进 `game-1.3` 的版本。
- 说明类文字最后生效块 font-size ≥16px、控件 ≥14px（`mobileText.test.ts` 量**最后一个声明块**；新增媒体块要么不写 font-size 要么达标；只写 `display:none` 不触红线）。
- 新增动效必须带 `prefers-reduced-motion` 降级。
- **禁用会波及祖先的 `scrollIntoView`**（N-63 教训）——滚页签/网格一律手动 `scrollLeft`/`scrollTop`。

## 测试步骤（先测什么，按此顺序）

1. `npm test` && `npm run build`（进场水位以主干最新为准，r17 A 报 1182 files / 19477 tests）。
2. `npx vite preview --port 4173` + puppeteer-core + Chrome；**触摸事件用 `page.touchscreen` 实测，不许只用鼠标滚轮代替**（本轮主题是「划不动」）。
3. 量前开管理员：密码 `kangkang`，默认 1 小时即可；root 开/关两档独立 context。
4. 视口顺序：**390×844 竖屏 →915×412 平板横屏**，抽验 1024×768 不回退。
5. 竖屏验收口径：从地图顶一路触摸滑到 `.l99-maphint` 底（bottom ≤ 视口高），中途不许卡死；横屏口径：关卡网格首屏可见 ≥2 整行、唯一 CTA「继续 ▶」在首屏。

---

## 壳层 + 闯关（A）

### N-98 章节页签堆高埋网格 🔧（P0；「太小/不好看」主因）

- **现状**：`src/games/level99.ts` L557 `.l99-tabs{flex-wrap:wrap}` + `styles.css` L1646 页签 min-height 44px。11–12 章的游戏（match-stars、gomoku、fight-king…）390px 宽下页签叠 4 行 ≈200px，网格要划 ~360px 才见到；915×412 首屏几乎无格子。
- **改法（方案甲，推荐）**：页签 DOM 拆两个 span：`<span class="l99-tab-emoji">🍬</span><span class="l99-tab-name">糖果草原</span>`（`showMap()` 里 L904–919 一处）。窄屏（`max-width:560px`）与矮横屏（`max-height:500px`）媒体里，非当前章节隐藏 `.l99-tab-name`，只留 emoji 徽章（min 44×44 不变，`aria-label` 永远带全名）；当前章节保持全名。预期页签区收到 ≤2 行（~100px）。
  - **必须联动**：`src/ui/rootUnlock.ts` L108 `tab.textContent = stripLockMark(...)` 会把 span 结构拍平——把 🔒 改成独立 `<span class="l99-tab-lockmark">`，解锁时移除该 span，不再重写 textContent；`rootUnlock.test.ts` 的假节点同步。
  - **守门**：`window6.r3.qa.test.ts` L132 只钉「不许 overflow-x:auto」，方案甲不触碰；`.l99-tab` 类名保留（rootUnlock 依赖）。
- **降级路径（方案乙，只在甲做不动时）**：窄屏非当前页签 CSS `max-width:64px + text-overflow:ellipsis`，零 DOM 改动；观感打折，交卷需写明。
- **禁止**：把页签改成隐藏滚条的横滚（会撞窗口6 守门意图）；除非同轮把守门意图升级为「横滚 + 渐隐边示能 + 半颗露出」，并在交卷文档说明。
- **验收**：390×844 页签区高 ≤110px、网格首行 top ≤ 视口一半；915×412 网格首屏 ≥2 整行；root 开着解锁后页签不回胀；锁定/跳过/三星/当前/管理员解锁五态截图各一。

### N-99 915×412 地图首屏密度 + `136px` 常数过时 🔧（P0；「太小」）

- **现状**：`level99.ts` L642 `.l99-wrap{max-height:calc(100dvh - 136px)}` 是 N-89 收壳**前**的壳高；`10022068` 已在 500px 档收顶栏 ~28px → 地图底部现在有 ~28px 死空间。head 两颗 chip、chapdesc、pagehint 在 500px 档均未收。
- **改法**：①先量 915×412 实际壳高（`.game-topbar` bottom → `.game-stage` top），把 136 调到实测值（或改用 `.l99-host` 链的 `height:100%` 吃满，二选一，别两套并存）；②`max-height:500px` 档把 `.l99-chapdesc` 与 `.l99-pagehint` 合并显示语义（隐藏 chapdesc 即可，desc 已由选中页签色 + `aria-label` 承担）；head 的两颗 chip 收成一颗「🚩 x/188 · ⭐ y」（`showMap()` L860–863 拼字符串处加媒体分支或直接合并文案）。
- **红线**：`mobileText.test.ts` 钉着 `.l99-chapdesc`/`.l99-pagehint` 的 16px（量最后声明块）——隐藏用 `display:none`，不许写小字号；不动 `OA_SHORT_PANE_H`。
- **验收**：915×412 `.l99-view` 可滚高度增加 ≥24px（前后对比留数字）；网格首屏 ≥2 整行；「继续 ▶」top ≤120；390×844 竖屏 chip/desc 原样不回退。

### N-100 「划不动」兜底与系统性排查 🔧（P0；A 管壳层/l99 部分）

- **改法**：`level99.ts` L540 `.l99-view` 补 `touch-action:pan-y;`（一行）。
- **实测**：390×844 触摸（`page.touchscreen.tap`/滑动）在 match-stars、gomoku、fight-king 三款地图：顶→底连续滑，`.l99-view.scrollTop` 单调递增到 `scrollHeight - clientHeight`；从关内「🗺️ 选关」返回后再滑一遍（验证关内 `touch-action:none` 无残留污染）。
- **排查（与 B 分工）**：全仓扫 N-95 同构族——「设置/选人/大厅屏 `overflow:hidden` 且无 `max-height` 媒体」：`rg -l "overflow:\s*hidden" src/games/*/index.ts` 交叉 `rg -L "max-height:5"`, 命中清单贴进交卷文档，l99/壳层的 A 修，游戏自定义屏的转 B。
- **验收**：三款地图触摸滑到底；排查清单落账（哪怕 0 新伤也要写「扫过、干净」）。

### N-97 math-farm root×深关选项 🔧（续办，r17 单）

- 末章末关选项 top 416。收农田行高；L1 勿动；题库零触碰。验收：915×412 选项整排 IN。

### N-101 选关地图视觉升级 🔧（P1；「不好看」；纯 CSS/内联 style 零逻辑）

- **改法**（都在 `level99.ts` 的 `L99_CSS` 与 `showMap()` 内联 style，`src/**` 其他不动）：
  1. `.l99-map` 背景渐变跟章节色走：`showMap()` L856 处 `map.style.background = linear-gradient(180deg, ${ch.color}33, #F0F4FF)`（章节色 20% 透明度打头，切章即换世界）；
  2. 已通关格子加两阶光影：`inset 0 2px 0 rgba(255,255,255,.6), 0 3px 8px` 现有投影保留（visual-bible 第四节「边缘厚度+高光」）；三星格加淡金内描边（新增类 `.l99-node-3s`，`starRowHTML` 调用处按 `stars[level]===3` 挂类）；
  3. 页签选中态与首页统一语言：复用 `.tab--active` 的「形状变化」思想——选中页签 `border-radius` 从 14px 变 18px 6px 18px 18px（花瓣角），加 2px 深色描边替代现在的白 outline（对比度 ≥3:1）；
  4. 全部新增动效/过渡进现有 `@media (prefers-reduced-motion:reduce)` 块。
- **禁止**：动格子尺寸/列数/DOM 顺序；给全部格子加动画（签名元素只留当前关的 pulse）。
- **验收**：五态（锁/跳过/普通/三星/当前）× 两视口截图对比；`npm test` 全绿（`window6.r3` 的 SVG/金币断言不受影响）；对比度抽验 `.l99-node-num` 仍 ≥4.5:1。

### N-102 `mapColumns` 按容器宽取列 🔧（P2，可书面降级）

- `level99.ts` L111 `mapColumns(width)` 现吃 `viewportWidth()`（L715），680px 容器 @915 视口取 8 列偏挤。改为传 `wrap.clientWidth`（L901、L723 两处调用），纯函数签名不变。有单测钉行为，改动要同步用例语义（阈值口径从视口变容器，用例数只增不减）。
- 验收：915×412 列数 7（680 容器命中 ≤760 档）、格宽 ≥80px；390 视口仍 5 列。收益小，若与 N-98/99 冲突则书面降级不做。

N-63 / N-89 / N-47 / N-16 / N-77 / N-68 / N-73 / C-6 / N-37：✅ 只许回归（N-89 用 `shellTitle.n89.test.ts` 守着，勿回退）。

---

## 休闲 / 对战 / 动手（B）

### N-95 xiangqi 自由对战设置屏 🔧（最重；「划不动」实锤）

- 「开始下棋」top 713、`overflow:hidden` 滚不到。收进 412 或给设置屏独立卷轴 + CTA sticky/fixed 钉底（N-75 配方）。**对局棋盘与规则零触碰**。
- 验收：915×412 「开始下棋」IN 且可点；390×844 不回退；触摸实测能滑到 CTA。

### N-94 duo-vs-star 双人选人「开打 ▶」🔧（≠ N-88）

- 开打 top 451。照 N-88 同构：选人壳 sticky 底；芯片抬到 44。验收：开打 IN、芯片 h≥44。

### N-96 bomb-buddies 双人棋盘 🔧

- 画布底 475 出屏 63px。钳显示高（可参考 `fitPanesToStage` 口径：只改显示/逻辑高补偿，不改棋盘格数）；三键已在屏勿动。

### N-90 tap-tiles 🔧 / N-91 fruit-catch 🔧（r17 单续办）

- N-90：补矮屏 `max-height` 媒体，关内操作/提示进 412，勿改连击判定。
- N-91：钳 `.frc-canvas` 显示高；底键已 sticky@520 勿第二套；`MIN_CANVAS_DISPLAY_PX` 勿降到篮口重叠。

### N-60/61/62 贴线 —— 本轮**先复测再动**

- N-89 已收壳 ~28px，很可能正好消化 orb/snake/merge-2048 的 394–398 贴线。**先量**：仍切才垫（canvas 再让 32px 一档），已消化就写回归数字结案。**禁止**改 `*_SHORT_PANE_H=200` 守门。

### 旧号余力（照 r17 口径，红线不变）

- N-12 pool-stars：补 `@media (max-height:500px)` 把 `.ps-bars`+击球钉进 412；勿改台面物理。
- N-10 weiqi-garden：sticky 被壳吃就改 fixed 底或收 `.wq-scroll`；勿放宽 700 断点。
- N-3 star-estate：只放大当前格预览，勿再收板。
- N-55 snow 对战十二键：915 复测 `data-duo` 并排；勿重写闯关垫。
- C-8 balloon-pop：只钳 `.blp-sky` 显示高；**禁改 `SKY_H`**。
- N-100 排查清单里转来的「自定义屏滚不到」新命中：按 N-95 同款配方修，编号由下轮学习员续（不要自行开号）。

N-87/88/86/75–85：✅ 只许回归。赛道 `.dr-btns` sticky 禁止回退。`casualFit.r10b` 已绿勿回退 N-87。

---

## 不要动什么（给两位测试修复员划重点）

1. 游戏玩法/数值/胜负/seed/题库/存档 key/`meta.id` —— 一个字都不动。
2. `SKY_H=420`、`OA_SHORT_PANE_H=200`、`SR_SHORT_PANE_H=200`、N-40 赛道 sticky、N-63 模式条配方、N-89 壳标题收高。
3. `.l99-tab`/`.l99-node-lock`/`.l99-jump-input` 等**类名**（`rootUnlock.ts` 靠它们工作）。
4. 说明文字 16px / 控件 14px / 热区 44px 三条红线（隐藏可以、缩小不行）。
5. r14–r18 已有笔记与 playbook 原文；工装（measure 脚本/截图）不进库。

## 完成定义

1. A：N-98、N-99、N-100（l99 部分）落地或书面降级；N-97 修复；N-101 至少完成章节色渐变 + 三星描边两项；N-102 做或降级说明。
2. B：N-95、N-94、N-96 落地；N-90/N-91 落地或书面降级；N-60/61/62 复测结论（数字）；旧号做或说明。
3. `npm test` / `npm run build` 只增不减（进场以主干最新水位为准）。
4. 每条留 390×844 与 915×412 两组 top/bottom 数字；「划不动」类必须附触摸实测（scrollTop 轨迹或录屏帧）。
5. 交卷写明与守门测试的意图变更（若有），并注明「撞车取先合版」。
