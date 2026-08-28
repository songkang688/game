# 三人组第 26 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r26-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #93 r25 … #90 r22、#87 r21。
> **新伤 N-138…N-140**。下一空号 **N-141**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. rebase 最新 `game-1.3`。
2. N-105 禁第四份 14→16。N-108 = 拼图无尽。
3. A 在途 N-117/118/120、B 在途 N-121/122/124 **勿重做**。
4. 并号：N-94/101（dvs 40）、N-104（ld-back）、N-133（rbe-back）、N-134（shr-back）、N-135（bl/fs/oa/bd-back）。
5. N-12 族 / C-8（禁改 `SKY_H`）/ N-90：只回归。

## 红线

不改存档 key / `meta.id` / 题库 / seed / 胜负。热区 **≥44**。三视口。root 走 UI 门。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`。量 `getBoundingClientRect().height`。

---

## A / B 独占

| 工位 | 本轮新号 |
| --- | --- |
| **A** | **N-138** level99 壳；**N-140** 数独 `.sp-key`；N-136/137/132 若未合 |
| **B** | **N-139** mole-pop 开/返回 + 红蓝跑 `.rbv-foe` |

---

## A 面

### P0 · N-138

`level99.ts`：`.l99-back` / `.l99-tool` / `.l99-continue` / `.l99-tab` / `.l99-ov-btn` 补 `min-height:44px`。  
验收：word-garden 地图+进关 390/915，工具行与开始冒险 ≥44；overlay 胜负两钮 ≥44。  
勿动 `.l99-node`、N-100 锚定、N-117 折行方案。矮档 skip 的 padding 不得压高度。

### P1 · N-140

数独 `.sp-key` 40→44。N-99 盘面另案。题库零触碰。

### 其余

N-135 的 block-drop；N-136 巡检；N-137/132 kit；N-131/130/128/100/99/97；N-117 族对账。

---

## B 面

### P0 · N-139

- mole-pop `.mp-open, .mp-back` 40→44。**不要**当 C-5 洞径重做。
- red-blue-race `.rbv-foe` 40→44。无尽 `.rbe-back` 仍是 N-133。

### 仍开不换号

N-135 bowling/fishing/orb；N-133/134；N-125/126/129；N-108；N-101+94；N-107…；C-5 洞；N-29。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 三视口数字 + 小测试只增不减。
2. vitest 全绿。
3. 交卷 `docs/qa/trio-r26-tester-A.md` / `trio-r26-tester-B.md`。
4. 新伤从 **N-141** 起。
