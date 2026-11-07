# 1.4 · 窗口 4 状态表 —— 对战棋牌 19 款 + 本窗三轮验收

> 窗口分支 `game-1.4-window4`，从 `origin/game-1.4` @ `10926b9b` 砍出（2026-11-07）。
> 主管登记表（只读）：`docs/plan-1.4-tracker.md`。本表由窗口 4 统筹维护，工人不改。
> 一行一工单：`w4-<id>-t<k> | 状态 | 派发时间 | SHA | 用例水位 | 备注`。状态五种：`未派` / `在跑` / `待验` / `已验收` / `打回`。
> 工人模型 slug：`claude-opus-5-5-xhigh-fast`；并发上限 6；同一款游戏同一时刻只有一个工人。

## 〇、水位

| 项 | 值 | 记录 |
| --- | --- | --- |
| 分支基线 | `game-1.4-window4` ← `origin/game-1.4` @ `10926b9b` | 2026-11-07 15:30 |
| 用例水位（起点） | 以主管登记表 r19 实测为准：1193 文件 / 19489 用例；本窗第一张工单验收时以工人回复的全量数为新水位 | — |
| feel 套件（`w1-infra-feel`） | 未合进 `origin/game-1.4` → 本窗 `t2` 开前先 fetch 确认；没有就只做 E/F，D 待接 | — |
| 测量工装（`w1-infra-frame`） | 同上 | — |

## 一、派发波次（规划）

| 波 | 6 个槽 |
| --- | --- |
| 1 | landlord-cards-t1、mahjong-bloom-t1、chess-garden-t1、xiangqi-t1、gomoku-t1、junqi-camp-t1 |
| 2 | weiqi-garden-t1、flight-chess-t1、hero-cards-t1、dark-chess-t1、star-estate-t1、hue-hand-t1 |
| 3 | fight-king-t1、combo-clash-t1、duo-vs-star-t1、puff-bros-t1、duo-arena-t1、red-blue-tap-t1 |
| 4 | red-blue-tug-t1 + 5 个 t2（t1 已验收且 feel 套件已到的款） |
| 5–7 | 19 款 t2；LOC > 6000 的（duo-vs-star / puff-bros / fight-king / gomoku / combo-clash）拆 t2a / t2b 串行 |
| 8 | 三轮验收（每轮 tester → learner + fixer），串行 |

