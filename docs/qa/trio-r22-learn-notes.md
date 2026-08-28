# 三人组第 22 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `206d0522`（含 r19 收口笔记、摘合 r18 B 的 N-12/N-10/N-3/N-55/N-81、C-8 显示钳高、N-90 判定线、PR #83 UX 文档）。
> 前文必读：主干 `trio-r18-*` / `trio-r19-*`，以及 **PR #87 在途** `trio-r21-learn-notes.md` + `trio-r21-playbook.md`（N-117…N-124）。
> 本轮 `src/**` 零改动。主档三视口：**390×844 / 915×412 / 1024×768**。工装不进库。
> **编号**：r21 已占 **N-117…N-124**，且明示下一空号 **N-125**。本工位从 **N-125** 续编。N-108…N-116 **不要当空号**（见 §2）。

## 一、抽验方式

- 读 `docs/qa/trio-r21-learn-notes.md` / `trio-r21-playbook.md`（PR #87，未合主干）全文；对照主干 r18/r19 终版语义。
- `git log 6982da7e..206d0522` 对账：r19 之后 **已有 src 修复合入**，r21 进场时「全是 docs」的前提作废。
- 静态全量扫 `src/games/*` 的 `max-height:500` / 520–820 中间档 / `pointer:coarse`。
- 源码级复核 r19 点名的 canvas 内菜单盲区（fruit-slice / rainbow-run / sprout-defense / ocean-munch）。
- 读 `.cursor/skills/1.3-visual/{frontend-design,canvas-design}`：触控优先、唯一 CTA 第一屏、改显示不改世界。
- 本拍未再开无头 Chrome（环境无 `node_modules`）；数字沿用 r18/r19 实测，新伤给到选择器 + 公式，A/B 进场补 `getBoundingClientRect`。

## 二、撞号纪律（读 r21 时必先看这一节）

r21 在 **未合入** 的自有 r19/r20 草稿上，把 N-103…N-116 整段作废并改号到 N-117+。**主干已经合入另一份 r19**，语义不同：

| 号 | 主干终版（`0cb201b3` r19） | r21 草稿里曾怎么用 | 本轮口径 |
| --- | --- | --- | --- |
| N-108 | **puzzle-tiles 无尽画廊** 拼块滚不到 | 曾与 N-100 进场卷顶同义 | **以主干为准，仍开 🔧 B** |
| N-109 | root 密码门 CTA 初见折线下（已书面降级） | 曾与 N-101 等同义 | **降级在册，勿重开** |
| N-110…N-116 | 主干未占用 | r21 声明永久跳过 | **仍跳过，不新开** |
| N-117…N-124 | 主干文档尚未收录（只在 PR #87） | r21 正式占用 | **视为已占，勿改号、勿重开同义号** |
| N-100…N-107 | 见 r18 附录 + r21 §1 | r20 曾撞号并回主干 | 以主干表为准 |

合并者：PR #87 与本文件可并存。**禁止**按 r21 §2 把主干 N-108 当空号另写一款游戏。

## 三、主干对账（相对 r21 进场点 `6982da7e`）

| 项 | SHA | 结论 |
| --- | --- | --- |
| N-105 字号 | `76d20324` | `.cc-info` / `.mj-goal` 已回 **16px**，麻将矮档改 line-clamp、去掉压正文的 nowrap。**先回归 vitest**，勿出第四份 14→16 hunk（PR #84/#88 仍可能夹带）。 |
| N-12 / N-10 / N-3 / N-55 / N-81 | `76d20324` | 台球 / 围棋 / 地产 / 雪战对战垫 / 无尽花园垫 **源码已合** → 915+390 **回归数字**即可，禁止第二套垫。 |
| C-8 / N-90 | `0f6c0820` | 气球只钳 `.blp-sky` 显示高（`SKY_H=420` 未动）；tap-tiles 判定线。回归。 |
| N-118 列数 | `level99.ts` 已有 `mapLayoutWidth()` 并接到初渲 + resize | **半完成**：列数勿再改；余下是 L642 `calc(100dvh - 136px)` 过时常数（仍归 N-118，不换号）。 |
| N-117 页签 | L557 `.l99-tabs{flex-wrap:wrap}` **仍在** | 仍开 🔧 A |
| N-100 | 17 款验收面仍有效；4e78（PR #84）在途有「可见则不误滚」 | 主干未合 4e78；A 先看 PR #84 再决定是回归还是补锚定。 |
| N-48 收藏 overlay | `collection.ts` 已有 `hashchange` → close | ✅ 勿再做 |
| PR #84 A / #88 B | 未合 | 撞车取先合；N-105 hunk 后到者必须 drop |

