# UX 优化 playbook（学习员 #3 · 技能对照版，零 src 改动）

> 基线：`origin/game-1.3 = 30cc10ab`（已含 N-77 相册、N-87 冲刺菜单、N-88 格斗开打、N-47 仓鼠地鼠芯片、N-86 大厅卡）。
> **定位**：与 `trio-rN-learn-notes/playbook` 的逐案抽验并行，本文是「模式层」清单——把 `.cursor/skills`、r4–r16 沉淀配方与当前实现对照出的**系统性差距**，写成下一轮两个测试代理可直接执行的条目。
> **编号纪律**：本文条目一律用 **U-x**，不占 N 号（r17 学习员已锁 N-89 起）。#1（A 壳+学习）领 **U-101…**，#2（B 休闲对战）领 **U-201…**，共通项 U-1…。测试中发现的**新伤只记数字与文件**，N 号交学习员统一编，避免撞号。
> **对账纪律**：动手前 `git log --oneline -20` + 查对应 `*.test.ts` 是否已在树；r15 的 N-75…N-85 测试员仍在途，撞车取先合版。

## 一、学习来源（30 秒版）

- `.cursor/skills/1.3-visual/frontend-design`：文案=动作本身、错误给出路、质量地板（响应到手机、focus 可见、reduced-motion）。
- `theme-factory` / `canvas-design`：token 化配色、先立视觉方针再动手——对应壳层 `styles.css` 的 CSS 变量体系。
- 仓库自家最佳实践（历轮配方，**优先照抄不再发明**）：
  - **配方 B**（钳画布显示高）：量画布下方家当实高从可用高扣掉，共享工具 `src/engine/stageRoom.ts` 的 `stagePlayRoom()`；样板 dot-maze `a16caf46`。
  - **sticky 底控制排**（r5②/r6②）：操作行 `position:sticky;bottom:0` + 不透明底与上缘阴影；样板 `styles.css:3302` chess-garden `.cg-tools`。
  - **双栏横屏**（r6①）：915 宽横向余量大，D-pad/触控键挪画布左右两侧。
  - **touch-action**（r4）：根容器 `pan-y`，只有真吃拖动手势的 canvas/摇杆保留 `none`。
  - **容器内滚动**（r5 / N-63）：`scrollIntoView` 只许发生在自家滚动盒（`level99.ts` `.l99-view`），禁止卷走 `.game-stage`。
  - **弹窗按钮粘底**（配方 I / N-33）：`styles.css:972` 一带。

## 二、差距表：别人做得好 vs 我们缺什么

| # | 别人做得好 | 我们现状 | 缺口 |
| --- | --- | --- | --- |
| G-1 | 安全区四边都躲（skills 质量地板；本仓 `.overlay` 已四边 `styles.css:3297`） | `.screen` 只垫顶（3288），水平 padding 是 `clamp(14px,4vw,32px)`（261 行） | 横屏刘海 inset 可达 44px+，32px 顶不住：**左右 inset 未接** |
| G-2 | 逐面回归（本仓 915×412 已刷 16 轮） | 竖屏 **412×915** 无一轮系统抽验（1.2 只守 360 文本红线）；平板 1024×768/1280×800 只有「不落入任一档」声明，无数字 | **竖屏/平板面从未量过**，D-pad、手牌、盘类在竖屏的账是空白 |
| G-3 | 修复走共享工具（`stagePlayRoom`、mobileText 常量） | 各游戏 fit CSS 手写魔法数（`min(248px,58dvh)` 式散在 20+ 文件） | 新修复不引用工具就会继续攒魔法数；**修复必须引用配方编号** |
| G-4 | 选关地图密度随屏幕走 | `.l99-grid` 固定 5 列（`level99.ts:568`），无守门测试钉死 | 平板横屏浪费一半宽、竖屏滚动长一倍；可加列但格子须保 ≥44px |
| G-5 | reduced-motion 全覆盖 | 壳层/styles.css 有 8 处 guard；**59 款**游戏文件带 `animation:`，仅 ~10 文件有 `prefers-reduced-motion` | 装饰动画（浮动、脉冲）大面积无 guard |
| G-6 | 色彩 token 单一来源 | 壳层用 `--ink/--ink-soft` 等变量；游戏内联 CSS 各自硬编码粉彩 hex | 仅列为「触碰该文件时顺手」项，不专开 PR |

