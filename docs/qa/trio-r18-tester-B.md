# 三人组 r18 · 测试修复员 B 记录（`cursor/qa-b-tablet-landscape-5f46`）

> 本轮职责：**平板横屏（1024×768 / 1180×820）全量体检 + 关卡排布/玩法合理性**，发现即修。
> 进场基线：`game-1.3` @ `c8a3d154`。注意：进场时主干 `npm test` 有 **5 个红**
> （combo-clash `.cc-info` / mahjong-bloom `.mj-goal` 违反 16px 文字红线），先修红再开工。
> 收尾水位：**1193 文件 / 19488 用例全绿**（1 例既有 skip），`npm run build` 通过。

## 测法

- puppeteer 全量扫描 **76 款**游戏的选关首屏 × 4 视口（1024×768 / 1180×820 / 915×412 / 390×844），
  量地图宽、填充率、网格列数、节点尺寸、舞台滚动差，并整页截图人工复核。
- 关内扫描：进第 1 关后量画布尺寸、可点控件是否掉出视口线（`bottom > vh`）、舞台滚动差。
- 端到端：flight-chess / bowling-lane / memory-cards / alien-seek / dark-chess / junqi-camp /
  gold-hook / lianliankan / merge-2048 九款走「开打第 1 关 → 回地图 → 回首页」，全部 ✓。

## 修了什么

| 编号 | 款/层 | 坏在哪（实测数字） | 怎么修 |
|---|---|---|---|
| B18-0 | combo-clash / mahjong-bloom | 主干基线红：矮横屏把 `.cc-info`/`.mj-goal` 缩到 14px、`.mj-goal` 还 nowrap | 删掉缩字与 nowrap，靠 max-height+overflow 收纳，16px 红线守住 |
| B18-1 | level99 框架 | `.l99-stage` overflow:hidden 把塞不下的内容整块裁掉（飞行棋骰子 886px 完全够不着）；680px 选关地图在 1024/1180 宽白卡里两侧各空 140–165px | 舞台改 **竖向可滚安全网**（无溢出时几何不变）；`.l99-wrap:has(.l99-map)` ≥1000px 放宽到 **820px**，节点 76→91px，列数仍 8 |
| B18-2 | flight-chess | 骰 SVG 只有 viewBox 没内在尺寸，按替换元素默认 300px 解析，**骰子 300×244 盖住棋盘**（各视口皆然）；768/820 高掷骰行沉在 886px | `.fc-dice` 定死 56px 盒（矮档 48px）+ aspect-ratio；501–900 高 `.fc-hud`/`.fc-picker` sticky 钉底,盘面按余高温和收 |
| B18-3 | bowling-lane | 球道按整窗猜高吃满余高，「停!(蓄力)」在 768/844 高被顶出视口 | `layout()` 实测扣除自家 HUD/记分牌/指针/按钮总高（rAF 双拍等换行定型）；≤520 高「停」键 sticky |
| B18-4 | memory-cards | 卡片跟 660px 容器等比放大到 276px 高，平板横屏**后排整行沉出视口** | 按「舞台余高 ÷ 行数」反推卡宽给棋盘限宽，整副牌进一屏；resize 跟随，destroy 摘监听 |
| B18-5 | alien-seek | 平板横屏缩放工具 755、方向盘 831+ 沉出视口；**病根**：无显式行模板时 `grid-row:1/-1` 跨不了隐式行，画布把第 1 行撑高、侧栏整段被推下还被 overflow:hidden 裁掉（412 高找物关缩放/望远镜完全够不着） | 501–900 高新增 C-6 同配方双栏 + **显式行模板** `repeat(4,auto) minmax(0,1fr)`；≤500 找物关放开自钳交给舞台滚动，画布 sticky 钉顶滚动时场景不消失，清单钉回 56px。r11 原块一字未动 |
| B18-6 | bubble-aim | 自定义选关地图挤在 400px 一条（1024 宽两侧各空 ~300px） | 地图态 `.ba-wrap--map` ≥700px 放宽 680/6 列、≥1000px 820px；打泡泡仍 400 竖版。classList→className 拼接（测试桩假元素没有 classList） |
| B18-7 | dark-chess / junqi-camp / gold-hook | 首屏菜单 250–328px 贴白卡顶,**下方 ~60% 全空** | ≥900×620 菜单竖直居中（min-height:calc(100dvh−180px)）+ 模式块 420→560px 2×2、金矿卡片放大;结算面板同类名不受波及（gdh-home 单独挂钩） |
| B18-8 | garden-guard | canvas 首页 300px 入口卡浮在 950px 宽渐变里 | 画布 ≥720px 宽时卡片 300→420px,命中 Rect 与绘制共用热区同步 |

## 顺手修掉的工程性问题

- bowling-lane `extrasHeight()` 原版用 `instanceof HTMLElement`——**测试桩环境没有这个全局，
  引用即炸整关**（idle/destroy 8 个用例红）。改鸭子类型；settle rAF 句柄入 destroy 账；
  注释里的 🎳 触发 emoji 码点水位守卫（基线 47 只降不升），已去掉。
- junqi-camp `round1-packa` 360px 溢出守卫扫全部 `max-width`：430/560 只活在
  `min-width:900px` 媒体块里，360 命中不了，白名单放行并写明理由。

## 复测结论

- 4 视口 × 76 款选关首屏扫描：**0 异常**（地图款 fill 0.8、8 列、节点 ≥76px；自定义首屏逐张截图复核）。
- 关内扫描（改过的五款 × 4 视口）：**无控件掉出视口线**；alien-seek 915×412 方向盘下半段需滚一下
  （找物关直接点画面 + WASD 均可用，属可达）。
- `npm test` 1193 文件全绿；`npm run build` 通过。

## 还剩什么（残留风险）

- **ocean-munch / duo-vs-star** 首屏底部 200–270px 留白：主题化渐变背景读作场景，未动；如嫌空可套 B18-7 的居中配方。
- alien-seek ≤500 高找物关 D-pad 需滚动可达（核心操作不受影响）；线索关 r11 档一字未动。
- `.l99-stage` 竖向可滚是**安全网**：游戏自钳失效时内容至少划得到，但首选还是各游戏把自己钳进屏，后续新游戏别依赖它。
- 未动难度曲线/判定/seed：本轮全部是布局层修复,玩法逻辑零改动。