**已合结案、禁止重做**：N-47/63/68/73/77、C-6、N-37、N-75…N-91、N-40 赛道 sticky、N-32、`OA_SHORT_PANE_H=200`、`casualFit.r10b`、N-60/61/62（N-89 收壳后贴线族）。

**书面降级仍有效（r19 第六节）**：N-10 残余、N-109、brick-break L1 crop、mine-garden 末排、lianliankan 密格、red-blue-race 让分芯片。

## 四、r21 号段（N-117…N-124）状态摘要

未合入主干文档，但编号已印出，A/B 仍按 r21 playbook 做或书面降级：

| # | 摘要 | 本拍源码复核 |
| --- | --- | --- |
| N-117 | 页签 emoji 徽章收纳；禁 `overflow-x:auto` | wrap 仍在 |
| N-118 | wrap 136px 常数 + 列数 | 列数已接 `mapLayoutWidth`；常数未改 |
| N-119 | 地图观感 CSS | 未做 |
| N-120 | `.l99-view` `touch-action:pan-y` | 仅有 `overscroll-behavior:contain` |
| N-121 | fruit-catch / balloon-pop / duo-rush 模式键 ≥44 | 未本拍重测 CSS 模式键；勿与正文 14px 混为一谈 |
| N-122 | duo-rush 390 CTA | 先量后修 |
| N-123 | 首页 hero 1024 留白 | 未测 |
| N-124 | 33 款「有 500 无中间档」平板空洞 | 名单仍成立；**本轮扩面见 N-127** |

4e78 把拼音挑拣车厢称作 N-94：主干 N-94 = duo-vs-star 选人「开打」。车厢伤 **不新开号**——`pickAll.ts` 已有 `@media (max-height:500px)` 把 `min-height:380` 降为 0（N-35）。合并 4e78 时丢掉错误 N-94 标签即可。

## 五、本轮新抽验（N-125 起）

### N-125 🔧 B · fruit-slice 矮横屏菜单卡高 < 44

`src/games/fruit-slice/index.ts` `drawMenu()`：

```text
cardH = min(88, (h * 0.66) / 4 - 12)
```

l99 舞台 `.l99-host` 915 可视高约 **334**（r18/r19 裁切链）时：`cardH ≈ 43.1`，四张模式卡（经典/禅宗/街机/暴风）**低于 44 触区线**。卡底约 `0.92h`，裁切不是主病，**热区偏小**才是。390 竖屏 `h` 更大，`cardH` 易顶到 88，竖屏多半绿——验收以 915 为准。

修法：`cardH` 设下限 44，或减少竖向 gap/标题占位；**勿改** `logic.ts` 回合表 / seed / 炸弹判定。canvas-design：只改绘制矩形，不改世界。

### N-126 🔧 B · canvas 内「返回」热区未走 touchArea 配方

r19 观察项「DOM 量不到内部热区」本轮用源码钉死两款漏网（rainbow-run / ocean-munch 已有 `touch.ts` 的 `touchArea` 外扩到 44）：

