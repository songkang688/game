# 三人组第 11 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `0004892d`（r10 A/B 已合入）。
范围：休闲 / 对战 / 动手。**未改** level99 / quiz99 / color-fun / math-farm。
未重做 N-25/31/1/32/26/27/29/23/40/41/42/2/3/4。

Chrome：`/usr/local/bin/google-chrome` · preview `127.0.0.1:4180`。路径：**闯关矿洞 → 进关 → 🛒**（本机用 `?level=1` 直达同一关内画面）。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 | 915×412 数字 |
|---|---|---|---|---|
| **N-45** | gold-hook 关内商店 veil | 「接着挖」top 513 整钮线下；第三件 buy 也可能线下；HUD 压 veil 下沿 | 配方 I：`.gdh-veil--shop` 货架单独 `overflow-y:auto`；`.gdh-shopfoot` sticky 不透明底钉「接着挖」；veil `z-index:6`。买卖/`SHOP` 零触碰。暂停不挂商店类 | 「接着挖」269–313（h44）在屏；首件 buy 246–290 在屏；HUD top 337 不压关闭钮。第三件 buy 394–438 在货架滚线下（验收只要首屏买钮） |
| **C-8 补** | ice-fire-forest 双垫 | r10 右栏仍竖叠，412 高第二套垫出屏 | 矮横屏 `.iff-pads` 改 `flex-direction:row` + `grid-row:3` | 18 个 pad 钮 below=0；首 221–265、末 317–361 |
| **N-10 补** | xiangqi | 248 收幅仍把悔棋排顶出；sticky 无滚动祖先无效 | 430px 高档再收到 196；800px 宽档棋盘左、工具列右，按钮 `flex:0 0 auto` | 悔棋 104–148 / 确认 154–198 / 提示 204–248 / 重摆 254–298，四钮全在屏 |
| **C-2** | brick-break | r10 已钳画布 + wrap `pan-y` + 键排 sticky | 本轮源码零改，只复测闯关第 1 关 | 画布底 280；左右板钮 296–352，below=0 |

## 对照档（商店关闭钮）

| 视口 | 「接着挖」 | 暂停「继续挖」 |
|---|---|---|
| 915×412 | 269–313 ✅ | 258–302 ✅（`.gdh-veil` 无 `--shop`） |
| 390×844 | 445–489 ✅（首轮量） | 345–389 ✅ |
| 1280×800 | 592–636 ✅ | 未再拆一档；暂停结构与 915 相同 |

## 测试（只增）

- `src/games/gold-hook/shopVeil.r11.test.ts`
- `src/games/ice-fire-forest/landscapePads.r11.test.ts`
- `src/games/xiangqi/shortLandscape.r11.test.ts`

相关单测 9 文件 / 64 用例绿（含 r10 守门）。未为变绿改既有用例。

## 护栏

- 不改存档 key、题库、seed、胜负判定、kit
- 禁 force push
