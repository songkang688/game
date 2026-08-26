# 一朵一星 1.1 基线记录（分支 `game-1.1`）

> 本文件是 1.1 版本开发的**起点快照**。所有 1.1 的工作都做在分支 `game-1.1` 上，
> 派发提示词见同目录 `11-game-1.1-dispatch-prompts.md`。

## 一、基线

| 项 | 值 |
| --- | --- |
| 基线分支 | `origin/main` |
| 基线 SHA | `f5af78942e298a095317d6a21b30689eab53dfd1` |
| 开发分支 | `game-1.1`（从上述 SHA 拉出） |
| 建库方式 | `git fetch origin main` → `git checkout -B game-1.1 origin/main` |

## 二、基线验证（本机实跑，全绿）

- `npm ci`：成功。
- `npm test`：**50 个测试文件 / 818 个用例全部通过**（vitest 4.1.11）。
- `npm run build`：**成功**（tsc 无错 + vite 构建 + PWA precache 58 项 / 1343.94 KiB）。
- 产物已按游戏拆 chunk，主包 `index-*.js` 48.24 kB（gzip 17.51 kB）。

## 三、基线合集清单（34 款）

按 `src/games/<id>/meta.ts` 的真实 id 与分类统计。分类含义见 `src/engine/types.ts`：
`action=闯关 casual=休闲 party=对战 edu=学习 create=动手`。

### 闯关 action（7）

| id | 标题 | 关卡实现 |
| --- | --- | --- |
| `garden-guard` | 花园守卫 | 独立 99 关战役（`logic.ts`） |
| `ocean-munch` | 海底大胃王 | 独立 99 关战役（`logic.ts`） |
| `sprout-defense` | 绿芽保卫战 | 独立 99 关战役（`logic.ts`） |
| `rainbow-run` | 彩虹跑跑 | 独立 99 关战役 + 无尽模式（`logic.ts`） |
| `fruit-slice` | 水果切切乐 | 独立 99 回合战役（`logic.ts`） |
| `sling-birds` | 弹弹小鸟 | `levels.ts` 99 关六主题 |
| `candy-swing` | 糖果秋千 | `levels.ts` 99 关六主题 |

### 休闲 casual（13）

`balloon-pop` 气球砰砰、`brick-break` 碰碰砖块、`bubble-aim` 泡泡瞄准手、`bubble-pop` 泡泡噗噗、
`fruit-catch` 接住小水果、`gomoku` 五子棋（99 道残局 `puzzles.ts`）、`kitty-care` 萌猫小屋、
`lianliankan` 连连看、`match-stars` 星星消消乐、`memory-cards` 记忆翻翻乐、`mole-pop` 地鼠嘭嘭、
`puzzle-tiles` 拼图乐园、`snake-snack` 贪吃毛毛虫。

### 对战 party（6）

`red-blue-race` 红蓝赛跑（99 关）、`red-blue-tap` 红蓝点点（99 关）、`red-blue-tug` 红蓝拔河（99 关）、
`duo-arena` 朵星擂台（**纯对战，无关卡表**）、`duo-rush` 朵星双人冲刺（**纯对战，无关卡表**）、
`xiangqi` 朵朵星星象棋（**纯对战，无关卡表**）。

### 学习 edu（6）

`clock-house` 时钟小屋、`find-diff` 找不同、`math-farm` 算数小农场、`pinyin-train` 拼音小火车、
`shape-kingdom` 形状王国、`word-garden` 识字小花园。

### 动手 create（2）

`color-fun` 涂色小屋、`music-stars` 音乐星星。

## 四、1.1 必须守住的既有约定

1. 游戏模块约定：`src/games/<id>/meta.ts`（纯数据，首页 eager 收集）+ `index.ts`（导出 `mount`，懒加载 chunk）。
2. 存档 key **不许改**：平台钱包 `yiduo-yixing.save.v1`；每关星级 `yiduo-yixing.l99.<id>`（见 `src/games/level99.ts`）。
   1.1 把 99 扩到 188 时，**沿用同一个 key**，老数组短于新长度时按「后面补 0」读取，不推翻老玩家进度。
3. 通用 99 关框架在 `src/games/level99.ts`（章节 `Chapter[]`、`totalSize` 必须恒等于总关数、选关地图、三星结算）；
   学习类答题壳在 `src/games/quiz99.ts`；朗读在 `src/games/speech.ts`。
4. 离线可玩：不引入任何外部运行时依赖（无 CDN 字体 / 外链音源 / 统计 SDK）。
5. 面向孩子的文案里**不得出现任何商业商标或官方角色名**；角色一律原创（朵朵、星星、糯糯、绿绿豆、啾啾……）。
6. 不删除、不降低既有 818 个测试。
