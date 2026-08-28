# 三人组父监督 · 10 轮持续迭代（合入 `game-1.3`）

> 父监督目标：每轮 2 个测试修复员全面测+坏了立刻修，1 个学习优化员读 skills / 对照本库其它款写法，把下一轮可执行项写成 playbook。有空闲立刻派下一轮。全部提交推到 `game-1.3`（经 `cursor/*-d909` 分支 rebase 合入，禁 force）。

## 状态

- 仓库产品：「一朵一星」，工作分支基线 `origin/game-1.3`。
- 本监督启动时 HEAD：`6a9f42d0`（已含 r8 学习笔记 + 测试员 A 第 2 轮：S-1/S-2/S-3/S-4/L-1/C-1 等）。
- **本监督的第 1 轮 = 仓库三人组第 9 轮**（r1–r8 已有文档；r8 playbook 尚未被 A/B 按新伤执行）。
- 计划轮次：r9 … r18，共 10 轮。

## 三角色

| 角色 | 每轮干什么 | 报告 |
| --- | --- | --- |
| 测试修复员 A | 壳层 + 闯关学习：按**上一轮** playbook 测 915×412 等五档，不好用立刻修，配测试 | `docs/qa/trio-rN-tester-A.md` |
| 测试修复员 B | 休闲 / 对战 / 动手：同上 | `docs/qa/trio-rN-tester-B.md` |
| 学习优化员 | 本轮**只学习不改玩法**；对账 A/B 已合入项；抽未测维度；读 `.cursor/skills/1.3-visual/*` 与本库蓝本；写出下一轮 playbook | `docs/qa/trio-rN-learn-notes.md` + `trio-rN-playbook.md` |

第二轮起：A/B **必须执行**上一轮学习员写下的 🔧 清单（先 `git fetch` 对最新 `game-1.3`，已合入的销账不重做）。

## 红线（每轮一字不差）

- 不改存档 key / `meta.id`；不动题库、seed、win/lose 判定。
- 测试只增不减；每条修复配小测试；`npm test` 与 `npm run build` 全绿。
- `src/art/kit/` 已有文件只 import 不改（`stickers.ts` 扩容例外）。
- 宽屏 1280×800 零回归；收尾 fetch → rebase → 普通 push，禁 force，不改 `main`。

## 轮次记录

| 监督轮 | 仓库轮 | A | B | 学习员 | 合入 `game-1.3` |
| --- | --- | --- | --- | --- | --- |
| 1 | r9 | 派出 | 派出 | 派出 | 待合 |
| 2–10 | r10–r18 | 有空闲立刻派 | 同左 | 同左 | 待合 |

## 第 1 轮派工（r9）

- **A**：执行 r8 playbook 壳层+闯关：优先 N-33 结算弹窗、N-38 永久文案、N-37 root 挤压、N-36 描红、收藏册热区；对账最新 `game-1.3` 上 A 已修的 S-1/S-2/S-3/S-4/L-1/C-1 **不要重做**；N-30 古堡若时间够再做。
- **B**：执行 r8/r7 休闲对战：优先 N-25 格斗塔、N-1 fruit-catch、N-34/N-35 拼音两关型、N-26/N-27、N-31/N-32。
- **学习员**：以最新 `origin/game-1.3`（含 A 第 2 轮代码）对账 r8 playbook；抽未覆盖维度（双人结算、横竖切换、PWA、键盘、失败路径）；读 skills；写 `trio-r9-learn-notes.md` + `trio-r9-playbook.md` 给第 2 轮 A/B。
