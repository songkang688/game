# 窗口2 · 8C `tap-tiles`「音符下落」工作计划

四轨下落点击。**不是** `music-stars`（自由创作乐器），也**不是** `red-blue-tap`（双人抢点）：
音符块从上往下落到判定线，落到线上就点掉，长按条要按住到尾，空白格不能碰。

本目录是本款的独占范围，只碰 `src/games/tap-tiles/**`。

## 一、判定窗口与生命（写成常量，单测钉死）

| 常量 | 取值 | 含义 |
| --- | --- | --- |
| `PERFECT_MS` | 45 | `abs(Δt) ≤ 45ms` 判完美 |
| `GOOD_MS` | 100 | `45 < abs(Δt) ≤ 100ms` 判良好 |
| — | `> 100ms` 或没点 | miss |
| `HOLD_TAIL_MS` | 100 | 长按条尾端这么多毫秒之内松手算按到尾 |
| `CAMPAIGN_MAX_MISS` | 3 | 闯关允许 miss 三次 |
| `ENDLESS_MAX_MISS` | 0 | 无尽 0 容错 |

点空白做成开关：闯关第 1–2 章 `emptyRule = "combo"`（只断连击），第 3 章起 `emptyRule = "end"`（点空即结束）。
连击分：完美 100 分、良好 50 分，倍率随连击每 10 连加 0.5，封顶 4 倍。

## 二、谱面约束（`chartFromSeed` 生成，`validateChart` 校验）

1. 同一时刻最多 `maxConcurrent` 条轨有块，默认 **2**；Boss 关显式放开到 **3**，并在关卡数据里用 `boss` + `maxConcurrent` 标明。
2. 相邻音符（不同时刻）最小间隔 `≥ minGapMs(speed) = max(150, round(320 / speed))` 毫秒，按速度换算，保证手指跟得上。
3. 长按条区间 `[time, time + hold]` 不与同轨任何别的块重叠（同轨还要额外留一个最小间隔）。

测试对 ≥ 50 个随机谱同时断言这三条。

## 三、188 关 8 章

| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 单轨 | 24 | 只有 1 条轨 |
| 2 | 双轨 | 24 | 2 条轨 |
| 3 | 别碰空白 | 24 | 点空即结束 |
| 4 | 长按条 | 24 | 长按 |
| 5 | 加速 | 22 | 速度递增 |
| 6 | 双押 | 22 | 同时两轨 |
| 7 | 双人分轨 | 24 | 左右各两轨 |
| 8 | 音符杯 | 24 | 高速全轨综合，尾关是 Boss |

24×4 + 22×2 + 24×2 = **188**，`assertTotal(CHAPTERS, 188)` 兜底。
每关固定 seed，`speedAt(level)` 严格单调递增，完美机器人（0 噪声）能把 188 关全部打完。

## 四、文件切分

| 文件 | 负责 |
| --- | --- |
| `meta.ts` | 纯数据 |
| `judge.ts` | `judge` / `scoreCombo` / `holdTrack` / `speedAt` / 各常量 |
| `chart.ts` | `chartFromSeed` / `validateChart` / `minGapMs` |
| `run.ts` | 一次演奏的状态机：`tap` / `release` / `advanceTo` / `hitEmpty` |
| `audio.ts` | Web Audio 振荡器现场合成音高，`close()` 关上下文 |
| `levels.ts` | 8 章 188 关关卡数据与评星 |
| `ai.ts` | 四档假人：菜鸟 ±80 / 普通 ±40 / 高手 ±15 / 地狱 ±5 毫秒 |
| `guide.ts` | 攻略 |
| `index.ts` | Canvas 四列视图 + 四种模式接线 |
| `domStub.ts` | 单测用的极简 DOM / Canvas / AudioContext 桩 |

## 五、音频

**禁止任何 mp3 或外部音频文件。** 音高用 Web Audio 振荡器现场合成：
C 大调五声音阶 `[0, 2, 4, 7, 9]` 半音，按 `440 * 2^((semi - 9) / 12)` 换算频率，
轨道 + 连击决定取哪一级，完美与良好用不同的波形与音量。旋律全是音阶跑动，不是任何现成曲子。
`destroy` 必须 `close()` 掉 AudioContext。

## 六、测试（新增 ≥ 18，实际按每个系统铺满）

判定窗口 44 / 45 / 46ms 三档边界；miss 断连击；点空白两种开关；长按中途松手判 miss、按到尾判完成；
谱面三条约束 ≥ 50 个随机谱；速度表单调；完美机器人打完 188 关；`assertTotal(CHAPTERS, 188)`；
`destroy` 后 AudioContext 被 close、rAF 归零；360px 下每列 ≥ 80px。
