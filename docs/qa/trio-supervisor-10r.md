# 三人组父监督 · 10 轮持续迭代（合入 `game-1.3`）

> 父监督只编排、对账、派发。本档记录 10 轮循环：每轮 2 个测试修复员（测+修）+ 1 个学习优化员（学+记）。学习员的 playbook 是下一轮 A/B 的任务单。有空闲立刻派下一任。全部合入 **`game-1.3`**，不回 `main`。
>
> 开工基线：`origin/game-1.3 = 6a9f42d0`（含 r8 学习笔记 + 测试员 A 第 2 轮：S-1/S-2/S-3/S-4/L-1/C-1 等）。
> 本战役轮次 **R1–R10** 对应既有三人组编号 **trio-r9 … trio-r18**。

## 角色

| 角色 | 做什么 | 独占（防撞车） |
| --- | --- | --- |
| **测试修复员 A** | 全方位测壳层 + 闯关学习；不好用立刻修 | `src/styles.css`、`src/ui/{home,parentAuth,collection,dialogs,level99 相关}`、`src/games/{level99,quiz99,word-garden,pinyin-train,clock-house,find-diff,math-farm,shape-kingdom}/**` |
| **测试修复员 B** | 全方位测休闲 / 对战 / 动手；不好用立刻修 | `src/games/{fight-king,fruit-catch,duo-vs-star,dot-maze,adventure-king,brave-path,bubble-aim,candy-swing,sling-birds,flight-chess,star-estate,hero-cards}/**` 及 r4–r7 点名的动手款 |
| **学习优化员** | 读 skills、他人窗口报告、外部同类体验；无头抽验未覆盖状态；**零改 `src/**`** | 只写 `docs/qa/trio-rN-learn-notes.md` + `docs/qa/trio-rN-playbook.md` |

## 红线（每轮一字不差）

- 不改存档 key / `meta.id`；不动题库、seed、win/lose。
- 测试只增不减；每条修复配小测试。
- `src/art/kit/` 已有文件只 import 不改（stickers.ts 扩容例外）。
- 收尾：`git fetch origin game-1.3` → rebase → `npm test` && `npm run build` 全绿 → 普通 push 到功能分支，并 **rebase 后 `git push origin HEAD:game-1.3`**（禁 force）。撞车取先合版。
- 学习员禁止改游戏代码。

## 对账（派 R1 时已落地，禁止重做）

来自 `d451c32d` / `trio-r6-tester-A.md`，已在 `6a9f42d0`：

- ✅ S-1 首页三档首屏、S-2 星级 SVG、S-3 parentAuth hashchange、S-4 `.l99-jump-input` 44px
- ✅ L-1 quiz 矮屏紧凑 + find-diff 横屏并排
- ✅ C-1 四款 `[hidden]` + `modebarHidden.guard.test.ts`（含 `.ak-bar`）
- ✅ orb-arena/snake-royale 卡底留白、garden-guard 节点图

**仍未落地（R1 优先，摘自 r8 playbook，已剔除上面已销账）**：

- A：N-33 结算弹窗 sticky、N-38 永久文案、N-37 root 抬头挤压、N-36 描红 pad、N-34/N-35 拼音拼写+全选、收藏册 40/36 热区、`.qz-jump-input` 38→44、L-2 钟面、L-3 贴纸
- B：N-25 格斗塔、N-31 训练场开关态、N-1 fruit-catch、N-26 dvs 闯关、N-27 dmz 四模式、N-30 无尽古堡、N-32 无尽战斗三钮、N-29/N-23 bubble-aim 族、r5 N-2/3/4、r4 C-2…C-8

## 10 轮循环

| 战役轮 | trio 编号 | A/B 执行 | 学习员产出 |
| --- | --- | --- | --- |
| R1 | r9 | 执行 r8 playbook 剩余项（上表） | `trio-r9-learn-notes.md` + `trio-r9-playbook.md` |
| R2 | r10 | 执行 r9 playbook | r10 笔记+清单 |
| R3 | r11 | 执行 r10 playbook | r11 |
| R4 | r12 | 执行 r11 playbook | r12 |
| R5 | r13 | 执行 r12 playbook | r13 |
| R6 | r14 | 执行 r13 playbook | r14 |
| R7 | r15 | 执行 r14 playbook | r15 |
| R8 | r16 | 执行 r15 playbook | r16 |
| R9 | r17 | 执行 r16 playbook | r17 |
| R10 | r18 | 执行 r17 playbook | r18（收口：未修项书面降级） |

