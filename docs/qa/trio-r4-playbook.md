# 三人组第 4 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r4-learn-notes.md`（同轮学习优化员抽验，基线 `game-1.3 = 1fd33b5e`，全部条目带实测数字）。
> **r5 对账（基线 22a5be93，PR48–50 合入后逐项核过源码+实测，全表见 `trio-r5-learn-notes.md` 第二节）**：C-1 主体已落地 ✅（残 3 款+测试欠账）；C-4/C-8 之 hue-hand、orb-arena 的「进关收模式条」已落地 🔶（钳高仍开）；其余 S/L/C 条目全部未动，原文继续有效。新发现与新配方见 `trio-r5-playbook.md`。
> 分工建议：**A = 壳层 + 闯关学习**（S 组 + L 组），**B = 休闲对战动手**（C 组）。C-1 覆盖 18 款但每款只有一行 CSS，B 先做它把大盘拉绿，再按重灾排序啃 C-2 起的钳高活。
> 修补配方（modebar 兜底 / 可视余量钳高 / touch-action 分层）与样板 commit 见 learn-notes 第六节，本清单不重抄，条目里只写「走配方 A/B/C」。

## 通用纪律（每条任务默认附带）

- **不改存档 key**：`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>` / 平台钱包 key、`meta.id` 一个字符不动。
- **不动题库/判定/关卡生成**：`levels.ts` 数据、seed 链路、win/lose 判定零触碰（多数有 SHA/逐字钉死用例，碰了必红）。
- **测试只增不减**：进场先 `npm test` 记水位；每条修复配 1 份小测试（有蓝本的照抄蓝本）；交卷水位 ≥ 进场。
- **kit 冻结**：`src/art/kit/` 已有文件只 import 不改（stickers.ts 扩容例外）。
- **宽屏零回归**：所有矮屏钳高改动都要在 412×915 与 1280×800 复测一遍「修前修后布局一致」。
- 收尾：fetch → rebase → `npm test` / `npm run build` 全绿 → 普通 push，禁 force。

## 测试步骤备忘（复现与验收都用得上）

- 本地起服：`npm run build && npx vite preview --port 4173`；无头验证用 puppeteer-core + `/usr/local/bin/google-chrome`。
- 四档视口：360×640 / 412×915 / **915×412（重灾档，每条都要跑）** / 1280×800。
- **管理员直达**（深关复现用）：首页家长面板 → 管理员权限 → 输入密码 `kangkang`（一小时有效）→ l99 选关地图与关内工具行出现「🎫 直达」输入框，输关号回车即达；直达不写星级存档，可放心用。
- 量裁切的口径：`.game-stage` 的 `scrollHeight − clientHeight`；「折叠线下」指控件 `rect.top ≥ 视口高`（不滚够不着）。注意 `.game-stage` 有 4px 边框，算裁切下沿用 `clientHeight`，别用 `rect.bottom`（1.2 窗口 5 在这里翻过车）。

---

## S 组 · 壳层（给 A）

### S-1 首页竖屏首屏看不到任何游戏卡 🔧

- **现象**：360×640 下 header(168px) + hero(212px) + 三排筛选条(172px) + 工具行(50px) 把首屏吃满，第一张游戏卡 top=722，孩子打开 App 第一眼一款游戏都看不到。
- **复现视口**：360×640（412×915 也只露出半行卡）。
- **建议改法**：只动 `src/styles.css`（必要时 `src/ui/home.ts` 的结构顺序）。首选纯 CSS：`@media (max-height:740px)` 里把 `.home-hero` 高度砍半（隐藏 hero 插图、只留一句欢迎语）+ 三排 `.tabs` 收紧 padding/gap；目标是首行卡 top ≤ 500。若压不进，再考虑把「最近玩过」/首行卡挪到 hero 之前（动 home.ts 结构，需过 `homeFilters.test.ts` 与 a11y 测试）。
- **验收标准**：360×640 首屏（不滚）至少完整露出第一行游戏卡的上半张（卡 top < 640 − 100）；三排筛选条仍全部可点（≥44px）；1280×800 首页布局无回归；`npm test` 首页相关用例全绿。

### S-2 l99 选关地图星级字符星 10–12px 🔧

