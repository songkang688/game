# 1.4 窗口 5 统筹提示词 —— 纵深 / 伪 3D 10 款 + 跑道套件统一 + 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 5。不要拆开，不要摘要。窗口本体用你顺手的思考模型；工人一律 `claude-opus-5-5-xhigh-fast`。

请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window5。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是 **1.4 窗口 5 的统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己写代码。本窗口铁令：

1. **必须用 Task 转发**每一张工单（基建、每款 t1 / t2 / t3、每轮验收三人、帮别人时的每一格）。少派、自己动手改 `src/**`、把工人规格摘要成几句话，都算停工事故。
2. 你只许：Task 派工、`git` fetch / merge / rebase / push（禁 force）、写 `docs/qa/1.4/window5-status.md`、回复主管。
3. 工人**禁止再套娃 Task**；工人 prompt 必须保留「你就是执行者，禁止再派生任何子代理」。
4. **并发上限 6 个工人**。任何时刻保持 6 个在跑：有 IDLE 立刻合入并补派，有 ERROR 按同一范围补派，禁止 resume RUNNING，禁止重派在跑的格子。
5. **真 3D（three.js / 任何 WebGL 库）禁止**；「升 3D」= 宪法第五节的伪 3D 观感档，全部走 `src/engine/view25d.ts` + `src/art/runner/`。
6. 本窗做完立刻去帮最落后的窗口（第八节）。】

仓库：https://github.com/songkang688/game　产品：「一朵一星」（离线中文儿童小游戏合集，Vite + TypeScript + Canvas 2D，无框架、零运行时依赖）
集成分支：**`origin/game-1.4`**（从 `game-1.3` @ 1.3.4 砍出，已含全部 `docs/plan-1.4-*` 与 `.cursor/skills/gamedev/`）。你的本职分支：**`game-1.4-window5`**。
**不要改 `main` / `game-1.3`。不要 force push。不要用 `gh` 开 / 改 / 合 PR（只读可用）。**

## 五窗口总表（帮别人时对着找）

| 窗口 | 分支 | 主题 | 游戏数 | 粘贴文件 |
| --- | --- | --- | --- | --- |
| 1 | `game-1.4-window1` | 壳层 / 框架 / 手感套件 + 学习与动手 | 9 + 2 基建 | `docs/plan-1.4-window1.md` |
| 2 | `game-1.4-window2` | 闯关动作 | 17 | `docs/plan-1.4-window2.md` |
| 3 | `game-1.4-window3` | 休闲益智 | 21 | `docs/plan-1.4-window3.md` |
| 4 | `game-1.4-window4` | 对战棋牌 | 19 | `docs/plan-1.4-window4.md` |
| **5（你）** | `game-1.4-window5` | 纵深 / 伪 3D + 跑道套件 | 10 + 1 基建 | `docs/plan-1.4-window5.md` |

规格入口：总纲 `docs/plan-1.4-supervisor.md` · 单款工序 `docs/plan-1.4-worker-game.md` · 跑道统一 `docs/plan-1.4-worker-runner-kit.md` · 纵深工单 `docs/plan-1.4-worker-depth.md` · 验收 `docs/plan-1.4-worker-qa.md` · 登记表 `docs/plan-1.4-tracker.md`（只读）。

## 〇、开工顺序

1. `git fetch origin game-1.4` → `git checkout -B game-1.4-window5 origin/game-1.4`
2. 新建 `docs/qa/1.4/window5-status.md`（基建 + 10 款 × t1/t2/t3 状态表），commit → `git push -u origin game-1.4-window5`。
3. **立刻并行派第一波 6 个**：`w5-infra-runner` + 5 个 t1（第五节）。

## 一、Task 参数（每次派工缺一不可）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选） |
| `cloud_base_branch` | `game-1.4-window5`（帮窗口 K 时 `game-1.4-windowK`） |
| `run_in_background` | `true` |
| `description` | `w5-infra-runner` / `w5-<id>-t1` / `-t2` / `-t3` / `w5-r<轮>-tester|learner|fixer` |
| `prompt` | 第二节 prompt 头 + 对应规格文件**全文**（已替换占位符）。禁止摘要。 |

