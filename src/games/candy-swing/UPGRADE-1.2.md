# 12-B `candy-swing`「糖果秋千」1.2 升级计划

规格：`docs/plan-1.2-step12-B-candy-swing.md`；窗口纪律：`docs/plan-1.2-window3.md`（窗口 3 / 格号 12-B）。
只改 `src/games/candy-swing/**`，不碰 `sling-birds` / `gold-hook` / 窗口 1 平台文件。

## 一、现状审查（对着规格第三节逐条）

1. **绳段模型**：`physics.ts` 是 Verlet 质点 + 距离约束（`integrate` + `solveLinks`），不是弹簧力。
   约束迭代 **6 次**（`index.ts` 与 `sim.ts` 的 `solveLinks(..., 6)`）。
   糖果 `invMass = 0.3`（比绳结 1 重约 3.3 倍），重力 `900`，Verlet 阻尼 `0.998`，**都是常量**。
2. **切绳判定**：已经是「线段相交 + 10px 胖判定带」（`segmentsWithinDistance`），
   手指 `lastX,lastY → 当前点` 当作一条线段判交，所以直线快划**不会**穿模。
   但 pointermove 是浏览器合并过的稀疏采样，**没有取 `getCoalescedEvents()`**，
   弧线快划时中间那段被拉直，弧线内侧的绳会漏切；绳子本身还在 120Hz 动，
   判定用的是当帧静止快照。切断时只给绳头 `±3px` 的位置偏移，**甩感几乎看不出来**。
3. **已有机关**：泡泡 `bubbles`、挂钩 `hooks`、传送门 `portals`、气球 `balloons`、
   自动剪刀 `scissors`、糖果蛾 `moths`、木板/高台 `boards`、刺 `spikes`、
   发条绳 `winch`、风扇 `fans`、糖霜磁铁 `magnets`、捣蛋鬼咕噜噜 `gremlins`（共 14 种）。
   纯函数都在 `physics.ts`：`fanForceAt` / `fanOn` / `magnetForceAt` / `winchScale` /
   `retuneLinks` / `patrolPosition` / `boardPosition` / `snipOccurred` / `teleport` …
4. **三星与可解性**：`sim.ts` 的 `playRecipe` 已经**逐关**（188 关全量）验过「存在通关解」，
   但**只有第 1 关和第 100 关**额外断言了「三颗星全收」，
   其余 186 关**没有验证三星解存在**。三星标准 = `Math.max(1, 收集到的星星数)`，**与用时无关**。
5. **触屏**：canvas `touch-action: none` + `pointerdown` 里 `preventDefault()`，
   `pointerup/pointercancel` 挂在 `window` 上；重试/选关按钮用 `tapOnly` 挡掉划线误触。
   但**没有 `setPointerCapture`**，手指划出 canvas 边缘后 `pointermove` 不再来，
   划线会静默中断（不卡死，但断得莫名其妙）。
6. **三星标准**：见第 4 条。收集到几颗星就是几星（至少 1 星），不看时间。

## 二、本次要做的（规格第四节）

| 项 | 做法 |
| --- | --- |
| 切绳手感 | `getCoalescedEvents()` 取全部中间点；再把每段手指位移按 ≤14px 细分成子线段（`swipeSubSegments`），逐段判交，补掉弧线 tunneling；切断瞬间按划速给绳头一个横向甩动冲量（`whipImpulse`）。 |
| 新机关 ①「粘性泡泡」 | `stickyGripStep`：糖果撞上就被黏住 `hold` 秒，期间速度归零、位置钉在泡泡上；到点自动放开并留 `cool` 秒不再黏。纯函数 + ≥3 用例。 |
| 新机关 ②「弹簧蘑菇」 | `springBounce`：按蘑菇朝向把入射速度反射并放大，给一个最小弹出速度，**改变方向**而不是简单反弹。纯函数 + ≥3 用例。 |
| 连击 | 一次划线切断 ≥2 根**不同绳子**给「一刀两断」奖励（`comboLabel` 纯函数），画面弹字 + 音效。 |
| 轨迹残影 | 糖果 300ms 淡出残影（`CANDY_GHOST_MS = 300`），`prefers-reduced-motion` 下残影与碎屑减半。 |
| 无尽「甜甜塔」 | 新文件 `endless.ts`：`makeTowerLevel(seed, wave)` 用 mulberry32 确定性随机拼机关组合，逐层加难；`save.recordEndlessBest("candy-swing", n)` 记录吃到第几颗糖。 |
| 可解性 | `sim.ts` 抽样 ≥30 关（含 100 / 145 / 188）验「存在通关解 + 存在三星解」；无尽塔前若干层也用 `searchCutTimeFor` 验有解。 |

