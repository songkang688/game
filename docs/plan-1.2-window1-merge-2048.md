# 窗口 1 · 第 5 步 A 档 · `merge-2048`「星星合成」工作计划

对照规格：`docs/plan-1.2-step5-A-merge-2048.md`。
本档只碰 `src/games/merge-2048/**`（外加可选的 `scripts/smoke-1.2-step5-a.mjs`）。
同步骤的 `mine-garden`（B）、`sudoku-petal`（C）以及别人窗口的目录一个字都不动。

## 一、模块切分

| 文件 | 职责 | 关键导出 |
| --- | --- | --- |
| `meta.ts` | 纯数据卡片，不 import 玩法 | `meta` |
| `board.ts` | 纯函数棋盘：单行滑动、四向滑动、生成、终局、障碍花 | `slideRow` `move` `spawn` `canMove` `hasTile` `applyHazards` |
| `ai.ts` | 四档假人：菜鸟随机 / 普通贪心 / 高手加权评估 / 地狱期望最大搜索 | `chooseMove` `evalBoard` `AI_TIER_LABELS` |
| `levels.ts` | 8 章 188 关配置、固定开局、评星、限步、无尽与对战配置 | `CHAPTERS` `levelConfig` `startBoard` `starsFor` |
| `guide.ts` | 攻略（只讲方法，不给答案） | `default` |
| `index.ts` | DOM 盘面 + 战役 / 对战 / 无尽 / 双人同屏 | `meta` `mount` |

## 二、玩法基线（经典 4×4 滑动合成，不自创）

- 一次滑动里所有方块沿方向滑到底；相同数字相撞合并一次；
  **新合成的块同一回合不能再合**（`2 2 2 2` → `4 4`，`4 2 2` → `4 4`）。
- 合并顺序沿移动方向从前往后。得分加上新块的数字。
- **发生了移动才**在随机空格生成 2（90%）或 4（10%）；没动就不生成。
- 无空格且四个方向都推不动 → 本局结束。
- 变体：3×3 / 5×5、不可滑入的障碍花、限步数、必须合成到指定数字。

## 三、为什么 188 关是可达成的

每关有固定 seed 与**固定开局**：开局在盘角按蛇形摆好一条从 `ladderFrom` 到 `target/2`
的降序阶梯。玩家只要把 `ladderFrom` 这一级再造一份，就能沿阶梯一路合上去到目标。
`ladderFrom` 越大要从 2 开始堆的量越多，这就是难度旋钮。

测试侧用 `ai.ts` 的「高手」策略当固定策略回放：188 关逐关跑到目标或用光步数预算，
断言全部达成（`levels.test.ts` 的战役可达成用例）。这不是「我觉得能过」，是跑出来的。

## 四、动画与窄屏

- 每块 `MOVE_MS = 110ms` 的 `transform` 滑行 tween（落在规格要求的 80–140ms 内），
  合并时 `MERGE_MS` 的短促放大，禁止瞬变。
- `prefers-reduced-motion` 下去掉弹跳、保留位移提示。
- 360px：盘面按 `min(屏宽 - 边距, 上限)` 收缩，数字字号恒 ≥ 16px。

## 五、测试计划（规格要求 ≥ 20，硬性下限 15）

`board.test.ts` / `levels.test.ts` / `ai.test.ts` / `index.test.ts` 四个文件，覆盖：
合并顺序、同回合不再合、四向对称、没动不生成、2/4 比例区间、无路可走判负、
障碍花不可滑入、3×3 与 5×5、限步失败、`assertTotal(chapters, 188)`、
188 关可达成、固定 seed 下地狱档步数明显少于菜鸟档、`destroy` 后监听与 rAF 归零。

## 六、红线自审

离线、无外部依赖、禁 three.js；文案原创只鼓励；注释与文案都不出现商标与原作名。
