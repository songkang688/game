# 1.3 窗口 1 统筹提示词 —— 窗口 1 · 第 1–4 步（共享基建 + 9 款） + 本窗三轮验收（+1） + 做完帮别人

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 1。不要拆开，不要再套一层摘要。
> 窗口模型选 **claude-opus-5-thinking-high-fast**。仓库基线选 **`game-1.3`**。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-opus-5-thinking-high-fast。
请在独立功能分支上进行修改，叫 game-1.3-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的**窗口 1 统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己画。1.2 窗口那种「禁止 Task、自己动手」已经作废。本窗口铁令：

1. **必须用 Task 转发**每一格实现、每一轮验收、以及你去帮别人时的每一格。少派一格、自己动手画、把工人提示词摘要成三句话，都算停工事故。
2. **禁止**自己修改 `src/games/**`、`src/art/**`、`src/ui/**` 里的视觉实现代码。你只许：Task 派工、git 合入/rebase/push、写 `docs/qa/1.3-window1-*` 登记、回复主管。
3. 工人（实现格 + 验收三人）**禁止再套娃 Task**。工人提示词必须保留：「你就是执行者，禁止再派生任何云端子代理」。
4. 主管要求：**时刻监督检查，有空的格子立刻派上去。本窗口做完立刻去帮还没做完的窗口。**】

仓库：https://github.com/songkang688/game
产品：「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）
主线：**`origin/game-1.3`**（从 `game-1.2` @ 1.2.2 开出，已含全部 `docs/plan-1.3-*` 与 `.cursor/skills/1.3-visual/`）。
你的本职分支：**`game-1.3-window1`**。
**不要改 `main`。不要改 `game-1.2`。不要改品牌分支 `1.2-kk`。不要 force push。不要用 `gh` 开/改/合 PR。**

## 八窗口总表（帮别人时对着这张表找格子）

| 窗口 | 分支 | 实现步 | 实现格 | 游戏 | 粘贴文件 |
| --- | --- | --- | --- | --- | --- |
| 1 | `game-1.3-window1` | 1–4（含 kit） | 12 | 9 | `docs/plan-1.3-window1.md` |
| 2 | `game-1.3-window2` | 5–7 | 9 | 9 | `docs/plan-1.3-window2.md` |
| 3 | `game-1.3-window3` | 8–10 | 9 | 9 | `docs/plan-1.3-window3.md` |
| 4 | `game-1.3-window4` | 11–13 | 9 | 9 | `docs/plan-1.3-window4.md` |
| 5 | `game-1.3-window5` | 14–16 | 9 | 10（15-C 一份两款） | `docs/plan-1.3-window5.md` |
| 6 | `game-1.3-window6` | 17–19 | 9 | 9 | `docs/plan-1.3-window6.md` |
| 7 | `game-1.3-window7` | 20–22 | 9 | 9 | `docs/plan-1.3-window7.md` |
| 8 | `game-1.3-window8` | 23–26 | 12 | 12 | `docs/plan-1.3-window8.md` |

合计 78 个实现格（76 款 + 窗口 1 的 3 格基建）+ 每窗 1 个验收包（三轮 × 测试员/学习优化员/监督修复员 = 9 份报告）。不要派全局第 27–29 步去验 76 款全集。

## 〇、开工顺序（先有分支，再转发；禁止先画）

1. `git fetch origin game-1.3`
2. `git checkout -B game-1.3-window1 origin/game-1.3`
3. 只写 docs 的「窗口1 · 1.3 视觉统筹计划」commit（可放 `docs/qa/1.3-window1-plan.md` 列本窗格子），**不改游戏代码**。
4. `git push -u origin game-1.3-window1` —— 没有远端分支就派不出 `cloud_base_branch`。
5. **立刻 Task 转发本清单第一步的 A/B/C 三个工人（并行、后台）。** 不要等「想清楚再派」。有空就排上去。
6. 之后全程：有空格就派，有 IDLE 就合入，有 ERROR 就按同一范围补派一格。禁止 resume RUNNING。

## 一、必须转发：Task 参数（缺一不可）

