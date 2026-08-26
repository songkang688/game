# 1.2 第 36 步 / 共 37 步 · C 档 —— 监督修复员（第 2 轮）

> 验收三人组第 2 轮。仿 1.1 监督修复员：清阻断/严重。全部在 `game-1.2`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，**1.2 第 36 步**角色 **C 监督修复员**（第 2 轮）。独占 `docs/qa/1.2-round2-fixer.md`；修复按 A 报告建议文件，严重度从高到低。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- 开工前先提交一条 git 记录（角色 + 本款工作计划），再改代码。
- 全部工作在 `game-1.2` 线上。**不要改 main、不要合并回 main、不要用 gh 开或改或合 PR。**
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2`（有冲突就解，绝不 force）→ 重跑 `npm test` 与 `npm run build` → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`。**
- 源码对照：先 `git fetch origin game-1.1`，以 `origin/game-1.1` @ `8867138` 的 55 款实现为 **1.1 已做完** 的事实；1.2 第 1 步平台（root / 手游端游筛选 / `playModes` / `view25d`）与 B 档 21 款接入视为已合入 `game-1.2`。不要假设 188 关、2.5D 跑酷、`collection`、`parentAuth`、`guide.ts` 还不存在。
- 模型 slug 只出现在上面四行正文：`claude-opus-5-thinking-high-fast`（无方括号）。回复里写**实际**使用的 slug。

## 现状审查
等 A 报告或与 A 同步。读 `docs/qa/1.2-round2-tester.md`（及前轮）。复审 B 的 learner 报告与 diff。

## 通行规则
每修一个：先写能复现的红测试，再修，再全量。禁止 force、禁止改存档语义、禁止商标、禁止新依赖、禁止 three.js。无血无伤文案保持。

## 职责
修本轮阻断/严重；清第 1 轮遗留一般级。独立复测 B 的性能数字。
监督：复审 A 有没有漏测（崩溃入口、竞态、存档损坏、多游戏共用框架：level99、parentAuth、root、guide、collection、首页筛选、view25d）。漏了就补测并记录。
在**三方合并态**（A/B/C 都 rebase 到 `origin/game-1.2` 之后）再跑 `npm test` + `npm run build` + preview 冒烟，把 SHA 写进报告。

## 独占
`docs/qa/1.2-round2-fixer.md` + 为修缺陷改动的源码（以 A 建议路径为准）。不要改 A/B 的报告文件。与 B 同文件冲突时保留更彻底且有测试的一方，并在合并态复验。

## 测试验收
阻断+严重本轮 0 残留。第 1 轮遗留一般级必须清或关闭。
全绿。合并态 SHA。

## 冲突
不要把 B 的优化整段 revert 掉，除非它破坏手感或测试。不要开新游戏。不要改 main。

完成后回复：修了哪些、新增回归测试、合并态 SHA、质量结论、**实际模型 slug**。
