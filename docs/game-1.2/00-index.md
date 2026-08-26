# 一朵一星 1.2 · 文档目录（给人看）

> **收口后的派发入口。** 三家提示词已合入 `game-1.2`。id 冲突见 [00-id-map.md](./00-id-map.md)。

| 文档 | 用途 |
| --- | --- |
| [00-supervisor.md](./00-supervisor.md) | 主管职责、派发纪律、root 门、监督清单 |
| [00-id-map.md](./00-id-map.md) | 三套新游戏 id 对照；**施工听 B，升级规格听 C** |
| [00-catalog.md](./00-catalog.md) | A 档规划稿（21 个别名 + 55 款老游戏表） |
| [new-games/README.md](./new-games/README.md) | B 档 21 款接入 |
| [upgrades/README.md](./upgrades/README.md) | C 档升级 / 冲突 / 验收 |
| [../upgrade-prompts/12-game-1.2-baseline.md](../upgrade-prompts/12-game-1.2-baseline.md) | 代码基线 |
| [../upgrade-prompts/11-game-1.1-dispatch-prompts.md](../upgrade-prompts/11-game-1.1-dispatch-prompts.md) | 1.1 对照 |

## 一共多少步（按已落地文件，不套 33、也不再套规划里的 38）

```
平台     1 步     step-01
新游戏   7 步     new-games/step-10 … 16     （21 款，每步 A/B/C 各 1 款）
升级    25 步     upgrades/step-30 … 54      （每步 3 款）
冲突     1 步     upgrades/step-55
验收     2 步     upgrades/step-56 … 57      （测 / 学 / 修）
合计    36 个派发步
```

规划稿曾写 38 步（再加首页 60 + 第三轮 QA）。C 把冲突和两轮验收收在 55–57，**没有** `step-60`–`63.md`。首页筛选已在第 1 步 B；冲突/接线在第 55 步。若以后要第三轮 QA，再补文档，不计入当前 36。

编号空隙（02–09、17–29）故意留空，不要拿来插步。

## 平台（第 1 步）

| 派发步 | 文档 | A | B | C |
| --- | --- | --- | --- | --- |
| 1 | [step-01.md](./step-01.md) | root 跳关门（密码 `kangkang`，管理员 `18438037080`，1 小时关） | 手游/端游筛选 + 手机文字 | 闯关/对战/无尽与 2.5D 基建 |

## 新游戏接入（第 10–16 步）· 施工 id

| 派发步 | 文档 | A | B | C |
| --- | --- | --- | --- | --- |
| 10 | [new-games/step-10.md](./new-games/step-10.md) | `orb-arena` 圆圆大作战 | `snake-royale` 长蛇争霸 | `block-drop` 方块叠叠乐 |
| 11 | [new-games/step-11.md](./new-games/step-11.md) | `combo-clash` 连招对决 | `mahjong-bloom` 花开麻将 | `star-estate` 朵星地产 |
| 12 | [new-games/step-12.md](./new-games/step-12.md) | `hero-cards` 英杰令 | `weiqi-garden` 围子花园 | `flight-chess` 飞行棋乐园 |
| 13 | [new-games/step-13.md](./new-games/step-13.md) | `merge-2048` 星星合成 | `mine-garden` 扫雷花园 | `sudoku-petal` 数独花田 |
| 14 | [new-games/step-14.md](./new-games/step-14.md) | `dot-maze` 豆豆迷宫 | `fruit-stack` 果果合成 | `pool-stars` 朵星台球 |
| 15 | [new-games/step-15.md](./new-games/step-15.md) | `hue-hand` 花色接龙 | `junqi-camp` 军旗对决 | `chess-garden` 国际象棋 |
| 16 | [new-games/step-16.md](./new-games/step-16.md) | `dark-chess` 翻翻暗棋 | `hop-pads` 跳跳台 | `tap-tiles` 音符下落 |

## 精细化升级（第 30–57 步）

以 C 档实写分组为准（不要用 catalog 里另一张 30–55 表）。新游戏行执行前先看 [00-id-map.md](./00-id-map.md)，把暂定 id 换成施工 id。

