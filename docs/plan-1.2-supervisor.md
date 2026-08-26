# 1.2 主管文档（开工计划）

> 本提交只占坑。正文下一提交写完。旧目录 `docs/game-1.2/` **已作废**，以 `docs/plan-1.2-*` 为准（不删旧文件，避免冲突）。

## 本档独占（只许这些）

- `docs/plan-1.2-supervisor.md`
- `docs/plan-1.2-tracker.md`
- `docs/plan-1.2-index.md`
- `docs/plan-1.2-step1-A-root-gate.md`
- `docs/plan-1.2-step1-B-platform-filter.md`
- `docs/plan-1.2-step1-C-modes-view.md`

## 基准

- 1.1 已完成：`origin/game-1.1` @ `8867138`（55 款 `src/games/*/meta.ts`）
- 持续优化分支：`game-1.2`（不改 `main`）
- 步号 1..30 连续，不跳号
- 形态：一步三档 = 三个文件 `docs/plan-1.2-step{N}-{A|B|C}-{slug}.md`

## 步数契约（拍板）

| 段 | 步号 | 内容 |
| --- | --- | --- |
| 平台 | 1 | A root 门 / B 手游端游筛选+手机文字 / C 模式契约+2.5D 基建 |
| 新游戏 | 2–8 | 21 款，每步 A/B/C 各 1 款（B 写 21 个文件） |
| 升级 | 9–27 | 55 款已有游戏每档 1 款；第 27 步 A 最后 1 款，B/C 升级收口 |
| 验收 | 28–30 | 测试员 / 学习优化员 / 监督修复员 × 3 轮（C 写） |

## 21 款施工 id（B 必须抄，避开已有 55）

`orb-tide` `coil-tide` `block-town` `combo-dojo` `mahjong-stars` `fortune-walk` `camp-cards` `go-garden` `aero-chess` `cube-drop` `bean-dash` `kart-stars` `merge-melon` `pixel-roam` `tiny-diner` `glow-soar` `auto-minis` `lane-clash` `sudoku-garden` `world-chess` `beat-tiles`

象棋只升级已有 `xiangqi`。球球 IO / 蛇蛇 IO 不是 `ocean-munch` / `snake-snack`。格斗新 id 不是 `fight-king`。

## 派发节奏

任何时刻执行线上应有 **3 个**子代理在跑（一步的 A/B/C）。派下一步前先登记 `docs/plan-1.2-tracker.md`。多窗口先看 tracker 再派。

## 本档作者纪律

只写提示词 Markdown。禁止实现游戏。禁止再派生云端子代理写代码。执行者模型 slug 写进提示词正文：`claude-opus-5-thinking-high-fast`（不要带方括号）。主管 inherit 父模型。
