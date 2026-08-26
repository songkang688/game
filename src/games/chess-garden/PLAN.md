# 窗口 2 · 第 7 步 B 档 · `chess-garden`「花园国际象棋」工作计划与规则覆盖表

对应规格：`docs/plan-1.2-step7-B-chess-garden.md`（十六节逐条落地）。
本文件只是本目录内的施工笔记，不参与打包（没有任何代码 import 它）。

## 一、这一款是什么

**国际象棋**：8×8、白先、六种棋子、FIDE 关键规则一条不少。

- 不是 `xiangqi`（中国象棋 9×10，带河界与九宫），不是 `gomoku`（五子棋），不是 `dark-chess`（暗棋）。
- 走法生成、判胜负、AI 全部自写，**没有任何 npm 走法库、没有 wasm、没有外部引擎**，离线可玩。
- 吃子的说法统一是「请对方的棋子去花园里休息」，全程无血腥、无死亡描写。

## 二、文件切分

| 文件 | 职责 |
| --- | --- |
| `meta.ts` | 纯数据，不 import 任何玩法代码 |
| `board.ts` | 棋子编码、格子编号、`Position`、FEN 读写、Zobrist |
| `moves.ts` | 伪合法走法、被攻击判定、`makeMove`、合法走法过滤、SAN 记谱 |
| `rules.ts` | 对局状态机：将杀 / 逼和 / 50 回合 / 三次重复 / 子力不足 / 认输 |
| `search.ts` | 评估函数 + alpha-beta + 迭代加深 + 置换表 + 四档 AI + 杀棋验证器 |
| `levels.ts` | 8 章 188 关的题目数据与章节表 |
| `guide.ts` | 攻略（只讲思路，不给每关答案） |
| `view.ts` | DOM 棋盘视图：滑行、可走点、被将高亮、升变四选一、记谱抽屉 |
| `index.ts` | `export { meta }` + `mount(api)`，四种模式外壳 |
| `domStub.ts` | 单测用的极简 DOM 桩（仓库测试环境是 node，没有 jsdom） |

## 三、局面表示

- `board`：长度 64 的 `Int8Array`，下标 0 = a1、63 = h8（`sq = rank * 8 + file`）。
  白子正数、黑子负数：兵 1、马 2、象 3、车 4、后 5、王 6。
- `turn`：`1` 白 / `-1` 黑。
- `castling`：4 位掩码 `WK=1 WQ=2 BK=4 BQ=8`。
- `ep`：过路兵目标格（`-1` 表示没有）。**只在下一手有效**——`makeMove` 每走一步都重算，
  只有兵刚走两格才会重新置上。
- `halfmove`：50 回合规则的半回合计数（吃子或兵动清零）。
- `fullmove`：回合数。

## 四、规则覆盖表（规格第五节逐条）

| 规则 | 落地位置 | 单测 |
| --- | --- | --- |
| 王 / 后 / 车 / 象 / 马 / 兵六种走法 | `moves.ts` `pseudoMoves` | `moves.test.ts` 六条各一 |
| 马跳过挡子 | `KNIGHT_TARGETS` 预表，不做路径检查 | `moves.test.ts` |
| 车 / 象 / 后 被挡住停下 | `RAYS` 逐格推进遇子即停 | `moves.test.ts` |
| 兵首步两格 | `pseudoMoves` 双跳需要两格都空 | `moves.test.ts` |
| 兵斜吃 | 斜前方有敌子或等于 `ep` 才生成 | `moves.test.ts` |
| 升变必须选（后 / 车 / 象 / 马） | 到底线的兵走法一次生成四条 `promo` | `moves.test.ts` |
| 不许走出自将 | `legalMoves` 走完再看本方王是否被攻击 | `moves.test.ts` |
| 短易位 / 长易位 | `castlingMoves`：权在 + 中间空 + 起点/经过格/落点都不被将 | `rules.test.ts` |
| 易位四种失败：王动过 / 车动过 / 中间有子 / 经过格被攻击 | `makeMove` 撤权 + `castlingMoves` 三段安全检查 | `rules.test.ts` |
| 吃过路兵 | `ep` 目标格 + `makeMove` 里把被吃的兵从**它自己那一格**移走 | `rules.test.ts` |
| 过路兵**只在下一手**有效 | 任何一步之后 `ep` 立刻重置 | `rules.test.ts` |
| 将杀 | 无合法走法 + 被将 | `rules.test.ts` |
| 逼和 | 无合法走法 + 没被将 | `rules.test.ts` |
| 50 回合和 | `halfmove >= 100` | `rules.test.ts` |
| 三次重复和 | `zobrist(pos)` 含轮走方 / 易位权 / 过路格，`Game` 计数到 3 | `rules.test.ts` |
| 子力不足和 | 王对王、王象对王、王马对王（外加同色格双象） | `rules.test.ts` |
| 认输 | `resign(game, side)` 直接结算 | `rules.test.ts` |
| 超时 | `flag(game, side)`：对方子力不足时判和，否则判超时方负 | `rules.test.ts` |
| `perft` | `moves.ts` 之上的纯函数 | `perft.test.ts` 起始局面深度 1–4 + 四个复杂局面 |

