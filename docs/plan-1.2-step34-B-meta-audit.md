# 1.2 第 34 步 / 共 37 步 · B 档 —— 全库 meta / platform 审计（余数，不另开游戏）

> 76 款升级 `ceil(76/3)=26` 步，本步 A 独占最后一款 `tap-tiles`。B/C 不升级第二款游戏，避免突破 21 款新游戏名额。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，1.2 升级第 34 步角色 **B**，独占新建 `src/games/_catalog/meta-audit.test.ts`（本步才允许出现）。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- 开工前先提交一条 git 记录（角色 + 本款工作计划），再改代码。
- 全部工作在 `game-1.2` 线上。**不要改 main、不要合并回 main、不要用 gh 开或改或合 PR。**
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2`（有冲突就解，绝不 force）→ 重跑 `npm test` 与 `npm run build` → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`。**
- 源码对照：先 `git fetch origin game-1.1`，以 `origin/game-1.1` @ `8867138` 的 55 款实现为 **1.1 已做完** 的事实；1.2 第 1 步平台（root / 手游端游筛选 / `playModes` / `view25d`）与 B 档 21 款接入视为已合入 `game-1.2`。不要假设 188 关、2.5D 跑酷、`collection`、`parentAuth`、`guide.ts` 还不存在。
- 模型 slug 只出现在上面四行正文：`claude-opus-5-thinking-high-fast`（无方括号）。回复里写**实际**使用的 slug。

## 现状审查
通读全部 `src/games/*/meta.ts`（1.1 的 55 + B 的 21 = 76）。对照 `docs/plan-1.2-upgrade-table.md` 的施工 id。第 1 步已给 `platform` 类型与缺省 `both`。

## 通行规则（可联网搜，结论写成纯函数）
1. 先用你的检索能力核对这款玩法的**当代通行规则**（竞赛规则 / 街机手感 / HTML5 常青实现），把判定、胜负、非法操作写成纯函数，禁止只写在文案里。
2. 面向孩子的 UI / 攻略 / 注释 **禁止商业商标与官方角色名**。内部研究可用类型词。黑名单至少包括：球球大作战、贪吃蛇大作战、俄罗斯方块、Tetris、拳皇、KOF、三国杀、大富翁、Monopoly、Agar、Slither、Among Us、羊了个羊、合成大西瓜、跳一跳、地铁跑酷、开心消消乐、愤怒的小鸟、植物大战僵尸、水果忍者、超级玛丽、QQ、微信、腾讯、网易。
3. 无血、无伤、无死亡描写。体力条叫「元气」，威力不叫伤害。失败只鼓励。约小学六年级文案，粉彩萌系，不要低幼叠词。
4. 离线可玩。音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。禁止外部运行时依赖，**禁止 three.js**。
5. 键位：朵朵 `WASD`+`F`/`G`，星星 方向键+`L`/`K`，`Esc` 暂停；触屏必须有等价热区 ≥ 44px。
6. 存档 key 语义不改：`yiduo-yixing.l99.<id>`、`yiduo-yixing.l99skip.<id>`、`yiduo-yixing.save.v1`、`yiduo-yixing.collection.v1`。新进度只增新 key 或在本游戏目录内迁移旧私有 key。
7. `prefers-reduced-motion` 下降级位移/抖动/闪烁，但消消乐类仍须「经过中间格」。
8. 只增测试、不删测试、不调低断言。

## 你的任务（不是做新游戏）
新建 `src/games/_catalog/meta-audit.test.ts`（或同等独占路径，不要放进某一款游戏目录）：
1. glob 全部 `meta.ts`：`id` 无重复；每个有合法 `platform`（`mobile`|`desktop`|`both`）与非空 `modes`。
2. 21 个 B 施工 id 都在：`orb-arena` `snake-royale` `block-drop` `combo-clash` `mahjong-bloom` `star-estate` `hero-cards` `weiqi-garden` `flight-chess` `merge-2048` `mine-garden` `sudoku-petal` `dot-maze` `fruit-stack` `pool-stars` `hue-hand` `junqi-camp` `chess-garden` `dark-chess` `hop-pads` `tap-tiles`。
3. 1.1 的 55 个 id 都在（含 `bumper-cars` `bowling-lane` `xiangqi`）。
4. `xiangqi` 存在且没有第二个象棋目录。
5. 商标黑名单不出现在 title/blurb。
6. **不要改** 各游戏玩法文件；若某款 `platform`/`modes` 明显填错，只在报告 `docs/qa/1.2-step34-meta-notes.md` 登记，留给验证步或该游戏独占者。若你必须改 `meta.ts` 才能让审计绿——**不要改**，把测试写成「记录缺口」而不是强制写死尚未改准的值。优先断言「字段存在且枚举合法」。

## 2.5D / 视觉 / 手机 / 跳关
本步不做渲染。跳关/root 不在你的范围。

## GitHub 结构参考
本库 `import.meta.glob` 收集 meta 的方式。

## 独占
只许：`src/games/_catalog/meta-audit.test.ts`、可选 `src/games/_catalog/README.md`、`docs/qa/1.2-step34-meta-notes.md`。
禁止改 `tap-tiles`、禁止改 `src/engine/view25d.ts`（那是 C 的余数）。

## 测试验收
`npm test` / `npm run build` 全绿。新增用例覆盖上面 1–5。

## 冲突
不要和 A 的 `tap-tiles`、C 的 view25d 测试抢文件。不要改 home.ts。

完成后回复：审计结果（76 款是否齐）、缺口列表、**实际模型 slug**。
