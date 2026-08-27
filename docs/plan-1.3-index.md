# 一朵一星 1.3 · 提示词目录（`docs/plan-1.3-*`）

> **本目录是 1.3 视觉升级唯一有效的提示词入口。** 1.3 只升级前端视觉（建模 / 布局 / 动效 / Q 版人物），
> 玩法与数值不动。全部工作推分支 **`game-1.2-kk`**（基线 `origin/game-1.2`）；
> `origin/1.2-kk` 是另一摊品牌改名工作，与本目录无关。
>
> 命名照抄 1.2 的成功做法：**一步一档一份文件**，`docs/plan-1.3-step<步号>-<档>-<英文短名>.md`。
> **总步数 29 步**（1 共享基建 + 25 视觉升级 + 3 验收），87 份提示词。
> 游戏分档与 [`plan-1.2-index.md`](./plan-1.2-index.md) 第 2–26 步**完全同一套 id**，方便两版对照。

| 入口 | 文件 | 谁写 |
| --- | --- | --- |
| 主管职责 / 派发规则 / 全量总表 | [`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) | A 档（主管） |
| 多窗口登记（防重派） | [`plan-1.3-tracker.md`](./plan-1.3-tracker.md) | A 档（主管），派发时逐行更新 |
| 视觉宪法（负面清单 / Q 版标准 / 分级口径） | [`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) | A 档（主管） |
| vendored skills 说明 | [`plan-1.3-skills.md`](./plan-1.3-skills.md)（实体在 `.cursor/skills/1.3-visual/`） | A 档（主管） |
| 本目录 | `plan-1.3-index.md` | A 档（主管） |
| 1.2 对照 | [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) · [`plan-1.2-index.md`](./plan-1.2-index.md) | 1.2 各档 |

---

## 一、文件命名规范

```
docs/plan-1.3-step<步号>-<档>-<英文短名>.md
```

- 步号：**1 到 29 的连续整数**，不跳号、不留空隙。档：`A` / `B` / `C` 大写。
- 英文短名：第 2–26 步一律用**游戏施工 id**（第 15 步 C 用 `bumper-cars`，一份文件装两款）；
  第 27–29 步用 `tester` / `learner` / `fixer`。
