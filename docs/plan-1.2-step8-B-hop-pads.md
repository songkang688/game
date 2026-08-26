# 1.2 第 8 步 · B 档 —— `hop-pads`「跳跳台」

> 短计划：独占新建 `src/games/hop-pads/`。本步另两档是 `dark-chess`、`tap-tiles`。本步是 B 档新游戏接入的最后一步。
> 蓄力跳跃、平台越来越窄。禁止写「跳一跳」官方名。不要改 `rainbow-run`（那是跑酷三车道）。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 8 步 · B 档**：新建 `hop-pads`「跳跳台」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.hop-pads`。
- 操作：**按住蓄力，松开起跳**。力度 ∝ 按住时间，有上限。键盘：朵朵 WASD 微调朝向 + `F`（或空格）蓄力跳，`G` 取消蓄力；星星方向键 + `L` 蓄力 / `K` 取消。双人分路。360px 台面居中，蓄力条明显，热区 ≥ 44px。手游优先，桌面同样可玩。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。不要改 `rainbow-run`。
- **收藏只读**：`jumpMul` 乘蓄力距离上限（仍要单测基础公式单调）。`startShieldMs` 可忽略第一次擦边。禁止改 collection 源文件。暂停可 `openCollection("hop-pads")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则
- 角色站在圆柱/方台中心。前方随机生成下一座台（距离、左右偏移、大小、类型）。
- 蓄力：高度与距离都随力度增加，抛物线落地。
- 落在台面内：成功，摄像机跟上。越靠近中心 **完美**，连击 +1，分 = 基础分 × 连击。
- 只踩到边缘：站住但连击清零。
- 落空 / 擦边掉下：失败。掉下要有下落动画，禁止瞬死。
- 台类型：稳台、会左右移动、会缩小、弹簧（额外跳）、一次台（跳后消失）。
- 禁止：力度与时间非线性到无法学习。`distance = k * t^2` 或线性映射必须写常量，训练关显示辅助圆。

胜负：掉下结束。闯关目标分数或座数。无尽记最高分 `save.recordEndlessBest("hop-pads", score)`。对战：同序列种子比分。

### meta
```
id: "hop-pads"
title: "跳跳台"
emoji: "⭕"
category: "casual"
color: "#FFE0C8"
blurb: "按住蓄力，松手跳到下一座台。踩中圆心连击会一直涨，掉下去就温柔重来。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端，触屏是第一公民。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 蓄力 | `powerFromHold(ms)` |
| 抛物线 | `landPoint(p0, power, yaw)` |
| 落台 | `onPad(p, pad) → miss/edge/perfect` |
| 连击分 | `score(combo, perfect)` |
| 生成 | `nextPad(seed, i)` 保证可跳（最大力度可达） |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 直线台 | 24 | 无左右偏移 |
| 2 | 左右摆 | 24 | |
| 3 | 圆心课 | 24 | 必须完美才三星 |
| 4 | 移动台 | 24 | |
| 5 | 缩小台 | 22 | |
| 6 | 弹簧 | 22 | |
| 7 | 一次台 | 24 | |
| 8 | 跳跳杯 | 24 | 全类型高速 |

24×4 + 22×2 + 24×2 = 188。生成器断言：每座台用 0.2–0.9 力度区间可达（测试抽样）。

### 前端建模与动画
Canvas 2.5D（台子椭圆透视即可，不要 three.js）。蓄力条。落地尘土。掉下屏幕往下掉再结算。`prefers-reduced-motion` 减少尘土。

### AI 档位
对战幽灵：用录好的力度；档位加噪声。

### 可参考 GitHub（结构 only，禁止运行时依赖）
跳一跳类开源 clone 的蓄力-距离曲线。不抄企鹅/小人素材。

### 独占
只许 `src/games/hop-pads/**`，可选 `scripts/smoke-step8-b.mjs`。禁止 `rainbow-run`、本步 A/C、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 18（硬性 ≥ 15）
力度映射单调、完美/边缘/失败、连击清零、生成可达、188 章和。

### 不要做什么
- 不要做成跑酷三车道。
- 不要无蓄力条。

### 验收 checkbox
- [ ] 蓄力跳跃手感可学
- [ ] 掉下有动画；188 + 无尽 + 对战同种子；360px 可按
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 B、力度公式、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
