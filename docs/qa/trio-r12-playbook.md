# 三人组第 13 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：合稿后的 `trio-r12-learn-notes.md`。最新对账 SHA 以 `git fetch origin game-1.3` 为准（笔记合入时主干已含 `6a013600`）。
> **禁止重做**：N-39、N-43（勿第三套 scrolly）、N-44、S-4 **input+go**、N-47 **源码**、N-40 赛道内、N-41、壳暂停、L-2/L-3、N-45 footer、N-16 `corridorFit`、C-6 推理关双栏源码。
> **在途（勿第三份）**：r12 A = N-48 / N-58 / N-59；r12 B = N-52…N-57。先合版销账。
> **编号**：N-42=puff；N-48=收藏 overlay；N-58=暂停+跳关门；N-59=收藏 915 布局；N-60/61/62=orb 闯关 / 蛇闯关 / 2048 四向。再新伤 **N-63**。N-51 勿回收。
> A = 壳+闯关学习；B = 休闲对战。

## 进场水位

c14c 在 `f10ad799`：`npm test` **1129 文件 / 19376 用例**，6 文件 / 7 例红（5s 超时或 AI 抖动：`window1-smoke-seeds`、`bomb-buddies/ai`、`snake-royale/ai`×2、`snake-snack/qaC1`、`sudoku-petal/solver`、`qa-window2/c5-xiangqi`）。**不为变绿改测试。** 主干其后又增 r11 测试文件。r13 水位只增不减。`npm run build` 当时全绿。全库一份 `modebarHidden.guard.test.ts`。

## 纪律

- 不改存档 key / `meta.id` / 题库 / seed。kit 只 import。
- 验收看 915×412 `getBoundingClientRect`，禁止只 grep sticky。
- `localStorage` 只在 `#/game/` 同源页写。独立 context。
- 进关：有蓝本用 `.l99-continue`；gold-hook / duo-arena 走自己的 CTA。
- 测试只增不减。禁 force。宽屏 412×915 / 1280×800 零回归。

## 测试备忘

- `npm run build && npx vite preview --port 4173`；`/usr/local/bin/google-chrome`。
- 收藏 overlay：首页 🎁 → 改 hash。收藏布局：只量 overlay **内** 页签/升级。
- N-58：`.icon-btn--pause` → 再点跳过。
- 数独：必须「对战竞速」。sky：闯关 + 双人。orb/snake：闯关 + 双人。block-drop：战役已绿，模式进关才补量。

---

## Top 10

1. **N-48** overlay 跨路由（A，r12 A 在途）。
2. **N-58** 暂停套跳关门（A，c14c 已复现两层 dialog）。
3. **N-59** 收藏 915 双栏页签 36 / 升级切底（A，≠ N-48）。
4. **N-52** 对局下半场 + 怎么玩 471（B，r12 B 在途；开擂已 sticky）。
5. **N-60 / N-61** 竞技场闯关技能键 436（B）。
6. **N-62** merge-2048 四向 392（B）。
7. **N-49** 数独对战 crop 1046（B）。
8. **N-46** sky 键 42 + 开关 31（B）。
9. **N-2/3/4** 视口返工（B）：先灭 stage 自滚。
10. **N-10 / C-3 / N-29** 顺手：象棋 460、snake-snack 707、candy-swing 出屏 260。

---

## 壳层（A）

### N-48 收藏 overlay 跨路由 🔧

- `hashchange → close`，对照 S-3。验收：开 🎁 再进 `#/game/*`，overlay 个数 0；close 摘监听。
- 不要写成 N-42/N-58。误名 `collection.n58.test.ts` 必须改回 N-48。

### N-58 暂停 + 跳关门 🔧

- 已暂停时不要再叠 `.dialog--gate`（先关暂停或全局互斥）。Esc 一次回游戏。
- 不要改授权题/密码。N-33 五钮仍在屏。

### N-59 收藏 915 双栏布局 🔧（新；≠ N-48）

- `max-height:500px` 收预览；tab 与「知道啦」→44；升级/试穿第一屏可点。关闭 44 勿动。可与 N-48 同 PR、分测试。

### S-4 / N-37 / N-16 / N-43 / N-44

- **勿动**（S-4 go 已 44）。N-37 只复测。N-16 只补浏览器。C-6 只复测关 121。

---

## 休闲对战（B）

### 先 fetch r12 B

N-52…57 已合则销。未合则继续原文（`trio-r11-playbook.md`），不要双改 `.fk-train-shell` / hop 单人。

### N-52 对局 🔧

- 怎么玩 471；下半场 419+；暂停行 549。开擂若已在屏只修其余。

### N-60 orb-arena 闯关 🔧 / N-61 snake-royale 闯关 🔧

- 技能键 top 436。复用双人底栏。双人零回归。可同 PR。回选关 30px 顺手 44。

### N-62 merge-2048 四向 🔧

- top 392。规则/seed 不动。

### N-49 数独对战 🔧

- crop 1046。勿与闯关工具 380 混账。

### N-46 sky-squad 🔧

- `--k:42` / 双人 36；暂停 33；开关 31 → 44。判定零触碰。

### N-2/3/4 视口返工 🔧

- 掷骰 525 / 地产 448 / 确定 511。先消灭该态 `.game-stage` 自滚。

### N-50

- 战役七键本轮在屏，**勿再挤**。仅当模式进关仍 419 再修。

### N-47

- 源码已 44，**只复测** bowling/prince/tank/首页芯片。未绿再补，勿第三份。

### 仍开

N-53…57（在途）；N-10 象棋 460；C-8 hue-hand 三态；C-3 snake-snack；N-15 若合入后 915 对战仍红；N-12/13；N-29 candy-swing 关内。
`casual-duo-fit-r5-b-4683` rebase 后守门二合一。

---

## 完成定义

1. N-48/N-58/N-59 关账或说明 r12 A 已合；N-60…62 关或降级；N-52…57 以主干为准。
2. 每条 915 留数字。orb/snake 闯关+双人；收藏 overlay 与布局分开报；N-58 必须「暂停仍开着点跳过」。
3. `npm test` / `npm run build` 水位只增不减。撞车取先合版。报告 SHA。
4. 新伤从 **N-63**。
