# 1.1 第 1 步 / 共 15 步 —— 角色 A 工作计划

- 角色：**A —— 188 关通用框架**
- 基线：`origin/game-1.1` @ `86c15f32f8eef4ec32ac412bd7382b09a219da76`（818 用例，构建全绿）
- 工作分支：`cursor/level188-framework-a-d24c`，收尾 rebase 后推 `origin game-1.1`
- 模型 slug：`claude-opus-5-thinking-high-fast`

## 独占文件（只碰这几个，B / C 的文件一个字不动）

- `src/games/level99.ts`
- `src/games/level99.test.ts`
- `src/games/quiz99.ts`
- `src/games/quiz99.test.ts`
- `src/ui/level188Contract.ts`（2.6 节公共契约，三人逐字同建）

## 计划

1. 逐字创建 `src/ui/level188Contract.ts`（类型 + 运行时注册表，不 import 任何 UI / 玩法代码）。
2. `level99.ts`：`TOTAL_LEVELS` 99 → 188，另导出 `LEGACY_TOTAL_LEVELS = 99`。
3. 存档兼容：key 仍是 `yiduo-yixing.l99.<id>`；`loadStars` 恒返回长度 188、老的 99 长数组后面补 0；
   `saveStar` 边界 0..187；`totalStars` 满分 564；`clearedCount` / `furthestPlayable` 按 188 工作；
   坏数据（非数组 / 非数字 / 超长）静默降级不抛异常。
4. 跳关存档：并存的小数组 `yiduo-yixing.l99skip.<id>`（`loadSkips` / `markSkipped` / `clearSkips`），
   星级仍记 0，但解锁后续关；`furthestPlayable` 把「跳过」视作已推进。
5. 选关地图：按章节分页（一页一章）+「跳到当前关」按钮 + 窄屏（≤420px）每行格子自适应 +
   Tab 可达 + `:focus-visible` 可见描边；跳过的关用灰色旗子 🏳 标记，与真三星区分。
6. 公共契约接线：`getLevelExtras()` 取 `mountGuide` / `requestSkip`，未注册就自动隐藏两个入口（单测环境干净）；
   地图与关内菜单各放一个「攻略」「跳关」按钮。
7. `assertTotal(chapters, 188)`：mount 时断言一次，章节和不等于 188 时 `console.error` 并降级到实际总数，不白屏。
8. `quiz99.ts`：支持 188 题量与跳关标记（`skipped` 入口），答错文案继续只鼓励不批评。
9. 测试：`level99.test.ts` 新增 ≥ 25 个用例，`quiz99.test.ts` 新增 ≥ 8 个；
   `npm test` 总用例数 ≥ 818，`npm run build` 全绿。

## 纪律

- 不改任何一款游戏的关卡表；不引入外部运行时依赖；不改 `yiduo-yixing.save.v1`。
- 不回 main、不合 main、不 force push、不用 gh 开合 PR。
