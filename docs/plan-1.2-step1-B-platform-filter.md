# 1.2 第 1 步 · B 档工作计划 —— 首页手游/端游筛选 + 手机文字

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 **1.2 版本第 1 步 / 共 30 步** 的 **B 档**。主管总则：`docs/plan-1.2-supervisor.md`。tracker：`docs/plan-1.2-tracker.md` 的 `1-B`。

---

## 分支纪律（先做这一步）

- `git fetch origin game-1.2`，从 `origin/game-1.2` 拉工作分支。
- **开工前先提交一条 git 记录**（「1.2 第 1 步 B · 平台筛选」），再改代码。
- 全部推 **`game-1.2`**，不改 `main`，不 force，不用 `gh` 开/改/合 PR。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` → `git push origin HEAD:game-1.2`。
- 若线上还没有 `origin/game-1.1` @ `8867138` 的首页（`homeFilters.ts`、玩法芯片、收藏、搜索），先把 1.1 合入再改。本档假设 1.1 已经做完。

---

## 本档目标

在 **1.1 已经落地的分类页签 + 玩法芯片**之上，加一行 **手游 / 端游** 筛选；并把 **360px 手机**上的文字、对比度、安全区补到能给小学六年级看清、点得到。

**不要推倒 1.1。** 先通读更新后的：

- `src/ui/home.ts` —— 只管画；分类页签、玩法芯片、搜索、收藏、小屋入口、`HOME_EXTRA_CSS`
- `src/ui/homeFilters.ts` —— 纯函数：`Tab`、`ModeChip`、`MODE_CHIPS`、`filterGames`、拼音首字母、`yiduo-yixing.fav.v1`
- `src/ui/homeFilters.test.ts` —— 已有筛选 / 搜索 / 收藏断言，**一条都不许删、不许调弱**
- `src/engine/types.ts` —— `GameMeta.modes` / `levels` / `ageHint`，`DEFAULT_LEVEL_TOTAL = 188`
- `src/styles.css` —— `--ink` / `--ink-soft`、卡片字号、已有一处 `safe-area-inset-bottom`
- `src/ui/contrast.ts` —— `AA_NORMAL = 4.5`，`CONTRAST_CHECKS` 要继续全绿

1.1 玩法芯片是：全部 / 🚩闯关 / 🤝对战 / ♾️无尽 / 👫双人，可与分类叠加。你加的手游/端游必须是**第三轴**，和分类、玩法同时生效。

---

## 独占文件（只许这些，A/C 的文件一个字别动）

| 文件 | 职责 |
| --- | --- |
| `src/engine/types.ts` | `GameMeta` 增加可选 `platform`；导出类型与缺省 |
| `src/ui/homeFilters.ts` | 平台芯片纯函数 + `filterGames` 接上第三轴 + 拼音表按 55 款标题补字 |
| `src/ui/homeFilters.test.ts` | 平台筛选用例，旧用例全过 |
| `src/ui/home.ts` | 渲染平台芯片；窄屏工具条换行；卡片不挤字 |
| `src/styles.css` | 360px 字号、行高、安全区、对比度（只改全局文字/间距，不改攻略抽屉结构） |
| `src/ui/contrast.ts` | 若你改了 CSS 变量，同步 `CONTRAST_CHECKS`，只增色对、不降低阈值 |
| 全部已有 `src/games/*/meta.ts` | **只加 `platform` 字段**（及必要时补拼音用得上的 title 不变）。不改 id / category / modes / blurb 玩法含义 |

**不要动：** `src/ui/rootGate.ts`（A 在建）、`src/ui/parentAuth.ts`、`src/ui/parentGate.ts`、`src/ui/gameShell.ts`、`src/games/level99.ts`、`src/ui/level188Contract.ts`、`src/engine/collection.ts`、`src/engine/lane25d.ts`（C 在建）、任何游戏的 `index.ts` / `logic.ts` / `levels.ts`。

`index.html` 已有 `viewport-fit=cover`。若还要补 `theme-color` 以外的 meta，可以改 `index.html`——但不要改 `lang`、不要把 description 写回「低年级宝宝」。若你不改 html，也可以。

---

## 字段与筛选（按这个写）

### `src/engine/types.ts`

在 `GameMeta` 上追加，保持可选（缺省不报错、不让旧测试炸）：

```ts
/** 更适合在哪种设备上玩。缺省 = both，首页不当成筛掉。 */
export type PlayPlatform = "mobile" | "desktop" | "both";

