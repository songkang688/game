# 1.2 第 2 步 · B 档 —— `snake-royale`「长蛇争霸」

> 短计划：独占新建 `src/games/snake-royale/`。本步另两档是 `orb-arena`、`block-drop`，一个字都别碰。
> 这是俯视 IO 蛇蛇大乱斗（连续空间、加速、击杀吃光、皮肤长度），**不是** `snake-snack` 格子迷宫蛇。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理；必须自己动手把活干完。只推 `game-1.2`，不要改 main、不要 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 **1.2 版本第 2 步 / 共 7 步新游戏接入** 的 **B 档**：新建 `snake-royale`「长蛇争霸」。假设 1.1 的 55 款已全部做完。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。开工前先提交一条 git 记录。
- **只在 game-1.2 线上干活**，不要改 main，不要用 gh 写 PR。
- 收尾：fetch → rebase origin/game-1.2 → `npm test` && `npm run build` → 普通 push。**禁止 force。**

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据（不许 import 玩法）+ `index.ts` 顶部 `export { meta } from "./meta"` + `mount(api): { destroy }` 懒加载。首页 `import.meta.glob` 自动收集，**不要改 `src/ui/home.ts`**。
- 闯关走 `src/games/level99.ts` 做满 **188** 关，`assertTotal(chapters, 188)`。存档 key `yiduo-yixing.l99.snake-royale`。
- `destroy` 清 listener / timer / rAF / AudioContext。音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。无外部运行时依赖。
- 键位：朵朵 `WASD`+`F`（加速）/`G`（可选皮肤轮换或刹车），星星方向键+`L`/`K`，`Esc` 暂停。手机：摇杆 + 加速大钮（热区 ≥ 44px）。
- **收藏只读**：`collectionEffects()` 的 `speedMul` 只乘基础巡航速度，禁止改 `collection.ts` / `yiduo-yixing.collection.v1`。暂停可 `openCollection("snake-royale")`。
- 禁止商标文案（含注释）：不要写「贪吃蛇大作战」「Slither」。失败只鼓励。无血：出局是蛇身噗噗变成光点。
- 360px：小地图可关，加速钮右下大圆，长度数字 ≥ 13px。验证 360 / 375 / 1280。
- 不要改 supervisor / step1 / step9+ / 1.1 文件，不要删 `docs/game-1.2/new-games/`。

## 你只做这一款

