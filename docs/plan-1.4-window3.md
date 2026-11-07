# 1.4 窗口 3 统筹提示词 —— 休闲益智 21 款 + 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 3。不要拆开，不要摘要。窗口本体用你顺手的思考模型；工人一律 `claude-opus-5-5-xhigh-fast`。

请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window3。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是 **1.4 窗口 3 的统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己写代码。本窗口铁令：

1. **必须用 Task 转发**每一张工单（每款 t1 / t2、每轮验收三人、帮别人时的每一格）。少派、自己动手改 `src/**`、把工人规格摘要成几句话，都算停工事故。
2. 你只许：Task 派工、`git` fetch / merge / rebase / push（禁 force）、写 `docs/qa/1.4/window3-status.md`、回复主管。
3. 工人**禁止再套娃 Task**；工人 prompt 必须保留「你就是执行者，禁止再派生任何子代理」。
4. **并发上限 6 个工人**。任何时刻保持 6 个在跑：有 IDLE 立刻合入并补派，有 ERROR 按同一范围补派，禁止 resume RUNNING，禁止重派在跑的格子。
5. 本窗做完立刻去帮最落后的窗口（第八节）。】

仓库：https://github.com/songkang688/game　产品：「一朵一星」（离线中文儿童小游戏合集，Vite + TypeScript + Canvas 2D，无框架、零运行时依赖）
集成分支：**`origin/game-1.4`**（从 `game-1.3` @ 1.3.4 砍出，已含全部 `docs/plan-1.4-*` 与 `.cursor/skills/gamedev/`）。你的本职分支：**`game-1.4-window3`**。
**不要改 `main` / `game-1.3`。不要 force push。不要用 `gh` 开 / 改 / 合 PR（只读可用）。**

## 五窗口总表（帮别人时对着找）

| 窗口 | 分支 | 主题 | 游戏数 | 粘贴文件 |
| --- | --- | --- | --- | --- |
| 1 | `game-1.4-window1` | 壳层 / 框架 / 手感套件 + 学习与动手 | 9 + 2 基建 | `docs/plan-1.4-window1.md` |
| 2 | `game-1.4-window2` | 闯关动作 | 17 | `docs/plan-1.4-window2.md` |
| **3（你）** | `game-1.4-window3` | 休闲益智 | 21 | `docs/plan-1.4-window3.md` |
| 4 | `game-1.4-window4` | 对战棋牌 | 19 | `docs/plan-1.4-window4.md` |
| 5 | `game-1.4-window5` | 纵深 / 伪 3D + 跑道套件 | 10 + 1 基建 | `docs/plan-1.4-window5.md` |

规格入口：总纲 `docs/plan-1.4-supervisor.md` · 单款工序 `docs/plan-1.4-worker-game.md` · 验收 `docs/plan-1.4-worker-qa.md` · 登记表 `docs/plan-1.4-tracker.md`（只读）。

## 〇、开工顺序

1. `git fetch origin game-1.4` → `git checkout -B game-1.4-window3 origin/game-1.4`
2. 新建 `docs/qa/1.4/window3-status.md`（本窗 21 款 × t1/t2 状态表），commit → `git push -u origin game-1.4-window3`。
3. **立刻并行派第一波 6 个 t1**（第五节）。

## 一、Task 参数（每次派工缺一不可）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选） |
| `cloud_base_branch` | `game-1.4-window3`（帮窗口 K 时 `game-1.4-windowK`） |
| `run_in_background` | `true` |
| `description` | `w3-<id>-t1` / `w3-<id>-t2` / `w3-r<轮>-tester|learner|fixer` |
| `prompt` | 第二节 prompt 头 + 对应规格文件**全文**（已替换占位符）。禁止摘要。 |

**云端不可用**：改本地并发，但每个工人必须独立工作区——你执行 `git worktree add ..\yd-w3-<id> -b game-1.4-window3-<id> origin/game-1.4-window3`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window3-<id>`；IDLE 后你把该分支合进 `game-1.4-window3` 并 `git worktree remove`。禁止两个工人共用一个目录；本地并发时工人只跑定向测试，你合并后跑全量。

## 二、工人 prompt 头（随后粘规格全文）

### 2.1 单款工单（t1 / t2）—— 随后粘 `docs/plan-1.4-worker-game.md` 全文（替换 `{{ID}}`、`{{WINDOW}}`=3、`{{BRANCH}}`=game-1.4-window3、`{{TICKET}}`）

```
请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window3。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个执行工人。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何子代理，必须自己动手把活干完。只推 `game-1.4-window3`，不改 main / game-1.3，不 force。只改 `src/games/<ID>/`（以及该款需要时在 `src/art/kit/` 新增带 `<ID>` 前缀的文件）；`src/ui/**`、`src/styles.css`、`level99.ts`、`src/engine/**`、`src/art/runner/**` 一个字不碰，需求写需求单。存档 key / meta.id / 188 总数 / 章节边界 / parentAuth / parentGate / rootGate 不动。禁止 three.js 与任何新依赖。测试只增不减。】