- **现象**：`.l99-node-stars` 11px（420px 以下降 10px）、`.l99-beststars` 12px、★ 是文本字符——188 关框架全库共享件，窗口 1/2/3/5 四窗点名的最后一笔老账。
- **复现视口**：任意，360×640 最明显（星星糊成一团）。
- **建议改法**：`src/games/level99.ts`。走窗口 1 r1 learner P7 留档配方：`starRowHTML` 的 ★ 字符改 12×12 内联 SVG 五角星（最朴素几何形，不加徽章化元素），双态只换 fill `#ffb937`/`#e3ddef`；`.l99-node-stars`/`.l99-beststars`/`.l99-ov-stars` 三处同族一次改净。**存档、章节、判定逻辑零触碰**——这个文件里全是共享框架，改动只许落在 `starRowHTML` 与 L99_CSS 两处。
- **验收标准**：`level99.test.ts` 既有用例全绿 + 新增「starRowHTML 输出含 svg 且亮/灭 fill 正确」断言；360×640 地图格内星形肉眼清晰；全库任抽 3 款 l99 游戏（学习/休闲/对战各一）选关页无布局回归。

### S-3 parentAuth 弹窗跨路由残留 🔧

- **现象**：家长门弹窗开着时切路由（点浏览器返回/改 hash 回首页），遮罩与弹窗残留在新页面上。窗口 5 backlog BL-6，A 档当年附 5/5 复现。
- **复现视口**：任意。复现：l99 地图点「⏭️ 跳过」弹算术门 → 不作答，浏览器后退 → 首页上残留弹窗。
- **建议改法**：`src/ui/parentAuth.ts`（+ 必要时 `src/ui/dialogs.ts`）：监听 `hashchange`，路由变化即 `finish(false)` 并关闭 dialog；或在 dialogs 层给「路由切换关全部活跃弹窗」做统一钩子。**家长门安全语义敏感**：密码/答案不落任何存储的既有约定一个字不动；只处理「关闭」，不新增旁路。
- **验收标准**：复现步骤 5/5 无残留；`parentAuth.test.ts` 既有 553 行用例全绿 + 新增「hashchange 时弹窗关闭且返回 false」用例；正常授权流程（答对放行）无回归。

### S-4 `.l99-jump-input` 38px 💡（顺手项，不单独立项）

- **现象**：管理员直达输入框 `min-height:38px`，低于 44px 线；仅管理员可见，孩子看不到。
- **建议改法**：做 S-2 时顺手把 level99.ts:529 的 38 改 44。验收：开管理员后输入框实测 ≥44px。

---

## L 组 · 闯关学习（给 A）

### L-1 学习 4 款横屏答题控件掉在折叠线下 🔧

- **现象**：915×412 进第 1 关，shape-kingdom 3 个选项钮（五边形/方形/星形）、color-fun 7 个控件（撤销/重做/色盘）、music-stars 4 个控件（音量/星铃）、find-diff 9 个盘面格在折叠线下；竖屏两档全部 0 裁切（勿动竖屏布局）。
- **复现视口**：915×412。
- **建议改法**：逐款走配方 B（按可视余量钳玩法区显示高，学习类多为 DOM 布局，等价做法是给题面插图/画布设 `max-height` 让选项行进屏）。改各款 `index.ts`/`draw.ts`/`ui.ts` 的展示层；**题面数据、选项判定、MutationObserver 链路零触碰**。music-stars/color-fun/shape-kingdom 已有 `keyboardFit/boardPan/canvasPan` 类测试文件，新断言往同族文件里加。
- **验收标准**：915×412 进第 1 关折叠线下可点控件数 = 0（四款分别复测）；360×640 与 412×915 布局与修前一致；各款既有 fit/pan 测试全绿。

### L-2 clock-house 前 99 关题面钟两代同堂 🔧

