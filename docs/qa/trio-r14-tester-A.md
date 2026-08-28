# 三人组第 14 轮 · 测试修复员 A

角色：壳层 + 闯关学习。分支 `cursor/trio-r14-tester-a-7779`。  
基线：`origin/game-1.3` @ `5cbb6a80`（r14 学习笔记已在树）。

## 对账（禁止重做）

N-48/58/59、N-39 主修（四处 `showMap(true)` 保持）、N-43 第三套 scrolly、N-44、N-45、S-4、L-2/L-3、N-16 `corridorFit` 公式、N-47 保龄/王子/坦克 44。B 面 N-68 以外的休闲对战未做。

## 本轮

| # | 改动 | 验收口径 |
| --- | --- | --- |
| N-63 | `.l99-wrap` 矮屏 `max-height:calc(100dvh - 136px)`；`showMap(true)` 后把 `.game-stage` scrollTop 归零；保龄/跳跳台模式条 sticky 顶 | 915 不滚能点双人对战；hop-pads `.l99-node-cur` 仍在屏 |
| N-68 | `tripleRow`：三图关真横屏三栏（参考+可点并排）。`rowLayout = !triple && sideBySide` 保持 | 第 100 关下图格子进 412；第 1 关双图并排零回归；seed 零触碰 |
| C-6 | 推理关 `as-deduce` 钳高 + 舞台归零；syncSize 画布 `vh-128` | 必须 `isDeduceLevel` 121 |
| N-37 | 只动 `.shk-quizhost` 矮横屏：插图 36px、选项 sticky | clock / 识字 / 形近字不扩大 |
| N-73 | `.mst-scoreplay` 钉琴键；沙盒不加类 | 第 167 关哆进 412；芯片可次级 |
| N-47 | `.mn-btn` 40→44；`.advk-tool` 44 | 只抬芯片 |
| N-16 | 只 `.ak-back` 33→44 | 未改 `corridorFit.ts` |

测试只增：`level99.n63.test.ts`、`find-diff/tripleRow.r14.test.ts`、`alien-seek/deduceLock.r14.test.ts`、`shape-kingdom/deepChoice.r14.test.ts`、`music-stars/scoreKeys.r14.test.ts`、`n47residual.r14.test.ts`。

kit 未扩。存档 key / meta.id / 题库 / seed / 胜负未改。
