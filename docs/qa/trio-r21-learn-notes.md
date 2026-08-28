# 三人组第 21 轮 · 学习笔记（学习员 862b，仅增量）

> 基线：`origin/game-1.3` @ `6982da7e`（撞号两让版 r18 合并后）。本轮 `src/**` 零改动。
> 前文：主干版 `trio-r18-learn-notes.md`（含附录一/二）、本工位在途的 `trio-r19/r20-*.md`（编号见 §2 作废映射）。
> 结论先行：**主干号已占到 N-107；本工位 r19（N-103…107）与 r20（N-108…116）两个号段整体作废**，
> 内容仍有效，按 §2 映射迁到主干空号 **N-117 起**。N-108…N-116 整段跳过永不再用（在途文档已印出，避免双义）。

## 一、主干 N-100…N-107 终版语义（本轮进场核对，以 `6982da7e` 为准）

| 主干号 | 语义 | 状态 |
| --- | --- | --- |
| N-100 | l99 进场 `.l99-view` 被 scrollIntoView 卷顶，「开始冒险/工具行」出视口上方 | 在途部分修（见 §3） |
| N-101 | duo-vs-star 赛中 14 虚拟键全线下 | 待修 🔧A/B |
| N-102 | bumper-cars 915 画布 140×140 + 芯片 34/32px | 待修 🔧B |
| N-103 | ice-fire-forest 画布底切（L1 59px、root×188 103px，root 工具行没进高度预算） | 待修 🔧B |
| N-104 | landlord-cards 回选关 h=33（对战开局+出牌阶段两态） | 待修 🔧B |
| N-105 | **主干红灯**：PR #78 两处 14px 破 mobileText 守门（1193 files 2 红 / 19489 tests 5 红） | ⚠️ 三版在途，见 §3 |
| N-106 | monster-crisis 双人摇杆/甩弹切底 50px | 待修 🔧B |
| N-107 | fruit-stack 双人六键整排线下（top 522 > 视口 412） | 待修 🔧B |

## 二、本工位旧号段作废映射（读 r19/r20 文档必备）

r19/r20 是在途未合文档，其中 N 号与主干撞义/撞号，**一律以本表为准**：

| 旧号（作废） | 内容 | 去向 |
| --- | --- | --- |
| r19 N-103 / r20 无 | 地图章节页签 wrap 堆高吃地图高度 | 改号 **N-117**（仍待修，证据见 §4.1） |
| r19 N-104 | 915 地图密度 + `.l99-wrap` 136px 过时常数 | 改号 **N-118** |
| r19 N-105 | 地图触摸滚动口径（touch-action/overscroll） | 改号 **N-120**（竖屏 auto 兜底部分已被在途 4e78 覆盖） |
| r19 N-106 | 地图观感升级（章节色/三星金边/选中态） | 改号 **N-119** |
| r19 N-107 | mapColumns 取视口宽而非容器宽 | **降级不开号**：另一学习线已核对过（`734c2f51`「撤回 U-3，mapColumns 已有」），列为 N-118 修密度时的顺手项 |
| r20 N-108…N-113 | 进场卷顶 / dvs 赛中键 / bumper / 冰火 / 回选关 / 红灯 | 与主干 **N-100…N-105 逐一同义，全部归并**，不另立 |
| r20 N-114 | 跨游戏模式键 <44 通病（fruit-catch 37 / balloon-pop 40 / duo-rush 43） | 改号 **N-121** |
| r20 N-115 | duo-rush 390 竖屏 CTA 待量 | 改号 **N-122** |
| r20 N-116 | 首页 hero 平板横向留白 | 改号 **N-123** |

## 三、在途修复对账（本轮 fetch 所见，未合主干，防重做/防冲突）

