# 1.3 第 25 步 · B 档 —— `shape-kingdom`「形状王国」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 25 步 · B 档**：给 `shape-kingdom`「形状王国」做只动皮肤不动骨头的美术精修。
本步三人：A `word-garden`、B `shape-kingdom`、C `find-diff`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「B 档 · shape-kingdom 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/shape-kingdom/**` 里的 `draw.ts` 渲染层（`paint` / `paintBoard` / `paintHeader` / `paintRack` / `paintReadout` / `drawStars` / `drawMetrics`）、CSS、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- 形状拼放判定、`placements` 数据结构、关卡目标（形状认知的教育语义：三角就是三角，不许为了好看改形状比例）；
- 存档 key、`meta.ts` 的 `modes/levels/category`；1.2 修正过的「99 关」文案口径；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，DOM/SVG 程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/shape-kingdom/draw.ts`，渲染入口是 `paint` / `paintBoard` / `paintHeader` / `paintRack` / `paintReadout` / `drawStars` / `drawMetrics`。已核实的问题：

1. `paintBoard`（约 937 行起）就是**给格子换 class**：目标区 `shk-cell-target`、已放置 `shk-cell-p0..3` 四色平涂（938–946 行）——形状块没有任何质感，四种颜色是四张色纸；
2. 「王国」题材自查：画面上有没有城堡 / 王国的任何元素？预期没有——题材与画面脱节；
3. 形状放置的过程感自查：预期是瞬间变色，没有拾起 / 吸附 / 落定；
4. `paintRack` 待选形状架、`paintHeader` 顶栏、`drawStars` 星星评价、`paintReadout` 读数逐个自查，把结论记进开工 commit；
5. 完成一关的庆祝画法自查。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **宝石形状块（核心）** | 四色平涂升级为宝石质感：每块加同色系三停渐变（左上受光）+ 中央切面高光三角 + 1.5px 深色描边 + 底部 2px 暗边（2.5D 厚度）；**形状轮廓与比例一个点不动**（教育语义），只加表面质感。 |
| **城堡地基语义** | 目标区 `shk-cell-target` 升级为「城堡地基」：虚线轮廓 + 石纹底 + 四角小旗；拼放进度越高，目标区外圈的城堡剪影（塔楼 + 城墙，SVG 背景层）逐段点亮——「形状拼好 = 王国建成」的叙事成立。 |
| **拾起与吸附** | 从 `paintRack` 拾起：抬升 4px + 放大 1.05 + 影子；接近正确格显示半透明预放虚影（读既有校验只做映射）；放对：吸附落定 + 四角星闪 + 「咔」的视觉顿帧；放错：轻弹回 + 摇头 ±3°（不批评，reduced 瞬回）。 |
| **完成仪式** | 一关拼满：城堡剪影全亮 + 升旗动画（旗子沿旗杆升起 400ms）+ 彩纸 + `drawStars` 的星星逐颗弹入（reduced 同时亮）。 |
| **形状架与顶栏** | `paintRack` 待选块下加木架横条与投影；`paintHeader` / `paintReadout` 卡片化（关卡 / 剩余块 / 目标）；`drawMetrics` 保持数据语义只换卡片壳。 |
| **场景氛围** | 背景淡色天空 + 远山 + 两朵云（缓移，reduced 静止）；棋盘外框画成城墙垛口边框。 |

- 色板走 `src/art/kit/palette.ts`；星闪走 `sparkle.ts` 等价；宝石渐变可复用 `volume.ts`。
- `prefers-reduced-motion`：吸附动画、升旗、云移全停，保留静态质感与点亮结果。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：`palette.ts`（粉彩 token 与 `shade`）、`volume.ts`、`outline.ts`、`sparkle.ts`。
- 你需要而 kit 没有的能力（比如 `gem.ts` 宝石表面）：**新增**文件并配套单测，不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看形状认知 / 七巧板页面，**只学两件事：画面密度（王国氛围层）与形状剪影（四色块一眼分清）**。
- 禁止抄任何商标与官方素材；城堡剪影原创，不像迪士尼城堡。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：**拼放判定格与拖拽热区一个像素都不动**；
- 宝石质感在小格（低于 32px）省略切面只留渐变 + 描边；
- 顶栏卡片一行放得下，字号 ≥ 14px；形状架不遮棋盘。

## 八、独占文件与冲突

只许改 `src/games/shape-kingdom/**` 与新增 `src/art/kit/` 文件。不要碰 `word-garden` / `find-diff`。CSS 类名沿用 `shk-` 前缀；`destroy` 清干净动画计时。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- 形状轮廓路径换肤前后一致（快照断言，教育语义钉死）；
- 四色宝石样式含渐变非平涂（遍历 p0–p3 断言）；
- 城堡点亮段数 = 拼放进度映射（0 / 50% / 100% 三点断言）；
- 放对 / 放错走不同视觉分支（类名断言）；
- reduced 下吸附 / 升旗 / 云移不启用；`destroy` 归零；
- 既有拼放判定测试断言一个不许改。

## 十、分级红线与回复

放错只是摇头弹回；失败只鼓励；无商标。完成后回复：你是 1.3 第 25 步 B 档、`shape-kingdom`；第三节的现状结论；宝石块与城堡点亮的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
