# 1.3 窗口向下转发的五种角色模板

这不是再开五个窗口。八个窗口统筹各收到一份 `plan-1.3-windowN.md` 之后，**必须用 Task 把活转出去**。下面五份是 Task 的 `prompt` 骨架。窗口文件里已经内嵌了同一套；这里给完整可替换版。

占位符：把 `{{WINDOW}}` 换成 `1`…`8`，`{{BRANCH}}` 换成 `game-1.3-windowN`（帮别人时换成被帮窗口的分支），`{{GAMES}}` 换成那份窗口文件里的游戏 id 列表，`{{STEP_FILE}}` 换成对应 `docs/plan-1.3-step*.md` 全文，`{{ROUND}}` 换成 `1` / `2` / `3`。

工人（角色 2–5）**禁止再 Task**。窗口（角色 1）**必须 Task**。

---

## 角色 1 · 窗口统筹（你发给八个窗口的就是这个角色）

不要单独再造一份。直接整段复制：

- 窗口 1 → `docs/plan-1.3-window1.md` 从四行口令到文末
- 窗口 2 → `docs/plan-1.3-window2.md`
- …直到窗口 8 → `docs/plan-1.3-window8.md`

发给窗口时：模型 `claude-fable-5-thinking-xhigh`，基线 `game-1.3`。

---

## 角色 2 · 实现工人（画师）· 窗口每次派一格都必须转发

Task 参数：`subagent_type=generalPurpose`，`environment=cloud`，`model=claude-fable-5-thinking-xhigh`，`cloud_base_branch={{BRANCH}}`，`run_in_background=true`。

`prompt` = 下面头 + **{{STEP_FILE}} 全文**（先把文里所有 `game-1.2-kk` 换成 `{{BRANCH}}`，基线换成 `origin/game-1.3`）。禁止摘要。

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 {{BRANCH}}。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `{{BRANCH}}`，不要改 main / game-1.2 / 1.2-kk，不要 force。本格只改视觉，不改玩法数值与 parentAuth / parentGate。禁止 three.js。】

仓库：https://github.com/songkang688/game
产品：「一朵一星」。主线对照基线：origin/game-1.3。工作分支：{{BRANCH}}。
开工：git fetch origin game-1.3 {{BRANCH}}；git checkout -B {{BRANCH}} origin/{{BRANCH}}（若远端还没有则 origin/game-1.3）。动手前先交一条本格计划 commit。收尾 rebase 保留别人文件，npm test 与 npm run build 全绿，普通 push origin {{BRANCH}}。

必须打开并对着做：docs/plan-1.3-visual-bible.md、本格 step 文件、.cursor/skills/1.3-visual/。
只改本格点名的 src/games/<id>/（或 step1 的 kit / runner / 布局）。src/styles.css 只许末尾追加。商标扫描 0 命中。素材契约测试只增不减。

—— 下面从这里开始是本格规格全文，一字不删 ——
```

随后粘贴该格 `docs/plan-1.3-step*.md` 全文。

---

## 角色 3 · 测试员 · 每轮先派

Task 参数：`model=claude-fable-5-thinking-xhigh`，其余同角色 2（`cloud_base_branch={{BRANCH}}`）。

`prompt` = 下面头 + `docs/plan-1.3-step27-A-tester.md`（第 2 轮用 step28-A，第 3 轮用 step29-A）全文，并改范围与报告路径。

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 {{BRANCH}}。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `{{BRANCH}}`。不要改 main / game-1.2 / 1.2-kk，不要 force。】

你是窗口 {{WINDOW}} 第 {{ROUND}} 轮视觉验收的测试员。
只验本窗口游戏：{{GAMES}}
不要验其他窗口的游戏，不要做全局 76 款扫描。
报告必须写到：docs/qa/1.3-window{{WINDOW}}-round{{ROUND}}-tester.md
别人的报告文件一个字都不许碰。只许新增视觉相关测试与这份报告。
只验视觉（宪法负面清单、金币体积、双人可区分、2.5D、360px、商标），不重开 188 关玩法验收。
对照：docs/plan-1.3-visual-bible.md。六大专项按 step27-A 的表执行，但矩阵只覆盖本窗口游戏。

—— 下面从这里开始粘对应 tester 规格全文，已把 game-1.2-kk 换成 {{BRANCH}} ——
```

---

## 角色 4 · 学习优化员 · 等本轮测试员 IDLE 再派

Task 参数同角色 3。`prompt` 头：

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 {{BRANCH}}。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `{{BRANCH}}`。】

你是窗口 {{WINDOW}} 第 {{ROUND}} 轮视觉验收的学习优化员。
只评估本窗口游戏：{{GAMES}}
报告必须写到：docs/qa/1.3-window{{WINDOW}}-round{{ROUND}}-learner.md
只学画面密度与角色剪影。不下载、不截图入库、不描摹具体造型。不改绘制代码。
可读本轮 tester 报告，不许改它。

—— 下面粘 step27-B / 28-B / 29-B 全文，已替换分支与范围 ——
```

---

## 角色 5 · 监督修复员 · 与学习优化员并行，但必须能读到本轮测试报告

Task 参数同角色 3。`prompt` 头：

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 {{BRANCH}}。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【你就是执行者，禁止再派生任何云端子代理。只推 `{{BRANCH}}`。一行玩法逻辑都不许动。】

你是窗口 {{WINDOW}} 第 {{ROUND}} 轮视觉验收的监督修复员。
只修本窗口游戏视觉：{{GAMES}}
先读 docs/qa/1.3-window{{WINDOW}}-round{{ROUND}}-tester.md（以及已有的 learner 报告）。
报告必须写到：docs/qa/1.3-window{{WINDOW}}-round{{ROUND}}-fixer.md
修复顺序：阻断（商标、360 新溢出）→ 严重（裸 emoji 主角、平涂圆、双人不可分、2.5D 缺失、金币无体积）→ 一般 → 建议。
每修一处一个 commit。别人的报告文件不许改。

—— 下面粘 step27-C / 28-C / 29-C 全文，已替换分支与范围 ——
```
