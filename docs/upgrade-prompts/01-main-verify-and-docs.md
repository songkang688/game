有子agent都用指定模型 slug：`[claude-fable-5-thinking-xhigh]`。  我让你派发子任务来做，没让父任务做！！全部重做！请通过 Task 工具派生一个或多个云端子代理执行本任务。  直接做在main里面吧。

# 第 1 步：main 基线全量验证 + README/LICENSE/文案与法律清理

## 本步目标

main（`fed7137` 起）已经包含 31 款游戏 + 三路 99 关 + 粉彩壳层。你要做三件事：①全量验证 main 是可构建、可测试、可运行的；②把 README 从「27 款」的过时状态更新为 31 款 + 99 关体系的真实状态；③补 LICENSE 文件、清理唯一一处商标措辞。**本步不改任何游戏玩法代码。**

## 仓库与分支

- 仓库：https://github.com/songkang688/game
- 先 `git fetch origin main`，从最新 main 拉分支 `cursor/main-verify-docs-<你的后缀>`，做完 merge 回 main 并 `git push origin main`（禁止 force）。若 main 被保护推不上，push 你的分支并在最终回复写明原因和 SHA。
- 不要合并 OPEN 的旧 PR #7–#16（内容已在 main 里），不要用 gh 开 PR。

## 范围与文件所有权（只许碰这些）

- `README.md`
- `LICENSE`（新建）
- `src/games/candy-swing/index.ts` **仅第 1 行注释**
- 不许碰：`src/` 其余一切、`package.json`、`vite.config.ts`、`.github/`（属于后续步骤）。

## 具体要做

1. **全量验证**：`npm install && npm test && npm run build`，三者必须全绿（基线是 43 文件/673 用例全过、tsc 无错）。再 `npx vite preview` 冒烟：首页 HTML、`sw.js`、`manifest.webmanifest` 均应 200。把结果记录在最终回复里。
2. **README 重写游戏清单**：
   - 「当前合集 27 款」改为 **31 款**，分类表按各游戏 `meta.category` 的真实值重排（当前真实分布：action 7、casual 13、party 3、edu 6、create 2；新加入的四款是：五子棋、糖果秋千、泡泡瞄准手、弹弹小鸟）。
   - 新增一节「99 关战役体系」：每款 99 关、章节选关地图、三星评级、失败只重试本关、通关解锁下一关、进度存本机 `localStorage`。
   - 家长须知补一句：学习类游戏答错只有鼓励、绝不批评。
   - 核对「快速开始 / PWA / Electron / Android」章节命令与 `package.json` scripts 一致（不要改 scripts，只改文档）。
3. **补 `LICENSE` 文件**：`package.json` 声明 MIT，仓库根目录却没有 LICENSE。新建标准 MIT LICENSE，版权行用 `yiduo-yixing`。
4. **商标措辞清理**：`src/games/candy-swing/index.ts` 第 1 行注释「割绳子类物理益智」中「割绳子」是 ZeptoLab 中文商标名，改为「划绳物理益智」或同义中性描述。全库再跑一次商标词扫描（愤怒的小鸟/植物大战僵尸/水果忍者/割绳子/马里奥/宝可梦等），确认为零后在回复里声明。

## 如何优化（本步做好的标准）

- README 是家长的第一入口：语言面向家长而不是开发者，游戏表格里每款一句话说清「玩什么」；安装章节按「手机 PWA → 电脑 → 安卓 APK」由易到难排列。
- 不要顺手重构代码、不要动样式，本步价值在文档准确性，diff 越小越好。

## 与其他步骤避免冲突

- 08 步会再改 README 的「安装」章节（加 CI 出包链接），你只需保证现状命令准确，不要预写 CI 内容。
- 02 步拥有 `src/ui/` 与 `styles.css`，你一个字都不要碰。

## 验收标准

- [ ] `npm test` 全过（≥673 用例），`npm run build` 无类型错误。
- [ ] README 列出全部 31 款且与 `src/games/*/index.ts` 的 `meta.title` 一一对应，包含 99 关体系说明。
- [ ] 根目录存在 MIT `LICENSE`。
- [ ] 全库商标词扫描为零命中。
- [ ] 变更已 merge 进 main 并 push（或写明失败原因与分支 SHA）。

## 测试命令

```bash
npm install
npm test
npm run build
npx vite preview --port 4173 &   # curl 首页 / sw.js / manifest 应 200
rg -in "愤怒的小鸟|植物大战僵尸|水果忍者|割绳子|angry.?bird|fruit.?ninja|cut the rope|马里奥|宝可梦" src README.md
```
