# 三人组第 4 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`game-1.3 = 1fd33b5e`（8/28 矮屏审计已合入：仓鼠/方块/合成/跳台/格斗/迷宫/冲刺/连招 + 台球/保龄/碰碰车/坦克 pan-y 与钳高）。
> 衔接：trio r1（l99/dialogs 结算朗读、quiz99 悄悄提示）→ r2（动作 5 款 + 经典 3 款结算面板朗读与对比度）→ r3（弹弹小鸟竖屏画布）；1.3 窗口 1–8 三轮视觉验收全部合入。
> 本轮交付仅两份文档：本笔记 + `trio-r4-playbook.md`（给下一轮两位测试修复员的任务清单）。`src/**` 一行未动。

## 一、仓库 skills 通读结论（落到本项目怎么用）

| skill | 核心主张 | 对本项目的可用结论 |
| --- | --- | --- |
| `frontend-design` | 每个作品要有一个「签名元素」，其余克制；大胆只花在一处；避开模板化默认（奶油底+衬线+陶土色等三套 AI 惯用脸） | 本库的签名元素已定型 = 粉彩 Q 版 + 朵朵星星双吉祥物 + 章节主色地图。**下一轮修布局时只做减法与对齐，不新增装饰语言**；窗口 5 的 49 条风格基线（`1.3-window5-style-baseline.md`）就是本库的「token 系统」，改 CSS 时对表它，别再造新色 |
| `theme-factory` | 主题 = 色板 + 字体对 + 一致性应用流程；可按需生成新主题但要先展示再套用 | 对应本库「章节主色 `Chapter.color` + 粉彩 token」的既有机制。可借用其流程做**新章节配色评审**（先出主题卡再落码）；不适用于给单款游戏私开新色板——那会破坏 76 款一家人感 |
| `canvas-design` | 先立设计哲学再动手；工匠级克制；文字最少化、绝不溢出画布 | 适用面 = 封面 / App 图标 / 宣传图这类静态产物（1.3 已换新封面）。对游戏内 UI 的可迁移结论只有一条：**「nothing falls off the page」**——这正是本轮抽验抓到的最大伤（矮屏裁切），playbook 以此为第一优先级 |
| `algorithmic-art` | 种子随机（同 seed 必同输出）+ 参数化探索 + 模板复用 | 与本库 `mulberry32` 确定性关卡生成同理。给下一轮的红线提醒：**修布局绝不许动 seed 链路与关卡生成参数**（同一关每次布局必须一致，`levels.test.ts` 大多钉了这一点）；其「参数滑杆 + 种子导航」思路可借鉴做 QA 工装，不进产品 |
| `character-sprite-maker` | imagegen 位图 spritesheet 管线（基准图 grounding + 色键抠底 + 图集校验） | **明确不适用**：本库全部角色/贴纸走矢量 SVG 库内工序（2px 描边 + 左上 45° 受光 + 粉彩双色分面），且有商标剪影自查红线。下一轮不要引入位图 spritesheet 资产；该 skill 里唯一可搬的纪律是「每张新造型先做去色剪影自查」——与窗口 8 商标清单口径一致 |

## 二、外部儿童/休闲小游戏 UX 实践对照（公开资料结论 × 本库现状）

结合本项目定位（粉彩 Q 版、76 款、188 关、无广告、面向识字量 300–800 字的孩子）逐条对表：

