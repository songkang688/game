# 三人组第 17 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `9459275c`。
范围：**只做 N-87 / N-88**。未重做 N-86；未改 N-75…N-85 整包；未碰 A 的 level99 / quiz / collection / kitty-care。

## 水位

- `duo-rush` + `fight-king` 全套 **601** 绿（含 N-40 `toolbarSticky.r10`、N-57 `pickTrain.r11`）
- Chrome 915×412 `getBoundingClientRect`：菜单「怎么玩 / 收藏册」与选人「开打」底边 ≤ 412、高 ≥ 44
- 全量 `npm test` / `npm run build` 见交卷 SHA

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-87** | duo-rush **菜单** | 怎么玩 top 450、收藏册 505，crop 234。≠ N-40 | `.dr-setup-cta` 三钮横排 sticky。赛道 `.dr-btns` sticky **原样** |
| **N-88** | fight-king **双人对战选人** | 开打 top 455。≠ N-57 | `.fk-pick-versus .fk-pick-go` sticky 底。训练场 `.fk-pick-train` / `.fk-train-shell` 不动 |

## 未做

N-60/61/62 贴线、N-12/N-10、N-3、N-55：本轮不做。

## 测试（只增）

- `duo-rush/menuCta.r17.test.ts`
- `fight-king/versusGo.r17.test.ts`

## 护栏

不改存档 key / meta.id / seed / 胜负；测试只增不减；禁 force。