- **现象**：前 99 关题面钟 `clockSVG`（levels.ts:78）还是 1.1 素钟面：细线针（#e8590c/#1971c2 line）+ 9px 刻度数字，与第 100 关起的新木牌钟面（胖橙时针/细青分针、hubSVG 轴心）同款游戏两代同堂。W8R1-07 → W8R2 修订清单第 4 条，「必须挂专项清单不许静默丢账」。
- **复现视口**：任意；进 clock-house 第 1 关 vs 用 `kangkang` 直达第 100 关对比。
- **建议改法**：只改 `clockSVG` 这个**渲染函数**：指针换 `house.ts` 的 `arrowHandD(HOUR/MINUTE_HAND_SHAPE)` 胖/细箭头（色用 `CLK_TOKENS.hourOrange/minuteTeal`），轴心换 `hubSVG()`，刻度 9→11px（viewBox 100 的 r=36 圈放得下）。`data-h`/`data-q` 属性与角度公式一个字不动。
- **验收标准**：`levels.test.ts` 拨针/读钟判定用例零改动全绿；`a11yLabels.test.ts` 标签零改动；第 1 关与第 100 关钟面工序肉眼一致（胖橙短针/细青长针/木轴心）；新增 1 例「clockSVG 输出含 arrowHandD 路径与 11px 刻度」断言。

### L-3 find-diff 盘面贴纸补齐第 4–10 章 🔧

- **现象**：`boardArt.ts` 的「整关配齐才换贴纸、差一张整关回退 emoji」门控已上线，第 1–3 章（水果/萌宠/海底）已亮，第 4–10 章还是 emoji 直出——玩家越玩到后面画风越旧。
- **复现视口**：任意；用 `kangkang` 直达第 60/100/150 关抽查。
- **建议改法**：净活只有两件：往 `src/art/kit/stickers.ts` 补第 4–10 章缺的贴纸（复用既有工序：双色分面 + 2px 深描边 + 左上高光；每张新造型先做去色剪影自查，商标红线见窗口 8 清单）+ `boardArt.ts` 映射表加行。**题库 levels.ts/scene12.ts 一个字节不动，SHA 快照用例原样**；boardArt 的门控逻辑不改。
- **验收标准**：188 关全量扫（照 `boardArt.test.ts` 既有口径）第 4–10 章逐章亮起、无「半贴纸半 emoji」混排；`visual25.test.ts` SHA 用例零改动全绿；26px 热区与 diffIdx 判定零触碰。

### L-4 find-diff 26px 盘面格触区 💡（交裁决，不动手）

- **现象**：W8R1-08 挂账。数学上 360px 盘面放不下 44px 格（同 bubble-pop BL-W6-03 的物理上限问题）。
- **建议**：按 BL-W6-03 的结案格式写一页裁决记录（现方案即最优/毋需再改），把编号核销，不要真去改格子——钉死用例在。

---

## C 组 · 休闲对战动手（给 B）

### C-1 modebar `[hidden]` 兜底 ×18 款 ✅ 主体已合入（r5 核对：残 box-hamster / prince-princess / sudoku-petal 三款 + 13 款测试欠账，转 r5 playbook C-1 收尾）

- **现象**：进「对战/无尽/双人」模式后，模式按钮排 `bar.hidden = true` 被自家 `.xx-modebar{display:flex}` 顶掉，残留条 37–154px 高仍在屏上，与模式内 UI 两代同堂（截图取证：merge-2048 进对战竞速后顶部仍挂着「对战竞速/马拉松/双人同屏」整排按钮）。17 款实测中招 + prince-princess 代码实锤。
- **复现视口**：任意；412×915 即可。每款进游戏 → 点 modebar 第一颗模式按钮 → 看按钮排还在不在。
- **名单与落点**（类名即 CSS 所在文件的检索词，均在各款 `index.ts`，gomoku/xiangqi 在 `view.ts`）：`bd-modebar` `bh-modebar` `cc-modebar` `fc-modebar` `frc-modebar` `gmk-modebar` `hc-modebar` `llk-modebar` `mj-modebar` `mg-modebar` `mn-modebar` `oa-modebar` `pcp-modebar` `sr-modebar` `se-modebar` `sp-modebar` `wq-modebar` `xq-modebar`。
- **建议改法**：走配方 A——每款 CSS 补一行 `.xx-modebar[hidden]{display:none;}`（照抄 `poop-hero/index.ts:204` 的写法与注释）；每款配一份 `modeBar.test.ts`（蓝本 `poop-hero/modeBar.test.ts`：钉「[hidden] 规则在场 = display:none」+「不许顺手改尺寸」两条）。18 款可以一个 commit 一款或按窗口分组提交，但**测试必须逐款有**。
- **验收标准**：18 款逐款进模式后 `getComputedStyle(bar).display === "none"`；退出模式按钮排原样回来；`npm test` 新增 ≥18 例全绿；modebar 本体样式与 openMode/closeMode 逻辑 0 diff。

