# 1.4 窗口 4 统筹提示词 —— 对战棋牌 19 款 + 本窗三轮验收

> 把本文件**从下面四行口令起到文末**整段复制，发给窗口 4。不要拆开，不要摘要。窗口本体用你顺手的思考模型；工人一律 `claude-opus-5-5-xhigh-fast`。

请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window4。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是 **1.4 窗口 4 的统筹 / 包工头**。上面四行口令是命令**你去转发**，不是命令你自己写代码。本窗口铁令：

1. **必须用 Task 转发**每一张工单（每款 t1 / t2、每轮验收三人、帮别人时的每一格）。少派、自己动手改 `src/**`、把工人规格摘要成几句话，都算停工事故。
2. 你只许：Task 派工、`git` fetch / merge / rebase / push（禁 force）、写 `docs/qa/1.4/window4-status.md`、回复主管。
3. 工人**禁止再套娃 Task**；工人 prompt 必须保留「你就是执行者，禁止再派生任何子代理」。
4. **并发上限 6 个工人**。任何时刻保持 6 个在跑：有 IDLE 立刻合入并补派，有 ERROR 按同一范围补派，禁止 resume RUNNING，禁止重派在跑的格子。
5. 本窗做完立刻去帮最落后的窗口（第八节）。】

仓库：https://github.com/songkang688/game　产品：「一朵一星」（离线中文儿童小游戏合集，Vite + TypeScript + Canvas 2D，无框架、零运行时依赖）
集成分支：**`origin/game-1.4`**（从 `game-1.3` @ 1.3.4 砍出，已含全部 `docs/plan-1.4-*` 与 `.cursor/skills/gamedev/`）。你的本职分支：**`game-1.4-window4`**。
**不要改 `main` / `game-1.3`。不要 force push。不要用 `gh` 开 / 改 / 合 PR（只读可用）。**

## 五窗口总表（帮别人时对着找）

| 窗口 | 分支 | 主题 | 游戏数 | 粘贴文件 |
| --- | --- | --- | --- | --- |
| 1 | `game-1.4-window1` | 壳层 / 框架 / 手感套件 + 学习与动手 | 9 + 2 基建 | `docs/plan-1.4-window1.md` |
| 2 | `game-1.4-window2` | 闯关动作 | 17 | `docs/plan-1.4-window2.md` |
| 3 | `game-1.4-window3` | 休闲益智 | 21 | `docs/plan-1.4-window3.md` |
| **4（你）** | `game-1.4-window4` | 对战棋牌 | 19 | `docs/plan-1.4-window4.md` |
| 5 | `game-1.4-window5` | 纵深 / 伪 3D + 跑道套件 | 10 + 1 基建 | `docs/plan-1.4-window5.md` |

规格入口：总纲 `docs/plan-1.4-supervisor.md` · 单款工序 `docs/plan-1.4-worker-game.md` · 验收 `docs/plan-1.4-worker-qa.md` · 登记表 `docs/plan-1.4-tracker.md`（只读）。

## 〇、开工顺序

1. `git fetch origin game-1.4` → `git checkout -B game-1.4-window4 origin/game-1.4`
2. 新建 `docs/qa/1.4/window4-status.md`（本窗 19 款 × t1/t2 状态表），commit → `git push -u origin game-1.4-window4`。
3. **立刻并行派第一波 6 个 t1**（第五节）。

## 一、Task 参数（每次派工缺一不可）

| 参数 | 值 |
| --- | --- |
| `subagent_type` | `generalPurpose` |
| `model` | `claude-opus-5-5-xhigh-fast`（不带方括号） |
| `environment` | `cloud`（首选） |
| `cloud_base_branch` | `game-1.4-window4`（帮窗口 K 时 `game-1.4-windowK`） |
| `run_in_background` | `true` |
| `description` | `w4-<id>-t1` / `w4-<id>-t2` / `-t2a` / `-t2b` / `w4-r<轮>-tester|learner|fixer` |
| `prompt` | 第二节 prompt 头 + 对应规格文件**全文**（已替换占位符）。禁止摘要。 |

**云端不可用**：改本地并发，但每个工人必须独立工作区——你执行 `git worktree add ..\yd-w4-<id> -b game-1.4-window4-<id> origin/game-1.4-window4`，把该绝对路径写进工人 prompt 第一句，工人只在该目录内工作、只推 `game-1.4-window4-<id>`；IDLE 后你把该分支合进 `game-1.4-window4` 并 `git worktree remove`。禁止两个工人共用一个目录；本地并发时工人只跑定向测试，你合并后跑全量。

## 二、工人 prompt 头（随后粘规格全文）

### 2.1 单款工单（t1 / t2 / t2a / t2b）—— 随后粘 `docs/plan-1.4-worker-game.md` 全文（替换 `{{ID}}`、`{{WINDOW}}`=4、`{{BRANCH}}`=game-1.4-window4、`{{TICKET}}`）

