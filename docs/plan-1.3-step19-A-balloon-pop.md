# 1.3 第 19 步 · A 档 —— `balloon-pop`「气球砰砰」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 19 步 · A 档**：给 `balloon-pop`「气球砰砰」做只动皮肤不动骨头的美术精修。主管点名：**气球不能是平涂圆**——本款是重点整改对象。
本步三人：A `balloon-pop`、B `bubble-pop`、C `bubble-aim`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「A 档 · balloon-pop 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/balloon-pop/**` 里的 `paintBalloon` / `confetti` / CSS 字符串、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- 上升速度 / 风力 `AirCfg`、连锁规则 `chainOk`、目标判定、`dataset` 状态镜像（自动冒烟脚本靠它）、`aria-label` 的语义信息；
- 存档 key、`meta.ts` 的 `modes/levels/category`；关卡表 `LEVELS`；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，DOM 游戏用 CSS/SVG 程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/balloon-pop/index.ts`，气球出自 `paintBalloon`（约 141 行起）与 CSS `blp-balloon`（98 行）。已核实的问题：

1. **气球就是一块平涂色**：`node.style.background = BALLOON_COLORS[b.color].css`（151 行）铺在 `border-radius: 50% 50% 46% 46%` 的 DOM 按钮上——没有高光、没有体积、没有气球结，是主管点名的「平涂圆」原型标本；
2. 气球线是 `::after` 的一根 2px 灰竖线（99 行）——真气球线该有一点垂坠弧度；
3. 特殊气球（铁壳 / 双子 / 礼物）全靠 `box-shadow` 光圈区分（102–105 行），本体画法与普通气球完全一样；
4. 远景气球只有 `filter: saturate(.8) brightness(1.06)`（104 行）+ 缩小，几乎看不出「远」；
5. 爆炸是 `blp-pop` 单个缩放动画 + `confetti` 方块粒子（176–192 行），没有「橡皮裂片」的爆感；数字 / 算式模式的文字排版（15px 挤在气球上）也要自查，把结论记进开工 commit。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **气球体积（核心整改）** | 背景改三层 CSS 渐变叠加：`radial-gradient` 左上 25% 处白高光（60% → 0 透明）+ 主体色 `radial-gradient`（中心亮 8% → 边缘暗 12%）+ 右下反光弱斑；加 `::before` 椭圆光泽条（白 35%、blur 1px、旋转 -20°）；底部加气球结（小三角 SVG 或 `clip-path`）。**任何状态下不许出现纯色平涂气球。** |
| **气球线** | 直线改二次贝塞尔垂坠弧（内联 SVG path，随风向常量弯向一侧——读既有 `wind` 只做映射）。 |
| **特殊气球本体差异** | 铁壳气球：本体加金属灰纵向条纹 + 铆钉两点（光圈保留）；双子气球：两球相贴 + 连结丝带；礼物气球：下挂小礼盒（缎带 + 摆动 ±3°）。色觉双通道（颜色 + 图案）的既有设计保住并加强。 |
| **远近纵深** | 远景气球加 `blur(0.6px)` + 缩小 + 上升速度视差（速度是逻辑值不动，视觉加轻微摆动幅度差）；天空背景加两层软云（CSS 渐变椭圆，缓慢平移，reduced 静止）。 |
| **爆炸升级** | 三阶段：鼓胀 1.15 倍（60ms）→ 白闪一帧 → 5 片橡皮裂片（同色小月牙形，放射抛物线 + 旋转，320ms 渐隐）+ 既有 confetti 保留但改成星星 / 圆点混合；礼物气球爆开时礼盒缓落。reduced：只留缩放消失。 |
| **布局与 HUD** | 目标提示（颜色 / 数字 / 顺序）卡片化置顶；夜间关（`night`）加月亮与星子两层装饰。 |

- 色板走 `src/art/kit/palette.ts` token；渐变写成共享 CSS 自定义属性方便三款泡泡 / 气球游戏对齐。
- `prefers-reduced-motion`：摆动、云移、裂片全停，保留静态渐变体积。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：`palette.ts`（粉彩 token 与 `shade`）、`volume.ts`、`outline.ts`、`sparkle.ts`。
- DOM 气球的渐变叠层若做成可复用函数，**新增** `src/art/kit/balloonSkin.ts`（输入主色输出 background 字符串）并配套单测；不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看戳气球页面，**只学两件事：画面密度（天空装饰与气球群排布）与剪影（特殊气球一眼分清）**。
- 禁止抄任何商标与官方角色；戳破永远是「彩纸 + 星星」，无惊吓表达。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：**气球按钮热区尺寸一个像素都不动**（56×68 与 far 缩放沿用）；
- 渐变体积在 far 小尺寸下仍成立（高光斑等比缩）；
- 数字 / 算式文字与高光斑不打架（文字置于高光下方）；HUD 字号 ≥ 14px。

## 八、独占文件与冲突

只许改 `src/games/balloon-pop/**` 与新增 `src/art/kit/` 文件。不要碰 `bubble-pop` / `bubble-aim`。CSS 类名沿用 `blp-` 前缀；`destroy` 清干净裂片节点与计时（沿用 `Janitor`）。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- `balloonSkin`（或等价函数）输出包含至少两层 `radial-gradient`（平涂检查的机器化断言）；
- 每种颜色气球的 background 都不是单一纯色（遍历 `BALLOON_COLORS` 断言含 `gradient`）；
- 特殊气球三种本体差异层存在性断言（条纹 / 丝带 / 礼盒）；
- `dataset` 镜像与 `aria-label` 在换肤后原样（回归断言）；
- 裂片粒子数量与寿命上限一测、reduced 下为 0；
- `Janitor` 清理后无残留节点；既有玩法测试断言一个不许改。

## 十、分级红线与回复

无惊吓、无伤害；失败只鼓励；无商标。完成后回复：你是 1.3 第 19 步 A 档、`balloon-pop`；第三节的现状结论；三层渐变体积与爆炸三阶段的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