## 三、P0 可玩性 / 滚动 / 过小

### 3.1 旧号仍开清单（主菜，先对账再动手；量法与数字出处 r15/r16 notes）

**#2（B 休闲对战）**——全部 915×412，修复模式在括号里：

- [ ] N-75 mahjong-bloom 对局手牌 514–518 线下（钳桌高或手牌横排进 412；牌宽 46 勿再加）
- [ ] N-76 combo-clash 轻/重/必杀 440，训练场 666（三键钉进 412=sticky 底；日志区可滚）
- [ ] N-78 shoot-range 双人 scrollTop 207、🌟 428（先灭舞台自滚，再 sticky 开火排）
- [ ] N-79 prince-princess 两人一起 D-pad 540/578（配方 B 钳画布 + 双栏横屏）
- [ ] N-80 box-hamster 闯关方向键 571/629（无尽已绿，抄无尽的排法）
- [ ] N-81 snake-snack 无尽 crop 655、方向 678/732（收盘+钉键）
- [ ] N-82 bubble-pop 无尽泡泡海 crop 779（钳格区高）
- [ ] N-83 gomoku 闯关工具行 526/578（≠ N-67 自由对战）
- [ ] N-84 tank-battle 闯关键排 464/513（≠ N-53 双人）
- [ ] N-85 snow-fight 闯关搓雪 462/514 + N-55 对战十二键 446/496（可同 PR 分测试）
- [ ] N-60/61/62 orb/snake/merge-2048 贴线残余：键顶 394–398 仍切 28–32px（**只再垫 8px**，禁按整钮线下重写）
- [ ] N-12 pool-stars 击球 425/暂停 482；N-10 weiqi-garden 工具 450、盘出屏 43（配方 B）
- [ ] N-3 star-estate 地格 13px@429（格子过小属「过小」红线：热区 ≥44 或整体缩格）

**#1（A 壳+学习）**：

- [ ] N-11 bowling 关内 587（r15 仍开；勿回滚 `showMap(true)`）
- [ ] C-8 balloon-pop **闯关** 气球 455（无尽是 N-82，勿混账）
- [ ] N-46/N-56 残余 sky-squad 闯关六键 408 + h42
- [ ] C-6/N-37/N-63/N-68/N-73/N-77/N-87/N-88 **已合**，只许 915 回归，禁止第二套实现

### 3.2 U-1 竖屏 412×915 首扫（G-2 落地，本轮新增的面）

- [ ] **U-101（#1）**：壳层+学习类 6 款竖屏量点：首页首屏（首卡 top）、l99 选关地图（`.l99-node-cur` 在首屏？）、find-diff 三图关、shape-kingdom 深关选项、music-stars 视奏、clock-house。
- [ ] **U-201（#2）**：操作密集 8 款竖屏量点：box-hamster / prince-princess / tank-battle / snow-fight / shoot-range（D-pad 类）、mahjong-bloom / landlord-cards（手牌类）、gomoku（盘类）。
- 量法同 r4：`getBoundingClientRect` 控制排与画布，`crop = scrollHeight − clientHeight`，折叠数；每档独立 `createBrowserContext()`。
- **红线**：竖屏下控制排必须整排可点（top+h ≤ 915）、热区 ≥44px、画布不出屏；正文 ≥16px、控件字 ≥14px（`src/ui/mobileText.ts` 常量）。
- 发现新伤：只在报告里记「文件 + 数字」，勿自编 N 号。

## 四、P1 关卡排布 / 安全区

