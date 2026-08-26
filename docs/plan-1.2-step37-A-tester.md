# 1.2 第 37 步 / 共 37 步 · A 档 —— 测试员（第 3 轮）

> 验收三人组第 3 轮 / 共 3 轮。仿 1.1 第 15 步。全部在 `game-1.2`。三轮样本不重复（本轮回归点名款除外）。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，**1.2 第 37 步**角色 **A 测试员**（第 3 轮）。独占报告 `docs/qa/1.2-round3-tester.md` 与你新增的 `*.test.ts`（**只补测试，不改玩法**）。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- 开工前先提交一条 git 记录（角色 + 本款工作计划），再改代码。
- 全部工作在 `game-1.2` 线上。**不要改 main、不要合并回 main、不要用 gh 开或改或合 PR。**
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2`（有冲突就解，绝不 force）→ 重跑 `npm test` 与 `npm run build` → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`。**
- 源码对照：先 `git fetch origin game-1.1`，以 `origin/game-1.1` @ `8867138` 的 55 款实现为 **1.1 已做完** 的事实；1.2 第 1 步平台（root / 手游端游筛选 / `playModes` / `view25d`）与 B 档 21 款接入视为已合入 `game-1.2`。不要假设 188 关、2.5D 跑酷、`collection`、`parentAuth`、`guide.ts` 还不存在。
- 模型 slug 只出现在上面四行正文：`claude-opus-5-thinking-high-fast`（无方括号）。回复里写**实际**使用的 slug。

## 现状审查
开工先读：`docs/plan-1.2-upgrade-table.md`、第 1 步平台契约、B 档 21 款施工 id。若 r>1，先读 `docs/qa/1.2-round*-*.md` 前轮报告。假设 1.1 @ `8867138` 与 1.2 升级步已合入。

## 通行规则
问题必须量化（复现步骤 / 期望 / 实际 / 严重度阻断|严重|一般|建议 / 建议责任文件）。不许写「感觉有点卡」。商标、无血、失败只鼓励、无 three.js、存档 key 语义——发现即记。

## 职责
1. 全量 `npm ci`（若需要）、`npm test`、`npm run build`、`npx vite preview` 冒烟（首页 / sw.js / manifest 200）。
2. **实玩走查本轮样本（不与其他轮主样本重复）**：
`dark-chess`、`hop-pads`、`tap-tiles`、`adventure-king`、`alien-seek`、`bomb-buddies`、`tank-battle`、`snow-fight`、`shoot-range`、`sky-squad`、`fishing-star`、`balloon-pop`、`bubble-pop`、`bubble-aim`、`fruit-catch`、`candy-swing`、`sling-birds`、`sprout-defense`、`poop-hero`、`box-hamster`、`brave-path`、`prince-princess`、`puff-bros`、`duo-arena`、`duo-vs-star`、`red-blue-race`、`red-blue-tap`、`red-blue-tug`
   每款：首页进入 → 真实胜负（赢一次、输一次）→ 退出再进；有战役则 1 / 100 / 188；有对战/无尽则各试；双人键位抽测互不抢占。
3. 这是 1.2 最后一步。前两轮报告全部读完，所有遗留必须有最终结论。
- **覆盖率补全**：上列剩余游戏每一款都实玩；目标是 76 款每一款在三轮中至少被走查一次。
- 回归终检打勾：老存档、损坏自愈、隐私模式、parentAuth+root、攻略、首页手游端游筛选、四断点、reduced-motion、商标、主 chunk、PWA 离线。
- 报告末尾给出发布结论：`可发布` / `有条件可发布` / `不可发布`。
4. 产出 `docs/qa/1.2-round3-tester.md`。末尾给发布结论。

## 2.5D / 视觉 / 手机 / 跳关
按专项检查，不要自己改渲染或密码门。

## 独占
`docs/qa/1.2-round3-tester.md` + 新建/补强的 `*.test.ts`。禁止改玩法 `src/games/**` 非测试文件，禁止改 B/C 的报告路径 `*-learner.md` `*-fixer.md`。

## 测试验收
全绿；只增测试。走查中发现的缺陷用红测试锁住（能锁的锁）。

## 游戏间冲突
不要修别人的代码。建议责任文件写清，让 C 修。不要和 B 抢同一 `*.test.ts`（B 若落地测试，你用不同文件名，例如 `*.audit.round3.test.ts`）。

完成后回复：问题数（按严重度）、覆盖款数、报告路径、**实际模型 slug**。
