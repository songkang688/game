# 三人组 r19 · 测试员 B 第 5 轮（本机，云额度耗尽）

基线：`origin/game-1.3` @ `d76a5fe8`（A 第 7 轮闸报告之上）。
工装：无头 Chrome · 915×412 / 390×844 · `hasTouch`。**未 seed root**。

## 零、r19 B 面回归（禁第二套）

`npx vitest run src/games/trioR19FixB.test.ts`：**24/24 绿**。N-98/95/94+101/96/107/106/108/102/103/104/C-5/N-29 源码标记仍在。N-105 未再改 combo/mahjong。

Playbook 已降级、本轮不返修：mine-garden 末排、lianliankan 密格、duo-rush 让分芯片初见折下（滚得到）、balloon-pop 飞行气球（C-8 只钳天空 CSS，禁改 `SKY_H`）。

## 一、本轮新伤

| 号 | 款 | 修前 915×412 | 修法 | 修后 |
| --- | --- | --- | --- | --- |
| **N-110** | sky-squad | 六键 `.sks-key` **410~454** 几乎整排出屏（U-19 sticky 写在 `min-height:501px`，412 吃不到；host hidden） | `@media (max-height:500px) and (min-width:640px)` 键排 **fixed 钉底** + wrap `padding-bottom:56px`；U-19 501–840 原文不动 | 六键 **362~406 h=44 全 IN** |
| **N-111** | fight-king 首页 | 训练场卡 **348~421** 切 9px | `.fk-root` 矮横屏自滚；N-88 选人开打 sticky 不回退 | 五张模式卡 **180~381 全 IN** |

390×844：sky 键 **735~779 IN**；五张模式卡全 IN。未改玩法 / seed / `SKY_H` / A 独占目录。

## 二、抽验未立项

fruit-slice / rainbow-run / sprout-defense / ocean-munch 菜单在 canvas 内，DOM 无出屏钮（r19 观察项仍留给像素工装）。skip-link 在壳层（A 面），本轮不改。

## 三、测试只增

- `src/games/sky-squad/shortLand.n110.test.ts`
- `src/games/fight-king/menuScroll.n111.test.ts`
