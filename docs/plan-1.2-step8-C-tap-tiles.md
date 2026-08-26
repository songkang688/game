# 1.2 第 8 步 · C 档 —— `tap-tiles`「音符下落」

> 短计划：独占新建 `src/games/tap-tiles/`。本步另两档是 `dark-chess`、`hop-pads`。本步是 B 档新游戏接入的最后一步。
> 四轨下落音符点按 / 长按。**不是** `music-stars` 作曲沙盒。禁止写钢琴块 / 别踩白块官方名。不要外部 mp3。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 8 步 · C 档**：新建 `tap-tiles`「音符下落」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.tap-tiles`。
- 操作：四轨下落，点黑块 / 键盘。全局约定仍是朵朵 WASD+F/G、星星方向键+L/K：单人默认 `D F J K` 四列；双人朵朵左两轨 `A S`（或 `F G`），星星右两轨 `K L`。触屏点对应列。360px 四列占满宽，判定线在下 20%，列宽热区 ≥ 44px。手游优先。
- `destroy` 干净。音效用 `api.play("tap")` 等，可用音高不同的内置振荡（Web Audio 在游戏内合成短音），**不要 mp3 依赖**。不要改 `music-stars`。
- **收藏只读**：`luckMul` 不要改判定窗口（公平）。暂停可 `openCollection("tap-tiles")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则
- 4 列。黑块从下落到判定线，在窗口内点 = 完美/好；太早太晚 = miss；点到白块（空列）= 立即失败（经典）或扣连击（闯关前期可关「点白即死」）。
- 长块：按住到尾。
- 速度随关卡/无尽递增。
- 连击、分数。生命：无尽 0 条 miss 即死；闯关允许 3 miss。
- 谱面：用种子 + 密度生成，**保证同一时刻至多 2 列有块**（可玩），且有最短间隔。测试：随机 50 谱无「四列同时」除非 Boss 关明确允许。
- 谱面也可用 JSON 手写若干教学关，其余 seed 生成。

胜负：闯关吃完谱面。点白即死或 miss 完失败。无尽：死前分数 `save.recordEndlessBest("tap-tiles", score)`。对战：同谱比分或谁先 miss。

### meta
```
id: "tap-tiles"
title: "音符下落"
emoji: "🎹"
category: "casual"
color: "#E8D9FF"
blurb: "黑块落下就点，白块千万别点。连击越高越好听，四列都是你的琴键。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端，触屏第一公民。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 谱生成 | `chartFromSeed` |
| 判定 | `judge(offsetMs) → perfect/good/miss` |
| 点白 | `hitWhite` |
| 长块 | `holdTrack` |
| 分数 | `scoreCombo` |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 单轨 | 24 | 只 1 列 |
| 2 | 双轨 | 24 | |
| 3 | 点白即死 | 24 | |
| 4 | 长按条 | 24 | |
| 5 | 加速 | 22 | |
| 6 | 双押 | 22 | 同时两列 |
| 7 | 双人分列 | 24 | 朵朵左两轨星星右两轨 |
| 8 | 音符杯 | 24 | 高速全键 |

24×4 + 22×2 + 24×2 = 188。

### 前端建模与动画
Canvas 四列。判定线。点中：块碎成粒子向上。**禁止到线瞬删无反馈。** miss 有温柔提示。reduced-motion：减少粒子。

### AI 档位
对战：按谱面 ± 延迟误差，档位误差 80/40/15/5ms。

### 可参考 GitHub（结构 only，禁止运行时依赖）
钢琴块类开源谱面循环。不抄曲库版权。下落音符判定窗（Perfect / Good / Miss）。

### 独占
只许 `src/games/tap-tiles/**`，可选 `scripts/smoke-step8-c.mjs`。禁止 `music-stars` 玩法改动、本步 A/B、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 18（硬性 ≥ 15）
判定窗口、点白、长块中途松开 miss、谱面密度约束、188 章和、速度表单调。

### 不要做什么
- 不要外部音频文件。
- 不要做成 `music-stars` 创作器。

### 验收 checkbox
- [ ] 四轨判定 + 点白规则
- [ ] 命中有粒子/闪，不是瞬变
- [ ] 188 + 无尽 + 对战；360px 四列可点
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 C、判定窗口、谱面约束、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