- [ ] **U-2（#1）横屏左右安全区**：`src/styles.css:261` `.screen` 的水平 padding 改为 `max(clamp(14px,4vw,32px), env(safe-area-inset-left,0px))`（右同理，用 padding-inline 两值写法）。无 inset 浏览器 `max()` 落回原值，布局零变。验收：DevTools iPhone 横屏模拟，返回按钮/暂停钮不入刘海带；1024×768 布局零回归。
- [ ] **U-3（#2）l99 地图平板密度**：`src/games/level99.ts` `.l99-grid` 固定 5 列，加 `@media (min-width:700px){.l99-grid{grid-template-columns:repeat(7,1fr);}}`（或 auto-fill minmax(56px,1fr)）。验收：915×412 章节页滚距减半；`.l99-node` 实测宽 ≥44px；420px 以下 5 列不变；无守门测试钉列数，但需**新增**一条断言媒体查询存在。
- [ ] **U-4（#1）地图当前关首屏回归**：进任一 188 关地图（bowling、hop-pads、rainbow-run 抽 3 款），`.l99-node-cur` 必须在可视区（`scrollIntoView({block:"center"})` 已做，补 915×412 与 412×915 两档数字回归即可）。
- [ ] **U-5（#2）选关格「过小」下限**：抽 3 款自带选关 UI 的游戏（candy-swing `.cs-map`、bubble-aim `.ba-map`、brave-path），量节点热区 ≥44px、星标 ≥12px；小于就按配方 B 之 3 缩列不缩格。

## 五、P2 视觉

- [ ] **U-6（#2）reduced-motion 扫描**：`rg -l "animation:" src/games -g '!*.test.ts'` 得 59 文件，对照 `rg -l "prefers-reduced-motion"` 差集；只给**纯装饰**动画（浮动/脉冲/彩带）补 `@media (prefers-reduced-motion:reduce){...animation:none}`，与玩法判定绑定的动画不动。每款一行 guard + 一条断言。
- [ ] **U-7（#1）文案 review 红线**（frontend-design skill）：本轮所有新增/改动按钮，文案=动作本身（「继续玩」不是「确定」）；错误态必须给出路（「先玩别的吧」式）。列入 PR 自查，不单独开条。
- [ ] **U-8（两位顺手）色彩 token**：触碰某游戏 CSS 时，与壳层 `--ink/--ink-soft/--shadow-soft` 重复的 hex 顺手改引用变量；**不专开 PR、不扫全库**。

## 六、统一验收步骤

1. `npm test`、`npx tsc --noEmit` 绿；水位 ≥ 交卷时主干（r16 口径 1174 文件 / 19455 用例，以实测为准）。
2. `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。
3. 双视口各留数字：**915×412**（既有口径）+ **412×915**（U-1 新增）；每条写 `getBoundingClientRect` top/h 与 crop。
4. 老纪律：不改存档 key / `meta.id` / 题库 / seed / 胜负；验收禁 force、禁只 grep CSS 字符串；测试只增不减；开/关、root 每档独立 context；工装放 `/tmp`，不进库。
5. 改共享 CSS（U-2/U-3）必须跑首页 + 任一游戏 + 任一弹窗三张截图确认零回归。

## 七、下一轮派发提示词摘要

**#1（A 壳+学习）**：基于 `game-1.3` 最新，先对账 §3.1 A 段（N-11/C-8/N-46 残余仍开则修，已合号只回归）。主任务：U-101 竖屏 412×915 首扫（壳层+学习 6 款，只记数字勿编号）、U-2 横屏左右安全区、U-4 地图当前关双视口回归、U-7 文案自查。修复引用配方编号，验收按 §六双视口留数字。

**#2（B 休闲对战）**：基于 `game-1.3` 最新，先对账 §3.1 B 段（r15 N-75…N-85 在途，撞车取先合版；N-60/61/62 只垫 8px）。主任务：U-201 竖屏首扫（操作密集 8 款）、U-3 l99 平板 7 列、U-5 选关格下限抽查、U-6 reduced-motion 扫描（装饰动画限定）。验收按 §六。