**云端不可用**：改本地并发，但每个工人必须独立工作区——你执行 `git worktree add ..\yd-w5-<id> -b game-1.4-window5-<id> origin/game-1.4-window5`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window5-<id>`；IDLE 后你把该分支合进 `game-1.4-window5` 并 `git worktree remove`。禁止两个工人共用一个目录；本地并发时工人只跑定向测试，你合并后跑全量。

## 二、工人 prompt 头（随后粘规格全文）

### 2.1 基建工单 `w5-infra-runner` —— 随后粘 `docs/plan-1.4-worker-runner-kit.md` 全文

```
请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window5。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个执行工人。你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window5`，不改 main / game-1.3，不 force。本工单独占文件见规格（engine/view25d.ts 只加不删、art/runner/**、四款的 view3d.ts / view25d.ts / depth12.ts 适配文件）；四款的 index.ts / logic.ts / levels.ts 不碰。禁止 three.js 与任何新依赖。玩法坐标一个数不动，现有逻辑测试一条不改且全绿。】

—— 下面是基建规格全文，一字不删 ——
```

### 2.2 单款工单 t1 / t2 —— 随后粘 `docs/plan-1.4-worker-game.md` 全文（替换 `{{ID}}`、`{{WINDOW}}`=5、`{{BRANCH}}`=game-1.4-window5、`{{TICKET}}`）

```
（同 2.1 的四行口令）

【读到这段话的你，就是被派发的那个执行工人。你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window5`，不改 main / game-1.3，不 force。只改 `src/games/<ID>/`（以及需要时在 `src/art/kit/` 新增带 `<ID>` 前缀的文件）；**本款的 view3d.ts / view25d.ts / depth12.ts 在 `w5-infra-runner` 合入前不碰**；`src/ui/**`、`src/styles.css`、`level99.ts`、`src/engine/**`（含 view25d.ts）、`src/art/runner/**` 一个字不碰，需求写需求单。存档 key / meta.id / 188 总数 / 章节边界 / parentAuth / parentGate / rootGate 不动。禁止 three.js 与任何新依赖。测试只增不减。】

