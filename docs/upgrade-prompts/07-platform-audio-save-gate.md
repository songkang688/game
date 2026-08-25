有子agent都用指定模型 slug：`[claude-fable-5-thinking-xhigh]`。  我让你派发子任务来做，没让父任务做！！全部重做！请通过 Task 工具派生一个或多个云端子代理执行本任务。  直接做在main里面吧。

# 第 7 步：平台能力升级——背景音乐、存档备份、家长门加固、PWA 细节

## 本步目标

平台层现状良好（存档健壮、7 种合成音效、家长门乘法题、Electron 安全设置到位），本步补四个缺口：①无背景音乐、游戏内无音量控制；②存档无导出/导入（换设备/清缓存即丢 3000+ 关进度）；③家长门可无限立即重试，孩子可暴力试出答案；④PWA 更新无提示。全部零新依赖。

## 仓库与分支

- 先 `git fetch origin main`，拉分支 `cursor/platform-upgrade-<你的后缀>`，做完 merge 回 main 并 `git push origin main`（禁止 force）。推不上就 push 分支并写明原因与 SHA。
- 不要合并旧 PR #7–#16，不要用 gh 开 PR。

## 范围与文件所有权（只许碰这些）

- `src/engine/audio.ts`、`src/engine/save.ts`（含各自测试）
- `src/ui/parentGate.ts`
- `src/main.ts`（PWA 更新提示接入点）
- `src/ui/home.ts` / `src/ui/gameShell.ts` **仅新增入口按钮的最小接线**（样式与结构归 02 步，遵循其类名体系）
- 不许碰：31 款游戏目录、`level99.ts`、`quiz99.ts`、`vite.config.ts` 的构建段、`package.json`。

## 具体要做

1. **背景音乐（Web Audio 合成，无外部音源）**：
   - `audio.ts` 加一个轻量 BGM 引擎：五声音阶（宫商角徵羽）随机慢速琶音 + 柔和正弦垫底，音量 ≤0.06，循环生成不重样；首页与游戏内共用一个实例。
   - 开关独立于音效开关：存档加 `bgmOn` 字段（默认关，尊重家长）；首页音效按钮旁加 🎵 按钮。
   - 遵守自动播放策略：首次用户点击后才启动；页面隐藏（`visibilitychange`）时暂停。
2. **存档导出/导入**：
   - `save.ts` 加 `exportAll()` / `importAll(text)`：把平台钱包（`yiduo-yixing.save.v1`）与全部 `yiduo-yixing.l99.*`、各动作/经典游戏的 `PROGRESS_KEY` 存档（按 `yiduo-yixing.` 前缀收集）序列化成一段带版本号与校验和的 Base64 文本。
   - 家长面板加「导出进度」（复制到剪贴板/下载 txt）与「导入进度」（粘贴文本，校验失败给中文错误提示且不覆盖现有存档）。
3. **家长门加固**：答错 3 次后按钮禁用 30 秒并显示倒计时（「休息一下，30 秒后再试」）；期间关闭弹窗重开不重置倒计时（用模块级时间戳，不进存档）。
4. **PWA 更新提示**：`src/main.ts` 已用 `registerType: "autoUpdate"`；接 `onNeedRefresh` 显示一条底部小吐司「有新版本啦，点我更新 ✨」，点击后 `updateServiceWorker(true)`。
5. **回归**：音效 7 种全部可用；开 BGM 玩 3 款游戏无爆音/叠音；导出→清空→导入后 99 关进度完整恢复（写成 save.test.ts 用例）。

## 如何优化（本步做好的标准）

- BGM 生成器写成纯函数可测试（给定 seed 输出音符序列）；真实 AudioContext 部分薄封装。
- 导入是唯一能大量写存档的入口，必须先整体校验再原子写入，任何一步失败都不得留下半套存档。
- 所有新 UI 文案面向孩子/家长的中文、口语化。

## 与其他步骤避免冲突

- 02 步拥有 home/gameShell 的结构与样式：你只在其现有容器里追加按钮，类名复用 `icon-btn`/`btn` 体系；若 02 尚未合并，从 main 现状追加即可。
- 06 步的朗读模块在 `src/games/` 侧，与你的 `audio.ts` 无交集。
- 08 步不动 `src/`，无冲突。

## 验收标准

- [ ] 🎵 BGM 可开关、默认关、页面隐藏暂停、无爆音；音效开关行为不变。
- [ ] 导出→清空全部进度→导入，钱包星星与任一游戏 99 关星级完全恢复（附测试用例名）。
- [ ] 家长门答错 3 次锁 30 秒，关闭重开不绕过。
- [ ] PWA 构建产物中更新吐司可触发（描述验证方式即可）。
- [ ] `npm test`、`npm run build` 全绿，用例数只增不减。
- [ ] 变更已 merge 进 main 并 push（或写明原因与分支 SHA）。

## 测试命令

```bash
npm install && npm test && npm run build
npx vitest run src/engine
npm run dev   # 走查：BGM 开关、导出导入、家长门锁定、3 款游戏音效回归
```
