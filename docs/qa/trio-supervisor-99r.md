# 三人组 99 轮战役 · 监督对账（父监督 bc-90e40d7d）

> 战役规则沿用 `trio-supervisor-ux99.md`（PR #81）：每轮 2 测试修复员 + 1 学习优化员，全部合入 `game-1.3`，
> 同一时刻只保持 3 路在途。本文件按轮追加，不改 `trio-supervisor-10r.md` / `trio-supervisor-ux99.md` 的对账表。

## 第 1 轮（trio-r18）

| 角色 | 分支 / 交付 | 模型 | 状态 |
| --- | --- | --- | --- |
| 测试修复员 A | bc-5ad2f2d2（壳+学习：kangkang、390/915、N-77 回归、选关滚动） | claude-fable-5-thinking-xhigh | 在途 |
| 测试修复员 B | bc-e60fef30（休闲对战：N-87/88 回归、N-75…N-86、分屏/底栏） | claude-fable-5-thinking-xhigh | 在途 |
| 学习优化员 | `cursor/trio-r18-learner-c337` → `trio-r18-learn-notes.md` + `trio-r18-playbook.md` | claude-fable-5-thinking-xhigh | 交卷 |

- 学习员基线 `e58ccceb`，进场=交卷水位 **1193 files / 19489 tests，其中 2 文件 / 5 用例红**（= N-99，PR #78 带入的
  14px 违反 360px 守门；r17-A 的绿灯在 PR #78 合入之前，故当时没炸）。学习员零改 `src/**`，只上账。
- 新伤 **N-92…N-99**（level99 进场卷顶、duo-vs-star 选人/赛中、bumper-cars 画布、ice-fire-forest 画布、xiangqi 面板、landlord 触区、主干红灯）。
- 第 2 轮 A/B 任务单：`trio-r18-playbook.md`（B 第一优先 N-99 抢修红灯，再 N-94/N-93/N-97；A 主攻 N-92）。
