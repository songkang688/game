# 1.4 窗口 1 统筹提示词 —— 壳层 / 框架 / 手感套件 + 学习与动手 9 款 + 本窗三轮验收 + 收官文档

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 1。不要拆开，不要摘要。窗口本体用你顺手的思考模型；工人一律 `claude-opus-5-5-xhigh-fast`。

请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是 **1.4 窗口 1 的统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己写代码。本窗口铁令：

1. **必须用 Task 转发**每一张工单（基建、每款 t1 / t2、每轮验收三人、帮别人时的每一格）。少派、自己动手改 `src/**`、把工人规格摘要成几句话，都算停工事故。
2. 你只许：Task 派工、`git` fetch / merge / rebase / push（禁 force）、写 `docs/qa/1.4/window1-status.md`、回复主管。
3. 工人**禁止再套娃 Task**；工人 prompt 必须保留「你就是执行者，禁止再派生任何子代理」。
4. **并发上限 6 个工人**。任何时刻保持 6 个在跑：有 IDLE 立刻合入并补派，有 ERROR 按同一范围补派，禁止 resume RUNNING，禁止重派在跑的格子。
5. 本窗做完立刻去帮最落后的窗口（第八节）。】

仓库：https://github.com/songkang688/game　产品：「一朵一星」（离线中文儿童小游戏合集，Vite + TypeScript + Canvas 2D，无框架、零运行时依赖）
集成分支：**`origin/game-1.4`**（从 `game-1.3` @ 1.3.4 砍出，已含全部 `docs/plan-1.4-*` 与 `.cursor/skills/gamedev/`）。你的本职分支：**`game-1.4-window1`**。
**不要改 `main` / `game-1.3`。不要 force push。不要用 `gh` 开 / 改 / 合 PR（只读可用）。**

## 五窗口总表（帮别人时对着找）

| 窗口 | 分支 | 主题 | 游戏数 | 粘贴文件 |
| --- | --- | --- | --- | --- |
| **1（你）** | `game-1.4-window1` | 壳层 / 框架 / 手感套件 + 学习与动手 | 9 + 2 基建 | `docs/plan-1.4-window1.md` |
| 2 | `game-1.4-window2` | 闯关动作 | 17 | `docs/plan-1.4-window2.md` |
| 3 | `game-1.4-window3` | 休闲益智 | 21 | `docs/plan-1.4-window3.md` |
| 4 | `game-1.4-window4` | 对战棋牌 | 19 | `docs/plan-1.4-window4.md` |
| 5 | `game-1.4-window5` | 纵深 / 伪 3D + 跑道套件 | 10 + 1 基建 | `docs/plan-1.4-window5.md` |

规格入口（工人要粘全文的文件）：总纲 `docs/plan-1.4-supervisor.md` · 单款工序 `docs/plan-1.4-worker-game.md` · 基建 `docs/plan-1.4-worker-feel-kit.md` · 验收 `docs/plan-1.4-worker-qa.md` · 登记表 `docs/plan-1.4-tracker.md`（主管维护，你只读）。

## 〇、开工顺序

1. `git fetch origin game-1.4` → `git checkout -B game-1.4-window1 origin/game-1.4`
2. 新建 `docs/qa/1.4/window1-status.md`（本窗工单清单 + 状态表，格式见 tracker 顶部），commit → `git push -u origin game-1.4-window1`（没有远端分支就派不出 `cloud_base_branch`）。
3. **立刻并行派第一波 6 个工人**（第五节）。不要等「想清楚再派」。

## 一、Task 参数（每次派工缺一不可）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选） |
| `cloud_base_branch` | `game-1.4-window1`（帮窗口 K 时 `game-1.4-windowK`） |
| `run_in_background` | `true` |
| `description` | `w1-infra-feel` / `w1-infra-frame` / `w1-<id>-t1` / `w1-<id>-t2` / `w1-r<轮>-tester|learner|fixer` |
| `prompt` | 第二节的 prompt 头 + 对应规格文件**全文**（已替换占位符）。禁止摘要。 |

