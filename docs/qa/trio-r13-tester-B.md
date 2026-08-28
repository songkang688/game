# 三人组第 13 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `8b0d4d8`（r12 N-60/61/62、N-2/3/4 已合）。
范围：休闲 / 对战棋类分屏。**未改** A 独占 level99 / collection / quiz / styles.css。
**未重做** N-52…57、N-60/61/62（禁止第三套画布钳）、N-45、N-40。N-60/61 本轮只书面回归：r12 `orbPaneH`/`snakePaneH` 仍在。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-64** | junqi-camp 双人 | 确认行 485、暂停 597。菜单四卡已绿 | `.jq-duoplay` 矮屏舞台 `min-height:140` / `48dvh`；tools+暂停 sticky。**不改** `.jq-mode`。布阵/胜负零触碰 |
| **N-65** | dark-chess 双人 | 取消/暂停 518；末行 377 切底 | `.dc-duoplay` 棋盘 `max-width:min(280px,56dvh)`；`.dc-row` sticky。单人/人机不加该类 |
| **N-66** | chess-garden 双人 | 底线格 379–435 | 仅双方都是人时挂 `.cg-duoplay`，局部 CSS 收 frame 到 `52dvh` 并解开格 min-width。≠ N-10，不改 styles.css |
| **N-67** | gomoku 自由对战设置 | 「开始下棋 ▶」431 | `.gmk-panel .gmk-start` sticky。进局 `.gmk-wrap{max-width:248px}` **原样保留** |

## 未做

N-11 保龄关内、N-12 台球双人、N-49 再挤、N-52…57 回归实测量。Chrome 915 数字交卷后补；以 class/CSS 断言护栏。

## 测试（只增）

- `junqi-camp/duoPlay.r13.test.ts`
- `dark-chess/duoPlay.r13.test.ts`
- `chess-garden/duoPlay.r13.test.ts`
- `gomoku/setupCta.r13.test.ts`

## 护栏

不改存档 key / meta.id / 题库 / seed / 胜负；测试只增不减；禁 force。
