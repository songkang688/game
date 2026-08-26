# 1.2 第 6 步 · B 档 —— `fruit-stack`「果果合成」

> 短计划：独占新建 `src/games/fruit-stack/`。本步另两档是 `dot-maze`、`pool-stars`。
> 重力下落同类合成。**不是** `fruit-catch` 接、**不是** `fruit-slice` 切。禁止写「合成大西瓜」官方名。自写圆碰撞，不要 Matter.js。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是执行者，禁止再派生云端子代理。只推 `game-1.2`。】

仓库 https://github.com/songkang688/game ，**1.2 第 6 步 · B 档**：新建 `fruit-stack`「果果合成」。假设 1.1 的 55 款已全部做完。

## 分支纪律
基于 origin/game-1.2，计划 commit，只推 game-1.2，禁止 force。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + 懒加载。**不要改 `src/ui/home.ts`。** 闯关走 `level99.ts` 188 关。存档 `yiduo-yixing.l99.fruit-stack`。
- 操作：朵朵 WASD 左右移动瞄准，`F` 下落，`G` 取消瞄准。手机拖 + 松手落下。星星方向键 + `L` 下落 / `K` 取消（对战分盆）。360px 容器用满宽，警戒线清楚，热区 ≥ 44px。
- `destroy` 干净。内置音效。无外部依赖。禁止商标。不要改 `fruit-catch` / `fruit-slice`。
- **收藏只读**：`luckMul` 不要改合成表。暂停可 `openCollection("fruit-stack")`。
- 验证 360 / 375 / 1280。不要改 supervisor / step1 / step9+。

## 完整规则
- 容器矩形，重力向下，圆与圆弹性碰撞 + 阻尼 + 地面墙。
- 水果等级 1→11（樱桃…西瓜…大西瓜用原创名：籽、莓、柑、桃、梨、苹、橙、柚、瓜、玉瓜、团圆瓜）。
- **同级相碰合成下一级**，得分按级。合成位置取两心中点，可连锁。
- 预览下一个（队列 1–2）。
- 失败：静止后有圆心越过分数线（警告线先闪）。刚落下的短暂无敌不判线。
- 禁止：合成瞬变成下一个尺寸——要 **两圆吸合缩放再弹出新圆**（200ms）。连锁要一节节播。

胜负：闯关目标「合成出指定级」或分数。无尽：死前分数 `recordEndlessBest`。对战：分容器比谁先合成目标 / 比分。

物理要用固定 dt（子步进），测：两圆重叠会分开、能量不爆炸增长。

### meta
```
id: "fruit-stack"
title: "果果合成"
emoji: "🍉"
category: "casual"
color: "#FFD9D0"
blurb: "同一种果子碰上就会变成更大的。慢慢堆，别让它们越过警戒线。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 积分圆碰撞 | `resolveCircles` |
| 合成 | `tryMerge` |
| 越线 | `overLine(settled)` |
| 分数 | `scoreFor(level)` |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 小籽 | 24 | 只出前 3 级，目标第 4 |
| 2 | 浆果盆 | 24 | 前 5 级 |
| 3 | 警戒线 | 24 | 线降低 |
| 4 | 连锁课 | 24 | 必须一次连锁 ≥3 |
| 5 | 窄瓶 | 22 | 容器变窄 |
| 6 | 弹力果 | 22 | 弹性更大 |
| 7 | 对盆 | 24 | 分屏对战教学 |
| 8 | 团圆杯 | 24 | 目标最高级 |

24×4 + 22×2 + 24×2 = 188。

### 前端建模与动画
Canvas。果子纯色+叶子高光，原创。掉落有影子瞄准线。合成吸合缩放。

### AI 档位
对战：菜鸟乱丢；普通对准同级；地狱看高度图。

### 可参考 GitHub（结构 only，禁止运行时依赖）
https://github.com/kevinshen56714/Suika-Game 合成与警戒线，自写物理不要 Matter.js 运行时。

### 独占
只许 `src/games/fruit-stack/**`，可选 `scripts/smoke-step6-b.mjs`。禁止 fruit-catch/slice、本步 A/C、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 20（硬性 ≥ 15）
同级合成升级、不同级不合成、越线只在 settled、连锁分数、碰撞分开、188 章和。

### 不要做什么
- 不要引入 matter/cannon 依赖。
- 不要瞬合成。

### 验收 checkbox
- [ ] 11 级合成链 + 警戒线
- [ ] 合成有吸合动画；188 + 无尽 + 对战；360px 可丢
- [ ] `npm test` `npm run build` 绿；destroy 干净；收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 B、物理稳定性、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