### C-2 brick-break 横屏画布出屏 615px + 根容器锁死滚动 🔧（单款最重）

- **现象**：915×412 裁切 739px，canvas 出屏 615px，⬅️➡️ 按钮折叠线下；`.brk-wrap{touch-action:none}`（index.ts:119）把 `.game-stage` 的滚动兜底也废了——看不见且滚不到。360×640 也裁 160px、出屏 17px。
- **复现视口**：915×412（主）、360×640（次）。
- **建议改法**：配方 B + C 一起：① canvas 显示高按可视余量钳 `max-height`（照抄 dot-maze `a16caf46`：量 `.game-stage` clientHeight 口径的裁切下沿，减掉按钮排高度；resize 重量、destroy 摘监听）；② `.brk-wrap` 的 `touch-action:none` 改 `pan-y`（canvas 与按钮各自已有 none，保持）。物理分辨率与反弹判定坐标不动，只钳 display 尺寸。
- **验收标准**：915×412 进第 1 关 ⬅️➡️ 可见可点、canvas 出屏 0；360×640 同判；412×915 布局与修前一致；新增 `stageFit.test.ts`（纯函数钳制口径）；挡板拖动手感无回归（画布上划不触发页面滚动）。

### C-3 snake-snack 方向键两档被裁 🔧

- **现象**：360×640 裁 203px，⬆️⬅️⬇️➡️ 方向键折叠线下；915×412 裁 690px、canvas 出屏 498px。实时贪吃蛇不能边玩边滚。
- **复现视口**：360×640 / 915×412。
- **建议改法**：配方 B 之 1（canvas 钳 max-height，参照同为方向键布局的 dot-maze `a16caf46` 几乎可以照搬）。
- **验收标准**：两档视口方向键全部在屏、canvas 出屏 0；蛇的格子判定与速度零改动；新增 stageFit 测试。

### C-4 snake-royale 竖屏横屏双裁 🔧（r5 核对 🔶：进关收模式条+滚到战场已合入 `c0b9c62b`，915×412 裁切 474→262/出屏 150，钳高仍要做）

- **现象**：360×640 裁 375px、canvas 出屏 239px、「朵朵 💨 加速 / 🛑 急停」折叠线下；915×412 裁 474px、出屏 362px；412×915 也有 113px 残余。本轮抽样里唯一三档全中的实时对战款。
- **复现视口**：360×640 / 915×412 / 412×915。
- **建议改法**：配方 B 之 1；技能按钮排是画布下家当，量 below 时记得含它（dot-maze 的 `below` 变量同款处理）。
- **验收标准**：三档技能钮全在屏、出屏 0；对战判定与 AI 零改动；stageFit 测试。

### C-5 mole-pop 横屏地鼠洞不可达 🔧

- **现象**：915×412 裁 550px，**6 个地鼠洞在折叠线下**——打地鼠核心玩法直接不可达（限时打击类不能滚）。360×640 仅 19px 无伤。
- **复现视口**：915×412。
- **建议改法**：配方 B 之 3（格盘按「宽高两把尺取小」缩洞格，照抄 box-hamster `f7999944`）；洞的热区保 ≥44px，横屏放不下 3×3 满尺寸就整体缩格而不是砍行。
- **验收标准**：915×412 九洞全在屏、每洞 ≥44px、折叠线下 0；竖屏布局零回归；judge/计分零改动。

### C-6 alien-seek D-pad 两档被裁 🔧

- **现象**：360×640 裁 229px，▲◀✓▶ 折叠线下；915×412 裁 608px、canvas 出屏 209px，＋－⤢/望远镜也在折叠线下。
- **复现视口**：360×640 / 915×412。
- **建议改法**：配方 B 之 1（canvas 钳高）；工具排（＋－⤢）与 D-pad 是画布下家当一起量。
- **验收标准**：两档全部控件在屏；探索判定与关卡数据零改动；stageFit 测试。

