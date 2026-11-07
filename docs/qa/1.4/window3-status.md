# 1.4 · 窗口 3 状态表（休闲益智 21 款 + 本窗三轮验收）

> 窗口分支 `game-1.4-window3`（从 `origin/game-1.4` @ `10926b9b` 砍出）。规格：`docs/plan-1.4-window3.md`、`docs/plan-1.4-worker-game.md`、`docs/plan-1.4-worker-qa.md`。
> 状态：`未派` / `在跑` / `待验` / `已验收` / `打回`。工人模型 `claude-opus-5-5-xhigh-fast`，并发上限 6。
> 一行一工单：`w3-<id>-t<k> | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、水位

| 项 | 值 |
| --- | --- |
| 基线 | `origin/game-1.4` @ `10926b9b` |
| 窗口分支 | `game-1.4-window3` |
| 全量用例水位（上一张工单后） | 基线：1255 个 `*.test.ts`（1.3.4 发版实跑 1249 文件 / 19730 例） |
| 当前在跑 | 0 |

## 一、工单（21 款 × t1 / t2）

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w3-mine-garden-t1 | 未派 | | | | 波 1；首点安全 + 可推理；末排在台账；布雷 seed 不改 |
| w3-mine-garden-t2 | 未派 | | | | |
| w3-lianliankan-t1 | 未派 | | | | 波 1；可消路径 / 洗牌保底；密格豁免热区（台账） |
| w3-lianliankan-t2 | 未派 | | | | |
| w3-puzzle-tiles-t1 | 未派 | | | | 波 1；奇偶校验可还原；N-108 已修；打乱 seed / 判定不改 |
| w3-puzzle-tiles-t2 | 未派 | | | | |
| w3-memory-cards-t1 | 未派 | | | | 波 1；成对偶数张；算式卡唯一解；N-115 勿回退 |
| w3-memory-cards-t2 | 未派 | | | | |
| w3-match-stars-t1 | 未派 | | | | 波 1；目标分可达；末行可滚（台账） |
| w3-match-stars-t2 | 未派 | | | | |
| w3-bubble-pop-t1 | 未派 | | | | 波 1；限步 ≥ 最优解 ×1.3（求解器） |
| w3-bubble-pop-t2 | 未派 | | | | |
| w3-merge-2048-t1 | 未派 | | | | 波 2；步数预算内可达（期望模拟） |
| w3-merge-2048-t2 | 未派 | | | | |
| w3-block-drop-t1 | 未派 | | | | 波 2；seed 序列下行数目标可达；view25d reduced 工具别拆 |
| w3-block-drop-t2 | 未派 | | | | |
| w3-bubble-aim-t1 | 未派 | | | | 波 2；三消泡泡阵可清 |
| w3-bubble-aim-t2 | 未派 | | | | |
| w3-brick-break-t1 | 未派 | | | | 波 2；砖阵可清空；L1 底切在台账；物理 / 球速零触碰 |
| w3-brick-break-t2 | 未派 | | | | |
| w3-balloon-pop-t1 | 未派 | | | | 波 2；顺序关必有合法顺序；`SKY_H=420` 禁改 |
| w3-balloon-pop-t2 | 未派 | | | | |
| w3-mole-pop-t1 | 未派 | | | | 波 2；时长 × 频率 ≥ 目标；算式鼠唯一解；洞 ≥56px 守门；rhythm.ts 不动 |
| w3-mole-pop-t2 | 未派 | | | | |
| w3-fruit-catch-t1 | 未派 | | | | 波 3；密度下可接；双人公平；`canvasDisplayCapPx` / `MIN_CANVAS_DISPLAY_PX=160` 别改 |
| w3-fruit-catch-t2 | 未派 | | | | |
| w3-fruit-stack-t1 | 未派 | | | | 波 3；堆高目标可达 |
| w3-fruit-stack-t2 | 未派 | | | | |
| w3-fishing-star-t1 | 未派 | | | | 波 3；已有 runCampaign，换种子 [7,11,13] 复跑 |
| w3-fishing-star-t2 | 未派 | | | | |
| w3-alien-seek-t1 | 未派 | | | | 波 3；限时可找到；推理线索闭合；C-6 pads 基线 |
| w3-alien-seek-t2 | 未派 | | | | |
| w3-pool-stars-t1 | 未派 | | | | 波 3；球局可清；`MAX_VERTICAL_PX=560` 口径 |
| w3-pool-stars-t2 | 未派 | | | | |
| w3-shoot-range-t1 | 未派 | | | | 波 3；目标分可达；好人靶不与坏靶同位；三键 ≥44 已修 |
| w3-shoot-range-t2 | 未派 | | | | |
| w3-snake-snack-t1 | 未派 | | | | 波 4；果子不落蛇身；`SR_SHORT_PANE_H=200` 不改；N-61 不加二套垫 |
| w3-snake-snack-t2 | 未派 | | | | |
| w3-tap-tiles-t1 | 未派 | | | | 波 4；速度 × 判定窗 ≥ 250 ms；`.tt-keys{display:none}` 禁盲拷 |
| w3-tap-tiles-t2 | 未派 | | | | |
| w3-kitty-care-t1 | 未派 | | | | 波 4；任务时长内可完成，无负反馈循环 |
| w3-kitty-care-t2 | 未派 | | | | |

## 二、验收格

| 格 | 状态 | 派发时间 | SHA | 备注 |
| --- | --- | --- | --- | --- |
| w3-r1-tester | 未派 | | | 21 款 t1 + t2 全绿后 |
| w3-r1-learner | 未派 | | | |
| w3-r1-fixer | 未派 | | | |
| w3-r2-tester | 未派 | | | |
| w3-r2-learner | 未派 | | | |
| w3-r2-fixer | 未派 | | | |
| w3-r3-tester | 未派 | | | |
| w3-r3-learner | 未派 | | | |
| w3-r3-fixer | 未派 | | | |

## 三、需求单

### 给窗口 1

（暂无）

### 给窗口 5

（暂无）

## 四、事件日志

| 时间 | 事件 |
| --- | --- |
| 2026-11-07 15:30 | 从 `origin/game-1.4` @ `10926b9b` 砍出 `game-1.4-window3`，建本表 |
