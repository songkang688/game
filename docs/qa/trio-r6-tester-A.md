# 三组 R5/R6 · 测试修复员 A 记录(第 2 轮)

基线:进场 `game-1.3 = 640b3242`,收尾 rebase 到 `77c89fc8`(r6/r7 学习笔记与 playbook 合入后,以 merge 方式同步,禁 force 纪律照守)。
分支:`cursor/tester-a-r5-fixes-139b`,目标合入 `game-1.3`。
执行依据:进场时最新 playbook 为 `trio-r5-playbook.md`(r6/r7 playbook 是本轮中途才合入的,收尾时已对账,见文末);另清 `trio-r4-tester-A.md` 遗留。
方法:真浏览器(Chrome + puppeteer-core 无头)自测,视口 360×640 / 390×844 / 915×412 / 1024×768,宽屏对照 1280×800;每条修复配套 Vitest 小测试。
水位:进场 `npm test` = **1090 文件 / 19248 用例全绿**;交卷 = **1095 文件 / 19288 用例全绿**(+5 文件 / +40 用例,只增不减)。`npm run build` 全绿。

## 修了什么(按 playbook 编号)

### S-1 首页首屏看不到游戏卡 ✅

- **修前实测**:360×640 首卡 top=722(0 卡)、390×844 top=717(只露半张)、915×412 top=557(0 卡)。
- **改法**(`src/styles.css` 两段新媒体查询):
  - `@media (max-width:480px)` 竖屏窄机:收紧 header(内边距/logo/图标钮)、隐藏 hero 装饰立绘、压缩 hero 气泡与页签行距;`.screen.home-screen` 提级压过 3226 行的 safe-area 旧规则,保留 `env(safe-area-inset-top)`。
  - `@media (max-height:500px)` 矮横屏:更激进——hero 立绘与副标题隐藏、模式片与平台片两排并成一排(`inline-flex`)、隐藏 `.home-count`。
- **修后实测**:360×640 首卡 top=493、390×844 top=496、915×412 top=304,三档全部满足「卡 top ≤ 视口高 − 100」;页签/搜索框/图标钮热区全 ≥44px;1024×768 与 1280×800 零回归。
- 测试:`src/ui/homeFirstScreen.test.ts`。

### S-2 l99 星级字符星 → 内联 SVG + S-4 跳关输入框热区 ✅

- `level99.ts` 的 `starRowHTML`:★ 字符改 12×12 viewBox 的内联 SVG(`currentColor` 双态,亮星 `#ffb937` + drop-shadow,灭星 `#e3ddef`),`aria-hidden` 保留;`.l99-node-stars` 12px 起步(撤掉 420px 档缩到 10px 的旧规则)、`.l99-beststars` 14px、`.l99-ov-stars` 34px 三处一次改净。
- `.l99-jump-input` min-height 38→44。
- 浏览器验证:poop-hero 地图节点星实际渲染 12×12、颜色正确。测试:`src/games/level99.stars.test.ts`。

### S-3 parentAuth 弹窗跨路由残留 ✅

- `src/ui/parentAuth.ts` 补 `hashchange` 监听:弹窗开着切路由视为放弃(`finish(false)`),`finish` 里同步摘监听不漏内存;密码不落存储的约定一字未动。
- 浏览器终验:poop-hero 关内点「跳过」弹家长门 → `location.hash = "#/"` → 残留遮罩 0、正常回到首页。测试:`src/ui/parentAuthRoute.test.ts`。

### L-1 学习款横屏答题控件折叠线下 ✅(shape-kingdom / find-diff;color-fun、music-stars 属动手款,范围外跳过)

- **quiz99.ts**(shape-kingdom 等共用):补 `@media (max-height:500px)` 紧凑档——题面/选项/朗读钮收内边距与字号,交互件 min-height 守住 ≥44px,题面 SVG/图片限高 64px。915×412 折叠线下控件 0。测试:`quiz99.test.ts` 追加断言。
- **find-diff**:915×412 从「上下两图 + 自滚 203px」改成**真横屏两图并排**——`runtime.ts` 新增 `panelsSideBySide` / `panelCellPxRow` / `panelCellForRoomRow` / `PANEL_CHROME_ROW_PX`,`index.ts` 行布局下把「上图/下图」显示成「左图/右图」(仅展示文案,判定零触碰)、工具行(提示钮/放大镜)挪进顶部徽章行省一排高。修后 915×412 格子全部进屏、自滚 0;390×844 与 1024×768 零回归;`regrowCellPx` 只放大不缩小的约定未破坏。测试:`viewportFit.test.ts` 追加 describe。
- 对账:r7 playbook L-1 的 find-diff 档口径更新(「双图并排或 viewport 钳高」)与本修法一致,应可销账。

### C-1 modebar `[hidden]` 残余 ✅(含 r6 扩容的第 4 款)

