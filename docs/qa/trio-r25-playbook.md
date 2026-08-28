# 三人组第 25 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r25-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #92 r24、#91 r23、#90 r22、#87 r21。
> **新伤 N-135…N-137**。下一空号 **N-138**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. rebase 最新 `game-1.3`。
2. N-105 禁止第四份 14→16。N-108 = 拼图无尽。
3. A 在途 N-117/118/120、B 在途 N-121/122/124（含 `ee4ebe70` 打靶钉底）**勿重做**。
4. N-12 族 / C-8（禁改 `SKY_H`）/ N-90：只回归。
5. `.ld-back` 仍是 **N-104**，不要写进 N-135。`.dvs-back` 40 并 **N-94**。`.shr-back` 仍是 **N-134**。

## 红线

- 不改存档 key / `meta.id` / 题库 / seed / 胜负 / 物理。
- 可点热区 **≥44**（不要用 kit 旧 40 结案）。
- 三视口 + reach。root 走 UI 门 `kangkang`。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`；独立 context。量返回钮 `getBoundingClientRect().height`。

---

## A / B 独占

| 工位 | 本轮新号 |
| --- | --- |
| **A** | N-135 的 **block-drop**；**N-136** 巡检；**N-137** kit 正文 14→16（仅 `uiTouch.ts` 常数+测试）；N-132 若未合 |
| **B** | N-135 的 bowling / fishing-star / orb-arena；N-133/134 若未合 |

除 N-132/N-137 外禁止改 kit 其它文件。

---

## A 面

### P0

| # | 改什么 | 验收 |
| --- | --- | --- |
| **N-135** block-drop | `.bd-back` 补 min-height:44（字号已 14） | 390/915 返回 ≥44 |
| **N-136** | 静态测试：游戏 CSS 里可点 `*-back` 必须 ≥44；豁免麻将/接龙牌背 | 新测试绿；N-104/134/135 修完后应绿 |
| **N-137** | `MIN_BODY_FONT_PX` 14→16 | `bodyFontUpliftCss` 输出 16px；抽 bubble-aim `.ba-msg` 不回退布局 |
| N-132 | kit `MIN_TOUCH_PX` 40→44（若 r24 未合） | 与 N-137 可同 PR，但是两个号 |
| N-117 族 | 对账在途 | 回归数字 |

### P1

N-131 quiz99 820；N-130 `*-msg` 巡检；N-100×17；N-99；N-97；N-128。

---

## B 面

### P0 新

### N-135 三款返回 🔧

- bowling-lane `.bl-back`（13px→≥14 且高 ≥44）
- fishing-star `.fs-back`（同上）
- orb-arena `.oa-back`

915+390。勿动 N-60 技能键（已结案）。

### 仍开不换号

N-133 `.rbe-back`；N-134 `.shr-back`/`.shr-toggle`；N-125/126/129；N-108；N-101+94（含 `.dvs-back` 40）；N-107…N-104；C-5；N-29。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 三视口数字 + 小测试只增不减。
2. vitest 全绿。
3. 交卷 `docs/qa/trio-r25-tester-A.md` / `trio-r25-tester-B.md`。
4. 新伤从 **N-138** 起。