### meta
```
id: "snake-royale"
title: "长蛇争霸"
emoji: "🐍"
category: "action"
color: "#D4F5E0"
blurb: "在圆形沙场里越吃越长！加速冲线、让对手撞上你的身体，再把光点吃光。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 这不是什么
- **不是** `snake-snack`「贪吃毛毛虫」：那是格子迷宫、双身位、传送门、188 关花园，没有加速扣长度、没有击杀吃尸体、没有皮肤长度。
- 本款是 **俯视 IO 大乱斗**：连续空间、转向有惯性、加速、击杀、尸体光点、皮肤决定初始长度/花纹。

### 完整规则

#### 身体与转向
- 蛇是一组间距均匀的关节点（不是格子）。头按当前朝向前进，身体点追上一节。
- 转向：瞄准方向（鼠标 / 摇杆 / WASD 合成向量）以 `TURN_RATE` 弧度/秒转向，**不能原地掉头**（最小转弯半径随长度略增）。
- 撞到 **自己身体** 默认 **不死**（避免新手自杀过虐；战役后段可开「自碰休息」作为机制关）。
- 头撞到 **别人身体**（非头）→ 自己出局。头对头：双方都出局，或质量/长度较长者胜（抽成常量 `HEAD_TIE`，默认双方出局）。
- 头撞 **地图圆边界** → 出局，**不掉尸体光点**（边界击杀没奖励，鼓励往场中对决）。

#### 加速
- 按住 `F` / 加速钮：速度 × `BOOST_MUL`（约 1.8）。
- 代价：每秒消耗约 1% 当前长度（抽 `BOOST_COST`），并把消耗的质量以光点洒在轨迹上。
- `length < BOOST_MIN`（约 30 单位）时不能加速。
- 加速时蛇身闪「亮斑」，别人能看见你在加速。

#### 击杀与吃光
- 出局者身体 **全部变成光点**（比普通彩豆更大更亮，颜色随皮肤）。
- 任何人都可以吃这些光点。**吃光** = 尽量把这一团吃完，这是快速变长的主途径。
- 普通彩豆刷在全图，小、暗；尸体光点亮、大。长度增量：尸体 > 亮彩豆 > 暗彩豆。

#### 皮肤与长度
- 至少 **12 套原创皮肤**（花纹/渐变，纯 Canvas 画，不引入图片）。用平台星星解锁（读 `api.getStars()` / `addStars`，或独立 key `yiduo-yixing.snake-royale.skins.v1`，**不要改** `yiduo-yixing.save.v1` 既有字段，也不要改收藏 key）。
- 皮肤效果只允许：初始长度 +0/~+40%、花纹不同。**禁止战力皮肤**（不要移速加成；移速只走收藏 `speedMul`）。
- HUD 显示当前长度（米）与排行榜 Top 10。

#### 胜负
- 出局 = 本条蛇休息。对战：最后存活或限时长度第一。
- 无尽：死亡结算最高长度，`save.recordEndlessBest("snake-royale", length)`。
- 闯关：活到 T 秒 / 达到 L 长度 / 击杀 K 条 / 吃光一团尸体。

### 系统表
| 系统 | 抽成 |
| --- | --- |
| 转向积分 | `steer(headDir, wishDir, turnRate, dt)` |
| 身体跟随 | `followJoints(joints, spacing)` |
| 碰撞头-身 | `headHitsBody(head, otherJoints, radius)` |
| 边界 | `headHitsArena(head, arenaR)` |
| 加速消耗 | `boostTick(length, dt) → {length, droppedPellets}` |
| 尸体分解 | `explodeToPellets(joints, skin)` |
| 吃点 | `eatPellets(head, pellets)` |
| 排行 | `leaderboard(snakes)` |

### 模式
| 模式 | 做 | 说明 |
| --- | --- | --- |
| 闯关 188 | 是 | 小场地教学目标 |
| 对战 | 是 | 1+最多 15 AI，或双人混战 |
| 无尽 | 是 | 不断刷 AI，长度纪录 |
| 双人 | 是 | 同场两条蛇，键位不抢占 |

### 关卡切分（188，9 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 绿茵练习圈 | 22 | 只有彩豆，无敌蛇，练转弯 |
| 2 | 加速跑道 | 22 | 必须加速钻环 |
| 3 | 双蛇过招 | 22 | 引入 1 条很笨的 AI，教「让它撞你」 |
| 4 | 光点盛宴 | 20 | 场上预置尸体光点，目标吃光 |
| 5 | 围捕花园 | 20 | 用身体围住目标蛇 |
| 6 | 边界悬崖 | 20 | 圆场地变小，教借边 |
| 7 | 自碰试炼 | 20 | 本章开自碰休息，教盘身 |
| 8 | 十蛇乱斗 | 20 | 高密度 AI |
| 9 | 争霸杯 | 22 | 全机制 + 皮肤关（指定初始长度） |

22×3+20×5+22 = 66+100+22 = 188。

### 前端建模与动画
- Canvas 2D：网格/径向渐变地面、蛇身圆润胶囊、加速粒子。
- **死亡不是爆炸血腥**：蛇身从前往后「噗噗」变成光点，200–400ms 链式动画，禁止整条瞬删。
- 摄像机跟随蛇头，略超前。`prefers-reduced-motion` 关掉链式粒子，仍要逐节淡出。
- 360px 文字 ≥ 13px；长度数字要够大。

### AI 档位
| 档 | 行为 |
| --- | --- |
| 菜鸟 | 近似直线，见墙才转，从不加速 |
| 普通 | 躲身体、吃最近光点，偶尔加速 |
| 高手 | 会卡头（加速横挡在你前方） |
| 地狱 | 会围捕、会诱饵加速、会抢尸体 |

固定 seed 地狱 vs 菜鸟 20 局胜率显著更高——写成测试。

### 可参考 GitHub（结构 only，不引入运行时依赖）
- https://github.com/ClaudiuCreanga/slither.io-clone （若不可用则看任意 slither 开源的关节跟随）
- 不要引入 websocket。

### 独占文件
只许 `src/games/snake-royale/**`，可选 `scripts/smoke-step2-b.mjs`。
禁止碰 `snake-snack`、`orb-arena`、`block-drop`、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 20（硬性 ≥ 15）
转向不瞬移、加速扣长度且低于阈值不能加速、头撞身出局、头撞墙出局且无尸体、尸体光点总量守恒（分解质量 ≈ 原长度）、自碰开关、188 章和、AI 档位、双人键位映射不交叉。

### 不要做什么
- 不要做成格子贪吃蛇。
- 不要穿墙（除明确隧道关）。
- 不要商标皮肤名。
- 不要联网。

### 验收 checkbox
- [ ] 与 `snake-snack` 玩法明显不同
- [ ] 加速 / 击杀吃光 / 皮肤长度都在
- [ ] 188 + 对战 + 无尽 + 双人
- [ ] 出局有链式光点动画
- [ ] 360px / 375 / 1280 可玩
- [ ] `npm test` `npm run build` 绿；destroy 干净
- [ ] 收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 B、文件列表、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