| 派发步 | 文档 | A | B | C |
| --- | --- | --- | --- | --- |
| 30 | [upgrades/step-30.md](./upgrades/step-30.md) | `gomoku` | `match-stars` | `rainbow-run` |
| 31 | [upgrades/step-31.md](./upgrades/step-31.md) | `ocean-munch` | `xiangqi` | `fight-king` |
| 32 | [upgrades/step-32.md](./upgrades/step-32.md) | 球球 IO | 蛇蛇 IO | `block-drop` |
| 33 | [upgrades/step-33.md](./upgrades/step-33.md) | 连招格斗 | 麻将 | 大富翁 |
| 34 | [upgrades/step-34.md](./upgrades/step-34.md) | 卡牌杀 | 围棋 | 飞行棋 |
| 35 | [upgrades/step-35.md](./upgrades/step-35.md) | `garden-guard` | `sprout-defense` | `fruit-slice` |
| 36 | [upgrades/step-36.md](./upgrades/step-36.md) | `sling-birds` | `candy-swing` | `bubble-aim` |
| 37 | [upgrades/step-37.md](./upgrades/step-37.md) | `duo-rush` | `duo-arena` | `duo-vs-star` |
| 38 | [upgrades/step-38.md](./upgrades/step-38.md) | `landlord-cards` | `gold-hook` | `bumper-cars` |
| 39 | [upgrades/step-39.md](./upgrades/step-39.md) | `ice-fire-forest` | `puff-bros` | `prince-princess` |
| 40 | [upgrades/step-40.md](./upgrades/step-40.md) | `box-hamster` | `poop-hero` | `brave-path` |
| 41 | [upgrades/step-41.md](./upgrades/step-41.md) | `adventure-king` | `alien-seek` | `bomb-buddies` |
| 42 | [upgrades/step-42.md](./upgrades/step-42.md) | `monster-crisis` | `tank-battle` | `snow-fight` |
| 43 | [upgrades/step-43.md](./upgrades/step-43.md) | `shoot-range` | `sky-squad` | `fishing-star` |
| 44 | [upgrades/step-44.md](./upgrades/step-44.md) | `balloon-pop` | `brick-break` | `bubble-pop` |
| 45 | [upgrades/step-45.md](./upgrades/step-45.md) | `fruit-catch` | `kitty-care` | `lianliankan` |
| 46 | [upgrades/step-46.md](./upgrades/step-46.md) | `memory-cards` | `mole-pop` | `puzzle-tiles` |
| 47 | [upgrades/step-47.md](./upgrades/step-47.md) | `snake-snack` | `clock-house` | `math-farm` |
| 48 | [upgrades/step-48.md](./upgrades/step-48.md) | `shape-kingdom` | `find-diff` | `pinyin-train` |
| 49 | [upgrades/step-49.md](./upgrades/step-49.md) | `word-garden` | `color-fun` | `music-stars` |
| 50 | [upgrades/step-50.md](./upgrades/step-50.md) | `red-blue-race` | `red-blue-tap` | `red-blue-tug` |
| 51–54 | [51](./upgrades/step-51.md) [52](./upgrades/step-52.md) [53](./upgrades/step-53.md) [54](./upgrades/step-54.md) | C 补位 12 款；与 B 同玩法的并到施工 id，B 没有的默认第一波不做 | | |
| 55 | [upgrades/step-55.md](./upgrades/step-55.md) | 存档 / CSS / 快捷键 | BGM / root API / 首页筛选 | destroy / 串味 |
| 56 | [upgrades/step-56.md](./upgrades/step-56.md) | 测试员 R1 | 学习优化员 R1 | 监督修复员 R1 |
| 57 | [upgrades/step-57.md](./upgrades/step-57.md) | 测试员 R2 | 学习优化员 R2 | 监督修复员 R2 |

## 怎么派

1. 复制该步文档里对应的 A/B/C 整段提示词（或复制全文末尾加「你是 A/B/C」）。
2. 模型 slug 用正文里的 `claude-opus-5-thinking-high-fast`（不要方括号）。写提示词的人用 inherit，不要拿这个 slug 跑自己。
3. 全部推 `game-1.2`，不改 `main`，禁止 force。上一步三人测试构建全绿再派下一步。
4. 执行者禁止再套娃派生云端子代理。
