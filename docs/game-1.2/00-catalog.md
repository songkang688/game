# 一朵一星 1.2 · 游戏总表与 21 款定稿

> **本文件是 A 档规划稿（别名）。** 三家并行后 id 已分叉；**新建目录以 B 档施工 id 为准**，对照表见 [`00-id-map.md`](./00-id-map.md)。下文 21 个 id 保留作别名，不要按本表再开第三套目录。
> 点清方式：`git ls-tree -r --name-only origin/<branch> | grep 'src/games/.*/meta.ts'`。
> 排行依据：2025 抖音小游戏热门榜常客（球球 / 长蛇 IO、台球、麻将、数独、找茬类已有 `find-diff`）、HTML5 常青树（四格骨牌、数字合成、扫雷、纸牌、翻转棋、围棋、飞行棋）以及大人也玩的棋牌 / 格斗 / 弹幕生存 / 竞速。面向孩子的 UI / 文案 / 注释 **禁止商标**；下表「参考原作类型」只给执行者内部研究，不得写进游戏。

## 一、计数公式

```
origin/main            = 34     # 1.0
origin/game-1.1        = 54     # 有 bumper-cars，无 bowling-lane
origin/game-1.2 基线   = 53     # 尚缺 bumper-cars
1.1 规划完成库存 N_1_1 = 55     # 34 + 21，含 bumper-cars + bowling-lane
N_new                  = 21
N_total                = 76
N_upgrade_steps        = ceil(76 / 3) = 26   # 派发步 30–55
N_new_steps            = 21 / 3 = 7          # 派发步 10–16
```

`bowling-lane` 不占 21 名额：它是 1.1 第 7 步 C 的规划债。升级步 43 的 A 若发现目录不存在，先按 1.1 规格落地再做 1.2 精细化。

## 二、21 款新游戏（id 定稿，不得改）

`platform`：`mobile` = 首页「手游」筛得中；`desktop` = 「端游」筛得中；`both` = 两个都能中。缺省（老游戏未填）按 `both` 处理，见第 1 步 B。