仓库：https://github.com/songkang688/game　集成分支 origin/game-1.4　工作分支 game-1.4-window3
本款：<ID>　工单：<TICKET>
必读：docs/plan-1.4-supervisor.md 第一、二、五节；docs/plan-1.3-visual-bible.md；docs/ux-iteration-playbook.md 第〇、八、十四节（**高度反推钳**是本窗主配方）；.cursor/skills/gamedev/*/SKILL.md（**procedural-gen 是本窗重点**）；docs/qa/1.4/infra-feel.md（t2 时，若 origin/game-1.4 上还没有就先做 E/F 并在回复里写明 D 待接）。
—— 下面是本工单规格全文，一字不删 ——
```

### 2.2 验收三人（第 1–3 轮）—— 随后粘 `docs/plan-1.4-worker-qa.md` 全文（替换 `{{WINDOW}}`=3、`{{BRANCH}}`、`{{GAMES}}`、`{{ROUND}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window3`。只验 / 只学 / 只修本窗口游戏：alien-seek balloon-pop block-drop brick-break bubble-aim bubble-pop fishing-star fruit-catch fruit-stack kitty-care lianliankan match-stars memory-cards merge-2048 mine-garden mole-pop pool-stars puzzle-tiles shoot-range snake-snack tap-tiles。报告写到 docs/qa/1.4/window3-round<N>-<tester|learner|fixer>.md。别人的报告一个字不碰。】

—— 下面是验收规格全文，一字不删 ——
```

## 三、本窗口所有权

只有 21 款游戏目录 `src/games/<id>/`（含其测试）与 `docs/qa/1.4/<id>-*.md`、`docs/qa/1.4/window3-*.md`。`src/art/kit/` 只许新增 `<id>-*.ts`。要动共享文件 → 在 `window3-status.md` 的「给窗口 1 / 给窗口 5」段写需求单。

## 四、本窗口游戏（21）与特殊注意（工序 B 审计要点 / 禁改常量）

| id | 188 关审计要点 | 禁改 / 既有号 |
| --- | --- | --- |
| alien-seek | 限时找物：目标物在时限内可找到（视觉可辨阈值）；推理关线索闭合 | C-6 pads 验收基线在 playbook |
| balloon-pop | 颜色 / 数字顺序关每关必有合法顺序 | **`SKY_H=420` 禁改**；飞行气球在降级台账，只许「滚得到」口径 |
| block-drop | 七种方块序列（seed）下每关行数目标可达 | 已用 `view25d` 的 reduced 工具，别拆 |
| brick-break | 每关砖阵可清空（球速 / 挡板宽度） | L1 画布底切在台账；物理 / 球速零触碰；`canvasDisplayCapPx` 思路 |
| bubble-aim | 三消泡泡阵每关可清 | |
| bubble-pop | 重力翻转 / 变色 / 限步关：限步 ≥ 最优解步数 ×1.3（求解器） | |
| fishing-star | 已有 `runCampaign`：换种子 `[7,11,13]` 复跑；水层 / 张力条可达 | |
| fruit-catch | 水果雨密度下目标可接；双人抢果公平 | `canvasDisplayCapPx` / `MIN_CANVAS_DISPLAY_PX=160` 是配方源，别改 |
| fruit-stack | 叠落堆高目标在重力 / 容器下可达 | |
| kitty-care | 养成数值：每关任务在时长内可完成，无负反馈循环 | |
| lianliankan | **每关布阵至少一条可消路径且不中途死局（或有洗牌保底）** | 密格豁免热区（台账）；盘外按钮仍 ≥44 |
| match-stars | 6×6 消除：目标分在可消组合下可达 | 末行可滚（台账） |
| memory-cards | 图案成对、偶数张；算式卡答案唯一；旋转牌阵可辨 | N-115 已修勿回退 |
| merge-2048 | 目标数在步数预算内可达（期望模拟） | |
| mine-garden | **首点安全 + 每关雷数 ≤ 可推理上限**；布雷 seed 确定 | 末排在台账；地雷布点 seed 不改 |
| mole-pop | 时长 × 冒头频率 ≥ 目标；算式鼠答案唯一 | 洞 ≥56px 守门（`visual.qa1.test.ts`）；`rhythm.ts` 时序不动 |
| pool-stars | 每关球局可清（球数 / 时限） | `MAX_VERTICAL_PX=560` 分支口径 |
| puzzle-tiles | 打乱后可还原（奇偶校验） | N-108 已修；打乱 seed / 判定不改 |
| shoot-range | 靶出现频率下目标分可达；好人靶不与坏靶同位 | 预览 / 暂停 / 返回键 ≥44 已修 |
| snake-snack | 果子生成不落在蛇身；每关长度目标可达 | `SR_SHORT_PANE_H=200` 不改；N-61 不加二套垫 |
| tap-tiles | 音符下落速度 × 判定窗口 ≥ 孩子反应 250 ms | 隐藏键盘 `.tt-keys{display:none}` 禁盲拷 |

益智类共同：工序 B 以**求解器 / 校验器**为主（每款写一个纯函数 `isSolvable(board)` 或等价，生成器生成后必过校验，不过就重生成且 seed 仍确定）；工序 E 的主配方是第十四节**高度反推钳**（网格款：洞 / 卡 / 拼块 / 珠 / 雷区）；工序 D 的 `small` 档是点击反馈，`medium` 给消除 / 配对成功，`large` 只给过关。

## 五、派发波次（6 并发）

| 波 | 6 个槽 |
| --- | --- |
| 1 | `mine-garden-t1`、`lianliankan-t1`、`puzzle-tiles-t1`、`memory-cards-t1`、`match-stars-t1`、`bubble-pop-t1`（程序化盘面款优先，因为「无解」是 P0） |
| 2 | `merge-2048-t1`、`block-drop-t1`、`bubble-aim-t1`、`brick-break-t1`、`balloon-pop-t1`、`mole-pop-t1` |
| 3 | `fruit-catch-t1`、`fruit-stack-t1`、`fishing-star-t1`、`alien-seek-t1`、`pool-stars-t1`、`shoot-range-t1` |
| 4 | `snake-snack-t1`、`tap-tiles-t1`、`kitty-care-t1` + 3 个 `t2`（t1 已完成且 `origin/game-1.4` 已含 feel 套件的款） |
| 5–7 | 21 款 `t2` |
| 8 | 三轮验收（每轮 tester → learner + fixer），串行 |

开 `t2` 前先 `git fetch origin game-1.4 && git merge origin/game-1.4`（或 rebase）把窗口 1 的 feel 套件与工装带进本分支。

## 六、每张工单验收（通过才标完成、才派下一张）

```
[ ] 回复含：工单号、改了哪些文件、新增测试文件与用例数、审计结论、推送 SHA、模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test -- --testTimeout=180000 全绿且用例总数 ≥ 上一张水位；npm run build 全绿
[ ] t1：docs/qa/1.4/<id>-audit.md ≥ 12 条；levels.audit.test.ts 覆盖 188 关 × ≥3 种子或静态全覆盖（程序化款必须有求解器 / 校验器），失败清单空；P0/P1 已修
[ ] t2：feel 契约测试；五视口 HARD-OUT=0（网格款必须有高度反推钳）、热区 ≥44（盘面观察格豁免）、正文 ≥16；宪法负面清单逐条「无」；素材契约 ≥ 8 例
[ ] git diff --name-only 不越界；商标 0 命中；无新依赖 / 二进制；禁改常量一个没动
```

## 七、监督节奏

每 3–4 分钟（或 IDLE 通知）：`git fetch origin` → RUNNING / IDLE / ERROR → IDLE 校验合入并补派 → ERROR 同范围补派 → 回复主管：在跑几个、本轮派了谁、SHA、下一张、需求单。

## 八、本窗做完后必须去帮别人

本窗 21 款 t1 + t2 与三轮验收在 `game-1.4-window3` 全绿后：fetch 其他四个窗口分支与 `docs/qa/1.4/window<K>-status.md`，帮「未派」最多的窗口。**先向主管要格**：回复「申请代派 w<K>-<id>-t<k>」，等主管在 `docs/plan-1.4-tracker.md` 标「在跑（窗口 3 代）」后才许派，没登记就派 = 重派事故。仍然 Task 转发；工人分支改成 `game-1.4-windowK`；派前再 fetch；回复主管「窗口 3 正在帮窗口 K 的 <id>-t<k>」。五窗全部齐了才停。
