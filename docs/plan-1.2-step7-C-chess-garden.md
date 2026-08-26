# 1.2 第 7 步 · C 档 —— `chess-garden`「国际象棋」

> 短计划：独占新建 `src/games/chess-garden/`。本步另两档是 `hue-hand`、`junqi-camp`。
> FIDE 关键规则：易位、过路兵、升变、将杀/逼和、50 步、三次重复。**不是**中国象棋，不要改 `xiangqi`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 7 步 · C 档**：新建 `chess-garden`「国际象棋」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关（残局）。存档 `yiduo-yixing.l99.chess-garden`。
- 点选或拖。朵朵白棋 WASD 光标 + F 落子；星星黑棋方向键 + L。360px 格子 ≥ 32px 可滚动。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。不要改 `xiangqi`。
- **收藏只读**：不要用 luck 改走法生成。暂停可 `openCollection("chess-garden")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则（FIDE 简化实现必须包含）
- 王车马象后兵走法。
- **王车易位**：长短易位，王未动车未动、路径无子、途经与落点不被将。
- **吃过路兵**：兵刚走两格经过的格子，对方兵可立即吃。
- **升变**：兵到底线必须变后/车/象/马（默认后，提供选择）。
- **将杀 / 逼和**：无合法且被将 = 负；无合法且未被将 = 和。
- **50 步**无吃子无兵动可和；**三次重复**局面可和（用哈希）。
- 超时可关。

胜负：将杀胜、认输、超时、和棋类型都要能结算。无尽：连胜 `recordEndlessBest`。

### meta
```
id: "chess-garden"
title: "国际象棋"
emoji: "♔"
category: "party"
color: "#F0E6D8"
blurb: "王、后、车、象、马、兵。记得易位、过路兵和升变。把对方的王逼到无路可走。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。棋子用原创花瓣造型也可，但必须能区分兵种。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 伪合法 | `pseudoMoves` |
| 过滤被将 | `legalMoves` |
| 易位 | `castlingRights` |
| 过路 | `epSquare` |
| 升变 | `promote` |
| 将杀逼和 | `status` |
| 重复/50 | `zobrist` `halfmove` |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 兵的花园 | 24 | 只兵王 |
| 2 | 车的走廊 | 24 | |
| 3 | 马跳 | 24 | |
| 4 | 象与后 | 24 | |
| 5 | 易位 | 22 | |
| 6 | 过路与升变 | 22 | |
| 7 | 将杀练习 | 24 | 2–5 步杀 |
| 8 | 花园杯 | 24 | 完整对局任务 |

24×4 + 22×2 + 24×2 = 188。每题唯一关键或允许集合，测试断言能杀/能和。

### 前端建模与动画
Canvas/DOM 棋盘。走子滑行。吃子：被吃棋淡出。将：国王格红框，不要血腥。

### AI 档位
菜鸟随机合法（不送将则更好）；普通物质启发深度 1；高手深度 2–3 + 位置分；地狱深度 3–4 或迭代加深限时 200ms。地狱 vs 菜鸟 20 局胜率高。不要 Stockfish wasm。

### 可参考 GitHub（结构 only，禁止运行时依赖）
https://github.com/jhlywa/chess.js 走法生成结构（不要 npm 依赖，自己写）。
https://github.com/official-stockfish/Stockfish 只看评估思路。

### 独占
只许 `src/games/chess-garden/**`，可选 `scripts/smoke-step7-c.mjs`。禁止 `xiangqi`、本步 A/B、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 30（硬性 ≥ 15）
马跳、易位被将不能、过路兵只立即有效、升变、将杀、逼和、50 步、重复、188 残局可解。

### 不要做什么
- 不要中国象棋规则。
- 不要联网。

### 验收 checkbox
- [ ] FIDE 关键规则齐；AI 四档
- [ ] 188 残局可解；360px 可走
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读；未改 xiangqi

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 C、规则覆盖表、AI 深度、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
