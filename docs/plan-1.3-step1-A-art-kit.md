# 1.3 第 1 步 · A 档 —— 共享角色与道具素材包（`src/art/kit/`）

> 本文件只记录第 1 步 A 档的开工计划与**可整段复制的派发提示词**，不涉及 B / C 档的文件。
> 主管文档：[`plan-1.3-supervisor.md`](./plan-1.3-supervisor.md) · 登记表：[`plan-1.3-tracker.md`](./plan-1.3-tracker.md) ·
> 视觉宪法：[`plan-1.3-visual-bible.md`](./plan-1.3-visual-bible.md) · skills：[`plan-1.3-skills.md`](./plan-1.3-skills.md)
> 同步进行：[B 档 · 布局动效](./plan-1.3-step1-B-layout-motion.md)、[C 档 · 跑道套件](./plan-1.3-step1-C-3d-runner.md)。

## 目标

做一套**第 2–26 步 76 款游戏都能 import 的 Q 版素材包**：朵朵 / 星星角色（含皮肤）、
通用收集物（金币 / 星星 / 爱心 / 宝石）、通用障碍件、粒子反馈与阴影工具、统一调色板。
全部是 **Canvas 2D 矢量绘制函数**（不提交任何位图），本步一款游戏都不改。

## 为什么先做素材包

1.2 收官后 76 款游戏各画各的：`gold-hook` 的矿工是准火柴人，`sling-birds` 的小鸟是圆 + 两点，
金币在十几款游戏里就是一个黄色 `arc`。病根是**没有共享弹药库**——76 个执行者谁都不敢在自己格子里多花笔墨。
本步把「朵朵 / 星星怎么画、金币怎么画、收集反馈长什么样」一次画到精美，后面 25 个步、75 格全部 import 复用。
方法论先读 vendored skills（`.cursor/skills/1.3-visual/`，重点 `character-sprite-maker` 的动画清单思维与
`frontend-design` 的「拒绝模板脸」原则），落地全是自己写的矢量代码。

## 文件切分

| 文件 | 职责 |
| --- | --- |
| `src/art/kit/palette.ts`（新建） | 粉彩调色板常量、角色主色、`shade()` / `tint()` 明暗推导 |
| `src/art/kit/chars.ts`（新建） | 朵朵 / 星星绘制函数（姿态 / 朝向 / 眨眼 / 表情），皮肤参数化 |
| `src/art/kit/props.ts`（新建） | 金币 / 星星 / 爱心 / 宝石 / 尖刺 / 木箱 / 落地阴影 |
| `src/art/kit/fx.ts`（新建） | 收集爆星粒子、+1 飞字、闪光；reduced-motion 降级 |
| `src/art/kit/testing.ts`（新建） | `makeStubCtx()` 记录式 2D context 桩，供全项目素材契约测试复用 |
| `src/art/kit/index.ts`（新建） | 汇总导出 |
| `src/art/kit/*.test.ts`（新建） | 合计 ≥ 42 例（切分见提示词） |

## 红线自查

- 纯函数：绘制函数只吃传入的 `ctx`，不查 DOM、不建 canvas、不挂监听。
- 不 import 任何 `src/games/**` / `src/ui/**`；不改 `src/ui/avatars.ts`（首页头像是 B 档 UI 层的事）。
- 不改任何游戏、不改 `src/styles.css`、不改 `src/engine/**`。
- 零外部运行时依赖、零二进制素材；注释无商标。
- 极端输入（size ≤ 0、NaN、未知 pose）不抛异常、不画出 NaN 坐标。

## 验收

- `npm test` 全绿且只增不减；`npm run build` 全绿。
- kit 可被任意游戏直接 import，无循环依赖。
- 宪法负面清单自检通过：朵朵 / 星星非火柴人，金币非纯色圆，A/B 主色断言不相等。
- `git diff --name-only origin/game-1.2...HEAD` 只出现 `src/art/kit/` 下的新文件。

---

