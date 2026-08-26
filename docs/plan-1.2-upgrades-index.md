# 1.2 · C 档目录：第 9–29 步（55 款升级 + 三轮验收）

> C 档负责 **第 9 步到最后一步**。A 档写第 1 步与主管文档，B 档写第 2–8 步的 21 款新游戏。
> 本文件是 C 档自己的目录，只登记 C 档的产出。A 档的 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) /
> [`plan-1.2-index.md`](./plan-1.2-index.md) / [`plan-1.2-tracker.md`](./plan-1.2-tracker.md) 是 A 的独占文件，C 不改。

## 步数怎么算出来的

用户定的口径：**步数 = ceil((55 + 21) / 3) + 最后 3 步验收 = 26 + 3 = 29**。「33 步」不套，步号连续不跳号。

- 第 1–8 步（A + B）：平台基建 1 步 + 新游戏 7 步（21 款）= 24 格；
- 第 9–26 步（C）：**18 步 × 3 = 54 格，装 55 款升级**；
- 第 27–29 步（C）：三轮三人组验收，每轮 A 测试员 / B 学习优化员 / C 监督修复员。

**55 款装 54 格，多出来的一款放在第 15 步 C 档。** 选这一格是因为 `bumper-cars` 与 `bowling-lane` 是同一类活：
两款都是 1.1 做完但没合进 `game-1.2` 的遗留（`game-1.2` 是从 1.1 第 6 步中途拉出来的），
两款的第一步完全一样——从 `origin/game-1.1` 回迁 → 注册 → 再升级，合成一档派发最省事。

## 与 A 档主管文档的两处出入

A 的 [`plan-1.2-supervisor.md`](./plan-1.2-supervisor.md) 第四节排的是 **30 步**，与本目录有两处不一样，**以用户口径（29 步）为准**：

| 出入 | A 档主管文档 | C 档实际（本目录） | 为什么 |
| --- | --- | --- | --- |
| 总步数 | 30 步（第 27 步是「冲突 / 串味 / 首页接线 / 全局回归」，验收放在 28/29/30） | **29 步**（验收放在 27/28/29） | 用户明确给了公式 `ceil(76/3) + 3 = 29`，没有多余步数放独立的冲突步。**A 那个第 27 步的活没有丢**，已拆进三轮验收：76 款盘子清点与首页接线进第 27 步测试员，`meta.platform` / `meta.modes` 全库一致性、CSS / 快捷键 / `destroy` 泄漏、存档与 root API 审计进第 29 步的终审十一项。 |
| 一格两款的位置 | 第 26 步 C 位（`gold-hook` + `fishing-star`） | **第 15 步 C 位**（`bumper-cars` + `bowling-lane`） | 这两款是同一类回迁活，合并有共同的第一步；`gold-hook` 与 `fishing-star` 只是都带钩子，合并没有共用工序。 |

各步的游戏分组也与 A 的第四节表不同（按玩法族群重新分的），但**两边覆盖的 55 款完全一致**，一款不多一款不少。

## 第 9–26 步 · 55 款升级