每一次派工都调用 **Task**，不要自己写实现，不要把活丢回主管。参数固定：

| 参数 | 实现格（画师） | 验收三人（测试员 / 学习优化员 / 监督修复员） |
| --- | --- | --- |
| `subagent_type` | `generalPurpose` | `generalPurpose` |
| `environment` | `cloud`（工人必须独立工作区） | `cloud` |
| `model` | `claude-fable-5-thinking-xhigh`（不要方括号） | `claude-opus-5-thinking-high-fast`（不要方括号） |
| `cloud_base_branch` | 本职工作时填 `game-1.3-window1`；帮窗口 K 时填 `game-1.3-windowK` | 同左 |
| `run_in_background` | `true`（一步三格必须同时派） | 测试员可先单独派；学习优化员与监督修复员等测试员 IDLE 后再并行 |
| `description` | `w1-s<步>-<A\|B\|C>-<id>` 这种短名 | `w1-r<轮>-tester` / `learner` / `fixer` |
| `prompt` | **下面「角色 2」模板 + 对应 `docs/plan-1.3-step*.md` 全文**（已做替换）。禁止缩写成摘要。 | **下面角色 3/4/5 模板全文**。禁止缩写。 |

派不出 cloud 就改 `cloud_base_branch` 为 `game-1.3`，并在工人 prompt 里第一句写死：立刻 `checkout -B` 目标窗口分支并只往那推。

**禁止：** resume RUNNING；重派还在跑的格子；同一 `src/games/<id>/` 同时派两个工人；工人 prompt 里再叫他 Task。

## 二、角色 2 · 实现工人 prompt 头（每次转发必须带，随后粘 step 全文）

把下面这段放在 Task `prompt` 最前面，然后**整份**粘上对应 `docs/plan-1.3-step*.md`。粘之前三处替换：所有 `game-1.2-kk` → 目标分支（本职是 `game-1.3-window1`，帮人是 `game-1.3-windowK`）；基线 → `origin/game-1.3`；防套娃段保留为执行者、禁止再 Task。

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.3-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.3-window1`，不要改 main / game-1.2 / 1.2-kk，不要 force。本格只改视觉，不改玩法数值与 parentAuth / parentGate。禁止 three.js。】
```

帮窗口 K 时把上面的 `game-1.3-window1` 全部改成 `game-1.3-windowK`。step 正文里的独占文件、测试下限、宪法对照，一字不删。

## 三、规格入口

- 宪法：`docs/plan-1.3-visual-bible.md`
- 总目录：`docs/plan-1.3-index.md`
- 主管红线：`docs/plan-1.3-supervisor.md`
- skills：`.cursor/skills/1.3-visual/`
- 转发模板合集：`docs/plan-1.3-roles.md`
- 本窗口点名：无必升伪 3D 点名款；第 1 步 kit / 布局 / runner 必须先于本窗游戏落地。

只改视觉。玩法 / 关卡数值 / 胜负 / `parentAuth.ts` / `parentGate.ts` 一律不碰。禁止 three.js。

## 四、文件所有权（本职阶段）

本职阶段**只改本窗口清单里的路径。** 别人的 `src/games/<id>/` 一个字都不要碰。去帮别人时，只碰那一格点名的目录。

- `src/styles.css`：只允许在末尾追加本格选择器。
- `src/art/kit/`：只 **新增** 本格自己的文件；已有文件只 import。窗口 1 的 step1 kit / `src/art/runner/` 未合入前，其他窗口工人按 step 文档用绘制回调，禁止复制窗口 1 的代码。
- 测试红在别人文件里：写进回复交给主管，自己不越界。

本窗口游戏 id：`orb-arena snake-royale block-drop combo-clash mahjong-bloom star-estate hero-cards weiqi-garden flight-chess`

## 五、本窗口任务清单（先实现格，全部 IDLE 后再 +1 验收）

实现格数：**12**。按步号顺序派。每步 A/B/C **同时** Task 三个工人。

### 第 1 步 · 共享视觉基建（3 格）——必须最先并行派完，别的窗口会消费 kit / runner

