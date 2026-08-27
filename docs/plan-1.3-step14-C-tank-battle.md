# 1.3 第 14 步 · C 档 —— `tank-battle`「铁皮坦克大战」视觉升级

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：claude-fable-5-thinking-xhigh。
请在独立功能分支上进行修改，叫 game-1.2-kk 视觉升级。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2-kk`，不要改 `main`，不要 force。本步**只改视觉表现**，一行玩法逻辑、一个判定数值、一条关卡数据都不许动。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.3 视觉升级（共 29 步）第 14 步 · C 档**：给 `tank-battle`「铁皮坦克大战」做只动皮肤不动骨头的美术精修。主管点名本款要**尽量做出 2.5D 观感**。
本步三人：A `shoot-range`、B `sky-squad`、C `tank-battle`。别人的目录你一个字都不许碰。

## 一、任务定位与分支纪律

- `git fetch origin game-1.2-kk`；远端已有就基于它建工作区，没有就 `git fetch origin game-1.2` 后从 `origin/game-1.2` 建出 `game-1.2-kk`。
- **动代码前先提交一条「C 档 · tank-battle 视觉升级计划」的 commit**。
- 收尾：fetch → rebase（保留别人的文件，尤其 `docs/plan-1.3-supervisor.md`、`index.md`、`step1-*` 到 `step13-*`、`.cursor/skills/**`）→ `npm test` 与 `npm run build` 全绿 → 普通 push `origin game-1.2-kk`。
- **禁止 force、不改 `main`、不推 `game-1.2`、不用 `gh` 开 PR。**

## 二、视觉红线：什么能动、什么不能动

**能动的**：
- `src/games/tank-battle/**` 里的绘制函数、CSS、颜色 / 尺寸 / 动画时长常量、新增纯视觉模块；
- `src/art/kit/` 里**新增**你自己的文件（见第五节）；
- 本款的视觉测试（只增不减）。

**不能动的**：
- `ai12.ts` / `ballistics12.ts` / `maps12.ts` / `terrain12.ts` / `logic.ts` 的 AI、弹道、地图、地形逻辑；后坐力像素函数 `recoilPixels` 的输入输出、`MUZZLE_WINDUP` 前摇时长——1.2 刚调好的手感一个数都不许动；
- 存档 key、`meta.ts` 的 `modes/levels/category`；`TANK_HALF` 判定半径；
- 别人的游戏目录与 1.3 文档、`.cursor/skills/**`；
- 严禁引入运行时依赖与位图大文件，全部程序化绘制。

## 三、现状审美评测（先开代码再动笔）

打开 `src/games/tank-battle/index.ts`，绘制入口是 `drawWorld` / `drawTank` / `drawBrick` / `drawSteel` / `drawGrass` / `drawIce` / `drawWater` / `drawBase` / `drawMinimap` / `drawRebuilding`。已核实的问题：

1. `drawTank`（约 327 行起）的车 = 一层 25% 黑底垫「厚度」+ 两条轮带 `roundRect` + 车身 `roundRect` + 炮管 `roundRect`，全部平涂，没有炮塔、没有顶面 / 侧面之分，「铁皮」的金属感一点没有；
2. 车顶直接 `fillText` 一个 emoji（我方 🌸⭐，敌方 `KIND_FACE` 的 🚜 等，366–374 行）——阵营识别靠系统 emoji，字体不同的机器上大小溢出都不可控；
3. `drawRebuilding`（391 行起）的散架动画就是把 🔩⚙️🔧🛞🧰 五个 emoji 撒出去再收回来，「零件」是文字不是画；
4. 护甲提示是一个 12% 半径的白点（376–381 行），远看像渲染 bug；
5. 地形四件套 `drawBrick` / `drawSteel` / `drawGrass` / `drawIce` / `drawWater` 与基地 `drawBase` 逐个打开自查：预期是平涂格子，把每种的问题记进开工 commit。

## 四、极高质量改进方案（绘制规格）

| 项 | 规格 |
| --- | --- |
| **2.5D 掀顶视角** | 车体改「顶面 + 右侧面」双色伪立体：顶面主色、右侧面 `shade(-22)`、侧面高度 = 0.18 × 车宽；地形块同规格（砖墙顶面亮、右侧面暗），全图统一右下投影 2px。这一层只改画法，格子坐标与判定完全不动。 |
| **坦克建模** | 履带改齿状（每 0.2s 滚动一格齿纹，倒车反向）；炮塔独立圆壳 + 舱盖圆点，炮管加根部套环与口部高光；车身加阵营徽章**自绘**（朵朵 = 五瓣小花矢量、星星 = 五角星矢量、敌方 = 齿轮 / 铆钉图案），彻底替换 emoji `fillText`；开火后坐力沿用 `recoilPixels`，只给炮口加两帧十字闪光。 |
| **散架与重生** | 🔩⚙️ emoji 替换为自绘零件（齿轮 / 弹簧 / 履带片矢量小图），散开用同样的时间参数；重生点加旋转光环 + 进度环（读已有 `REBUILD_SECONDS`，不改）。 |
| **地形质感** | 砖墙画 2×2 砖缝 + 顶亮边；钢块加对角高光与铆钉四点；草丛画三簇叠层（坦克可藏其下的半透明关系不变）；冰面加斜向高光扫条与细裂纹；水面两帧波纹渐变滚动；基地画成星星堡垒（旗帜 + 围栏）。 |
| **护盾与状态** | 护甲点改成小盾牌图标（自绘、金边）；护盾圈加六边形网纹渐隐；被击中的顿帧只做视觉白闪 2 帧（不改逻辑时序）。 |
| **布局与小地图** | `drawMinimap` 加圆角壳、我方 / 敌方 / 基地三色图例点；HUD（生命 / 关卡 / 剩余敌人）卡片化一行排布。 |

- 渐变 / 描边 / 投影统一走 `src/art/kit/`；光源统一左上 45°，侧面固定画在右与下。
- `prefers-reduced-motion`：履带滚动、水面波纹、光环旋转全停，保留静态双面色。

## 五、共享美术套件 src/art/kit/

- 先看 `src/art/kit/` 是否已有别人落的文件；**已有的只 import 不修改**。
- 套件约定接口（谁先用到谁新增，一个文件只归一个人）：
  - `palette.ts`：粉彩主色 token 与 `shade(hex, ±n)`；
  - `volume.ts`：`ballGradient` 三停径向渐变、`softShadow` 椭圆落影；
  - `outline.ts`：统一 1.5–2px 深 20% 描边；
  - `sparkle.ts`：星屑 / 彩纸粒子。
- 2.5D 双面块若 kit 还没有，可**新增** `src/art/kit/block25d.ts`（`topSideBlock(ctx, x, y, w, h, base, sideRatio)`）并配套单测，供后续别款复用；不改别人的文件。

## 六、参考与禁抄

- 可以打开 4399 等小游戏站看坦克 / 迷宫射击页面，**只学两件事：画面密度（地形装饰层次）与车体剪影（阵营一眼分清）**。
- 禁止抄任何商标与官方素材：不准像「坦克大战（Battle City）」原版像素车与老鹰基地，徽章 / 配色必须回到本库粉彩原创；无军事写实、无火焰灼烧尸体。
- 竞品截图不进仓库；报告里引用竞品只写文字结论。

## 七、手机 360px 布局

- 360px 宽实测：双面伪立体不造成格子视觉溢出（侧面画进本格 s×s 内）；
- 阵营徽章最小 8px 仍可分辨（形状差异 + 颜色差异双通道）；
- 小地图与 HUD 不叠、不挡出生点；触屏方向盘皮肤可精修但热区尺寸不动。

## 八、独占文件与冲突

只许改 `src/games/tank-battle/**` 与新增 `src/art/kit/` 文件。不要碰 `shoot-range` / `sky-squad`。CSS 前缀沿用本款既有前缀；`destroy` 清干净新加的动画计时与粒子。

## 九、测试（只增不减，新增 ≥ 10 个视觉用例）

- `block25d` 的顶 / 侧色计算与 sideRatio 一测；
- 徽章矢量函数（花 / 星 / 齿轮）可调用不抛错且不再包含 emoji 字符串；
- 履带齿相位随距离推进、倒车反向一测；
- 散架零件为自绘路径（断言绘制分支不再 `fillText` 🔩）；
- `prefers-reduced-motion` 下动画相位冻结；
- `destroy` 归零；既有 `ballistics12.test.ts` / `ai12.test.ts` 等断言一个不许改。

## 十、分级红线与回复

无血、无伤害描写（坦克被击中是「散架重组」）；失败只鼓励；无商标、不像 Battle City。完成后回复：你是 1.3 第 14 步 C 档、`tank-battle`；第三节每个函数的现状结论；2.5D 双面块与徽章替换 emoji 的实现说明；新增用例数与 `npm test`、`npm run build` 结果；提交 SHA；**实际使用的模型 slug**。
