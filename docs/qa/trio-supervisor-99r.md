# 三人组 99 轮战役 · 监督对账（父监督 bc-90e40d7d）

> 战役规则沿用 `trio-supervisor-ux99.md`（PR #81）：每轮 2 测试修复员 + 1 学习优化员，全部合入 `game-1.3`，
> 同一时刻只保持 3 路在途。本文件按轮追加，不改 `trio-supervisor-10r.md` / `trio-supervisor-ux99.md` 的对账表。

## 第 1 轮（trio-r18）

| 角色 | 分支 / 交付 | 模型 | 状态 |
| --- | --- | --- | --- |
| 测试修复员 A | bc-5ad2f2d2（壳+学习：kangkang、390/915、N-77 回归、选关滚动） | claude-fable-5-thinking-xhigh | 在途 |
| 测试修复员 B | bc-e60fef30（休闲对战：N-87/88 回归、N-75…N-86、分屏/底栏） | claude-fable-5-thinking-xhigh | 在途 |
| 学习优化员（先合） | `8b23ab11`：r18 笔记/playbook 主文（N-98 hue-hand、N-99 sudoku-petal；r17 云补测改号 N-94…N-97） | — | 交卷已合 |
| 学习优化员（本拍） | `cursor/trio-r18-learner-c337`：撞车让位先合版，独有发现改号 **N-100…N-105** 以附录并入两份 r18 文件 | claude-fable-5-thinking-xhigh | 交卷 |

- 撞车处理：两位 r18 学习员并行，`trio-r18-learn-notes.md` / `trio-r18-playbook.md` 取先合版全文，本拍补充段追加文末；
  原拟 N-92/N-93 弃用（r17 对账点名防混淆），duo-vs-star 选人 / xiangqi 自由对战两条与先合版 N-94/N-95 重叠，折进回归证据。
- 本拍独有新伤 **N-100…N-105**：level99 进场卷顶（A）、duo-vs-star 赛中键柱（B 重）、bumper-cars 画布+触区（B）、
  ice-fire-forest 画布切 59（B）、landlord 回选关触区 33（B 轻）、**主干红灯**（B 最优先：PR #78 的 14px 破 360px ≥16px 守门，5 用例红）。
- 实测水位 @ `e58ccceb`：**1193 files / 19489 tests，2 文件 5 用例红**（= N-105；先合版沿用的 1182/19477 是 PR #78 合入前旧数）。
- 第 2 轮 A/B 任务单：`trio-r18-playbook.md`（主文 + 附录）。B 第零优先 N-105 抢修红灯；A 主攻 N-99/N-100。
