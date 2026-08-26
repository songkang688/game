# 1.2 第 7 步 · A 档 —— `hue-hand`「花色接龙」

> 短计划：独占新建 `src/games/hue-hand/`。本步另两档是 `junqi-camp`、`chess-garden`。
> 色彩手牌（108 张结构：跳过/反转/+2/万能/+4/「就一张」）。禁止写 UNO 官方名。不要改 `landlord-cards`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 7 步 · A 档**：新建 `hue-hand`「花色接龙」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.hue-hand`。
- 点选出牌；`F` 出，`G` 抽。手机点选。360px 手牌横滑，牌宽 ≥ 48px，热区 ≥ 44px。朵朵 WASD 光标；星星方向键 + L 出 / K 抽。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。不要改 `landlord-cards`。
- **收藏只读**：不要用 luck 改牌堆。暂停可 `openCollection("hue-hand")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则（色彩手牌，108 张结构）
- 4 色 × 0–9：0 各 1 张，1–9 各 2 张。
- 功能牌每色 2 张：跳过、反转、+2。
- 万能 4、万能+4 共 4。
- 出牌必须匹配颜色或数字/功能。万能可改色。
- **万能+4**：只能在没有当前色可出时打（对战可挑战：若手牌确有该色，出牌者改为抽 4，挑战失败者抽 6）。必须实现挑战。
- 出 +2 / +4 可叠加（本款 **允许同种叠加**，+2 链、+4 链分开；到无法接的人一次抽完）。常量写清。
- 剩 1 张必须按「喊一声」按钮（文案 **「就一张」**，不要写商标缩写）。忘记且被点破 → 抽 2。
- 先出完胜。积分：对手手牌计分（数字面值，功能 20，万能 50）。

边界：反转在 2 人等于跳过。跳过跳下一家。抽牌后若能出可立即出（可选，默认能出）。

无尽：连胜记 `recordEndlessBest`。

### meta
```
id: "hue-hand"
title: "花色接龙"
emoji: "🌈"
category: "party"
color: "#FFD4E8"
blurb: "颜色或数字对上就能出。跳过、加二、换色，记得在最后一张时喊「就一张」。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。2–4 人，缺人 AI。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 合法出 | `canPlay(card, top, chosenColor)` |
| +4 合法性 | `wildDraw4Legal` |
| 挑战 | `challengeW4` |
| 叠加 | `drawStack` |
| 就一张 | `unoPenalty` |
| 计分 | `handScore` |

内部函数名可以用 `unoPenalty`，**面向孩子的字符串禁止商标**。

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 对色 | 24 | 无功能牌 |
| 2 | 跳过反转 | 24 | |
| 3 | 加二链 | 24 | |
| 4 | 换色 | 24 | 万能 |
| 5 | 加四与挑战 | 22 | |
| 6 | 就一张 | 22 | 惩罚 |
| 7 | 四人桌 | 24 | |
| 8 | 接龙杯 | 24 | 积分赛 |

24×4 + 22×2 + 24×2 = 188。残局给固定手牌与牌堆，N 步内出完。

### 前端建模与动画
DOM 牌。出牌飞到中央，抽牌从牌堆滑入。+2 链有数字跳动。禁止手牌瞬变减少。

### AI 档位
菜鸟有啥出啥；普通留功能；高手记已出颜色、会挑战 +4；地狱会堵下家。

### 可参考 GitHub（结构 only，禁止运行时依赖）
开源色彩手牌规则引擎结构。不抄卡背图。

### 独占
只许 `src/games/hue-hand/**`，可选 `scripts/smoke-step7-a.mjs`。禁止本步 B/C、`landlord-cards`、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 25（硬性 ≥ 15）
匹配规则、2 人反转=跳过、+4 挑战两种结果、忘喊罚 2、计分、叠加链、188 可解。

### 不要做什么
- 不要做成斗地主。
- 不要商标 LOGO。

### 验收 checkbox
- [ ] 108 张规则 + 挑战 + 就一张
- [ ] 188 + 对战 + 无尽连胜；360px 可出牌
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 A、规则选项、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