| # | id | 中文标题 | 品类 | 平台 | 参考原作类型（内部，禁止进 UI） | 为何入选 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `orb-royale` | 圆圆大乱斗 | party | mobile | IO 吞噬生长大乱斗（非 `ocean-munch` 侧视吃鱼、非 `snake-snack` 格子蛇） | 用户点名；抖音热门榜常客 |
| 2 | `snake-clash` | 长蛇大乱斗 | party | mobile | IO 斜向加速吃球蛇大乱斗（非 `snake-snack` 复刻） | 用户点名；与上款成对的 IO 品类 |
| 3 | `block-drop` | 方块掉掉乐 | casual | both | 七种四格骨牌、消行、SRS 踢墙 | 用户点名；HTML5 常青第一梯队 |
| 4 | `combo-arena` | 连招擂台 | party | desktop | 2D 连招格斗（取消表 / 帧数据 / 防御系统）。**禁止复用或扩写 `fight-king`** | 用户点名要明显更深，必须新 id |
| 5 | `mahjong-table` | 四方麻将 | party | desktop | 四人国标向麻将（非「连连看式」单人翻牌） | 用户点名；棋牌排行常驻 |
| 6 | `star-mogul` | 星星大富翁 | party | desktop | 掷骰走格买地收租的家庭桌游 | 用户点名；大人小孩都能坐一桌 |
| 7 | `hero-tactics` | 英雄卡牌杀 | party | desktop | 身份 + 手牌 + 装备的桌面卡牌杀 | 用户点名；策略深度给六年级 + 大人 |
| 8 | `weiqi-ink` | 围子墨盘 | casual | desktop | 19/13/9 路围子、气与提子 | 用户点名；已有象棋 / 五子棋，缺围子 |
| 9 | `flight-chess` | 飞行棋派对 | party | both | 四色飞行棋 / 掷骰回家 | 用户点名；聚会向 |
| 10 | `table-pool` | 台球小屋 | casual | desktop | 俯视台球物理（撞球、袋口、进球） | 2025 抖音热门榜台球类占比高 |
| 11 | `sudoku-garden` | 数独小园 | edu | both | 9×9 数独生成 + 候选数 | 益智常青；「每天数独」类产品活跃 |
| 12 | `merge-2048` | 数字合成 | casual | mobile | 滑向合并 2 的幂 | 全球最著名的 HTML5 益智之一 |
| 13 | `petal-scout` | 花田探宝 | casual | mobile | 扫雷：数字提示 + 插旗 | 常青；做成「花田探宝」无爆炸描写 |
| 14 | `fruit-orb` | 果果合成 | casual | mobile | 重力下落同类合成（非 `fruit-catch` 接、非 `fruit-slice` 切） | 近年合成品类大人也刷 |
| 15 | `lily-hop` | 荷叶跳跳 | action | mobile | 时机跳跃、平台越来越窄 | 国民级「跳一跳」手感，适合触屏 |
| 16 | `reversi-ink` | 黑白翻转棋 | casual | both | 8×8 翻转棋 | 棋类常青，AI 档好做，补棋牌矩阵 |
| 17 | `klondike-cards` | 纸牌接龙 | casual | desktop | 单人接龙（七列、四个花色家） | 端游经典；大人办公室常青 |
| 18 | `beat-tap` | 节奏点点 | casual | mobile | 下落音符点按 / 滑键（非 `music-stars` 作曲沙盒） | 音游手感；手游筛选的代表 |
| 19 | `kart-dash` | 卡丁竞速 | action | mobile | 俯视/2.5D 短程竞速（非 `rainbow-run` 跑酷） | 竞速品类空缺；大人也爱比谁快 |
| 20 | `glow-survivor` | 光点幸存者 | action | mobile | 自动攻击 + 走位的弹幕生存 | 近年最能留大人的休闲动作 |
| 21 | `air-puck` | 桌上冰球 | party | both | 空气曲棍球、双人各守一门 | 街机双人；键位正好对上朵朵/星星 |

### 2.1 必须避开的已有 id（禁止撞名、禁止复刻）

`snake-snack` 贪吃毛毛虫、`ocean-munch` 海底大胃王、`fight-king` 朵星格斗王、`xiangqi` 朵朵星星象棋（**只升级不新建**）、`gomoku` 五子棋、`match-stars` 星星消消乐、`landlord-cards` 朵朵抢地主、`duo-arena` / `duo-vs-star`、`music-stars`、`fruit-catch` / `fruit-slice`、`rainbow-run` / `duo-rush`。

`combo-arena` 与 `fight-king` 的分界（执行者必读）：

| | `fight-king`（已有，升级步 33 的 B） | `combo-arena`（新，接入步 11 的 A） |
| --- | --- | --- |
| 定位 | 卡通八人、超必杀演出、格斗塔 188 | **街机连招深度**：三段跳、投技投技破解、取消窗口以帧计、训练模式显示帧数 |
| 角色 | 继续用八位原创小人 | **另一套 6 名原创格斗家**（新名字，禁止抄 fight-king 的招式表） |
| 文件 | 只许改 `src/games/fight-king/**` | 只许新建 `src/games/combo-arena/**` |

### 2.2 新游戏接入步分组（派发步 10–16，每步 A/B/C 各一款）

