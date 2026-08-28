# 三人组第 23 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `206d0522`（与 r22 交卷时相同；本拍 `git fetch` 主干无新 SHA）。
> 前文：**PR #90** `trio-r22-*`（N-125…N-128）、**PR #87** `trio-r21-*`（N-117…N-124）、主干 `trio-r18-*` / `trio-r19-*`。
> 本轮 `src/**` 零改动。三视口 390×844 / 915×412 / 1024×768。
> **编号**：r22 明示下一空号 **N-129**。撞车取 **主干先合版**；未合 PR 上的号视为已占，不改义、不重开。

## 一、抽验方式

- 读 PR #90 r22 全文 + PR #87 r21 全文 + 主干 r19 终版语义表。
- 对账在途：`origin/cursor/trio-r21-tester-b-1cd5` @ `2220e869`（N-121/122/124 源码，**未合主干**）；PR #84 A、#88 B。
- 在 `origin/game-1.3` 上 grep canvas `btnBack` / `h: 28|30|32|36` 与 `touchArea` 引用面。
- skills：触控 44、改显示不改世界、唯一 CTA 可点。本拍未跑无头浏览器；新伤给到文件+行号+矩形，A/B 补 rect 数字。

## 二、号段总表（先合版口径）

| 号段 | 权威 | 本轮 |
| --- | --- | --- |
| N-100…N-107 | 主干 r18 | 勿改义 |
| N-108 | 主干 r19 = **puzzle-tiles 无尽** | 仍开 🔧 B |
| N-109 | 主干 r19 root 门，已降级 | 勿重开 |
| N-110…N-116 | 跳过 | 不新开 |
| N-117…N-124 | PR #87 占用；#87 未合主干 | **已占** |
| N-125…N-128 | PR #90 占用 | **已占** |
| **N-129 起** | 本工位 | 本轮新伤 |

r21 草稿曾把 N-108 写成别义：**作废，以主干为准**（r22 §2 继续有效）。

## 三、对账（相对 r22）

| 项 | 状态 |
| --- | --- |
| 主干 SHA | 仍 `206d0522`，无新合入 |
| N-105 字号 | 主干已 16px；禁止第四份 hunk |
| N-12/10/3/55/81/C-8/N-90 | 主干已合，只回归 |
| N-117 wrap / N-118 136px 常数 | 主干未动（`level99.ts` L557 / L642）；`mapLayoutWidth` 已在 |
| N-121/122/124 | **在途** `2220e869` 已改 fruit-catch/balloon-pop/duo-rush 模式键与 merge-2048/shoot-range 820 档。合入前 B **勿重做**；未合则仍按 r21 修 |
| N-125/126 | 主干 fruit-slice `cardH` 公式与 `btnBack h:32`、sprout-defense 28/30 **仍在** |
| N-48 | 主干 `hashchange` 已在 |

## 四、本轮新抽验（N-129 起）

### N-129 🔧 B · garden-guard canvas 热区（N-126 漏网第三款）

r22 N-126 只点了 fruit-slice / sprout-defense。`origin/game-1.3` 同病第三款：

| 位置 | 矩形 | 文件 |
| --- | --- | --- |
| 地图 / 选关 `btnBack` | **62×30**（两处） | `garden-guard/index.ts` ~1565、~1647 |
| 塔「升级 / 出售」 | **92×36** | 同文件 ~2199–2200 |

全库仅 `rainbow-run/touch.ts` 与 `ocean-munch/touch.ts` 有 `touchArea`（外扩到 44）。garden-guard `inRect` 直接吃绘制矩形。

修法：拷 `touchArea`（或抬绘制 h≥44）。升级/出售在 HUD 下沿，抬高时勿挡住塔格点击。勿改塔伤/花费/波次表。

**并号纪律**：不要新开第四个「canvas 返回」号；本号只补 r22 漏点的这一款。fruit-slice/sprout 仍走 N-126。

### N-130 🔧 A（测试）+ B（漏网款）· 正文 16px 巡检扩出 window1

`window1-mobile-text.test.ts` **只扫 12 款**。window1 外仍有 `*-msg` 写死 14px（正文档选择器）：

- `brick-break` `.brk-msg` 14px
- `balloon-pop` `.blp-msg` 14px（C-8 显示钳已合，字号未动）
- `fruit-catch` `.frc-msg` 14px

duo-rush `.dr-hint` / `.dr-ghostline` **13.5px**（提示行，控件下限是 14）。

这不是 N-105 重开（N-105 已修 combo/麻将且禁止第四版）。本号 = **把同一条军规扩出窗口 1**。

修法：A 加一份「`*-msg` / `*-tip` / `*-hint` ≥16（或 `--mt-body`）」的静态巡检（可先白名单 window1 已绿的 12 款）；B 只改漏网 CSS 字号，高度紧就收 padding，**不许砍**现有 mobileText 守门。

### N-131 🔧 A · quiz99 壳无平板中间档

N-124/N-127 扫的是 **游戏目录**。`src/games/quiz99.ts` 只有 `@media (max-height: 500px)`（prompt 图 max-height 64）。1024×768 不命中 500，clock-house / math-farm / shape 等 **quiz 宿主**在平板上仍可能桌面密排。

与 N-97（math-farm 选项 416）不撞号：本号是 **quiz 壳中间档**，先量 1024 的 `.qz-choice` / 插图，缺则 `@media (max-height:820px) and (pointer:coarse)`。题库零触碰。

## 五、r21/r22 号只派、不换号

A：N-117、N-118 余下（只许 136px 常数）、N-120、N-100×17、N-99、N-97、N-128、N-127 A 三款、N-123/N-119 余力。  
B：N-125、N-126、N-108、N-101/94/107/98/95/96/102/103/106/104、C-5、N-29；N-121/122/124 先看 `2220e869`。

## 六、skills / 纪律

- canvas 热区：CSS `min-height:44` 管不到 `inRect`。N-126+N-129 同一配方。
- 正文 16px：N-105 修了窗口 1 的两个选择器，N-130 是漏网面，不是第二套 N-105。
- 本轮只交本文 + `trio-r23-playbook.md`。下一空号 **N-132**。
