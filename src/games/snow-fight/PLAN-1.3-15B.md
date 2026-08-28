# 1.3 第 15 步 · B 档 —— snow-fight「雪球大作战」视觉升级计划

只动皮肤不动骨头：`physics.ts` / `throw12.ts` / `wind12`（brains 的风读数）/ `covers12.ts` /
`brains.ts` / `economy.ts` / `snowman.ts` / `arena.ts` / `levels.ts` / `meta.ts` 一个数都不动。
判定半径 `BODY_R_12`、`CROUCH_SCALE`、蓄力 `CHARGE_MAX`、风力映射全部只读。

## 一、现状审美评测（逐函数结论）

- **drawFighter（index.ts 约 522 行起）**：站立态是「圆角矩形躯干 + 肉色圆头 + 两粒点眼 +
  头顶 emoji 标记」，没有帽子 / 围巾 / 手套，没有投掷手臂——蓄力、出手、收势全程一个姿势，
  只有头顶蓄力条在动；下蹲 = 半径缩放（`full * CROUCH_SCALE + full * 0.25`），姿态无变化。
- **变雪人惩罚态（534 行起）**：两个白圆叠放 + 一根胡萝卜（#f2954f 三角），
  没有树枝手、没有纽扣、没有表情，解冻倒计时是一个描边圆弧——「变雪人」的喜感全靠脑补。
- **站位光圈（529–532 行）**：`rgba(255,214,120,α)` 的黄色正弦椭圆，暖黄配雪地违和，
  像 debug 热区标记，不像雪面压痕。
- **drawSky / drawBackdrop / drawGround**：好底子——八章八个天色渐变 + 极光带 +
  时间驱动的飘雪（无状态、暂停不闪）；远景有雪丘弧 + 单色松树（#cbdcec 一层，无纵深层次）；
  地面逐格画积雪厚度（功能佳）。不足：雪面无雪丘高光斑、无脚印、松树只有一层没有视差，
  雪的「蓬松感」缺失；飘雪画在天空层（最底），数量最多 52 颗无上限约定。
- **drawBall（635 行起）**：纯白圆 + 1.2px 蓝描边 + 一道 `|cos|` 转纹 + 速度方向拖尾。
  无体积渐变、无底部冷阴影，逆光看是一张白纸片。
- **drawLanding（610 行起）**：粉色虚线椭圆 + 16% 粉色填充，是「圈」不是「雪面凹陷」，
  与雪地语境脱节（时序与半径映射是承诺，必须原样保留）。
- **drawCover / drawFort**：雪墙是平涂白块 + 裂纹横线三阶段（逻辑对，观感平）；
  木箱平涂 + 交叉线；雪坡平涂三角 + ⛰️ emoji；雪堡是多边形 + 🏰 emoji——
  emoji 素材与手绘层次不符。
- **drawChargeBar / drawWindFlag / drawAimArrow**：功能全对（映射必须一字不动），
  但蓄力是普通进度条、风旗只有文字 + 一根箭头线、瞄准是实线——都缺「雪」的表达。

## 二、改造方案（对齐 step 正文四·补一/二/三）

1. `visual13.ts`：配色板 SNF_PALETTE（sfSnow/sfSnowLit/sfShadow/sfPineFar/sfPineNear/
   sfPink/sfBlue/sfCarrot/sfFort）、图层序 ①天空→⑨HUD、动效时序表（围巾 240ms /
   溅雪 320ms / 脚印 2s / 飘雪上限 24）、只读映射（三帧相位读蓄力、蓄力雪球读
   chargeRatio、融化高光读 freezeRatio、落点样式与风旗长度对齐旧公式）。
2. `src/art/kit/snow.ts`（kit 新增，归本格）：飘雪场（上限 24、确定性、可清空）、
   脚印淡痕（2s 渐隐）、溅雪 6 瓣 / 出手雪粉 4 颗，配套单测。
3. `paint13.ts`：角色七道工序（冷蓝落影→主体三停渐变→针织帽→围巾两段→连指手套三帧→
   表情→雪面压痕环）、雪人三件套 + 融化高光、雪球三停渐变 + 双滚纹、堆雪墙 / 木箱 /
   雪坡 / 雪堡重绘（耗损读既有 hp）、蓄力雪球从小滚大、风旗两帧波浪、瞄准渐隐点阵。
4. `index.ts` 接线：图层序重排（功能件永远最顶）、fx 状态（destroy 清干净）、
   reduced 全接线（飘雪 0 / 围巾静止 / 滚纹静止 / 融化高光保留）、对战比分卡片化、
   胜利结算撒雪花 + 彩带（sparkle.ts）。
5. `visual13.test.ts`：≥12 个视觉用例（配色对表 / 只读断言 / domStub 桩上七道工序 /
   destroy 归零 / reduced 降级）。

## 三、红线自查

- 既有 `physics.test.ts` / `throw12.test.ts` / `snowman.test.ts` 断言一个不改；
- `src/art/kit/` 已有文件（palette/volume/outline/sparkle/parallax/carnival/block25d）只 import 不改；
- 雪地阴影一律冷蓝 `rgba(120,150,200,.18)`，禁黑影；
- 中弹 = 「噗的一声变雪人」，雪人必须在笑；
- 别人的目录（bomb-buddies / bumper-cars / bowling-lane 等）一个字不碰。
