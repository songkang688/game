# 一朵一星 1.2 · 提示词目录（`docs/plan-1.2-*`）

> **本目录是 1.2 唯一有效的提示词入口。** 旧的 `docs/game-1.2/`（一步一份、步号跳到 57、编号有空隙）**作废**，
> 只作历史参考，不再更新、不再按它派发。以后凡是 1.2 的派发脚本，一律看 `docs/plan-1.2-*` 这一组文件。
>
> 命名照抄 1.1 的成功做法（`docs/plan-1.1-step10-A-fight-king.md`）：**一步一档一份文件**。

| 入口 | 文件 | 谁写 |
| --- | --- | --- |
| 主管职责 / 派发规则 / 全量总表 | [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) | A 档（主管） |
| 多窗口登记（防重派） | [`plan-1.2-tracker.md`](./plan-1.2-tracker.md) | A 档（主管），派发时逐行更新 |
| 本目录 | `plan-1.2-index.md` | A 档（主管） |
| 1.1 对照 · 派发脚本 | `docs/upgrade-prompts/11-game-1.1-dispatch-prompts.md`（`origin/game-1.1`） | 1.1 主管 |
| 1.1 对照 · 单档计划样板 | `docs/plan-1.1-step10-A-fight-king.md` / `-B-duo-vs-star.md` / `-C-shooting.md` | 1.1 各档 |

---

## 一、文件命名规范（三档都必须照做）

```
docs/plan-1.2-step<步号>-<档>-<英文短名>.md
```

- 步号：**1 到 30 的连续整数**，不跳号、不留空隙、不套 33 也不套 38。
- 档：`A` / `B` / `C` 三选一，大写。
- 英文短名：小写连字符，能一眼看出这份文件干什么（例：`root-gate`、`orb-arena`、`qa-round1`）。
- 文件第一行标题固定写法：

```
# 1.2 第 <N> 步 · <A|B|C> 档 —— <中文主题>
```

一步三份文件，30 步共 90 份。每份文件里必须包含**一段可以整段复制粘贴的执行提示词**（用 `~~~~text` 包住），
开头四行逐字照 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) 第二节的口令，不许改字、不许加方括号。

---

## 二、三档提示词工程的分工（现在这个阶段）

「派 30 步去改代码」之前，先由三档人把 90 份提示词写完。三档独占路径互不相交：

| 档 | 负责步号 | 独占文件 | 状态 |
| --- | --- | --- | --- |
| **A 主管** | 第 1 步 + 三份总纲 | `plan-1.2-supervisor.md`、`plan-1.2-tracker.md`、`plan-1.2-index.md`、`plan-1.2-step1-A/B/C-*.md` | ✅ 本次提交完成 |
| **B 新游戏** | **第 2–8 步**（21 款新游戏） | 只许 `docs/plan-1.2-step2-*.md` … `docs/plan-1.2-step8-*.md` | ⬜ 待写 |
| **C 升级 + 收尾** | **第 9–30 步**（55 款精细化 + 冲突步 + 3 轮验收） | 只许 `docs/plan-1.2-step9-*.md` … `docs/plan-1.2-step30-*.md` | ⬜ 待写 |

A **不写** step2 及以后；B **不写** step1 与 step9+；C **不写** step1–step8。
三档都**不许**改别人的文件，也**不许**在这个阶段写任何游戏代码。

---

## 三、30 步总表（连续编号，无空隙）

施工 id 由 A 档定稿，见 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) 第四节与第五节。

### 阶段一 · 平台基建（第 1 步，A 档已写）

| 步 | A 档 | B 档 | C 档 |
| --- | --- | --- | --- |
| 1 | [root 管理员门 + 直达第 N 关](./plan-1.2-step1-A-root-gate.md) | [手游 / 端游筛选 + 手机文字](./plan-1.2-step1-B-platform-filter.md) | [闯关 / 对战 / 无尽口径 + 2.5D 基建](./plan-1.2-step1-C-modes-view.md) |

