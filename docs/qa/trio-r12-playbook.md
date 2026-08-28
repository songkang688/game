# 三人组第 13 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r12-learn-notes.md`（基线 `game-1.3 = f10ad799`）。
> **先读对账表**：r9–r11 已合入主干的项全部 ✅，**禁止重做**。r12 A = 壳层+闯关（N-48 / N-58 / S-4 收尾）；r12 B = N-52…N-57。本清单给 **r13**，动手前 `git fetch origin game-1.3` 以及 `origin/cursor/trio-r12-tester-a-c14c`、`origin/cursor/trio-r12-tester-b-c14c`：**已合的销账，在途的标在途，勿第三份同文件。**
> **编号红线**：N-39…N-50、N-52…N-58 已占用。N-42 **只=puff**。N-48 **只=收藏册 overlay**。N-58 **只=暂停套跳关门**。新伤 **N-59** 起。N-51 空号勿回收。
> 只列仍 🔧。A = 壳层+闯关学习。B = 休闲对战动手。
> 配方 A–C r4、D–F r5、G/H r6、I/J r8、K/L r9；本轮用 I/L/H 笔。

## 进场水位

本学习员在 `f10ad799` 工作树：`npm test` = **1129 文件 / 19376 用例**，其中 **6 文件 / 7 例** 红（均为 5s 超时或既有 AI/solver 抖动：`window1-smoke-seeds`、`bomb-buddies/ai`、`snake-royale/ai`×2、`snake-snack/qaC1`、`sudoku-petal/solver`、`qa-window2/c5-xiangqi`）。**不为变绿改测试。** 相对 r10 的 1109/19330、r10-A 登记 1112/19339：**文件与用例只增不减**。`npm run build` 本轮全绿。

r13 交卷水位 ≥ 本数（或书面说明只增了测试文件）。全库一份 `modebarHidden.guard.test.ts`。

## 通用纪律

- 不改存档 key：`yiduo-yixing.l99.<id>` / skip / `yiduo-yixing.root.v1` / 钱包 / `meta.id`。密码不入库。
- 不动题库/判定/seed。kit 已有文件只 import。
- 测试只增不减。开/关对照每档独立 context（`localStorage` 只在 `#/game/` 同源页写）。
- 宽屏 412×915 / 1280×800 零回归。禁 force。
- 进关点 **`.l99-continue`**；无蓝本继续的款（gold-hook / duo-arena）走自己的闯关/开擂 CTA。

## 测试步骤备忘

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。
- 主档 **915×412**。duo-arena：先量菜单「开擂」+「怎么玩」，再点开擂量下半场。sudoku：必须点「对战竞速」。sky：闯关 + `data-players=2` 各一档。block-drop：战役 `.l99-continue` **和** 模式选单进关两档。收藏册：首页 🎁 → 改 `location.hash`。N-58：关内 `.icon-btn--pause` → 再点「跳过」。

---

## Top 10（r13 先做）

1. **N-48** 收藏册 overlay 跨路由（A）——主干仍无 hashchange；本轮实锤 overlay 残留。
2. **N-58** 暂停 + 跳关门套娃（A）——两层 `.dialog` 同时开。
3. **S-4 收尾** `.qz-jump-go` 32→44（A）——框已 44，勿把 input 改回 38。
4. **N-49** 数独对战竞速 crop 1046（B）。
5. **N-52 对局下半场**（B，若 r12 B 未合）——菜单开擂已 sticky 在屏，怎么玩+下半场垫仍线下。
6. **N-53 / N-55 / N-54 / N-57 / N-56**（B，r12 B 在途则等先合版）。
7. **N-46** sky 六键 42 + 开关 31（B）。
8. **N-47** bowling 34 / prince 37 菜单芯片（B）。
9. **N-50** block-drop 两态复测（B）——战役本轮七键已在屏，模式进关可能仍 419。
10. **N-15 / C-3 / N-29** 旧号顺手（B）：泡泡 915 对战六键、snake-snack 方向键 707、candy-swing 关内画布出屏 260。

---

## 壳层（给 A）

### N-48 收藏册 `.collection-overlay` 跨路由残留 🔧（优先）

- **现象**：首页 🎁 打开后 `collection=1`；`hash=#/game/clock-house` 后舞台已在，**overlay 仍=1**。`collection.ts` 无 `hashchange`。
- **改哪**：学 S-3 `parentAuth.ts`：打开时 `addEventListener("hashchange", close)`，`close` 里 `removeEventListener`。密码/星星/试穿零触碰。
- **不要**：改成 N-42/N-58；不要动 `collectionHit.r9.test.ts` 的 44px 账。若发现误名为 `collection.n58.test.ts` 的文件，**改回 N-48**。
- **验收**：915 打开收藏 → 进任意 `#/game/*` → overlay 0；关面板后无孤儿监听。390 / 1280 不回归。

### N-58 横屏壳层暂停 + 跳关确认门套娃 🔧（优先）

