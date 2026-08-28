# 三人组第 19 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r19-learn-notes.md`。基线 `origin/game-1.3 = 8b23ab11`。
> 本轮主攻：用户三连痛点「**划不动、太小、关卡不好看**」的选关地图 UX 改造（**N-103…N-106**），
> 外加 9 款未量游戏抽验与 r18 未销项续办。
> **编号**：本单新伤 **N-103…N-107**；**N-100…N-102 弃用**（历史撞号，谁都别用）；
> N-92 归 r18 tester A 在途，勿抢。
> **禁止重做（已合/已结案）**：N-47/63/68/73/77/89、C-6、N-37、N-75…N-88、N-86、N-69…74、
> **N-60/61/62/90/91（r18 已结案，加第二套垫 = 打回）**、N-40 赛道 sticky、
> `OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、`SKY_H=420`、`casualFit.r10b` 新断言。
> A = 壳层 + 闯关学习（独占 `src/styles.css`、`src/ui/**`、`level99.ts`/quiz99 与学习款）；
> B = 休闲 / 对战 / 动手（各游戏目录）。撞车取先合进 `game-1.3` 的版本。

## 进场对账（先做，再动手）

1. `git fetch origin game-1.3` 看 r18 A/B 是否已交卷合入：
   - A 在途 `980945e8`：N-92 root 管理员行、`.cc-info`/`.mj-goal` 16px 抢修——**已合则勿重做、16px 修复勿回退**；未合且 rebase 撞 `combo-clash`/`mahjong-bloom` 时保 16px 红线版本。
   - B 在途 `a6ed4010`：brave-path 大厅 nowrap 撑轨修复——同上。
2. r18 单未销项（N-94…N-99、N-12/N-3/N-55/C-8/N-10）以主干为准：已修只回归，未修按 **r18 playbook 原文**执行（本单不复述改法，避免两版打架）。

## 红线（一字不差）

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。测试只增不减；改守门**意图**须交卷写明（先例 `casualFit.r10b`）。
- 管理员密码 `kangkang`；量 root 态直接种 `yiduo-yixing.root.v1 = {"expiresAt":253370764800000,"mode":"permanent"}`。
- 热区 ≥44px；说明文字最后生效块 ≥16px、控件 ≥14px（`mobileText.test.ts` 量**最后一个声明块**；`display:none` 不触线）。
- 新增动效必带 `prefers-reduced-motion` 降级。
- **禁用会波及祖先的 `scrollIntoView`**（N-63 教训）——滚页签/网格一律手动 `scrollLeft`/`scrollTop`。
- 收尾：rebase → `npm test` && `npm run build` 全绿（水位以主干最新实测为准，r17 口径 1182 files / 19477 tests）→ 禁 force。

## 测试步骤（先测什么，按此顺序）

1. `npm test` && `npm run build`；`npx vite preview --port 4173`；puppeteer-core + Chrome，每案独立 context。
2. **触摸用 `page.touchscreen` 实测，不许只用鼠标滚轮**（本轮主题含「划不动」）。
3. 视口顺序：**390×844 竖屏 → 915×412 横屏**，抽验 1024×768 不回退。
4. 竖屏口径：地图从顶触摸滑到 `.l99-maphint`（bottom ≤844），中途不卡死；横屏口径：网格首屏 ≥2 整行、「继续 ▶」唯一 CTA 在首屏。
5. 每条留两档视口 top/bottom 数字；「划不动」类附 scrollTop 轨迹或录屏帧。

---

## 壳层 + 闯关学习（A）

### N-103 章节页签堆高埋网格 🔧（P0；「太小/不好看」主因）

- **现状**：`src/games/level99.ts` L557 `.l99-tabs{flex-wrap:wrap}` + `styles.css` L1646 页签 min 44px。11–12 章游戏 390 宽页签叠 4 行 ≈200px；915×412 首屏几乎无格子。
- **改法（方案甲，推荐）**：`showMap()` L904–919 页签 DOM 拆 span：`<span class="l99-tab-emoji">` + `<span class="l99-tab-name">`（🔒 也独立成 `.l99-tab-lockmark` span）。`max-width:560px` 与 `max-height:500px` 媒体里非当前章节隐藏 `.l99-tab-name`，只留 emoji 徽章（min 44×44 不变，`aria-label` 永远带全名）；当前章节保持全名。预期页签区 ≤2 行（~100px）。
- **必须联动**（learn-notes 第三节三条守门）：
  1. `rootUnlock.ts` L108 改为移除 `.l99-tab-lockmark` span，**不再重写 textContent**（否则拍平 span 结构）；`rootUnlock.test.ts` 假节点同步，用例只增不减。
  2. `window6.r3.qa.test.ts` L132：方案甲不触碰 `overflow-x:auto`，守门无需改。
  3. `.l99-tab` / `.l99-tab-lock` 类名保留。
- **降级路径（方案乙）**：CSS-only 非当前页签 `max-width:64px + ellipsis`，零 DOM 改动，观感打折需交卷写明。
- **验收**：390×844 页签区高 ≤110px、网格首行 top ≤422（视口一半）；915×412 网格首屏 ≥2 整行；root 解锁后页签不回胀；五态（锁/跳过/普通/三星/当前）×两视口截图各一。

### N-104 915 地图首屏密度 + `136px` 常数过时 🔧（P0）

- **现状**：`level99.ts` L642 `calc(100dvh - 136px)` 是 N-89 收壳**前**的壳高 → 现在 ~28px 死空间；500px 档 head 两 chip、chapdesc、pagehint 未收。
- **改法**：①量 915×412 实际壳高（`.game-topbar` bottom → `.game-stage` top），把 136 调到实测值（或改 `.l99-host` 链 `height:100%` 吃满，二选一不并存）；②500px 档 `display:none` 掉 `.l99-chapdesc`（语义已由选中页签承担）、head 两 chip 合并成「🚩 x/188 · ⭐ y」一颗（`showMap()` L860–863）。
- **红线**：`mobileText.test.ts` 钉着 `.l99-chapdesc`/`.l99-pagehint` 16px——隐藏可以、缩字不行；不动 `OA_SHORT_PANE_H`。
- **验收**：915 `.l99-view` 可滚高度增加 ≥24px（前后数字）；网格首屏 ≥2 整行；「继续 ▶」top ≤120；390 竖屏 chip/desc 不回退。

### N-105 触摸滚动兜底 + 竖屏划到底实测 🔧（P0；「划不动」）

- **改法**：`level99.ts` L540 `.l99-view` 补一行 `touch-action:pan-y;`。
- **实测**（这是验收主体）：390×844 触摸滑 match-stars / gomoku / fight-king 三款地图：顶→底 `.l99-view.scrollTop` 单调递增到 `scrollHeight−clientHeight`；**从关内点「🗺️ 选关」返回后再滑一遍**（验证关内 `touch-action:none` 无残留）；915×412 同口径抽 1 款。
- **验收**：三款滑到底 + 返回后复滑通过；`.l99-maphint` bottom ≤844 可达。

### N-106 选关地图观感升级 🔧（P1；纯 CSS/内联 style 零逻辑）

- 全部改动限 `level99.ts` 的 `L99_CSS` 与 `showMap()` 内联 style：
  1. `.l99-map` 背景跟章节色：`map.style.background = linear-gradient(180deg, ${ch.color}33, #F0F4FF)`（切章即换世界）；
  2. 已通关格加两阶光影（`inset 0 2px 0 rgba(255,255,255,.6)` + 现有投影保留）；三星格新增类 `.l99-node-3s` 淡金内描边（`showMap()` 按 `stars[level]===3` 挂类）；
  3. 页签选中态换形状语言：`border-radius:18px 6px 18px 18px` 花瓣角 + 2px 深描边（对比 ≥3:1）替代白 outline；
  4. 新增过渡全部进现有 `@media (prefers-reduced-motion:reduce)` 块。
- **禁止**：动格子尺寸/列数/DOM 顺序；给全部格子加动画（签名元素只留当前关 pulse）。
- **验收**：五态×两视口截图对比；`.l99-node-num` 对比度仍 ≥4.5:1；`npm test` 全绿。

### N-107 `mapColumns` 按容器宽 🔧（P2，可书面降级）

- `level99.ts` L111 纯函数改吃 `wrap.clientWidth`（调用点 L723/L901）。有单测钉行为，用例语义同步、只增不减。验收：915 视口 7 列、格宽 ≥80px；390 仍 5 列。与 N-103/104 冲突就书面降级。

### A 面续办与回归

- **N-99 sudoku-petal / N-97 math-farm**：以主干为准，未修按 r18 playbook 原文；已修落回归数字。
- N-63/N-89/N-92（若已合）只回归；`shellTitle.n89.test.ts` 勿回退。

---

## 休闲 / 对战 / 动手（B）

### 续办（改法见 r18 playbook 原文，本单不复述）

- **N-98 hue-hand**（三键 fixed 钉底，N-75 配方）、**N-95 xiangqi 设置屏**（滚不到，最重）、**N-94 duo-vs-star 开打**、**N-96 bomb-buddies 画布**。
- 旧号 **N-12 pool-stars（两档视口都坏）、N-3 star-estate（两档）、N-55 snow 差 16px、C-8 balloon 只钳 `.blp-sky`、N-10 weiqi 残余（可降级）**。
- 全部以主干为准：r18 B 在途已修的只回归。

### 9 款未量名单抽验 🔎（P1；每款 915×412 + 390×844 两档）

> `block-drop`、`box-hamster`、`bumper-cars`、`dark-chess`、`ice-fire-forest`、`prince-princess`、`shoot-range`、`snake-snack`、`tank-battle`
> （全库仅剩的从未量过 915 的 sticky 底键 × l99 款；名单依据见 learn-notes 2.1）

- 口径：闯关 L1 关内 + 模式菜单两态；量唯一 CTA / 键排 / 画布 top/bottom，sticky 失效先量裁切祖先（overflow + sh/ch）。
- 量到坏：按 **N-75（fixed 钉底）/ N-99（内滚或钳格）** 配方修，不发明第三种；一款一小测试。报告里新伤记「候补号」由下轮学习员正式编号，**不要自行开 N 号**。
- 量到干净：写进交卷「干净清单」，下轮不再测。

### 软键盘与自定义屏抽验 🔎（P2）

- **find-diff 推理关输入框**：390×844 聚焦弹软键盘（CDP `Input.setIgnoreInputEvents` 模拟不了就真机/模拟器口径记录）→ 量确认键是否可点、失焦后布局复原。
- **rainbow-run 390×844 世界地图**：12 世界翻页触摸命中 + 关卡节点热区 ≥44。
- **攻略抽屉 915×412**：任一有 guide 的款开侧栏，量 `.guide-foot`「我知道啦」bottom ≤412、`.guide-body` 可滚。
- **首页 915×412**：hero / 页签行 / 首行卡片 / `.home-footer` 全 IN 或可滚到。
- 量到坏同上记候补号，不自行开号。

---

## 不要动什么（划重点）

1. 玩法/数值/胜负/seed/题库/存档 key/`meta.id`——一个字不动。
2. `SKY_H=420`、`OA_SHORT_PANE_H=200`、`SR_SHORT_PANE_H=200`、N-40 赛道 sticky、N-63 模式条配方、N-89 壳标题、r18 已结案的 N-60/61/62/90/91。
3. `.l99-tab`/`.l99-tab-lock`/`.l99-node-lock`/`.l99-jump-input` 类名（`rootUnlock.ts` 依赖）。
4. r18 A/B 在途的 16px 红线修复（`.cc-info`/`.mj-goal`/brave-path）——rebase 撞车保先合版。
5. 16px/14px/44px 三红线（隐藏可以、缩小不行）；r14–r19 已有笔记与 playbook 原文；工装不进库。
6. 系统字体缩放 rem 化：**本轮禁动**（远期项，见 learn-notes 第四节）。

## 完成定义

1. A：N-103/N-104/N-105 落地或书面降级；N-106 至少完成章节色渐变 + 三星描边两项；N-107 做或降级；A 面续办以主干对账。
2. B：N-98/N-95/N-94/N-96 与旧号做或书面降级（以主干对账）；9 款名单全部量完（坏则修、净则登记）；P2 抽验至少做 rainbow-run 390 与首页 915 两项。
3. `npm test` / `npm run build` 只增不减；每条修复配小测试。
4. 每条留 390×844 + 915×412 两组数字；「划不动」类附触摸 scrollTop 轨迹。
5. 交卷写 `docs/qa/trio-r19-tester-A.md` / `trio-r19-tester-B.md`（新文件）；改守门意图必须写明。
