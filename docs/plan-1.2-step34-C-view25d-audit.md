# 1.2 第 34 步 / 共 37 步 · C 档 —— view25d / 跑酷相机回归（余数，不另开游戏）

> 本步 A 升级 `tap-tiles`；B 做 meta 审计。你做 2.5D 基建回归，避免升级步把共享相机改坏。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，1.2 升级第 34 步角色 **C**，独占新建 `src/engine/view25d.catalog.test.ts`（本步才允许出现；只测不改玩法，或只修 `view25d.ts` 的回归缺口）。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- 开工前先提交一条 git 记录（角色 + 本款工作计划），再改代码。
- 全部工作在 `game-1.2` 线上。**不要改 main、不要合并回 main、不要用 gh 开或改或合 PR。**
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2`（有冲突就解，绝不 force）→ 重跑 `npm test` 与 `npm run build` → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`。**
- 源码对照：先 `git fetch origin game-1.1`，以 `origin/game-1.1` @ `8867138` 的 55 款实现为 **1.1 已做完** 的事实；1.2 第 1 步平台（root / 手游端游筛选 / `playModes` / `view25d`）与 B 档 21 款接入视为已合入 `game-1.2`。不要假设 188 关、2.5D 跑酷、`collection`、`parentAuth`、`guide.ts` 还不存在。
- 模型 slug 只出现在上面四行正文：`claude-opus-5-thinking-high-fast`（无方括号）。回复里写**实际**使用的 slug。

## 现状审查
读第 1 步 C 的 `src/engine/view25d.ts` + `view25d.test.ts`，以及 1.1 的 `src/games/rainbow-run/view3d.ts`、`src/games/duo-rush/view25d.ts`。确认升级步是否把共享导出改崩。

## 通行规则（可联网搜，结论写成纯函数）
1. 先用你的检索能力核对这款玩法的**当代通行规则**（竞赛规则 / 街机手感 / HTML5 常青实现），把判定、胜负、非法操作写成纯函数，禁止只写在文案里。
2. 面向孩子的 UI / 攻略 / 注释 **禁止商业商标与官方角色名**。内部研究可用类型词。黑名单至少包括：球球大作战、贪吃蛇大作战、俄罗斯方块、Tetris、拳皇、KOF、三国杀、大富翁、Monopoly、Agar、Slither、Among Us、羊了个羊、合成大西瓜、跳一跳、地铁跑酷、开心消消乐、愤怒的小鸟、植物大战僵尸、水果忍者、超级玛丽、QQ、微信、腾讯、网易。
3. 无血、无伤、无死亡描写。体力条叫「元气」，威力不叫伤害。失败只鼓励。约小学六年级文案，粉彩萌系，不要低幼叠词。
4. 离线可玩。音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。禁止外部运行时依赖，**禁止 three.js**。
5. 键位：朵朵 `WASD`+`F`/`G`，星星 方向键+`L`/`K`，`Esc` 暂停；触屏必须有等价热区 ≥ 44px。
6. 存档 key 语义不改：`yiduo-yixing.l99.<id>`、`yiduo-yixing.l99skip.<id>`、`yiduo-yixing.save.v1`、`yiduo-yixing.collection.v1`。新进度只增新 key 或在本游戏目录内迁移旧私有 key。
7. `prefers-reduced-motion` 下降级位移/抖动/闪烁，但消消乐类仍须「经过中间格」。
8. 只增测试、不删测试、不调低断言。

## 你的任务
1. 新建 `src/engine/view25d.catalog.test.ts`：断言共享模块导出稳定（`makeCamera` / `project` 或第 1 步实际导出）、默认相机、`prefers-reduced-motion` 降级路径、禁止调用方假设 three.js。
2. 若测试红在 `view25d.ts` 本身的契约破坏：**可以修 `src/engine/view25d.ts` + 其原测试**（这是你本步唯一允许动的引擎文件）。不要改 `rainbow-run` / `duo-rush` 游戏目录（那些已在第 9 / 13 步升级过；缺口写进 `docs/qa/1.2-step34-view25d-notes.md`）。
3. 抽查：跑酷无尽必过窗口测试仍绿（只跑相关测试，不要改游戏源码）。

## 2.5D 决策
共享相机继续为 2.5D 服务；**不要**把全库推进真 3D。禁止 three.js。

## 独占
`src/engine/view25d.catalog.test.ts`；必要时 `src/engine/view25d.ts`、`src/engine/view25d.test.ts`；笔记 `docs/qa/1.2-step34-view25d-notes.md`。
禁止改 `tap-tiles`、禁止改 meta-audit、禁止改 `src/ui/home.ts`。

## 测试验收
全绿。新增断言覆盖导出与 reduced-motion。

完成后回复：契约是否稳定、修了没有、**实际模型 slug**。