| 派发步 | A | B | C | B 档文档 |
| --- | --- | --- | --- | --- |
| 10 | `orb-royale` 圆圆大乱斗 | `snake-clash` 长蛇大乱斗 | `block-drop` 方块掉掉乐 | `docs/game-1.2/new-games/step-10.md` |
| 11 | `combo-arena` 连招擂台 | `mahjong-table` 四方麻将 | `star-mogul` 星星大富翁 | `docs/game-1.2/new-games/step-11.md` |
| 12 | `hero-tactics` 英雄卡牌杀 | `weiqi-ink` 围子墨盘 | `flight-chess` 飞行棋派对 | `docs/game-1.2/new-games/step-12.md` |
| 13 | `table-pool` 台球小屋 | `sudoku-garden` 数独小园 | `merge-2048` 数字合成 | `docs/game-1.2/new-games/step-13.md` |
| 14 | `petal-scout` 花田探宝 | `fruit-orb` 果果合成 | `lily-hop` 荷叶跳跳 | `docs/game-1.2/new-games/step-14.md` |
| 15 | `reversi-ink` 黑白翻转棋 | `klondike-cards` 纸牌接龙 | `beat-tap` 节奏点点 | `docs/game-1.2/new-games/step-15.md` |
| 16 | `kart-dash` 卡丁竞速 | `glow-survivor` 光点幸存者 | `air-puck` 桌上冰球 | `docs/game-1.2/new-games/step-16.md` |

每款最低交付（B 档正文必须写进各步提示词）：

- 目录 `src/games/<id>/`：`meta.ts`（含 `id/title/emoji/category/color/blurb/modes/platform/levels?`）+ `index.ts` + 纯逻辑 `logic.ts`/`rules.ts` + `*.test.ts`（**≥ 15 用例**）
- 闯关能走 `level99.ts` 的做满 188 关（≥ 8 章）；纯对战 / 无尽写明为什么不做 188
- 双人键位与触屏；`destroy` 干净；离线；无商标；失败只鼓励
- 本步 **不改** `src/ui/home.ts`（首页接线在派发步 60）

内部可参考的开源实现（只许学结构，不许搬素材 / 商标 / 协议代码）：

| id | 可参考（GitHub） |
| --- | --- |
| `orb-royale` | `owenashurst/agar.io-clone`（Canvas；1.2 必须改成本地人机，禁止 Socket 联网） |
| `snake-clash` | 各类 slither 开源客户端的「转向 + 加速 + 吃球变长」结构 |
| `block-drop` | `sen-ltd/tetris`（SRS 踢墙、7-bag、幽灵块、DAS） |
| `combo-arena` | 既有 `fight-king` 的帧数据拆法 + 开源 2D 格斗的取消表思路；角色招式全部原创 |
| `mahjong-table` | `i711net/mahjong`（四人桌，不是 solitaire） |
| `star-mogul` | `itaylayzer/Monopoly` 的走格子 / 地契状态机（地图与卡牌原创） |
| `hero-tactics` | 开源桌面卡牌杀的「身份-手牌-装备-距离」结构（武将名全部原创） |
| `weiqi-ink` | WGo.js / Sabaki 的气与提子算法 |
| `flight-chess` | 各类 Ludo / 飞行棋规则引擎 |
| `table-pool` | 开源 2D 台球（动量守恒 + 袋口判定） |
| `sudoku-garden` | `KoRifCan/Classic-Games` 的数独生成器思路 |
| `merge-2048` | `gabrielecirulli/2048` 的滑向合并 |
| `petal-scout` | 经典扫雷 chord / 开空递归（文案改探花，不要雷、不要炸） |
| `fruit-orb` | 开源合成大球的刚体堆叠（球体用原创水果名） |
| `lily-hop` | 时机条 + 落点距离的跳一跳结构 |
| `reversi-ink` | 标准翻转棋合法点 + 极小极大 AI |
| `klondike-cards` | 标准 Klondike 规则引擎 |
| `beat-tap` | 下落音符判定窗（Perfect / Good / Miss），谱面用 JSON |
| `kart-dash` | 2.5D 跑道透视 + 道具 |
| `glow-survivor` | 自动弹幕 + 经验升级三选一 |
| `air-puck` | 空气曲棍球摩擦 / 球门判定 |

## 三、1.1 完成后的 55 款全量表

分类沿用 `src/engine/types.ts`：`action` 闯关 / `casual` 休闲 / `party` 对战 / `edu` 学习 / `create` 动手。
`platform` 列为 1.2 建议值（第 1 步 B 给类型与默认 `both`；升级步再写成准确值）。