| 实践 | 头部作品通行做法 | 本库现状（本轮实测） | 判定 |
| --- | --- | --- | --- |
| 大热区 | 儿童向 ≥44–48px，成人向 ≥40px | 壳层 `.btn/.icon-btn/.chip/.tab` 全 `min-height:44px`（styles.css:1562）；l99 地图工具行/页签/继续钮实测 44px（styles.css:1632 补丁层）；游戏内经三轮验收基本达标，残余点名在 playbook（`.dvs-back` 32px、`.l99-jump-input` 38px） | ✅ 大盘达标 |
| 竖屏首屏 | 打开 App 第一屏必须见到「能玩的东西」（游戏卡/继续入口） | **360×640 首屏 0 张游戏卡**：header 168px + hero 212px + 三排筛选条 172px + 工具行 50px，首张卡 top=722 > 640。孩子要先划一屏才见到游戏 | 🔧 下一轮必做 |
| 安全区 | `viewport-fit=cover` + `env(safe-area-inset-*)` 兜底 | `index.html` viewport-fit=cover；`.game-screen` padding-bottom `max(14px, env(...))`，矮屏档降 8px 仍带 env | ✅ 不动 |
| 棋盘完整可见 | 盘面类玩法整盘不滚动可见，装不下就缩格 | 学习类竖屏全达标；**match-stars 360×640 有 24 格在折叠线下、915×412 有 48 格**；find-diff 915×412 有 9 格在折叠线下 | 🔧 下一轮必做 |
| 选关地图节奏 | 章节分页 + 「继续」大按钮 + 当前关高亮脉动 | l99 地图三者齐备（`.l99-continue`、`.l99-node-cur` 脉动、章节页签），`focusCurrent` 还会滚到当前关。星级字 10–11px 是唯一污点（跨窗老账） | ✅ 结构不动，🔧 星级字号 |
| 触控与滚动冲突 | 玩法面 `touch-action:none`，外层留 pan-y 滚动兜底 | 8/28 审计已把台球/合成/碰碰车改 pan-y；**brick-break 根容器仍 `touch-action:none`**——叠加横屏裁切后按钮既看不见也滚不到 | 🔧 下一轮必做 |
| 可读字号与对比度 | 小学生正文 ≥16px、辅助 ≥14px、对比 ≥4.5:1 | l99 说明文字 16px 已达标（r1–r3 + 窗口轮已修）；残账 = `.l99-node-stars` 10–11px / `.l99-beststars` 12px（装饰星字符，窗口 1/2/3/5 四窗同点名待统筹）、窗口 7 backlog #4 的九款 <14px 小字约 86 处 | 🔧 星级字号；💡 86 处小字专项 |

## 三、抽验方式（可复现）

- `npm ci && npm run build && npx vite preview --port 4173`，headless Chrome（`/usr/local/bin/google-chrome` + `puppeteer-core`）。
- 视口四档：**360×640**（窄矮竖屏）/ **412×915**（主流竖屏）/ **915×412**（横屏矮屏）/ **1280×800**（宽屏对照）。
- 每款进 `#/game/<id>`，l99 类点 `.l99-continue` 进第 1 关，然后量四个数：
  1. `.game-stage` 的 `scrollHeight − clientHeight`（裁切量，>0 表示要滚才看得全）；
  2. 折叠线以下的可点控件数（`rect.top ≥ 视口高`，即不滚够不着）；
  3. canvas `rect.bottom − 视口高`（画布出屏量）；
  4. modebar 类元素点击模式按钮后的 `computedStyle.display` 与可见高度。
- 管理员密码 `kangkang`（家长面板 → 管理员权限 → 输入密码，一小时有效；开着时 l99 地图与关内工具行出现「🎫 直达」输入框），深关抽验用它直达，不写任何存档星级。

## 四、抽验结论表

