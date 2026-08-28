# 三人组第 22 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r22-learn-notes.md`。基线 `origin/game-1.3` @ `206d0522`。
> 配套前文：主干 `trio-r19-playbook.md`；在途 PR #87 `trio-r21-playbook.md`（N-117…N-124 已占）。
> **新伤本轮：N-125…N-128**。下一空号 **N-129**。
> 撞车取先合进 `game-1.3` 的版本。学习员未改 `src/**`。

## 〇、进场必读（防第四份 N-105、防把 N-108 写飞）

1. **N-105**：主干 `76d20324` 已把 combo-clash / mahjong-bloom 正文拉回 16px。交卷前 `npx vitest run` 确认 `mobileText.test.ts` / `window1-mobile-text.test.ts`。PR #84 / #88 若仍带 14→16 hunk，**drop**，禁止第四版。不许砍守门测试。
2. **号段**：主干 N-108 = puzzle-tiles 无尽画廊（仍开）；N-109 = root 门（已降级）。r21 草稿把 N-108…116 作废是针对**未合入的另一份 r19/r20**，**不要**按那张表清空主干 N-108。
3. **已合、只回归**：N-12 / N-10 / N-3 / N-55 / N-81 / C-8（禁改 `SKY_H`）/ N-90 / N-60…62 / N-89 / N-75…N-88 / N-48。
4. **N-118 半完成**：`mapLayoutWidth()` 已接线。只许改 L642 `calc(100dvh - 136px)`，**禁止再改列数函数**。
5. 在途 PR #84（A）/ #88（B）：rebase 主干后再动手；与本表重叠项写回归数字。

## 红线

- 不改存档 key / `meta.id` / 题库 / seed / 胜负。气球不改 `SKY_H=420`。fruit-slice 不改回合表。
- 三视口：390×844 能划到底；915×412 关卡地图与按钮不得裁切且热区 ≥44；1024×768 抽平板中间档。
- root 走 UI 门：首页 🔑 → `kangkang` → 打开。不种 storage。
- 初见出屏必须补 `scrollIntoView` 后的 reach。密格盘内豁免 44，盘外按钮不豁免。canvas 热区按 `inRect` 矩形量，不是 DOM。
- `window6.r3.qa.test.ts` L132：`.l99-tabs` 不许 `overflow-x:auto`（N-117 用徽章收纳）。
- 测试只增不减。禁 force。rebase 后 `npm test` && `npm run build`。

## 测试步骤

- `npm run build && npx vite preview --port 4173`；puppeteer-core + Chrome；每案独立 context。
- 进 `#/game/<id>`；闯关点 `.l99-node-cur`。
- 量 canvas 菜单：在页面脚本里读游戏内部困难，可退化为「点目标坐标是否进入下一态」+ 截图；交卷仍要写 **绘制矩形 w×h**（源码行号）。

---

## A / B 独占

| 工位 | 独占 | 本轮号 |
| --- | --- | --- |
| **A** | `src/ui/**`、`level99*`、`quiz99*`、学习款（word-garden / pinyin-train / clock-house / find-diff / math-farm / shape-kingdom / sudoku-petal / match-stars） | N-117、N-118 余下、N-120、N-100（17 款）、N-99、N-97、N-128、N-127 的 A 三款；余力 N-119 / N-123 / N-109 |
| **B** | 其余 `src/games/**` | **N-125 / N-126（新）**、N-101/107/108、N-94+95+96、N-98、N-102/103/106、N-104、N-121/122、N-124 抽验、N-127 的 B 三款、C-5、N-29 尾款 |

公共 `src/engine/**`、`src/art/kit/**` 谁都不动。

---

## A 面

### P0

| # | 改什么 | 验收 |
| --- | --- | --- |
| N-117 | `.l99-tabs` 非当前章只显 emoji（约 44×44）；锁标独立 `span.l99-tab-lockmark`；**不用** overflow-x:auto | 390：8 章 tabs 单行高 ≤52；915：word-garden 进场 `.l99-continue` top ≥0；`rootUnlock.test.ts` 绿 |
| N-100 | 进场锚定（17 款名单见 r19 笔记第四节）。若 PR #84 已合「可见则不误滚」，写回归数字 | 17 款 915 `.l99-continue` top ≥0；root×bowling 直达 27~71 不回退 |
| N-105 回归 | 只跑 vitest，不改字号 | 全绿；若仍红只修实现、不砍测试 |

