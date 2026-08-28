# 1.3 第 14 步 · C 档 —— tank-battle「铁皮坦克大战」视觉升级计划

> 只动皮肤不动骨头:一行玩法逻辑、一个判定数值、一条关卡数据都不动。
> 分支 `game-1.3-window5`,基线 `origin/game-1.3`。主管点名本款要尽量做出 2.5D 观感。

## 一、现状审美评测(已逐个函数打开核实)

| 函数 | 现状问题 |
| --- | --- |
| `drawTank`(327 行起) | 车 = 25% 黑底垫「厚度」+ 两条 `roundRect` 轮带 + `roundRect` 车身 + `roundRect` 炮管,全部平涂;没有炮塔、没有顶面/侧面之分,「铁皮」的金属感为零。 |
| 车顶徽章(366–374 行) | 直接 `fillText` 一个 emoji(我方 🌸⭐,敌方 `KIND_FACE` 的 💨🛡💥🕵 兜底 🚜)——阵营识别靠系统字体,不同机器上大小与基线都不可控。 |
| `drawRebuilding`(391 行起) | 散架动画 = 把 🔩⚙️🔧🛞🧰 五个 emoji 撒出去再收回来;「零件」是文字不是画;进度弧是一根裸白线。 |
| 护甲提示(376–381 行) | 一个 12% 半径的白点,远看像渲染 bug。 |
| `drawBrick`(204 行) | 四分之一块平涂两档橙(#c1714a/#cf8358)+ 每块一条白缝;没有顶亮边、没有侧面、没有投影,像贴纸。 |
| `drawSteel`(226 行) | 平涂灰圆角矩形 + 四颗深灰点;没有对角高光,铆钉没有立体感。 |
| `drawWater`(244 行) | 平涂蓝 + 两条正弦线连续飘;没有渐变、不是两帧交替,reduced 下也停不下来。 |
| `drawIce`(259 行) | 平涂浅蓝 + 两道死板斜线;没有高光扫条、没有细裂纹。 |
| `drawGrass`(273 行) | 一块圆角矩形 + 三颗椭圆,单层;半透明关系(GRASS_ALPHA)本身是对的,要保留。 |
| `drawBase`(291 行) | 奶油底 + 一颗橙星,没有「堡垒」感:无旗帜、无围栏、无双面块。 |
| `drawWorld`(452 行) | 地面是深灰泥浆色棋盘(#6b675e/#75705f/#6d6959),和全库粉彩审美脱节;粒子层 🌼💨✨🧱✳️ 全是 emoji `fillText`。 |
| `drawMinimap`(534 行) | 裸 `fillRect` 平铺,无圆角壳、无图例。 |

## 二、改造方案(只改画法,格子坐标与判定不动)

1. **配色板与图层序常量块**:`src/art/kit/palette.ts`(粉彩 token + `shade(hex,±n)`)+ 本款 `visual13.ts` 落 `tkGround/tkBrick/.../tkShadow` 与动效时序常量(履带 200ms/格、水波 1600ms、冰面扫光 4000ms、光环 1200ms/圈、白闪 2 帧、炮口闪光 2 帧)。
2. **2.5D 双面块**:新增 `src/art/kit/block25d.ts`(`topSideBlock`,顶面主色 + 右/下侧面 `shade(-22)`,sideRatio=0.18,全部画进本格)+ 单测;地形砖/钢/基地统一双面块 + 右下 2px 投影。
3. **坦克八道工序**:右下投影 → 齿状履带(相位随里程,倒溜反向)→ 车身双面 → 炮塔圆壳+舱盖 → 炮管套环+口部亮边(后坐力沿用 `recoilPixels`)→ 阵营徽章自绘矢量(花/星/齿轮/铆钉/闪电,替换 emoji)→ 护甲小盾牌(金边 8px,替换白点)→ 炮口十字闪光 2 帧。
4. **散架与重生**:🔩⚙️🔧🛞🧰 替换为自绘零件(齿轮/弹簧/履带片/轮子/螺母),时间参数沿用 `SCATTER_SECONDS`/`REBUILD_SECONDS`;重生点加旋转光环 + 进度环(只读 `REBUILD_SECONDS`)。
5. **地形质感五件套**:砖墙 2×2 砖缝+顶亮边;钢块对角高光+铆钉四点;草丛三簇叠层(GRASS_ALPHA 藏车关系不变);冰面斜向扫光+细裂纹;水面两帧波纹;基地星星堡垒(旗帜+围栏)。粒子层 emoji 全部换矢量。
6. **小地图与 HUD**:小地图圆角壳 + 我方/敌方/基地三色图例点;HUD 芯片卡片化精修(不加任何新的 min-width/min-height)。
7. **reduced**:履带滚动、水波、扫光、光环全部冻结;受击白闪与炮口闪光是功能反馈,保留(炮口 reduced 留 1 帧)。
8. **destroy**:新增的履带里程/闪光帧状态(`TankFx`)在 destroy 里 `reset()` 归零。

## 三、红线自查

- 不碰 `ai12.ts` / `ballistics12.ts` / `maps12.ts` / `terrain12.ts` / `logic.ts` 的逻辑与数值;`recoilPixels`、`MUZZLE_WINDUP`、`TANK_HALF`、`REBUILD_SECONDS`、存档 key、`meta.ts` 一个都不动。
- 既有 `ballistics12.test.ts` / `ai12.test.ts` / `maps12.test.ts` 断言一个不改。
- 不碰 `shoot-range` / `sky-squad` 与 1.3 文档、`.cursor/skills/**`;无运行时依赖、无位图。
- 徽章/配色回到本库粉彩原创,不像 Battle City;无血、无伤害描写。

## 四、测试计划(只增不减,≥12 个视觉用例)

palette token 对表 / block25d 顶侧色与 0.18 / 双面块包围盒不越格 / 徽章五款可调用 + 形状可区分 / 履带相位推进与倒车反向 / 散架自绘且时间参数同 1.2 / 进度环只读 REBUILD_SECONDS / 盾牌 8px / recoilPixels 快照 / reduced 冻结与白闪保留 / destroy 后动画状态归零 / index.ts canvas 路径 0 次 fillText(emoji 全清)。
