# 三人组第 19 轮 · 测试修复员 A/B 任务清单（playbook · 战役收口轮 10/10）

> 依据：`trio-r19-learn-notes.md`。基线 `origin/game-1.3 = 6982da7e`。
> 事实前提：**r18 派发的修复一条都没合进主干**（`c8a3d154..6982da7e` 全是 docs），r18 的实测数字全部仍有效；本表 = r18 全量未修项照抄 + 本轮新伤 N-108 + N-100 扩面验收清单。
> **禁止重做（已合 N 号）**：N-47/63/68/73/77、C-6、N-37、N-75…N-89、N-40 赛道 sticky、N-32 无尽战斗三钮、`OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`、`casualFit.r10b` 断言（`dcfacba0`）。
> **只落回归数字、禁止再修**：N-60/61/62/90/91（N-89 收壳后全绿，给这批加第二套垫 = 打回）。
> **已书面降级、不再派**（学习笔记第六节台账）：N-10 残余、N-109 root 门矮横屏初见折线下、brick-break L1 crop28、mine-garden 末排、lianliankan 密格、red-blue-race 让分芯片卷顶。降级项将来「滚不到」了就地升回。
> **不覆盖** r14…r18 笔记原文。撞车取先合进 `game-1.3` 的版本。

## A / B 独占（本轮口径，防撞车；动了对方文件 = 打回）

| 工位 | 独占面 | 本轮任务号 |
| --- | --- | --- |
| **A** | `src/ui/**`、`src/games/level99*`、`src/games/quiz99*`、campaign/learning 学习款（word-garden / pinyin-train / clock-house / find-diff / math-farm / shape-kingdom / sudoku-petal） | **N-99**（sudoku-petal）、**N-97**（math-farm root×深关）、**N-100**（level99 锚定，验收 17 款）；余力项 N-109 | 
| **B** | 其余 `src/games/**` 全部 | **N-105（第零优先红灯）**、N-98、N-95、N-94+N-101、N-96、N-102、N-103（含 root×188）、N-104、N-106、N-107、**N-108（新）**、C-5、N-29 尾款、旧号 N-12/N-3/N-55/C-8 |

公共 `src/engine/**`、`src/art/kit/**` 谁都不动（kit 只 import）。

## 红线（收口轮口径，一字不差）

- 不改存档 key / `meta.id` / 题库 / seed / 胜负判定。测试只增不减，每条修复配小测试。
- **root 态一律走 UI 密码门**：首页 🔑 → 输 `kangkang` → 选时长 → 打开。**收口轮起不许种 / 不许改 `yiduo-yixing.root.v1` 等任何 storage key**（r18 允许 seed 的口径作废——JS 点击和 seed 会漏掉 N-109 这类门本身的伤）。顺手验一遍 localStorage 无密码残留。
- 视口两档都要绿：390×844 必须能划到底（键排允许在滚动流里，但必须滚得到）；915×412 关卡地图与按钮不得裁切（1024×768 抽验观感）。
- 可点热区 ≥ 44px；密格棋盘（连连看/象棋类）盘内格豁免，盘外按钮不豁免。
- 验收 915×412 `getBoundingClientRect` 留 top/bottom 数字，**初见出屏的元素必须补 `scrollIntoView` 后的 reach 判定**（学习笔记第七节量法，能分清降级项和必修项）。开/关、root 每档独立 context。
- 收尾：`git fetch origin game-1.3` → rebase → `npm test` && `npm run build` 全绿。**进场水位 `6982da7e` 实测 = 1193 files / 19489 tests，其中 2 文件 5 用例红（= N-105）**；B 修完 N-105 后底线 = **1193 / 19489 全绿**，只增不减。禁 force，`git push origin HEAD:game-1.3` 或开 PR 指向 `game-1.3`。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`，每案独立 context。
- 进游戏 `#/game/<id>`；闯关点 `.l99-node-cur`；root 走 UI 密码门（见红线）。
- sticky 失效先量裁切祖先（overflow-y + scrollHeight/clientHeight），再决定 fixed / 收内容，不要盲加第二套键排。

---

## B 第零优先 · N-105 主干红灯（先于一切，收口轮不许再往后传）