| # | 对象 | 实测现象 | 判定 |
| --- | --- | --- | --- |
| 1 | 壳层 `.game-stage` overflow | 已从 1.2 的 `hidden` 改为 `overflow-y:auto`（styles.css:892），滚动兜底在位 | ✅ 不动 |
| 2 | 壳层 l99 地图触区 | `.l99-tool/.l99-tab/.l99-continue/.l99-back/.l99-node` 实测全 44px（styles.css:1632–1647 补丁层）——**窗口 6 backlog BL-W6-02 实际已收口，下一轮不要重复立项** | ✅ 不动（销账） |
| 3 | 壳层顶栏 | 返回 44px、暂停 46px；🎵 ≤420px 收进暂停面板是有意设计（styles.css:1586） | ✅ 不动 |
| 4 | 宽屏 1280×800 | 抽 8 款根节点全部居中、无 max-width 失效（历史「共享舞台 flex 吃掉 max-width」病灶未再现；机理见第六节模式 C 备注） | ✅ 不动 |
| 5 | 首页 360×640 | 首屏 0 张游戏卡（首卡 top=722）；无横向溢出 | 🔧 必做（S-1） |
| 6 | modebar 家族 | **17 款实测中招 + prince-princess 代码实锤 = 18 款**：进「对战/无尽/双人」模式后 `bar.hidden=true` 写了也白写，`.xx-modebar{display:flex}` 盖掉 UA 的 `[hidden]{display:none}`，残留条 37–154px 高仍在屏上（截图取证 merge-2048 102px）。poop-hero/puff-bros/sky-squad/shoot-range/fishing-star/find-diff/tap-tiles/tank-battle 已各自补过兜底，可当样板 | 🔧 必做（C-1） |
| 7 | 横屏矮屏 915×412 | 重灾：brick-break 裁 739（画布出屏 615）、snake-snack 690（出屏 498、方向键折叠线下）、puzzle-tiles 628、alien-seek 608（出屏 209）、match-stars 577（48 格）、mole-pop 550（6 个地鼠洞折叠线下）、snake-royale 474（出屏 362）、hue-hand 387、shoot-range 336（出屏 87）、orb-arena 337（出屏 226）、balloon-pop 306、ice-fire-forest 238（18 控件）、snow-fight 172、monster-crisis 137、duo-rush/duo-arena 菜单 234/199、brave-path 324 | 🔧 必做（C-2…C-8 按重灾排序） |
| 8 | 窄矮竖屏 360×640 | snake-royale 375（加速/急停折叠线下）、alien-seek 229、snake-snack 203（方向键）、hue-hand 211（抽牌/出牌/暂停）、brick-break 160（⬅️➡️）、balloon-pop 153（2 气球）、match-stars 152（24 格）、ice-fire-forest 66（pad 槽）、duo-rush 菜单 547、brave-path 菜单 505 | 🔧 与第 7 行同批修 |
| 9 | 主流竖屏 412×915 | 基本干净：仅 snake-royale 113、brave-path 菜单 184、duo-rush 47，其余抽样 0 裁切 | ✅ 大盘不动 |
| 10 | 学习 8 款（math-farm/word-garden/pinyin-train/clock-house/shape-kingdom/find-diff/music-stars/color-fun） | 竖屏两档全部 0 裁切（窗口 8 成果保持）；**915×412 横屏**：shape-kingdom 3 个选项钮、color-fun 7 控件（撤销/重做/色盘）、music-stars 4 控件、find-diff 9 格落在折叠线下 | 🔧 必做（L-1） |
| 11 | brick-break 触控滚动 | `.brk-wrap{touch-action:none}`（index.ts:119）盖住整个舞台，`.game-stage` 的滚动兜底被废——横屏裁 739px 时按钮既看不见也滚不到 | 🔧 必做（并入 C-2） |
| 12 | l99 星级字号 | `.l99-node-stars` 11px / @420 档 10px / `.l99-beststars` 12px / `.l99-star` ★ 字符（level99.ts:515/542/565/472）——窗口 1/2/3/5 四窗都点过名的跨窗账，仍开 | 🔧 必做（S-2） |
| 13 | clock-house 题面钟 | 前 99 关 `clockSVG`（levels.ts:78）仍是 1.1 素钟面（细线针 + 9px 刻度），与 100 关起的新木牌钟面两代同堂；W8R1-07 规格（arrowHandD 胖细箭头 + CLK_TOKENS + hubSVG + 刻度 9→11px）仍有效 | 🔧 必做（L-2） |
| 14 | find-diff 盘面贴纸 | `boardArt.ts` 已按「整关配齐才换、差一张回退 emoji」落地第 1–3 章；第 4–10 章贴纸挂账（文件头注自证「配齐一章亮一章，本文件不用再改」），净活 = 往 `stickers.ts` 补图 + 映射表加行 | 🔧 必做（L-3） |
| 15 | parentAuth 跨路由弹窗 | `parentAuth.ts` 无 hashchange 处理，窗口 5 backlog BL-6（弹窗开着切路由残留遮罩）仍开 | 🔧 必做（S-3） |
| 16 | duo-vs-star 顶栏 | `.dvs-back{padding:7px 13px;font-size:13.5px}` 无 min-height，实测 32px；窗口 4 backlog BL-W4-03 仍开 | 🔧 必做（C-9，一行 CSS） |
| 17 | 安全区 / Esc 暂停 / 结算冷静期 / 语音降级 | viewport-fit=cover + env() 兜底、Esc 推迟宏任务判 defaultPrevented、`isGuardedClick` 防误触、speech 无语音包静默 | ✅ 不动 |
| 18 | find-diff 26px 盘面格触区（W8R1-08）、窗口 7 的 86 处 <14px 小字、`.l99-jump-input` 38px | 前者物理上放不下 44px 且有钉死用例（同 bubble-pop BL-W6-03 口径，大概率判「现方案即最优」）；后两者收益低 / 管理员专用 | 💡 建议（裁决/专项，不占 A/B 主预算） |

## 五、已收口账目（下一轮**不要**重复做）

