# 三人组 r9 · 测试修复员 B 记录（`cursor/trio-r9-tester-b-65de`）

> 本文件由 **并行的第二名测试修复员 B** 收尾。主清单 N-25/N-31/N-1/N-32/N-26/N-27/N-29/N-23 **已由先合版** `b2c07a6e`（merge `323ac8cc`）销账，本分支 **撞车取先合版**，不再重做那一套双栏/钳高。
> 进场基线（本代理开工时）：`a74e4868`，`npm test` = **1095 文件 / 19288 用例** 全绿。收尾对账主干：`bddb8e50`（r9 A/B 已合入 + r10 笔记在树）。

## 撞车

| 事项 | 处理 |
|---|---|
| 本代理曾独立改 fight-king / fruit-catch / dvs / dmz / ak 古堡 / brave-path | **整包丢弃**，以 `b2c07a6e` 先合版为准 |
| 远程 `cursor/trio-r9-tester-b-65de` 上曾误叠 A 的 docs 后又 Revert | 本收尾从 **最新 origin/game-1.3** 重开提交，不 force 主干 |
| A 独占文件 | 全程未改 `styles.css` / `collection.ts` / `level99.ts` / `quiz99.ts` / `word-garden` / `pinyin-train` / `clock-house` / `find-diff` / `parentAuth.ts` |

先合版已关账见下文「先合版已关」表（原文保留）。

## 本代理增量（先合版未覆盖）

| 编号 | 测了什么 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-45** | gold-hook 闯关→🛒 915×412 | r10：veil 内滚 230，「接着挖」top 513 线下 | 货架自滚 + sticky 脚。puppeteer：veilScroll **29**，「接着挖」不在线下；第三买钮 top 416 贴线轻伤 |
| **N-31 补** | fight-king 训练场开触屏 | 先合版后假人三钮仍 top 497 线下 | 假人钮挂顶栏。复测 **belowCount 0**（帧表 crop 属教学自滚） |
| **N-15** | bomb-buddies 对战 915×412 | 六键全线下 | sticky + 双栏。puppeteer：**crop 0 / below 0** |

配套测试：`gold-hook/shopVeil.r9.test.ts`、`bomb-buddies/landscape-r9.test.ts`。

## 先合版已关（不重做）

| 编号 | 款 | 修法摘要（先合版） |
|---|---|---|
| N-25 | fight-king 塔 | 出战八宫格收成「当前出战 · 换人 ▾」；`FIGHT_MIN_H` 未动 |
| N-31 | fight-king 训练场 | `.fk-train-shell` 表限高自滚，键 sticky |
| N-1 | fruit-catch | 显示高钳，backing W×H 不动 |
| N-30 | adventure-king 古堡 | r9-A / 古堡 `advk-shell` 双栏（A 范围交叉，已合） |
| N-32 | brave-path 无尽战斗 | `.bvp-endless-fight` 操作行 sticky |
| N-26 + C-9 | duo-vs-star | 双栏 + `.dvs-back` min-height 40 |
| N-27 | dot-maze 四模式 | 矮横屏双栏 |
| N-29 / N-23 | bubble-aim 族 | canvas 钳高 + 地图 focusCurrent |

## 还剩什么

- N-2/N-3/N-4 回合必点（flight-chess / star-estate / hero-cards）本拍未动
- C-2…C-8 菜单裁切未全清
- N-16 走廊引擎三态：与古堡分开，本拍只验收未混修
- 护栏：fk 无尽连胜、dvs 五模式、壳层暂停/家长门 — 未扩大化

## 水位

- 进场（本代理）：1095 / 19288
- 主干先合版后文件数已高于进场（A/B r9 测试文件已在树）
- 本增量：测试只增不减（+2 文件）

## 文件清单（本增量）

- `src/games/gold-hook/style.ts`、`index.ts`、`shopVeil.r9.test.ts`
- `src/games/bomb-buddies/index.ts`、`landscape-r9.test.ts`
- `docs/qa/trio-r9-tester-B.md`（本记录）


先合版抽核 915×412：塔 crop 94 / 键排 below 0（原 498）；fruit-catch crop 86 / 左右钮 below 0（原 741）。
