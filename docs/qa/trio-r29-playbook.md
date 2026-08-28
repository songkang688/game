# 三人组第 29 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r29-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #98 r28 … #90 r22、#87 r21、**PR #94** A、**PR #96** B。
> **新伤 N-147…N-149**。下一空号 **N-150**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. rebase 最新 `game-1.3`。
2. N-105 禁第四份。N-108 = 拼图无尽画廊，**不是** `.pz-back`。
3. **PR #94 / #96** 合入则对应号只回归。fruit-catch 开/返回走 **N-121**，勿写成 N-147。
4. 并号见笔记第二节。C-8 禁改 `SKY_H`。

## 红线

不改存档 / 题库 / seed / 胜负 / 物理。热区 ≥44。三视口。root 走 UI 门。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`。量 `.sn-back`、`.pz-back`、`.hh-catch`、`.dvs-pick`、sky-squad 模式胶囊。

---

## A / B 独占

| 工位 | 本轮新号 |
| --- | --- |
| **A** | **N-149** `*-open`/模式胶囊巡检 |
| **B** | **N-147** 两款返回；**N-148** 接牌 + dvs 芯片 |

---

## A 面

### P0 · N-149

静态测试：`.\\w+-open` 与作为 button 的 `.\\w+-mode` 须 min-height≥44 或 kit 抬升。首修/抽验 `sky-squad` `.sks-mode`。N-121 三款合入前跳过或白名单。

### 其余

N-146 缺高度；N-143 写死 40/42；N-138/140/136/137/132；N-135 block-drop；PR #94。

---

## B 面

### P0 · N-147

snake-snack `.sn-back`、puzzle-tiles `.pz-back` 补 44。不要动 N-108 画廊逻辑。

### P0 · N-148

hue-hand `.hh-catch`、duo-vs-star `.dvs-pick` 补 44。N-94/101 只回归。

### 仍开不换号

N-144/145/141/142/139；N-135 三款返回；N-133/134；N-125/126/129；N-108；N-121 对账；N-47；C-5；N-29。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 三视口数字 + 小测试只增不减。
2. vitest 全绿。
3. 交卷 `docs/qa/trio-r29-tester-A.md` / `trio-r29-tester-B.md`。
4. 新伤从 **N-150** 起。