export interface GameMeta {
  // ...原字段不动...
  platform?: PlayPlatform;
}
```

导出：

```ts
export const PLAY_PLATFORMS: PlayPlatform[] = ["mobile", "desktop", "both"];
```

语义（给填表用）：

- `mobile`：主要是触屏、单手、短局。例：点点、消消、IO 摇杆。
- `desktop`：主要是键盘双人、精细瞄准、棋牌长考。例：`xiangqi`、`fight-king` 双人键位、`gomoku`。
- `both`：两条都说得通。大多数 1.1 游戏应填 `both`，**不要为了让筛选「看起来有货」把双人键盘游戏标成仅端游而在手机上玩不了**——手机仍有虚拟键。只有「没有触屏方案、离开键盘基本不能玩」才标 `desktop`；只有「桌面键位明显是第二公民」才标 `mobile`。

**必须去各款的 `index.ts` 看一眼再填，不许只看 blurb 猜。** 拿不准就 `both`。

### `src/ui/homeFilters.ts`

新增：

```ts
export type PlatformChip = "all" | "mobile" | "desktop";

export const PLATFORM_CHIPS: { key: PlatformChip; emoji: string; label: string }[] = [
  { key: "all", emoji: "🌈", label: "全部" },
  { key: "mobile", emoji: "📱", label: "手游" },
  { key: "desktop", emoji: "🖥️", label: "端游" }
];

