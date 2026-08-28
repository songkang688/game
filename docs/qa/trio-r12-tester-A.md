# 三人组第 12 轮 · 测试修复员 A 记录

基线:进场 `origin/game-1.3 = 0e435ad1`（已含 r11-A N-43/N-44 `16e55f2a` / PR #67）。
分支:`cursor/trio-r12-tester-a-c14c`，目标合入 `game-1.3`。
preview:`npx vite preview --host 127.0.0.1 --port 4181`。主档 **915×412**。管理员永久 root。

## git grep 未重做

| 项 | 主干证据 | 本轮 |
| --- | --- | --- |
| N-43 color-fun | `16e55f2a` 已合 | **零碰** `src/games/color-fun/` |
| N-44 math-farm 竖式 | `.qz-prompt .mtf-vert` 已在 `quiz99.ts` | **零碰** 农场竖式选择器 |
| N-39 `showMap(true)` | `level99.ts` 初次/回地图/选关四处已 true；切章仍 `showMap()` | 未改聚焦 |
| L-2 / L-3 | faceLift + stickers 已在主干 | 未改 `clockSVG` / 题库 SHA |
| N-33 / N-36 / **N-37 抬头** / N-38 | `:has(.l99-jump)` 与 sticky 原样 | **未改** N-37 抬头规则 |
| gold-hook / duo-arena / tank 双人 | B 目录 | **零碰** |

N-16 / L-3 已由 r10-A 合入，本轮按用户「不要重做」跳过。

## 修了什么

### S-4 扩容 `.qz-jump-input` 38→44 ✅（补直达钮）

- **对账**:r11 playbook 仍写 38px；主干输入框其实已是 44（r10-A `quiz99.s4.test.ts`）。r11 真机还量到直达钮高 **32**。
- **怎么修**:`.qz-jump-go` `min-height:44px`；关内 `.l99-jump .l99-tool` 同样 44。输入框保持 44。
- **测试**:`quiz99.s4.test.ts` 钉 input / go / 关内直达钮。
- **915×412 root×拼音 135**:`.qz-jump-input` **44×76** top 199；`.qz-jump-go` **44×109** top 199（不再是 32）。

### N-37 加重档复测 ✅（判定不动）

- **矩阵**:root 永久 + 915×412 + pinyin-train **第 135 关**三票。
- **数字**:crop **6**（与 r11 残余同量级）；三票 `xǐng / háng / xíng` top **352** bottom **400**，整排在 412 内（r9 加重档票 top 608 **仍消**）。
- `:has(.l99-jump)` / `.pyt-scene{height:44px}` / 题库判定 **未改**。布局不用再补。

### C-6 alien-seek（含推理关 121）✅

- 照 r4：画布钳高 + 工具排与 D-pad 当 below。r11 验收加 `isDeduceLevel`（进度格 121 → 第 122 关 / 0 基 121）。
- **改哪**:`stageFit.ts` `canvasDisplayCapPx`；`syncSize` 按舞台余量钳显示高；矮横屏双栏（场景左、线索/工具/垫右）。**不是** duo-arena 双人垫。
- **915×412 推理关**:`.as-clues` 在场；工具＋ D-pad 10 控 **折叠线下 0**；画布出屏 **0**。修前 crop 608 / 全线下。
- **915 找物第 1 关**:工具+垫同样线下 0、画布出屏 0。
- **360×640 / 412×915 / 1280×800** 推理关:折叠线下 **0**。
- 判定 `clueHolds` / `isDeduceLevel` / 关卡表零触碰。

### N-48 收藏册 overlay 跨路由 ✅

- 学习员 C 改号：**N-48**（绝不用 N-42 puff、也不占 N-46 sky-squad）。
- 学 S-3：`hashchange → close()`，`close` 里摘监听。
- **测试**:`collection.n48.test.ts` 源码钉 + `collection.test.ts` FakeDoc 放火。
- **浏览器**:首页 🎁 开册 overlay=1；`hash=#/game/clock-house` 后 overlay=**0**。

## 水位

- `npm test`: **1134 文件 / 19395 用例**。gomoku `地狱 vs 普通` 偶发弱方 3 胜（阈值 ≤2），单测重跑即绿；与本 diff 无关。
- `npm run build`（`tsc --noEmit && vite build`）全绿。
- 测试只增不减。存档 key 未改。

## 红线 / 交给 B

- 未改 color-fun、math-farm 竖式、gold-hook、duo-arena、tank 双人。
- N-52…N-57、N-45、N-40/41/42 puff 仍属 B。
