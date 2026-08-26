# 1.2 第 22 步 · B 档 —— `fishing-star`「钓鱼小达人」升级计划

> 对着 `docs/plan-1.2-step22-B-fishing-star.md` 写。只改 `src/games/fishing-star/**`,
> 不碰 `landlord-cards` / `poop-hero` / `ocean-munch`。不引入任何依赖。

## 一、现状审查(1.1 落地的事实)

| 问题 | 现状 |
| --- | --- |
| 抛竿是蓄力还是点按?落点能控制吗? | 已经是蓄力:`chargePower` 是 0→1→0 的三角波,松手定格,`castDepth` 线性映射到 0–50 米的**深度**。只有一个纵向自由度,没有水平距离、没有风。 |
| 咬钩到收杆的判定 | 已经是张力条博弈(不是点时机):`stepFight` 按住涨张力、松手落张力,`tension >= 1` 当帧断线,连续「太松」`escapeMs` 跑鱼。**缺红区计时**(现在是一碰到 1.0 就断,没有 1.2 秒的缓冲与预警),挣扎只有一种正弦波形。 |
| 鱼的种类、稀有度与刷新概率 | `logic.ts` 的 `FISH`,25 种原创鱼、稀有度 1–5(**不是 4 档**),`fishWeightAt = 水层贴合度 × rarityChance(luck)`,`pickFish(depth, rand, luck)` 用调用方给的随机源,可复现。 |
| 有没有图鉴?存 key?序列化测试? | 有,但只是「认识的鱼 id 列表」:`DEX_KEY = "yiduo-yixing.fishing-star.dex"`,`parseDex/serializeDex/addToDex` 有往返与坏数据测试。**没有首次捕获时间、没有最大尺寸。** |
| 188 关的目标 | 四种:`count` 钓够条数 / `score` 攒够分数 / `weight` 钓够千克 / `variety` 钓够种类;每关带鱼群带 `band`、限时、竿数上限与 `hardness`。 |
| `endless` 现在什么形态? | 90 秒不限竿数、整片水域随便抛、按**分数**计,`save.recordEndlessBest(meta.id, score)`。没有时间推移。 |

## 二、必须守住的底线

- `category: "casual"`、`modes: ["campaign","endless"]`、`levels: 188` 不变。
- **前 99 关数据一个字节都不许变**:`buildLevel` 经 `expectCatch` / `speciesNear` 依赖 `FISH` 的
  `layer / rarity / score / weight`。所以本次**不往 `FISH` 里加鱼、不改这四个数值字段**,
  只**追加**新字段(挣扎节奏、时段偏好、体长基准)。25 种 ≥ 24 种,达标。
- `logic.ts` 现有导出与语义全部保留,老用例只增不减。新判定用新常量、新字段接进去。

## 三、1.2 要落地的六件事

1. **收杆博弈(纯函数 + 单测)**
   - 新增红区:`RED_AT = 0.82`,连续待满 `RED_SNAP_MS = 1200` 毫秒才断线;
     `SNAP_AT = 1` 仍是硬顶(当帧断),老用例的「同一帧冲顶就算断」保持成立。
   - `FightState` 加 `redMs`,`FightParams` 加可选 `redAt / snapAt / redSnapMs`(给装备改写)。
   - 三种可预测的挣扎节奏 `steady`(长推)/ `burst`(两次猛冲)/ `dig`(赖底方波),
     每种在一个周期内均值恒为 0.5,按稀有度混合并由鱼 id 稳定决定 —— 同一种鱼永远同一个节奏。
2. **抛竿落点**:`castDistance(power, wind)` 决定水平距离,`depthAtDistance` 换算深度,
   `distanceLuck` 让远处更容易出稀有鱼;`rollWind` 给 ±12% 的轻微风向(界面画箭头)。
3. **鱼类与图鉴**:`RARITY_TIERS` 收成 4 档(常见 / 少见 / 稀有 / 传说);
   新图鉴 `dex.ts` 记首次捕获时间与最大体长,key 走 `yiduo-yixing.fishing-star.dex.v2`,
   老的 id 列表自动迁移;序列化往返 + 坏数据降级都有测试。
4. **装备(只用星星)**:`gear.ts` 三件套 —— 鱼线(抬张力上限)、鱼饵(稀有度加权)、
   浮标(预警更早),各 3 级。加成一律封顶并写断言,等级越界只会被夹回上限。
5. **无尽「钓到天黑」**:`daylight.ts` 把一局切成 晨 → 昼 → 黄昏 → 夜,
   每个时段改鱼群权重(夜里传说鱼概率最高),按**总重量**计分,
   成绩走 `save.recordEndlessBest("fishing-star", weight)`。
6. **温柔与手感**:上鱼小演出 ≤ 900 毫秒可跳过;每条鱼都能「放生」(每种鱼首次放生 +1 颗星星);
   张力条绿 / 黄 / 红三段带形状标记(色觉友好);`prefers-reduced-motion` 关抖动;
   手机上蓄力与收线共用同一颗大按钮,热区 ≥ 64px。

## 三点五、双人为什么这一版不做

规格说「双人可做(轮流钓比总重),做不动写明理由」。本次**不做**,理由是接线代价与本档的独占文件边界冲突:

- `modes` 是 `meta.ts` 里的纯数据,平台首页按它渲染入口、`gameShell` 按它决定挂哪一个模式。
  加 `versus` 得同时动平台侧的模式枚举与路由,而本档只许改 `src/games/fishing-star/**`。
- 轮流钓比总重在体验上是「两个人各自打一遍单人局再比数字」,一局要 2 × 90 秒,
  中间还有一整段对方在钓、自己干看着的空窗 —— 同一台手机上传来传去,收益低于这一版的红区手感与图鉴。
- 真要做,更合适的形态是把「钓到天黑」改成双人共享一条时间轴轮流抛竿,那需要重做无尽的计分与结算面板,
  和本步「收杆手感与图鉴」的主线不是一件事,留给后续步骤。

## 四、文件与测试

| 文件 | 动作 |
| --- | --- |
| `logic.ts` | 追加红区计时、三种节奏、距离与风、四档稀有度、体长换算 |
| `dex.ts` / `dex.test.ts` | 新增:图鉴 v2(首次时间 + 最大体长 + 放生记录) |
| `gear.ts` / `gear.test.ts` | 新增:星星装备与封顶断言 |
| `daylight.ts` / `daylight.test.ts` | 新增:无尽时段与鱼群变化 |
| `runtime.ts` / `runtime.test.ts` | 新增:rAF / 定时器 / 监听的登记簿,`destroy` 归零可测 |
| `logic.test.ts` | 追加新判定的用例(老用例一条不删) |
| `index.ts` | 接线:风向箭头、红区预警、装备面板、图鉴详情、天黑无尽、放生 |
| `meta.ts` / `guide.ts` | 文案与事实对齐 |

新增用例 ≥ 18(目标 60+)。收尾 `npm test` 与 `npm run build` 必须全绿。

## 五、红线

无伤害、无血、无货币、无内购、无广告、无联网、无账号;失败只鼓励;
角色只用朵朵 / 星星与本作原创鱼;不引入 three.js,保持 2D 侧视。
