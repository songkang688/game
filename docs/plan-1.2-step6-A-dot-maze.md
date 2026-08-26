# 1.2 第 6 步 · A 档 —— `dot-maze`「豆豆迷宫」

> 短计划：独占新建 `src/games/dot-maze/`。本步另两档是 `fruit-stack`、`pool-stars`。
> 街机吃豆迷宫结构。禁止写那款黄圆嘴街机角色的官方名。不要改 `ocean-munch`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 6 步 · A 档**：新建 `dot-maze`「豆豆迷宫」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.dot-maze`。
- WASD / 方向键转向（有输入缓冲：提前 1 格按也算）。双人：朵朵吃豆、星星操纵一只「迷途幽灵」或合作清豆。`F` 可作加速（可选），`G` 暂停旁路。360px 迷宫完整可见或可微缩。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。
- **收藏只读**：`speedMul` 乘玩家移速（封顶已在收藏层）。`startShieldMs` 可作开局短暂无敌。禁止改 collection 源文件。暂停可 `openCollection("dot-maze")`。
- 分级：碰到幽灵 = 晕眩掉一颗「小星命」，不是被吃掉描写。命 0 失败。能量豆让幽灵变「昏昏蓝」可推回家。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+、不要改 `ocean-munch`。

## 完整规则（街机吃豆结构）
- 迷宫：墙 + 豆 + 4 能量豆 + 隧道左右相通。
- 玩家格移动，速度常量；转向仅在交叉口且该方向无墙。
- 四只幽灵 **必须不同性格**（名字原创）：
  - 直直：追玩家当前格
  - 拐拐：瞄玩家前方 4 格
  - 绕绕：玩家与另一只幽灵连线对称点
  - 乱乱：游荡，靠近才追
- 状态：巡游（scatter 回角落）/ 追击 / 惊吓（能量豆）/ 回家。计时切换，和街机节奏类似但数值自定。
- 惊吓时可碰幽灵：幽灵眼睛回家，得分为 200×2^n 连击。惊吓结束闪烁预警。
- 吃光豆子过关。水果奖励在地图中央定时出现（原创水果名）。
- 禁止穿墙。隧道加速可做。

胜负：清豆胜；命尽负。对战：两人抢豆或一追一逃。无尽：关卡循环加速，`recordEndlessBest`。

### meta
```
id: "dot-maze"
title: "豆豆迷宫"
emoji: "🟡"
category: "action"
color: "#FFF5B8"
blurb: "在迷宫里吃光小星星。四只迷途幽灵各有脾气，能量豆一响它们就昏昏蓝。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 迷宫解析 | 字符图画墙 |
| 转向 | `canTurn` `bufferedTurn` |
| 幽灵目标 | `targetOf(kind, state)` |
| 惊吓 | `frightenAll` |
| 碰撞 | `hitGhost` |
| 清豆 | `dotsLeft` |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 练习廊 | 24 | 无幽灵 |
| 2 | 一只幽灵 | 24 | 只直直 |
| 3 | 四脾气 | 24 | 四只全开 |
| 4 | 能量豆 | 24 | 惊吓连击 |
| 5 | 隧道风 | 22 | 多隧道 |
| 6 | 迷雾迷宫 | 22 | 视野小 |
| 7 | 双人追逃 | 24 | 星星当幽灵 |
| 8 | 迷宫杯 | 24 | 高速 |

24×4 + 22×2 + 24×2 = 188。地图字符网格，测试：每关豆子可到达（从出生点 flood 能吃光）。

### 前端建模与动画
Canvas。豆子被吃有小缩放消失。幽灵变蓝有过渡，回家是眼睛飞，禁止爆炸。

### AI 档位
幽灵即 AI。对战「星星当幽灵」用玩家键位。

### 可参考 GitHub（结构 only，禁止运行时依赖）
https://github.com/platzhersh/pacman-canvas 迷宫与状态机分层。不抄素材。

### 独占
只许 `src/games/dot-maze/**`，可选 `scripts/smoke-step6-a.mjs`。禁止本步 B/C、`ocean-munch`、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 20（硬性 ≥ 15）
墙阻挡、隧道环绕、四目标函数、惊吓连击分数、可达清豆、188 章和。

### 不要做什么
- 不要做成 `ocean-munch`。
- 不要恐怖幽灵。

### 验收 checkbox
- [ ] 四性格 + 能量豆 + 隧道
- [ ] 188 地图可清；360px 可玩
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 A、四性格说明、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
