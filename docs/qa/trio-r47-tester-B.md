# 测试员 B · r47 抽验（PR #120）

> **角色**：只修 A 的 N-201 / N-202（钓鱼 `.fs-back`）。**不回退** 820 档菜单修。**不改** `level99.ts` / `home.ts` / `src/art/kit/**`。**N-105 禁止新版本。**
> **不要混**：A 的 N-202 是暂停弹窗 `.fs-btn`（`button("fs-btn","▶ 继续")`），本项只钉 **钓鱼无尽 `.fs-back`**。
> **不要改**：fruit-stack 同名 `.fs-back`（已绿，粉 `#a8456a`）；`.oa-open` / `.oa-btn` / 技能；`.fs-act` / `.fs-open`。

## 任务

| 编号 | 游戏 | 选择器 | 挂载 | 修法 |
|------|------|--------|------|------|
| **N-201** | 光球擂台 | `.oa-back` | `oa-back`「◀ 回选关」 | 钉 44 + inline-flex |
| **N-202** | 钓鱼之星 | `.fs-back` | `fs-back`「◀ 回选关」 | 钉 44 + inline-flex |

## 改了什么

### N-201 `src/games/orb-arena/index.ts` `.oa-back`

playbook 基线无 min-height；本分支已有 `min-height:44px`。补 `display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box`。不改 `.oa-open` / `.oa-btn`。

### N-202 `src/games/fishing-star/index.ts` `.fs-back`

只改钓鱼之星回选关。fruit-stack `.fs-back`（粉 `#a8456a`）一字不改。暂停 veil 仍用 `.fs-btn` / `button("fs-btn", "▶ 继续")`，一字不改。

## 实测

无头 Chrome · `hasTouch`/`isMobile` · 禁 SW · `#/game/orb-arena` 点「缩圈无尽」、`#/game/fishing-star` 点「钓到天黑」后量回选关。计算样式 `display` 为 `flex`（`inline-flex` 在 button 上的 computed）。

| 选择器 | 390×844 | 915×412 | 1024×768 |
|--------|---------|---------|----------|
| `.oa-back` | **44×80.3 IN** | **44×80.3 IN** | **44×80.3 IN** |
| `.fs-back`（钓鱼） | **44×78.1 IN** | **44×78.1 IN** | **44×78.1 IN** |

## 测试

`npx vitest run src/games/hotspot.r47b.test.ts src/games/hotspot.r22b.test.ts` — 8 passed。`npm run build` 通过。

## 820 档 / N-105

不回退 duo-arena / gomoku 820 菜单修。combo-clash 无 820。`level99.ts` 的 `.l99-continue` 无 44。