export function matchesPlatformChip(
  meta: Pick<GameMeta, "platform">,
  chip: PlatformChip
): boolean;
```

规则：

- `all`：全过
- `mobile`：`platform` 缺省、`both`、`mobile` 都算命中（缺省不能被筛没）
- `desktop`：缺省、`both`、`desktop` 都算命中

这样「手游」不会把没填字段的 55 款藏起来。芯片的意义是：**偏手游的排前面 / 或筛掉明显仅另一端的**。若上面规则让两个芯片几乎一样，则改为：

- `mobile`：`platform !== "desktop"`
- `desktop`：`platform !== "mobile"`
- 缺省 `both`：两个芯片都在

**采用后一种**（互斥掉「仅另一端」）。写进单测。

`HomeFilter` 增加 `platform: PlatformChip`。`filterGames` 三个条件变四个（分类 ∩ 玩法 ∩ 平台 ∩ 搜索）。`emptyStateText` 按是否在筛平台给一句人话，例如「这几个筛选叠在一起没有游戏，试试只留手游」。

拼音：55 款标题里还没进 `PINYIN_INITIALS` 的字补上（例如 馆、钩、矿、冰、火、森、林、仓、鼠、超、勇、射、击、飞、机、队、坦、克、雪、球、象、棋、保、龄……）。查不到的字仍返回空串，搜索走标题原文。新游戏的字留给第 2–8 步作者和第 27 步 B 收口，本步至少覆盖当前 55 款。

### `src/ui/home.ts`

- 在玩法芯片**下面**再加一行平台芯片（`aria-label="按设备筛选"`），`aria-pressed` 与页签一致。
- 不要取消玩法芯片，不要把分类页签改成下拉。
- 窄屏（≤380px，并且要在 **360px** 验证）：工具条换行；搜索框仍 ≥ 44px 高；芯片可横向滑动但**文字完整可见**，禁止把「手游」裁成「手」。
- 卡片标题在 360px 两列网格下不要变成省略号到只剩一个字；`blurb` 可以两行截断，但标题至少完整。
- 继续用注入 CSS 补本档新类名；全局字号仍以 `styles.css` 为准。

### 55 款 `meta.ts` 只加字段

每款加一行 `platform: "mobile" | "desktop" | "both"`。建议起点（执行者仍须对照代码微调）：

- 明显双人键盘主轴、触屏是补：`xiangqi`、`fight-king`、`ice-fire-forest`、`puff-bros`、`prince-princess`、`duo-rush`、`duo-arena`、`duo-vs-star`、`red-blue-*`、`tank-battle`、`bomb-buddies`、`bumper-cars` → 优先 `both`（它们 1.1 已做触屏）。只有你确认没有触屏方案才 `desktop`。
- 明显单手点选：`balloon-pop`、`mole-pop`、`match-stars`、`lianliankan`、`fruit-catch` 等 → `mobile` 或 `both`。
- 默认：`both`。

**禁止**改 title / blurb / category 来「配合筛选」。拼音不够就改 `PINYIN_INITIALS`，不要改游戏名。

---

## 手机文字（360px / 字号 / 对比度 / 安全区）

在 `src/styles.css` 增加（可调数字，但不得低于这些地板）：

1. **安全区**：`body` / `.home-screen` / `.game-shell` 使用
   `padding-top: env(safe-area-inset-top, 0px)`，
   `padding-left/right: env(safe-area-inset-left/right, 0px)`，
   底栏在现有 `safe-area-inset-bottom` 上补首页底部留白。刘海屏标题不得钻进状态栏。
2. **360px 地板**（用 `@media (max-width: 360px)`，并抽查 360×800）：
   - 首页问候 / 主标题 ≥ **18px**，字重 ≥ 700
   - 正文、芯片、搜索输入、卡片标题 ≥ **16px**
   - 卡片 blurb ≥ **14px**（低于 14 的现有 12.5px 必须加大）
   - 行高 ≥ 1.4
   - 触控热区继续 ≥ 44px（芯片、心形、家长按钮）
3. **对比度**：正文与次要文字对卡片底 / 白底 ≥ **4.5:1**。若 `--ink-soft` 在粉底上不够，把它加深，并更新 `contrast.ts` 的色对。大标题允许 3:1。不要把粉彩背景改成黑白。
4. **不要**为了塞 55 张卡把字缩到 11px。宁可多滚一屏。
5. `prefers-reduced-motion` 下不要新加位移动画。

`homeFilters.test.ts` 不测 CSS。CSS / 对比度用现有 `contrast` 测试 + 如需新建 `src/ui/homeMobile.test.ts` 只测「字号地板常量」（把 16/18/44 抽成导出常量再断言），不要用 jsdom 去读 computed style 硬撑。

---

## 测试命令与用例

- `npx vitest run src/ui/homeFilters.test.ts src/ui/contrast.ts` 以及你新增的测试文件
- 全量 `npm test` && `npm run build`

`homeFilters.test.ts` 至少新增：

1. 缺省 `platform` 的游戏在「手游」「端游」里都还在
2. `platform: "mobile"` 的游戏不出现在「端游」
3. `platform: "desktop"` 的游戏不出现在「手游」
4. `both` 两个芯片都在
5. 分类 + 玩法 + 平台 + 搜索四轴叠加：造 4 款假游戏，断言交集
6. 旧的玩法芯片用例全部仍绿（闯关 / 对战 / 无尽 / 双人含义不变）
7. 55 款真实 `meta` glob：每个都有合法 `platform` 三选一（可在测试里 `import.meta.glob` 扫 `../games/*/meta.ts`）

---

## 验收

- `npm test` 全绿且用例只增不减；`npm run build` 全绿。
- 手动：`npm run build && npx vite preview`，把窗口拉到 **360×800** 和 **1280×800**
  - 分类、玩法、手游/端游三行都能点，叠加后卡片数变化合理
  - 360px 下标题和芯片能读、对比够、底部不被 Home 条挡住
  - 搜索「xq」或「象棋」仍能找到 `xiangqi`
  - 收藏、最近玩过、小屋入口仍在
- 主包仍按游戏拆 chunk；不要把玩法代码 eager 进 `home.ts`
- 文案无商标；「手游」「端游」就是这两个词，不要写成某应用商店品牌
- 完成后回复：改了哪些文件、55 款 platform 分布（mobile/desktop/both 各多少）、新增用例数、推送 SHA、**实际使用的模型 slug**

---

## 不要做什么

- ❌ 不要再派生云端子代理
- ❌ 不要改 `main`、不要 force
- ❌ 不要推倒分类页签和玩法芯片
- ❌ 不要实现 root 门（A）或 2.5D 共享模块（C）
- ❌ 不要改游戏玩法
- ❌ 不要为了筛选改游戏中文名
- ❌ 不要引入外部字体 / CDN
