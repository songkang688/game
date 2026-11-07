# 1.4 · 窗口 5 状态表 —— 纵深 / 伪 3D 10 款 + 跑道套件统一

> 窗口分支 `game-1.4-window5`（从 `origin/game-1.4` @ `10926b9b` 砍出，2026-11-07）。工人模型 `claude-opus-5-5-xhigh-fast`。
> 状态五种：`未派` / `在跑` / `待验` / `已验收` / `打回`。本表只由窗口 5 统筹维护；主管登记表见 `docs/plan-1.4-tracker.md`。
> 行格式：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。
> 本窗统筹的本地工作区是独立 worktree `D:\Projects\yd-w5`（主目录 `D:\Projects\game` 被多个窗口共用，不在那里切分支）。

## 〇、闸门

| 闸门 | 状态 |
| --- | --- |
| `w5-infra-runner` 合进 `game-1.4-window5`（之后才开任何 t3；之前 rainbow-run / duo-rush / gold-hook / sling-birds 四目录不派 t1） | 未过 |
| `w5-infra-runner` 合进 `game-1.4`（之后其他窗口才接 runner） | 未过 |
| `w1-infra-feel` 合进 `game-1.4`（之后 t2 才做工序 D；之前 t2 只做 E/F） | 未过 |
| 10 款 t1 / t2 / t3 全部已验收（之后才派三轮验收） | 未过 |

## 一、基建与验收格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w5-infra-runner | 未派 | | | | 第一波；独占 rainbow-run / duo-rush / gold-hook / sling-birds 的 view3d.ts / view25d.ts / depth12.ts |
| w5-r1-tester | 未派 | | | | 全部工单已验收后 |
| w5-r1-learner | 未派 | | | | r1 tester IDLE 后，与 fixer 并行 |
| w5-r1-fixer | 未派 | | | | |
| w5-r2-tester | 未派 | | | | |
| w5-r2-learner | 未派 | | | | |
| w5-r2-fixer | 未派 | | | | |
| w5-r3-tester | 未派 | | | | |
| w5-r3-learner | 未派 | | | | |
| w5-r3-fixer | 未派 | | | | |

## 二、游戏格（10 款 × t1 / t2 / t3）

| id | t1（A+B+C） | t2（D+E+F） | t3（G 纵深） | 纵深定级 | 备注 |
| --- | --- | --- | --- | --- | --- |
| rainbow-run | 未派 | 未派 | 未派 | 伪 3D（全套） | 已有 runCampaign；`view3d.ts` 由基建适配；`PROGRESS_KEY` 不改；t3 最后派 |
| duo-rush | 未派 | 未派 | 未派 | 伪 3D（分屏双相机） | 无战役：四模式模拟；让分芯片在台账；`.dr-keys` 不隐藏；t3 最后派 |
| red-blue-race | 未派 | 未派 | 未派 | 2.5D → 伪 3D | A/B 可分 |
| bumper-cars | 未派 | 未派 | 未派 | 2.5D | |
| bowling-lane | 未派 | 未派 | 未派 | 2.5D | U-13 已修勿回退 |
| poop-hero | 未派 | 未派 | 未派 | 伪 3D（仅俯冲段） | 620 档只加 `840 && min-height:621` 轻钳 |
| hop-pads | 未派 | 未派 | 未派 | 2.5D | |
| gold-hook | 未派 | 未派 | 未派 | 2.5D（已有 depth12） | 双钩手 A/B；`depth12.ts` 由基建适配；t1 等基建 IDLE |
| sling-birds | 未派 | 未派 | 未派 | 2.5D（已有 depth12） | `depth12.ts` 由基建适配；t1 等基建 IDLE |
| snow-fight | 未派 | 未派 | 未派 | 2.5D | N-55 已修勿回退 |

## 三、工单流水（一行一工单，按时间追加）

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |

## 四、需求单（给窗口 1 / 主管）

（空）

## 五、事故与备注

（空）
