# 三人组第 11 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `0e435ad1`（playbook 派 N-52 起）。
范围：休闲 / 对战 / 动手。**未改** A 独占：level99 / quiz99 / word-garden / pinyin / clock-house / find-diff / collection / parentAuth / styles.css。
**未改** N-43/44 color-fun、math-farm。
**未重做** N-25/26/27/29/23/1/32、N-31 关内 `.fk-train-shell`、N-45 `gdh-veil--shop`（主干已有）。
N-40 `.dr-btns` 矮屏 sticky 已在主干，本轮跳过。

交卷 `npm test`：1138 files / 19395 tests 全绿（偶发 `fatal: invalid object name 'origin/game-1.1'` 与玩法无关）。`npm run build` 通过。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-52** | duo-arena | 915×412 菜单「开擂」~527；对局两块 186 半场上下摞，下半场+暂停线下 | 配方 L：`max-height:500px` 放开 `.dua-wrap` 440 宽限制，对局两半场 CSS grid 并排；开擂/暂停 sticky 底。`match.ts` 零触碰 |
| **N-53** | tank-battle 对战 | 双垫 ~607 线下、画布溢出、暂停/回选关/芯片 ~32 | 配方 G：`boardRoom` 减去 HUD+暂停+垫高再钳 cell；矮屏 `.tkb-pads-two` nowrap sticky；`.tkb-act/.tkb-back/.tkb-chip` min-height 44。关卡表/弹道零触碰 |
| **N-54** | hop-pads 双人 | 每块写死 236，两块叠出屏；单人 r9 已绿 | `duoCanvasHeightPx((room−gap)/2)`，resize 回调；单人仍 `stageHeightPx` |
| **N-55** | snow-fight 对战 | 宽矮屏十二键仍上下摞 481–531 | `data-duo` + 500px 高档两块 3×2 牌 grid 并排。回合/灯笼零触碰 |
| **N-56** | sky-squad 合作 | 暂停 33、开关 31、双人 `--k` 36/34 | **只抬热区**：back/opt min-height 44，双人 `--k:44`。不重钳画布 |
| **N-57** | fight-king 训练选人 | 「开打」~531、假人钮 38；关内 N-31 已绿 | `.fk-pick-train`：假人+开打并排钉在标题下 sticky；`.fk-btn` 44。**不改** `.fk-train-shell` |

## 未做 / 降级

- N-2/3/4 回合必点、C-2…C-8、N-16：本轮无余力。
- N-40：主干已有 `.dr-btns` sticky，跳过。
- N-45：主干 `gdh-veil--shop`，跳过。
- 390 / 1280 以源码断言 + 既有单测护栏；Chrome 915 数字若环境无空闲 preview 口则交卷后补量。

## 测试（只增）

- `src/games/duo-arena/shortLandscape.r11.test.ts`
- `src/games/tank-battle/shortLandscape.r11.test.ts`
- `src/games/hop-pads/duoFit.r11.test.ts`
- `src/games/snow-fight/duoPads.r11.test.ts`
- `src/games/sky-squad/hotspots.r11.test.ts`
- `src/games/fight-king/pickTrain.r11.test.ts`

## 护栏

- 不改存档 key、`meta.id`、题库、seed、胜负判定、kit
- 测试只增不减
- 禁 force push `game-1.3`；撞车取先合版