### 阶段二 · 21 款新游戏接入（第 2–8 步，B 档写）

| 步 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- |
| 2 | `orb-arena` 圆圆吞星场 | `snake-royale` 长蛇争星场 | `block-drop` 方块落落乐 |
| 3 | `combo-clash` 连招擂台 | `mahjong-bloom` 花开麻将 | `star-estate` 星光地产街 |
| 4 | `hero-cards` 英雄牌局 | `weiqi-garden` 围棋小院 | `flight-chess` 飞行棋小站 |
| 5 | `merge-2048` 翻倍方块 | `mine-garden` 花园探雷 | `sudoku-petal` 花瓣数独 |
| 6 | `dot-maze` 点点迷宫 | `fruit-stack` 水果叠叠高 | `pool-stars` 星星桌球 |
| 7 | `junqi-camp` 军棋营地 | `chess-garden` 国际象棋花园 | `dark-chess` 翻翻棋 |
| 8 | `hue-hand` 调色小手 | `hop-pads` 跳跳格子 | `tap-tiles` 节拍方块 |

### 阶段三 · 55 款老游戏精细化升级（第 9–26 步，C 档写）

| 步 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- |
| 9 | `garden-guard` | `sprout-defense` | `ocean-munch` |
| 10 | `rainbow-run` | `fruit-slice` | `poop-hero` |
| 11 | `sling-birds` | `candy-swing` | `bubble-aim` |
| 12 | `shoot-range` | `sky-squad` | `snow-fight` |
| 13 | `monster-crisis` | `bomb-buddies` | `tank-battle` |
| 14 | `fight-king` | `duo-vs-star` | `duo-arena` |
| 15 | `duo-rush` | `bumper-cars` | `bowling-lane` |
| 16 | `ice-fire-forest` | `puff-bros` | `prince-princess` |
| 17 | `brave-path` | `adventure-king` | `alien-seek` |
| 18 | `box-hamster` | `puzzle-tiles` | `lianliankan` |
| 19 | `balloon-pop` | `bubble-pop` | `match-stars` |
| 20 | `brick-break` | `memory-cards` | `mole-pop` |
| 21 | `fruit-catch` | `snake-snack` | `kitty-care` |
| 22 | `xiangqi`（**只升级，不新建**） | `gomoku` | `landlord-cards` |
| 23 | `red-blue-race` | `red-blue-tap` | `red-blue-tug` |
| 24 | `math-farm` | `clock-house` | `shape-kingdom` |
| 25 | `pinyin-train` | `word-garden` | `find-diff` |
| 26 | `color-fun` | `music-stars` | `gold-hook` + `fishing-star`（唯一一个两款的位） |

### 阶段四 · 收尾（第 27–30 步，C 档写）

| 步 | 主题 | A 位 | B 位 | C 位 |
| --- | --- | --- | --- | --- |
| 27 | 冲突 / 串味 / 首页接线 / 全局回归 | 存档与 root API 审计 | 首页接线与筛选补齐（76 款 `platform` / `modes` 填准） | CSS / 快捷键 / `destroy` 泄漏审计 |
| 28 | **验收三人组 第 1 轮** | 测试员 | 学习优化员 | 监督修复员 |
| 29 | **验收三人组 第 2 轮** | 测试员 | 学习优化员 | 监督修复员 |
| 30 | **验收三人组 第 3 轮（收官）** | 测试员 | 学习优化员 | 监督修复员 |

合计：1 + 7 + 18 + 4 = **30 步**，游戏 55 + 21 = **76 款**。

---

## 四、派发前必读

1. 先读 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md)（职责、并发规则、法律红线、收口）。
2. 再看 [`plan-1.2-tracker.md`](./plan-1.2-tracker.md) 确认这一格**没人在做**，登记后再派——防重派全靠这张表。
3. 全部工作在分支 `game-1.2`，不改 `main`。
4. 执行子代理的模型 slug 一律 `claude-opus-5-thinking-high-fast`（不带方括号）。