### 3.1 来自 1.0 的 34 款

| id | 标题 | 分类 | 建议 platform | 升级要点（给 C 档） |
| --- | --- | --- | --- | --- |
| `garden-guard` | 花园守卫 | action | both | 塔防手感、主题建模、手机 HUD |
| `ocean-munch` | 海底大胃王 | action | mobile | **必须加无尽**；体型差判定更跟手 |
| `sprout-defense` | 绿芽保卫战 | action | both | 路线/波次可读，2.5D 场景可选 |
| `rainbow-run` | 彩虹跑跑 | action | mobile | **2.5D/伪 3D 跑道**、三键、无尽 |
| `fruit-slice` | 水果切切乐 | action | mobile | 刀光拖尾、连刀手感、安全区 |
| `sling-birds` | 弹弹小鸟 | action | both | 弹弓手感、主题建模（无商标） |
| `candy-swing` | 糖果秋千 | action | mobile | 绳物理、360px 指尖热区 |
| `balloon-pop` | 气球砰砰 | casual | mobile | 物理、连击、窄屏文字 |
| `brick-break` | 碰碰砖块 | casual | both | 反弹手感、关卡砖型 |
| `bubble-aim` | 泡泡瞄准手 | casual | both | 瞄准辅助线、消行掉落动画 |
| `bubble-pop` | 泡泡噗噗 | casual | mobile | 触控、连消 |
| `fruit-catch` | 接住小水果 | casual | mobile | 双人键位、难度曲线 |
| `gomoku` | 五子棋 | party | desktop | **解局闯关 188 + 人机多档（菜鸟→地狱）** |
| `kitty-care` | 萌猫小屋 | casual | mobile | 养成反馈、手机文字 |
| `lianliankan` | 连连看 | casual | mobile | 连线动画、洗牌公平 |
| `match-stars` | 星星消消乐 | casual | mobile | **方块必须有下落过程**（不能瞬移） |
| `memory-cards` | 记忆翻翻乐 | casual | mobile | 翻牌动画、主题 |
| `mole-pop` | 地鼠嘭嘭 | casual | mobile | 打击判定、节奏 |
| `puzzle-tiles` | 拼图乐园 | casual | both | 吸附、预览 |
| `snake-snack` | 贪吃毛毛虫 | casual | mobile | 保持格子蛇；不要做成 IO |
| `red-blue-race` | 红蓝赛跑 | party | both | 双人不同键、无尽 |
| `red-blue-tap` | 红蓝点点 | party | mobile | 手速、公平 |
| `red-blue-tug` | 红蓝拔河 | party | both | 手感、2.5D 可选 |
| `duo-arena` | 朵星擂台 | party | both | 对战深度、不要无关卡凑 188 |
| `duo-rush` | 朵星双人冲刺 | party | mobile | 2.5D 双人竞速 |
| `xiangqi` | 朵朵星星象棋 | party | desktop | **升级不新建**：残局闯关 + 人机多档 + 将军提示 |
| `clock-house` | 时钟小屋 | edu | both | 六年级难度、攻略不泄题 |
| `find-diff` | 找不同 | edu | mobile | 热区、窄屏两图 |
| `math-farm` | 算数小农场 | edu | both | 六年级题型、朗读 |
| `pinyin-train` | 拼音小火车 | edu | both | 声母韵母、不泄题 |
| `shape-kingdom` | 形状王国 | edu | both | 空间推理 |
| `word-garden` | 识字小花园 | edu | both | 六年级识字量 |
| `color-fun` | 涂色小屋 | create | mobile | 填色工具、安全区 |
| `music-stars` | 音乐星星 | create | both | 保持作曲沙盒，不要改成音游 |

### 3.2 来自 1.1 规划的 21 款

