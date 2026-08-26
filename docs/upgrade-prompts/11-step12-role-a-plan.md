# 1.1 第 12 步 · 角色 A 开工记录（首页筛选/搜索/收藏 + 全量 meta 补字段）

- 分支基线：`origin/game-1.1` @ `213bf39`，工作分支 `cursor/step12-a-home-meta`
- 使用模型 slug：`claude-opus-5-thinking-high-fast`

## 独占文件（本窗口只动这些）

- `src/engine/types.ts`
- `src/ui/home.ts`
- `src/ui/recent.ts`
- 全部 `src/games/*/meta.ts`（只补 meta 字段、校订 category，不碰玩法）
- 新建 `src/ui/homeFilters.ts` + `src/ui/homeFilters.test.ts`

## 明确不碰

`src/styles.css`、`src/ui/gameShell.ts`、`src/ui/dialogs.ts`、`index.html`（归 C）；
各游戏 `index.ts` 文案与 `guide.ts`（归 B）；任何游戏的 `logic.ts` / `levels.ts` / `index.ts`。
第 4/9 步的窗口正在改 `garden-guard`、`sprout-defense`、`ocean-munch`、`fruit-slice`、`brave-path`，
这些目录我只加 `meta.ts` 的可选字段。

## 工作计划

1. `GameMeta` 增加三个可选字段（缺省不报错，老 meta 不改也能编译）：
   `modes?: ("campaign" | "versus" | "endless" | "coop" | "twoPlayer")[]`、`levels?: number`、`ageHint?: number`。
2. 逐个打开 38 款游戏的 `levels.ts` / `logic.ts` / `index.ts` **读实际代码**核对真实关卡总数与
   真实存在的模式，再回填 `meta.levels` / `meta.modes`，顺带校订 `category`
   （action=闯关 casual=休闲 party=对战 edu=学习 create=动手）。不猜、不抄 blurb 里的数字。
3. 抽一个纯函数模块 `src/ui/homeFilters.ts`：分类筛选、玩法芯片筛选、拼音首字母 + 标题模糊搜索、
   收藏读写与置顶排序、进度徽章文案。全部零 DOM 依赖，方便测。
4. 首页 `home.ts` 接上：玩法筛选芯片（全部/🚩闯关/🤝对战/♾️无尽/👫双人，与分类页签叠加）、
   搜索框、收藏心形（`yiduo-yixing.fav.v1`，收藏区置顶）、进度徽章改成 `🚩 x/<meta.levels ?? 188>`、
   「最近玩过」4 → 6、第 6 步 `openCollection` 存在才显示的可选入口。
5. `homeFilters.test.ts` ≥ 20 个用例；`npm test` 与 `npm run build` 全绿。

## 收工记录（实测数据，供其它窗口直接引用）

关数一律去 `levels.ts` / `logic.ts` 里数出来，不是照 blurb 抄的：

| 关数 | 游戏 | 依据 |
| --- | --- | --- |
| 188 | adventure-king / alien-seek / balloon-pop / brave-path / brick-break / bubble-pop / clock-house / color-fun / find-diff / fruit-catch / kitty-care / lianliankan / match-stars / math-farm / memory-cards / music-stars / pinyin-train / poop-hero / red-blue-race / red-blue-tap / red-blue-tug / shape-kingdom / sling-birds / word-garden | `CHAPTERS` 各章 `size` 之和 |
| 188 | fruit-slice / garden-guard / ocean-munch | `THEME_SIZES` 之和（`TOTAL_ROUNDS` / `TOTAL_LEVELS`） |
| 99 | bubble-aim / candy-swing / sling-birds 以外的老框架：mole-pop / puzzle-tiles / snake-snack | `THEME_SIZES` / `CHAPTER_SIZES` / 6 章之和 |
| 99 | rainbow-run / sprout-defense | 9 主题 × `LEVELS_PER_THEME` 11 |
| 99 | gomoku | `puzzles.ts` 的 `PUZZLES` 长度 |
| 无 | duo-arena / duo-rush / xiangqi | 没有闯关地图，`levels` 留空 |

模式按 `index.ts` 里真实存在的入口填：无尽 9 款、对战 8 款、双人同屏 5 款、双人合作 1 款
（`red-blue-*` 的对手是「小电脑」，算 `versus` 不算 `twoPlayer`）。

`category` 只改了一处：`gomoku` 从 `casual` 改成 `party`——它的主玩法是自由对战
（棋灵三档人机 + 朵朵 VS 星星双人），和已经是 `party` 的 `xiangqi` 同类。其余 37 款复核后维持原样。

顺手记两笔给别的窗口：

- `src/engine/loader.ts` 的 `extractMeta` 原来逐字段重建 meta，新字段会被它吃掉，已补上归一化透传。
  这个文件不在我的独占清单里，改动只有「加字段」，没动任何既有逻辑。
- 320px 上 `.recent-grid` 的 `repeat(2, 1fr)` 下限是 `min-content`，第二列卡片会顶出屏幕
  （`origin/game-1.1` 基线用 worktree 对比后同样复现）。我在 home.ts 注入的样式里夹成
  `minmax(0, 1fr)` 先修掉了，C 如果要收进 `styles.css`，把这条搬过去、删掉我这条即可。

## 硬约束

- 存档 key 一个都不改：进度仍读 `yiduo-yixing.l99.<id>`，最近玩过仍是 `yiduo-yixing.recent.v1`。
- 新增收藏 key 只有 `yiduo-yixing.fav.v1` 一个，读写全程 try/catch（隐私模式不能崩）。
- 主 chunk gzip 尽量 ≤ 60 kB，游戏依旧按需懒加载（meta 是纯数据，不 import 玩法）。
- 文案约小学六年级、粉彩萌系，不出现任何商业商标与官方角色名。