### P1

| # | 改什么 | 验收 |
| --- | --- | --- |
| N-118 余下 | 只改 `.l99-wrap{max-height:calc(100dvh - 136px)}` 为实际壳高或交给 flex | 915 地图能触摸滚到末行；三视口无双滚动条；**不动** `mapLayoutWidth` |
| N-120 | `.l99-view` 补 `touch-action:pan-y`（overscroll 已有，勿重复） | 915 拖地图不整页橡皮筋 |
| N-99 | sudoku-petal 盘底两行滚不到（r18：`.sp-wrap` hidden 446/178） | 915 81 格可见或滚得到；题库零触碰 |
| N-97 | math-farm root×深关选项 top 416 | 走 UI 开 root；L1 勿动 |
| **N-128** | `.l99-host`：内容溢出时必须可滚或 fixed 底栏——加测试（可顺手修契约） | 新测试绿；不回退 N-75 麻将手牌 |

### P2 / 余力

- **N-127 A**：clock-house / find-diff / match-stars @ 1024×768，缺则加 `max-height:820px and (pointer:coarse)`。
- N-119 地图观感 CSS（跟 N-117 同 PR 可顺手）。
- N-123 首页 hero 平板留白。
- N-109 降级：有余力再收 `.rootgate` 矮横屏 padding。

---

## B 面

### P0（新）

### N-125 fruit-slice 菜单卡 🔧

- `drawMenu()` 的 `cardH` 在舞台高 ≈334 时 ≈43px。下限抬到 **44**，或收标题/`h*0.26` 起点。
- 915：四张模式卡绘制 h≥44 且底边 ≤ 画布高；390 不回退。
- 勿改 `logic.ts` / 炸弹 / 星级。

### N-126 canvas 返回热区 🔧

- fruit-slice：`btnBack` h=32 → 绘制或 `touchArea` ≥44（两处：选园 + 选回合）。
- sprout-defense：地图 30px、局内 28px 同样处理。对照 `src/games/rainbow-run/touch.ts`。
- 局内钮抬高不得挡住种植格。

### 仍开（源码未合或未回归）

按顺位，做或书面降级（病灶+数字）：

1. **N-108** puzzle-tiles 无尽画廊 2/3 排滚不到（r19 数字 491~918）；闯关 L1 勿动；热区 `.pz-back` 等抬 44。
2. **N-101** duo-vs-star 赛中 14 键线下 + **N-94** 选人开打（≠ N-88）。
3. **N-107** fruit-stack 双人六键 top 522。
4. **N-98** hue-hand 三键 sticky 被 `.l99-host` 吃掉 → fixed。
5. **N-95** xiangqi 自由对战设置屏（残局学堂已绿）。
6. **N-96** bomb-buddies 画布底 475。
7. **N-102 / N-103 / N-106** bumper / 冰火（含 root×188）/ 怪物摇杆。改显示不改世界。
8. **N-104** `.ld-back` 33→44。
9. **N-121 / N-122** 模式键 44；duo-rush 390 先量。
10. **N-124** 抽 word-garden 不在 B；B 抽 merge-2048 / shoot-range @ 1024×768。
11. **N-127 B**：garden-guard / gold-hook / sky-squad 平板中间档。
12. C-5 mole-pop 洞径；N-29 sling-birds 差 4px + candy-swing 画布钳高。

### 只回归、禁止再垫

N-12 / N-10 / N-3 / N-55 / N-81 / C-8 / N-90 / N-87 / N-88。

---

## 完成定义

1. 每单：三视口 top/bottom（canvas 则绘制矩形）+ reach；小测试只增不减。
2. 水位：N-105 回归后全库 vitest 全绿为底线（进场参考曾为 1193 files / 19489 tests，以 rebase 后实测为准）。
3. 交卷报告新文件 `docs/qa/trio-r22-tester-A.md` / `trio-r22-tester-B.md`，勿覆盖他人。
4. 新伤从 **N-129** 起编。