**云端不可用**：改本地并发，但每个工人必须独立工作区——你执行 `git worktree add ..\yd-w1-<id> -b game-1.4-window1-<id> origin/game-1.4-window1`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window1-<id>`；IDLE 后你把该分支合进 `game-1.4-window1` 并 `git worktree remove`。禁止两个工人共用一个目录；本地并发时工人只跑定向测试，你合并后跑全量。

## 二、工人 prompt 头（随后粘规格全文）

### 2.1 单款工单（t1 / t2 / t2a / t2b）—— 随后粘 `docs/plan-1.4-worker-game.md` 全文（替换 `{{ID}}`、`{{WINDOW}}`=1、`{{BRANCH}}`=game-1.4-window1、`{{TICKET}}`）

```
请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window1。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个执行工人。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何子代理，必须自己动手把活干完。只推 `game-1.4-window1`，不改 main / game-1.3，不 force。只改 `src/games/<ID>/`（以及该款需要时在 `src/art/kit/` 新增带 `<ID>` 前缀的文件）；共享文件需求写需求单。存档 key / meta.id / 188 总数 / 章节边界 / parentAuth / parentGate / rootGate 不动。禁止 three.js 与任何新依赖。测试只增不减。】

仓库：https://github.com/songkang688/game　集成分支 origin/game-1.4　工作分支 game-1.4-window1
本款：<ID>　工单：<TICKET>
必读：docs/plan-1.4-supervisor.md 第一、二、五节；docs/plan-1.3-visual-bible.md；docs/ux-iteration-playbook.md 第〇、八、十四节；.cursor/skills/gamedev/*/SKILL.md；docs/qa/1.4/infra-feel.md（t2 时）。
—— 下面是本工单规格全文，一字不删 ——
```

### 2.2 基建工单（`w1-infra-feel` / `w1-infra-frame`）—— 随后粘 `docs/plan-1.4-worker-feel-kit.md` 全文

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window1`。本工单独占文件见规格；其他文件一个字不碰。这是全仓 71 款工序 D/E 的前置：先交最小可用版本并推送，再打磨。】

—— 下面是基建规格全文，一字不删 ——
```

### 2.3 验收三人（第 1–3 轮）—— 随后粘 `docs/plan-1.4-worker-qa.md` 全文（替换 `{{WINDOW}}`=1、`{{BRANCH}}`、`{{GAMES}}`、`{{ROUND}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window1`。只验 / 只学 / 只修本窗口游戏：clock-house find-diff math-farm pinyin-train shape-kingdom sudoku-petal word-garden color-fun music-stars。报告写到 docs/qa/1.4/window1-round<N>-<tester|learner|fixer>.md。别人的报告一个字不碰。】

—— 下面是验收规格全文，一字不删 ——
```

## 三、本窗口独占文件（只有你的工人能改）

`src/ui/**`、`src/styles.css`（末尾追加）、`src/games/level99.ts`、`src/games/quiz99.ts`、`src/games/speech.ts`、`src/games/__tests__/**`、`src/engine/**`（**不含** `view25d.ts`，那是窗口 5 的）、`src/art/kit/**`（含新建 `feel.ts`）、`scripts/qa/**`、`README.md`、`docs/release-notes/1.4.0.md`，以及 9 款游戏目录。
其他窗口会给你发「框架需求单」（他们写在各自 `docs/qa/1.4/window<K>-status.md` 的「给窗口 1」段，并由主管转给你）：你按需求单派一个 `w1-frame-<编号>` 工人（prompt 头同 2.2，正文粘需求单 + 总纲第五节），优先级高于本窗 t2。

## 四、本窗口游戏（9）与特殊注意

| id | 注意 |
| --- | --- |
| clock-house | quiz99 出题器；840 横屏钟面 `min(42vh,220px)` 守 `MIN_FACE_PX` |
| find-diff | 三图 / 旋转 / 镜像关的「不同」必须真可辨（像素差阈值测试） |
| math-farm | `runner.ts` 禁盲拷 500 档；答错只鼓励；分数小数题范围按年级 |
| pinyin-train | `scene.ts` / `timed.ts` 禁盲拷；多音字题库唯一正确答案校验 |
| shape-kingdom | 周长面积题数值不得出现非整数陷阱（除非该章明示） |
| sudoku-petal | 188 关每关唯一解（求解器计数 = 1）；人机对战档不卡死 |
| word-garden | `tracing.ts` 第二处花园 `10vh` 不盲拷；形近字 / 成语题库去重 |
| color-fun | 渐变 / 限色挑战的判定容差写成常量 + 测试 |
| music-stars | N-113 工具排已修勿回退；双声部节拍判定窗口 ≥ 120 ms |

学习类共同红线：答错只有鼓励；攻略侧栏不给答案；题库 seed 确定；三星门槛可调但一星通关不能白给。

## 五、派发波次（6 并发）

| 波 | 6 个槽 |
| --- | --- |
| 1 | `w1-infra-feel`、`w1-infra-frame`、`w1-clock-house-t1`、`w1-math-farm-t1`、`w1-sudoku-petal-t1`、`w1-music-stars-t1` |
| 2 | `w1-find-diff-t1`、`w1-pinyin-train-t1`、`w1-shape-kingdom-t1`、`w1-word-garden-t1`、`w1-color-fun-t1` + 1 个槽给主管转来的框架需求单（没有就开已完成 t1 且 feel 已推的款的 t2） |
| 3–4 | 9 款 `t2`（feel 套件已在本分支，可直接接） |
| 5 | 三轮验收（每轮 tester → learner + fixer），串行 |
| 6 | 收官：`w1-release-docs` 工人写 `docs/release-notes/1.4.0.md` 与 `README.md`「各版本加了什么」（等主管通知五窗全绿后才派） |

基建两张工单 **IDLE 且全绿后立刻回复主管**「feel / frame 已推 SHA ____，请合进 game-1.4」——其他四个窗口都在等它。

## 六、每张工单验收（通过才标完成、才派下一张）

```
[ ] 回复含：工单号、改了哪些文件、新增测试文件与用例数、审计结论、推送 SHA、模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test -- --testTimeout=180000 全绿且用例总数 ≥ 上一张水位；npm run build 全绿
[ ] t1：docs/qa/1.4/<id>-audit.md ≥ 12 条；levels.audit.test.ts 覆盖 188 关 × ≥3 种子或静态全覆盖，失败清单空；P0/P1 已修
[ ] t2：feel 契约测试（reduced 无位移 / 无 hit-stop）；五视口数字 HARD-OUT=0、热区 ≥44、正文 ≥16；宪法负面清单逐条「无」；素材契约 ≥ 8 例
[ ] git diff --name-only 不越界；商标 0 命中；无新依赖 / 二进制
```

工人 IDLE 且已有提交：fetch → 把工人提交合进 `game-1.4-window1`（云端模式下工人已直接推该分支，你只需 fetch 校验）→ 更新 `window1-status.md` → 立刻派下一张。

## 七、监督节奏

每 3–4 分钟（或 IDLE 通知）：`git fetch origin` → 列出 RUNNING / IDLE / ERROR → IDLE 合入并补派 → ERROR 同范围补派 → 回复主管：在跑几个、本轮派了谁、分支 SHA、下一张是什么、有无需求单要转。

## 八、本窗做完后必须去帮别人

本窗全部工单 + 三轮验收在 `game-1.4-window1` 全绿后：
1. `git fetch origin game-1.4-window2 game-1.4-window3 game-1.4-window4 game-1.4-window5`，读各窗 `docs/qa/1.4/window<K>-status.md`，找「未派」最多的窗口。
2. 仍然 Task 转发；工人 `cloud_base_branch` 与 prompt 分支改成 `game-1.4-windowK`；只帮没人在跑的款；派前再 fetch 一次，目录已有别人的 1.4 提交就换下一款。
3. 回复主管「窗口 1 空闲，正在帮窗口 K 的 <id>-t<k>」。五窗全部齐了才停，然后等主管通知派收官文档工人。
