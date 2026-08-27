# 1.3 第 1 步 · C 档 —— 跑酷 / 跑道类 2.5D·3D 共享套件（`src/art/runner/`）

> 本文件只记录第 1 步 C 档的开工计划与**可整段复制的派发提示词**，不涉及 A / B 档的文件。
> 主管文档：[`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) · 登记表：[`plan-1.3-tracker.md`](./plan-1.3-tracker.md) ·
> 视觉宪法：[`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) · skills：[`plan-1.3-skills.md`](./plan-1.3-skills.md)
> 同步进行：[A 档 · 素材包](./plan-1.3-step1-A-art-kit.md)、[B 档 · 布局动效](./plan-1.3-step1-B-layout-motion.md)。

## 目标

给跑酷 / 跑道 / 球道类游戏做一套**有纵深的伪 3D 渲染套件**：三车道透视跑道、分层视差天空、
深度缩放精灵、速度线与雾化、镜头微倾。观感对标商业跑酷大作的**质量等级**（纵深、速度感、层次），
但形象、配色标识、名字全部原创（宪法第八节），且仍是**离线 PWA：Canvas 2D 透视 + 分层精灵，禁止 three.js**。

消费方（本步不改它们）：`rainbow-run`（第 9 步 C）、`duo-rush`（第 11 步 A）、`red-blue-race`（第 23 步 A）、
`bumper-cars` + `bowling-lane`（第 15 步 C）、`poop-hero` 俯冲段（第 22 步 C）、`hop-pads`（第 8 步 B）。

## 接 1.2 的账：透视数学已经有了，缺的是「观感层」