1. **tester A `cursor/trio-r18-tester-a-4e78`**（`3d579c22` + `6f971780` + `c2a21b4c`）：
   - 已实现「当前关整格可见时不再 scrollIntoView」＝ **N-100 的部分修复**。残余面：页签折多行、当前关在首屏外时仍 center 滚 → head 仍卷出顶，须由 N-117 页签收纳收尾。
   - 已实现关内 `.l99-stagebar` 工具收一条横滚行（247→116px）、竖屏 `.l99-stage{overflow-y:auto}` 兜底、矮横屏 l99 钳高只限地图态。注意其注释明言「**地图工具行照旧换行**」——N-117/N-118 与它不冲突。
   - ⚠️ 该分支 `c2a21b4c` 提交语把「pinyin-train 挑拣车厢装不下」称作 **N-94**，与主干 N-94（duo-vs-star 选人屏）撞义——**N-94 出现第三义**。合并者收录时请给车厢伤改新号，勿沿用 N-94。
2. **`cursor/tester2-mobile-fit-9ad5`**（`7a4f732e`）：已修 l99 胜负弹层矮横屏按钮进屏（safe center + 可滚 + z30）。下轮只需回归验收，别再动 `.l99-overlay`。
3. **N-105 红灯已有三个在途版本**（5c27 / 9fc4 / 4e78 各带一份 14px→16px 修复）：合先到者，其余两版必须 drop 该 hunk，**禁止出现第四版**。
4. 另一学习线 `cursor/trio-learn3-ux-playbook-9dad` 维护 `docs/qa/ux-optimization-playbook.md`（第 4/5 轮消歧表，最大用号 N-102 且是主干语义），与本工位无撞号。

## 四、本轮新增量发现

### 4.1 N-117 证据刷新（页签堆高，主干 L557 未动）

`src/games/level99.ts` L557 `.l99-tabs{flex-wrap:wrap}` 仍在；word-garden 8 章 ×915px 折 2 行、拼音/时钟类 root 态折 3 行。这正是 N-100 「tab 折多行的款才触发卷顶」的病根前半。修法沿 r19 方案甲（emoji 徽章收纳，非当前章只显 emoji），**不引入 overflow-x:auto**，避开 `window6.r3.qa.test.ts` L132 守门；配套 `rootUnlock.ts` 锁标独立 `<span class="l99-tab-lockmark">`，防 `stripLockMark` 拍平新结构。

### 4.2 N-124（新开号）：平板断点空洞——33 款 l99 游戏只有 500 档救济

本轮静态全量扫描（有 `max-height:500` 档、无任何 520~900 中间档），共 **33 款**：

block-drop、box-hamster、adventure-king、alien-seek、bubble-pop、color-fun、chess-garden、dark-chess、combo-clash、gomoku、flight-chess、hue-hand、ice-fire-forest、math-farm、lianliankan、hero-cards、hop-pads、memory-cards、junqi-camp、orb-arena、mahjong-bloom、pinyin-train、mine-garden、merge-2048、music-stars、shoot-range、snake-snack、snow-fight、sudoku-petal、word-garden、snake-royale、weiqi-garden、star-estate。

含义：1024×768 平板横屏时高 768 不命中 `max-height:500`、宽 1024 不命中 `max-width:420/480`，这些游戏**以桌面布局跑在触屏上**——鼠标悬停假设、密排小键、无触控加大。这是「平板第三档必测」最系统的空洞，救济一律用 **max-height 中间档**（供参档位：`@media (max-height:820px) and (pointer:coarse)`），与既有 500 档叠加不冲突。

### 4.3 其余小增量

- `.l99-wrap{max-height:calc(100dvh - 136px)}`（L642）在壳收窄后实测冗余 40+px，N-118 收编。
- `mapColumns` 仍取 `viewportWidth()`（L723/901），分屏/带侧栏时列数偏多，N-118 顺手项。
- skills 对照一句话：`frontend-design`「触控优先、密度让位于可点性」正是 N-124 的判据；`canvas-design`「改显示不改世界」继续约束 N-102/N-103/N-124 的画布类修法。

## 五、交卷自检

- 本轮 `src/**` 零改动，仅新增本文与 `trio-r21-playbook.md`。
- 未跑全量 vitest（文档轮；主干红灯状态以 N-105 三版在途对账为准）。
