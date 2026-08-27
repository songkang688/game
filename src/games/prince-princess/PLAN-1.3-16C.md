# 1.3 第 16 步 · C 档 —— prince-princess「王子公主大冒险」视觉升级计划

只动皮肤不动骨头:平台判定、推箱逻辑、攻击窗口 `attackT`、无敌闪烁时序、
`HERO_W / HERO_H` 判定盒、存档 key、`meta.ts`、关卡数据一行不碰。

## 一、现状审美评测(开工前逐个函数核实的结论)

| 函数 | 现状结论 |
| --- | --- |
| `drawHero`(834 行起) | 剪影方向对(王子圆角矩形上衣 / 公主梯形裙,860–871 行),但精度太低:服装是一块纯色几何,无衣褶、无花纹、无渐变、无腿部剪影;贵气为零。 |
| 皇冠 / 头饰(886–894 行) | 皇冠是一条 5 点折线描不出实体,无宝石;公主头饰只是一个圆,连蝴蝶结都算不上。 |
| 武器(915–933 行) | 剑 = 两个 `roundRect` 拼的,无护手无剑脊;魔杖 = 一条线,挥动时贴一个 ⭐ emoji `fillText` —— 全款最敷衍的部件,必须清掉。 |
| 披风 / 裙摆(850–856 行) | 只有一层 `cloakDark` 纯色,无内外双层、无飘动。 |
| 脸部(897–907 行) | 眼睛 + 腮红笑弧底子可以,**保住不动**。 |
| `drawParallax`(1226 行起) | 三层圆角块 + 三角顶的抽象远景,跟着章节调色板走,没有任何「城堡」identity,无塔楼、无旗帜、无灌木。 |
| `drawPushCrate`(360 行起) | 平涂 + 虚线圈,功能语义在,但无木纹、无角铁,像纸盒不像重箱。 |
| `drawHazardSpikes`(298 行起) | 尖角三角合规但过于生硬;无警示条纹底座。 |
| `drawHazardMark`(324 行起) | 功能件,形状与配色保住;但图层偏低(断口标记画在地面层),要提到最顶。 |
| `drawRewardGem`(380 行起) | 平面菱形 + 固定透明度光圈,无切面、无呼吸。 |
| `drawExitArch`(405 行起) | 平涂拱门 + 🔒/🚪 emoji,无花藤、无门内暖光。 |
| `drawCheckpointFlag`(433 行起) | 静态三角旗,不飘。 |
| `drawStandSlab`(339 行起) | 照元素规范表画,亮顶边语义清楚,保持。 |

## 二、改造方案(对应规格四·补一/二/三)

1. 新增 `src/art/kit/star.ts`:参数化五角星路径(5 齿 72°)+ 单测 —— 魔杖星头、
   裙面星纹、友方星弹、克制提示的 ⭐ emoji 全部换成它。
2. 新增 `src/games/prince-princess/visual13.ts`:
   - 四·补一配色板 token(`ppPrince/ppPrincess/ppLining/ppGold/ppRuby/ppCastleFar/ppCastleMid/ppShadow`)与九层图层序常量;
   - 四·补三动效时序常量(披风 340ms 2 帧 / 刃光 1 帧 / 星尘 5 颗 400ms / 宝石呼吸 2000ms / 旗 900ms 2 帧 / 击掌 600ms);
   - 纯函数相位(`capePhase/flagWavePhase/gemGlowAlpha/invulnBlink/bladeFlashOn/headwearDetail`),
     全部「毫秒 + reduced 进、相位出」,不持有玩法状态;
   - 双角色剪影路径(`princeSilhouette/princessSilhouette`)与识别件几何
     (`crownPath/bowShape/skirtLining/buttonPoints/shawlPath/skirtStars`);
   - `PcpFx` 渲染侧小账本:星尘轨迹 + 通关击掌彩纸,只读事件,不写回 World。
3. `index.ts` 重绘:双角色(立领双排扣肩章腰带 / 双层裙星纹披纱 / 双层披风 /
   三齿皇冠红宝石 / 蝶结小冠 / 刘海分缝与长发侧束)、武器(渐变剑刃护手弧柄尾圆珠 +
   自绘星头魔杖)、城堡两层塔楼视差 + 旗帜 + 灌木、圆头软刺 + 警示条纹底座、
   切面宝石呼吸微光、木纹角铁箱、花藤暖光拱门、飘动存档旗;危险标记提到最顶层;
   HUD 双人徽章 + 宝石卡片化;reduced 全接线。
4. 新增 `visual13.test.ts` ≥ 12 个视觉用例 + `star.test.ts`;既有玩法测试一个断言不改。

## 三、红线自查承诺

- `attackT` / 无敌时序只读;闪烁只把提亮色换成主色 +40%,节拍照旧;
- 尖刺危险语义靠「警示条纹底座 + `drawHazardMark` 最顶层」双保险;
- 6px 以下头饰退化为纯色块但形状保留;
- 全程程序化绘制,零运行时新依赖、零位图;
- 不碰 `ice-fire-forest` / `puff-bros` 与别人的 kit 文件。