| 步 | 主题 | A 档 | B 档 | C 档 |
| --- | --- | --- | --- | --- |
| 9 | 点名一：棋类解局 / 消除下落 / 2.5D 跑酷 | [`gomoku`](./plan-1.2-step9-A-gomoku.md) | [`match-stars`](./plan-1.2-step9-B-match-stars.md) | [`rainbow-run`](./plan-1.2-step9-C-rainbow-run.md) |
| 10 | 点名二：无尽吞噬 / 多档残局 / 格斗 | [`ocean-munch`](./plan-1.2-step10-A-ocean-munch.md) | [`xiangqi`](./plan-1.2-step10-B-xiangqi.md) | [`fight-king`](./plan-1.2-step10-C-fight-king.md) |
| 11 | 双人对战 | [`duo-rush`](./plan-1.2-step11-A-duo-rush.md) | [`duo-arena`](./plan-1.2-step11-B-duo-arena.md) | [`duo-vs-star`](./plan-1.2-step11-C-duo-vs-star.md) |
| 12 | 物理弹射与钩索 | [`sling-birds`](./plan-1.2-step12-A-sling-birds.md) | [`candy-swing`](./plan-1.2-step12-B-candy-swing.md) | [`gold-hook`](./plan-1.2-step12-C-gold-hook.md) |
| 13 | 塔防三连 | [`garden-guard`](./plan-1.2-step13-A-garden-guard.md) | [`sprout-defense`](./plan-1.2-step13-B-sprout-defense.md) | [`monster-crisis`](./plan-1.2-step13-C-monster-crisis.md) |
| 14 | 射击三连 | [`shoot-range`](./plan-1.2-step14-A-shoot-range.md) | [`sky-squad`](./plan-1.2-step14-B-sky-squad.md) | [`tank-battle`](./plan-1.2-step14-C-tank-battle.md) |
| 15 | 派对乱斗 + **1.1 遗留回迁** | [`bomb-buddies`](./plan-1.2-step15-A-bomb-buddies.md) | [`snow-fight`](./plan-1.2-step15-B-snow-fight.md) | [`bumper-cars` + `bowling-lane`](./plan-1.2-step15-C-bumper-cars.md) |
| 16 | 双人平台闯关 | [`ice-fire-forest`](./plan-1.2-step16-A-ice-fire-forest.md) | [`puff-bros`](./plan-1.2-step16-B-puff-bros.md) | [`prince-princess`](./plan-1.2-step16-C-prince-princess.md) |
| 17 | 冒险探索 | [`brave-path`](./plan-1.2-step17-A-brave-path.md) | [`adventure-king`](./plan-1.2-step17-B-adventure-king.md) | [`alien-seek`](./plan-1.2-step17-C-alien-seek.md) |
| 18 | 手感小品 | [`brick-break`](./plan-1.2-step18-A-brick-break.md) | [`mole-pop`](./plan-1.2-step18-B-mole-pop.md) | [`box-hamster`](./plan-1.2-step18-C-box-hamster.md) |
| 19 | 泡泡三连 | [`balloon-pop`](./plan-1.2-step19-A-balloon-pop.md) | [`bubble-pop`](./plan-1.2-step19-B-bubble-pop.md) | [`bubble-aim`](./plan-1.2-step19-C-bubble-aim.md) |
| 20 | 水果与蛇 | [`fruit-catch`](./plan-1.2-step20-A-fruit-catch.md) | [`fruit-slice`](./plan-1.2-step20-B-fruit-slice.md) | [`snake-snack`](./plan-1.2-step20-C-snake-snack.md) |
| 21 | 记忆与拼图 | [`lianliankan`](./plan-1.2-step21-A-lianliankan.md) | [`puzzle-tiles`](./plan-1.2-step21-B-puzzle-tiles.md) | [`memory-cards`](./plan-1.2-step21-C-memory-cards.md) |
| 22 | 牌桌与钓场 | [`landlord-cards`](./plan-1.2-step22-A-landlord-cards.md) | [`fishing-star`](./plan-1.2-step22-B-fishing-star.md) | [`poop-hero`](./plan-1.2-step22-C-poop-hero.md) |
| 23 | 红蓝三连 | [`red-blue-race`](./plan-1.2-step23-A-red-blue-race.md) | [`red-blue-tap`](./plan-1.2-step23-B-red-blue-tap.md) | [`red-blue-tug`](./plan-1.2-step23-C-red-blue-tug.md) |
| 24 | 学习（一） | [`clock-house`](./plan-1.2-step24-A-clock-house.md) | [`math-farm`](./plan-1.2-step24-B-math-farm.md) | [`pinyin-train`](./plan-1.2-step24-C-pinyin-train.md) |
| 25 | 学习（二） | [`word-garden`](./plan-1.2-step25-A-word-garden.md) | [`shape-kingdom`](./plan-1.2-step25-B-shape-kingdom.md) | [`find-diff`](./plan-1.2-step25-C-find-diff.md) |
| 26 | 创作与养成 | [`color-fun`](./plan-1.2-step26-A-color-fun.md) | [`music-stars`](./plan-1.2-step26-B-music-stars.md) | [`kitty-care`](./plan-1.2-step26-C-kitty-care.md) |