**调度**：三人并行。任一人交卷（push 到 `game-1.3` 或功能分支可 rebase）后，父监督立刻派该角色的下一轮，不等另外两人。学习员笔记合入后，下一轮 A/B 必须先读最新 playbook。

## 学习员抽验方向（每轮换抓手，避免重测已结案）

- 读 `.cursor/skills/1.3-visual/{frontend-design,canvas-design,algorithmic-art,theme-factory,character-sprite-maker}` 与 `docs/plan-1.3-visual-bible.md`
- 读其他窗口 QA（`docs/qa/1.3-window*`、`docs/qa/1.2-window*`）里可迁移的配方
- 状态矩阵：游戏 × 模式 × 视口 × 开关态 × 权限态 × 关型 × **覆盖层/弹窗**（r8 模式 I/J）
- 本轮未量过的：1.3 窗口新画风款关内操作排、双人分屏、结算后「再玩」循环、横屏暂停套娃
- 工装脚本放 `/tmp`，不进库

## 水位

派 R1 前以最新 `game-1.3` 实测为准（A 第 2 轮交卷登记 1095 文件 / 19288 用例；r8 playbook 仍写 1090/19248 已过期）。每轮进场重测，只增不减。

## 派发与对账

| 时点 | `game-1.3` | 结论 |
| --- | --- | --- |
| R1 派出 | `a74e4868` | A `bc-12e9c82b…3e57` / B `bc-8f16f806…5d3b` / 学习 `bc-9b1ceaeb…ce4af` 三路并行 |
| 15min 定时器 | `3c9902cb` | **r9 学习笔记+playbook 已合入**（`0845a060`，配方 K / N-39）。本监督的 A/B/学习员仍 RUNNING，未交卷。同环境另有多路 r9 与「学习员第7轮」也在跑，**本拍不重复加派**，避免抢同一批 N-33/N-25 文件。 |
| 下一拍 | 谁先把修复或 r10 笔记推进 `game-1.3` 就立刻派该角色 R2 | A/B 下一轮必须读 `docs/qa/trio-r9-playbook.md`（已在树上） |

R2–R10 仍排队。红线不变。本文件只在监督 worktree 更新，不碰 A/B 修复分支上的未提交 diff。

### 学习员 R1 交卷（本监督）

- 学习员 `bc-9b1ceaeb-0d25-53c0-af51-581f533ce4af` 交卷 SHA `81b5a66d` 已在 `game-1.3`：补测 N-40/41/42 + 配方 L。
- 立刻派 R2=trio-r10 学习员（续同一角色，只学只记，编号 N-43 起）。
- A `bc-12e9c82b…` / B `bc-8f16f806…` 仍在 R1 修复，不重复加派测试员。R3 的 A/B 等他们空闲后改读 `trio-r10-playbook.md`；当前执行仍以最新 `trio-r9-playbook.md` 为准。

### 第二拍定时器（`origin/game-1.3 = 0a8c0344`）

**R1 修复已合入，不再当未做：**

- A：`39d61b50` N-38/33/37/36/34/35/30 + `trio-r9-tester-A.md`（merge `7fdfb7be`）
- B：`b2c07a6e` N-25/N-31 塔与训练场、N-1 果篮、N-32 无尽战斗、N-26/N-27 键排、N-29+N-23（merge `323ac8cc`）
- r10 笔记已在树：`699cd5fd` + `0a8c0344`（N-43 color-fun / N-44 竖式 / N-45 金钩商店）+ `trio-r10-playbook.md`

本监督 A/B/学习员列表上仍 RUNNING；同环境已有多路「第10轮关账 / r10 leftover / r10 learner」。**本拍不加派**，避免同一 playbook 多人抢文件。下一空闲且无在途 r10 测试员时，才派 R3 执行 `trio-r10-playbook.md`。

### 学习员 R2 交卷 → 立刻派 R3=r11

- 学习员交卷 `d73d4633`：N-46 sky-squad / N-47 模式芯片，对账 N-33/N-38 等已 ✅。水位约 1109/19330。
- 主干已含 r9+r10 A/B 修复。环境里已有 r11 测试员 A/B 在修 N-43/N-44/N-45，**本监督不加派测试员**。
- 学习员空闲，派 trio-r11 抽验（新文件，编号 N-48 起）。