## 完整派发提示词（整段复制给子代理）

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-fable-5-thinking-xhigh`。
请在独立功能分支上进行修改，叫 game-1.2-kk。以 origin/game-1.2 为审美对照基线。不要直接修改 main。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生。全部推 `game-1.2-kk`，不回 `main`，禁止 force。本步只改视觉/素材/布局，不改关卡数值与胜负规则。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」（离线可玩的中文儿童小游戏合集 PWA）。
这是 1.3 视觉升级的**第 1 步（共 29 步）**，你是 **A 档：共享角色与道具素材包**。

## 必读文件（动笔前先读完）
- docs/plan-1.3-visual-bible.md —— 视觉宪法，负面清单与 Q 版标准，本步的最高裁量标准。
- .cursor/skills/1.3-visual/character-sprite-maker/SKILL.md —— 借它的动画清单（idle/walk/jump/hurt/win）、
  帧数规划与逐帧质检思维；注意我们不用它的图像生成管线，落地全是 Canvas 2D 矢量代码。
- .cursor/skills/1.3-visual/frontend-design/SKILL.md —— 「拒绝模板脸」的审美方法。
- .cursor/skills/1.3-visual/theme-factory/SKILL.md 与 themes/ —— 调色板方法参考。
- 审美对照基线：origin/game-1.2 上 gold-hook / sling-birds / poop-hero 的现状（火柴人与色块金币长什么样）。

## 分支纪律（先做这一步）
- `git fetch origin game-1.2 game-1.2-kk`，工作分支建立在 `origin/game-1.2-kk` 之上：
  `git checkout -B <你的工作分支> origin/game-1.2-kk`。`origin/game-1.2` 只作审美对照，不在它上面开工。
- 开工前先提交一条 git 记录（写上「1.3 第 1 步 / A · art kit」和你的工作计划），再动代码。
- 全部工作推 `game-1.2-kk`。不要 push 到 `game-1.2`、不要改 main、不要用 gh 开或合 PR。
- 收尾：`git fetch origin game-1.2-kk` → `git rebase origin/game-1.2-kk` → `npm test && npm run build` 全绿
  → `git push origin HEAD:game-1.2-kk`。被拒就再 fetch+rebase 重来，**禁止 force push**。

## 你是谁
A：做第 2–26 步 76 款游戏都会 import 的 **Q 版素材包**。本步**一款游戏都不改**。
同一步 B 在做首页 / 关卡壳 / 结算的布局动效（`src/ui/**` 与 `src/styles.css`），
C 在做跑道 2.5D 套件（`src/art/runner/**`）。**别人的文件一个字都别动。**

## 独占文件（只许新建这些）
- `src/art/kit/palette.ts`、`src/art/kit/chars.ts`、`src/art/kit/props.ts`、`src/art/kit/fx.ts`、
  `src/art/kit/testing.ts`、`src/art/kit/index.ts` 及各自的 `*.test.ts`。

明确不许碰：`src/ui/**`（含 `avatars.ts`，那是 B 的地盘）；`src/styles.css`、`index.html`（B 的）；
`src/art/runner/**`、`src/engine/view25d.ts`（C 的地盘）；任何 `src/games/<id>/` 目录；任何 `meta.ts`。

## 1）`palette.ts` —— 调色板与明暗工具
- 导出 `KIT_PALETTE`：粉彩基础色（背景暖白、草地、天空、糖果粉、柠檬黄、薄荷绿、星光金等，全部 `#rrggbb`）。
- 导出 `CHAR_COLORS`：`duoduo`（朵朵：粉色系花瓣 + 绿叶配饰）与 `xingxing`（星星：金黄星形 + 蓝披风）两组
  `{ primary, secondary, accent, outline }`。**两角色 primary 必须不同色相**（宪法：双人一眼可区分）。
- 导出 `shade(hex, amount)` / `tint(hex, amount)`：给任意合法 `#rrggbb` 推导暗部 / 高光，非法输入原样返回不抛。

## 2）`chars.ts` —— 朵朵 / 星星（这是全项目的脸面，慢慢画）
- 导出：
  `drawDuoduo(ctx, opts)`、`drawXingxing(ctx, opts)`，其中
  `opts: { x; y; size; facing?: "left"|"right"; pose?: "idle"|"run"|"jump"|"hurt"|"win"; t?: number; skin?: KitSkin }`。
  `t` 是 0–1 循环相位：idle 呼吸浮动 ≤ size 的 4%，并按相位**眨眼**（t 落在窄窗口内眼睛闭合）。
- Q 版标准（宪法第三节）：约 2–3 头身；躯干有宽度；至少 底色+暗部+高光 三阶；
  五官至少 眼 + 腮红；剪影特征——朵朵有花瓣头饰，星星有五角星轮廓 + 披风。
- `facing:"left"` 用坐标翻转实现，但配饰位置要正确。
- `hurt`：眩晕圈 + 「><」眼，不出血；`win`：笑 + 手举起。
- `skin` 参数化换色（至少内置 2 套皮肤：默认 + 冬装），换肤只换色组，不改剪影。
- 禁止画成火柴人；禁止照抄任何商业角色剪影（宪法第八节）。

## 3）`props.ts` —— 通用收集物与障碍件
- `drawCoin(ctx, { x, y, r, t? })`：金币必须有 边缘厚度（侧面暗阶）+ 高光斑 + 内圈星形浮雕；
  `t` 驱动缓慢自转（横向压扁模拟）。**不许是一个纯色圆。**
- `drawStar` / `drawHeart` / `drawGem`：同等三阶光影标准。
- `drawSpike(ctx, …)`（圆润尖刺 + 警示色带）、`drawCrate(ctx, …)`（顶面 / 侧面双色阶木箱）。
- `drawShadow(ctx, { x, y, w })`：椭圆落地软阴影，所有会动实体的标配。

## 4）`fx.ts` —— 收集反馈
- `makeCollectBurst({ x, y, reduced })`：返回粒子状态数组与 `step(dt)` / `draw(ctx)`；
  `reduced: true` 时退化为单次淡出（不喷粒子、不震屏）——`prefers-reduced-motion` 的降级路径。
- `drawPlusOne(ctx, { x, y, t, text? })`：+1 飞字（上浮 + 淡出），字号参数下限 14px。
- 纯逻辑 + 绘制分离，方便测试。

## 5）`testing.ts` —— 全项目复用的测试桩
- `makeStubCtx()`：返回记录式 2D context 桩（记录 fill/stroke/arc/path/text 调用次数与最近参数），
  供你自己和**后面 25 个步的素材契约测试**复用。参考 `src/games/gold-hook/domStub.ts` 的写法但更通用。

## 测试（合计 ≥ 42 例，全部用 makeStubCtx，不碰真 DOM）
- `palette.test.ts` ≥ 6：色值全部合法 `#rrggbb`；shade/tint 单调；非法输入不抛；duoduo 与 xingxing 的 primary 不相等。
- `chars.test.ts` ≥ 16：两角色各 pose 都有绘制调用且不抛；idle 相位变化产生不同输出（眨眼窗口）；
  facing 翻转生效；hurt/win 与 idle 的调用序列不同；skin 换色后 fillStyle 集合变化但 path 数不变（剪影不变）；
  size ≤ 0 / NaN 不抛不画 NaN。
- `props.test.ts` ≥ 12：金币绘制调用 ≥ 3 类（体积 + 高光 + 内圈，即非单圆）；r > 0 契约；t 自转改变输出；
  尖刺 / 木箱 / 阴影各有绘制且不抛；极端参数安全。
- `fx.test.ts` ≥ 8：粒子 step 后位置变化且寿命递减；reduced 模式粒子数为 0 且仍有淡出；+1 飞字 t=0 与 t=1 输出不同。

## 不要做什么
- ❌ 改任何游戏、任何 `meta.ts`、任何 `src/ui/**` / `src/engine/**` / `src/styles.css`。
- ❌ 提交 png / jpg / ttf 等二进制；引入任何运行时依赖；用 three.js。
- ❌ 删测试、调低断言；把 kit 写成依赖 DOM 的类。
- ❌ 抄任何商业游戏角色剪影或配色标识；代码注释出现商标（黑名单见 1.2 主管文档第八节）。

## 验收
- `npm test` 全绿，用例总数只增不减；`npm run build` 全绿（tsc 无错）。
- `git diff --name-only origin/game-1.2-kk...HEAD` 只出现 `src/art/kit/` 下你的新文件。
- 逐条对照 docs/plan-1.3-visual-bible.md 第二、三、四节自检并在回复里给出结论。

完成后回复：你是 1.3 第 1 步 A、新建了哪些文件、各文件用例数与总用例数、
宪法自检结论、推到 `origin/game-1.2-kk` 的 SHA、以及**实际使用的模型 slug**。
~~~~
