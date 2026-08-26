# 跳跳台 `hop-pads` · 窗口 2 · 8B 工作计划

按住蓄力、松手起跳，一次一跳落到下一座台。踩中圆心连击一直涨，掉下去有云朵接住。

## 一、蓄力公式与常量（先定死，后面全按这套算）

```
MAX_HOLD   = 900   ms       蓄满所需的按住时长
powerFromHold(ms) = clamp(ms / MAX_HOLD, 0, 1)      线性映射，单调可学

MIN_DIST   = 60    世界单位  power = 0 时的水平射程
MAX_DIST   = 260   世界单位  power = 1 时的水平射程
jumpDistance(power)   = MIN_DIST + (MAX_DIST - MIN_DIST) * power        线性、严格单调
powerForDistance(d)   = clamp((d - MIN_DIST) / (MAX_DIST - MIN_DIST), 0, 1)   精确反函数

MIN_APEX   = 26 / MAX_APEX = 100        抛物线最高点，同样随力度线性增长
MIN_FLIGHT = 0.42 s / MAX_FLIGHT = 0.70 s   飞行时长

飞行轨迹（真抛物线，u 从 0 到 1）：
  水平：p(u) = p0 + dir(yaw) * jumpDistance(power) * u
  垂直：y(u) = 4 * jumpApex(power) * u * (1 - u)

PERFECT_R  = 12    完美圈半径（台面被缩小台缩得太小时按 0.6 × 半径收窄）
REACH_MIN  = 0.2 / REACH_MAX = 0.9      生成器必须让每座台落在这个力度区间里
BASE_SCORE = 2  /  COMBO_CAP = 10       完美得分 = 基础分 × min(连击, 10)
```

选线性而不是 `t²`：孩子按秒表式地数「按一下、按两下」就能学会，`t²` 在低力度段太钝。
高度与飞行时长也随力度增加，所以视觉上确实是「蓄得越久跳得越高越远」。

## 二、模块切分

| 文件 | 负责 |
| --- | --- |
| `meta.ts` | 纯数据 |
| `physics.ts` | `powerFromHold` / `jumpDistance` / `landPoint` / `flightPoint` / `score` |
| `pads.ts` | `Pad` 五种台面、`padTick`、`onPad`、`nextPad` 生成器 |
| `run.ts` | 一局的状态机：`createRun` / `hop` / `requiredPower`，纯函数返回新状态 |
| `levels.ts` | 8 章 188 关切分、每关难度与评星 |
| `ai.ts` | 幽灵：录制理想力度序列 + 四档噪声 |
| `guide.ts` | 攻略（只讲方法） |
| `index.ts` | Canvas 伪 2.5D 画面 + 四种模式接线 |
| `domStub.ts` | 只给单测用的极简 DOM 桩 |

## 三、台面类型

稳台 / 左右移动台（横向正弦滑动）/ 逐渐缩小台 / 弹簧台（落上后自动多跳一次）/
一次台（跳走即消失）。

判定一律用**落地那一刻**的台面快照：`padTick(pad, t0 + flightTime(power))`，
瞄准方向 `yaw` 则取**起跳那一刻**的台心——所以移动台要挑它换向的那一下起跳。

## 四、生成器可达性

`nextPad(seed, i, difficulty, prev)` 先在 `[REACH_MIN, REACH_MAX]` 内抽一个「所需力度」，
再由 `jumpDistance` 反推台心位置，可达性是构造出来的而不是事后碰运气。
移动台的振幅按 `jumpDistance` 的余量收窄，保证台子滑到两个极端时所需力度仍在区间内。
测试抽 ≥ 100 座台，逐座断言 `powerForDistance(距离) ∈ [0.2, 0.9]`，移动台再按 24 个相位各断言一遍。

## 五、188 关

直线台 24 / 左右摆 24 / 圆心课 24 / 移动台 24 / 缩小台 22 / 弹簧台 22 / 一次台 24 / 跳跳杯 24 = **188**。

## 六、掉下去不是死亡

角色往屏幕下方掉出去，一朵云把他接住，写「云朵接住你啦，再来一次」。禁止瞬死。
`prefers-reduced-motion` 下去掉镜头晃动与压扁形变，只留蓄力条。