```
请通过 Task 工具派生一或多个子代理执行本任务。
指定模型 slug：claude-opus-5-5-xhigh-fast。
请在独立功能分支上进行修改，叫 game-1.4-window4。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个执行工人。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何子代理，必须自己动手把活干完。只推 `game-1.4-window4`，不改 main / game-1.3，不 force。只改 `src/games/<ID>/`（以及该款需要时在 `src/art/kit/` 新增带 `<ID>` 前缀的文件）；`src/ui/**`、`src/styles.css`、`level99.ts`、`src/engine/**`、`src/art/runner/**` 一个字不碰，需求写需求单。存档 key / meta.id / 188 总数 / 章节边界 / parentAuth / parentGate / rootGate 不动。禁止 three.js 与任何新依赖。测试只增不减。】

仓库：https://github.com/songkang688/game　集成分支 origin/game-1.4　工作分支 game-1.4-window4
本款：<ID>　工单：<TICKET>
必读：docs/plan-1.4-supervisor.md 第一、二、五节；docs/plan-1.3-visual-bible.md；docs/ux-iteration-playbook.md 第〇、八、十四节；.cursor/skills/gamedev/*/SKILL.md（**game-design-theory 与 game-ui-ux 是本窗重点**）；docs/qa/1.4/infra-feel.md（t2 时，若 origin/game-1.4 上还没有就先做 E/F 并在回复里写明 D 待接）。
—— 下面是本工单规格全文，一字不删 ——
```

### 2.2 验收三人（第 1–3 轮）—— 随后粘 `docs/plan-1.4-worker-qa.md` 全文（替换 `{{WINDOW}}`=4、`{{BRANCH}}`、`{{GAMES}}`、`{{ROUND}}`）

```
（同 2.1 的四行口令）

【你就是执行者，禁止再派生任何子代理。只推 `game-1.4-window4`。只验 / 只学 / 只修本窗口游戏：chess-garden combo-clash dark-chess duo-arena duo-vs-star fight-king flight-chess gomoku hero-cards hue-hand junqi-camp landlord-cards mahjong-bloom puff-bros red-blue-tap red-blue-tug star-estate weiqi-garden xiangqi。报告写到 docs/qa/1.4/window4-round<N>-<tester|learner|fixer>.md。别人的报告一个字不碰。】

