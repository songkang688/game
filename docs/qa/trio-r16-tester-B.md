# 三人组第 16 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `7a832aa8`。
范围：**只做 N-86**（brave-path 大厅）。未改 r15 N-75…N-85 在途游戏，未重做 N-64…67 / N-69…74 / N-52…57 / N-60–62 第三套钳 / N-45 / N-40。A 独占未碰。

## 水位

- 进场：`7a832aa8`
- `brave-path` 全套 388 绿（含 N-32 `endlessFight.r9`）
- Chrome 915×412：`page.setViewport` + `getBoundingClientRect`，四张 `.bvp-mode` 底边 ≤ 412、高 ≥ 44
- 全量 `npm test` / `npm run build` 见交卷 SHA

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-86** | brave-path **大厅** | 对战/备战 `.bvp-mode` top 337 h=116 底 453，crop 324。≠ N-32 无尽战斗三钮 | 菜单挂 `.bvp-lobby`；矮横屏收介绍卡 + 模式卡 `min-height:44`、描述单行。战斗/胜负/seed 零触碰 |

## 未做

N-2/3/4 掷骰地产确定、N-54 hop-pads 双人：r15 工位与其它代理可能在改，按指令只做 N-86。

## 测试（只增）

- `src/games/brave-path/lobbyFit.ts`
- `src/games/brave-path/lobbyHall.r16.test.ts`

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负；测试只增不减；禁 force。