## 二、工单表（19 款 × t1 / t2）

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w4-landlord-cards-t1 | 未派 | | | | 波 1；牌型全集 / 188 层地主塔 / 三人 AI 不偷看 |
| w4-landlord-cards-t2 | 未派 | | | | |
| w4-mahjong-bloom-t1 | 未派 | | | | 波 1；胡牌判定全集 / 八番门槛；N-105 已修 |
| w4-mahjong-bloom-t2 | 未派 | | | | |
| w4-chess-garden-t1 | 未派 | | | | 波 1；易位 / 过路兵 / 升变 / 三次重复 / 50 步；N-112、U-9 勿回退 |
| w4-chess-garden-t2 | 未派 | | | | |
| w4-xiangqi-t1 | 未派 | | | | 波 1；将帅照面 / 困毙 / 长将判负；残局有解 |
| w4-xiangqi-t2 | 未派 | | | | 键排 max-width:699 && 840 && 501 档已有 |
| w4-gomoku-t1 | 未派 | | | | 波 1；188 残局算杀全有解；算杀档不超时 |
| w4-gomoku-t2 | 未派 | | | | LOC > 6000 → t2a / t2b |
| w4-junqi-camp-t1 | 未派 | | | | 波 1；工兵排雷 / 军旗 / 行营 / 铁路；布阵合法性 |
| w4-junqi-camp-t2 | 未派 | | | | |
| w4-weiqi-garden-t1 | 未派 | | | | 波 2；提子 / 打劫 / 数目；AI 不自填眼；N-10 残余在台账 |
| w4-weiqi-garden-t2 | 未派 | | | | |
| w4-flight-chess-t1 | 未派 | | | | 波 2；掷骰 / 跳格 / 飞线；四人 AI 不死循环；U-14 已修 |
| w4-flight-chess-t2 | 未派 | | | | |
| w4-hero-cards-t1 | 未派 | | | | 波 2；花主 / 身份 / 距离技能；AI 出牌合法；U-15 已修 |
| w4-hero-cards-t2 | 未派 | | | | |
| w4-dark-chess-t1 | 未派 | | | | 波 2；先翻定色 / 吃子规则 / 残局；暗子观察格豁免 |
| w4-dark-chess-t2 | 未派 | | | | |
| w4-star-estate-t1 | 未派 | | | | 波 2；188 关经济曲线蒙特卡洛不必然破产；N-3 / U-1 勿回退 |
| w4-star-estate-t2 | 未派 | | | | 地格 26px 豁免 |
| w4-hue-hand-t1 | 未派 | | | | 波 2；颜色 / 数字接龙；剩一张提醒；AI 合法 |
| w4-hue-hand-t2 | 未派 | | | | 暗牌区 840 档 min-height:64px |
| w4-fight-king-t1 | 未派 | | | | 波 3；轻重击连段；188 格斗塔 AI 档；N-111 菜单可滚 |
| w4-fight-king-t2 | 未派 | | | | LOC > 6000 → t2a / t2b |
| w4-combo-clash-t1 | 未派 | | | | 波 3；取消 / 超必杀窗口 ≥ 120 ms；N-105 16px 已修 |
| w4-combo-clash-t2 | 未派 | | | | LOC > 6000 → t2a / t2b |
| w4-duo-vs-star-t1 | 未派 | | | | 波 3；2v2 / 无尽 / 188 关每关存活可达 |
| w4-duo-vs-star-t2 | 未派 | | | | LOC > 6000 → t2a / t2b |
| w4-puff-bros-t1 | 未派 | | | | 波 3；合作 / 对战两套模拟；A/B 三层可分 |
| w4-puff-bros-t2 | 未派 | | | | LOC > 6000 → t2a / t2b |
| w4-duo-arena-t1 | 未派 | | | | 波 3；无战役：对战 / 无尽可开局、三回合可结束、不卡死 ×3 种子 |
| w4-duo-arena-t2 | 未派 | | | | 开擂 CTA 在屏 |
| w4-red-blue-tap-t1 | 未派 | | | | 波 3；节奏 ≥ 孩子反应；`SHORT_LANDSCAPE_PX=420` 禁改 |
| w4-red-blue-tap-t2 | 未派 | | | | 🔵22 观察格豁免 |
| w4-red-blue-tug-t1 | 未派 | | | | 波 4；双人键位零交集 |
| w4-red-blue-tug-t2 | 未派 | | | | |

## 三、验收格

| 格 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w4-r1-tester | 未派 | | | | 19 款 t1 + t2 全部已验收后 |
| w4-r1-learner | 未派 | | | | r1-tester IDLE 后与 fixer 并行 |
| w4-r1-fixer | 未派 | | | | |
| w4-r2-tester | 未派 | | | | |
| w4-r2-learner | 未派 | | | | |
| w4-r2-fixer | 未派 | | | | |
| w4-r3-tester | 未派 | | | | |
| w4-r3-learner | 未派 | | | | |
| w4-r3-fixer | 未派 | | | | |

## 四、给窗口 1 的需求单

（暂无）

## 五、给窗口 5 的需求单

（暂无）

## 六、派发日志

| 时间 | 事件 |
| --- | --- |
| 2026-11-07 15:30 | 建分支 `game-1.4-window4`；建本表 |
| 2026-11-07 15:35 | 事故记录：五个窗口统筹共用 `D:\Projects\game` 主工作目录，窗口 2 的 `e416e447`（`docs/qa/1.4/window2-status.md`）在本窗 checkout 期间落到了 `game-1.4-window4` 并随首推上了远端（禁 force，不回退）。处置：窗口 4 改在独立 worktree `D:\Projects\yd-w4` 操作；建议窗口 2 把 `e416e447` cherry-pick 到 `game-1.4-window2`（同一提交对象，主管合并时零冲突），本窗不再碰该文件 |
