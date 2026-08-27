# 1.3 第 26 步 · A 档 —— `color-fun`「涂色小屋」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 26 步 · A 档**：给 `color-fun`「涂色小屋」做只动皮肤不动骨头的美术精修。
本步三人：A `color-fun`、B `music-stars`、C `kitty-care`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「A 档 · color-fun 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/color-fun/**` 里的渲染层（`renderChips` / `renderPalette`、`sandboxUi.ts` 的 `paintAll` / `renderCanvas` / `renderGallery` / `renderPalette` / `renderPicks` / `renderTools`）、CSS、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- 关卡图案数据（`levels.ts` 的 `paints` / `paintSymbol` 的图形定义——那是题目）、按号涂色的判定、沙盒保存 / 画廊数据结构；
- 存档 key、`meta.ts` 的 `modes/levels/category`；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，DOM/SVG/Canvas 程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/color-fun/index.ts` 与 `sandboxUi.ts`、`levels.ts`，渲染入口是 `renderChips` / `renderPalette`（index）与 `paintAll` / `renderCanvas` / `renderGallery` / `renderPicks` / `renderTools`（sandbox）。已核实与预期的问题：

1. 调色盘 `renderPalette` 预期是一排纯色圆钮（自查确认）：颜料没有凸起感、没有选中的蘸取反馈——「涂色」工具本身不好看，涂色的兴致先掉一半；
2. 涂色画布的填充预期是瞬间变色（自查 `renderCanvas` / `paintAll`）：没有颜料铺开的过程感；
3. 「小屋」题材自查：画面有没有画室 / 小屋氛围？预期没有；
4. `renderGallery` 画廊预期是缩略图裸排：没有相框、没有展墙；
5. `renderTools` 工具条与按号提示（数字角标）样式自查，把结论记进开工 commit。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **调色盘实体化（核心）** | 调色盘画成木质椭圆板（木纹 + 拇指孔）；每格颜料改凸起颜料坨：径向渐变（中心亮）+ 顶部高光点 + 底部挤压阴影；选中时颜料坨下沉一点 + 外圈亮环 + 画笔尖蘸上该色（画笔图标跟随当前色）。 |
| **涂色过程感** | 点击区域填色改「颜料涟漪铺开」：从点击点圆形扩散到区域边界（180ms，`clip-path` 或 canvas 渐进填充，**判定与最终色一律不动**）；涂对时区域边缘亮一圈，涂错（按号模式）区域抖一下并弹回原色（既有逻辑保留只换表现）。 |
| **按号提示精修** | 数字角标改成小颜料滴形状（滴内数字 + 对应色描边——数字与颜色双通道）；当前该涂的号在调色盘上呼吸提示（reduced 常亮）。 |
| **画室小屋氛围** | 背景搭画室：墙面淡纹 + 窗（透光斜带）+ 画架（画布放在画架上，木架三脚）+ 地板线；完成的画自动「装裱」进画框。 |
| **画廊展墙** | `renderGallery` 升级为展墙：每幅画配木质相框 + 底部小铭牌（第 N 幅）+ 射灯光晕（顶部渐变）；hover / 点按相框轻微抬起。 |
| **完成仪式** | 一幅涂完：画布闪光扫过一遍（400ms）→ 装裱动画 → 彩纸 + 「挂上展墙」的飞入动画（reduced 直接入列）。 |

- 色板走 `src/art/kit/palette.ts`；相框可复用 `frame.ts`（若 C 档 find-diff 已落）或自建。
- `prefers-reduced-motion`：涟漪铺开、呼吸、闪光、飞入全停，保留静态质感与结果。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：`palette.ts`（粉彩 token 与 `shade`）、`volume.ts`、`outline.ts`、`sparkle.ts`。
- 你需要而 kit 没有的能力（比如 `paintBlob.ts` 颜料坨）：**新增**文件并配套单测，不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看涂色 / 按号填色页面，**只学两件事：画面密度（画室氛围层）与工具剪影（颜料 / 画笔一眼分清）**。
- 禁止抄任何商标与官方素材：涂色底图全部用本库 `levels.ts` 既有图案，不引入 IP 线稿。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：**涂色区域点击热区一个像素都不动**；
- 调色盘横排放不下时改两行或可横滑，颜料坨直径 ≥ 36px（手指友好）；
- 数字角标最小 12px 可读；工具条不遮画布。

## 八、独占文件与冲突

只许改 `src/games/color-fun/**` 与新增 `src/art/kit/` 文件。不要碰 `music-stars` / `kitty-care`。CSS 前缀沿用本款既有前缀；`destroy` 清干净涟漪与飞入计时。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- `levels.ts` 图案数据换肤前后一致（快照断言，题目钉死）；
- 颜料坨样式含渐变非平涂（遍历断言）；
- 涟漪铺开只是过渡、最终填充色 = 逻辑色（断言）；
- 数字角标色与目标色对应（双通道断言）；
- 画廊数据结构不变、相框只是壳（回归断言）；reduced 下动画不启用；
- `destroy` 归零；既有判定与保存测试断言一个不许改。

## 十、分级红线与回复

涂错只是弹回不批评；失败只鼓励；无商标。完成后回复：你是 1.3 第 26 步 A 档、`color-fun`；第三节的现状结论；调色盘实体化与涂色过程感的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
