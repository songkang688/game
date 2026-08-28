# 三人组第 28 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r28-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #97 r27 … #90 r22、#87 r21、**PR #94** A、**PR #96** B。
> **新伤 N-144…N-146**。下一空号 **N-147**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. rebase 最新 `game-1.3`。
2. N-105 禁第四份。N-108 = 拼图无尽。
3. **PR #94** 合入 → N-117/118/120 只回归。**PR #96** 合入 → N-121/122/124 只回归。
4. 并号见笔记第二节。C-8 禁改 `SKY_H`。仓鼠 `.bh-btn` 走 N-47，勿写成 N-144。`.bba-swap` 走 N-132。

## 红线

不改存档 / 题库 / seed / 胜负 / 物理。热区 ≥44。三视口。root 走 UI 门。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`。fight-king 量选人格；bowling 量暂停；bumper 量三颗入口 + 选车。

---

## A / B 独占

| 工位 | 本轮新号 |
| --- | --- |
| **A** | **N-146** 缺 min-height 巡检；N-143 若未合 |
| **B** | **N-144** `.fk-ch`；**N-145** bowling/bumper |

---

## A 面

### P0 · N-146

静态测试：可点块必须有 `min-height` ≥44（或等价 `height`/`MIN_HIT_PX`）。豁免见笔记。先修 N-144/145 再绿亦可。

### 其余

N-143 写死 40/42；N-138 level99 壳；N-140 `.sp-key`；N-136 `*-back`；kit N-132/137；N-135 block-drop；N-100/99/97/131/130/128。

---

## B 面

### P0 · N-144

`fight-king` `.fk-ch` 补 `min-height:44px`。390/915 选人。N-142 `.fk-mode`、N-88 开打只回归/原号。

### P0 · N-145

bowling `.bl-btn`、bumper `.bc-open` 与 `.bc-pick` 补 44。**不要**当成 N-135 返回重做。

### 仍开不换号

N-141 `.ld-btn`；N-142 `.fk-mode`；N-139 mole/rbv-foe；N-135 bowling/fishing/orb **返回**；N-133/134；N-125/126/129；N-108；N-101+94；N-47；C-5 洞；N-29。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 三视口数字 + 小测试只增不减。
2. vitest 全绿。
3. 交卷 `docs/qa/trio-r28-tester-A.md` / `trio-r28-tester-B.md`。
4. 新伤从 **N-147** 起。
