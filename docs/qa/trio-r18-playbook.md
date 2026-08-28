# 三人组第 18 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r18-learn-notes.md`。主干 `c8a3d154`。
> **禁止重做（已合 ✅）**：N-75…N-88、N-63、C-6、N-37、N-68、N-73、N-89、N-47/77/86、N-40 赛道 sticky、N-32 无尽战斗三钮、`OA_SHORT_PANE_H=200` / `SR_SHORT_PANE_H=200`。
> **本轮浏览器已销**：N-29 泡泡瞄准关内、N-54 跳跳台双人、地主双人出牌——只许回归，勿再修。
> **不覆盖** r14…r17 笔记原文。
> A = 壳+闯关学习（独占 `src/ui`、`level99`、`quiz99`、campaign/learning）；B = 其余 `src/games` 休闲对战。
> 本工位新伤 **N-98 / N-99 / N-100 / N-101**；结转 **N-90 / N-91 / N-94…N-97**（六款目录零提交，全部仍开）。

## 纪律

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。**不改** `balloon-pop` 的 `SKY_H`、不改文字守门测试阈值。
- 验收 915×412 `getBoundingClientRect`。禁 force。测试只增不减。
- 密码 `kangkang` 只在 rootgate 密码框输入，**禁止写入 storage**。开/关、root 每档独立 context。
- 撞车取先合版。冲突合并同时保留舞台宽度预算 **和** 高度预算。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + Chrome。
- root 深关走 UI：首页 🔑 → `kangkang` → 1 小时 → 打开 → 点 `.l99-node-rootopen`。
- 进场水位：tsc 绿；`npm test` **1193 文件（2 红）/ 19489 用例（5 红 1 skip）**——N-101 修完应回全绿，以此为新水位。
- 仍要抽 390×844 与 1024×768，确认竖屏/平板不回退（C-5 竖屏本来是绿的，别修反）。

---

## 壳层（A）

### N-89 短横屏壳标题 ✅（`10022068`）

- 本轮各案顶栏 18–62、舞台 66 起，无挤压。只许 915 回归，禁止改 `orbPaneH`。

N-63 / N-47 / N-16 / S-1…S-4：✅ 只许回归。

---

## 闯关学习（A）

### N-97 math-farm root×深关选项 🔧（r17 结转；≠ N-37）

- 末章末关选项 top **416**。收农田行高；L1 勿动；题库零触碰。

### 回归项（本轮已量绿，不必再修）

- root×pinyin-train 188：选项 294–342；root×clock-house 出发到达站 100：选项 290–336。quiz 型深关 root 工具行预算是够的——若 N-97 修完也到这水平即可结案。

---

## 休闲对战（B）

### N-101 主干 5 红灯 🔧（第一优先，先修这个再动别的）

- `combo-clash/index.ts:206` 的 `.cc-info` 与 `mahjong-bloom/index.ts:248` 的 `.mj-goal`：500px 档 font-size 14px（mj-goal 还有 nowrap），绊 `window1-mobile-text`×2 + `mobileText`×3。
- 修法：矮横屏档删 font-size 或写 ≥16px；mj-goal 去 nowrap（截断用 max-height + ellipsis 的现有写法另想，别缩字）。**禁止改守门测试**。矮横屏高度预算别顺手回退（那是 N-75/76 的活）。

### N-100 fruit-stack 双人同屏六键 🔧（新；最重）

- 朵朵/星星 ◀▶放下 `.fs-key` **522–566 整排线下**，crop 0 滚不到；双画布 212–409 在屏。键排 sticky/fixed 钉进 412，画布可让高。人机对战/无尽果盆同壳的顺手复测。

### N-99 monster-crisis 双人合作 🔧（新）

- 双摇杆 **370–462**、双甩弹 **379–453** 切底约 50px。摇杆/甩弹整体抬进 412 或画布让高；技能三卡（262–400）在屏勿动；闯关（r14 绿）勿动。

### N-98 ice-fire-forest root×深关双人 pad 🔧（新；≠ C-8 双栏）

- 冰火之心 188：pad「向下」行 **393–437** 切 25px、画布 **276–515 出屏 103**（L1 画布也出 59）。C-8 的 `max-height:500px` 双栏网格已在，缺的是：root 工具行算进高度预算 + `.iff-board` 画布显示高钳（钳显示，勿动关卡数据）。

### C-5 mole-pop 地鼠洞 🔧（r4 老账重挂，根因分支从未合）

- L1 九洞 **250–894**（6/9 线下），root×月夜 167 **294–938**；390×844 绿。`.mp-hole{aspect-ratio:1}` 由 3 列宽驱动、无矮屏媒体：矮横屏按「余高 ÷ 3 行」反推 `.mp-board` 宽或洞径。别翻旧分支 `casual-duo-fit-r5-b-4683` 整支合（会倒删 N-75+），只取思路。

### N-29 族收尾 🔧（bubble-aim 已绿勿动）

- sling-birds：重来/选关 **368–416** 只差 4px，垫 1 档即可结案。
- candy-swing：画布 **166–660 出屏 248**、crop 300——`.cs-canvas` 补显示高钳（如 `max-height:calc(100dvh - 壳)`），勿改关卡物理。

### r17 结转（原文有效，勿换号）

- **N-94** duo-vs-star 双人选人「开打 ▶」top **451**：照 N-88 钉进 412；芯片抬 44。
- **N-95** xiangqi 自由对战设置屏「开始下棋」**713**、overflow hidden 滚不到：收进 412 或独立卷轴 + CTA 钉底。
- **N-96** bomb-buddies 双人棋盘画布底 **475**：钳高；三键已在屏勿动。
- **N-90** tap-tiles 无矮屏高度媒体：关内提示/操作进 412；勿改连击判定。
- **N-91** fruit-catch 画布钳高：钳 `.frc-canvas` 显示高；`MIN_CANVAS_DISPLAY_PX` 勿降到篮口重叠。
- **N-60/61/62** 贴线切 ~28px、**N-12** pool-stars、**N-10** weiqi-garden、**N-3** star-estate、**N-55** snow 对战十二键、**C-8** balloon-pop `.blp-sky` 显示高（**禁止改 `SKY_H=420`**）——r17 playbook 原文执行。

N-87/88/86/75–85：✅ 只许回归。`casualFit.r10b` 已绿勿回退。

---

## 完成定义

1. **N-101 修复且 `npm test` 全绿**（1193 文件 / 19489 用例，只增不减）。
2. N-98/99/100 与 r17 结转 N-90/91/94…97 或书面降级；C-5 / N-29 尾款做或说明。
3. 每条 915 留 top/bottom 数字；双人款要贴「键排 bottom ≤ 412」的实测值。