1.2 第 1 步 C 已把透视数学收进 **`src/engine/view25d.ts`**（`project`、`roadQuad`、`fogAlpha`、
`groundGridDepths`、`respectReducedMotion`、`prefersReducedMotion` 等，先通读）。
但那只是数学：投影一个点、给一个梯形。真正的「商业跑酷大作观感」还缺**渲染语汇**——
车道怎么画、路肩滚动条纹、地平线上的分层远景、障碍在纵深里的体积与阴影、加速时的速度线。
本步把这层语汇做成 `src/art/runner/`，**只 import view25d，不改它、不重造第二套数学**。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/art/runner/track.ts`（新建） | 三车道跑道：路面、车道分隔虚线、路肩条纹滚动、弯道 / 起伏横向偏移 |
| `src/art/runner/sky.ts`（新建） | 分层视差远景（天空 / 远山或城市剪影 / 云层），主题可换色 |
| `src/art/runner/sprites.ts`（新建） | 深度精灵：按 z 缩放绘制回调 + 自动落地阴影 + 雾化；深度排序 |
| `src/art/runner/speedfx.ts`（新建） | 速度线、镜头微倾 / 落地轻震（reduced 降级为无位移） |
| `src/art/runner/index.ts`（新建） | 汇总导出 |
| `src/art/runner/*.test.ts`（新建） | 合计 ≥ 40 例（切分见提示词） |

## 红线自查

- 只 import `src/engine/view25d.ts` 与（可选）`src/art/kit/`（A 档同步在做；**若 A 未合入就先不 import，
  用绘制回调参数代替**，绝不复制 A 的代码）。
- 不改 `src/engine/**`、`src/games/**`（尤其 `rainbow-run` / `duo-rush`）、`src/ui/**`、`src/styles.css`。
- 禁止 three.js / WebGL 封装库 / 任何外部依赖；不提交位图。
- 极端输入（z 为负、视口为 0、NaN）沿用 view25d 的口径：给有限值或跳过绘制，不抛不 NaN。

## 验收

- `npm test` 全绿且只增不减；`npm run build` 全绿。
- 套件可被任意游戏 import，无循环依赖；`git diff --name-only` 只有 `src/art/runner/` 新文件。
- 自检：近大远小、雾化随深度增强、路肩条纹随 scroll 滚动、reduced 模式无震屏无视差位移。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-fable-5-thinking-xhigh`。
请在独立功能分支上进行修改，叫 game-1.2-kk。以 origin/game-1.2 为审美对照基线。不要直接修改 main。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生。全部推 `game-1.2-kk`，不回 `main`，禁止 force。本步只改视觉/素材/布局，不改关卡数值与胜负规则。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。
这是 1.3 视觉升级的**第 1 步（共 29 步）**，你是 **C 档：跑酷 / 跑道类 2.5D·3D 共享套件**。

## 必读文件（动笔前先读完）
- docs/plan-1.3-visual-bible.md —— 视觉宪法，特别是第五节（2D/2.5D/3D 分级）与第八节（法律红线）。
- src/engine/view25d.ts 与 view25d.test.ts —— 1.2 已有的透视数学（project / roadQuad / fogAlpha /
  groundGridDepths / respectReducedMotion / prefersReducedMotion），你只 import，不改、不重造。
- src/games/rainbow-run/view3d.ts 与 src/games/duo-rush/view25d.ts —— 两份游戏内旧实现，
  看它们各自积累的观感技巧（视差层、地面网格），你的套件要让它们将来能删掉自己那份。
- .cursor/skills/1.3-visual/algorithmic-art/SKILL.md —— 程序化视觉（粒子系统、流场、噪声）方法论，
  速度线与云层可借鉴；templates/generator_template.js 里的 requestAnimationFrame 结构仅作参考。
- .cursor/skills/1.3-visual/canvas-design/SKILL.md —— Canvas 构图与层次方法论（只借方法，不用它的字体流程）。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2 game-1.2-kk`，工作分支建立在 `origin/game-1.2-kk` 之上：
  `git checkout -B <你的工作分支> origin/game-1.2-kk`。`origin/game-1.2` 只作审美对照，不在它上面开工。
- 开工前先提交一条 git 记录（写上「1.3 第 1 步 / C · runner 套件」和你的工作计划），再动代码。
- 全部工作推 `game-1.2-kk`。不要 push 到 `game-1.2`、不要改 main、不要用 gh 开或合 PR。
- 收尾：`git fetch origin game-1.2-kk` → `git rebase origin/game-1.2-kk` → `npm test && npm run build` 全绿
  → `git push origin HEAD:game-1.2-kk`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
C：做跑酷 / 跑道类以后都要 import 的**伪 3D 观感套件**。本步**一款游戏都不改**——
`rainbow-run` / `duo-rush` 等换用你的套件分别是第 9 / 11 步的活。
同一步 A 在做 `src/art/kit/**`，B 在做 `src/ui/**` 与 `src/styles.css`。**别人的文件一个字都别动。**
若 A 的 kit 还没合入 origin/game-1.2-kk，你的 API 用「绘制回调」解耦（见下），不要去等也不要抄。

## 独占文件（只许新建这些）
- `src/art/runner/track.ts`、`src/art/runner/sky.ts`、`src/art/runner/sprites.ts`、
  `src/art/runner/speedfx.ts`、`src/art/runner/index.ts` 及各自的 `*.test.ts`。

明确不许碰：`src/engine/view25d.ts` 及一切 `src/engine/**`；`src/art/kit/**`（A 的）；
`src/ui/**`、`src/styles.css`、`index.html`（B 的）；任何 `src/games/<id>/` 目录；任何 `meta.ts`。

## 观感目标（对标「商业跑酷大作」的质量等级，不对标形象）
一屏之内要同时有：透视收缩的三车道路面、路肩滚动条纹、地平线雾化、
分层视差远景（≥ 3 层，滚动速度按深度递减）、按深度缩放且带落地阴影的障碍 / 金币、
加速时从画面边缘向中心的速度线。禁止出现任何商业游戏的角色、标志性配色、名字（黑名单见 1.2 主管文档第八节；
代码注释里也不许写「像某某跑酷」）。

## 1）`track.ts` —— 跑道
至少导出：
- `interface TrackTheme { road: string; shoulder: string; laneLine: string; stripeA: string; stripeB: string }`
  与内置 2 套主题（彩虹糖果系 / 星夜系，色值自定，走宪法粉彩方向）。
- `laneCenterX(lane: 0|1|2, z, cam, viewW): number` —— 车道中心线的屏幕 x（用 view25d.project）。
- `curveOffset(z, curvature): number` —— 弯道 / 起伏的横向偏移（平滑、有界、NaN 安全）。
- `drawTrack(ctx, cam, { scroll, curvature, theme }, viewW, viewH)` —— 由远及近画路面梯形段
  （用 view25d.roadQuad + groundGridDepths）、车道虚线、路肩交替条纹（scroll 驱动滚动）。
- reduced 模式（cam 为 flat 时）自动退化为平面俯视条带，不许崩。

## 2）`sky.ts` —— 分层视差远景
- `makeSkyLayers(theme): SkyLayer[]` —— ≥ 3 层（渐变天幕 / 远景剪影 / 云层），每层含视差系数。
- `drawSky(ctx, layers, scroll, viewW, viewH, reduced)` —— reduced 时视差系数置 0（静止背景）。
- 远景剪影用多边形 / 圆弧程序化生成（可带 seed 参数保证可测），不用位图。

## 3）`sprites.ts` —— 深度精灵
- `drawAtDepth(ctx, cam, { x, y, z, draw }, viewW, viewH)` —— `draw(ctx, screenX, screenY, scale)` 是调用方回调
  （将来传 kit 的金币 / 障碍 / 角色进来），本函数负责 project、可见性剔除、自动椭圆落地阴影、雾化叠加。
- `sortByDepth(items)` —— 远的先画；稳定排序。
- `fogTint(scale): number` —— 包装 view25d.fogAlpha 的便捷雾化强度。

## 4）`speedfx.ts` —— 速度与镜头
- `makeSpeedLines(intensity, reduced)` / `drawSpeedLines(ctx, state, viewW, viewH)` —— 边缘向心速度线；
  reduced 时数量为 0。
- `cameraNudge(t, kind: "tilt"|"land", reduced): { dx; dy; rot }` —— 变道微倾与落地轻震
  （位移 ≤ 视口 1.5%，rot ≤ 1.2°）；reduced 时恒为 0。

## 测试（合计 ≥ 40 例，用记录式 ctx 桩，不碰真 DOM；A 的 makeStubCtx 若已合入可复用，否则自带私有桩）
- `track.test.ts` ≥ 14：laneCenterX 三车道左中右有序、近处间距大于远处（透视收缩）；curveOffset 有界 /
  平滑 / NaN 安全；drawTrack 产生绘制调用、scroll 变化改变条纹相位、flat 模式不崩、视口 0 不抛。
- `sky.test.ts` ≥ 8：层数 ≥ 3、视差系数按深度递减、reduced 置 0、同 seed 剪影可复现。
- `sprites.test.ts` ≥ 10：z 越大 scale 越小、相机后剔除不调 draw、阴影随 scale 缩放、
  sortByDepth 远先近后且稳定、fogTint 单调。
- `speedfx.test.ts` ≥ 8：intensity 越大线越多、reduced 数量 0、cameraNudge 有界且 reduced 恒 0、t 循环连续。

## 不要做什么
- ❌ 改 view25d.ts 或往里加函数（缺数学就在自己目录写薄封装，并在回复里建议主管迁移）。
- ❌ 改 rainbow-run / duo-rush 等任何游戏（那是第 9 / 11 / 15 / 22 / 23 步的活）。
- ❌ 引入 three.js / WebGL 库 / 任何外部依赖；提交位图；新建 /demo 页面。
- ❌ 删测试、调低断言；注释里出现商业游戏或 3D 引擎商标。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿（tsc 无错）。
- `git diff --name-only origin/game-1.2-kk...HEAD` 只出现 `src/art/runner/` 下你的新文件。
- 回复里逐条自检：近大远小 / 雾化 / 条纹滚动 / 视差分层 / reduced 全降级，并给出宪法第五节定级说明。

完成后回复：你是 1.3 第 1 步 C、新建了哪些文件、各文件用例数与总用例数、
宪法自检结论、推到 `origin/game-1.2-kk` 的 SHA、以及**实际使用的模型 slug**。
~~~~
