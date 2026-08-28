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

### 915×412 浏览器（preview，独立 context，先写 `l99.<id>` 再换 hash）

| # | 数字 |
| --- | --- |
| N-63 保龄 | `.bl-open` **82–126 IN**；舞台 scrollTop **0**（旧 −174） |
| N-63 hop | `.l99-node-cur` **250–330 IN**；模式钮 **92–136 IN** |
| N-68 第 100 关 | 「三图侦探社 · 第 100 关」；triple 横排；play 格 top **250 / 280 / 310**，末格底 **336 IN**（旧 471/501/531） |
| N-68 第 1 关 | `.fdf-panels-row`、无 triple；格 **250–336 IN** |
| C-6 | `.as-deduce`；scrollTop **0**；◀✓▶ **301–345**、▼ **350–394 IN**（旧 428/477） |
| N-37 | `.qz-choice` 三钮 **300–346 IN**（旧 453） |
| N-73 | `.mst-scoreplay`；哆 **346–411 IN**（旧 404 切） |
| N-47 | 初级 9×9 **h=44**；`.ak-back` **h=44** |

`npm test` **1174** files / **19455** tests；`npm run build` 绿。kit 未扩。存档 key / meta.id / 题库 / seed / 胜负未改。

B 已先合 `d78c9e50`（N-69..74 休闲）。本分支 rebase 其上，撞车取先合版。
