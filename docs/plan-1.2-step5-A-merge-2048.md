# 1.2 第 5 步 · A 档 —— `merge-2048`「星星合成」

> 短计划：独占新建 `src/games/merge-2048/`。本步另两档是 `mine-garden`、`sudoku-petal`。
> 经典滑向合并 2 的幂。禁止商标。滑行必须有 tween，禁止瞬移合并。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 5 步 · A 档**：新建 `merge-2048`「星星合成」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，rebase 后测绿普通 push，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.merge-2048`。
- 操作：WASD 或滑屏四向；双人分盘（朵朵 WASD，星星方向键）。Esc 暂停。360px 格子间距足够，数字 ≥ 16px，热区整格可滑。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。
- **收藏只读**：`luckMul` 可微调 4 的生成率（仍要单测 2 为多数）。禁止改 collection 源文件。暂停可 `openCollection("merge-2048")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则（经典 2048）
- 默认 4×4。每回合把所有块沿方向滑到不能再滑，**相同数字相撞合并一次**（新合成块本回合不再二次合并）。
- 合并得分 = 新块数字。出现 2048 先弹出「达成」可继续。
- 每回合若有移动，在随机空格生成 **2（90%）或 4（10%）**。无空格且四向都不能动 → 失败。
- 变体（闯关后段）：3×3、5×5、不可移动障碍花、限步、必须合成指定数。

禁止：消完瞬变。每块要有 **滑行 tween**（80–140ms），合并有短促放大。reduced-motion：瞬移但保留顺序。

### meta
```
id: "merge-2048"
title: "星星合成"
emoji: "🔢"
category: "casual"
color: "#FFF3C8"
blurb: "同一数字撞在一起就会变成更大的星星。合成到 2048，还可以继续往上叠。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 滑动 | `slideRow(row) → {row, moved, score, merges}` |
| 四向 | `move(board, dir)` |
| 生成 | `spawn(board, rng)` |
| 终局 | `canMove` `hasTile(n)` |
| 变体 | `applyHazards` |

### 模式
| 模式 | 做 | 为什么 |
| --- | --- | --- |
| 闯关 188 | 做 | 目标数字从 32 升到 4096，穿插障碍 |
| 无尽 | 做 | 经典马拉松记最高分 `recordEndlessBest` |
| 对战 | 做 | 同 seed 竞速谁先到目标 |
| 双人 | 做 | 分盘 |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 小数入门 | 24 | 4×4 目标 32/64 |
| 2 | 一二八 | 24 | 目标 128 |
| 3 | 五一二花园 | 24 | 目标 512 |
| 4 | 二千零四八 | 24 | 目标 2048 |
| 5 | 障碍花 | 22 | 不可滑入的格 |
| 6 | 三乘三 / 五乘五 | 22 | 变棋盘 |
| 7 | 限步挑战 | 24 | 步数上限 |
| 8 | 合成杯 | 24 | 4096 / 对战竞速 |

24×4 + 22×2 + 24×2 = 188。生成器用 seed，每关从固定开局出发可达成（测试用搜索或作者验证的开局）。

### 前端建模与动画
DOM 或 Canvas 圆角砖，粉彩配色。分数 HUD。合并播 `coin`/`pop`。滑行 tween 必须可见。

### AI 档位
对战假人：菜鸟随机合法方向；普通贪心得分；高手空位+单调性启发。

### 可参考 GitHub（结构 only，禁止运行时依赖）
https://github.com/gabrielecirulli/2048 （滑动与合并顺序，不抄皮肤）

### 独占
只许 `src/games/merge-2048/**`，可选 `scripts/smoke-step5-a.mjs`。禁止本步 B/C、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 20（硬性 ≥ 15）
同行二次合并禁、2/4 生成概率可用伪随机测频率、不能动才结束、障碍格、188 章和、滑动幂等（空滑不 spawn）。

### 不要做什么
- 不要做成三消。
- 不要无动画。

### 验收 checkbox
- [ ] 滑动合并规则正确 + 动画
- [ ] 188 + 无尽 + 对战竞速；360px 数字清晰
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 A、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
