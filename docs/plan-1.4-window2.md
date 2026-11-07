# 1.4 窗口 2 统筹提示词 —— 闯关动作 17 款 + 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 2。不要拆开，不要摘要。窗口本体用你顺手的思考模型；工人一律 `claude-opus-5-5-xhigh-fast`。

请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window2。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是 **1.4 窗口 2 的统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己写代码。本窗口铁令：

1. **必须用 Task 转发**每一张工单（每款 t1 / t2、每轮验收三人、帮别人时的每一格）。少派、自己动手改 `src/**`、把工人规格摘要成几句话，都算停工事故。
2. 你只许：Task 派工、`git` fetch / merge / rebase / push（禁 force）、写 `docs/qa/1.4/window2-status.md`、回复主管。
3. 工人**禁止再套娃 Task**；工人 prompt 必须保留「你就是执行者，禁止再派生任何子代理」。
4. **并发上限 6 个工人**。任何时刻保持 6 个在跑：有 IDLE 立刻合入并补派，有 ERROR 按同一范围补派，禁止 resume RUNNING，禁止重派在跑的格子。
5. 本窗做完立刻去帮最落后的窗口（第八节）。】

仓库：https://github.com/songkang688/game　产品：「一朵一星」（离线中文儿童小游戏合集，Vite + TypeScript + Canvas 2D，无框架、零运行时依赖）
集成分支：**`origin/game-1.4`**（从 `game-1.3` @ 1.3.4 砍出，已含全部 `docs/plan-1.4-*` 与 `.cursor/skills/gamedev/`）。你的本职分支：**`game-1.4-window2`**。
**不要改 `main` / `game-1.3`。不要 force push。不要用 `gh` 开 / 改 / 合 PR（只读可用）。**

## 五窗口总表（帮别人时对着找）

| 窗口 | 分支 | 主题 | 游戏数 | 粘贴文件 |
| --- | --- | --- | --- | --- |
| 1 | `game-1.4-window1` | 壳层 / 框架 / 手感套件 + 学习与动手 | 9 + 2 基建 | `docs/plan-1.4-window1.md` |
| **2（你）** | `game-1.4-window2` | 闯关动作 | 17 | `docs/plan-1.4-window2.md` |
| 3 | `game-1.4-window3` | 休闲益智 | 21 | `docs/plan-1.4-window3.md` |
| 4 | `game-1.4-window4` | 对战棋牌 | 19 | `docs/plan-1.4-window4.md` |
| 5 | `game-1.4-window5` | 纵深 / 伪 3D + 跑道套件 | 10 + 1 基建 | `docs/plan-1.4-window5.md` |

规格入口：总纲 `docs/plan-1.4-supervisor.md` · 单款工序 `docs/plan-1.4-worker-game.md` · 验收 `docs/plan-1.4-worker-qa.md` · 登记表 `docs/plan-1.4-tracker.md`（只读）。

## 〇、开工顺序

1. `git fetch origin game-1.4` → `git checkout -B game-1.4-window2 origin/game-1.4`
2. 新建 `docs/qa/1.4/window2-status.md`（本窗 17 款 × t1/t2 状态表），commit → `git push -u origin game-1.4-window2`。
3. **立刻并行派第一波 6 个 t1**（第五节）。

## 一、Task 参数（每次派工缺一不可）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选） |
| `cloud_base_branch` | `game-1.4-window2`（帮窗口 K 时 `game-1.4-windowK`） |
| `run_in_background` | `true` |
| `description` | `w2-<id>-t1` / `w2-<id>-t2` / `-t2a` / `-t2b` / `w2-r<轮>-tester|learner|fixer` |
| `prompt` | 第二节 prompt 头 + 对应规格文件**全文**（已替换占位符）。禁止摘要。 |

