# 1.2 第 35 步 / 共 37 步 · A 档 —— 测试员（第 1 轮）

> 验收三人组第 1 轮 / 共 3 轮。仿 1.1 第 13 步。全部在 `game-1.2`。三轮样本不重复（本轮回归点名款除外）。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，**1.2 第 35 步**角色 **A 测试员**（第 1 轮）。独占报告 `docs/qa/1.2-round1-tester.md` 与你新增的 `*.test.ts`（**只补测试，不改玩法**）。

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
`gomoku`、`match-stars`、`rainbow-run`、`ocean-munch`、`xiangqi`、`fight-king`、`orb-arena`、`snake-royale`、`block-drop`、`combo-clash`、`mahjong-bloom`、`star-estate`、`garden-guard`、`duo-rush`、`landlord-cards`、`ice-fire-forest`、`monster-crisis`、`bowling-lane`、`fruit-slice`、`gold-hook`、`hero-cards`、`weiqi-garden`、`flight-chess`、`bumper-cars`
   每款：首页进入 → 真实胜负（赢一次、输一次）→ 退出再进；有战役则 1 / 100 / 188；有对战/无尽则各试；双人键位抽测互不抢占。
3. 专项（第 1 轮必须量化）：
- 消消乐：录一局，确认消除后有下落过程（经过中间格），不是瞬变。
- 五子棋：六档是否存在；地狱有思考延时；残局 1/100/188。
- 彩虹跑跑：2.5D 透视仍在，无尽必过，未引入 three.js。
- 海底大胃王：无尽入口存在并能死亡结束。
- 象棋：残局学堂 + 多档人机。
- 跳关：`?level=` 与 root 开着时直达；root 关着走算术门。
- 360px 溢出抽 8 款 + 首页。
- destroy：进退 ×5 抽 6 款。
- 商标 rg 全库。
4. 产出 `docs/qa/1.2-round1-tester.md`。

## 2.5D / 视觉 / 手机 / 跳关
按专项检查，不要自己改渲染或密码门。

## 独占
`docs/qa/1.2-round1-tester.md` + 新建/补强的 `*.test.ts`。禁止改玩法 `src/games/**` 非测试文件，禁止改 B/C 的报告路径 `*-learner.md` `*-fixer.md`。

## 测试验收
全绿；只增测试。走查中发现的缺陷用红测试锁住（能锁的锁）。

## 游戏间冲突
不要修别人的代码。建议责任文件写清，让 C 修。不要和 B 抢同一 `*.test.ts`（B 若落地测试，你用不同文件名，例如 `*.audit.round1.test.ts`）。

完成后回复：问题数（按严重度）、覆盖款数、报告路径、**实际模型 slug**。
