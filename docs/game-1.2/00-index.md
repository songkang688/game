# 一朵一星 1.2 · 文档目录（给人看）

主管文档：[00-supervisor.md](./00-supervisor.md)  
游戏总表与 21 款 id 定稿：[00-catalog.md](./00-catalog.md)  
代码基线：[../upgrade-prompts/12-game-1.2-baseline.md](../upgrade-prompts/12-game-1.2-baseline.md)  
1.1 对照派发脚本：[../upgrade-prompts/11-game-1.1-dispatch-prompts.md](../upgrade-prompts/11-game-1.1-dispatch-prompts.md)

1.2 一共 **38** 个派发步（公式见主管文档）。下面按派发顺序排列。标注「待 B/C」的文件在提示词工程阶段由另外两档落地，落地前链接会 404，这是预期。

## 平台（01–09，本档只做第 1 步）

| 派发步 | 文档 | 状态 |
| --- | --- | --- |
| 1 | [step-01.md](./step-01.md) | A 档已写（root 门 / 手游端游+手机文字 / 模式与 2.5D 基建） |
| 2–09 | （预留，不使用） | 平台不拆第 2 步 |

## 新游戏接入（10–16，B 档）

| 派发步 | 文档 | A | B | C |
| --- | --- | --- | --- | --- |
| 10 | [new-games/step-10.md](./new-games/step-10.md) | `orb-royale` | `snake-clash` | `block-drop` |
| 11 | [new-games/step-11.md](./new-games/step-11.md) | `combo-arena` | `mahjong-table` | `star-mogul` |
| 12 | [new-games/step-12.md](./new-games/step-12.md) | `hero-tactics` | `weiqi-ink` | `flight-chess` |
| 13 | [new-games/step-13.md](./new-games/step-13.md) | `table-pool` | `sudoku-garden` | `merge-2048` |
| 14 | [new-games/step-14.md](./new-games/step-14.md) | `petal-scout` | `fruit-orb` | `lily-hop` |
| 15 | [new-games/step-15.md](./new-games/step-15.md) | `reversi-ink` | `klondike-cards` | `beat-tap` |
| 16 | [new-games/step-16.md](./new-games/step-16.md) | `kart-dash` | `glow-survivor` | `air-puck` |

## 全量精细化升级（30–55，C 档）

| 派发步 | 文档 | A | B | C |
| --- | --- | --- | --- | --- |
| 30 | [upgrades/step-30.md](./upgrades/step-30.md) | `match-stars` | `gomoku` | `lianliankan` |
| 31 | [upgrades/step-31.md](./upgrades/step-31.md) | `snake-snack` | `ocean-munch` | `brick-break` |
| 32 | [upgrades/step-32.md](./upgrades/step-32.md) | `rainbow-run` | `duo-rush` | `candy-swing` |
| 33 | [upgrades/step-33.md](./upgrades/step-33.md) | `xiangqi` | `fight-king` | `duo-arena` |
| 34 | [upgrades/step-34.md](./upgrades/step-34.md) | `balloon-pop` | `bubble-pop` | `bubble-aim` |
| 35 | [upgrades/step-35.md](./upgrades/step-35.md) | `fruit-catch` | `fruit-slice` | `mole-pop` |
| 36 | [upgrades/step-36.md](./upgrades/step-36.md) | `memory-cards` | `puzzle-tiles` | `kitty-care` |
| 37 | [upgrades/step-37.md](./upgrades/step-37.md) | `clock-house` | `math-farm` | `pinyin-train` |
| 38 | [upgrades/step-38.md](./upgrades/step-38.md) | `word-garden` | `shape-kingdom` | `find-diff` |
| 39 | [upgrades/step-39.md](./upgrades/step-39.md) | `color-fun` | `music-stars` | `red-blue-race` |
| 40 | [upgrades/step-40.md](./upgrades/step-40.md) | `red-blue-tap` | `red-blue-tug` | `garden-guard` |
| 41 | [upgrades/step-41.md](./upgrades/step-41.md) | `sprout-defense` | `sling-birds` | `gold-hook` |
| 42 | [upgrades/step-42.md](./upgrades/step-42.md) | `landlord-cards` | `fishing-star` | `bumper-cars` |
| 43 | [upgrades/step-43.md](./upgrades/step-43.md) | `bowling-lane` | `ice-fire-forest` | `puff-bros` |
| 44 | [upgrades/step-44.md](./upgrades/step-44.md) | `prince-princess` | `box-hamster` | `poop-hero` |
| 45 | [upgrades/step-45.md](./upgrades/step-45.md) | `brave-path` | `adventure-king` | `alien-seek` |
| 46 | [upgrades/step-46.md](./upgrades/step-46.md) | `duo-vs-star` | `shoot-range` | `sky-squad` |
| 47 | [upgrades/step-47.md](./upgrades/step-47.md) | `monster-crisis` | `bomb-buddies` | `tank-battle` |
| 48 | [upgrades/step-48.md](./upgrades/step-48.md) | `snow-fight` | `orb-royale` | `snake-clash` |
| 49 | [upgrades/step-49.md](./upgrades/step-49.md) | `block-drop` | `combo-arena` | `mahjong-table` |
| 50 | [upgrades/step-50.md](./upgrades/step-50.md) | `star-mogul` | `hero-tactics` | `weiqi-ink` |
| 51 | [upgrades/step-51.md](./upgrades/step-51.md) | `flight-chess` | `table-pool` | `sudoku-garden` |
| 52 | [upgrades/step-52.md](./upgrades/step-52.md) | `merge-2048` | `petal-scout` | `fruit-orb` |
| 53 | [upgrades/step-53.md](./upgrades/step-53.md) | `lily-hop` | `reversi-ink` | `klondike-cards` |
| 54 | [upgrades/step-54.md](./upgrades/step-54.md) | `beat-tap` | `kart-dash` | `glow-survivor` |
| 55 | [upgrades/step-55.md](./upgrades/step-55.md) | `air-puck` | `meta-audit.test.ts` | `view25d.catalog.test.ts` |

## 首页 / 验收（60–63，C 档）

| 派发步 | 文档 | 主题 |
| --- | --- | --- |
| 60 | [upgrades/step-60.md](./upgrades/step-60.md) | 首页接线 / 冲突 / 文案 / a11y |
| 61 | [upgrades/step-61.md](./upgrades/step-61.md) | 验收三人组第 1 轮 |
| 62 | [upgrades/step-62.md](./upgrades/step-62.md) | 验收三人组第 2 轮 |
| 63 | [upgrades/step-63.md](./upgrades/step-63.md) | 验收三人组第 3 轮（收官） |

## 收口总脚本（主管在 B/C 写完后拼）

- 目标：`docs/upgrade-prompts/13-game-1.2-dispatch-prompts.md`
- 检查清单见 [00-supervisor.md 第九节](./00-supervisor.md)