1. **BL-W6-02（l99 共享壳触区/字号）**：styles.css 1632–1647 的 `.l99-wrap` 补丁层已把 node/tab/tool/back/continue 全抬到 44px+，360×640 实测过。窗口 6 backlog 该条可销。
2. **`.game-stage{overflow:hidden}` 老病**（1.2 窗口 5 反复点名）：已改 `overflow-y:auto + overscroll-behavior:contain`，且 8/28 审计给 12 款补了钳高。
3. **学习 8 款竖屏矮屏**：360×640 全 0 裁切，窗口 8 成果无回退。
4. **宽屏居中**：抽 8 款（含 modebar 家族与 canvas 款）根节点全部居中，无 max-width 失效实伤。
5. **首页横向溢出**：360px 实测 `scrollWidth == clientWidth`。

## 六、三个系统性模式与修补配方（给 playbook 引用的技术底）

### 模式 A · `[hidden]` 被作者样式 `display:flex` 顶掉

- **机理**：UA 样式表的 `[hidden]{display:none}` 是浏览器默认样式，**任何**作者规则（哪怕 0,1,0 特异性的 `.xx-modebar{display:flex}`）都压过它。于是 `bar.hidden = true` 写了也白写。
- **实锤名单（18 款）**：block-drop `.bd-modebar` / box-hamster `.bh-modebar` / combo-clash `.cc-modebar` / flight-chess `.fc-modebar` / fruit-catch `.frc-modebar` / gomoku `.gmk-modebar`（CSS 在 view.ts）/ hero-cards `.hc-modebar` / lianliankan `.llk-modebar` / mahjong-bloom `.mj-modebar` / merge-2048 `.mg-modebar` / mine-garden `.mn-modebar` / orb-arena `.oa-modebar` / prince-princess `.pcp-modebar` / snake-royale `.sr-modebar` / star-estate `.se-modebar` / sudoku-petal `.sp-modebar` / weiqi-garden `.wq-modebar` / xiangqi `.xq-modebar`（view.ts）。
- **配方**：每款在同文件 CSS 里补一行 `.xx-modebar[hidden]{display:none;}`（照抄 `find-diff/index.ts:167`、`poop-hero/index.ts:204` 的写法与注释）；测试照 `poop-hero/modeBar.test.ts` 蓝本（两条断言：`[hidden]` 规则在场且是 `display:none`；不许顺手改尺寸）。**只加不改**——modebar 的 display:flex 本体、按钮、`openMode/closeMode` 逻辑零触碰。
- **修好判据**：进任意模式后 `getComputedStyle(bar).display === "none"`、`getBoundingClientRect().height === 0`；退出模式（回选关）后按钮排原样回来。

### 模式 B · 画布/盘面不按可视余量钳高，矮屏被 `.game-stage` 裁掉

- **机理**：游戏按「宽度定画布高」（如 `width:100%` + 固定宽高比）或固定格边长排盘，横屏矮屏（915×412 下舞台可视高仅约 300px）时内容远高于舞台；`.game-stage` 虽能滚，但实时操作类游戏（方向键/摇杆/打地鼠）**不能边玩边滚**。
- **配方（三选一，按游戏结构）**：
  1. **画布类**：照抄 `dot-maze a16caf46`——量 `.game-stage` 的裁切下沿（clientHeight 口径，别用 border-box 的 rect.bottom，差 4px 边框），减掉画布下方家当高度，给 canvas 设 `style.maxHeight`（display 尺寸，物理分辨率与世界坐标不动）；resize 时重量；destroy 摘监听。等比收窄参照 `combo-clash 62d90a4b`。
  2. **共享工具**：`src/engine/stageRoom.ts` 的 `stagePlayRoom(host)` 已经封装了「stage 高 − stagebar 高 − 16px chrome」，bowling/bumper/fruit-stack/pool-stars 都在用，能用就别自己再量。
  3. **格盘类**（match-stars/puzzle-tiles/balloon-pop/mole-pop）：格边长改成「宽高两把尺一起量取小」——照抄 `box-hamster f7999944` 与 `merge-2048 0628fc33`。
- **配套测试**：每款加 `stageFit.test.ts`/`heightFit.test.ts`（纯函数：给定舞台宽高算出的显示尺寸不超过可视余量；量不到尺寸回退原值），样板已有 8 份。
- **修好判据**：915×412 与 360×640 进第 1 关，折叠线以下可点控件数 = 0、canvas 出屏量 = 0；412×915 布局与修前一致（宽屏零回归）。

### 模式 C · `touch-action:none` 挂在根容器，把滚动兜底也废了

