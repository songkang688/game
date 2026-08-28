# 三人组父监督 · UX-99（合入 `game-1.3`）

父监督只编排、对账、派发。每轮 **2 个测试修复员（测+修）+ 1 个学习优化员（学+记）**。学习员 playbook 是下一轮 A/B 的任务单。有空闲立刻派该角色下一任。全部合入 **`game-1.3`**。

父监督 run：https://cursor.com/agents/bc-eb8bd9cd-7302-482c-b4e0-c234b606c9c6

## 角色

| 角色 | 做什么 | 独占 |
| --- | --- | --- |
| **测试修复员 A** | 壳层 + 闯关学习；不好用立刻修 | `src/styles.css`、`src/ui/{home,parentAuth,collection,dialogs}`、level99/quiz99 与学习款 |
| **测试修复员 B** | 休闲 / 对战 / 动手；不好用立刻修 | 对战休闲目录（fight-king、duo-*、brave-path 等） |
| **学习优化员** | skills + 他人窗口 + 无头抽验；**零改 `src/**`** | 只写 `docs/qa/trio-rN-learn-notes.md` + `trio-rN-playbook.md` |

## 红线

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。
- 管理员密码 `kangkang`：默认 **1 小时**，可设 **永久**；开着全关解锁；密码不落盘。
- 主测视口：手机竖屏 **390×844**（必须能划到底）、平板横屏 **915×412**（关卡地图/按钮不得裁切）。
- 禁 force。rebase 后 `npm test` && `npm run build`。学习员禁止改游戏代码。
- 同一 playbook 同一角色已有 RUNNING 则不加派。

## Wave 1（本拍已派，= 战役轮 1 / trio-r18）

进场主干：`30cc10ab`（已摘合 N-77 / N-87 / N-88 / N-47 仓鼠地鼠芯片）。

| 角色 | bcId | 模型 | 任务 |
| --- | --- | --- | --- |
| A | `bc-5ad2f2d2-3c6e-5616-a7d2-69dfacea5c27` | claude-fable-5-thinking-xhigh | 壳+学习：kangkang、390/915、N-77 回归、选关滚动 |
| B | `bc-e60fef30-e72c-5a3f-9831-33e6a0319fc4` | claude-fable-5-thinking-xhigh | 休闲对战：N-87/88 回归、N-75…N-86、分屏/底栏 |
| 学习 | `bc-d2bf53f9-1548-5129-9e9b-0ef06fa75054` | claude-fable-5-thinking-xhigh | skills + 窗口配方；`trio-r18-learn-notes` + playbook（N-89 起） |

并行注意：环境里另有「学习员第8轮记 r17 笔记」「测试B第3轮」RUNNING。本拍 A/B/学习写 **r18 新文件**，禁止覆盖 r14–r16，禁止重做已合 N 号。

## 调度（有空闲立刻派）

1. 谁先交卷（push 到 `game-1.3` 或可 rebase 的功能分支），父监督立刻派 **同一角色** 的下一轮。
2. 下一轮 A/B **必须先读最新** `docs/qa/trio-rN-playbook.md`（学习员刚合入的那份）。
3. 学习员编号连续递增；A/B 执行上一份 playbook 未销项 + 新伤。
4. 定时器约 15 分钟对账一次：list RUNNING，空闲且无撞车才加派。
5. 战役轮次记在本文件；目标持续迭代（用户口头「99 轮」= 有空闲就派，**同一时刻只保持 3 路在途**，不并行堆 99 个进程）。

## 对账日志

| 时点 | `game-1.3` | 结论 |
| --- | --- | --- |
| Wave 1 派出 | `30cc10ab` | A/B/学习三路并行，见上表 |
