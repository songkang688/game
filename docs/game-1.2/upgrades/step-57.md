# 1.2 升级第 57 步 / 共 57 步 —— 验收三人组第 2 轮（测 / 学 / 修）

> 这是 1.2 升级提示词执行链的最后一轮验收，结束时升级内容应可发布到 game-1.2。
> 报告写到 `docs/qa/1.2-round2-<tester|learner|fixer>.md`，三人文件名互不冲突。

---

## A —— 测试员

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 57 步角色 **A 测试员**（第 2 轮）。独占报告 `docs/qa/1.2-round2-tester.md` 与你新增的 `*.test.ts`（只补测试，不改玩法）。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. `npm test` / `npm run build` / `npx vite preview` 冒烟。
2. 实玩：覆盖第 30–54 步里**上一轮没实玩过的游戏**；点名五款（五子棋六档、消消乐下落、跑酷 2.5D、海底无尽、象棋残局）必须回归。
   每款：进入 → 真实胜负（赢一次输一次）→ 退出再进；有战役则 1 / 100 / 188；有对战/无尽则各试；双人键位抽测。
3. 专项：360px 溢出、跳关 `?level=`、旧存档、destroy、商标巡检、消消乐是否仍瞬变、五子棋六档是否存在。
4. 问题必须量化（复现步骤 / 期望 / 实际 / 严重度 / 建议文件）。

不要改玩法代码。

完成后回复：问题数、报告路径、**实际模型 slug**。
~~~~

---

## B —— 学习优化员

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 57 步角色 **B 学习优化员**（第 2 轮）。独占 `docs/qa/1.2-round2-learner.md` 以及你落地的小 diff（登记文件，避免与 C 撞车）。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. 找开源儿童合集 / Canvas / 手感 / 可测试性优点 ≥ 10 条。
2. 只做低风险收口；更新 README 与 `docs/game-1.2/upgrades/` 无关的用户文档（若 README 不在你独占范围，只在报告里给 diff 建议，或只改 `docs/qa/`）。
3. 不推翻既有手感与断言。

完成后回复：落地条数、报告路径、**实际模型 slug**。
~~~~

---

## C —— 监督修复员

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 57 步角色 **C 监督修复员**（第 2 轮）。独占 `docs/qa/1.2-round2-fixer.md`；修复按严重度从高到低，文件以 A 报告建议为准，与 B 冲突时保留更彻底且有测试的一方。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. 三轮/两轮累计阻断严重一般清零；终审商标、依赖、存档 key、无血、合并态 SHA。
2. 每修一个先写红测试再修。
3. 三方合并态 rebase 后全量测试构建，记录 SHA。
4. 禁止 force、禁止改存档语义、禁止商标、禁止新依赖。

完成后回复：修了哪些、合并态 SHA、**实际模型 slug**。
~~~~
