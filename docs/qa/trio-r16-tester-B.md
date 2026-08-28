# 三人组第 16 轮 · 测试修复员 B 记录

角色：休闲 / 对战。分支 `cursor/trio-r16-tester-b-c14c`。  
进场：`origin/game-1.3` @ `7d2bc1a3`（含 r16 笔记 N-87/N-88、r14 A 已合 N-68/N-73）。  
preview：`:4187`。

**编号红线**：N-87 ≠ N-40 赛道工具条；N-88 ≠ N-57 训练场选人；N-86 ≠ N-32 无尽战斗。  
**未重做** N-75…N-85（r15 B）。**未改** find-diff / music-stars / kitty-care / quiz99。

## 本轮落地

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-87** | duo-rush **模式菜单** | 怎么玩 top **450**、收藏册 **505**，crop 234 | 三钮包进 `.dr-menu-cta`；矮横屏 `order:-1` 提到顶并排 sticky，热区 44。**保留** `.dr-btns` sticky bottom |
| **N-88** | fight-king **双人对战**选人 | 「开打 ▶」top **455** | 卡加 `.fk-pick-versus`，开打并进返回行 `.fk-versus-go` 矮屏 sticky top。人机/无尽仍底栏。**不改** `.fk-pick-train` / `.fk-train-shell` |
| **N-86** | brave-path 大厅 | `.bvp-mode` top **337** h=116 切底 | 矮屏两列、收 padding、藏 `.bvp-mode-d`。**不改** `.bvp-endless-fight .bvp-acts` |

## 未做 / 书面降级

- **N-75…N-85**：指令避开；本工位未动麻将/连招/射击/王子/仓鼠/贪吃/泡泡/五子闯关/坦克雪仗闯关。
- **N-60/61/62**：r12 已 sticky；再垫会碰到 `bottom:0` / `OA_SHORT_PANE_H=200` 守门串。本轮不加第三套整钮。
- **N-12 / N-10**：台球击球 425、围棋工具 450。未扩打，避免和棋盘钳互相踩。
- **N-3** star-estate：地格 13px@429。r12 锁了 `max-height:min(200px,42dvh)`，再收会把格更小。
- **N-55** 十二键：r11 已有 `data-duo` 并排；本轮未复测 915，不写第二套。

## 测试（只增）

- `src/games/duo-rush/menuCta.n87.test.ts`
- `src/games/fight-king/pickVersus.n88.test.ts`
- `src/games/brave-path/lobbyModes.n86.test.ts`

## 护栏

不改存档 key / `meta.id` / 题库 / seed / 胜负；测试只增不减；禁 force。

## SHA

交卷 SHA 见本分支最新 commit。