| id | 标题 | 分类 | 建议 platform | 现状 | 升级要点 |
| --- | --- | --- | --- | --- | --- |
| `landlord-cards` | 朵朵抢地主 | party | desktop | 1.1 已有 | 牌力提示、三人 AI、出牌动画 |
| `gold-hook` | 金矿钩钩 | action | mobile | 1.1 已有 | 钩索手感、矿洞 2.5D |
| `fishing-star` | 钓鱼小达人 | casual | mobile | 1.1 已有 | 收杆手感、图鉴 |
| `bumper-cars` | 碰碰车大乱斗 | party | both | **在 1.1，不在 1.2 基线** | 先 rebase 再升级撞击物理 |
| `bowling-lane` | 保龄球小馆 | casual | both | **两分支都缺** | 步 43 A 先落地再升级；球路 3D 透视 |
| `ice-fire-forest` | 冰冰火火森林 | action | both | 1.1 已有 | 双人合作、2.5D 关卡 |
| `puff-bros` | 噗噗兄弟 | action | both | 1.1 已有 | 平台跳跃手感、2.5D |
| `prince-princess` | 王子公主大冒险 | action | both | 1.1 已有 | 双人、关卡阅读性 |
| `box-hamster` | 推箱小仓鼠 | casual | both | 1.1 已有 | 残局可解性、撤销 |
| `poop-hero` | 便便超人 | action | mobile | 1.1 已有 | 分级干净、手感 |
| `brave-path` | 勇者小路 | action | both | 1.1 已有 | 2.5D 迷宫、成长 |
| `adventure-king` | 冒险小王 | action | both | 1.1 已有 | 探索、地图 |
| `alien-seek` | 寻找外星朋友 | casual | mobile | 1.1 已有 | 找物、主题 |
| `fight-king` | 朵星格斗王 | party | desktop | 1.1 已有 | 加深手感，**不要做成 combo-arena** |
| `duo-vs-star` | 朵朵大战星星 | party | both | 1.1 已有 | 对战平衡 |
| `shoot-range` | 星星射击场 | action | both | 1.1 已有 | 后坐力/准星、无尽 |
| `sky-squad` | 飞机小队 | action | mobile | 1.1 已有 | 弹幕、2.5D 可选 |
| `monster-crisis` | 小怪物危机 | action | both | 1.1 已有 | 无血无伤文案、波次 |
| `bomb-buddies` | 泡泡炸弹人 | party | both | 1.1 已有 | 放泡时机、双人 |
| `tank-battle` | 铁皮坦克大战 | party | both | 1.1 已有 | 弹道、地图 |
| `snow-fight` | 雪球大作战 | party | both | 1.1 已有 | 投掷手感 |

## 四、精细化升级步分组（派发步 30–55）

每步 3 个子代理、每款一个子代理、独占 `src/games/<id>/**`。C 档正文落在 `docs/game-1.2/upgrades/step-XX.md`。
升级发生在 21 款新游戏全部接入之后，所以步 48 起会升到「刚接入的新游戏」——这是故意的：先能玩，再精细化。

每款升级提示词至少覆盖：规则对不对、玩法类型、闯关/对战/无尽是否兼容、2.5D/3D 是否升级、前端建模、视觉、手感、手机文字（360px）、可参考开源项目。

