# 三人组第 24 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r24-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #91 r23、PR #90 r22、PR #87 r21。
> **新伤 N-132…N-134**。下一空号 **N-135**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. rebase 最新 `game-1.3`。
2. N-105：主干已 16px，禁止第四份 hunk。
3. N-108 = 拼图无尽（主干）。
4. A 在途 `cursor/trio-r21-p0-n117-1cd5`：N-117/118/120 **勿重做**，合入则回归。
5. B 在途 `cursor/trio-r21-tester-b-1cd5`：N-121/122/124 同上。
6. N-12/10/3/55/81/C-8（禁改 `SKY_H`）/N-90：只回归。

## 红线

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。
- 三视口；热区 **≥44**（不要按 kit 旧值 40 结案）。
- canvas 量 `inRect` 矩形。`.l99-tabs` 禁 `overflow-x:auto`。
- root 走 UI 门 `kangkang`。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`；独立 context。

---

## A / B 独占

| 工位 | 独占 | 本轮新号 |
| --- | --- | --- |
| **A** | ui / level99 / quiz99 / 学习款；**本轮允许动** `src/art/kit/uiTouch.ts` **仅 N-132 常数** | **N-132**；其余 r21–r23 A 项 |
| **B** | 其余 games | **N-133 / N-134**；r22/r23 canvas 与 r19 未修项 |

除 N-132 外仍禁止改 kit 其它文件、`src/engine/**`。

---

## A 面

### P0

| # | 改什么 | 验收 |
| --- | --- | --- |
| **N-132** | `MIN_TOUCH_PX` 40→44；同步注释与 kit 测试 | `touchUpliftCss` 输出含 `min-height:44px`；bubble-aim `.bba-swap` 915/390 ≥44；引用 uplift 的款抽回归不回退 |
| N-117 族 | 先 rebase 在途 | 页签单行；136px 硬钳已删则写回归；`touch-action:pan-y` |
| N-105 | 只跑 vitest | 全绿 |

若禁止动 kit：N-132 书面降级（写清 40 的出处），B 用 N-133/134 口径逐款补。

### P1

N-131 quiz99 820 档；N-130 扩 window1 的 `*-msg` 巡检；N-100×17；N-99；N-97；N-128；N-127 A 三款。

### P2

N-119/N-123/N-109。

---

## B 面

### P0 新

### N-133 red-blue-race 无尽返回 🔧

`.rbe-back` 36→≥44。验收无尽态 390+915。勿动闯关 L1（r19 已绿）。

### N-134 shoot-range 顶栏 🔧

`.shr-back` 补 `min-height:44`；`.shr-toggle` 36→44。915 顶栏不裁切、不回退 N-78 双人开火钉底。N-124 平板档若在途已合，只回归。

### 仍开（不换号）

N-125/126；**N-129**（含 garden-guard **第三处** `btnBack` ~L2263）；N-108；N-101+94；N-107/98/95/96/102/103/106/104；C-5；N-29。  
N-121 族先对账 `2220e869`。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 三视口数字 + 小测试只增不减。
2. vitest 全绿。
3. 交卷 `docs/qa/trio-r24-tester-A.md` / `trio-r24-tester-B.md`。
4. 新伤从 **N-135** 起。