## 五、系统表（规格第六节对照）

| 规格里的抽成 | 实际导出 |
| --- | --- |
| `pseudoMoves(pos, sq)` | `moves.ts` `pseudoMoves(pos, sq?)` |
| `legalMoves(pos)` | `moves.ts` `legalMoves(pos, sq?)` |
| `castlingRights(pos)` / `canCastle(pos, side)` | `rules.ts` |
| `epSquare(pos)` | `rules.ts` |
| `promote(move, piece)` | `rules.ts` |
| `status(pos)` | `rules.ts` `status(pos, repetitions?)` |
| `zobrist(pos)` / `halfmoveClock` | `board.ts` `zobrist` / `rules.ts` `halfmoveClock` |
| `toSan(move, pos)` | `moves.ts` |
| `search(pos, depth, timeMs)` | `search.ts` |

## 六、AI 四档（规格第十节）

| 档 | 行为 | 单手预算 |
| --- | --- | --- |
| 1 菜鸟 | 随机合法走法，优先不白送子（走完不被更便宜的子吃） | 无搜索 |
| 2 普通 | 子力评估 + 固定深度 2 | ≤ 60ms |
| 3 高手 | 深度 3 + 位置表（兵型 / 中心 / 王安全）+ 静态吃子延伸 | ≤ 120ms |
| 4 地狱 | 迭代加深 + alpha-beta + 置换表 + 杀手启发，时间预算 200ms | ≤ 200ms（硬上限有测试） |

固定 seed 下地狱档对菜鸟档的胜率显著更高（`search.test.ts` 里跑短局验证）。

## 七、188 关切分（规格第八节，8 章）

| # | 章节 | 关数 | 新机制 | 题型 |
| --- | --- | --- | --- | --- |
| 1 | 兵的花园 | 24 | 只有兵与王 | 升变杀、兵阵杀，1–2 步 |
| 2 | 车的走廊 | 24 | 车与直线 | 底线杀、两车梯子杀 |
| 3 | 马的跳跃 | 24 | 马步与叉击 | 马杀、马双击 |
| 4 | 象与后 | 24 | 斜线与合力 | 象杀、后杀、后象合力 |
| 5 | 易位课 | 22 | 长短易位 | **首着必须是易位**的杀棋；另有不能易位的辨析题 |
| 6 | 过路与升变 | 22 | 吃过路兵、升变选择 | 首着是吃过路兵 / 升变（含升马） |
| 7 | 将杀练习 | 24 | 2–5 步杀 | 纯杀棋 |
| 8 | 花园杯 | 24 | 完整对局任务与残局 | 深杀 + 逼和 / 三次重复 / 子力不足 和棋题 |

24×4 + 22×2 + 24×2 = **188**，`assertTotal(CHAPTERS, 188)` 锁死。

每一关的题目都是**用搜索验证过的**：

- 杀棋题：`findForcedMate(pos, plies)` 必须找到解，且 `findForcedMate(pos, plies - 2)` 必须找不到
  （保证「正好是 N 步杀」，不是更短的题目被标深了）。
- 和棋题：按题目类型断言——逼和题走完那一手 `status` 必须是逼和；
  三次重复题按主线走完 `status` 必须是重复和；子力不足题走完必须判子力不足。
- 题面全部是 FEN 数据，`levels.ts` 里不跑搜索，进游戏零延迟。

## 八、四种模式（规格第七节）

| 模式 | 做法 |
| --- | --- |
| 闯关 188 | `mountLevelGame`，每关一道题，限步数，超步或走错主线给鼓励并可重来 |
| 对战 | 人机四档，可选执白执黑 |
| 无尽 | 连胜挑战：赢一场 AI 就加深一档 / 加时间，输了记录连胜，`save.recordEndlessBest` |
| 双人同屏 | 朵朵执白、星星执黑，可开「翻转棋盘」 |

## 九、键位与触屏

- 点选 / 拖拽都能走子；格子热区 ≥ 40px（360px 宽下棋盘满宽，一格 ≥ 40px）。
- 朵朵执白：`WASD` 移动光标 + `F` 落子；星星执黑：方向键 + `L`；`Esc` 暂停。
- 升变弹窗四选一，键盘可达。

## 十、视觉与 360px

- 粉彩双色格（`#F6E7D8` / `#C9A87C` 的柔和版），棋子是圆形花瓣底 + 兵种字样角标，六种一眼可区分。
- 走子滑行 180ms（`prefers-reduced-motion` 下缩到 40ms）；吃子淡出；被将时王格柔和杏色高亮，**不用血红**。
- 可走点提示可关；最近一手起落两格高亮。
- 360px：棋盘占满宽，一格 ≥ 40px，记谱区折叠成下方抽屉，字号 ≥ 13px。

## 十一、红线自审

- 无商标：不写引擎名、赛事名、棋手真名、商业下棋 App 名（代码注释也不写）。
- 「国际象棋」是通用棋类名词，允许出现。
- 失败文案只鼓励；攻略只讲思路不给每关答案。
- 只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。
- `destroy` 拆掉全部 `window` / `document` 监听、`setTimeout`、rAF。