| 档 | 主题 | 规格文件 |
| --- | --- | --- |
| A | 共享角色与道具 `src/art/kit/` | `docs/plan-1.3-step1-A-art-kit.md` |
| B | 首页 / 关卡壳 / 结算布局动效 | `docs/plan-1.3-step1-B-layout-motion.md` |
| C | 跑酷跑道 2.5D·3D 套件 `src/art/runner/` | `docs/plan-1.3-step1-C-3d-runner.md` |

**窗口 1 独占：** `src/art/kit/` 里 step1 落下的文件、`src/art/runner/`、step1-B 点名的 `src/ui/**` 布局动效与相关 CSS。其他窗口只许 **新增** 自己的 `src/art/kit/<自己的文件>.ts`，不许改你已经推上去的 kit / runner。

### 第 2 步 · 视觉升级（3 格）

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `orb-arena` | `docs/plan-1.3-step2-A-orb-arena.md` |
| B | `snake-royale` | `docs/plan-1.3-step2-B-snake-royale.md` |
| C | `block-drop` | `docs/plan-1.3-step2-C-block-drop.md` |

### 第 3 步 · 视觉升级（3 格）

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `combo-clash` | `docs/plan-1.3-step3-A-combo-clash.md` |
| B | `mahjong-bloom` | `docs/plan-1.3-step3-B-mahjong-bloom.md` |
| C | `star-estate` | `docs/plan-1.3-step3-C-star-estate.md` |

### 第 4 步 · 视觉升级（3 格）

| 档 | id | 规格文件 |
| --- | --- | --- |
| A | `hero-cards` | `docs/plan-1.3-step4-A-hero-cards.md` |
| B | `weiqi-garden` | `docs/plan-1.3-step4-B-weiqi-garden.md` |
| C | `flight-chess` | `docs/plan-1.3-step4-C-flight-chess.md` |

工人 IDLE 且已有提交：把工人的视觉文件合进目标窗口分支（禁止 `--force`）。冲突时保留**该格所属窗口**的文件。一格验收：`npm test` 与 `npm run build` 全绿、独占目录没越界、商标扫描 0 命中、素材契约测试只增不减、对照视觉宪法没有火柴人/平涂金币。通过才标完成，立刻派下一空格。

## 六、+1 包 · 本窗口三轮视觉验收（实现全部完成后才派，仍然必须转发）

这是任务数 +1，不是全局 27–29。实现格全部 IDLE、测试构建全绿之后才开始。

每轮 3 个云端子代理。模型：`claude-opus-5-thinking-high-fast`。同一轮：先派**角色 3 测试员**；IDLE 交出报告后再并行派**角色 4 学习优化员**与**角色 5 监督修复员**（修复员 prompt 必须写明本轮测试报告路径）。三轮串行。

规格参照（读思路，改分支与报告路径，**整份转发，禁止摘要**）：

- `docs/plan-1.3-step27-A-tester.md` / `B-learner.md` / `C-fixer.md`
- 第 2、3 轮对照 `docs/plan-1.3-step28-*.md`、`docs/plan-1.3-step29-*.md`

替换：`game-1.2-kk` → `game-1.3-window1`；范围改成**仅本窗口游戏** `orb-arena snake-royale block-drop combo-clash mahjong-bloom star-estate hero-cards weiqi-garden flight-chess`；报告必须写成：

```
docs/qa/1.3-window1-round1-tester.md
docs/qa/1.3-window1-round1-learner.md
docs/qa/1.3-window1-round1-fixer.md
docs/qa/1.3-window1-round2-tester.md
docs/qa/1.3-window1-round2-learner.md
docs/qa/1.3-window1-round2-fixer.md
docs/qa/1.3-window1-round3-tester.md
docs/qa/1.3-window1-round3-learner.md
docs/qa/1.3-window1-round3-fixer.md
```

验收只验视觉（宪法负面清单、金币体积、双人可区分、2.5D、360px、商标）。不重开 188 关玩法验收。工人仍然禁止再 Task。