## 第 27–29 步 · 三轮三人组验收

| 步 | 轮次 | A 测试员 | B 学习优化员 | C 监督修复员 |
| --- | --- | --- | --- | --- |
| 27 | 第 1 轮：盘子清点 + 21 款新游戏全覆盖 + 点名五项 | [`tester`](./plan-1.2-step27-A-tester.md) | [`learner`](./plan-1.2-step27-B-learner.md) | [`fixer`](./plan-1.2-step27-C-fixer.md) |
| 28 | 第 2 轮：换样本 + 难度曲线 / 手感 / 竞态 / 教育正确性 / 无尽横评 | [`tester`](./plan-1.2-step28-A-tester.md) | [`learner`](./plan-1.2-step28-B-learner.md) | [`fixer`](./plan-1.2-step28-C-fixer.md) |
| 29 | 第 3 轮：76 款全覆盖终检 + 文档收口 + 终审签字 | [`tester`](./plan-1.2-step29-A-tester.md) | [`learner`](./plan-1.2-step29-B-learner.md) | [`fixer`](./plan-1.2-step29-C-fixer.md) |

三轮**严格串行**：一轮三格全绿才开下一轮。轮内 A/B/C 三格可以同时跑。
报告落在 `docs/qa/1.2-round{1,2,3}-{tester,learner,fixer}.md`，每人一个文件，互不冲突。

## 用户点名的五项（贯穿全程）

| 点名 | 落在哪 | 硬要求 |
| --- | --- | --- |
| `gomoku` | 第 9 步 A | 解局（残局）关 + AI 从**菜鸟到地狱**多档，档位强度必须单调 |
| `match-stars` | 第 9 步 B | 消除后**必须有看得见的下落与补位过程**，瞬变即阻断级 |
| `rainbow-run` | 第 9 步 C | 接住 1.1 第 6 步的 2.5D（`view3d.ts` / `controls.ts` / `endless.ts`），不许推倒重来 |
| `ocean-munch` | 第 10 步 A | 无尽模式 |
| `xiangqi` | 第 10 步 B | 多档 AI + 残局；**只升级，绝不新建第二个象棋目录** |

这五项在第 27 步与第 29 步各复验一次，任意一项不达标不许判过。

## 每份文档共同的硬约束

- 派发头四行逐字照抄，slug 写 `claude-opus-5-thinking-high-fast`（**不带方括号**），分支 `game-1.2`。
- 紧跟一句「你就是执行者，禁止再派生云端子代理」，防止套娃。
- git：只推 `game-1.2`，收尾 fetch → rebase → `npm test` + `npm run build` 全绿 → 普通 push；**禁止 force、不改 `main`、不用 `gh` 开或合 PR**。
- 起点水位 **142 个测试文件 / 3918 个用例**，**只增不减**；每款升级新增用例数在各自文档里写死（普遍 ≥ 18–22，高于主管文档的 ≥ 8 下限）。
- 存档 key 只增不改语义，前缀 `yiduo-yixing.`。
- **不引入任何外部运行时依赖**（禁 three.js、禁 CDN 字体、禁外链音源）。
- 分级红线：无血、无伤害、无死亡；失败只鼓励；无广告 / 内购 / 抽卡 / 联网上报；攻略不泄题；无商业商标与官方角色名。
- 188 关的款一律遵守「**前 99 关生成参数逐字不动**」的既有契约（`LEGACY_LEVELS` / `LEGACY_CHAPTER_COUNT` 那批注释就是契约）。
