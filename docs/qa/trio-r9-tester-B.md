# 三人组 R9 · 测试修复员 B 记录（休闲 / 对战 / 动手）

基线：进场 `origin/game-1.3 = 6a9f42d0`（r8 学习笔记合入后那一版）。
分支：`cursor/trio-r9-tester-b-d909`，目标合入 `game-1.3`。禁 force，未动 main，未改 learn-notes / playbook / tester-A。
执行依据：`trio-r8-playbook.md`（休闲对战节）+ `trio-r7/r6/r5 playbook` 原文 + r4 learn-notes 第六节配方 A/B/C、r5 配方 D/E/F、r6 配方 G。
方法：`npm run build` → `npx vite preview --port 4173` → puppeteer-core + `/usr/local/bin/google-chrome` 无头实测。
视口五档：360×640 / 390×844 / 412×915 / **915×412（主档）** / 1024×768，宽屏对照 1280×800。
模式菜单款按「模式 × 视口」矩阵走：fight-king 5 / duo-vs-star 6 / dot-maze 4 / brave-path（闯关战斗 + 无尽战斗 + 对战）。
裁切口径同 r4：`crop = .game-stage.scrollHeight − clientHeight`；「线下」= 控件 top ≥ 可视下沿；「出屏」= 控件下沿越过可视下沿的像素数。量之前把窗口与舞台的 scrollTop 全部归零，有显隐开关的控件排先打开再量。

水位：进场 `npm test` = **1098 文件 / 19310 用例**；交卷 = **1104 文件 / 19380 用例**（+6 文件 / +70 用例，只增不减）。
交卷那次整跑有 1 条红：`src/games/snake-snack/qaC1.test.ts`「五座无尽花园每一座都能真的吃满一轮」5000ms 超时——**并发满载下的老抖动，单文件重跑 23/23 全绿**，snake-snack 本轮一个字符未动。`npm run build` 全绿。

## 修了什么（按 playbook 编号）

### N-25 fight-king 格斗塔 + N-31 训练场触屏键排 ✅（配方 G）

- **修前**（915×412）：塔第 1 关裁 498、canvas 出屏 335，轻击/重击/必杀/防御整排线下；训练场开「📱 触屏按键」后裁 801，两排 8 键 + 假人 3 钮全线下。
- **改法**（`src/games/fight-king/index.ts`）：对局壳 `.fk-fight` 在 `@media (min-width:700px) and (max-height:560px)` 改网格——两块摇杆分列画面左右（`display:contents` 提升 `.fk-pad` 为网格项），训练场教学面板 `max-height:28dvh` 自滚、假人切换行 `position:sticky;top:0`；画面外套一层 `.fk-stagecol` 才量得出天然宽（`stageClipBottom` 上探层数 10→16，塔里正好压在旧上限边上）；塔壳「出战角色」八宫格按 `shouldFoldHeroGrid(裁多少, 玩家点开过没有)` 自动折成一颗「🥊 出战：×× ▾」，玩家自己点开过就永不背着人折回去，且只在关内折（`inLevel` 闸门，选关地图是设计内长滚页不牵连）。
- **修后**（915×412）：塔 6 / 训练 0 / 双人 0 / 人机 0 / 无尽 0，**五模式折叠线下全 0**；竖屏三档与 1024×768 / 1280×800 五模式全 0。训练场竖屏/平板仍裁 315–469，那是教学面板本来就长（控件线下 0，媒体查询够不着这几档，本轮未动）。
- 测试：`src/games/fight-king/shortLandscape.r9.test.ts`（媒体查询口径、双栏排布、面板限高与 sticky、折叠纯函数、`inLevel` 闸门、监听摘钩）。

### N-1 fruit-catch 横屏 + 平板画布出屏 ✅（四轮未动的老账）

- **修前**（r5 原文，本轮复证）：915×412 裁 741 / 画布出屏 617；1024×768 裁 415 / 出屏 281。
- **改法**（`src/games/fruit-catch/index.ts`）：新增 `canvasCapHeightPx()` 按「舞台可视下沿 − 画布上沿 − 画布下面的家当」算出显示高上限（下限 200px），`fitFruitCanvas()` 只写 `max-height`，浏览器按 16:9 内在比例连宽一起等比收——**backing 分辨率与 `canvas.width/height` 一个数都不改，判定全在世界坐标里**；三个 `draw()` 循环各每 15 帧补量一次（一次性量不住壳层回流）；矮横屏另加双栏：画布独占左栏，计分/按钮/图例收进右栏。
- **修后**：闯关 915×412 裁 1 / 360×640 裁 1 / 竖屏两档 0 / 1024×768 与 1280×800 裁 5；双人 915×412 裁 19、其余 0；雨天模式三档全 0。**六档画布出屏 0、控件线下 0。**
- 测试：`src/games/fruit-catch/shortLandscape.r9.test.ts`（钳高纯函数、backing 不被动、每 15 帧节流、双栏排布、按钮热区下限）。

### N-34 pinyin-train 拼写关 + N-35 全选关 ✅（配方 G/J，用 localStorage 进度路验收）

