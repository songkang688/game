# 三人组第 10 轮 · 测试修复员 A/B 任务清单（playbook）→ 给 **r11**

> 依据：`trio-r10-learn-notes.md` **〇、c14c 工位**（交卷基线 `origin/game-1.3` 含 `ce14c0a5` / r11-B `0f47addc`）。
> **编号红线**：N-42 = puff 热区，**不是**收藏册 overlay。N-43 = color-fun，**不是**数独对战。N-44 = 竖式。收藏册 overlay = **N-48**，数独对战竞速 = **N-49**。N-52…N-57 归 r11 笔记，勿回收。
> **只列仍未落地的 🔧。** A = 壳层 + 闯关学习；B = 休闲对战动手。
> 已合入保持 ✅：**S-1～S-4(含 `.qz-jump-input` 44)**、**L-1**（shape 答题 + find-diff）、**C-1/N-28**、竞技场留白、garden-guard、N-24、**N-33/N-38/收藏册 44/N-37/N-34/N-35/N-36/N-30**、**N-25/N-1/N-32/N-26/N-27/N-29/N-23**、**N-39 `showMap(true)`**、**N-40/N-41/N-42**、**N-43/N-44/N-45**、L-2 faceLift、r11-B 的 C-8 双垫横排 + N-10 象棋工具行。
> **在途，先合版**：GitHub **#59 / #61 / #60** 仍 OPEN，内容已在主干；**#62** 只改号。`casual-duo-fit-r5-b-4683` 仍未合。r11-B `0f47addc` **刚合入主干**（N-45/C-8/N-10 象棋工具行）→ 这些号只复测、勿第二份 footer。

## 通用纪律

- 不改存档 key / `meta.id`；不动题库、seed、win/lose。
- kit 已有文件只 import（L-3 扩 `stickers.ts` 例外）。宽屏 412×915 与 1280×800 零回归。禁 force。
- 开/关对照每档独立 incognito context（同源 `#/game/` 上 `clear`，不要 `about:blank`）。
- 测试只增不减。进场先 `npm test`（c14c 实测过 **1109 / 19330**；A10 登记 **1112 / 19339**）。交卷水位 ≥ 进场。
- 本地：`npm run build && npx vite preview --port 4173`；Chrome `/usr/local/bin/google-chrome`；脚本截图放 `/tmp`。

---

## 壳层（给 A）

### N-48 收藏册 overlay 跨路由残留 🔧（先做；曾误号 N-42）

- **现象**：首页开 🎁 后 `hash = "#/game/clock-house"`，`.collection-overlay` 仍在（z-index 60），舞台已 mount。
- **改哪**：`src/ui/collection.ts` 打开时挂 `hashchange → close`，`close` 里摘监听。对照 `parentAuth` 的 S-3。试穿 canvas / 钱包 key 零触碰。
- **验收**：开收藏 → 进任意 `#/game/*` → overlay 个数 0；Esc/关闭钮原路径仍关。补一条对照 `parentAuthRoute.test.ts` 的测试。热区 44 已合，别重写布局。

### N-58 横屏暂停 + 跳关确认门套娃 🔧

- **现象**：915×412 关内点壳层 ⏸ 后再点「⏭️ 跳过第 N 关」，`.dialog--pause` 与 `.dialog--gate` 同时存在。
- **改哪**：`src/ui/gameShell.ts`：已有暂停时不要再 `showDialog` 门；或开门前先关暂停。`dialogs.ts` 按钮语义 / 冷静期零触碰。
- **验收**：暂停开着点跳过 → 屏幕上只剩一层 dialog；Esc 一次回到游戏。1280×800 零回归。

### N-33 / N-38 / 收藏册热区 / N-37 / S-4 qz-jump ✅ 勿动

---

## 闯关学习（给 A）

### N-16 走廊引擎三态 🔧（古堡 N-30 已合，走廊未合）

- 无尽遗迹 / 计时速通 / 闯关：`ak-pad` **不要**挂 `advk-shell`。配方 G，一次修三态。r10 补测走廊裁 258、六键 top 567。

### L-3 find-diff 贴纸 4–10 章 🔧（若主干 `boardArt` 仍写挂轮）

- 只扩 `stickers.ts` + 映射。题库 SHA 不动。L-2 已 faceLift，**不要改 `clockSVG`**。

### C-6 补笔 · alien-seek 推理关 🔧（并进仍开的 C-6，不新开号）

- 推理关 121：工具 + D-pad 全线下。验收必须含 `isDeduceLevel`，不能只拿找物关结案。

### N-39 / N-43 / N-44 / N-34…N-36 / N-30 / L-2 ✅ 勿重做

- N-39 接线已在主干。若 915 hop-pads 当前关仍整格线下，只补漏调的调用点，**不要再抄一份 `showMap(true)` 四连**。

---

## 休闲对战动手（给 B）

### N-49 sudoku-petal 对战竞速 🔧（曾误号 N-43；配方 H+G）

- **现象**：进「🤝 对战竞速」后 915 裁 **1046**、约 147 格 top≥416。竖屏也会裁（并行学习员：412×915 裁 519 / 390 裁 590）。
- **改哪**：`src/games/sudoku-petal/index.ts` 的 `mountExtra` / `.sp-mode`。矮屏钳格子或横屏双栏，数字键 sticky。填数/胜负零触碰。
- **验收**：3 视口盘面 ≥60% 可见、数字键不滚可点；闯关地图与花田马拉松/双人同屏做回归。

### N-50 block-drop 关内七键操作排 🔧（1.3 窗口新画风；配方 L）

- **现象**：画布 185–365 在屏；◀▶↻↺▼⤓📦 **top 419** 整排线下，crop 111。
- **改哪**：`src/games/block-drop/` 矮横屏把 `.bd-btn` 行 sticky 底或与井字双栏。落子/消行判定零触碰。
- **验收**：915 不滚能点全部七键；井字不劣化；390 / 1280 零回归。

### 第一件事：收在途 `casual-duo-fit-r5-b-4683`

- N-1/C 组/配方 F 等；`[hidden]` 弃重复行。r11-B 的 N-45 / C-8 双垫 / N-10 象棋行 **已在主干，勿重写**。

### 仍开且本工位/r11 已有号（不要换号）

- **N-46** sky-squad 六键切半 + 双人 36px（本工位单人垫仍 36×36 贴底）。
- **N-47** 保龄/王子/坦克 **菜单**芯片 <44。
- **N-22** combo-clash 闯关三钮 top 451 / 裁 131（= 1.3 窗口操作排，已有号）。
- **N-52** duo-arena 菜单开擂 527 + 对局下半场（r11）。
- **N-53…N-57** 照 `trio-r11-playbook.md`（tank 双人、hop 双人画布、snow 十二键、sky 合作、训练场选人开打）。本工位复证 **N-55** 十二键 481–531、**N-15** 泡泡双人六键 489–591。
- **N-10 其余两款 / N-11 / N-13 / N-14 / N-17 / N-19** 及 r4/r5 C-2…C-7 未声明覆盖的：合入 4683 后再删。N-40/41/42/45 **主干已修，勿重写**。

---

## 完成定义（两人共用）

1. 上表 🔧 关账或书面降级。已 ✅ 与在途先合版 **零重做**。
2. `npm test` / `npm run build` 全绿，水位只增不减；每条修复有小测试；全库一份 modebar 守门。
3. **N-48 / N-49** 必须按新号写测试名与报告，禁止再出现「N-42 收藏册 overlay」「N-43 数独对战」。
4. 撞车取先合版。报告写 fetch 后的 `game-1.3` SHA。
