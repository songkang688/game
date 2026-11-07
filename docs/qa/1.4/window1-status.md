# 1.4 · 窗口 1 状态表（壳层 / 框架 / 手感套件 + 学习与动手 9 款）

> 本窗分支 `game-1.4-window1`（从 `origin/game-1.4` @ `10926b9b` 砍出）。窗口本体工作区：`D:\projects\yd-w1`（独立 worktree；`D:\projects\game` 由其他窗口共用，本窗不切它的分支）。
> 工人模型 slug：`claude-opus-5-5-xhigh-fast`；派发方式：Task + `environment=cloud` + `cloud_base_branch=game-1.4-window1`，`run_in_background=true`，并发上限 6。
> 状态：`未派` / `在跑` / `待验` / `已验收` / `打回` / `ERROR`。一行一工单：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、基建与验收格

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w1-infra-feel | 未派 | | | | 第一波；全绿后立刻报主管合进 game-1.4 |
| w1-infra-frame | 未派 | | | | 第一波；level99 锚定 + l99-host 守门 + measure-viewports.mjs |
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
| w1-clock-house-t1 | 未派 | | | | 第一波；quiz99 出题器 |
| w1-clock-house-t2 | 未派 | | | | 840 横屏钟面 min(42vh,220px) 守 MIN_FACE_PX |
| w1-math-farm-t1 | 未派 | | | | 第一波；runner.ts 禁盲拷 500 档 |
| w1-math-farm-t2 | 未派 | | | | |
| w1-sudoku-petal-t1 | 未派 | | | | 第一波；188 关唯一解（求解器计数 = 1） |
| w1-sudoku-petal-t2 | 未派 | | | | 人机对战档不卡死 |
| w1-music-stars-t1 | 未派 | | | | 第一波；N-113 工具排已修勿回退 |
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
| 2026-11-07 15:30 | 开工：建 worktree `D:\projects\yd-w1`，砍 `game-1.4-window1`，建本状态表并推远端。 |