- **修前**（915×412）：101 族拼写关裁 450、十一票交互件线下；103 族全选关裁 179、全票线下。
- **改法**：`spell.ts` 矮横屏改三栏（`"loco slots top" / "scene yard go" / "view yard msg" / "hint yard say"`，`.pyt-bottom` 用 `display:contents` 把 🚂 发车 / 提示 / 消息三块提上来各就各位）；`pickAll.ts` 改双栏（左栏题面与朗读，右栏车厢与操作行）；两处都只动排布与内边距，**车厢热区 `CHIP_MIN_PX`、拼音字号下限、`judgeSpell`/`place` 判定零触碰**，`scene.ts` 没碰（只在媒体查询里钳它的高）。
- **修后**（915×412）：拼写关 0 / 全选关 0，折叠线下全 0；竖屏与平板两关全 0（拼写关 412×915 残 15，控件线下 0）。
- **限时关（135 族）勿劣化**：修前修后同数 —— 见下面「本轮新抓」。
- 测试：`src/games/pinyin-train/deepLevelLayout.r9.test.ts`。

### N-26 duo-vs-star 闯关七键 + r4 C-9 `.dvs-back` 热区 ✅

- **修前**（915×412）：闯关第 1 关裁 314 / canvas 出屏 111 / ◀▲▼▶✋💥🤝 七键整排线下；双人对战裁 117、两套共 14 键线下；无尽车轮战裁 140；`.dvs-back`（◀ 返回 / ⏸ 暂停）实测 32px 高。
- **改法**（`src/games/duo-vs-star/index.ts`）：
  - 单人局（闯关 / 人机 / 无尽）挂 `.dvs-solo`，矮横屏双栏：画布独占左栏，右栏 372px 宽——七颗 46px 键（7×46 + 6×5 = 352）**正好一排排完**，不用折两行去啃画布的高；名牌尾行让位、提示收一行小字。
  - 双人同屏三个模式不改结构（两块摇杆本就一人半边），只把键距 6→4，让一排七键别折行（720 的壳每人 348px，346 塞得下）。
  - 画布钳高在矮横屏把下限从 150 让到 120（`MIN_CANVAS_DISPLAY_SHORT_PX`）：那一族净高只有 130 上下，守着 150 等于让画布压着裁切线，而线以下正是唯一的输入方式。
  - `.dvs-back` 补 `min-height:40px` + `inline-flex` 居中（字号、内边距一个没动），`window4-visual-scan-r3.test.ts` 的登记断言**取反为修复态**。
- **修后**（915×412）：闯关 2 / 双人 0 / 人机 0 / 团队 0 / 合作 0 / 无尽 0，六模式折叠线下与出屏全 0；`.dvs-back` 在 360×640 / 915×412 / 1280×800 实测全 40px，360px 横向溢出 0。1280×800 双人对战顺带从裁 8 回到 0。
- 测试：`src/games/duo-vs-star/shortLandscape.r9.test.ts` + 取反后的 `window4-visual-scan-r3.test.ts`。

### N-27 dot-maze 四模式方向键 ✅（一次修四态）

- **修前**（915×412）：闯关裁 167（⏸▲◀▼▶ 五键线下）/ 无尽裁 121（三键线下、另两键出屏 43）/ 抢豆对战裁 143（9 控件线下）/ 双人追逃裁 143（9 控件线下）。
- **改法**（`src/games/dot-maze/index.ts` + `layout.ts`）：一局的外框按「有没有第二套键」挂 `.dmz-lay-solo` / `.dmz-lay-duo`；矮横屏单人局迷宫一栏、方向键另起一栏，双人局**两套键分列迷宫左右**（谁坐哪边键就在哪边）；画布钳高下限矮横屏 160→128（`MIN_CANVAS_DISPLAY_SHORT_PX`）、留边 4→12；HUD 与提示行只收内边距，**字号一个不动**（14px 是 A 档 5-4 的红线，`round1-fix` / `round3-final-verify` 钉着）。
- **修后**（915×412）：闯关 4 / 无尽 0 / 抢豆 0 / 追逃 0，四模式折叠线下与出屏全 0；竖屏三档 0；追逃在 1024×768 / 1280×800 的 5 是**修前就有的老底**（当场 stash 掉本轮改动复量，同数）。
- 测试：`src/games/dot-maze/shortLandscape.r9.test.ts`。

### N-32 brave-path 无尽地牢战斗三钮 ✅（配方 E + G 合用）

- **修前**（915×412）：无尽深渊第 1 层战斗裁 268，👊 攻击 / 🛡️ 防御 / 🍓 莓果三个**每回合必点钮**整排线下——滚一次点一次，回合时长翻倍。
- **改法**（`src/games/brave-path/index.ts`）：战斗壳挂 `.bvp-battle`，每块家当各给一个名字（`bvp-b-bar/foe/fore/log/hero/hint/acts`）；矮横屏改三栏 `"bar bar bar" / "foe log hero" / "foe fore hero" / "foe hint hero" / "acts acts acts"`——敌我两张牌左右对望，战报和两行提示夹在中间限高自滚，三个必点钮独占底下一整行并 `position:sticky;bottom:0`（不透明底 + 上缘阴影）。两张牌只收内边距与头像尺寸，**字号、战斗数值、莓果计数、层数生成、`combat.ts` 判定零触碰**。
- **修后**（915×412）：无尽战斗 0（原 268）、闯关战斗 12（原 38–40，同族顺带收干净，三钮出屏 0）；412×915 / 1024×768 / 1280×800 全 0。
- 测试：`src/games/brave-path/shortLandscape.r9.test.ts`。

