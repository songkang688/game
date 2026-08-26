# 1.2 第 9 步 · C 档 —— `rainbow-run`「彩虹跑跑」接着 1.1 第 6 步的 2.5D 往下做

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2`，不要改 `main`，不要 force。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.2 第 9 步（共 29 步）· C 档**：升级已有游戏 `rainbow-run`「彩虹跑跑」。
本步同时开工：A `gomoku`、B `match-stars`。别人的目录你一个字都不许碰。

## 一、分支纪律

- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- **动代码之前先提交一条「C 档 + 彩虹跑跑升级计划」的 commit**。
- 只在 `game-1.2` 线上干活：不改 `main`、不 merge 回 `main`、不用 `gh` 开 / 改 / 合 PR。
- 收尾：fetch → `git rebase origin/game-1.2` → `npm test` 与 `npm run build` 全绿 → `git push origin HEAD:game-1.2`。**禁止 force / force-with-lease。**

## 二、开工第一件事：确认 1.1 第 6 步的 2.5D 在不在（硬性）

1.1 第 6 步 A 已经把本款做成了 **2.5D 伪三维**，落在 `origin/game-1.1`：

```
src/games/rainbow-run/view3d.ts     透视投影 + 画质档位（+ view3d.test.ts）
src/games/rainbow-run/controls.ts   三键操作 + 土狼时间 + 输入缓冲（+ controls.test.ts）
src/games/rainbow-run/endless.ts    程序化路段 + 必过窗口 + 三种失败（+ endless.test.ts）
src/games/rainbow-run/index.ts      三道向地平线收敛 + 地面网格 + 三层视差 + 远端雾化 + 掉帧降画质
```

`meta` 在 1.1 已是 `modes: ["campaign","endless"]`、`levels: 188`、blurb 写明 2.5D。

**开工顺序：**

1. `git fetch origin game-1.1`，`git diff origin/game-1.2 origin/game-1.1 -- src/games/rainbow-run` 看清差异。
2. 如果 `game-1.2` 上还是老的俯视版（`index.ts` 里只有 `laneX = w * (0.5 + (lane-1)*0.26)`、障碍从负 y 往下掉、目录里没有 `view3d.ts`），**先把 1.1 的这一版对齐进来**，再做 1.2 深化。
3. **禁止推倒重写摄像机 / 投影 / 手感常量。** 1.1 的 `view3d` 与 `controls` 是既有资产，只许在其上加东西。
4. 在回复里写明：本步补的是「1.1 缺口对齐」还是「1.2 深化」，还是两者都有。

其余基线：188 关框架 `src/games/level99.ts`；收藏册 `src/engine/collection.ts`（只读，`collectionEffects()` 拿加成、`openCollection()` 开面板，**不许改 collection 源码**）；家长门 `src/ui/parentAuth.ts`；无尽成绩 `save.recordEndlessBest`。**不引入 three.js 或任何运行时依赖。**

## 三、现状审查（读完回复里逐条回答）

通读 `src/games/rainbow-run/{view3d.ts,controls.ts,endless.ts,logic.ts,sim.ts,index.ts,meta.ts,guide.ts,*.test.ts}`：

1. 透视投影现在的相机参数（地平线高度、焦距、雾化起点）是不是常量、能不能单测？画质档位是按什么指标降级的？
2. 三键（跳 / 滑 / 换道）的土狼时间与输入缓冲常量各是多少？30fps 与 60fps 下位移是否一致（delta time）？
3. 无尽路段生成的「必过窗口」校验覆盖多少种模板？随机 2000 段是否全部可过？
4. 战役进度 key（`yiduo-yixing.rainbow-run.campaign.*`）与无尽最好成绩 key 各是什么？有没有走通用 `l99` / `save.recordEndlessBest`？
5. 收藏册加成是否真的作用到跑酷（速度 / 磁力 / 金币 / 复活）？还是只在面板里好看？
6. HUD 在战役 ↔ 无尽切换时会不会叠字？窄屏「世界选择」卡片会不会横向溢出？

## 四、1.2 要加的深度（在 2.5D 之上）

| 项 | 规格 |
| --- | --- |
| **日夜与天气光照** | 无尽按距离循环晨 / 昼 / 黄昏 / 夜；雾色、地面网格亮度、远景层色温随之变。雨天地面加反光条（纯 Canvas 渐变，不加贴图）。 |
| **幽灵竞速** | 把一次无尽跑的输入（换道 / 跳 / 滑 + 时间戳）录成精简快照（上限 3 分钟、可序列化），下次跑时半透明幽灵同场。快照往返要有单测。 |
| **路段语法升级** | 现有模板之外再加：连续三次完美跳的节奏段、必须滑过的低梁 + 立刻换道、可破坏彩纸箱链、分岔路（左右各一条，合流点必须同帧）。每加一种模板都要进「必过窗口」校验。 |
| **战役** | 188 关与关卡表**不改数据**，只改渲染与手感；后段章节接上新路段语法。 |
| **同屏双人** | **不做**（`duo-rush` 是双人跑酷的归属，第 11 步会升级它）。理由写进回复。 |
| **收藏册联动** | 只读：人物外观、宠物被动（磁力 / 复活）、装备数值。画不出的装备用颜色点缀，**不许外链贴图**。 |

## 五、手感（必须是常量 + 单测，不许散在渲染里）

- 土狼时间 ~90ms、跳跃缓冲 ~120ms、下滑锁定短于跳跃；换道横向插值 80–120ms。
- 速度、重力、跳跃初速全部按 delta time 积分：**30fps 与 60fps 跑同一段路，位移差 < 2%**（写成断言）。
- 三种失败：撞障碍 / 掉坑 / 被追赶物追上；复活一次后短暂无敌（沿用已有星星花费，不要新开经济）。
- 程序化段的**必过窗口**：任意连续 3 行不得出现「三条车道全是既不可跳又不可滑」的组合，随机 2000 段全部可过要有断言。

## 六、视觉 · 建模

- 地面网格向灭点收敛；角色脚下扁圆影子随高度缩放；换道时角色有轻微侧倾（reduced-motion 下取消倾斜，保留位移）。
- 远景 2–3 层视差，掉帧时自动减层与减粒子（沿用 1.1 的画质档位，不要另起一套）。
- 角色是 Canvas 矢量朵朵，不外链贴图。

## 七、手机 360px

- 三车道在窄屏不能被挤成竖条把角色顶没；跳跃按钮与滑动手势分区明确，**不要和点 HUD 抢手势**。
- 世界名允许换行，禁止横向溢出；HUD 字号 ≥ 13px，对比度 ≥ 4.5:1。
- 触屏：上滑跳、下滑滚、左右滑换道；键盘 `W`/`↑` 跳、`S`/`↓` 滑、`A D`/`← →` 换道。

## 八、平台接线

- 自建世界地图，必须提供 `openCampaignLevel(n: number /* 1 基 */): void`：mount 时读 `api.initialLevel` 或 `?level=`，**直接开跑第 N 关**（可以先一句 intro，但不许卡在选世界）。越界 clamp。
- Skip 走 `getLevelExtras().requestSkip("rainbow-run", n - 1)`，成功后本关 0 星、解锁下一关，并尽量同步一份 `yiduo-yixing.l99skip.rainbow-run` 给家长面板；读不到就只写战役进度并在回复里注明。
- 无尽最高分统一走 `save.recordEndlessBest("rainbow-run", meters)`；老 key 若存在就读一次迁移，不许清零玩家纪录。
- `meta.platform` 填 `"mobile"` 或 `"both"`（按实测填）。

## 九、独占文件与冲突

只许改 `src/games/rainbow-run/**`。只读 `src/engine/collection.ts`、`src/ui/level188Contract.ts`。**不要碰 `duo-rush`**（第 11 步 A 的地盘）。
冲突预防：方向键不要和首页焦点抢；`PROGRESS_KEY` / 无尽 key 不要改名；BGM 不要新起一个抢全局的 `AudioContext` 单例，用平台 `api.play` 与已有开关。

## 十、测试（新增 ≥ 20 个用例）

透视投影单调性（z 越大 scale 越小、不越过地平线）、新路段模板的必过窗口 2000 段、土狼 / 缓冲常量、30fps vs 60fps 位移差 < 2%、幽灵快照序列化往返、`openCampaignLevel` 边界 clamp、日夜循环纯函数、收藏册加成不超过上限。

冒烟：战役第 1 / 100 / 188 关、无尽跑到第一次失败、360×640 与 1280×800、`prefers-reduced-motion` 下不抖。

## 十一、分级红线

无血无伤无死亡描写；失败只鼓励；文案与注释禁止商业商标、官方角色名与任何同类跑酷作品名（内部研究结论只许变成参数）。

## 十二、完成后回复

写清：你是 C 档、`rainbow-run`；1.1 的 2.5D 是「对齐补入」还是「已在、直接深化」；相机与手感常量取值；幽灵竞速怎么存；能否 `?level=N` 直开；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
