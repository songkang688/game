# 1.4 · 窗口 1 状态表（壳层 / 框架 / 手感套件 + 学习与动手 9 款）

> 本窗分支 `game-1.4-window1`（从 `origin/game-1.4` @ `10926b9b` 砍出）。窗口本体工作区：`D:\projects\yd-w1`（独立 worktree；`D:\projects\game` 由其他窗口共用，本窗不切它的分支）。
> 工人模型 slug：`claude-opus-5-5-xhigh-fast`；并发上限 6，`run_in_background=true`。
> **派发方式：本地并发（云端不可用）。** 15:38 首波 6 个 `environment=cloud` 工人全部返回 `[unauthenticated] Please reconnect GitHub in Cursor`（Cursor 未连接 GitHub 集成，本机 `gh` 登录不算），按主管指示改本地：每个工人一个独立 worktree `D:\projects\yd-w1-<id>`、分支 `game-1.4-window1-<id>`（砍自 `origin/game-1.4-window1`），工人只 commit 不 push、只跑定向测试；IDLE 后窗口合进 `game-1.4-window1`、跑全量、推远端、`git worktree remove`。
> 本机工具链：Node 22 便携版 `D:\tools\node22`（v22.23.4）；无 Chrome，无头浏览器用 Edge；`rg` 用 Cursor 自带的 ripgrep。
> 状态：`未派` / `在跑` / `待验` / `已验收` / `打回` / `ERROR`。一行一工单：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、基建与验收格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w1-infra-feel | 待验 | 11-07 15:45 | 5d913bee → 合入 59770f79 | feel.test 57 例 / kit 定向 532 例 / build 绿 | 16:04 IDLE；只改 5 个独占文件，越界检查通过；已合进 game-1.4-window1 并推远端（59770f79）。全量 `npm test` 因机器过载尚未跑完（见日志），跑完全绿即转已验收。工人报告：本机 14 例守门测试因 CRLF 在 Windows 必红，撤改动对照为同一批，非新增 |
| w1-infra-frame | 在跑 | 11-07 15:45 | | | 第一波；本地 worktree `yd-w1-infra-frame`；level99 锚定 + l99-host 守门 + measure-viewports.mjs；16:50 仍无提交、工作区有改动 |
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
| w1-clock-house-t1 | 在跑（非本会话重派） | 11-07 15:55 / 16:30 | | | 15:55 本会话派出；16:05 被用户手动停止；16:32 分支上出现新计划提交 a33cecb1——由另一份窗口 1 会话重派，本会话不再重派、不动该格 |
| w1-clock-house-t2 | 未派 | | | | 840 横屏钟面 min(42vh,220px) 守 MIN_FACE_PX |
| w1-math-farm-t1 | 在跑 | 11-07 15:55 | | | 第一波；本地 worktree `yd-w1-math-farm`；16:45 已有 2 提交（计划 + 体检报告初稿 MF-01…MF-18） |
| w1-math-farm-t2 | 未派 | | | | |
| w1-sudoku-petal-t1 | 在跑（非本会话派出） | 11-07 16:15 | | | 本会话 15:55 的派发调用参数损坏未发出；16:15 由另一份窗口 1 会话派出（同一份工人 prompt）；16:45 已有 2 提交（计划 + 工序 B 审计先红） |
| w1-sudoku-petal-t2 | 未派 | | | | 人机对战档不卡死 |
| w1-music-stars-t1 | 在跑（非本会话派出） | 11-07 16:40 | | | 本会话派发调用参数损坏未发出；16:42 由另一份窗口 1 会话派出（计划提交 6cc1c2ae）。**事故**：本会话 16:43 在以为无人使用的该 worktree 上做了换行归一（`rm --cached` + `reset --hard`），与该工人开工重叠约 1 分钟；提交完好，16:50 工作区已有新文件在推进，若有未提交草稿被丢需工人重写 |
| w1-music-stars-t2 | 未派 | | | | 双声部节拍判定窗口 ≥ 120 ms |
| w1-find-diff-t1 | 待派 | | | | 第二波；worktree `yd-w1-find-diff` 已建（基于 59770f79）；等主管确认只剩一份窗口 1 统筹后再派，避免重派 |
| w1-find-diff-t2 | 未派 | | | | |
| w1-pinyin-train-t1 | 待派 | | | | 第二波；分支 `game-1.4-window1-pinyin-train` 已建（59770f79），worktree 创建在机器过载时失败需重建；等主管确认后再派 |
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

1. **feel 已推**：`game-1.4-window1` @ `59770f79` 含手感套件（工人分支 `5d913bee`，feel.test 57 例、kit 定向 532 例、build 全绿）。窗口全量 `npm test` 因机器过载尚未跑完，主管合进 `game-1.4` 前请按总纲 6.1 自跑一遍。frame 仍在跑。
2. **窗口 1 统筹疑似有重复会话**：16:15 起有另一份（或两份）窗口 1 统筹在同一组 worktree 上派工（sudoku-petal、music-stars、重派 clock-house），并在 `D:\Projects\yd-w1` 下跑 node_modules 复制脚本。请只保留一份统筹，其余关闭；在确认前本会话不再新派，以免重派事故。
3. **机器过载**：16:3x 本机可用内存一度只剩 1.4 GB（31 GB 总量）、node 进程 97 个、磁盘队列 19，git 单条命令要跑 10 分钟以上。五窗口 × 6 工人在一台机器上跑不动。建议：每窗同时 ≤ 3 个工人；工人跑 vitest 一律加 `--maxWorkers=2`；`npm ci` 前设 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`。
4. **Windows 换行**：本机 `core.autocrlf=true`，工作区 CRLF，14 例读源码字符串的守门测试在 Windows 必红（与 1.3.4 基线相同）。全量验收口径：以 LF 工作区（或 CI）为准。

## 四、日志

| 时间 | 事项 |
| --- | --- |
| 2026-11-07 15:30 | 开工：建 worktree `D:\projects\yd-w1`，砍 `game-1.4-window1`，建本状态表并推远端（5f3b3d71）。 |
| 2026-11-07 15:38 | 首波 6 个云端工人全部 `unauthenticated`（Cursor 未连接 GitHub），0 个启动。 |
| 2026-11-07 15:45 | 改本地并发：建 6 个工人 worktree + 分支，Node 22 便携版就位。 |
| 2026-11-07 15:55 | 实际派出 4 张：infra-feel、infra-frame、clock-house-t1、math-farm-t1；sudoku-petal / music-stars 两次派发调用参数损坏未发出（当时未察觉）。 |
| 2026-11-07 16:04 | infra-feel IDLE（5d913bee，3 提交，5 文件，越界检查通过）。 |
| 2026-11-07 16:05 | clock-house-t1 被用户手动停止。 |
| 2026-11-07 16:09 | infra-feel 合进 game-1.4-window1 = 59770f79；find-diff worktree 建好；pinyin-train worktree 创建因机器过载失败（分支已建）。 |
| 2026-11-07 16:15–16:42 | 另一份窗口 1 会话在同组 worktree 上派出 sudoku-petal、music-stars，并重派 clock-house。 |
| 2026-11-07 16:30–16:44 | 机器过载（可用内存 1.4 GB、node 97 个）；本会话对 music-stars worktree 的换行归一与该工人开工重叠（见该行备注）。 |
| 2026-11-07 16:52 | 推送 game-1.4-window1 = 59770f79；在 yd-w1-infra-feel 上后台跑全量测试；暂停新派等主管裁定。 |