- 文件第一行标题固定：`# 1.3 第 <N> 步 · <A|B|C> 档 —— <中文主题>`。
- 每份文件必须包含**一段可整段复制的执行提示词**：开头四行逐字照
  [`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) 第二节口令（slug `claude-fable-5-thinking-xhigh` 不带方括号），
  紧跟防套娃段，之后是分支纪律 / 必读文件 / 独占文件 / 素材契约测试 / 回复格式。

## 二、三档提示词分工

| 档 | 负责步号 | 独占文件 | 状态 |
| --- | --- | --- | --- |
| **A 主管** | 总纲 + 第 1 步 | `plan-1.3-supervisor/tracker/index/visual-bible/skills.md`、`plan-1.3-step1-A/B/C-*.md`、`.cursor/skills/1.3-visual/**` | ✅ 已写完 |
| **B 视觉升级（前半）** | **第 2–14 步**（39 款） | `docs/plan-1.3-step2-*.md` … `docs/plan-1.3-step14-*.md` | ⬜ 待写 |
| **C 视觉升级（后半）+ 验收** | **第 15–29 步**（37 款 + 3 轮验收） | `docs/plan-1.3-step15-*.md` … `docs/plan-1.3-step29-*.md` | ⬜ 待写 |

B / C 写每一格时必须包含宪法第十节要求的「深度审美评测 + 极高质量改进方案」交付要求，
并把该游戏的 2D / 2.5D 定级（宪法第五节）写死进提示词。

---

## 三、29 步总表（连续编号，无空隙；id 与 1.2 第 2–26 步逐格相同）

### 阶段一 · 共享视觉基建（第 1 步，A 档已写）

| 步 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- |
| 1 | [共享角色与道具素材包 `src/art/kit/`](./plan-1.3-step1-A-art-kit.md) | [首页 / 关卡壳 / 结算布局动效](./plan-1.3-step1-B-layout-motion.md) | [跑酷跑道 2.5D·3D 套件 `src/art/runner/`](./plan-1.3-step1-C-3d-runner.md) |

### 阶段二 · 76 款视觉升级（第 2–26 步；链接由 B / C 写完后补）

| 步 | A 位 | B 位 | C 位 | 提示词谁写 |
| --- | --- | --- | --- | --- |
| 2 | `orb-arena` | `snake-royale` | `block-drop` | B |
| 3 | `combo-clash` | `mahjong-bloom` | `star-estate` | B |
| 4 | `hero-cards` | `weiqi-garden` | `flight-chess` | B |
| 5 | `merge-2048` | `mine-garden` | `sudoku-petal` | B |
| 6 | `dot-maze` | `fruit-stack` | `pool-stars` | B |
| 7 | `junqi-camp` | `chess-garden` | `dark-chess` | B |
| 8 | `hue-hand` | `hop-pads`（跳台纵深） | `tap-tiles` | B |
| 9 | `gomoku` | `match-stars` | `rainbow-run`（伪 3D 目标款） | B |
| 10 | `ocean-munch` | `xiangqi` | `fight-king` | B |
| 11 | `duo-rush`（伪 3D 目标款） | `duo-arena` | `duo-vs-star` | B |
| 12 | `sling-birds` | `candy-swing` | `gold-hook` | B |
| 13 | `garden-guard` | `sprout-defense` | `monster-crisis` | B |
| 14 | `shoot-range` | `sky-squad` | `tank-battle` | B |
| 15 | `bomb-buddies` | `snow-fight` | `bumper-cars` + `bowling-lane`（唯一两款位；场地 / 球道 2.5D） | C |
| 16 | `ice-fire-forest` | `puff-bros` | `prince-princess` | C |
| 17 | `brave-path` | `adventure-king` | `alien-seek` | C |
| 18 | `brick-break` | `mole-pop` | `box-hamster` | C |
| 19 | `balloon-pop` | `bubble-pop` | `bubble-aim` | C |
| 20 | `fruit-catch` | `fruit-slice` | `snake-snack` | C |
| 21 | `lianliankan` | `puzzle-tiles` | `memory-cards` | C |
| 22 | `landlord-cards` | `fishing-star` | `poop-hero`（俯冲段 2.5D） | C |
| 23 | `red-blue-race`（赛道 2.5D） | `red-blue-tap` | `red-blue-tug` | C |
| 24 | `clock-house` | `math-farm` | `pinyin-train` | C |
| 25 | `word-garden` | `shape-kingdom` | `find-diff` | C |
| 26 | `color-fun` | `music-stars` | `kitty-care` | C |

### 阶段三 · 三轮视觉验收（第 27–29 步；提示词由 C 档写，本表先留链接位）

| 步 | 轮次 | A 测试员 | B 学习优化员 | C 监督修复员 |
| --- | --- | --- | --- | --- |
| 27 | 第 1 轮：宪法负面清单全库扫 + 素材契约盘点 | （C 档写：`plan-1.3-step27-A-tester.md`） | （C 档写：`plan-1.3-step27-B-learner.md`） | （C 档写：`plan-1.3-step27-C-fixer.md`） |
| 28 | 第 2 轮：换样本 + 360px 实机 + reduced-motion | （C 档写：`plan-1.3-step28-A-tester.md`） | （C 档写：`plan-1.3-step28-B-learner.md`） | （C 档写：`plan-1.3-step28-C-fixer.md`） |
| 29 | 第 3 轮：76 款终检 + 文档收口 | （C 档写：`plan-1.3-step29-A-tester.md`） | （C 档写：`plan-1.3-step29-B-learner.md`） | （C 档写：`plan-1.3-step29-C-fixer.md`） |

合计：1 + 25 + 3 = **29 步**，87 格，游戏 **76 款**（第 15 步 C 一格两款）。

---

## 四、派发前必读

1. 先读 [`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md)（职责、窗口规则、闸门、监督清单）。
2. 再读 [`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md)（负面清单是验收第一关）。
3. 看 [`plan-1.3-tracker.md`](./plan-1.3-tracker.md) 确认那一格没人在做，**先登记再派**。
4. 全部工作在分支 `game-1.2-kk`，不 push 到 `game-1.2`、不改 `main`、禁止 force。
5. 执行子代理的模型 slug 一律 `claude-fable-5-thinking-xhigh`（不带方括号）。
6. 步 0（从 `origin/game-1.2` 砍出 `game-1.2-kk`）**已做完**：76 款、674 测试文件 / 14809 用例全绿。
