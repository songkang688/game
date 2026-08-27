# 窗口 2 · 第 6 步 C 档 · `pool-stars`「梨康台球」工作计划 + 犯规表

规格来源：`docs/plan-1.2-step6-C-pool-stars.md`（第一节到第十六节逐条对照实现）。
本文件是开工前的计划稿，放在本款独占目录里，不碰任何共享文件。

## 一、独占文件

只新建 / 修改：

- `src/games/pool-stars/**`（本文件所在目录）
- 可选 `scripts/smoke-1.2-step6-c.mjs`

`dot-maze`、`fruit-stack`、`bubble-aim`、`src/ui/home.ts`、其它游戏目录一律不碰。
样式走本款自己注入的 `<style>`（选择器全部 `.ps-` 前缀），因此连 `src/styles.css` 也不动。

## 二、模块切分

| 文件 | 职责 |
| --- | --- |
| `meta.ts` | 纯数据：id / title / emoji / category / color / blurb / modes / levels / platform |
| `physics.ts` | 自写 2D 圆碰撞：`strike` `collideBalls` `bounceCushion` `pocketed` `stepWorld` `simulateShot`，固定步长子步进 |
| `rules.ts` | 八球规则：`foulReason` `assignGroups` `eightBallOutcome` `placeCueBall` `resolveShot`（一杆推演后的状态机） |
| `levels.ts` | 8 章 188 关的布局生成、成功判定 `levelSuccess`、残局解搜索 `findSolution` / `gridSolve` |
| `ai.ts` | 四档电脑：菜鸟 / 普通 / 高手 / 地狱（地狱会打安全球与走位） |
| `guide.ts` | `GuideBook` 攻略，只讲方法 |
| `view.ts` | Canvas 球桌视图：瞄准线、力度条、入袋缩小下沉动画、360px 竖版布局、键盘 + 触屏 |
| `index.ts` | `export { meta }` + `mount(api)`：闯关 188（`mountLevelGame`）/ 人机 BO3 / 无尽 / 双人同屏 |

物理不引入任何依赖，全部纯函数；`destroy` 统一由 view 的清理袋回收监听 / rAF / 定时器。

## 三、犯规表（实现与单测都按这张表）

| # | 情形 | 判定 | 处理 |
| --- | --- | --- | --- |
| 1 | 开球母球没过中线，或者没碰到球堆 | 犯规 | 重摆，换人开球 |
| 2 | 开球就把黑星球打进 | 不判胜负 | 重摆（避免秒胜） |
| 3 | 母球一颗球都没碰到（空杆） | 犯规 | 对方自由球 |
| 4 | 母球第一颗碰到的不是己组球（开放局面除外） | 犯规 | 对方自由球 |
| 5 | 己组没清完就先碰黑星球 | 犯规 | 对方自由球 |
| 6 | 母球落袋 | 犯规 | 对方自由球 |
| 7 | 己组没清完却把黑星球打进 | 判负 | 本局对方胜 |
| 8 | 黑星球和母球同一杆落袋 | 判负 | 本局对方胜 |
| 9 | 指定袋模式下黑星球进了别的袋 | 判负 | 本局对方胜 |
| 10 | 连续 3 次犯规（开关默认开，闯关关掉） | 判负 | 本局对方胜 |
| 11 | 己组清完后合法把黑星球打进（指定袋对上、无犯规） | 胜 | 本局本方胜 |
| 12 | 己组最后一颗和黑星球同一杆进袋，且无犯规 | 胜 | 本局本方胜 |
| 13 | 打进对方的球 | 不犯规 | 球算对方的；能不能续杆只看自己有没有进己组球（常量 `OPPONENT_POT_KEEPS_TURN = false`） |

自由球：对方可以把母球放到台面任意合法位置（`placeCueBall` 负责压进台面、避开袋口与其它球）。

## 四、残局可解怎么保证

1. `levelSuccess(spec, res)` 是纯谓词：目标球进袋 + 本关附加约束（先碰库 / 先碰指定球 / 母球不许落袋 / 指定袋对上）。
2. `findSolution` 先试几何候选角（每颗目标球对每个袋口的假想球点，含一次库边镜像点与组合球的二段假想球点），再退回**角度 × 力度网格**全扫。
3. `gridSolve` 是纯粹的网格扫描（角度步进 1°，力度 4 档），单测直接用它抽样断言「每个抽到的残局都能找到至少一个成功解」，并把解回代重跑一遍验证。

## 五、测试计划（硬性 ≥ 25，目标 40+）

`physics.test.ts` / `rules.test.ts` / `levels.test.ts` / `ai.test.ts` / `view.test.ts` / `smoke.test.ts`，覆盖规格第十三节列的全部必测项：
开球未过线犯规、开球进黑星球重摆、分组判定、先碰非己组犯规、母球落袋自由球、连续 3 次犯规判负（含开关）、
未清完打进黑星球判负、黑星球与母球同进判负、合法进黑星球判胜、己组最后一颗与黑星球同杆判胜、
碰撞动量近似守恒、高速球不穿库边、`assertTotal(chapters, 188)`、残局可解抽样、`destroy` 干净。

## 六、红线自审

无商标（含台球品牌 / 赛事 / 商业 App 名）、无赌博下注、无血无死亡、失败只鼓励、
无广告无内购无账号无联网、离线可玩、不引入物理引擎依赖、存档 key 只增不改（无尽走 `save.recordEndlessBest`）。