| 款 | 位置 | 绘制矩形 |
| --- | --- | --- |
| fruit-slice | `drawThemes` / `drawMap` | `btnBack = { w:70, h:32 }` |
| sprout-defense | `drawMap` | `{ w:62, h:30 }` |
| sprout-defense | 局内工具栏下 | `{ w:62, h:28 }` |

`inRect` 按绘制矩形命中，没有外扩。frontend-design：返回是唯一退出路径，必须按得住。

修法：把 rainbow-run `touchArea` 拷到这两款（画仍可小、点要 44），或把绘制 h 抬到 44 并给标题让位。局内 28px 那颗与提示条同行，抬高时勿挡格子点击。

### N-127 🔧 A+B · N-124 扩面：20 款 **零** 高度媒体

r21 N-124 扫的是「有 `max-height:500`、无 520–900 中间档」的 33 款。本轮补扫：**既没有 500 档、也没有任何 520–820 中间档** 的游戏目录（20 款）：

brick-break、candy-swing、clock-house、find-diff、fruit-slice、fruit-stack、garden-guard、gold-hook、landlord-cards、match-stars、mole-pop、monster-crisis、ocean-munch、puzzle-tiles、rainbow-run、red-blue-race、red-blue-tug、sky-squad、sling-birds、sprout-defense。

其中多款已有专号（N-107 fruit-stack、N-108 puzzle-tiles、N-106 monster-crisis、C-5 mole-pop、N-29 candy-swing/sling-birds、N-104 地主热区）。**本号只派未专号的平板第三档抽验**，避免一款两号：

- **A**：clock-house、find-diff、match-stars —— 1024×768 量工具行/选项是否桌面密排、触区 <44。
- **B**：garden-guard、gold-hook、sky-squad —— 同视口；canvas 款量绘制按钮或 HUD 一行是否溢出。

救济仍用 r21 军规：`@media (max-height:820px) and (pointer:coarse)`，**不动**已有 500 档。已有专号的款只在原号下修，不在本号重复派单。

### N-128 🔧 A · `.l99-host` 溢出静态守门（系统病第 5 次点名）

N-75 → N-98 → N-101 → N-108 都是 `.l99-host{overflow:hidden}` + 内容高 > clientHeight 且中间层 `overflow:visible`。N-125 的舞台高 334 也来自这里。

建议在 `level99` 侧加一条静态/轻量测试：**直系内容 `scrollHeight > clientHeight` 时，必须存在 `overflow:auto` 后代或 `position:fixed` 底栏**。比逐游戏垫省力。不改玩法，只加测试 + 必要时给 `.l99-host` 一条文档化契约。

## 六、干净 / 观察（不开号）

- rainbow-run / ocean-munch：已有 `MIN_HIT_PX=44` 的 `touchArea`，本轮不新开；N-126 修完后可把这两款当回归对照。
- `pickAll.ts` 380 下限已有 500 档解除，不把 4e78 的错误 N-94 写成 N-125。
- fruit-slice 十二果园选章：3 列×4 行在 h=334 时 `ch≈54.5`（≥44），主病在菜单态而非选园态。
- 全 canvas 菜单的 **像素级** 915 实测仍缺工装；N-125/126 给出公式后，B 交卷必须补 rect 数字。

## 七、skills 一句话

- `frontend-design`：N-125/126 是「唯一动作热区不够」的 canvas 变体；CSS `min-height:44` 管不到画布里的 `inRect`。
- `canvas-design`：C-8 已证明「钳显示、不改 `SKY_H`」；N-125 同样只改 `cardH` 绘制，不动水果物理。

## 八、交卷自检

- 只新增 `trio-r22-learn-notes.md` 与 `trio-r22-playbook.md`；不覆盖 r14…r21 任何原文。
- 未改 `src/**`。新伤 **N-125…N-128**；下一空号 **N-129**。
- 编号 grep：主干最大已印号 N-109；r21 占用到 N-124；本轮接 N-125。
