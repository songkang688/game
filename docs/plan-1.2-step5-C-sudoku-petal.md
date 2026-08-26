# 1.2 第 5 步 · C 档 —— `sudoku-petal`「数独花田」

> 短计划：独占新建 `src/games/sudoku-petal/`。本步另两档是 `merge-2048`、`mine-garden`。
> 9×9 数独生成 + 候选数。**每题唯一解**。攻略不泄题。不要改 `math-farm`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 5 步 · C 档**：新建 `sudoku-petal`「数独花田」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关（每关一题）。存档 `yiduo-yixing.l99.sudoku-petal`。
- 点选格 + 数字钮 1–9；朵朵 WASD 移动光标 + `F` 填入 + `G` 笔记（铅笔标记）；星星方向键 + `L` 填入 / `K` 笔记。双人：同题竞速。360px：数字钮 ≥ 44px。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。不要改 `math-farm`（那是四则运算）。
- **收藏只读**：不要用 luck 改题目唯一解。暂停可 `openCollection("sudoku-petal")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则
- 9×9，九宫、行、列均 1–9 不重复。
- **每题唯一解**。生成：挖洞 + 唯一解检测（回溯计数器碰到 2 就停）。
- 难度：按技巧分级而不是只按已知格数量——至少区分：唯余 / 隐式唯一 / 对对消（naked pair）/ 指向对。后段可出现。
- 笔记：每格 1–9 小标记。
- 冲突：填入后同行列宫高亮，**不要立刻判负**；闯关可开「错 3 次失败」。
- 变体关：不规则宫（jigsaw）、对角线（名称自拟「对角花」）、4×4 入门、6×6。

胜负：盘面填满且合法即胜。对战比用时。无尽：连续解题，错 3 题结束，`recordEndlessBest`。

### meta
```
id: "sudoku-petal"
title: "数独花田"
emoji: "9️⃣"
category: "edu"
color: "#E8DDFF"
blurb: "每一行、每一列、每一朵九宫花都要种满 1 到 9。提示只讲方法，不把答案写在攻略里。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
ageHint: 9
```
端：双端。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 合法 | `isValidPlacement` |
| 解计数 | `countSolutions(limit=2)` |
| 生成 | `generate(seed, diff)` |
| 技巧检测 | `hintTechnique`（给玩家的提示等级，不直接填） |
| 评分 | `starsByTimeAndErrors` |

### 模式
闯关 188 题。对战同题。无尽马拉松。双人分盘或同题。

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 四宫萌芽 | 24 | 4×4 |
| 2 | 六宫苗 | 24 | 6×6 |
| 3 | 唯余九宫 | 24 | 9×9 入门 |
| 4 | 铅笔笔记 | 24 | 必须用笔记三星 |
| 5 | 成对花 | 22 | naked pair 关 |
| 6 | 对角花 | 22 | 对角线约束 |
| 7 | 异形宫 | 24 | jigsaw |
| 8 | 花田杯 | 24 | 高难唯一解 |

24×4 + 22×2 + 24×2 = 188。

**攻略 `guide.ts` 只讲方法（先看宫再看行），严禁写某关答案。** `copy.test.ts` 风格自检：guide 里不能出现完整 81 数字串。

### 前端建模与动画
DOM 表格。选中宫高亮。填入有小缩放。完成时九宫依次开花，不要瞬变满屏。

### AI 档位
竞速：按生成时记录的「最小技巧路径」逐步填，档位控制每步延迟。

### 可参考 GitHub（结构 only，禁止运行时依赖）
开源 sudoku generator（唯一解回溯）。不引入 npm 求解库。

### 独占
只许 `src/games/sudoku-petal/**`，可选 `scripts/smoke-step5-c.mjs`。禁止本步 A/B、`math-farm`、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 25（硬性 ≥ 15）
188 题 `countSolutions===1`、冲突检测、4×4/6×6、对角规则、挖洞不破坏唯一、笔记不计入完成。

### 不要做什么
- 不要随机填到多解。
- 不要在 guide 里写答案。

### 验收 checkbox
- [ ] 唯一解生成；188 + 对战 + 无尽
- [ ] 360px 数字钮可点；完成有逐宫动画
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 C、生成器策略、188 唯一解如何断言、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