## 本轮新抓（都已复证是修前就有的老底，本轮未动）

复证方式：把对应目录 `git checkout` 回 `6a9f42d0` 重新 build 再量，数字与修后一致。

| 编号建议 | 位置 | 915×412 / 其他档实测 | 说明 |
| --- | --- | --- | --- |
| — | pinyin-train **限时关（135 族）** | 915×412 裁 6，**三张车票（xǐng/háng/xíng）线下**，`.pyt-quizskin` 内滚 142 | r8 记的「限时关干净」不成立：题面区自滚,选项掉在滚动线以下。修前修后同数，属 quiz 皮肤族，未动 |
| — | pinyin-train **拼写关竖屏 / 平板** | 390×844 裁 145「🚂 发车」线下；1024×768 裁 134「发车」出屏 47 | 与 N-34 同款不同档；本轮媒体查询只咬矮横屏，这两档没进分支。同一族，建议下一轮一次收净 |
| — | brave-path **对战 · 星星的队伍** 进门页 | 915×412 裁 279，「开打！/ 🧭 同图竞速 / 🎒 先去调配装」三钮线下 | 属 r4 C-8 的菜单族（一次性点、页可滚），本轮不扩大化 |
| — | brave-path 无尽战斗**竖屏** | 390×844 裁 11、🍓 出屏 7 | 矮横屏分支够不着的档，轻伤 |
| — | duo-vs-star 团队赛 / 合作特训**进门页** | 915×412 裁 280 / 316 | 同为菜单族（`dvs-pick` 舞台/难度选择、课程列表），玩法态已全绿 |

## 方法论上踩到的四个坑（下一轮直接抄）

1. **`vite preview` 会喂上一版给你**：sirv 在启动时就把 `dist` 的文件表缓存住了，`npm run build` 之后不重启，新哈希的 chunk 全部 404 回落 index.html——量到的是上一版，既能假绿也能假红。本轮 dot-maze 第一次改完「一点没变」就是栽在这。**每次 build 之后必须重启预览服务**（本轮用 `/tmp/pptr/serve.sh` 一条命令做）。
2. **钳高的余量算法对滚动位置敏感**：`clip − canvasRect.top` 在舞台自己滚下去一截时会凭空多出一个 `scrollTop`，那一刀就钳松了，滚回顶部画布又压在裁切线上。余量要按「滚回顶部」算（把沿途祖先的 `scrollTop` 加回去）。duo-vs-star 与 dot-maze 都补了这条。
3. **挂载那一瞬间量不准**：壳层顶栏 / l99 关卡条 / emoji 字体回流都比 `setTimeout(0)` 慢，第一刀常常判「不用钳」。duo-vs-star 用每 20 帧补量（显示宽没变就不碰 backing），dot-maze 加了一记 320ms 的补量。1280×800 双人对战的裁 8 就是这么冒出来又这么收掉的。
4. **`position:sticky` 在 l99 关内失效**：`.l99-stage` / `.l99-stage-wrap` 是 `overflow:hidden`，它会抢走 sticky 的滚动容器身份，而它自己不滚——所以「操作行 sticky 置底」这条配方 E 在 l99 托管的关里**只能当兜底**，真正解决问题的还是把内容排进可视高。brave-path 闯关战斗就是这么从「sticky 不生效、三钮出屏 40」压到 12 的。

## 还剩什么（没动的原因）

- **N-29 bubble-aim 关内发射台 + N-23 三款地图 focusCurrent**：任务单里的「时间够再做」项，本轮六条主线（N-25/N-31、N-1、N-34/N-35、N-26+C-9、N-27、N-32）做完后没有余量，未动。
- **N-2 / N-3 / N-4 回合必点组**（flight-chess / star-estate / hero-cards）：本可与 N-32 打包，但 N-32 在 l99 关内撞上 sticky 失效（见上第 4 条），排布重做吃掉了预算，未动。
- 上表五条新抓，全部书面留档、未扩大化处理。
- 红线遵守：存档 key、`meta.id`、题库、seed、判定、`src/art/kit/` 一律没碰；测试只增不减；1280×800 六款全部复量，无回归（duo-vs-star 与 dot-maze 反而各收掉一点老底）。

## 与并行批次对账

- 进场从 `origin/game-1.3 = 6a9f42d0` 起分支，收尾前 `git fetch` 复核：`game-1.3` 无新提交，无撞车。
- 本分支应可销账：N-25、N-31、N-1、N-34、N-35、N-26、r4 C-9、N-27、N-32。