- **现象**：关内 ⏸ 后再点「⏭️ 跳过第 N 关」：`.dialog--pause` 与 `.dialog--gate` **同时存在**。
- **改哪**：`src/ui/gameShell.ts` 的 `requestSkip` 路径，或 `parentAuth.showDialog` 全局：已有 dialog 时先关暂停再开门，或拒绝第二层。不要改跳关授权题/密码。
- **验收**：915 暂停开着点跳过 → 只剩一层；Esc 只关一层；门上确认/不同意可点。N-33 暂停五钮仍在屏。

### S-4 收尾 `.qz-jump-go` 🔧（框已关账）

- `quiz99.ts:154` `.qz-jump-go` 无 min-height，本轮 **h=32**（clock + pinyin root）。input **已 44**，`quiz99.s4.test.ts` 已钉 input——**扩测试钉 go≥44**，不要再写 38→44 的 input 故事。
- 管理员面。N-37 本轮 root×拼音 135 **票在屏**，只复测不要重写 `:has(.l99-jump)`。

### 已 ✅ 勿动

N-39 地图聚焦、N-33 sticky、N-38 文案、收藏册 44、N-37 抬头、N-43/N-44、L-2/L-3、N-16 走廊、S-1…S-3、l99 jump 框 44。

---

## 闯关学习（给 A，N-48/58/S-4 之后若有余力）

- 无新开创作皮肤号。color-fun 本轮 L1/166 色盘在屏。
- C-6 alien-seek **推理关 121** 仍挂 r11 原文（本轮未复量）；修 C-6 必须含 `isDeduceLevel`。
- 失败结算本轮 fruit-catch 已绿，**不要再做第三份 overlay sticky**。

---

## 休闲对战动手（给 B）

### 先对账 r12 B

分支 `cursor/trio-r12-tester-b-c14c` 声称 N-52…N-57。**合入后按下表销**；未合则继续，勿与自己的未推送工作树双改同一 CSS。

### N-52 duo-arena（菜单 CTA 已半绿 / 对局仍开）🔧

- **菜单**：开擂本轮 sticky **top 344 在屏**；怎么玩 **471 线下**。把规则链收进次级或跟开擂同一 sticky 底。
- **对局**：下半场 419–494、暂停/规则/退出 **549**。矮横屏双栏或第二套垫 sticky。`match.ts` 零触碰。
- **验收**：不滚能点开擂+怎么玩；开打后两套垫+暂停可点；390 / 1280 零回归。

### N-53 tank 双人对战 / N-54 hop-pads 双人画布 / N-55 snow-fight 十二键 / N-56 sky 合作热区 / N-57 训练场选人开打

- 原文见 `trio-r11-playbook.md`。r12 B 在途则 **不要第三份** `.fk-train-shell` / hop 单人钳高（单人 r9 已绿）。

### N-49 sudoku-petal 对战竞速 🔧

- crop **1046**，第 4 行起格子线下。`mountExtra('versus')` 另一跳。钳盘高或数字键 sticky。题库/求解零触碰。
- 验收：915 对战不滚能点数字键；闯关盘零回归。

### N-46 sky-squad 关内六键 + 开关 🔧

- 键 `--k:42`（双人 36）、暂停 33、开关 31。贴底或再让画布；`min-width/min-height:44`。飞行判定零触碰。
- 验收：闯关+双人 915 六键 ≥44 且不滚可点。

### N-47 模式菜单芯片 🔧

- bowling 34/32、prince 37。只改菜单 `min-height:44`，关内判定不动。进关后 modebar 仍 `[hidden]`。

### N-50 block-drop 七键 🔶

- 战役进关本轮 **top 310 在屏**。再量 **非 l99 的开打路径**；若仍 419 则按 r10 钳键排。已两态绿则书面销账。

### 仍开、原文不重抄

- N-15 bomb-buddies **915 对战**六键；C-3 snake-snack 方向键 707；N-29 candy-swing 关内出屏 260；N-11 bowling 关内；N-17 prince 六键；N-22 combo 三钮；C-8 未合部分。
- `casual-duo-fit-r5-b-4683`：rebase 到最新主干，守门二合一。

### 已 ✅ 勿重写

N-25/31 关内/1/32/26/27/29 地图钳高源码/23、N-40/41/42、N-2/3/4、N-45 商店 footer、N-10 象棋补。

---

## 完成定义

1. N-48 / N-58 / S-4-go 关账或书面降级；N-49/46/47 关账；N-52…57 以 fetch 后主干为准关或降级；N-50 两态数字。
2. `npm test` / `npm run build` 水位只增不减；偶发 5s 超时不立项。
3. 每条 915×412 留数字。duo-arena 必须菜单+对局；sky 必须单人+双人；block-drop 必须两态；N-58 必须「暂停仍开着时点跳过」。
4. 撞车取先合版。报告写清 fetch 后的 `game-1.3` SHA。
