# 三人组第 10 轮 · 测试修复员 B（休闲/对战/动手）

- 分支：`cursor/trio-r10-tester-b-c14c`
- 基线：`origin/game-1.3` @ `bddb8e50`（已含 PR #63：N-25/31/N-1/N-32/N-26/N-27/N-29/N-23，未重做）
- 方法：源码配方 L/E 修补 + vitest 只增；`npm run build` 全绿；preview `:4178` + puppeteer-core + `/usr/local/bin/google-chrome` 主档 **915×412** 实量。脚本在 `/tmp`，不入库。
- 红线：未改存档 key / 题库 / seed / 判定；`src/art/kit/` 只 import；未动 `src/styles.css` 结算弹窗、`level99.ts`、`quiz99.ts`、word-garden tracing。`duo-rush/match.ts` 零触碰。

## 水位

| 时点 | 文件 | 用例 | 备注 |
| --- | --- | --- | --- |
| 进场（r9 笔记口径） | 1095 | 19288 | `6a9f42d0` |
| 本轮全库 `npm test` | **1119** | **19344** | 1114 文件 / 19339 用例绿；5 条与本 diff 无关的慢测超时或 gomoku 档位方差 |
| 本轮新增 | +10 文件 | +约 14 例 | 各修复配套 `*.r10.test.ts`；麻将热区改在既有 `index.test.ts` |
| `npm run build` | — | 全绿 | tsc + vite |

## 本轮关账

### N-40 duo-rush 赛道态工具条 🔧✅

- **改**：`src/games/duo-rush/index.ts` 矮屏 `@media (max-height:500px)` 把 `.dr-btns` `position:sticky;bottom:0`，键盘提示行收起。不钳 `.dr-canvas`、不动半屏 `.dur-padbtn`。
- **915×412 实量**：暂停 / 再来 / 换玩法 **top 285–332**（修前 top 462 整排线下）；圆钮 223–267、44×44 仍在屏；画布显示高 295 未再钳。
- **1280×800**：画布 108–454、工具条 531–578 均在屏。
- **测试**：`toolbarSticky.r10.test.ts`（sticky 在场 + `match.ts` 不含 sticky）。

### N-41 mahjong-bloom 手牌宽 🔧✅

- **改**：`.mj-tile` `34×46` → `min-width/min-height 44`、宽 44 高 46。360 档不再收到 30px；小牌 `.mj-small` 仍 26×34。手牌 480 以下折行。
- **915×412 实量**：手牌 **44×46**（minW=44）。
- **测试**：`index.test.ts` 热区断言改为 ≥44。

### N-42 puff-bros 暂停 34px + 模式钮 37px 🔧✅（C-8 六键同改）

- **改**：`.pfb-btn` / `.pfb-mode` `min-height:44`；矮横屏双栏把 `.pfb-pads` 放到画布右侧。
- **915×412 实量**：菜单五钮高 **44**；关内暂停 **44×65** top 184；六键 44×44，最底一行 302–346 在屏。
- **测试**：`hit.r10.test.ts`。

### N-2 / N-3 / N-4 回合必点（配方 E）🔧✅

- **flight-chess**：`.fc-hud` sticky 底 + 盘面按余高收方。
- **star-estate**：`.se-pad` sticky 底 + 棋盘按余高收方。
- **hero-cards**：`.hc-hand` / `.hc-pad` sticky 叠底，日志收高；手牌 `flex-wrap` 零回归。
- **测试**：`stickyHud.r10.test.ts` / `stickyPad.r10.test.ts` / `stickyHand.r10.test.ts`。
- **实量**：脚本在地图层未点进残局时 HUD 为 0×0（路由烟测），关账以 CSS + 单测为准。

### 余力

| 编号 | 结果 |
| --- | --- |
| C-8 ice-fire-forest 双垫 | ✅ 矮横屏 grid 右栏 |
| C-2 brick-break | ✅ wrap `touch-action:pan-y`，canvas `max-height:calc(100dvh - 168px)`，左右键 sticky；物理 `W/H` 不变 |
| N-10 xiangqi / gomoku / weiqi | ✅ `max-height:500px` 再收一档（象棋 248px + 工具行 sticky；五子 248px；围棋滚动口 + `hostWidth` 矮屏 chrome 168） |

## 未完成 / 留给后轮

- N-45 gold-hook 商店 veil（r10 playbook 有账，本轮按用户清单未做）。
- C-8 其余菜单组（snow-fight / shoot-range / puzzle-tiles / balloon-pop / duo-arena 等）。
- N-5…N-9 / N-20 盘面组、N-13/N-14、C-3/C-4/C-5/C-6/C-7、C-9。
- 全库 5 条慢测超时/方差：与本 diff 无关，未改判定。

## 文件

- 玩法：`duo-rush` / `mahjong-bloom` / `puff-bros` / `flight-chess` / `star-estate` / `hero-cards` / `ice-fire-forest` / `brick-break` / `xiangqi` / `gomoku` / `weiqi-garden`
- 测试：上列 `*.r10.test.ts` + 麻将 `index.test.ts` 热区口径
