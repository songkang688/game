# 1.3 第 17 步 · B 档 —— `adventure-king`「冒险小王」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 17 步 · B 档**：给 `adventure-king`「冒险小王」做只动皮肤不动骨头的美术精修。
本步三人：A `brave-path`、B `adventure-king`、C `alien-seek`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「B 档 · adventure-king 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/adventure-king/**` 里的绘制函数、CSS、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- 平台物理、钩绳判定（`run.hook` 的锚点逻辑）、回旋镖轨迹、敌人 AI、无敌闪烁时序；
- 存档 key、`meta.ts` 的 `modes/levels/category`；关卡与文物收藏数据（`renderAlbum` 背后的数据层）；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，全部程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/adventure-king/index.ts`，绘制入口是 `draw` / `drawBackground` / `drawPlatforms` / `drawPlayer` / `drawEnemies` / `drawBoomerang` / `drawArtifacts` / `drawAnchors` / `drawDoor` / `drawHud` / `renderBoard` / `renderAlbum` / `renderHud`。已核实的问题：

1. `drawPlayer`（约 481 行起）的主角本体是**一个 r=17 的圆**加脚下椭圆影；钩绳是一条 3px 棕线（489–494 行）——「冒险小王」连一顶探险帽都没有，荡绳时身体不摆、落地不压缩；
2. 无敌闪烁靠整帧跳过绘制（482 行 `return`），闪烁生硬；
3. `drawBackground` 背景、`drawPlatforms` 平台、`drawEnemies` 敌人、`drawBoomerang` 回旋镖、`drawArtifacts` 文物、`drawDoor` 门逐个打开自查：预期是纯色几何 + 少量 emoji，把每个的结论记进开工 commit；
4. `renderAlbum` 文物收藏册预期是文本列表，缺「博物馆陈列」的仪式感；
5. `drawHud` 与 `renderHud` 双轨 HUD 的样式统一性也要自查。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **主角建模** | r=17 判定圆不动，在其上画「小探险家」：探险帽（帽檐 + 帽带）+ 护目镜（额头上，双圆 + 反光点）+ 小背包（侧挂）+ 围巾飘带；姿态四帧：跑（前倾 8° + 围巾后飘）、跳（腿收起）、荡绳（身体沿绳切线倾斜，读钩绳角度只做映射）、落地（压扁 10%、90ms 回弹，reduced 关）。 |
| **无敌闪烁** | 整帧消失改为半透明 + 白描边呼吸（时序沿用既有 `invincible` 计数），孩子不再以为角色瞬移丢帧。 |
| **平台与地形** | 平台画三段剖面：草顶（锯齿草丛线 + 两朵小花）、土身（横向土层纹 2 条）、石底（深色圆角）；悬空小平台加底部悬根须；锚点 `drawAnchors` 画成木桩 + 铁环（高光点），可钩状态加微光呼吸。 |
| **敌人与回旋镖** | 敌人剪影原创化（圆滚滚 + 特征件：独角 / 大耳 / 尾巴），被回旋镖碰到是「晕圈 + 星星绕头」；回旋镖画成双叶木镖（旋转模糊两帧 + 弧线残影渐隐 3 段）。 |
| **文物与收藏册** | 文物 `drawArtifacts` 加金色描边 + 底座光柱 + 缓慢自转闪点；`renderAlbum` 升级为博物馆展柜网格：每格展台 + 玻璃反光斜线 + 未收集的画成剪影问号。 |
| **布局与 HUD** | `drawHud` / `renderHud` 统一卡片风（圆角 12px、白 72% 底、1.5px 描边）；关卡进度用小旗路径图。 |

- 渐变 / 描边 / 落影统一走 `src/art/kit/`；光源统一左上 45°。
- `prefers-reduced-motion`：围巾飘、压扁回弹、闪点、呼吸全停，保留静态层次。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：`palette.ts`（粉彩 token 与 `shade`）、`volume.ts`（`ballGradient` / `softShadow`）、`outline.ts`（统一描边）、`sparkle.ts`（星屑 / 彩纸）。
- 你需要而 kit 没有的能力（比如 `terrain.ts` 草顶土身剖面）：**新增**文件并配套单测，不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看跳跃冒险 / 荡绳页面，**只学两件事：画面密度（关卡装饰层次）与主角剪影（帽子 + 围巾一眼认出）**。
- 禁止抄任何商标与官方角色：不准像冒险岛 / 印第安纳琼斯 / 马里奥的具体造型；回到本库粉彩原创。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：主角配件在最小渲染尺寸可辨（帽子低于 5px 退化为色块）；
- 收藏册网格 2 列起排、展柜不溢出；
- HUD 一行放得下，字号 ≥ 14px；触屏按键热区不动。

## 八、独占文件与冲突

只许改 `src/games/adventure-king/**` 与新增 `src/art/kit/` 文件。不要碰 `brave-path` / `alien-seek`。CSS 前缀沿用本款既有前缀；`destroy` 清干净残影与计时。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- 主角四姿态分支切换阈值一测（读跑 / 跳 / 荡 / 落状态，不改）；
- 荡绳倾角映射只影响绘制、`run.px/py` 不变（断言）；
- 无敌态改为半透明分支、不再整帧 `return`（行为断言：绘制调用仍发生）；
- 平台三段剖面与锚点微光分支可调用不抛错（domStub 2D 桩）；
- reduced 下回弹 / 闪点 / 呼吸为 0；`destroy` 归零；
- 既有平台与收藏测试断言一个不许改。

## 十、分级红线与回复

无伤害、无血（敌人是「晕圈星星」）；失败只鼓励；无商标。完成后回复：你是 1.3 第 17 步 B 档、`adventure-king`；第三节每个函数的现状结论；主角四姿态与展柜收藏册的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