—— 下面是验收规格全文，一字不删 ——
```

## 三、本窗口所有权

只有 19 款游戏目录 `src/games/<id>/`（含其测试）与 `docs/qa/1.4/<id>-*.md`、`docs/qa/1.4/window4-*.md`。`src/art/kit/` 只许新增 `<id>-*.ts`。要动共享文件 → 在 `window4-status.md` 的「给窗口 1 / 给窗口 5」段写需求单。

## 四、本窗口游戏（19）与特殊注意（工序 B 审计要点）

对战棋牌的「188 关」多是**残局 / 人机档塔**，工序 B 的核心是：**残局有解（用本款引擎求解或自对弈验证）、人机每档能在步数 / 时间上限内结束、档位单调（第 N 档胜率不高于第 N+1 档）、规则实现与中文规则一致**。

| id | 审计要点 | 既有号 / 注意 |
| --- | --- | --- |
| chess-garden | 国际象棋：易位 / 吃过路兵 / 升变 / 三次重复 / 50 步；残局 188 道全有解；AI 不送将 | N-112、U-9 已修勿回退 |
| combo-clash | 连招取消 / 超必杀判定窗口 ≥ 120 ms；格斗塔每层 AI 可打 | N-105 16px 已修 |
| dark-chess | 翻暗棋先翻定色；吃子规则；残局 | 暗子观察格豁免 |
| duo-arena | **无战役**：对战 / 无尽模式「可开局、三回合可结束、不卡死」模拟 ×3 种子 | 开擂 CTA 在屏 |
| duo-vs-star | 弹飞混战 2v2 / 无尽 / 188 关：每关对手数与场地下存活可达 | |
| fight-king | 轻击重击连段；188 格斗塔 AI 档 | N-111 菜单可滚 |
| flight-chess | 掷骰 / 跳格 / 飞线规则；四人 AI 不死循环 | U-14 已修 |
| gomoku | 188 残局全有解（算杀）；禁手规则是否声明；算杀档不超时 | |
| hero-cards | 花主 / 身份 / 距离技能规则一致；AI 出牌合法 | U-15 已修 |
| hue-hand | 颜色 / 数字接龙；剩一张提醒；AI 合法 | 暗牌区 840 档 `min-height:64px` |
| junqi-camp | 工兵排雷 / 军旗 / 行营 / 铁路规则；布阵合法性校验；AI 不卡 | |
| landlord-cards | **完整斗地主**：叫分 / 抢 / 炸弹 / 春天 / 牌型判定全集测试；188 层地主塔 AI 可打；三人 AI 不作弊（不偷看） | |
| mahjong-bloom | 吃碰杠胡 / 八番门槛；胡牌判定全集；AI 不卡 | N-105 已修；手牌贴线 |
| puff-bros | 泡泡糖气流困住；合作 / 对战两套模拟 | A/B 剪影 / 主色 / 配饰三层不同 |
| red-blue-tap | 蓝点出现 / 陷阱红点节奏 ≥ 孩子反应 | **`SHORT_LANDSCAPE_PX=420` 禁改**；🔵22 观察格豁免 |
| red-blue-tug | 连点加力公平（双人键位零交集） | |
| star-estate | 掷骰买街：188 关经济曲线下不会必然破产（蒙特卡洛） | N-3 / U-1 已修勿回退；地格 26px 豁免 |
| weiqi-garden | 九 / 十三 / 十九路：提子 / 打劫 / 数目正确；AI 不自填眼 | N-10 残余在台账 |
| xiangqi | 将帅照面 / 困毙 / 长将判负；188 关人机档；残局有解 | 键排 `max-width:699 && 840 && 501` 档已有 |

对战类共同：**双人同屏 A/B 键位零交集**（已有 `window1-keyrepeat.test.ts` 口径）；人机 AI 走子要有「思考中」反馈且 ≤ 1.5 s；输了只鼓励；工序 D 的 `medium` 给吃子 / 胡牌 / 连招命中，`large` 只给将死 / 胡牌结算 / KO。

## 五、派发波次（6 并发）

| 波 | 6 个槽 |
| --- | --- |
| 1 | `landlord-cards-t1`、`mahjong-bloom-t1`、`chess-garden-t1`、`xiangqi-t1`、`gomoku-t1`、`junqi-camp-t1`（规则全集与残局求解最重，先开） |
| 2 | `weiqi-garden-t1`、`flight-chess-t1`、`hero-cards-t1`、`dark-chess-t1`、`star-estate-t1`、`hue-hand-t1` |
| 3 | `fight-king-t1`、`combo-clash-t1`、`duo-vs-star-t1`、`puff-bros-t1`、`duo-arena-t1`、`red-blue-tap-t1` |
| 4 | `red-blue-tug-t1` + 5 个 `t2`（t1 已完成且 `origin/game-1.4` 已含 feel 套件的款） |
| 5–7 | 19 款 `t2`；LOC > 6000 的（duo-vs-star puff-bros fight-king gomoku combo-clash）拆 `t2a` / `t2b` |
| 8 | 三轮验收（每轮 tester → learner + fixer），串行 |

开 `t2` 前先 `git fetch origin game-1.4 && git merge origin/game-1.4`（或 rebase）把窗口 1 的 feel 套件与工装带进本分支。

## 六、每张工单验收（通过才标完成、才派下一张）

```
[ ] 回复含：工单号、改了哪些文件、新增测试文件与用例数、审计结论、推送 SHA、模型 slug = claude-opus-5-5-xhigh-fast
[ ] 分支上确有提交；没推 game-1.3 / main；没 force
[ ] npm test -- --testTimeout=180000 全绿且用例总数 ≥ 上一张水位；npm run build 全绿
[ ] t1：docs/qa/1.4/<id>-audit.md ≥ 12 条；levels.audit.test.ts（残局求解 / 人机档模拟 / 规则全集）覆盖全部关卡或档位，失败清单空；P0/P1 已修
[ ] t2：feel 契约测试；五视口 HARD-OUT=0、热区 ≥44（盘面观察格豁免，盘外按钮不豁免）、正文 ≥16；双人 A/B 可分；宪法负面清单逐条「无」；素材契约 ≥ 8 例
[ ] git diff --name-only 不越界；商标 0 命中；无新依赖 / 二进制；禁改常量一个没动
```

## 七、监督节奏

每 3–4 分钟（或 IDLE 通知）：`git fetch origin` → RUNNING / IDLE / ERROR → IDLE 校验合入并补派 → ERROR 同范围补派 → 回复主管：在跑几个、本轮派了谁、SHA、下一张、需求单。

## 八、本窗做完后必须去帮别人

本窗 19 款 t1 + t2 与三轮验收在 `game-1.4-window4` 全绿后：fetch 其他四个窗口分支与 `docs/qa/1.4/window<K>-status.md`，帮「未派」最多的窗口；仍然 Task 转发；工人分支改成 `game-1.4-windowK`；只帮没人在跑的款；派前再 fetch；回复主管「窗口 4 空闲，正在帮窗口 K 的 <id>-t<k>」。五窗全部齐了才停。
