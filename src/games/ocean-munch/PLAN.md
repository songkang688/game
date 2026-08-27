# A 档 · 海底大胃王(`ocean-munch`)1.2 升级计划

窗口 2 · 档位 10A · 只动 `src/games/ocean-munch/**`。

## 一、现状审查(读完 `logic.ts` / `index.ts` / `meta.ts` / `guide.ts` / 两个测试文件)

1. **没有无尽模式**。`meta.modes` 只有 `["campaign"]`,`index.ts` 的 `Phase` 是
   `themes | map | dex | intro | play | clear | retry`,整份文件里没有任何一条无尽的分支。
   本步第一优先级就是补上「深海马拉松」,并且要和战役并列在同一个入口页上。
2. **成长是线性的,阈值很松**。起始半径 `START_RADIUS = 14`;能吃的判据
   `canEat(playerR, otherR) = playerR >= otherR * 1.08`(也就是对方半径 ≤ 自己 ÷ 1.08 ≈ 0.926 倍),
   擦边就能吞;`grow(r, eatenR, target) = min(target, r + max(1.0, eatenR * 0.16))`
   —— 与自己的体型无关,越吃越快,只有关卡目标 `sizeCapFor(def)` 这一道封顶;
   速度上根本没有「越大越慢」这回事,跟手系数 `dt * 7` 是常数,也没有冲刺。
3. **关卡表在 `logic.ts` 的 `LEVELS`**(前九章 `buildZone` + 1.1 三章 `buildDeepZone`,共 188 关),
   鱼种/洋流/毒藻这些参数散在 `ZONE_STYLE`、`LevelDef.hazards`、`driftVector`、`toxinShrink` 里。
   它们是**按关卡索引**取的,不能直接喂给无尽;无尽要的是「按层数」的曲线,
   所以另开 `endless.ts` 写纯函数层表,复用的是**机制**(洋流函数、毒藻缩水、图鉴归类),不是关卡表。
4. **key 都在 `yiduo-yixing.` 前缀下**:进度 `yiduo-yixing.ocean-munch.campaign.v2`、
   图鉴 `yiduo-yixing.ocean-munch.dex.v1`。**没有接通用 skip**,也没有 `initialLevel` / `?level=`,
   `mount` 只返回 `{ destroy }`,平台没法直开第 N 关。
5. **吃掉猎物时半径是一帧跳变**:`player.r = grow(...)` 直接写死,没有吞咽拉伸,也没有插值回落。
6. **碰撞检测是 O(n²) 量级的两两遍历**:玩家 × NPC 一趟、共生小鱼 × NPC 又一趟。
   战役里 `npcs` 上限 9 条鱼,跑得动;无尽要同屏 40+ 条,必须换成网格邻域查询。

## 二、这一步要做什么

| 模式 | 做不做 | 说明 |
| --- | --- | --- |
| 战役 188 关 | 保留 | **前 99 关参数一字不改**;`logic.ts` 里 1.0/1.1 的常量、关卡表、胜负公式全部原样。 |
| 无尽「深海马拉松」 | **必须做** | 与战役并列的入口。失败:被吃到半径 ≤ 起始值,或 90 秒没有进食。成绩走 `save.recordEndlessBest("ocean-munch", depth)`。 |
| 对战「限时谁更胖」 | 做 | 人机三档(乱游 / 会躲 / 会反杀),60 秒比体型。AI 转向是纯函数,单测盯得住。 |
| 双人合作 | 不做 | 这一款的核心张力是「谁比谁大」,同屏两条鱼互相不能吃、又共享一片鱼群,合作只会退化成分头刷鱼;而且同屏双人要抢键位,和红蓝系那几款冲突。 |

## 三、成长曲线(纯函数 + 单测,写在 `endless.ts`)

- 半径:`growEndless(r, preyR, tier) = min(MAX_R, r + k(tier) * (preyR / r))`,
  `k(tier) = max(K_MIN, K0 / (1 + K_DECAY * (tier - 1)))` —— 层数越深每口长得越少,两分钟撑不破屏幕。
- 速度:`endlessSpeed(r) = V0 / (1 + A * (r - START_RADIUS))`;冲刺 `DASH_MULT = 1.8`,
  持续 `DASH_TIME`,冷却 `DASH_CD = 2.4s`。
- 层数:`tierAt(depth, elapsed) = clamp(1 + max(⌊depth/400⌋, ⌊elapsed/45⌋), 1, TIER_MAX)`
  —— 每 400 米**或**每 45 秒进一层,两条都算,快的那条说了算。
- 每层的鱼种表、洋流强度、毒藻密度、体型上限写成一张 `ENDLESS_TIERS` 表。
- 第 5 层起「深渊压力」:半径超过本层上限就按 `pressureDrain` 缓慢掉质量;
  吃到精英鱼可以破上限 10 秒(`ELITE_BREAK`),鼓励用冲刺去抢。
- 断言:单调(吃了只会变大)、有上限(永不超过 `MAX_R`)、层数生成可复现(固定 seed)、
  模拟一局活过 60 秒、乱来的一局真的会失败。

## 四、通行体验

- 能吃的判据在无尽里收紧成 `canSwallow(r, preyR) = preyR <= r * 0.85`(战役沿用老的 `canEat`,不动配平)。
- 吞咽:180ms 椭圆拉伸朝向猎物再回正(`swallowStretch`),半径本身走插值(`easeRadius`),
  `prefers-reduced-motion` 下只留音效与插值。
- 被更大的咬到:掉一块质量(`biteLoss`),画面上掉一串泡泡和彩纸,短暂闪烁无敌。
  **无血无伤无死亡描写**,被吃到底就是「晕乎乎回岸上休息」。
- 毒鱼 / 危险鱼不靠红绿区分:毒藻鱼有荧光圈 + ☠ 标,危险大鱼有锯齿背鳍 + 斜纹。
- 邻域查询走自己写的 `SpatialGrid`(单元格哈希),只在模块内部,不挂 `window`。

## 五、平台接线

- `campaign.ts`:`clampLevelIndex` / `levelFromSearch` / `initialLevelIndex` / `openCampaignLevel(n)`;
  `mount` 返回值加 `openCampaignLevel`,接 `api.initialLevel` 与 `?level=`,越界 clamp。
- Skip 走 `getLevelExtras().requestSkip`,成功后本关记 0 星、下一关照样解锁,
  并同步 `yiduo-yixing.l99skip.ocean-munch`。
- 无尽把关号映射到起始层:`startTierForLevel(1) = 1`(浅海) … `startTierForLevel(188) = TIER_MAX`(压渊),
  映射表写进注释与测试。
- `meta.modes` 补 `"endless"` 与 `"versus"`,`meta.platform` 按实测填,`blurb` 与事实对齐。

## 六、视觉与手机

- **保持 2D 俯视**,全库禁止 three.js。允许 2–3 层视差水层、气泡、光柱(纯 Canvas 渐变),
  远景色随层数变深。
- 360px:跟随滑动时朵朵鱼浮在手指上方一个身位,不被手指压住;
  HUD(半径 / 层数 / 图鉴)分两行贴顶,不压鱼;图鉴名 ≥ 14px、热区 ≥ 44px、不横向溢出。

## 七、测试(新增 ≥ 22 个用例)

`endless.test.ts` / `campaign.test.ts` / `index.test.ts` 覆盖:
成长公式单调 + 上限、吃阈值 0.85 附近三点、层生成可复现(固定 seed 两遍一致)、
模拟一局活过 60 秒、乱来会失败、图鉴序列化往返、`openCampaignLevel` 边界、
无尽成绩只增不减、`destroy` 后 rAF 与监听归零。
