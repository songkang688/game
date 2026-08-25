# 三人组第 2 轮 · 学习优化员抽验与改动记录

> 基线：`origin/main = cf7367e`（三人组第 1 轮已全部合入）。
> 与第 1 轮 `trio-r1-learn-notes.md` 衔接：本轮专做第 1 轮「留给后续轮次」里点名的缺口——
> **动作 5 款与经典 4 款的独立结算面板朗读**，顺带修抽验中发现的结算面板对比度问题。

## 一、抽验方式与结论

逐款通读动作 5 款（garden-guard / fruit-slice / rainbow-run / ocean-munch / sprout-defense）
与经典 4 款（sling-birds / candy-swing / bubble-aim / gomoku）的胜负结算路径，
对照壳层 `dialogs.ts`（平台结算弹窗，R1 已带朗读）与 `level99.ts`（结算浮层，R1 已带朗读）：

| 游戏 | 逐关结算走哪里 | 朗读现状（改前） | 本轮动作 |
| --- | --- | --- | --- |
| 花园守卫 | 自绘 canvas 面板（clear/retry） | ❌ 无 | 🔧 补朗读 |
| 水果切切乐 | 自绘 canvas 面板（clear/retry/end） | ❌ 无（含禅宗/街机结束面板） | 🔧 补朗读 |
| 彩虹跑跑 | 自绘 canvas 面板（clear/retry） | ❌ 无（含无尽模式里程结算） | 🔧 补朗读 |
| 海底大胃王 | 自绘 canvas 面板（clear/retry） | ❌ 无 | 🔧 补朗读 |
| 绿芽保卫战 | 自绘 canvas 面板（clear/retry） | ❌ 无 | 🔧 补朗读 |
| 弹弹小鸟 | 每关胜负都调 `api.onWin/onLose` → 平台弹窗 | ✅ R1 弹窗朗读已覆盖 | 不动 |
| 糖果秋千 | 自绘 canvas 面板（won/failed），仅全通关走弹窗 | ❌ 逐关无 | 🔧 补朗读 |
| 泡泡瞄准手 | 同糖果秋千 | ❌ 逐关无 | 🔧 补朗读 |
| 五子棋 | 自由对战走弹窗 ✅；残局逐题结算只改 DOM 文字自动进下一题 | ❌ 残局逐题无 | 🔧 补朗读 |

另按第 1 轮同款五维度（鼓励文案/热区/对比度/语音/手感）抽验这 9 款的结算面板：

- **鼓励文案**：全部温柔无批评（「哎呀,花朵蔫了……」「差一点点……」），✅ 不动。
- **热区**：canvas 面板按钮均 132×44 或整屏点按，✅ 不动。
- **对比度**：🔧 结算面板多处不达 WCAG AA，本轮一并修（见下）。
- **手感**：面板出现有音效与震屏、按钮走 `drawButton` 统一反馈，✅ 不动。

## 二、本轮改动（最小 diff，不动关卡表/存档 key/meta.ts 模块约定）

### 1. 结算面板朗读（走现有 `speech.ts`，不动 engine audio）

每款新增 2–3 个**纯函数文案模板**（便于测试），放进各自已有测试的纯模块；
`index.ts` 在胜负定格那一刻 `speak(...)`，离开面板（下一关/重试/回地图/复活）与 `destroy()` 时
`stopSpeaking()` 防叠音；无中文语音包时静默降级（沿用 speech.ts 行为）：

- `garden-guard/logic.ts`、`sprout-defense/logic.ts`、`ocean-munch/logic.ts`：
  `clearSpeechLine`（三星/无伤夸完美）+ `retrySpeechLine`（安抚 + BOSS 关把 `bossFailHint()`
  作为「悄悄告诉你」念出来——识字量 300–800 字的孩子读不了 14px 的提示小字）。
- `rainbow-run/logic.ts`：过关按任务完成与否给不同鼓励；无尽模式失败报里程、
  平/破纪录大声夸（与面板「🎉 新纪录」显示条件一致）。
- `fruit-slice/logic.ts`：经典战役 clear/retry + 禅宗/街机结束面板 `endSpeechLine`（破纪录夸）。
- `candy-swing/levels.ts`、`bubble-aim/logic.ts`：`wonSpeechLine` / `failedSpeechLine`
  （失败先念原因「糖果碰到刺啦！」再安抚，胜利报星数）。
- `gomoku/puzzles.ts`：`puzzleSolvedSpeechLine`（按是否用过提示区分夸法）+
  `puzzleFailSpeechLine`（把「第 N 列第 M 行」的第一步正解方向念出来）。

**防叠音约定**：终局/全通关那次会弹平台结算弹窗（自带朗读），这几处**跳过**面板朗读；
糖果秋千/泡泡瞄准手过关 1.8s 后自动进下一关，**不**打断朗读（夸奖念完正好接上新关卡）。

### 2. 结算面板对比度（白底面板实测，逐色算过 WCAG 比值）

| 位置 | 旧 → 新 | 对比度 | 判定标准 |
| --- | --- | --- | --- |
| 动作 5 款失败面板标题 `#b28ae8` | → `#8a5ac9` | 2.7 → 4.8:1 | 24px 大字要 3:1，原值不达标 |
| 花园守卫/绿芽/海底 BOSS 提示 `#c47a2a` | → `#a05914` | 3.4 → 5.3:1 | 14px 小字要 4.5:1 |
| 彩虹跑跑任务行 `#4a9a5a` / `#9a9aa8` | → `#357a42` / `#62626f` | 3.5/2.8 → 5.2/6.0:1 | 15px 小字要 4.5:1 |
| 糖果秋千副文案 `#9B7BC8`（13px） | → `#7a5aa8`（14px） | 3.5 → 5.5:1 | 小字 4.5:1 + 最小 14px |
| 泡泡瞄准手过关副文案（13px 沿用标题色 4.4:1） | → `#3a6c9e`（14px） | 4.4 → 5.5:1 | 同上 |
| 泡泡瞄准手失败副文案 `#5E86B0` | → `#46688f` | 3.8 → 5.8:1 | 同上 |

失败面板标题 `#E0708C`（22/20px 粗体，3.06:1）达大字 AA 下限，本轮不动。

### 3. 新增单测（12 例，用例数只增不减）

`garden-guard/logic.test.ts`、`sprout-defense/logic.test.ts`、`ocean-munch/logic.test.ts`、
`rainbow-run/logic.test.ts`、`fruit-slice/logic.test.ts` 各 2–3 例；
`candy-swing/physics.test.ts`、`bubble-aim/logic.test.ts`、`gomoku/puzzles.test.ts` 各 2 例。

## 三、留给后续轮次（本轮不动，避免越权/扩散）

- 弹弹小鸟每关都弹平台结算弹窗（体验和其余 8 款的「面板 + 下一关」不同），
  统一与否属产品决策，不在学习优化范围。
- 各游戏**关内**浮动文字（`addFloat` 的连击/加星提示）是瞬时动画，未按静态文字标准修对比度。
- 五子棋自由对战「对手思考中…」为纯视觉动画，无朗读必要。
