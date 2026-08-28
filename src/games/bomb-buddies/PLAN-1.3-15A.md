# 1.3 第 15 步 · A 档 —— bomb-buddies「泡泡炸弹人」视觉升级计划

只动皮肤不动骨头:`ai.ts` / `logic.ts` / `fingerprints.ts` / `levels.ts` / `meta.ts` 一行不碰,
`dangerTiming` 危险提示时序、格子尺寸、碰撞判定、存档 key 全部原样。

## 现状审美评测(逐行读完 index.ts 后的结论)

1. **双人角色就是两个 emoji**:`P_EMOJI = ["🌸","⭐"]`(102 行),画法是纯色圆 + 两只眼 +
   头顶 `emojiAt(f.emoji)`(907–928 行)。无步态、无埋弹下蹲、无被困表情,朝向也不镜像。
2. **地形三件套是 roundRect 平涂**:硬墙 `palette.wall` 一色到底,上面盖一条 `wallTop` 浅色带
   (770–777 行),没有 2.5D 侧面、没有铆钉;软砖同理(784–790 行),没有砖缝、没有裂纹中间态;
   地板是单色平涂 + 1px 网格线(779–783 行),没有棋盘双色。
3. **门与道具全是 emoji 直出**:门 `emojiAt("🚪")`(792 行)、道具 `ITEM_INFO[kind].emoji`
   (813 行)、砖碎小花 `FLOWER_EMOJI` emoji 池(330 / 1113 行)。一屏自绘元素几乎为零。
4. **泡泡有没有高光**:有,但只有一颗白点(844–848 行 `BUBBLE_SHINE` 小圆),主体是
   `BUBBLE_SKIN` 单色平涂 + 描边 —— 不是三停径向渐变,没有月牙反光,引信没有星火;
   临爆是「描边换色 + 轻微正弦缩放」,不是规格要的爆前 1s ±6% 体积脉动。
5. **爆炸波是不是纯色矩形**:不是纯矩形,但确实是「圆角矩形平涂」两层 ——
   `WAVE_RING` 按格子下标取色平涂一层 + `WAVE_CORE` 白心从中心化开(860–875 行)。
   没有花瓣形、没有沿四臂推进的方向感、没有末端星屑。
6. **dangerTiming 危险格画法自查**:是「描边一圈粉红、越近越亮」——
   `rgba(255,150,190, 0.15 + near*0.55)`,`near = 1 - burn/FUSE_MS`(795–802 行),
   不是平涂变色也不是地板泛红。时序输入是 `dangerTiming(board, world.bombs, world.pierce)`,
   提前量 = 整条引信 FUSE_MS(2000ms)。**升级只换画法(地板泛红呼吸 + 边缘虚线),
   时序输入与归一化公式一个字不改。**

## 改进方案(与 step 规格逐条对齐)

- 新增 `src/art/kit/chibi.ts`(圆头小人参数化,双人共用一份函数)+ 单测;
  已有 kit 文件(palette / volume / outline / sparkle / block25d)只 import 不改。
- 新增 `src/games/bomb-buddies/visual13.ts`:四·补一配色板 token、图层序、
  四·补三动效时序常量、纯函数相位(引信星火 / 临爆脉动 / 涟漪推进 / 危险呼吸 / 裂纹分档)、
  主题映射(花园 / 冰原 / 星空)、门与七件道具的自绘图标、爆炸涟漪账本 `BbBoomFx`。
- `index.ts` 只改绘制段:图层序固定「地板棋盘 → 危险泛红 → 砖墙门(2.5D)→ 道具 →
  泡泡 → 角色 → 涟漪粒子 → HUD」;彻底清掉 🌸⭐🚪 与 `ITEM_INFO[].emoji` 的 fillText;
  HUD 加头像徽章与倒计时圆环。小怪仍走 emoji(不在本步红线清单内)。
- `prefers-reduced-motion`:脉动退化为变色、星火静态、涟漪一次性静态、危险静态变色保留、
  中心白闪保留(功能反馈)。
- 新增视觉用例 ≥ 12 个(`visual13.test.ts` + `chibi.test.ts`),既有玩法测试一个断言不改。