### 第三拍定时器

`origin/game-1.3` 已含 r11 笔记（`24ea4590` N-52…N-57）与描红残留修复。本监督学习员仍在跑 r11；r11 测试员 A/B 与「学习员第12轮」已在途。**不加派。**

### 测试员 A 交卷 → 派 r11 剩余（避开 N-43/44 撞车）

- A `bc-12e9c82b-ba06-5589-b0d9-052fb59c3e57` r9 已合入。空闲后派执行 r11 playbook 剩余：S-4、N-16、L-3、C-6 推理关、N-47；**不重复**他人在途的 color-fun/竖式。

### 测试员 B 交卷 → 派 r11 对战新伤

- B 增量 N-15 / N-31 假人钮已进主干。空闲后派 N-52…N-57（duo-arena/坦克/跳垫双人/雪仗/天空小队热区/训练场开打）。N-45 若已合入则跳过。

### 测试员 A r11 剩余交卷 → 派 r12 壳层

- `6a013600`：S-4 直达、C-6 推理关、N-47。空闲后派 r12：N-59 收藏布局 / N-48 overlay / N-58 暂停套娃。

### 测试员 B r11 对战交卷 → 派 r12

- N-52…N-57 已合入。空闲后派 N-60/61/62 闯关键排与 N-2/3/4 视口返工。

### 学习员 r11 补测交卷 → 派 r14

- `30f00901` N-58。r12/r13 笔记已在树。空闲后派 **r14**（N-68 起），不覆盖 r12/r13。A/B 仍在 r12 修复。

### 测试员 A r12 壳层交卷 → 派 r13

- `41bddf5d` N-59/48/58。空闲后派 N-63 模式条、N-47 残留 40px、C-6 推理关浏览器、N-37 shape 深关。

### 测试员 B r12 闯关键交卷 → 派 r13 棋类分屏

- N-60/61/62、N-2/3/4 已合。空闲后派 N-64…N-67（军旗/暗棋/花园象棋/五子开局）。

### 学习员 r14 补测交卷 → 派 r16

- N-86 已进主干。r15 笔记已在树。空闲后派 **r16**（不覆盖 r14/r15）。r15 测试员已在途，本监督不加派测试员。

### 测试员 B r13 棋类交卷 → N-86（避开 r15 撞车）

- `121ea89` N-64…67 已合。同环境 **r15 tester B** 已在修 N-75…N-85，**不重复加派**同一批。
- 本工位 B 只做 r14 并行新伤 **N-86** 勇者大厅（≠ N-32）。已合：`7a2d560b` / 报告 `5f0def4e`。
- r16 笔记已在树（N-87/N-88）。**r16 tester B N-87 N-88** 与另一路 r15 B 均 RUNNING，本拍不再派 B。
- 主干亦含 r14 A：`87c5aff8` N-63/N-68/C-6/N-37/N-73。本监督 A 若空闲，也不重做这些号。

### 测试员 A r13 壳层交卷 → 不加派 N-77

- 本工位 A 已合 N-63/C-6/N-47/N-37/N-16（`215958e0`；主干记录 `45cb5d2f`）。N-68/N-73 由 r14 A 先合，勿重做。
- r16 playbook 给 A 的剩余是 **N-77** 小屋相册。同环境已有 **r15 tester A N-77**、**测试员A执行r15**、**r16 tester A leftover**，本拍 **不加派**。

### 学习员 r16 交卷 → 不加派 r17

- 笔记 N-87/N-88 已在树。**学习员第17轮抽验** 已 RUNNING。r18 等 r17 笔记合入后再派。本拍不加派学习员。

### 监督拍：PR #76 不合；合入 PR #78

- **PR #76**（r14 B N-69…N-74）`CONFLICTING`：主干已有 `duoWell.r14` / `boardFit.r14` 等源码，playbook 写明勿第二套。不合。
- **PR #79** N-47 漏网已在 `30cc10ab`，不合。
- **PR #78** MERGEABLE：N-75…N-85 矮横屏对局/闯关键，merge `8cbe0441`。
- 本监督槽位 A r4 / B r3 / C r8 仍 RUNNING，云 VM 满 3，不加派。
