# 三人组第 9 轮 · 测试修复员 B

基线：`origin/game-1.3` @ `4b3a4cab`（r9 学习笔记已合入）。
范围：休闲 / 对战 / 动手。壳层与纯学习款未碰。

## 进场水位

`npm test` 在本环境首次跑前需 `npm install`。对账 r5–r8 playbook：N-25…N-32、N-1、N-23 补充在 `src/**` 均未合入（r8 对账「基线以来 src 零提交」仍成立，直至本 PR）。

## 本轮已关

| 编号 | 款 | 坏在哪 | 怎么修 |
|---|---|---|---|
| **N-25** | fight-king 格斗塔 | 915×412 裁 498 / 出屏 335 / 八键线下；390×844 裁 123 | 只改 `showTower`：矮屏/窄屏把出战八宫格收成「当前出战：×× · 换人 ▾」。`FIGHT_MIN_H` / `stageMaxWidthPx` 零改。护栏：人机/双人/无尽不走该类 |
| **N-31** | fight-king 训练场 | 开触屏键后 8 键+假人 3 钮线下 | `.fk-train-shell`：教学表限高自滚，键排放表后 sticky 底，假人行 sticky 顶 |
| **N-1** | fruit-catch | 横屏+平板画布出屏（r5 最重） | 配方 B：`canvasDisplayCapPx` 钳显示高，resize 重量、destroy 经 Janitor 摘监听；左右键矮屏 sticky。判定/W×H 不动 |
| **N-32** | brave-path 无尽战斗 | 攻击/防御/莓果三钮线下 | 配方 E：仅 `onFlee` 战斗挂 `.bvp-endless-fight`，操作行 sticky bottom。闯关 l99 / 备战小屋未动 |
| **N-26** + C-9 | duo-vs-star 闯关 | 七键线下；`.dvs-back` 32px | 矮横屏双栏键在画布侧；`.dvs-back{min-height:40px}`；window4 r3 断言取反。其余五模式只跟着走、不当重伤 |
| **N-27** | dot-maze 四模式 | 方向键线下 | 矮横屏双栏：单人 D-pad 右、双人一人一侧。`.dmz-menu` flex 白底修复保留 |
| **N-29** | bubble-aim 关内 | 发射台出屏 | 配方 B 钳 `.ba-canvas` 显示高；resize 挂、destroy 摘 |
| **N-23 补充** | bubble-aim / candy-swing / sling-birds 地图 | 无 focusCurrent；ba-map clamp 下限 420>412 | 当前关 `scrollIntoView({block:"center"})`；ba-map 改 `min(960px, max(160px, 100dvh-120px))` |

## 未关（有空未打包）

- N-2/N-3/N-4 回合必点组（flight-chess / star-estate / hero-cards）
- C-2…C-8（brick-break / snake-* / mole-pop / alien-seek / match-stars / ice-fire-forest 等）
- N-5…N-24 中 B 范围其余项（playbook 仍有效）
- 视口实测：本环境以源码断言 + 纯函数钳高测试为主；Chrome 五档矩阵未在本回合截图留档（预览脚本具备，优先把重伤合入）

## 护栏

- 不改存档 key、题库、seed、胜负判定、kit
- 测试只增不减
- fight-king 既有 `stageFit.test.ts` 零改
