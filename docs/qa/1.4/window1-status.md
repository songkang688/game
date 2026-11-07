# 1.4 · 窗口 1 状态表（壳层 / 框架 / 手感套件 + 学习与动手 9 款）

> 本窗分支 `game-1.4-window1`（从 `origin/game-1.4` @ `10926b9b` 砍出）。窗口本体工作区：`D:\Projects\yd-w1`（独立 worktree；`D:\Projects\game` 由其他窗口共用，本窗不切它的分支）。
> 工人模型 slug：`claude-opus-5-5-xhigh-fast`；并发上限 6，`run_in_background=true`。
> **派发方式：本地并发，全程不连远端。** 15:38 首波 6 个 `environment=cloud` 工人全部返回 `[unauthenticated] Please reconnect GitHub in Cursor`（云端子代理依赖 Cursor 的 GitHub 集成，本机 `gh` 登录不算），改本地：每个工人一个独立 worktree `D:\Projects\yd-w1-<id>`、分支 `game-1.4-window1-<id>`，工人只 commit 不 push、只跑定向测试；IDLE 后窗口合进 `game-1.4-window1`、跑全量、`git worktree remove`。16:08 主管指示「无需连接 git，先在本地干」：窗口本体也不再 fetch / push，远端 `origin/game-1.4-window1` 停在 66ee3fba。
> 16:08 统筹会话更换：旧会话关闭，新会话接管（旧会话的 6 个工人随之终止，16:19 在原 worktree 原地补派）。
> 本机工具链：Node 22 便携版 `D:\tools\node22`（不在系统 PATH，每条命令前置）；无 Chrome，无头浏览器用 Edge `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`；`rg` 用 Cursor 自带的 ripgrep。
> **CRLF 陷阱**：系统 gitconfig `core.autocrlf=true`，worktree 检出的源码是 CRLF，全库约 23 条「读源码字符串按 `\n` 匹配」的守门测试会伪失败（如 `snake-snack/qaC3fix.test.ts`、`tap-tiles/visual-fix-r1.test.ts`）。窗口对 7 个 w1 worktree 做了 LF 归一（只重写与索引仅差 CR 的文件；`checkout-index -f` 对 stat 未变的文件是空操作，必须先删再 `checkout --pathspec-from-file`）。合并后全量以 LF 树为准。
> 状态：`未派` / `在跑` / `待验` / `已验收` / `打回` / `ERROR`。一行一工单：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、基建与验收格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w1-infra-feel | 待验 | 11-07 15:45 | 5d913bee → 合入 59770f79 | feel.test.ts 57 例 | 旧会话工人完成（feel.ts + 接入指南 infra-feel.md + index.ts re-export + styles.css 末尾 .feel-pop）；59770f79 全量 19771 通过 / 23 失败均为 CRLF 伪失败、build 绿；LF 归一后复跑全量确认后转「已验收」并报主管合进 game-1.4 |
| w1-infra-frame | 在跑 | 11-07 16:19（补派） | | | 旧工人被终止，留下未提交 `scripts/qa/`；新工人在 `yd-w1-infra-frame` 续做：level99 N-100 锚定 + l99-host 守门测试 + measure-viewports.mjs；端口 4132/4133 |
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
| w1-clock-house-t1 | 在跑 | 11-07 16:19（补派） | | | worktree `yd-w1-clock-house`；quiz99 出题器；预审线索：作息表随机截段、跨午夜不提示 |
| w1-clock-house-t2 | 未派 | | | | 840 横屏钟面 min(42vh,220px) 守 MIN_FACE_PX |
| w1-math-farm-t1 | 在跑 | 11-07 16:19（补派） | | | worktree `yd-w1-math-farm`；runner.ts 禁盲拷 500 档；预审线索：「拆一步」第 3 错不可达、量词、提示与题面不符 |
| w1-math-farm-t2 | 未派 | | | | |
| w1-sudoku-petal-t1 | 在跑 | 11-07 16:19（补派） | | | worktree `yd-w1-sudoku-petal`；188 关唯一解（求解器计数 = 1）全覆盖 |
| w1-sudoku-petal-t2 | 未派 | | | | 人机对战档不卡死 |
| w1-music-stars-t1 | 在跑 | 11-07 16:19（补派） | | | worktree `yd-w1-music-stars`；N-113 工具排已修勿回退；预审线索：synth.ts 只认无前缀 AudioContext |
| w1-music-stars-t2 | 未派 | | | | 双声部节拍判定窗口 ≥ 120 ms |
| w1-find-diff-t1 | 在跑 | 11-07 17:08 | | | 第 6 槽（infra-feel 已完成腾出）；worktree `yd-w1-find-diff`（基于 59770f79）；三图/旋转/镜像关「不同」像素差阈值测试；预审线索：levels.ts maxMiss 死字段 |
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

- w1-infra-feel 已合入 `game-1.4-window1` @ 59770f79（本地，未推送）；LF 归一后全量复跑确认即可合进 `game-1.4`。
- 全库 CRLF 伪失败问题（见页首）会影响所有窗口的本地全量测试，建议各窗口合并前同样对自己的 worktree 做 LF 归一，或由主管在 `.gitattributes` 加 `* text=auto eol=lf`（属主管文件，窗口 1 不动）。

## 四、日志

| 时间 | 事项 |
| --- | --- |
| 2026-11-07 15:30 | 开工：建 worktree `D:\projects\yd-w1`，砍 `game-1.4-window1`，建本状态表并推远端（5f3b3d71）。 |
| 2026-11-07 15:38 | 首波 6 个云端工人全部 `unauthenticated`（Cursor 未连接 GitHub），0 个启动。 |
| 2026-11-07 15:45 | 改本地并发：建 6 个工人 worktree + 分支，Node 22 便携版就位，重派第一波 6 张：infra-feel、infra-frame、clock-house-t1、math-farm-t1、sudoku-petal-t1、music-stars-t1。 |
| 2026-11-07 16:00–16:10 | infra-feel 工人交付 3 commit（a3d59594 / a5214578 / 5d913bee，feel.test.ts 57 例），合入 `game-1.4-window1` @ 59770f79；开始建第二波 worktree（find-diff / pinyin-train）。 |
| 2026-11-07 16:08 | 主管指示全程本地、不连 git；旧统筹会话关闭（其工人终止；`git worktree add yd-w1-find-diff` 卡在半途，16:3x 自行完成；pinyin-train worktree 未建）。新会话接管。 |
| 2026-11-07 16:19 | 新会话补派 5 张：infra-frame（续做）、clock-house-t1、math-farm-t1、sudoku-petal-t1、music-stars-t1；清掉旧会话残留的 4132 预览进程；后台跑 59770f79 全量（19771 通过 / 23 失败 / 2 跳过，1256 文件；build 32s 绿）。 |
| 2026-11-07 16:35–17:05 | 定位 23 失败 = CRLF 伪失败；对 `yd-w1` 做 LF 归一（3046 文件），6 个工人 worktree 归一在后台进行。 |
| 2026-11-07 17:08 | 派第 6 槽 find-diff-t1。 |
