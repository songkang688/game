# 1.2 第 5 步 · C 档 —— `sudoku-petal`「数独花田」

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2`，不要改 `main`，不要 force。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.2 版本第 5 步（新游戏共 7 步：第 2–8 步 / 21 款）· C 档**：新建 `sudoku-petal`「数独花田」。
本步 A 档做 `merge-2048`、B 档做 `mine-garden`，**他们的目录你一个字都不许碰**。

## 一、分支纪律（先做这一步）

- `git fetch origin game-1.2`，工作分支基于 `origin/game-1.2`。
- **动代码前先提交一条「角色 C + 本款工作计划 + 唯一解生成策略」commit。**
- 只推 `game-1.2`；不要改 `main`、不要用 `gh` 开/改/合 PR。
- 收尾：fetch → rebase → 重跑 `npm test` 与 `npm run build` → 普通 push。**禁止 force。**

## 二、统一约定

1. `src/games/sudoku-petal/`：`meta.ts` 纯数据不 import 玩法；`index.ts` 顶部 `export { meta } from "./meta"` 并导出 `mount(api): { destroy }`，懒加载。
2. 不改 `src/ui/home.ts`；**不要改 `src/games/math-farm/**`**（那是四则运算）。
3. 闯关走 `level99.ts` 的 `mountLevelGame`（一关一题），章节和恒等 **188**，`assertTotal(chapters, 188)`。
4. 存档 key 语义不变；无尽记 `save.recordEndlessBest`。
5. 离线，无任何外部运行时依赖（**不许装 npm 数独求解库**）。
6. 音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。
7. 键位：点格 + 数字钮 1–9；`F` 填入，`G` 切换铅笔笔记；`WASD` / 方向键移光标；数字键 1–9 直接填；`Esc` 暂停。手机数字钮 ≥ 44px。
8. `destroy` 清干净监听 / 定时器 / rAF / AudioContext。
9. 文案原创、六年级水平、粉彩萌系；失败只鼓励。禁止商标（含注释）。
10. 只增测试不删测试。

## 三、meta（必须按此落地）

```
id: "sudoku-petal"
title: "数独花田"
emoji: "9️⃣"
category: "edu"
color: "#E8DDFF"
blurb: "每一行、每一列、每一朵九宫花都要种满 1 到 9。提示只讲方法，不把答案告诉你。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
ageHint: 9
platform: "both"
```

## 四、这不是什么

- 不是 `math-farm`（四则运算练习），不是 `shape-kingdom`（图形认知）。
- 本款是**标准数独**：唯一解、按技巧分级、铅笔笔记、变体盘。

## 五、完整规则

- 9×9：行、列、3×3 宫内 1–9 不重复。
- **每题唯一解**。生成流程：回溯 + 随机顺序生成完整解 → 挖洞，每挖一个洞用**解计数器**验证仍唯一（计数到 2 就提前停）。
- 难度按**所需技巧**分级，不是只看已知格数量，至少区分：
  1. 唯余（naked single）
  2. 隐性唯一（hidden single）
  3. 显性数对（naked pair）
  4. 区块摒除 / 指向对（pointing pair）
- 铅笔笔记：每格可标 1–9 小数字，笔记不计入完成判定。
- 冲突提示：填入后同行 / 同列 / 同宫高亮，**不要立刻判负**；闯关可开「错 3 次本关失败」。
- 变体关：4×4 入门、6×6、对角线约束（叫「对角花」）、不规则宫（jigsaw）。
- 提示按钮只给**方法级提示**（「第 5 行只有一个格能放 7，找找看」），**绝不直接填答案**。

胜负：填满且合法即胜；对战比用时；无尽连续解题，错 3 题结束。

## 六、系统表

| 系统 | 抽成 |
| --- | --- |
| 合法性 | `isValidPlacement(board, idx, n)` |
| 解计数 | `countSolutions(board, limit = 2)` |
| 生成 | `generate(seed, difficulty) → { puzzle, solution, techniques }` |
| 技巧检测 | `nextTechnique(board)`（提示用，不返回最终答案） |
| 变体宫 | `regionMapFor(kind)`（标准 / 对角 / jigsaw / 4×4 / 6×6） |
| 评星 | `starsByTimeAndErrors(ms, errors)` |

## 七、模式（四种都要做）

| 模式 | 做法 |
| --- | --- |
| 闯关 188 | 一关一题，难度与变体递进 |
| 对战 | 同一题竞速 |
| 无尽 | 马拉松解题，错 3 题结束，记最高连解 |
| 双人同屏 | 左右分盘同题 |

## 八、关卡切分（188 关，8 章）

| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 四宫萌芽 | 24 | 4×4 |
| 2 | 六宫苗 | 24 | 6×6 |
| 3 | 唯余九宫 | 24 | 9×9 入门（只需唯余） |
| 4 | 铅笔笔记 | 24 | 需要隐性唯一，鼓励做笔记 |
| 5 | 成对花 | 22 | 显性数对 |
| 6 | 对角花 | 22 | 对角线约束 |
| 7 | 异形宫 | 24 | jigsaw |
| 8 | 花田杯 | 24 | 高难唯一解 + 竞速 |

合计 24×4 + 22×2 + 24×2 = **188**。**测试对 188 题逐题断言 `countSolutions === 1`**（用位运算求解器；注意 CI 时间，可把题库固化成常量数据）。

## 九、前端建模与视觉（含 360px）

- DOM 表格；选中格与同行同列同宫柔和高亮，相同数字全盘轻高亮。
- 填入有小缩放；完成时九宫依次开花（每宫错开 100ms），**禁止只弹一句「完成」**。
- 笔记用小号 3×3 排布。
- `prefers-reduced-motion`：开花动画缩短。
- 360px：盘面占满宽（每格 ≥ 34px），数字钮一行 9 个且 ≥ 44px、不遮挡盘面；字号 ≥ 16px。

## 十、AI 档位（竞速假人）

按生成时记录的「最小技巧路径」逐步填，档位控制每步延迟与偶发失误：菜鸟 3s/步且会填错，普通 1.5s，高手 0.8s，地狱 0.4s 不失误。

## 十一、可参考的开源项目（只看结构，不抄素材、不加依赖）

- 任意开源数独生成器的「回溯 + 唯一解校验 + 挖洞」流程与位掩码求解器思路。**不引入任何 npm 求解库。**

## 十二、独占文件清单

只许新建 / 修改：

- `src/games/sudoku-petal/**`（建议 `meta.ts` `index.ts` `solver.ts` `generate.ts` `techniques.ts` `levels.ts` `ai.ts` `guide.ts` 与 `*.test.ts`）
- 可选 `scripts/smoke-1.2-step5-c.mjs`

禁止碰：`src/games/math-farm/**`、`src/games/merge-2048/**`、`src/games/mine-garden/**`、任何其他游戏、`src/ui/home.ts`、`docs/game-1.2/**`。

## 十三、测试（新增 ≥ 25 个用例，硬性下限 15）

必须覆盖：`isValidPlacement` 行 / 列 / 宫三种冲突；`countSolutions` 在唯一解与多解盘上的表现；挖洞不破坏唯一性；**188 题全部唯一解**；4×4 与 6×6 宫映射；对角线约束；jigsaw 宫映射；笔记不计入完成；错 3 次失败开关；提示只返回方法（断言返回结构里不含最终答案数字）；`assertTotal(chapters, 188)`；`destroy` 干净。

## 十四、分级红线自审

- `guide.ts` **只讲方法**，**严禁写任何一关的答案**。仿 `copy.test.ts` 风格加一条自检：guide 文本里不能出现连续 ≥ 20 位的数字串。
- 不出现任何数独 App / 出版物商标（注释也不许）。
- 失败文案只鼓励：「这题有点难，先把最容易的那一宫补上。」

## 十五、验收自查

- [ ] 唯一解生成 + 技巧分级
- [ ] 188 题全唯一解、章节和 = 188
- [ ] 4×4 / 6×6 / 对角 / jigsaw 变体都能玩
- [ ] 完成有逐宫开花动画
- [ ] 360px 数字钮 ≥ 44px、盘面不溢出
- [ ] guide 无答案（有自检用例）
- [ ] `npm test` / `npm run build` 全绿，用例只增不减
- [ ] `destroy` 干净；`rg` 无商标

测试命令：

```
npm test
npm run build
npx vite preview
```

## 十六、完成后回复

写清：你是 C 档、`sudoku-petal`；生成器策略与 188 题唯一解怎么断言（含 CI 耗时）；改了哪些文件；用例数与测试构建结果；SHA；**实际使用的模型 slug**。
