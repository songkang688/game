# 1.3 第 26 步 · B 档 —— `music-stars`「音乐星星」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 26 步 · B 档**：给 `music-stars`「音乐星星」做只动皮肤不动骨头的美术精修。
本步三人：A `color-fun`、B `music-stars`、C `kitty-care`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「B 档 · music-stars 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/music-stars/**` 里的渲染层（`renderDots`、`ui.ts` 的 `renderScore`、`advanced.ts` 的 `paintScore` / `renderDots` / `renderIntervalChoices`、`sandboxUi.ts` 的 `renderClips`）、CSS/SVG、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- 音高 / 节奏判定、音频合成与播放接线、音程题目数据（`renderIntervalChoices` 背后的乐理——**乐理正确性是教育红线**）、录音片段数据结构；
- 存档 key、`meta.ts` 的 `modes/levels/category`；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，DOM/SVG 程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/music-stars/index.ts`、`ui.ts`、`advanced.ts`、`sandboxUi.ts`，渲染入口是 `renderDots`（两处）/ `renderScore` / `paintScore` / `renderIntervalChoices` / `renderClips`。已核实与预期的问题：

1. `renderDots` 的音符点预期是纯色 DOM 圆点（自查确认）——「音乐星星」的音符不是星星，也没有发光、没有节奏脉动；
2. 键盘 / 打击垫预期是纯色块按钮（自查确认）：按下无按键下沉、无发声光效——音乐游戏的「按下去有回响」的感觉没有；
3. `renderScore` / `paintScore` 乐谱区预期是简单线格：五线谱有没有画、谱号有没有、音符在谱上的位置可视化程度自查；
4. `renderIntervalChoices` 音程选项预期是文本按钮；
5. `renderClips` 沙盒录音片段列表预期是裸列表，把全部结论记进开工 commit。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **音符星星化（核心）** | 音符点升级为发光五角星：星形 SVG + 径向光晕（音高越高星越亮、色相沿音阶渐变——do 红到 si 紫的彩虹音阶助记，**音高数据不动**只做映射）；当前拍的星星脉动放大 1.15（随节拍，读既有节拍时钟，reduced 常亮）。 |
| **星空五线谱** | 乐谱区改夜空舞台：深蓝渐变底 + 五线谱线画成星轨细线（微微发光）+ 谱号用星座连线风格描绘；音符星星落在正确线间位置（**位置由既有音高数据决定**）。 |
| **键盘果冻化** | 键 / 打击垫改果冻质感（渐变 + 高光 + 2px 描边）；按下：下沉 3px + 键顶发光 + 从键上升起一颗小音符星（400ms 渐隐，reduced 只发光）；每个键的颜色与音阶彩虹一致（颜色 + 位置双通道）。 |
| **节奏可视化** | 击中节拍：星星炸成音波环两圈（同心圆扩散 240ms）；连击时背景星空渐亮 + 流星一条（reduced 关）；miss 时星星轻轻眨眼（不批评）。 |
| **音程选项与录音片段** | `renderIntervalChoices` 选项做成琴键小卡（含音程名 + 上下两星示意距离）；`renderClips` 片段做成音符胶带条（波形微缩示意 + 播放按钮圆钮）。 |
| **布局与结算** | 分数 / 连击卡片化；结算时整片星空点亮 + 星座连线把本局击中的音符连成一笔画（纯装饰）。 |

- 色板走 `src/art/kit/palette.ts`；星形与光晕可复用 `star.ts`（若 prince-princess 档已落）或自建。
- `prefers-reduced-motion`：脉动、音波环、流星、星座连线动画全停，保留静态发光与彩虹映射。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：`palette.ts`（粉彩 token 与 `shade`）、`volume.ts`、`outline.ts`、`sparkle.ts`。
- 你需要而 kit 没有的能力（比如 `glowStar.ts` 发光星）：**新增**文件并配套单测，不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看音乐节奏页面，**只学两件事：画面密度（星空舞台层）与拍点剪影（该按哪儿一眼分清）**。
- 禁止抄任何商标与官方素材：不准像节奏大师 / 钢琴块的具体皮肤；无版权曲谱风险（沿用本库既有音序数据）。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：**键位热区与判定窗口一个像素都不动**；
- 星星音符最小 14px 可辨；五线谱线距 ≥ 8px；
- 音程选项卡高度 ≥ 44px；字号 ≥ 14px。

## 八、独占文件与冲突

只许改 `src/games/music-stars/**` 与新增 `src/art/kit/` 文件。不要碰 `color-fun` / `kitty-care`。CSS 前缀沿用本款既有前缀；`destroy` 清干净音波环与流星计时。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- 音高 → 色相映射单调（do 到 si 七点断言，音高数据不变）；
- 音符星星的谱面位置 = 音高数据位置（抽 5 音断言，乐理钉死）；
- 键按下走发光分支且热区不变；
- 音波环 / 流星在 reduced 下为 0；
- 音程选项文本与题目数据一致（回归断言）；
- `destroy` 归零；既有判定与音频测试断言一个不许改。

## 十、分级红线与回复

miss 只是眨眼不批评；失败只鼓励；无商标。完成后回复：你是 1.3 第 26 步 B 档、`music-stars`；第三节的现状结论；音符星星化与星空五线谱的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