- **机理**：玩法需要 pointermove 的游戏把 `touch-action:none` 写在整个 wrap 上，`.game-stage` 的 overflow-y:auto 兜底就划不动了。与模式 B 叠加时按钮「看不见也滚不到」。
- **配方**：根容器改 `touch-action:pan-y`、只在真正吃拖动手势的元素（canvas / 摇杆 / 滑杆）上保留 `none`——照抄 8/28 审计 `4f8feca4`（台球/合成/碰碰车）。本轮实测唯一还中招的是 **brick-break**（`.brk-wrap` index.ts:119；canvas/按钮各自已有 none，wrap 那条直接改 pan-y 即可）。
- **修好判据**：横屏进关，在画布外的空白处上下划能滚动舞台；在画布上划挡板不触发页面滚动。
- **附注（历史病灶备查）**：任务书点名的「共享舞台 flex 导致 max-width 不生效」在当前基线未再现（第四节第 4 行实测）。机理留档：`.game-stage` 是 flex column，子项默认 stretch，**max-width 本身生效**，真正会踩的是「有 max-width 没 `margin:0 auto`」时子项贴左不居中——新游戏根容器写 max-width 时记得配对 margin auto（现库 5 处带 max-width 的根容器全部配了）。

### 全组通用红线（写给 A/B，playbook 逐条重申）

- **不改存档 key**：`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>` / 平台钱包 key 一个字符不动；也不动 `meta.id`。
- **不动题库/判定/关卡生成**：修布局是 display 层的事，`levels.ts` 数据、seed 链路、win/lose 判定零触碰（很多有 SHA/逐字钉死用例）。
- **测试只增不减**：进场先记 `npm test` 水位，交卷水位 ≥ 进场。
- **kit 冻结**：`src/art/kit/` 已有文件只 import 不改（stickers.ts 属 C 档独占可扩容的例外，见窗口 8 口径）。

## 七、跨窗遗留对账（仍开的账，本轮已核实现状）

| 账目 | 出处 | 本轮核实 | 去向 |
| --- | --- | --- | --- |
| l99 星级 10–12px | 窗口 1 R3-1 / 窗口 2 #3 / 窗口 3 B-01 / 窗口 5 BL-2 | level99.ts:515/542/565 原样在 | playbook S-2（配方 = 窗口 1 r1 learner P7：★ 字符改 12×12 内联 SVG，双态 fill） |
| clock-house 前 99 关题面钟 | W8R1-07 → W8R2 修订清单第 4 条 | `clockSVG` 仍细线针 + 9px 刻度 | playbook L-2 |
| find-diff 盘面贴纸 4–10 章 | W8R1-04 专项 → boardArt.ts 第一步已落地 | 头注自证挂账 | playbook L-3 |
| parentAuth 跨路由弹窗 | 窗口 5 BL-6 | 无 hashchange 处理 | playbook S-3 |
| duo-vs-star `.dvs-back` 32px | 窗口 4 BL-W4-03 | index.ts:196 原样在 | playbook C-9 |
| find-diff 26px 盘面格 | W8R1-08 | 钉死用例在，物理放不下 | 💡 交裁决（预判维持现状，参照 BL-W6-03 结案格式） |
| 九款 <14px 小字 86 处 | 窗口 7 backlog #4 | 未复测（非本轮抽验面） | 💡 360px 阅读性专项，别拆散逐款做 |

## 八、下一轮 A/B 最该先做的 10 条（与 playbook 排序一致）

1. C-1 modebar `[hidden]` 兜底 ×18 款（每款一行 CSS + 一份蓝本测试，收益/成本比全场最高）
2. C-2 brick-break：横屏画布出屏 615px + `touch-action:none` 滚不动（模式 B+C 叠加，全库最重单款）
3. C-3 snake-snack：方向键 360 竖屏 / 横屏双双被裁（裁 203/690，出屏 498）
4. C-4 snake-royale：360 竖屏裁 375、加速/急停折叠线下；横屏出屏 362
5. C-5 mole-pop：915×412 六个地鼠洞在折叠线下（打地鼠玩法核心不可达）
6. C-6 alien-seek：D-pad 两档被裁（360 裁 229 / 横屏 608、画布出屏 209）
7. C-7 match-stars：棋盘完整可见破线（360 有 24 格、横屏有 48 格在折叠线下）→ 格边长按可视余量取小
8. L-1 学习 4 款横屏答题控件折叠线下（shape-kingdom 3 钮 / color-fun 7 控 / music-stars 4 控 / find-diff 9 格）
9. S-1 首页 360×640 首屏 0 张游戏卡（矮屏压缩 hero + 筛选条，让第一行卡进首屏）
10. S-2 l99 星级字符星 10–12px → 12×12 内联 SVG 星（188 关全库共享件，四窗点名的最后一笔老账）
