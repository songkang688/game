# 三办 R4 · 测试修复员 A 记录

基线:`game-1.3`(含管理员门时长/永久 `7b5f9d1e`)。
分支:`cursor/tester-a-ui-fixes-2cfe`,目标合入 `game-1.3`。
方法:真浏览器(Chrome + Playwright 驱动)当小学生玩,两档视口 **390×844 手机竖屏**、**1024×768 平板横屏**;
每屏自动体检(横向溢出 / 按钮出屏 / 热区 <30px / 纵向滚动锁死 / 控制台报错)+ 截图逐张人工过目。

## 测了哪些

### 壳层与管理员门(全过)

- 首页两档视口:能一路划到底,无横向溢出;页签行是可横滑胶囊排(带右缘渐隐提示),不算裁切。
- 管理员门(密码 `kangkang`):弹窗默认选中 **1 小时**;输对后钥匙亮起、
  报「还剩 60 分钟」;进 box-hamster 选关地图 29 个锁定格全部变白底虚线解锁格,
  小字「管理员权限还剩 60 分钟」;改成**永久**后小字变「管理员权限已永久开启」;
  点最后一个解锁格直达第 30 关成功;回首页**关闭管理员权限**后地图 29 格重新上锁、
  「🎫 直达」控件消失。localStorage 只落过期时间,不落密码。

### 28 款逐个进门 + 进关

- **l99 地图类 20 款**(poop-hero / brave-path / adventure-king / ice-fire-forest /
  prince-princess / box-hamster / monster-crisis / bomb-buddies / tank-battle / sky-squad /
  dot-maze / orb-arena / snake-royale / math-farm / word-garden / pinyin-train /
  shape-kingdom / find-diff / clock-house / sudoku-petal):两档视口各跑一遍
  「进第 1 关 → 暂停面板弹出 → 继续玩 → 返回首页」,40 次全过,无控制台报错。
- **canvas 自绘战役 6 款**(garden-guard / ocean-munch / sprout-defense / rainbow-run /
  fruit-slice / sling-birds)+ **candy-swing**:按坐标点进「闯关 → 选章 → 第 1 关」,
  全部能开局,引导文案清晰。
- **双人竖屏 390×844**:冰火森林(双方向键并排 + 换焰焰)、王子公主「两人一起」
  (双 D-pad + 各自攻击键)、豆豆迷宫「双人追逃 / 抢豆对战」(朵朵、星星两套按键并排),
  竖屏下两个人都摸得到自己的键,没有谁玩不了。

## 坏在哪 · 怎么修的

| # | 问题(实测) | 修法 | 文件 |
| --- | --- | --- | --- |
| 1 | `mobileText.test.ts` 基线失败:矮屏媒体查询把 `.l99-jump-note`(管理员剩余时间小字)压到 14px,低于 16px 正文下限 | 矮屏分支抬回 16px,`margin:0` 照留 | `src/games/level99.ts` |
| 2 | 豆豆迷宫进门菜单缩在舞台顶上,下面(手机约半屏、平板约 2/3 屏)是大白底 | `.dmz-wrap` 撑满舞台 flex 列,菜单占满剩余高垂直居中,渐变铺满整卡;游玩视图排布不变 | `src/games/dot-maze/index.ts` |
| 3 | 首页搜索框:胶囊 50px 高,里面输入框只有 25px,点胶囊上下沿不聚焦 | 输入框 `min-height:44px` | `src/ui/home.ts` |
| 4 | 找不同:390×844 与 1024×768 上格子都停在 26px 下限,棋盘四周一大片空——挂载那一刻 `.fdf-panels` 还空着,`.l99-stage` 这类随内容长高的裁切祖先量出的余量小得离谱,`panelCellForRoom()` 被假数据钳死;首帧后只重钳视口、从不回涨 | 新增纯函数 `regrowCellPx()`(只放大不缩小,仍受 44px 上限与真实余量约束),首帧 rAF 里复算、连 grid 模板一起改大再重画;真挤的 360×640 按余量长到 39px,不越界。实测两档视口都回到 44×44 | `src/games/find-diff/runtime.ts`、`index.ts`、`viewportFit.test.ts`(+6 用例)、`toolsReach.test.ts`(守门写法跟改) |
| 5 | 三处按钮矮过热区线、字号低于 14px 控件下限:冰火「↺ 重摆」58×25/13px,王子公主关内暂停钮 30×32/13px,坦克「🗺️ 小地图」70×23/11.5px | 三处都抬到 `min-height:44px`(inline-flex 居中)、字号 14px | `ice-fire-forest`、`prince-princess`、`tank-battle` 各自 `index.ts` |
| 6 | 海底大胃王选章页标题还写着 1.0 的「九大海域」,实际已是十二片海域(12 张章节卡,进门文案也是十二片) | 标题改「十二片海域」 | `src/games/ocean-munch/index.ts` |

修复 4 曾出现一次「测试过了、浏览器里没生效」:`paintAll` 只重填格子内容,
格子盒子尺寸在 `gridTemplateColumns` 模板上——回涨时把模板一起改大才真的变大,已连模板一起修。

## 验证

- `npx tsc --noEmit` 干净;全量 `vitest run`:**1089 文件 / 19246 用例全过**
  (基线上唯一失败的 `.l99-jump-note` 用例已转绿,另新增 6 个回涨用例)。
- 修复 2/4/5 都回到浏览器里复测过截图(dot-maze 两档视口、find-diff 两档视口 44×44、三颗按钮变大后的关内截图)。

## 还剩什么(没动的原因)

- **orb-arena / snake-royale 关内舞台卡底部有一段白**:游玩区、按钮、提示齐全,
  只是壳卡片比内容高;属观感优化,改法与 dot-maze 不同(要动竞技场画布钳高),留给下一轮。
- **garden-guard / ocean-munch 关卡节点图上下留空较多**:canvas 自绘布局按更大章节图设计,
  11 关的小章显得空,不影响操作,未动。
- **章节卡截断名**(「第1章 阳光…」):`mapFit` 量宽截断是上一轮的既定设计,保留。
- 休闲 / 对战 / 动手目录、存档 key、核心数值:一律没碰(独占范围外)。
