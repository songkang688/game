# 三人组第 11 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `0004892d`（r10 A/B 已合入；交卷后派 r11 剩余项）。
范围：休闲 / 对战 / 动手。**未改** level99 / quiz99 / color-fun / math-farm。
未重做 N-25/31/1/32/26/27/29/23/40/41/42/2/3/4。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-45** | gold-hook 关内商店 veil | 915×412 进关点🛒：「接着挖」整钮线下，第三件 buy 也可能线下；底栏 HUD 压 veil 下沿 | 配方 I：`.gdh-veil--shop` 货架 `.gdh-shoplist` 单独 overflow；`.gdh-shopfoot` sticky 不透明底钉「接着挖」；veil `z-index:6` 压过 HUD。买卖/`SHOP` 零触碰。暂停不挂商店类 |
| **C-8 补** | ice-fire-forest 双垫 | r10 右栏仍 `flex-direction:column`，412 高第二套垫出屏 | 矮横屏双垫改 `row` 并排，`grid-row:3` |
| **N-10 补** | xiangqi | 248 收幅仍可能把悔棋排顶出首屏 | 500px 高档 `.xq-btns` sticky bottom；840 档不动 |
| **C-2** | brick-break | r10 已钳画布 + wrap `pan-y` + 键排 sticky | 本轮只复测，源码零改 |

## 验收（Chrome 数字见后续补测段）

- 商店路径：**闯关矿洞 → 进关 → 🛒**（模式选单无商店）。
- 主档 915×412：不滚能点「接着挖」与至少首屏买钮。
- 对照 390×844 / 1280×800：商店 + 暂停 veil 不劣化。
- 暂停「继续挖」点得到（勿回归）。

## 测试

只增：

- `src/games/gold-hook/shopVeil.r11.test.ts`
- `src/games/ice-fire-forest/landscapePads.r11.test.ts`
- `src/games/xiangqi/shortLandscape.r11.test.ts`

## 护栏

- 不改存档 key、题库、seed、胜负判定、kit
- 测试只增不减
- 禁 force push
