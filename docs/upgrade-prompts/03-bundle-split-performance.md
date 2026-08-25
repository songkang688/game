有子agent都用指定模型 slug：`[claude-fable-5-thinking-xhigh]`。  我让你派发子任务来做，没让父任务做！！全部重做！请通过 Task 工具派生一个或多个云端子代理执行本任务。  直接做在main里面吧。

# 第 3 步：游戏按需加载拆 chunk + PWA manifest 完善

## 本步目标

当前 `src/engine/loader.ts` 用 `import.meta.glob("../games/*/index.ts", { eager: true })`，31 款游戏全部打进 618.83 kB（gzip 208.33 kB）的单 chunk，超过 vite 500 kB 警戒线，低端安卓与弱网首屏慢。本步改为**首页只加载 meta、进游戏时动态加载该游戏 chunk**，并顺手完善 PWA manifest。目标：主 chunk gzip ≤ 80 kB，每款游戏独立 chunk，离线仍然全部可玩。

## 仓库与分支

- 先 `git fetch origin main`，从最新 main 拉分支 `cursor/bundle-split-<你的后缀>`，做完 merge 回 main 并 `git push origin main`（禁止 force）。推不上就 push 分支并写明原因与 SHA。
- 不要合并旧 PR #7–#16，不要用 gh 开 PR。

## 范围与文件所有权（只许碰这些）

- `src/engine/loader.ts`、`src/engine/loader.test.ts`、`src/engine/types.ts`（如需给 GameModule 加异步 mount 载体类型）
- `src/ui/app.ts`（路由处的异步挂载）、`src/ui/gameShell.ts`（仅接入异步 mount 与加载态，不动结算逻辑）
- `vite.config.ts`、`src/main.ts`
- 不许碰：31 款游戏目录内任何文件、`src/engine/save.ts`、`src/engine/audio.ts`、`styles.css` 的既有规则（可新增 loading 态样式类）。

## 具体要做

1. **拆分方案**（推荐，保持「合并目录即上首页」的约定不变）：
   - 每款游戏保持 `index.ts` 单入口。loader 改为两个 glob：`import.meta.glob("../games/*/index.ts")`（懒，返回 `() => Promise<Module>`）。meta 的获取方式二选一，任选实现但要写清理由：
     - a) 简单稳妥：保留 eager glob 仅用于读 meta，同时用懒 glob 加载 mount——**不达标，主 chunk 不会瘦**，不要选这个；
     - b) 正确做法：把每款的 `meta` 抽出为纯数据模块（如 `src/games/<id>/meta.ts`，`index.ts` re-export 保持兼容），首页 eager 收集 `meta.ts`，`mount` 走懒加载。31 款的 `meta.ts` 抽取属于本步允许的机械改动（每款只加一个新文件 + index.ts 顶部一行 re-export，不碰玩法代码）。
   - `collectGames` 的校验、去重、排序逻辑保留并适配，`loader.test.ts` 同步更新。
2. **异步挂载体验**：`gameShell.start()` 在动态 import 期间显示一个粉彩加载态（转圈小花 + 「马上就好～」），import 失败显示现有的「出了点小问题」空状态；连点返回不得产生竞态（记录当前请求序号，过期结果丢弃）。
3. **离线保证**：`vite.config.ts` 的 workbox `globPatterns` 已含 `**/*.js`，确认拆分后的所有游戏 chunk 仍被预缓存（构建后核对 `dist/sw.js` precache 条目数 ≈ 17 + 31）。这是 PWA 离线全量可玩的底线，必须在回复里贴出条目数。
4. **manifest 完善**：加 `id: "/"`、`categories: ["games", "kids", "education"]`；`orientation` 保持 `any`。
5. **构建验证**：`npm run build` 后主 chunk（不含游戏）gzip ≤ 80 kB、无 500 kB 告警；在回复里贴 build 输出的资源清单。

## 如何优化（本步做好的标准）

- 首次进某游戏的加载在快速 3G 模拟下应 <2s；游戏 chunk 命中 SW 缓存后二次进入无感。
- 不要引入路由库、状态库等新依赖；vitest 里 `import.meta.glob` 的行为差异用现有 vite 测试环境解决，不要 mock 掉核心逻辑。
- `meta.ts` 抽取用脚本化批量修改也行，但每款必须保证 `meta` 内容与原 `index.ts` 完全一致（写一个对比测试）。

## 与其他步骤避免冲突

- 本步会给 31 款游戏各加一个 `meta.ts` 并在 `index.ts` 顶部加一行——这是唯一允许越界游戏目录的改动，改完立刻合 main，让 04/05/06 步在其之上工作。**因此本步必须在 04/05/06 开始前完成合并。**
- 02 步拥有 `styles.css` 既有规则；你只新增 `.game-loading` 类不改旧规则。

## 验收标准

- [ ] `npm run build`：主 chunk gzip ≤ 80 kB，31 个独立游戏 chunk，无超限告警。
- [ ] `dist/sw.js` precache 覆盖全部游戏 chunk（回复贴条目数）。
- [ ] `npm test` 全绿（loader 测试更新后 ≥673 用例不减）。
- [ ] preview 模式下直接打开 `#/game/sling-birds` 这类深链能正常异步加载；断网（SW 已安装）后 31 款全部可进。
- [ ] 变更已 merge 进 main 并 push（或写明原因与分支 SHA）。

## 测试命令

```bash
npm install && npm test && npm run build
node -e "const s=require('fs').readFileSync('dist/sw.js','utf8');console.log('precache entries:',(s.match(/\.js/g)||[]).length)"
npx vite preview --port 4173   # 浏览器走查：首页、深链进游戏、断网重进
```
