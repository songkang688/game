# 1.4 · 窗口 1 状态表（壳层 / 框架 / 手感套件 + 学习与动手 9 款）

> 本窗分支 `game-1.4-window1`（从 `origin/game-1.4` @ `10926b9b` 砍出）。窗口本体工作区：`D:\projects\yd-w1`（独立 worktree；`D:\projects\game` 由其他窗口共用，本窗不切它的分支）。
> 工人模型 slug：`claude-opus-5-5-xhigh-fast`；并发上限 6，`run_in_background=true`。
> **派发方式：本地并发（云端不可用）。** 15:38 首波 6 个 `environment=cloud` 工人全部返回 `[unauthenticated] Please reconnect GitHub in Cursor`（Cursor 未连接 GitHub 集成，本机 `gh` 登录不算），按主管指示改本地：每个工人一个独立 worktree `D:\projects\yd-w1-<id>`、分支 `game-1.4-window1-<id>`（砍自 `origin/game-1.4-window1`），工人只 commit 不 push、只跑定向测试；IDLE 后窗口合进 `game-1.4-window1`、跑全量、推远端、`git worktree remove`。
> 本机工具链：Node 22 便携版 `D:\tools\node22`（v22.23.4）；无 Chrome，无头浏览器用 Edge；`rg` 用 Cursor 自带的 ripgrep。
> 状态：`未派` / `在跑` / `待验` / `已验收` / `打回` / `ERROR`。一行一工单：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、基建与验收格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w1-infra-feel | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-infra-feel`；全绿后立刻报主管合进 game-1.4 |
| w1-infra-frame | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-infra-frame`；level99 锚定 + l99-host 守门 + measure-viewports.mjs |
| w1-r1-tester | 未派 | | | | 9 款 t1+t2 全部已验收后才派 |
| w1-r1-learner | 未派 | | | | tester IDLE 后与 fixer 并行 |
| w1-r1-fixer | 未派 | | | | |
| w1-r2-tester | 未派 | | | | |
| w1-r2-learner | 未派 | | | | |
| w1-r2-fixer | 未派 | | | | |
| w1-r3-tester | 未派 | | | | |
| w1-r3-learner | 未派 | | | | |
| w1-r3-fixer | 未派 | | | | |
| w1-release-docs | 未派 | | | | 等主管通知五窗全绿后才派 |

## 一、9 款游戏格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w1-clock-house-t1 | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-clock-house`；quiz99 出题器 |
| w1-clock-house-t2 | 未派 | | | | 840 横屏钟面 min(42vh,220px) 守 MIN_FACE_PX |
| w1-math-farm-t1 | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-math-farm`；runner.ts 禁盲拷 500 档 |
| w1-math-farm-t2 | 未派 | | | | |
| w1-sudoku-petal-t1 | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-sudoku-petal`；188 关唯一解（求解器计数 = 1） |
| w1-sudoku-petal-t2 | 未派 | | | | 人机对战档不卡死 |
| w1-music-stars-t1 | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-music-stars`；N-113 工具排已修勿回退 |
| w1-music-stars-t2 | 未派 | | | | 双声部节拍判定窗口 ≥ 120 ms |
| w1-find-diff-t1 | 未派 | | | | 第二波；三图/旋转/镜像关「不同」像素差阈值测试 |
| w1-find-diff-t2 | 未派 | | | | |
| w1-pinyin-train-t1 | 未派 | | | | 第二波；scene.ts / timed.ts 禁盲拷；多音字唯一正确答案 |
| w1-pinyin-train-t2 | 未派 | | | | |
| w1-shape-kingdom-t1 | 未派 | | | | 第二波；周长面积不得出现非整数陷阱 |
| w1-shape-kingdom-t2 | 未派 | | | | |
| w1-word-garden-t1 | 未派 | | | | 第二波；tracing.ts 第二处花园 10vh 不盲拷；题库去重 |
| w1-word-garden-t2 | 未派 | | | | |
| w1-color-fun-t1 | 未派 | | | | 第二波；渐变/限色判定容差写成常量 + 测试 |
| w1-color-fun-t2 | 未派 | | | | |

## 二、收到的框架需求单（主管转来 / 其他窗口写在各自 status 的「给窗口 1」段）

| 编号 | 来源窗口 | 内容摘要 | 状态 | 工单 | SHA |
| --- | --- | --- | --- | --- | --- |
| （暂无） | | | | | |

## 三、给主管的事项

- （待 feel / frame 全绿后填）feel / frame 已推 SHA ____，请合进 game-1.4。

## 四、日志

| 时间 | 事项 |
| --- | --- |
| 2026-11-07 15:30 | 开工：建 worktree `D:\projects\yd-w1`，砍 `game-1.4-window1`，建本状态表并推远端（5f3b3d71）。 |
| 2026-11-07 15:38 | 首波 6 个云端工人全部 `unauthenticated`（Cursor 未连接 GitHub），0 个启动。 |
| 2026-11-07 15:45 | 改本地并发：建 6 个工人 worktree + 分支，Node 22 便携版就位，重派第一波 6 张：infra-feel、infra-frame、clock-house-t1、math-farm-t1、sudoku-petal-t1、music-stars-t1。 |