**云端不可用**：改本地并发，但每个工人必须独立工作区——你执行 `git worktree add ..\yd-w2-<id> -b game-1.4-window2-<id> origin/game-1.4-window2`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window2-<id>`；IDLE 后你把该分支合进 `game-1.4-window2` 并 `git worktree remove`。禁止两个工人共用一个目录；本地并发时工人只跑定向测试，你合并后跑全量。

## 二、工人 prompt 头（随后粘规格全文）

### 2.1 单款工单（t1 / t2 / t2a / t2b）—— 随后粘 `docs/plan-1.4-worker-game.md` 全文（替换 `{{ID}}`、`{{WINDOW}}`=2、`{{BRANCH}}`=game-1.4-window2、`{{TICKET}}`）

```
请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window2。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个执行工人。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何子代理，必须自己动手把活干完。只推 `game-1.4-window2`，不改 main / game-1.3，不 force。只改 `src/games/<ID>/`（以及该款需要时在 `src/art/kit/` 新增带 `<ID>` 前缀的文件）；`src/ui/**`、`src/styles.css`、`level99.ts`、`src/engine/**`、`src/art/runner/**` 一个字不碰，需求写需求单。存档 key / meta.id / 188 总数 / 章节边界 / parentAuth / parentGate / rootGate 不动。禁止 three.js 与任何新依赖。测试只增不减。】