- `6982da7e` 实跑仍红（第三个基线：`e58ccceb` → `c8a3d154` → `6982da7e`）：`src/ui/mobileText.test.ts` 3 例 + `src/games/window1-mobile-text.test.ts` 2 例。
- 病灶：`combo-clash/index.ts:206` `.cc-info` 14px、`mahjong-bloom/index.ts:248` `.mj-goal` 14px + nowrap（PR #78 `81b228c2` 带入）。
- 修法：两处字号回 **16px**、`.mj-goal` 解 nowrap（高度紧就收 padding / max-height 两行截断）。**不许砍/放宽守门测试**，不许回退 N-75/76 键排。
- 验收：全量 vitest **1193 / 19489 全绿** + 915×412 复量 `.cc-info`/`.mj-goal` 仍在屏。

## A 面

### N-99 sudoku-petal 盘底两行滚不到 🔧（A 最重）

- r18 数字仍有效：盘格两排 **391~447 / 448~504** 线下，`.sp-wrap` overflow-y:hidden（446/178）滚不到；`.sp-pad` 340~384 在屏勿动。
- 修法照 N-68 `miniCellPxRow` / N-63 `mapClampPx` 纯函数配方钳格径，或矮档 `.sp-wrap` 改 `overflow:auto`。题库/seed/判定零触碰；390 已绿（pad 722~768）勿回退。
- 验收：915 全 81 格可见或滚得到，`.sp-pad`/`.sp-tools` ≤412、热区 ≥44；390 fold 0。

### N-97 math-farm root×深关选项 🔧

- 末章末关选项 top **416**（r17 数字）。收农田行高；L1 勿动；题库零触碰。验收走 UI 开 root（永久档）→ 末关选项 bottom ≤ 412。

### N-100 level99 进场锚定卷顶 🔧（验收面 17 款）

- 病：tab 折行款进场 `.l99-view` 被当前关 scrollIntoView 卷顶，「开始冒险 ▶」与工具行初见在视口上方（全部滚得回，故只算锚定病）。
- r18 六款：word-garden -154 / ice-fire-forest -104 / xiangqi -50 / landlord-cards -52 / bumper-cars -39 / root×pinyin-train -54。
- **本轮扩面 11 款**（trio-r19-learn-notes 第四节）：puzzle-tiles -106、brick-break -104、red-blue-tap -100、lianliankan -100、dot-maze -53、fishing-star -53、poop-hero -50、puff-bros -50、red-blue-race -50、red-blue-tug -50、mine-garden -31。
- 修法：进场滚动锚定 clamp 到工具行以下 / 当前关只在 `.l99-map` 盒内居中，或矮档 `.l99-continue`+`.l99-tools` sticky 到 `.l99-view` 顶——**改 `level99.ts` 一处，17 款全愈**，别逐款打补丁。红线：不动 `showMap(true)` 四处调用、模式芯片行勿动、paneH 常量勿碰。
- 验收：17 款 915 进场 `.l99-continue` top ≥ 0 且当前关在屏；root×fishing-star 直达行 47~91 IN 与 root×bowling 27~71 IN 不回退；390 / 1024 不回退。

### A 余力项（降级在册,做了更好,不做不算漏项）

- N-109：`@media (max-height:500px)` 收 `.rootgate` 竖 padding / 时长行合排，让「打开/不打开」初见进 412（现 413~459,盒内滚得到）。

## B 面（N-105 之后按此顺位；每条修掉或**书面降级**进交卷报告,不许静默漏项）

