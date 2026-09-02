# 三人组第 11 轮 · 测试修复员 A 记录

先合入主干的是 `cursor/trio-r11-tester-a-7779`（N-43/N-44 补笔）。本文件后半是 `cursor/trio-r11-tester-a-65de` 剩余项（S-4 直达钮、C-6、N-47）。撞车取先合版，未回滚 7779 结构。

---

## 7779：N-43 / N-44 补笔（已在主干）

基线：进场时 `game-1.3` 已含 r10 合入（N-39 / S-4 input / N-16 / L-2 / L-3 **禁止重做**）。
**编号红线**：N-40 是 duo-rush，不是 color-fun。N-45 gold-hook 商店是 B。

### N-43 补：矮横屏 `.clf-scrolly` 不许把操作排卷走

- `ui.ts` 在 `@media (max-height:500px) and (min-width:640px)` 写 `.clf-wrap.clf-scrolly{overflow:hidden;}`。
- 源码守门 `shortLandscape.r11.test.ts`。

### N-44 补：第 1 关数一数勿劣化

- 钳位改 `.mtf-illus:not(.mtf-illus-count)`；竖式 `.mtf-vert` 仍钳 64px。

### N-37 × pinyin 限时 135 复测

- 新增 `src/games/pinyin-train/timed135.r11.test.ts`。

7779 水位：`npm test` **1128** files / **19369** tests；`npm run build` 全绿。未做 915×412 真机 CDP。

7779 当时未做：N-16 / L-3 / C-6 / S-4 直达钮。

---

## 65de：S-4 直达钮、C-6、N-47

角色：壳层 + 闯关学习。分支 `cursor/trio-r11-tester-a-65de`。  
进场主干（写补丁时）：`f1fd57d8`。rebase 到含 7779 的 `origin/game-1.3` 后合入。

### 进场水位（f1fd57d8）

- Test Files 1 failed | 1123 passed (1124)；Tests 1 failed | 19359 passed (19360)
- 失败：`bomb-buddies/ai.test.ts` 5s timeout（既有 flake）

### 对账（本轮 65de 不重做）

| 项 | 主干状态 | 65de |
|---|---|---|
| N-33/34/35/36/37/38/30、收藏册、N-39 | 已合 | 跳过 |
| L-2 / L-3 | 已合 | 未改 clockSVG；贴纸 READY_THEMES 0–9 |
| N-16 | corridorFit + ak-pad sticky | 跳过 |
| N-43 / N-44 | 16e55f2a + 7779 补笔 | **未写第三份双栏** |
| S-4 `.qz-jump-input` | 已 44 | 只补 `.qz-jump-go` |

### S-4 直达钮 32→44

- `quiz99.ts`：`.qz-jump-go` 基准 + 矮屏档 `min-height: 44px`。
- `quiz99.s4.test.ts` 增断言。

### C-6 补笔 · alien-seek 推理关

- `Array(121).fill(1)` 后下一关下标 **121**（ch6 idx 2），`isDeduceLevel(121)`。
- 矮宽横屏双栏：画布左，线索 / `.als-tools` / `.as-pads` 右 sticky；`syncSize` 钳高。
- 测试：`alien-seek/shortLandscape.r11.test.ts`。判定 / seed 未动。

### N-47 模式芯片

- 壳层 `home.ts` 芯片 `min-height:46` + `min-width:44`；`homeN47.r11.test.ts`。
- 开关态菜单：`.bl-open` / `.bl-pick`、`.pcp-mode`、`.tkb-open` → 44；`modeMenuN47.r11.test.ts`。未动 B 关内键排。

### 红线

未改存档 key / `meta.id` / 题库 / seed。kit 只 import。测试只增不减。
