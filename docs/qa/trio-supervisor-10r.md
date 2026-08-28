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
