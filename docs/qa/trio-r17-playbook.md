# 三人组第 17 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r17-learn-notes.md`。主干 `3cf42925`。
> **禁止重做**：N-47/63/68/73/77、C-6、N-37、N-75…N-88、N-86、N-69…74、N-40 赛道 sticky、N-32 无尽战斗三钮、`OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`。
> **不覆盖** r14/r15/r16 笔记原文。
> A = 壳+闯关学习；B = 休闲对战动手。
> 本工位新伤 **N-90 / N-91 / N-94…N-97**。N-89 壳标题 ✅ `10022068`。N-75…N-85 源码已合，只许回归。

## 纪律

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。**不改** `balloon-pop` 的 `SKY_H`。
- 验收 915×412 `getBoundingClientRect`。禁 force。测试只增不减。
- 开/关、root 每档独立 context。撞车取先合版。
- 冲突合并：同时保留舞台宽度预算 **和** 高度预算。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + Chrome。
- 量前密码 `kangkang`，时长默认 1 小时即可。
- 仍要抽 390×844 与 1024×768，确认竖屏/平板不回退。

---

## 壳层（A）

### N-89 短横屏壳标题挤舞台 ✅（`10022068`）

- 已收 `.game-screen` 顶栏。只许 915 回归。禁止改 `orbPaneH`。

N-63 / N-47 / N-16 / S-1…S-4：✅ 只许回归。

---

## 闯关学习（A）

### N-97 math-farm root×深关选项 🔧（新；≠ N-37）

- 末章末关选项 top **416**。收农田行高；L1 勿动；题库零触碰。

---

## 休闲对战（B）

### N-60 / N-61 / N-62 贴线 🔧

- 技能/四向 top **394–398** 仍切 ~28px。再垫 1 档（例如 canvas 再让 32px），**禁止**改 `*_SHORT_PANE_H = 200` 守门测试。
- 若 N-89 壳层已消化这 28px，本项写回归数字即可结案。

### N-12 pool-stars 🔧

- 击球 / 暂停 / 蓄力条：源码无 `max-height`。补 `@media (max-height:500px)` 把 `.ps-bars`+击球钉进 412。勿改台面碰撞。

### N-10 weiqi-garden 🔧

- 已有 `(min-width:700px) and (max-height:500px)` sticky。915 仍切则改工具列 `fixed` 底或再收 `.wq-scroll`。不要删 700 断点误伤窄竖屏。

### N-3 star-estate 🔧

- 地格 13px@429。只放大当前格预览或略抬棋盘，勿把 `max-height:min(156px,38dvh)` 再砍到更小。

### N-55 snow 对战十二键 🔧

- 复测 `data-duo` 并排是否进 412。闯关是 N-85 ✅，勿重写闯关垫。

### C-8 balloon-pop 闯关天空 🔧

- CSS `.blp-sky` 显示高钳进约 412−壳。**禁止改 `logic.ts` 的 `SKY_H=420`**（walkthrough/learn 钉死上升时间）。

### N-90 tap-tiles 🔧（新）

- 无矮屏高度媒体。关内提示/操作进 412。勿改连击判定。

### N-91 fruit-catch 画布钳高 🔧（新；≠ N-1 接果）

- 底键已 sticky@520。r16 crop 在画布。钳 `.frc-canvas` 显示高；`MIN_CANVAS_DISPLAY_PX` 勿降到篮口重叠。

### N-94 duo-vs-star 双人选人「开打 ▶」🔧（新；≠ N-88）

- 开打 top **451**。照 N-88 钉进 412；芯片抬 44。

### N-95 xiangqi 自由对战设置屏 🔧（新；最重；≠ N-67）

- 「开始下棋」**713**，overflow hidden 滚不到。收进 412 或独立卷轴 + CTA 钉底。

### N-96 bomb-buddies 双人棋盘 🔧（新）

- 画布底 **475**。钳高；三键已在屏勿动。

N-87/88/86/75–85：✅ 只许回归。赛道 `.dr-btns` sticky **禁止回退**。 `casualFit.r10b` 已绿，勿回退 N-87。

---

## 完成定义

1. N-89 ✅。N-90/N-91 与 **N-94…N-97** 或书面降级。旧号 N-60/12/10/3/55/C-8 做或说明。
2. `npm test` / `npm run build` 只增不减（进场以主干最新水位为准）。
3. 每条 915 留 top/bottom 数字。