- **box-hamster `.bh-modebar` / prince-princess `.pcp-modebar` / sudoku-petal `.sp-modebar`**:三款都有 `bar.hidden = true` 但类上 `display:flex` 把 UA 的 `[hidden]{display:none}` 顶掉,各补一行 `[hidden]{display:none;}`。
- **adventure-king `.ak-bar`**(r6/r7 点名的 N-28 漏网,`-modebar` 后缀扫不到):同样补上。
- 浏览器验证(四款):进模式后 `getComputedStyle(bar).display === "none"`、高度 0;退出后恢复 `flex`(box-hamster/pcp/sp 三款实点退出钮验证还原,ak 与三款同走 closeMode 机制)。
- **全库守门测试** `src/games/modebarHidden.guard.test.ts`,按 r6 修正口径:
  1. 类名带 `-modebar` 后缀、且被 CSS 显式设过非 none 的 display → 必须有同文件 `[hidden]{display:none}`;
  2. 凡 `bar.hidden = true` 隐藏过的 bar 变量,其**就近一次**类赋值也纳管(同文件多个作用域的同名 `bar` —— HUD 条/皮肤架/汇总条 —— 只提名真被隐藏那个,`mn-bar`/`shr-topbar`/`sks-topbar`/`sr-skins`/`tt-sum-bar` 实测不误报)。
  未修前四款当场红,修后全库绿,正好当验收。

### r4 遗留 · orb-arena / snake-royale 关内卡底留白 ✅

- **修前实测**:390×844 壳卡(.game-stage)比内容高 **250/219px**(纯白一截);1024×768 高 76/63px;915×412 反向溢出 245/258px(卡内自滚)。
- **改法**(按 r4 定调「画布钳高」):`level99.ts` 新增纯函数 `fitPaneH`(缺口 ÷ 画布行数 × 逻辑宽/显示宽 等比换算,钳 [min(原高,240), 960])与 `fitPanesToStage`(进关时量一次 `.game-stage` 底部缺口,把成排画布逻辑高补足;行数按画布 top 去重,竖排分屏平分缺口、横排并排只算一行;拿不到壳卡的单测环境原样返回)。两款在**按钮/提示都建齐后**调用(早调会少算操作排高度,曾超调 40px,已修正)。
- **修后实测**:390×844 缺口 250/219 → **6px**;1024×768 76/63 → **6px**;915×412 溢出 245/258 → 123/124(画布贴下限收窄,内部滚动减半);游戏相机 zoom 只依赖画布宽,判定/地图尺寸零触碰,越界处本来就画条纹墙不穿帮。
- 测试:`src/games/level99.fitPane.test.ts`(7 条纯函数用例 + 两款调用点断言)。

### r4 遗留 · garden-guard 小章节点图留空 ✅

- **修前**:11 关的第 1 章按 22/23 关大章的 4 列排,3 行小节点缩在画布正中,390×844 上下各空 ~200px。
- **改法**:`mapFit.ts` 新增纯函数 `mapCols`(小章竖屏 3 列/横屏 6 列,大章原样)与 `nodeRadiusCap`(小章 28→36,点击区同步变大),`index.ts` drawMap 换用。
- **修后**:390×844 四行大节点(直径 ~72px)铺满;915×412 两行铺满;1024×768 两行居中节点放大;大章逻辑零改动。测试:`mapFit.test.ts` 追加 describe。

## 还剩什么(没动的原因)

- **r7 playbook 新伤 N-30(adventure-king 无尽古堡 13 控件线下)/ N-31(fight-king 训练场)/ N-32(brave-path 无尽战斗)**:r7 是本轮中途才合入的清单;N-30 属闯关(A 范围)但改动量大(古堡壳 D-pad 挪位 + 房间格钳制),留下一轮按配方 G 做;N-31/N-32 在 B 范围。本轮只顺手清了 C-1 扩容里的 `.ak-bar` 一行账(N-28)。
- **L-2 clock-house 题面钟 / L-3 find-diff 贴纸补章**:r5 playbook 里属美术升级类,非本轮「不好用立刻修」优先级,未动。
- **ocean-munch 节点图**:r4 遗留原文与 garden-guard 并列,但本轮任务单只点名 garden-guard;ocean-munch 是独立 canvas 布局,留下一轮同法处理。
- 休闲/对战/动手目录、存档 key(`yiduo-yixing.l99.<id>`)、题库/判定/关卡生成、`src/art/kit/`:一律没碰。

## 与并行批次对账

- 收尾 rebase 时 `game-1.3` 只进了 r6/r7 的 docs 提交,无代码撞车。
- r6/r7 playbook 里 S-1/S-2/S-3/S-4/L-1(shape-kingdom、find-diff 档)/C-1(含 .ak-bar)与 r4 遗留两条,应可由本分支销账;守门测试口径已按 r6 修正版落地。
