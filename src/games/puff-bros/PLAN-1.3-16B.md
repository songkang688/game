# 1.3 第 16 步 · B 档 —— puff-bros「噗噗兄弟」视觉升级计划

只动皮肤不动骨头:一行玩法逻辑、一个判定数值、一条关卡数据都不动。
分支 `game-1.3-window5`,基线 `origin/game-1.3`。

## 一、现状审美评测(逐函数,开工前已核实)

| 函数 | 现状结论 |
| --- | --- |
| `render` | 天空 = 章节调色两停线性渐变;远景是 5 朵**定死坐标**的椭圆糖云,零视差;地板 / 浮台是两层纯色平涂;图层序大体健康,但泡泡画在人**上面**(为了裹人),攒气环画在单个角色之后而不是所有角色之上。 |
| `drawBro` | 两兄弟**剪影完全相同**:椭圆身体 + 肚皮椭圆 + 两点眼 + 腮红,唯一区别是 `BROS[pi]` 调色 —— 缩小后分不清谁是谁。身体是 `c.body` + `c.belly` 两层纯色平涂,无渐变、无描边、无 rim light、无落影。 |
| `drawBro` 嘴部三态 | 逻辑很好(`blowCd > 0.24` 吹泡 / `puff.pending` 攒气 / 常态),但画得极简:吹泡就是一个白圆,攒气就是一个椭圆。时序全部保留,只升级画法。 |
| 形变三件套 | `landingSquash`(feel.ts)+ `pushSquish`(push.ts)+ 打转(bounds.ts),909–917 行,是 1.2 调好的手感 —— **原样保住**,本步只在其上叠加皮肤,三个源文件一个字不改。 |
| `drawPuffRing` | 单色 `rgba(150,214,242,.95)` 椭圆描边,透明度 / 线宽随 `windupProgress` 长大 —— 功能对,观感素。升级:彩虹渐变描边 + 内圈星尘 3 颗(reduced 只留渐变描边)。 |
| `drawBubble` | 径向渐变(白→淡蓝/淡粉)+ 2px 描边 + 一颗高光点。没有薄膜质感、没有月牙高光旋转、没有彩虹缘。 |
| `drawCrate` | 平涂圆角矩形 + 十字丝带,无木纹、无角铁。 |
| `drawSpring` | 三朵纯色椭圆云;压缩量读 `gs.recharge / SPRING_RECHARGE`(**继续只读它**),无螺旋圈。 |
| `drawGoo` | 双层纯色椭圆 + 点眼;蹦蹦怪弹簧脚、追追怪小角是好的识别件,但无光泽、无流挂圆珠。 |
| `drawBrittle` | 完好 / 裂纹 / 虚线重生三态齐全,功能表达优先 —— 本步不动它的预警语义,仅保留现状。 |
| `drawUpdraft` | 半透明柱 + 虚线壁 + 4 颗上飘圆点,不是羽毛旋涡。 |
| `drawWarp` | 白泡 + 单色环 + 一条单色旋转弧,不是双色互补旋涡。 |
| `drawClimbLine` | 追命气流线(青色带 + 浪线),是保命提示件,颜色与几何**不动**(runtime12 用例钉着 `126,216,206`)。 |
| `drawTumbleRing` | 打转倒计时环,功能件,不动。 |

## 二、改法(全部程序化绘制,无位图、无运行时新依赖)

1. `visual13.ts`(新):四·补一配色板 token、图层序、四·补三时序常量、
   `broBody(pi)` 共用骨架两套参数(哥哥朵朵:翘呆毛 / 背带裤 / 圆耳朵;
   弟弟星星:圆边小帽 / 围兜波浪边 / 后脑揪揪)、表情参数化、
   天空轮换 `skyForLevel`、击掌 `highFiveFrame`、呆毛摆动 / 星尘 / 视差相位纯函数。
2. `src/art/kit/bubbleSkin.ts`(新 kit 文件,配套单测):泡泡薄膜 —— 径向渐变膜 +
   顶部月牙高光(2400ms/圈,reduced 静止)+ 底部 1px 彩虹缘(半径 < 6px 自动省略);
   拆成 `bubbleFilm` / `bubbleGloss` 两段,裹着东西时先膜 → 再画泡内物 → 再上光,
   薄膜不遮泡内物体。
3. `index.ts` 只动绘制与 CSS:drawBro 走 broBody;箱子木纹 + 角铁;弹簧螺旋圈随压缩变密;
   黏液怪加光泽与流挂圆珠;气流管羽毛旋涡;传送门双色互补旋涡;三套天空按关卡序号轮换 +
   两层软云视差(0.15× / 0.3×);HUD 兄弟头像徽章(小 canvas 程序化绘制)+ 计数卡片化;
   胜利击掌两帧(reduced 静止合影)。图层序调整为规格的 ①–⑧(泡泡在人下、攒气环在人上)。
4. reduced 接线:形变三件套的既有开关照旧;新加的呆毛摆动、云视差、星尘、月牙旋转、
   击掌动画全部并入 —— 且 reduced 下主画布**一次 `ctx.scale` 都不出现**(runtime12 钉着)。
5. 测试只增不减:新增 `visual13.test.ts`(≥ 12 个视觉用例)+ `bubbleSkin.test.ts`;
   既有 `feel / push / bounds / logic / arena / gadgets / updraft / runtime12 / idle` 用例
   一个断言不改。

## 三、红线自查

- 不动:`PUFF_WINDUP`、`PLAYER_W × PLAYER_H`、`blowCd` 时序(0.24 阈值原样)、
  `landingSquash` / `pushSquish` / `tumbleProgress`、存档 key、`meta.ts`、触屏热区。
- 不碰:`ice-fire-forest` / `prince-princess`、1.3 文档、`.cursor/skills/**`、
  `src/art/kit/` 既有文件(palette / volume / outline / sparkle / parallax 等只 import)。
- 不像泡泡龙双龙、不抄马里奥红绿:兄弟走本库粉彩奶油橘(`#F9B97F` / `#FBD3A5`),
  识别靠**形状**(呆毛 vs 帽、背带裤 vs 围兜、耳朵 vs 揪揪),不靠撞色。
