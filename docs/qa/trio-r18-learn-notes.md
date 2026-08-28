# 三人组第 18 轮 · 学习优化员笔记（本轮只学习、只记录，零代码改动）

> 基线：`origin/game-1.3 = c8a3d154`（含 N-89 壳标题 `10022068`、云学习员改号 N-94…N-97、UX-99 监督派发表）。
> **编号**：grep 全部 trio 文档最大号 = **N-97**。本工位从 **N-98** 续编。
> **不覆盖** r14–r17 笔记原文。`src/**` 一行未动。
> 本轮主题：用户三连痛点「**划不动、太小、关卡不好看**」→ 定位到文件级成因，写进 `trio-r18-playbook.md` 供下轮 A/B 执行。
> 主档视口：手机竖屏 **390×844**（必须能划到底）、平板横屏 **915×412**（关卡地图/按钮不得裁切）。

## 一、本项目结构速览（进场强制检查的结论）

| 层 | 位置 | 要点 |
| --- | --- | --- |
| 平台 | Vite + TS 原生 DOM/Canvas，无框架；PWA / Electron / Capacitor 三端 | 运行时零外部依赖，禁 three.js |
| 首页 | `src/ui/home.ts` + `styles.css` | 分类页签 `.tabs` 是**横滚容器**（`overflow-x:auto`，L422）；搜索/芯片热区 ≥44 已达标 |
| 游戏壳 | `src/ui/gameShell.ts` + `styles.css` L840–897 | `.game-screen{height:100dvh}`；`.game-stage{overflow-y:auto}`；安全区 `env(safe-area-inset-*)` 全套在位 |
| 关卡系统 | `src/games/level99.ts`（188 关框架，**67 款** `index.ts` 走 `mountLevelGame`） | 地图 = `.l99-view`(滚动) > `.l99-map` > head/tools/**tabs**/desc/pagehint/**grid**；`.game-stage--l99{overflow-y:hidden}` 把滚条让给 `.l99-view`（N-63 配方） |
| 自定义选关 | `rainbow-run`（12 世界画布地图 + `mapFit.ts`）、`duo-rush`（菜单 CTA） | 不吃 l99 皮肤，单独验 |
| 文字/热区红线 | `src/ui/mobileText.ts`：正文 ≥16px、控件 ≥14px、行高 ≥1.4、安全区 ≥12px；`styles.css` L1641：`.l99-node`/`.l99-tab` 等 min 44px | 有 `mobileText.test.ts` 守门（**取最后一个声明块**的 font-size 来量） |

## 二、痛点假设（文件级成因，本轮源码对照得出）

### 「划不动」

1. **已实锤一例**：N-95 xiangqi 自由对战设置屏「开始下棋」top 713、`overflow:hidden` 滚不到（r17 云学习员 915 实测，已有号，勿重编）。同构风险：凡是「设置/选人/大厅」屏自己 `overflow:hidden` 又没有矮屏媒体的，都可能滚不到 → 需要一次**系统性排查**（见 playbook N-100）。
2. `.l99-view` 只写了 `overflow-y:auto`，**没有显式 `touch-action:pan-y`**（`level99.ts` L540–541）。游戏关内画布普遍 `touch-action:none` + 非被动 `touchmove preventDefault`（67 款里 40+ 处），从关内回地图后若有残留监听/样式污染，触摸滚动会被吃掉。显式声明是零风险兜底。
3. `.l99-wrap{max-height:calc(100dvh - 136px)}`（L642，仅 `max-height:500px` 档）：136px 是 N-89 收壳**之前**量的壳高。`10022068` 已把 500px 档顶栏收掉 ~28px，这个常数现在**偏大**，915×412 下地图底部凭空少 ~28px 可滚区。

### 「太小」

4. 真正的病不是格子小（`.l99-node` 有 44px 下限、格宽 ~60–74px），而是**网格被埋**：11–12 个章节页签 `.l99-tabs{flex-wrap:wrap}`（L557）+ 每颗 min-height 44px（styles.css L1646），390px 宽下叠 **4 行 ≈ 200px**；加上 head 两颗 chip + 继续钮（~50px）、tools 行（~50px）、chapdesc + pagehint（~60px），**关卡网格要划过 ~360px 才见到**。915×412 下地图总高只有 ~276px，首屏几乎见不到一个格子——孩子的直觉是「关卡好小、藏起来了」。
5. 星星 SVG 12px（S-2 已换 SVG，观感达标下限）；`.l99-node-num` 17px/15px@420 达标。不再动。

### 「关卡不好看」

6. 关卡格是「纯白/平涂章节色圆角块 + 数字 + 星」，无三阶光影，违背 `docs/plan-1.3-visual-bible.md` 第四节（收集物/元素要有边缘厚度、高光、投影）——76 款游戏都重画了，**唯独选关地图这层公共皮肤还是 1.1 的素颜**。
7. 章节色只用在格子底和页签选中底（`node.style.background = ch.color`），`.l99-map` 背景永远是同一条粉蓝渐变，切章节没有「换了个世界」的感觉；页签选中态只是 outline 白圈，而首页 `.tab--active` 有「花瓣落座」的形状变化，两套语言不统一。

## 三、对账（已合入 → ✅，勿再做）

| 批次 | SHA / 号 | 结论 |
| --- | --- | --- |
| N-89 壳标题 | `10022068` + `shellTitle.n89.test.ts` | ✅ 只许回归；500px 档顶栏已收 ~28px |
| N-94…N-97 | `c8a3d154` 改号收录 | 🔧 仍开（duo-vs-star 开打 / xiangqi 设置屏 / bomb-buddies 画布 / math-farm 深关），归属见 playbook |
| N-90 / N-91 | r17 playbook | 🔧 仍开（tap-tiles / fruit-catch），B 面 |
| N-60/61/62 贴线 | r16 复测 394–398 切 ~28px | 🔧 N-89 收壳后**必须先复测再动**——壳让出的 28px 很可能正好消化贴线，直接写回归数字即可结案 |
| N-12/N-10/N-3/N-55/C-8 | r17 playbook 余力 | 🔧 照 r17 条目执行，红线不变（禁改 `SKY_H`） |
| N-75…N-88、N-86、N-63、C-6、N-37、N-68/73/77/47 | 各批 | ✅ 只许回归 |

## 四、skills 学习（`.cursor/skills/1.3-visual/`，只取能落地的）

- **frontend-design**：①「唯一 CTA 必须在第一屏」——选关地图的唯一 CTA 是「继续 第N关 ▶」，任何视口都不许被页签挤出首屏；②「结构要编码信息」——章节页签 12 颗全量平铺没有编码「你在哪」，当前章节应当在视觉上放大、其余收敛（这正是方案甲的理论依据）；③「把大胆花在一个签名元素上」——地图的签名元素应是**当前关格子**（已有 pulse），别给全部格子加特效。
- **canvas-design**：空间即语言。竖向空间被非内容（页签堆）吃掉，等于把「主角」（网格）排到台下。裁显示不改世界常量的纪律继续有效（C-8 的 `SKY_H` 教训）。
- **theme-factory**：主题=「一组变量应用到既有骨架」。章节色渐变映射进 `.l99-map` 背景就是最便宜的 themed 手法，不需要第二套 DOM。
- **character-sprite-maker**（方法论）：逐帧质检清单思维 → 选关地图验收也要「逐视口逐状态」列 checklist（锁定/跳过/三星/当前/管理员解锁 五态 × 2 视口）。
- **`docs/plan-1.3-visual-bible.md` 第七节**：热区 ≥44、HUD 字 ≥14、正文 ≥16、`prefers-reduced-motion` 必须尊重——地图新增任何动效都要带 reduce 降级（现有 `@media (prefers-reduced-motion)` 块照抄进新增规则）。

## 五、从仓库内其他项目/窗口挖到的可迁移配方

| 配方 | 出处 | 可迁移到 |
| --- | --- | --- |
| 横滚页签容器：`overflow-x:auto` + `flex:0 0 auto` + 藏滚条 + `padding-inline:6px` 防焦点圈被裁 | 首页 `.tabs`（styles.css L422–433、L1622） | l99 章节页签（但见下行「守门冲突」） |
| **守门冲突**：`window6.r3.qa.test.ts` L132 钉死 `.l99-tabs` **不许** `overflow-x:auto`（意图：窄屏不靠「看不见的」横滚条） | 窗口6 r3 | 改横滚必须同步改守门意图并给可见示能（渐隐边 + 半颗露出）；或走方案甲绕开 |
| `scrollIntoView` 会连祖先一起卷走 → 手动 `scrollLeft`/`scrollTop` 只滚目标容器 | N-63 教训（level99.ts L999–1013 有完整注释） | 页签自动滚到当前章节，**禁用** `scrollIntoView({inline:…})` |
| sticky 底按钮列 + `overscroll-behavior:contain` | N-33 配方 I（`.dialog-buttons`）、N-75 fixed 钉底 | 任何「CTA 被挤出视口」类修复 |
| 画布行高按壳卡缺口等比补足 `fitPanesToStage` | level99.ts L126–157 | bomb-buddies N-96 钳画布可参考口径 |
| 行距夹上限防「漏气」：`mapRowYs(rows,my0,my1,maxGap)` | rainbow-run `mapFit.ts` | 网格/行式布局的密度控制思想 |
| textContent 重写会拍平子结构 | `rootUnlock.ts` L108 `tab.textContent = stripLockMark(...)` | 改 `.l99-tab` DOM 结构必须联动 rootUnlock（见 playbook N-98 红线） |
| 字号守门量的是**最后一个声明块** | `mobileText.test.ts` L160–172 | 新增媒体块要么不写 font-size，要么 ≥16/14px |

## 六、业界最佳实践对照（手机竖屏 / 平板横屏关卡 UI）

1. **滚动容器**：每屏只留一个主滚动轴；触摸区显式 `touch-action:pan-y`；容器 `overscroll-behavior:contain` 防连带滚 body（`.l99-view` 已有 contain、缺 pan-y）。
2. **最小触控**：44×44pt（iOS HIG）/ 48dp（Material），相邻热区间距 ≥8px——本项目已成文（visual-bible 第七节 + styles.css L1641），验收继续用 `getBoundingClientRect`。
3. **栅格与关卡预览密度**：竖屏 4–5 列、横屏 7–8 列是同类闯关游戏常态（本项目 `mapColumns` 一致）；**首屏必须露出当前关 + 至少一整行格子**，否则等于没有预览。密度不足时先砍「非格子」高度，不是缩格子。
4. **安全区**：`viewport-fit=cover` + `env(safe-area-inset-*)`（已全套在位，L3303–3317）。
5. **字体缩放**：说明文字钉 16px 下限而不是跟随 vw 无限缩（`mobileText.ts` 已成文；`clamp()` 首项才是窄屏真实值——守门测试已看穿这一点）。
6. **关卡地图观感**：同类儿童游戏通行做法是「章节即世界」——切章节换背景氛围色 + 当前关强调 + 已过关低饱和/星标——全部可用纯 CSS/内联 style 达成，零 DOM 重构（playbook N-101）。

## 七、新伤登记（N-98 起，改法细则与验收全在 `trio-r18-playbook.md`）

| # | 对象 | 依据 | 性质 |
| --- | --- | --- | --- |
| N-98 | **l99 章节页签堆高埋网格**（390 宽 4 行 ≈200px；915 矮屏更致命） | 源码 L557 wrap + styles L1646 min44；窗口6 守门钉着不许横滚 | 🔧 A（P0）：方案甲「非当前章节收成 emoji 徽章」优先；动 DOM 必须联动 `rootUnlock` |
| N-99 | **915×412 地图首屏密度 + `136px` 常数过时**（N-89 收壳后死空间 ~28px） | L642 `calc(100dvh - 136px)`；head/desc/pagehint 在 500px 档未收 | 🔧 A（P0）：网格首屏 ≥2 整行；数字验收见 playbook |
| N-100 | **触摸「划不动」系统性排查**：`.l99-view` 补 `touch-action:pan-y`；全仓扫「设置/选人屏 overflow:hidden 无矮屏媒体」（N-95 同构族） | 成因 2/3；r17 N-95 实锤 | 🔧 A 管 l99/壳层，B 管各游戏自定义屏（P0） |
| N-101 | **选关地图视觉升级**（章节色渐变入 `.l99-map`、三星格金描边+光影两阶、页签选中态与首页 `.tab--active` 语言统一） | 痛点 6/7；visual-bible 第四节 | 🔧 A（P1）：纯 CSS/内联 style，零逻辑 |
| N-102 | `mapColumns` 按**容器宽**（`wrap.clientWidth`）而非视口宽取列数（680px 容器 @915 视口取 8 列偏挤） | L111–118、L715–725 | 🔧 A（P2）：纯函数有单测，改签名要同步测试；收益小可书面降级 |

## 八、纪律（学习员自查）

- 本轮零改 `src/**`；只交 `trio-r18-learn-notes.md` + `trio-r18-playbook.md` 两个新文件。
- 未覆盖 r14–r17 任何原文；编号从 N-98 续，未与 `c8a3d154` 的 N-94…N-97 撞号。
- 「划不动」已有号的（N-95）只引用不重编；N-60/61/62 贴线不换号，等 N-89 复测结论。
- 下一轮 A/B 以 `trio-r18-playbook.md` 为任务单；撞车取先合进 `game-1.3` 的版本。