### C-7 match-stars 棋盘完整可见破线 🔧

- **现象**：360×640 有 24 格、915×412 有 48 格在折叠线下（第 3/6 行起整行看不见）。三消盘面必须整盘可见才能规划消除。
- **复现视口**：360×640 / 915×412。
- **建议改法**：配方 B 之 3：格边长改「宽高两把尺一起量取小」（照抄 merge-2048 `0628fc33` 的竖向预算法）；格子热区尽量保 44px，横屏实在放不下按 bubble-pop BL-W6-03 口径缩格并书面登记。
- **验收标准**：两档整盘可见（折叠线下格子数 0）；消除判定/棋盘数据零改动；heightFit 测试。

### C-8 次级矮屏名单（横屏为主，同配方打包做）🔧（r5 核对：hue-hand / orb-arena 的「进关收模式条」已合入，新基数 915×412 裁 335 / 249，主钮仍折叠线下；其余名单原数未动）

| 款 | 现象（915×412 主档） | 附注 |
| --- | --- | --- |
| puzzle-tiles | 裁 628px，数字块折叠线下 6 个 | 拼图为回合制，可滚容忍度高，但目标图与盘面应同屏；走配方 B 之 3 |
| orb-arena | 裁 337px、canvas 出屏 226px、技能钮折叠线下（360 档也裁 71px） | 配方 B 之 1 |
| hue-hand | 360×640 裁 211px：🎴 抽牌 / ✅ 出牌 / ⏸ 暂停折叠线下；横屏 387px | 卡牌回合制可滚，但操作三钮必须常驻——建议按钮排改 sticky 或钳手牌区高 |
| balloon-pop | 360 档裁 153px 有 2 气球在折叠线下；横屏 306px | 限时点击类，走配方 B 之 3 缩格 |
| shoot-range | 横屏裁 336px、canvas 出屏 87px、▲🧺◀▼ 折叠线下 | 已接 stagePlayRoom 但横屏没钳够，复核 fit 参数 |
| snow-fight / ice-fire-forest / monster-crisis | 横屏裁 172 / 238 / 137px；iff 有 18 个控件折叠线下（360 档也有 6 个 pad 槽 + 66px） | iff 优先（控件最多），配方 B 之 1 |
| puff-bros | 横屏裁 91px，◀⬇▶ 折叠线下 | 1.2 已有钳制，横屏参数补量一次 |
| duo-rush / duo-arena / brave-path | 菜单层横屏裁 234 / 199 / 324px，duo-rush 360 档裁 547px（开跑钮要滚） | 菜单层可滚属可容忍，但「准备好，开跑 ▶」主按钮建议 sticky 置底；均为 DOM 布局，纯 CSS 可解 |

- **统一验收**：逐款在点名视口复测「折叠线下可点控件 = 0 或主操作钮常驻可见」；412×915 与宽屏零回归；实时类每款配 stageFit/heightFit 测试，菜单类补 CSS 断言即可。

### C-9 duo-vs-star 玩法态顶栏按钮 32px 🔧（一行 CSS，顺手清账）

- **现象**：`.dvs-back`（◀ 返回 / ⏸ 暂停）实测 32px 高，低于 40px 底线。窗口 4 backlog BL-W4-03，A 档当年终验「带条件放行」的唯一条件。
- **复现视口**：360×640。
- **建议改法**：`src/games/duo-vs-star/index.ts` `.dvs-back` 补 `min-height:40px`；把 `window4-visual-scan-r3.test.ts` 的登记断言取反为修复态。
- **验收标准**：360×640 / 320×568 实测 ≥40px、顶栏与七颗触控键不重叠不溢出；取反断言绿。

---

## 完成定义（两人共用）

1. 全部 🔧 条目关账或书面降级（降级要写数学/物理理由，照 BL-W6-03 格式）；💡 条目至少给出裁决记录。
2. `npm test` / `npm run build` 全绿，用例水位只增不减；每条修复有配套测试或取反断言。
3. 重灾八款（C-2…C-7 + shoot-range + ice-fire-forest）在 915×412 复测截图留档（放 `docs/qa/_evidence/` 或报告内嵌数字）。
4. 报告按既有命名续档（`trio-r4-report.md` 或 window 制式），逐条对账本 playbook 编号。
