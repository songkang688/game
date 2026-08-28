# 三人组第 10 轮 · 测试修复员 A 记录（`c14c`）

基线:rebase 后 `origin/game-1.3 = ce14c0a5`（已含并行 A `7779` 的 N-39 / L-3 / faceLift 序列化 L-2，以及 r11 N-43/N-44）。
分支:`cursor/trio-r10-tester-a-c14c`。
本拍只补 **并行 7779 没做的 L-2 源函数换装**（`clockSVG` 本身换 arrowHandD），并留下接线断言。

并行 `7779` 已合入主干的记录见 git 历史 `58a6e71c`（N-39 / S-4 `.qz-jump-input` / N-16 走廊 / L-3 贴纸 / faceLift 真机序列化）。**那些文件本拍不再重做。**

## 对账

- N-39：主干已 `showMap(true)` ×4 + 切章 `showMap()` + 无 `instanceof HTMLElement`。本拍加 `src/games/level99.r10.test.ts` 守门。
- L-3：主干 `stickers.ts` 已扩第 4–10 章；`boardArt` 头注已写十章配齐。本拍 **零再改 stickers/boardArt**（rebase 撞车取先合版）。
- L-2：主干仍走 `faceLift` 消费端换装，`clockSVG` 产物仍是细线针。r7 原文是改渲染函数。本拍改 `clockSVG`。
- 未改 `styles.css` 结算、`tracing.ts`、`collection.ts`、`quiz99.ts`、pinyin-train、adventure-king、fight-king、fruit-catch。

## 本拍修了什么

### L-2 `clockSVG` 换 arrowHandD / hubSVG / 11px ✅

- 指针 `arrowHandD(HOUR/MINUTE_HAND_SHAPE)`，轴心 `hubSVG()`，刻度 11px。
- 针尖仍按原角度 × 原长度（时 20 / 分 30）。`data-h` / `data-q` 零触碰。
- `LEGACY_DIGEST`：`asLegacyHtml` 把换装钟还原成 1.1 细线再哈希，题面数字/选项/正确项仍钉死。
- `faceLift` 对新产品恒等（细线已不存在）；旧细线夹具仍覆盖 liftFaceBody。
- 测试:`src/games/clock-house/clockSVG.r10.test.ts`。
- 浏览器:第 1 关 `svg[data-h]` 无 `<line>`、有 `clk-lift-hour` + `clk-hub`。`/tmp/r10a-clock-house-l2.png`。

### N-39 守门测试（代码已在主干）

- `level99.r10.test.ts`：初次 `showMap(true)`、三处回地图 true、切章 false、聚焦路径不写 `instanceof HTMLElement`。
- 浏览器复证 hop-pads 915×412 当前关 top=201 可见可点；回地图同样；1280×800 在屏。`/tmp/r10a-hop-pads-*.png`。

### L-3

- 先合版已销账。浏览器抽第 4 章 31 格全贴纸。`/tmp/r10a-find-diff-ch4.png`。

## 还剩什么

- r10/r11 清单里本拍未接的项以最新 playbook 为准（N-43/N-44 已由其他 A 合入）。
- 5s timeout 类 AI 用例（bomb-buddies / snake-* / xiangqi 两步杀）与本拍无关，整库拥堵时会红。

## 水位

| 步骤 | 文件 | 用例 |
|---|---|---|
| 本拍改动前全库（含并行合入） | 1111 | 19336（5 条 timeout 红，隔离后 2 条仍 timeout） |
| `npm run build` | 过 | tsc + vite |
| 本拍新增 | `clockSVG.r10.test.ts` + `level99.r10.test.ts` | 只增不减 |

管理员 `kangkang`；预览 4177；Chrome `/usr/local/bin/google-chrome`。