## 三、模式矩阵

- 闯关 188：**保留**，前 99 关数据一个字节都不动（冻结哈希用例继续跑）。
- 无尽「甜甜塔」：**补做**（见上）。
- 对战：**不做**。理由写在 `meta.ts` 注释里 —— 割绳是「观察 → 规划 → 一次性下刀」的单人解谜，
  同屏两个人同时划同一根绳，先下刀的那个直接决定糖果轨迹，后手完全没有可操作空间；
  拆成两块画布又变成各玩各的，不是对战。硬凑只会得到一个假对战。

## 四、平台接线

- 本款是自建选关地图（不走 `mountLevelGame`），因此提供 `openCampaignLevel(n)` 供平台直达第 N 关。
- 存档 key **只增不改**：主 key 新增 `yiduo-yixing.candy-swing.campaign.v2`，
  老 key `yiduo.candy-swing.campaign.v2` 继续读、按「每关取最大星数」合并迁移一次，**不许丢星**，并写迁移用例。
- `meta.modes` 补 `endless`，`meta.platform: "both"`（鼠标划线与手指划线等价，桌面端也完整可玩）。

## 五、红线

无血无死亡；失败只鼓励；不出现任何同类割绳商业作品的角色名与作品名；
音效只走 `api.play`；`destroy` 拆干净 pointer 监听 / rAF / timer；
CSS 新类名一律 `cds-` 前缀且写在本款局部 `<style>` 里，不动 `src/styles.css`。

## 六、两版 12-B 怎么合的（`swing12.ts` 与本版的关系）

同一格 12-B 有两份实现先后落到 `game-1.2-window3` 上，功能清单几乎一样，合流时都留下了，
分工按「谁在跑」划清楚，不做二选一的删档：

| 东西 | swing12.ts 那一版 | 本版 | 合流后 |
| --- | --- | --- | --- |
| 切绳 / 连击 / 残影 | `strokeCutIndices`、`comboLabel`、`ghostAlpha` | `physics.ts` 的 `linksCrossedBySwipe` + `swipeSubSegments` + `whipImpulse` | 运行时走本版（多了子线段细分与切断甩绳），swing12 那几个纯函数留着，用例照跑 |
| 粘性泡泡 | `bubbles[i].sticky` + `stickyCatch/tickSticky/stickyRelease` | `stickies[]` + `stickyGripStep` | **两套字段都认**：`sim.ts` 与 `index.ts` 各自实现两条分支，同一关里混着摆也不打架 |
| 弹簧蘑菇 | `mushrooms[]`（四朝向、有上下限） | `springs[]`（法向 + `bounce`/`minOut`） | 同上，两套都能玩、都能仿真 |
| 无尽 | `buildSweetLevel` 一颗接一颗 | `endless.ts` 甜甜塔一层一层（带限时与层名） | 运行时走 `endless.ts`（逐层验过可解性）；`buildSweetLevel` 作为另一套生成器保留在纯逻辑层 |
| 存档 | `readStars` / `needsMigration` | `progress.ts` 的 `readProgress` / `writeProgress`（还回写老 key 给冒烟脚本用） | 运行时走 `progress.ts`，两套迁移用例都留着 |

要点是 **sim.ts 与 index.ts 必须认同一套规则**：合流后两处都直接调 `swing12.ts` 的纯函数处理
`bubbles[].sticky` 与 `mushrooms`，所以「仿真里能通关的关，跑起来也能通关」这条不会因为合流被破坏，
`upgrade12.test.ts` 第十一节专门盯这件事。

## 七、测试下限

新增 ≥ 20 个用例：切绳子分段不漏切、甩绳冲量、粘性泡泡（≥3）、弹簧蘑菇（≥3）、
一刀两断计数、30 关抽样「通关解 + 三星解」、旧 key 迁移、甜甜塔生成与计分、`destroy` 归零。
用例只增不减。