### 角色 3 · 测试员 prompt 头（随后粘 step27-A 全文并改范围）

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-opus-5-thinking-high-fast。
请在独立功能分支上进行修改，叫 game-1.3-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `game-1.3-window1`。只验本窗口游戏：orb-arena snake-royale block-drop combo-clash mahjong-bloom star-estate hero-cards weiqi-garden flight-chess。报告写到 docs/qa/1.3-window1-round<N>-tester.md。不要碰别人的报告文件。只验视觉，不重开玩法。】
```

### 角色 4 · 学习优化员 prompt 头

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-opus-5-thinking-high-fast。
请在独立功能分支上进行修改，叫 game-1.3-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `game-1.3-window1`。只评估本窗口游戏：orb-arena snake-royale block-drop combo-clash mahjong-bloom star-estate hero-cards weiqi-garden flight-chess。报告写到 docs/qa/1.3-window1-round<N>-learner.md。只学画面密度与角色剪影，不入库任何参考截图，不改绘制代码。】
```

### 角色 5 · 监督修复员 prompt 头

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-opus-5-thinking-high-fast。
请在独立功能分支上进行修改，叫 game-1.3-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `game-1.3-window1`。只修本窗口游戏视觉：orb-arena snake-royale block-drop combo-clash mahjong-bloom star-estate hero-cards weiqi-garden flight-chess。先读 docs/qa/1.3-window1-round<N>-tester.md（以及已有的 learner 报告）。报告写到 docs/qa/1.3-window1-round<N>-fixer.md。一行玩法逻辑都不许动。】
```

## 七、监督检查节奏

每 3–4 分钟（或子代理 IDLE 通知）执行一遍：

1. `git fetch origin`（至少 `game-1.3-window1`，本职做完后 8 个窗口分支都 fetch）。
2. 列出已派代理：RUNNING / IDLE / ERROR。
3. IDLE：合入目标分支，标完成，**立刻派下一空格**（本职没做完派本职；本职做完派别人的空格）。
4. RUNNING：等。禁止 resume。禁止重派。
5. ERROR：只按同一范围同一 slug 补派失败那一格。
6. 回复主管写清：在跑几个、本轮派了谁、分支 SHA、下一格是什么。若已在帮别人，写清帮的是窗口几、哪一格。

## 八、本窗口做完后必须去帮别人（机动统筹）

本窗口 12 个实现格 + 9 份验收报告都在 `game-1.3-window1`，且 `npm test` / `npm run build` 全绿之后，**不准停机等指令**。你立刻变成机动统筹：

1. `git fetch origin game-1.3-window1 game-1.3-window2 game-1.3-window3 game-1.3-window4 game-1.3-window5 game-1.3-window6 game-1.3-window7 game-1.3-window8`
2. 打开还没结束的窗口的 `docs/plan-1.3-windowK.md`，对照远端分支缺哪一格（没有合入的 step 文件 / 游戏目录 / qa 报告）。
3. **优先帮最落后的窗口**（实现格完成数最少的）。实现没完就帮实现格；实现完了验收没完就帮他派验收三人。
4. **仍然必须 Task 转发**，禁止你自己画。工人的 `cloud_base_branch` 和 prompt 里的分支改成 **`game-1.3-windowK`（被帮窗口）**，不要推到你自己的 `game-1.3-window1`。
5. **禁止抢 RUNNING 的格子。禁止两个机动窗口同时派同一 `src/games/<id>/`。** 派之前再 fetch 一次；目录已有别人的 1.3 视觉提交就换下一格。
6. 窗口 1 的 step1 kit / runner / 布局：只有确认那一格还没人跑、远端也没有对应文件时才帮；不要覆盖窗口 1 已经推上去的 kit。
7. 帮完一格就合进 `game-1.3-windowK`，再找下一个最慢窗口。回复主管：「窗口 1 本职已空闲，正在帮窗口 K 的 stepX-Y」。
8. 八个窗口的实现格和验收包都齐了，才停。回复主管：全部窗口已空闲。不要派全局 27–29，不要改 `game-1.3` 主线（合回是主管的事），不要开始没点名的美术范围。

