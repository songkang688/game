# 三人组第 23 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r23-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 前文：PR #90 r22（N-125…N-128）、PR #87 r21（N-117…N-124）、主干 r19。
> **本轮新伤 N-129…N-131**。下一空号 **N-132**。
> 撞车取主干先合版。学习员零改 `src/**`。

## 〇、进场

1. `git fetch origin game-1.3` 后 rebase。SHA 若已快进，以新主干为准，本表号义不变。
2. **N-105**：主干已 16px。PR #84/#88 与任何在途分支 **drop** 重复 14→16。不许第四版、不许砍测试。
3. **N-108** = 拼图无尽（主干），不是 r21 草稿里的进场卷顶。
4. **N-121/122/124**：先看 `origin/cursor/trio-r21-tester-b-1cd5`（`2220e869`）。已合或可 rebase 进来则 **只回归**；未合才按 r21 原单修。
5. N-12/10/3/55/81/C-8（禁改 `SKY_H`）/N-90：主干已合，只回归。
6. N-118：禁止再改 `mapLayoutWidth`；只动 L642 `136px`。

## 红线

- 不改存档 key / `meta.id` / 题库 / seed / 胜负 / 塔数值 / 水果回合表。
- 三视口 + reach 判定。canvas 量绘制矩形 / `inRect`。
- `.l99-tabs` 禁止 `overflow-x:auto`。
- root 走 UI 门 `kangkang`。测试只增不减。禁 force。

## 测试步骤

`npm run build && npx vite preview --port 4173`；独立 context。canvas 交卷写源码矩形 w×h。

---

## A / B 独占

| 工位 | 独占 | 本轮优先 |
| --- | --- | --- |
| **A** | `src/ui/**`、level99/quiz99、学习款 | **N-131（新）**、N-130 巡检测试、N-117/118 余下/N-120/N-100/N-99/N-97/N-128、N-127 A |
| **B** | 其余 `src/games/**` | **N-129（新）**、N-126/N-125、N-130 漏网字号、N-108 及 r19 B 未修项；N-121 族先对账在途 |

`src/engine/**`、`src/art/kit/**` 谁都不动（拷 `touchArea` 进各游戏文件即可，不要新抽公共模块除非已有先例文件）。

---

## A 面

### P0

| # | 改什么 | 验收 |
| --- | --- | --- |
| N-117 | 页签徽章收纳；锁标独立 span；不用 overflow-x:auto | 390 tabs 单行 ≤52；915 word-garden `.l99-continue` top≥0 |
| N-100 | 锚定 17 款；先看 PR #84 | 17 款 continue top≥0 |
| N-105 回归 | 只跑 vitest | 全绿 |

### P1

| # | 改什么 | 验收 |
| --- | --- | --- |
| **N-131** | `quiz99.ts` 补 `max-height:820px and (pointer:coarse)` 中间档；先量 1024 `.qz-choice` | 抽 clock-house / math-farm 宿主：选项与 CTA 在 768 高内或可滚；L1 与题库不动 |
| **N-130** | 新增静态巡检：window1 **以外** 的 `*-msg`/`*-tip`/`*-hint` 正文 ≥16 或 `--mt-body` | 新测试绿；可先列 brick-break / balloon-pop / fruit-catch；duo-rush hint 13.5 抬到 ≥14 控件或改成正文 16 |
| N-118 余下 | 只改 wrap 136px | 915 地图触摸到底；不动列数 |
| N-120 | `touch-action:pan-y` | 不整页橡皮筋 |
| N-99 / N-97 | 数独盘 / math-farm 深关 | 同 r19 数字 |

### P2

N-128 `.l99-host` 溢出守门测试；N-127 A：clock-house / find-diff / match-stars 1024；余力 N-119/N-123/N-109。

---

## B 面

### P0 新

### N-129 garden-guard 🔧

- `btnBack` 30→热区 ≥44（两处）；升级/出售 36→≥44。
- 对照 `rainbow-run/touch.ts`。915+390 地图能点回；选塔面板不挡格子。
- **不要**再给 fruit-slice/sprout 开新号（那是 N-126）。

### N-126 / N-125（r22，主干未修）

- fruit-slice `cardH` 下限 44；`btnBack` 32。
- sprout-defense 返回 30/28。
- 勿改 logic 回合/炸弹。

### N-130 漏网字号（A 的测试会钉死）

`.brk-msg` / `.blp-msg` / `.frc-msg` 14→16（或变量）；高度用 padding/max-height 收。**不要**做成 N-105 第四版（那两文件已 16）。

### 仍开顺位（做或书面降级）

N-108 拼图无尽 → N-101+N-94 → N-107 → N-98 → N-95 → N-96 → N-102/103/106 → N-104 → C-5 → N-29。  
N-121/122/124：先 rebase `2220e869`。  
N-127 B：garden-guard 平板档可与 N-129 **同 PR**，但中间档 CSS 与热区抬高是两件事。

### 只回归

N-12/10/3/55/81/C-8/N-90/N-87/88。

---

## 完成定义

1. 每单三视口数字 + 小测试只增不减。
2. vitest 全绿（N-105 底线）。
3. 交卷 `docs/qa/trio-r23-tester-A.md` / `trio-r23-tester-B.md`。
4. 新伤从 **N-132** 起。