仓库：https://github.com/songkang688/game　集成分支 origin/game-1.4　工作分支 game-1.4-window2
本款：<ID>　工单：<TICKET>
必读：docs/plan-1.4-supervisor.md 第一、二、五节；docs/plan-1.3-visual-bible.md；docs/ux-iteration-playbook.md 第〇、八、十四节；.cursor/skills/gamedev/*/SKILL.md；docs/qa/1.4/infra-feel.md（t2 时，若 origin/game-1.4 上还没有就先做 E/F 并在回复里写明 D 待接）。
—— 下面是本工单规格全文，一字不删 ——
```

### 2.2 验收三人（第 1–3 轮）—— 随后粘 `docs/plan-1.4-worker-qa.md` 全文（替换 `{{WINDOW}}`=2、`{{BRANCH}}`、`{{GAMES}}`、`{{ROUND}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window2`。只验 / 只学 / 只修本窗口游戏：adventure-king bomb-buddies box-hamster brave-path candy-swing dot-maze fruit-slice garden-guard ice-fire-forest monster-crisis ocean-munch orb-arena prince-princess sky-squad snake-royale sprout-defense tank-battle。报告写到 docs/qa/1.4/window2-round<N>-<tester|learner|fixer>.md。别人的报告一个字不碰。】

—— 下面是验收规格全文，一字不删 ——
```

## 三、本窗口所有权

只有 17 款游戏目录 `src/games/<id>/`（含其测试）与 `docs/qa/1.4/<id>-*.md`、`docs/qa/1.4/window2-*.md`。`src/art/kit/` 只许新增 `<id>-*.ts`。要动共享文件 → 在 `window2-status.md` 的「给窗口 1 / 给窗口 5」段写需求单（文件、行、要什么、为什么），回复主管时点名。

## 四、本窗口游戏（17）与特殊注意（工序 B 的审计要点）

| id | 188 关审计要点 | 其他 |
| --- | --- | --- |
| adventure-king | 回旋镖 / 抓钩荡绳关：每关神器可集齐、首领门可达（图搜索） | BOSS 仪式 |
| bomb-buddies | 既有「三档电脑各打三分钟」模拟慢，审计测试控制在 CI 180 s 内 | 合作 / 对战两套模拟 |
| box-hamster | **推箱子每关必须 BFS 可解**（冰面 / 传送门 / 双鼠规则进求解器），死角箱子检测 | D-pad U-10 已修勿回退 |
| brave-path | 五系克制 + 装备成长曲线：无尽深渊每 10 层数值不得指数失控；188 关战斗用期望伤害模拟 | 轻 RPG 数值表 |
| candy-swing | 绳长 / 锚点 / 啾啾位置几何可达（抛物线落点模拟） | 物理 |
| dot-maze | 迷宫起点 / 豆子 / 出口连通；四幽灵脾气 AI 不得把出生点围死 | 画布 |
| fruit-slice | 指令果 / 硬壳果出现频率下目标可达 | **画布内菜单（P-7）：t2 改 DOM 覆盖层或暴露可测状态** |
| garden-guard | 塔防经济：每波前可支配金币 ≥ 最便宜有效防线成本（经济模拟） | BOSS 多段 |
| ice-fire-forest | 双人合作：用两个机器人模拟，机关顺序可解 | A/B 剪影 / 主色 / 配饰三层不同 |
| monster-crisis | 路障 / 炮台 / 颜料弹资源与波次模拟 | |
| ocean-munch | 成长曲线：每关海域大王可在时限内吃到 | **画布内菜单（P-7）** |
| orb-arena | 分身 / 刺球密度下存活率模拟 | `OA_SHORT_PANE_H=200` 守门不动 |
| prince-princess | 双人横版：王子近战 / 公主二段跳各自可过的段落；单人模式（若有）别卡双人机关 | 840 档只加 `min-height:621` 轻钳 |
| sky-squad | 弹幕 BOSS 每阶段存在安全走位（弹幕采样测试） | D-pad U-19 已修；模式键 ≥44 |
| snake-royale | 原野对手 AI 不会开局即围杀 | |
| sprout-defense | 阳光经济与波次模拟 | **画布内菜单（P-7）** |
| tank-battle | 砖墙 / 钢墙 / 水面地形下基地可守（路径模拟） | 双人 D-pad U-7 已修勿回退 |

动作类共同：手感是重头（工序 D 事件表要完整：命中 / 被击 / 落地 / 拾取 / 过关 / 失败 / 连击 / BOSS 登场）；`destroy()` 清 rAF 与监听；暂停不吞输入。

## 五、派发波次（6 并发）

| 波 | 6 个槽 |
| --- | --- |
| 1 | `garden-guard-t1`、`candy-swing-t1`、`prince-princess-t1`、`ocean-munch-t1`、`sprout-defense-t1`、`box-hamster-t1` |
| 2 | `sky-squad-t1`、`brave-path-t1`、`ice-fire-forest-t1`、`bomb-buddies-t1`、`monster-crisis-t1`、`tank-battle-t1` |
| 3 | `adventure-king-t1`、`dot-maze-t1`、`fruit-slice-t1`、`orb-arena-t1`、`snake-royale-t1` + 第一个 `t2`（选 t1 已完成且 `origin/game-1.4` 已含 feel 套件的款；没有就开 `t2a` 做 E/F） |
| 4–6 | 17 款 `t2`；LOC > 6000 的（garden-guard candy-swing prince-princess ocean-munch sprout-defense sky-squad brave-path ice-fire-forest bomb-buddies）拆 `t2a`（D+E）→ `t2b`（F）串行 |
| 7 | 三轮验收（每轮 tester → learner + fixer），串行 |

开 `t2` 前先 `git fetch origin game-1.4 && git merge origin/game-1.4`（或 rebase）把窗口 1 的 feel 套件与工装带进本分支。

## 六、每张工单验收（通过才标完成、才派下一张）

```
[ ] 回复含：工单号、改了哪些文件、新增测试文件与用例数、审计结论、推送 SHA、模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test -- --testTimeout=180000 全绿且用例总数 ≥ 上一张水位；npm run build 全绿
[ ] t1：docs/qa/1.4/<id>-audit.md ≥ 12 条；levels.audit.test.ts 覆盖 188 关 × ≥3 种子或静态全覆盖，失败清单空；P0/P1 已修；关卡数值改动有前后对比
[ ] t2：feel 契约测试；五视口 HARD-OUT=0、热区 ≥44、正文 ≥16；宪法负面清单逐条「无」；素材契约 ≥ 8 例；画布内菜单款已可测
[ ] git diff --name-only 不越界；商标 0 命中；无新依赖 / 二进制
```

## 七、监督节奏

每 3–4 分钟（或 IDLE 通知）：`git fetch origin` → RUNNING / IDLE / ERROR → IDLE 校验合入并补派 → ERROR 同范围补派 → 回复主管：在跑几个、本轮派了谁、SHA、下一张、需求单。

## 八、本窗做完后必须去帮别人

本窗 17 款 t1 + t2 与三轮验收在 `game-1.4-window2` 全绿后：fetch 其他四个窗口分支与 `docs/qa/1.4/window<K>-status.md`，帮「未派」最多的窗口；仍然 Task 转发；工人分支改成 `game-1.4-windowK`；只帮没人在跑的款；派前再 fetch；回复主管「窗口 2 空闲，正在帮窗口 K 的 <id>-t<k>」。五窗全部齐了才停。