| 派发步 | A | B | C | C 档文档 |
| --- | --- | --- | --- | --- |
| 30 | `match-stars` | `gomoku` | `lianliankan` | `upgrades/step-30.md` |
| 31 | `snake-snack` | `ocean-munch` | `brick-break` | `upgrades/step-31.md` |
| 32 | `rainbow-run` | `duo-rush` | `candy-swing` | `upgrades/step-32.md` |
| 33 | `xiangqi` | `fight-king` | `duo-arena` | `upgrades/step-33.md` |
| 34 | `balloon-pop` | `bubble-pop` | `bubble-aim` | `upgrades/step-34.md` |
| 35 | `fruit-catch` | `fruit-slice` | `mole-pop` | `upgrades/step-35.md` |
| 36 | `memory-cards` | `puzzle-tiles` | `kitty-care` | `upgrades/step-36.md` |
| 37 | `clock-house` | `math-farm` | `pinyin-train` | `upgrades/step-37.md` |
| 38 | `word-garden` | `shape-kingdom` | `find-diff` | `upgrades/step-38.md` |
| 39 | `color-fun` | `music-stars` | `red-blue-race` | `upgrades/step-39.md` |
| 40 | `red-blue-tap` | `red-blue-tug` | `garden-guard` | `upgrades/step-40.md` |
| 41 | `sprout-defense` | `sling-birds` | `gold-hook` | `upgrades/step-41.md` |
| 42 | `landlord-cards` | `fishing-star` | `bumper-cars` | `upgrades/step-42.md` |
| 43 | `bowling-lane` | `ice-fire-forest` | `puff-bros` | `upgrades/step-43.md` |
| 44 | `prince-princess` | `box-hamster` | `poop-hero` | `upgrades/step-44.md` |
| 45 | `brave-path` | `adventure-king` | `alien-seek` | `upgrades/step-45.md` |
| 46 | `duo-vs-star` | `shoot-range` | `sky-squad` | `upgrades/step-46.md` |
| 47 | `monster-crisis` | `bomb-buddies` | `tank-battle` | `upgrades/step-47.md` |
| 48 | `snow-fight` | `orb-royale` | `snake-clash` | `upgrades/step-48.md` |
| 49 | `block-drop` | `combo-arena` | `mahjong-table` | `upgrades/step-49.md` |
| 50 | `star-mogul` | `hero-tactics` | `weiqi-ink` | `upgrades/step-50.md` |
| 51 | `flight-chess` | `table-pool` | `sudoku-garden` | `upgrades/step-51.md` |
| 52 | `merge-2048` | `petal-scout` | `fruit-orb` | `upgrades/step-52.md` |
| 53 | `lily-hop` | `reversi-ink` | `klondike-cards` | `upgrades/step-53.md` |
| 54 | `beat-tap` | `kart-dash` | `glow-survivor` | `upgrades/step-54.md` |
| 55 | `air-puck` | （见下） | （见下） | `upgrades/step-55.md` |

**步 55 余数处理**（76 % 3 = 1）：A 独占升级 `air-puck`。B 独占新建 `src/games/_catalog/meta-audit.test.ts`（glob 全部 `meta.ts`，断言每款都有合法 `platform` 与非空 `modes`，id 无重复，21 个新 id 都在）。C 独占新建 `src/engine/view25d.catalog.test.ts`（断言 `view25d.ts` 导出稳定、默认相机、`prefers-reduced-motion` 降级路径）。B/C 这两份测试文件本步才允许出现，前面的升级步不许抢。

步 30 硬指标（用户点名的例子，C 档不得写软）：

- `match-stars`：消除后上方方块必须有**逐格下落过程**（位置插值或步进动画），禁止瞬移补位；`prefers-reduced-motion` 可改为短位移但仍要「经过中间格」。
- `gomoku`：残局闯关补到 **188** 道可解局 + 人机至少 **5 档**（菜鸟 / 入门 / 普通 / 高手 / 地狱）；地狱档允许更深搜索但必须有思考延时，不许无敌秒应。

步 31–33 硬指标：

- `ocean-munch`：补 `endless` 模式并写入 `meta.modes`。
- `rainbow-run` / `duo-rush`：用第 1 步 C 的 `view25d` 把跑道做成透视 2.5D；禁止引入 three.js。
- `xiangqi`：残局闯关 + 人机多档；不新建第二个象棋 id。

## 五、商标黑名单（面向孩子的任何字符都不许出现，含注释）

在 1.1 名单上再加（包括但不限于）：球球大作战、贪吃蛇大作战、俄罗斯方块、Tetris、拳皇、KOF、三国杀、大富翁、Monopoly、Agar、Slither、Among Us、羊了个羊、合成大西瓜、跳一跳、地铁跑酷、开心消消乐、QQ、微信、腾讯、网易。执行者内部研究可以用「IO 吞噬」「四格骨牌」「身份卡牌」这种类型词。
