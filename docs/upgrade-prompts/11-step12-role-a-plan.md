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

## 硬约束

- 存档 key 一个都不改：进度仍读 `yiduo-yixing.l99.<id>`，最近玩过仍是 `yiduo-yixing.recent.v1`。
- 新增收藏 key 只有 `yiduo-yixing.fav.v1` 一个，读写全程 try/catch（隐私模式不能崩）。
- 主 chunk gzip 尽量 ≤ 60 kB，游戏依旧按需懒加载（meta 是纯数据，不 import 玩法）。
- 文案约小学六年级、粉彩萌系，不出现任何商业商标与官方角色名。