1. **N-98 hue-hand** 三键 422~466 线下、`.l99-host` hidden(668/334) 令 sticky 失效——照 N-75 fixed 钉底；390 三键 713~757 勿回退。
2. **N-95 xiangqi** 自由对战「开始下棋」701~755 线下；残局学堂已绿别误伤；矮横屏可 2~3 栏。
3. **N-94 + N-101 duo-vs-star 连修**：选人「开打 ▶」439~488 线下 + 赛中 14 键 400~746 全线下（canvas 122~302 IN）；`.dvs-pick` 30 / `.dvs-back` 40 抬 44；勿改 `battle.ts` 状态机。
4. **N-96 bomb-buddies** 画布底 475 出屏 63；钳显示高，三键在屏勿动。
5. **N-107 fruit-stack** 双人六键 `.fs-key` 522~566 全 OUT（双画布 212~409 IN）；fixed/sticky 钉底；勿改合成判定。
6. **N-106 monster-crisis** 双人摇杆 370~462 / 甩弹 379~453 切底；技能三卡 262~400 勿动。
7. **N-108 puzzle-tiles 无尽画廊（新）**：拼块第 2/3 排 **491~918 全 OUT 且滚不到**（`.l99-host` hidden 886/334，scrollIntoView 后仍 -39~170）；矮横屏按余量钳拼块边长（3 行进 334）或 `.pz-board` 内滚；顺手抬热区 `.pz-back` 30 / `.pzt-eye` 32 / `.pzt-undo` 32 / `.pz-hint` 34 / `.pz-open` 38 → ≥44；勿改打乱 seed / 判定；闯关 L1 已可滚勿动。
8. **N-102 bumper-cars** 915 画布 140×140 过小 + `.bc-open` 34 / `.bc-pick` 32 + 1024 刹车切 17；fit 按「可用高 − 键排」算。
9. **N-103 ice-fire-forest** L1 画布切 59；**验收必须含 root×188**（走 UI 门开 root）：画布 276~515 出屏 103、pad「向下」行 393~437 切 25——root 工具行要进高度预算。
10. **N-104 landlord-cards** `.ld-back` h=33 → 44（开局 + 出牌阶段一处修两态）。
11. **C-5 mole-pop** 915 九洞 250~894（6/9 线下）、root×167 更差；按「余高 ÷ 3 行」反推洞径；**390 九洞全 IN 别修反**；别整支翻合旧分支 `casual-duo-fit-r5-b-4683`。
12. **N-29 尾款**：sling-birds 重来/选关 368~416 只差 4px 垫一档即结案；candy-swing 画布 166~660 出屏 248 补显示高钳。bubble-aim 已销账勿动（顺手抬其工具排 h40 → 44）。
13. **旧号四件**：N-12 pool-stars（915 + 390 两档全坏，补 max-height 媒体 + 钉底）、N-3 star-estate（棋盘切 104 + 390 操作行线下；勿再砍 `max-height:min(156px,38dvh)`）、N-55 snow-fight 对战第二排 382~428 只差 16px 收 gap、C-8 balloon-pop `.blp-sky` 底切 186 只钳 CSS 显示高（**禁改 `SKY_H=420`**）。

## 干净清单（学习员已量绿，本轮不必再测）

- r18 版全部沿用：landlord-cards 915 开局+出牌、暂停覆盖层、root×bowling 直达条、root×xiangqi 残局学堂、bowling 1024 地图、hue-hand/sudoku-petal 390、root×pinyin 188 / root×clock 100 关内、bubble-aim 关内+无尽、N-54 hop-pads 双人、mole-pop 390。
- 本轮新增：dot-maze 无尽迷宫/抢豆对战（键 h48 全 IN）、poop-hero / puff-bros / fishing-star / red-blue 三连闯关 L1、root 密码门 390/1024、root 契约（UI 解锁后 storage 无密码残留）、fruit-slice / rainbow-run / sprout-defense / ocean-munch 入场壳钮。

## 观察项（不开号，交接给下一战役）

- 全 canvas 内部菜单款四件（fruit-slice / rainbow-run / sprout-defense / ocean-munch）内部热区 DOM 量不到，需像素级工装抽验——**这是 915 抽验全库仅剩的盲区**。
- 壳层守门建议（给 A 顺手评估,不强制）：`.l99-host` 直系内容 sh>ch 时必须有可滚层或 fixed 底栏的静态断言（N-75/98/101/108 四次复发的系统病根）。

## 收口要求

1. 本表所有 🔧 号：修掉或**书面降级**（病灶 + 为何不修 + 复现数字,写进交卷报告）,不许静默漏项——这是战役最后一轮,没有「下轮再说」。
2. 每条修复：915 前后数字（含 reach 判定）+ 小测试；水位只增不减,B 修 N-105 后全库 **1193 / 19489 全绿**为底线。
3. 交卷报告写 `docs/qa/trio-r19-tester-A.md` / `trio-r19-tester-B.md`（新文件,勿覆盖他人）。
4. 撞号纪律照旧：发现同号先合版,自己改号追加,不覆盖。