仓库：https://github.com/songkang688/game　集成分支 origin/game-1.4　工作分支 game-1.4-window5
本款：<ID>　工单：<TICKET>
必读：docs/plan-1.4-supervisor.md 第一、二、三、五节；docs/plan-1.3-visual-bible.md（第五节分级）；docs/ux-iteration-playbook.md 第〇、八、十四节；.cursor/skills/gamedev/*/SKILL.md；docs/qa/1.4/infra-feel.md（t2 时，若 origin/game-1.4 上还没有就先做 E/F 并在回复里写明 D 待接）。
—— 下面是本工单规格全文，一字不删 ——
```

### 2.3 纵深工单 t3 —— 随后粘 `docs/plan-1.4-worker-depth.md` 全文（替换 `{{ID}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window5`。前置：本分支已含 w5-infra-runner（没有就停下回复窗口，不要自己造透视）。只改 `src/games/<ID>/`；`src/art/runner/**` 与 `engine/view25d.ts` 若缺能力写需求单给窗口自己的 `w5-runner-<编号>` 补丁工单，不在游戏目录里复制一份。玩法坐标不动，flat 等价测试必须有。禁止 three.js。】

—— 下面是纵深规格全文，一字不删 ——
```

### 2.4 验收三人（第 1–3 轮）—— 随后粘 `docs/plan-1.4-worker-qa.md` 全文（替换 `{{WINDOW}}`=5、`{{BRANCH}}`、`{{GAMES}}`、`{{ROUND}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window5`。只验 / 只学 / 只修本窗口游戏：rainbow-run duo-rush red-blue-race bumper-cars bowling-lane poop-hero hop-pads gold-hook sling-birds snow-fight，以及 src/art/runner/** 与 src/engine/view25d.ts。报告写到 docs/qa/1.4/window5-round<N>-<tester|learner|fixer>.md。别人的报告一个字不碰。】

—— 下面是验收规格全文，一字不删 ——
```

## 三、本窗口独占文件

`src/art/runner/**`、`src/engine/view25d.ts`（只加不删）、10 款游戏目录、`docs/qa/1.4/<id>-*.md`、`docs/qa/1.4/window5-*.md`、`docs/qa/1.4/infra-runner.md`。`src/art/kit/` 只许新增 `<id>-*.ts`。
其他窗口若在工序 A 里把某款定级为 2.5D 并经主管拍板转来，你派 `w5-<id>-t3`（工人分支仍推 **该款所属窗口的分支**，只改该款目录，只 import 套件）。

## 四、本窗口游戏（10）与特殊注意

| id | 工序 B 审计要点 | 纵深定级 | 既有号 / 注意 |
| --- | --- | --- | --- |
| rainbow-run | 已有 `runCampaign`（`logic.test.ts`）：换种子 `[7,11,13]` 复跑；无尽速度曲线上限 | 伪 3D（全套） | `view3d.ts` 由基建适配；`PROGRESS_KEY` 不改 |
| duo-rush | **无战役**：无尽 / 抢金币 / 幽灵 / 人机四模式「可开局、可结束、不卡死」模拟；人机档单调 | 伪 3D（分屏双相机） | 让分芯片在台账（滚得到）；`.dr-keys` 不隐藏 |
| red-blue-race | 水坑 / 栏架间距 ≥ 孩子连点节奏可跨；188 关 | 2.5D → 伪 3D | A/B 可分 |
| bumper-cars | 每关对手数 / 场地下可顶出得分 | 2.5D | |
| bowling-lane | 蓄力 / 落点 / 旋转三段投球可全中；188 关计分目标可达 | 2.5D | U-13 已修勿回退 |
| poop-hero | 横版跳跃段用玩家度量（跳高 / 跳远）校验每关间隙；俯冲段落点可达 | 伪 3D（仅俯冲段） | 620 档只加 `840 && min-height:621` 轻钳 |
| hop-pads | 蓄力 → 距离映射下每关跳台可达且不过跳 | 2.5D | |
| gold-hook | 每关金块 / 钻石 / 宝箱总值 ≥ 目标；重量 / 回收速度下时限可达 | 2.5D（已有 depth12） | 双钩手 A/B；`depth12.ts` 由基建适配 |
| sling-birds | 弹弓力度 / 角度下每关积木塔可倒（物理模拟） | 2.5D（已有 depth12） | `depth12.ts` 由基建适配 |
| snow-fight | 风向 / 抛物线下每关可命中 | 2.5D | N-55 已修勿回退 |

## 五、派发波次（6 并发）

| 波 | 6 个槽 |
| --- | --- |
| 1 | `w5-infra-runner`（独占 rainbow-run / duo-rush / gold-hook / sling-birds 四目录期间）、`red-blue-race-t1`、`bumper-cars-t1`、`bowling-lane-t1`、`hop-pads-t1`、`snow-fight-t1` |
| 2 | `poop-hero-t1`、基建 IDLE 后：`rainbow-run-t1`、`duo-rush-t1`、`gold-hook-t1`、`sling-birds-t1` + 1 个 `t2`（t1 已完成且 `origin/game-1.4` 已含 feel 套件的款；没有就先做 E/F） |
| 3–4 | 10 款 `t2` |
| 5–6 | 10 款 `t3`（基建已在本分支；每款一个工人；rainbow-run 与 duo-rush 最后派，因为它们要吃到前面几款喂给套件的补丁） |
| 7 | 三轮验收（每轮 tester → learner + fixer），串行 |

`w5-infra-runner` **IDLE 且全绿后立刻回复主管**「runner 统一已推 SHA ____，请合进 game-1.4」——其他窗口的 2.5D 定级款在等它。

## 六、每张工单验收（通过才标完成、才派下一张）

```
[ ] 回复含：工单号、改了哪些文件、新增测试文件与用例数、审计结论、推送 SHA、模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test -- --testTimeout=180000 全绿且用例总数 ≥ 上一张水位；npm run build 全绿
[ ] infra：四款私有透视已变薄适配层；`noPrivatePerspective.test.ts` 存在；四款现有测试零改动全绿；替换前后截图像素差 < 2% 或有说明
[ ] t1：audit ≥ 12 条；levels.audit.test.ts 覆盖 188 关 × ≥3 种子（无战役款做模式模拟），失败清单空；P0/P1 已修
[ ] t2：feel 契约；五视口 HARD-OUT=0、热区 ≥44、正文 ≥16；宪法负面清单逐条「无」；素材契约 ≥ 8 例
[ ] t3：四件套齐（+ 伪 3D 两件按定级）；reduced 降级测试；flat 等价测试；rAF p95 ≤ 20 ms 数字；无位图
[ ] git diff --name-only 不越界；商标 0 命中；无新依赖 / 二进制
```

## 七、监督节奏

每 3–4 分钟（或 IDLE 通知）：`git fetch origin` → RUNNING / IDLE / ERROR → IDLE 校验合入并补派 → ERROR 同范围补派 → 回复主管：在跑几个、本轮派了谁、SHA、下一张、需求单（含其他窗口转来的 2.5D 定级款）。

## 八、本窗做完后必须去帮别人

本窗基建 + 10 款 t1/t2/t3 与三轮验收在 `game-1.4-window5` 全绿后：fetch 其他四个窗口分支与 `docs/qa/1.4/window<K>-status.md`，帮「未派」最多的窗口。**先向主管要格**：回复「申请代派 w<K>-<id>-t<k>」，等主管在 `docs/plan-1.4-tracker.md` 标「在跑（窗口 5 代）」后才许派，没登记就派 = 重派事故。仍然 Task 转发；工人分支改成 `game-1.4-windowK`；派前再 fetch；回复主管「窗口 5 正在帮窗口 K 的 <id>-t<k>」。五窗全部齐了才停。
