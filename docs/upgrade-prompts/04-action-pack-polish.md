有子agent都用指定模型 slug：`[claude-fable-5-thinking-xhigh]`。  我让你派发子任务来做，没让父任务做！！全部重做！请通过 Task 工具派生一个或多个云端子代理执行本任务。  直接做在main里面吧。

# 第 4 步：动作包 5 款体验与关卡可玩性打磨（不重写 99 关表）

## 本步目标

动作 5 款（花园守卫 garden-guard、海底大胃王 ocean-munch、绿芽保卫战 sprout-defense、彩虹跑跑 rainbow-run、水果切切乐 fruit-slice）各有独立 99 关九主题战役，代码结构好（logic.ts 648–1073 行、全有测试），但 ≈495 个关卡零人工抽验，触控手感与窄屏 HUD 未验证。本步做**系统性抽验 + 明显坏关修复 + 手感/HUD 打磨**，不重写关卡表、不改玩法框架。

## 仓库与分支

- 先 `git fetch origin main`（必须已包含第 3 步的 meta.ts 拆分），拉分支 `cursor/action-polish-<你的后缀>`，做完 merge 回 main 并 `git push origin main`（禁止 force）。推不上就 push 分支并写明原因与 SHA。
- 不要合并旧 PR #7–#16，不要用 gh 开 PR。

## 范围与文件所有权（只许碰这些）

- `src/games/garden-guard/`、`src/games/ocean-munch/`、`src/games/sprout-defense/`、`src/games/rainbow-run/`、`src/games/fruit-slice/` 五个目录
- 不许碰：`src/engine/`、`src/ui/`、`src/games/level99.ts`、`quiz99.ts`、其余 26 款游戏目录、`styles.css`、配置文件。

## 具体要做

1. **每款抽验 9 关**：第 1、12、25、37、50、62、75、88、99 关（覆盖每个主题章节至少一关）。逐关记录：能否通关、三星条件是否可达、难度对 6–7 岁是否合理（一年级手速：连续点击 ≤3 次/秒、拖拽精度 ≥24px 容差）、HUD/文字是否溢出。抽验记录表写进最终回复。
2. **坏关修复**：不可通关、三星永不可达、难度跳崖（相邻关卡通关时间差 >3 倍）的关卡，做**最小参数修复**（血量/时间/波次数值），在代码注释里写明「第 N 关修复：原因」。禁止重排关卡顺序、禁止改章节结构、禁止改存档 key（`PROGRESS_KEY` 等）。
3. **触控手感**：
   - fruit-slice：切割判定线宽在触屏上是否 ≥24px；连切 combo 提示是否遮挡水果。
   - rainbow-run：`detectSwipe` 的滑动阈值在 360px 窄屏实测（阈值过高孩子滑不动，过低误触跳跃）。
   - garden-guard / sprout-defense：塔/植物的放置格子点击容差、拖拽放置是否支持「点选再点格子」两段式（对孩子比拖拽友好）。
   - ocean-munch：虚拟摇杆/跟随手指的移动方式在单指下是否流畅。
4. **窄屏 HUD**：五款在 360×640 下金币/爱心/波次/任务栏不得互相遮挡或溢出游戏区；文字最小 14px 且对比度 ≥4.5:1。
5. **失败体验**：确认五款失败后都只提供「重试本关/回选关」，文案温柔无批评；BOSS 关失败时给一句具体提示（如「试试先种慢速花冻住它」）。
6. **destroy 回归**：每款进入→玩一关→中途退出→再进入→通关→退出，控制台无报错、无残留计时器（用 5 款各跑一遍记录）。

## 如何优化（本步做好的标准）

- 修复以「数值 diff」为主，单款玩法代码改动 ≤150 行；大于此量说明你在重写，停下来只报告。
- 每款的 logic.ts 有测试，改数值后测试要同步（改断言前先确认断言本来就该改）。
- 手感参数改动写对照表（旧值→新值→理由）。

## 与其他步骤避免冲突

- 你只拥有这 5 个目录。05/06 步动其他游戏，可并行，但合 main 串行：先 `git pull origin main` 再 merge 自己的分支。
- 第 3 步给每款加的 `meta.ts` 不要动。

## 验收标准

- [ ] 5 款 × 9 关抽验记录表（关号/结论/修复动作）在最终回复里。
- [ ] 所有修复都是最小数值 diff 且带注释；关卡总数仍为每款 99，章节结构未变。
- [ ] `npm test`、`npm run build` 全绿，用例数不减。
- [ ] 360×640 下五款 HUD 无溢出（回复里逐款确认）。
- [ ] 变更已 merge 进 main 并 push（或写明原因与分支 SHA）。

## 测试命令

```bash
npm install && npm test && npm run build
npx vitest run src/games/garden-guard src/games/ocean-munch src/games/sprout-defense src/games/rainbow-run src/games/fruit-slice
npm run dev   # 按抽验表逐关走查；浏览器开发工具切 360×640 与 1280×800 两档
```
