# 三人组第 13 轮 · 测试修复员 A 交卷

角色：壳层 + 闯关学习。分支 `cursor/trio-r13-tester-a-65de`。  
进场：`git fetch origin game-1.3`。开发基线 `5cbb6a80`（r14 学习笔记）；收尾 rebase 前主干已到 `9176155d`（r15 学习笔记）。

## 禁止重做

未改 N-39 主修（`showMap(true)` + `scrollIntoView({block:center})` 保留）、N-43/44、S-4、N-59/48/58、N-47 保龄/王子/坦克、N-52…57、L-2/L-3、`corridorFit`。

## 本轮落地

### N-63 l99 模式条

- `level99.ts`：挂载时给 `.game-stage` 加 `game-stage--l99`（overflow hidden + 纵向 flex），祖先加 `l99-host`，地图在 `.l99-view` 内滚。
- `showMap(true)` 四处保持；聚焦后把外层 `game-stage.scrollTop = 0`。
- 验收口径：915 不滚能点保龄「双人对战」；hop-pads `.l99-node-cur` 仍走 N-39 尺子。无真机 CDP。

### N-47 残留菜单 40→44

- `.shr-mode`、`.as-open`（盖过 kit 40）、`.ak-open` / `.ak-back` → 44。只改菜单芯片。

### C-6 推理关 121

- 双栏改 `height/max-height:100%`、pads sticky 钉底。
- `syncSize` 按 `.l99-stage` / `.game-stage` `clientHeight` 钳画布，不再用整窗 `innerHeight - 72`。
- `isDeduceLevel(121)` 测试保留。判定/seed 未动。

### N-37 残余 shape-kingdom

- 仅 `.l99-stage-wrap:has(.l99-jump) .shk-quizhost` 收题面插图。未改 `quiz99` 选项热区（clock/识字零扩大）。

### N-16

- 只把 `.ak-back` 33→44。未重写 `corridorFit`。

## 红线

未改存档 key / `meta.id` / 题库 / seed / 胜负。测试只增不减。

## 水位

进场主干 `5cbb6a80`；收尾 rebase `9176155d`。全库 **1154 files / 19431 tests**（一次跑有 gomoku 胜率 / snake-snack / bomb-buddies 5s 既有 flake，单测重跑全绿）。`npm run build` 绿。无 915×412 真机 CDP。未重做 N-59/48/58。
