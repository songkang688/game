# 1.2 升级第 56 步 / 共 57 步 —— 验收三人组第 1 轮（测 / 学 / 修）

> 本轮清阻断/严重；一般问题可登记到下一轮。
> 报告写到 `docs/qa/1.2-round1-<tester|learner|fixer>.md`，三人文件名互不冲突。

---

## A —— 测试员

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

1.2 第 56 步角色 **A 测试员**（第 1 轮）。独占报告 `docs/qa/1.2-round1-tester.md` 与你新增的 `*.test.ts`（只补测试，不改玩法）。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. `npm test` / `npm run build` / `npx vite preview` 冒烟。
2. 实玩：抽 24 款：点名 5 款 + 新 21 款里的 IO/方块/格斗/麻将/庄园/三国杀/围棋/飞行棋 + 随机旧游戏。
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

1.2 第 56 步角色 **B 学习优化员**（第 1 轮）。独占 `docs/qa/1.2-round1-learner.md` 以及你落地的小 diff（登记文件，避免与 C 撞车）。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. 找开源儿童合集 / Canvas / 手感 / 可测试性优点 ≥ 10 条。
2. 落地 ≥ 5 条可吸收优点（对象池、输入缓冲、关卡数据驱动），附量化。
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

1.2 第 56 步角色 **C 监督修复员**（第 1 轮）。独占 `docs/qa/1.2-round1-fixer.md`；修复按严重度从高到低，文件以 A 报告建议为准，与 B 冲突时保留更彻底且有测试的一方。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 职责

1. 修本轮 A 的全部阻断与严重；复审 B 的 diff。
2. 每修一个先写红测试再修。
3. 三方合并态 rebase 后全量测试构建，记录 SHA。
4. 禁止 force、禁止改存档语义、禁止商标、禁止新依赖。

完成后回复：修了哪些、合并态 SHA、**实际模型 slug**。
~~~~
