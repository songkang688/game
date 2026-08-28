# 三人组第 13 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `8b0d4d8`（r12 N-60/61/62、N-2/3/4 已合）。
交卷：`cursor/trio-r13-tester-b-65de` 代码 **`68c0aef`**，报告 **`71b347d`**（rebase `origin/game-1.3` @ `9176155`）。
范围：休闲 / 对战棋类分屏。**未改** A 独占 level99 / collection / quiz / `styles.css`。
**未重做** N-52…57、N-60/61/62 第三套画布钳、N-45、N-40。

## 水位

- 进场：`8b0d4d8`
- `npm test`：19426 过 / 1 败（`bomb-buddies/ai` 5s timeout flake）。复跑 `bomb-buddies/ai` + `snake-snack/qaC1` 全绿。
- `npm run build`：tsc + vite 绿。
- 四款相关套件：junqi / dark-chess / chess-garden / gomoku **899** 全绿。
- N-60/61 回归：`orb-arena/campaignPad.r12`、`snake-royale/campaignPad.r12` 绿。未加第三套钳。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-64** | junqi-camp 双人 | 确认行 ~485、暂停 ~597。菜单四卡已绿 | `.jq-duoplay` 矮屏舞台 `min(48dvh,220px)` / `min-height:140`；tools+暂停 sticky。**不改** `.jq-mode`。布阵/胜负零触碰。CSS 注释不用「双人同屏」四字（冒烟 `find` 会命中 `<style>`） |
| **N-65** | dark-chess 双人 | 取消/暂停 ~518；末行 ~377 切底 | `.dc-duoplay` 棋盘 `max-width:min(280px,56dvh)`；`.dc-row` sticky。仅 `rival==="human"` |
| **N-66** | chess-garden 双人 | 底线格 379–435 | 双方都是人时挂 `.cg-duoplay`；`DUO_SHORT_CSS` 并进 `SHELL_CSS`（不进 `styles.css`，createBoard 不插 `<style>`）。人机/闯关只有一方 `ai:null`，不加类。≠ N-10 |
| **N-67** | gomoku 自由对战设置 | 「开始下棋 ▶」~431 | `.gmk-panel .gmk-start` sticky + `min-height:48`。进局 `.gmk-wrap{max-width:248px}` **原样保留** |

## 未做 / 降级

- Chrome 915 `getBoundingClientRect` 本环境无浏览器实测量；护栏为 class/CSS 断言 + 四款冒烟。
- N-11 保龄关内、N-12 台球双人、N-49、N-52…57 实测量：本轮不做。
- N-62 / N-2/3/4：r12 已合，本工位未改。

## 测试（只增）

- `junqi-camp/duoPlay.r13.test.ts`
- `dark-chess/duoPlay.r13.test.ts`
- `chess-garden/duoPlay.r13.test.ts`
- `gomoku/setupCta.r13.test.ts`

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负；测试只增不减；禁 force。
