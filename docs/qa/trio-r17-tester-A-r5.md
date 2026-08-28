# 三人组第 17 轮 · 测试修复员 A 第 5 工位（本机，云 VM 满）

基线：`644201d9`。执行 `trio-r17-playbook.md` **N-89**。

## 已关

| 编号 | 修法 |
| --- | --- |
| **N-89** | `@media (max-height:500px)` 增加 `.game-screen` 顶栏：padding 0、标题 min-height 44、藏 emoji。不改 `OA_SHORT_PANE_H`。S-1 首页 44 芯片保留。 |

## 测试

- `src/ui/shellTitle.n89.test.ts` 绿
- 未改学习关玩法 / 题库 / seed

## 未做

N-68/73/77 只许回归（r4 已绿）。B 的 N-90/91/12/10/60 未碰。
