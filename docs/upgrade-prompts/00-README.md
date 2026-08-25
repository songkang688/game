# 一朵一星 · 全面审查报告与升级路线（8 步）

> 本文件是审查结论与总索引。`01-*.md` 到 `08-*.md` 每个文件是一条完整的、可直接派发给云端子代理的升级提示词。
> 审查基线：`origin/cursor/yiduo-final-merge-9229`（`e7f3741`），审查时 `origin/main` 已合并该基线（`fed7137`）。
> 审查方式：通读平台与 31 款游戏源码 + `npm test`（43 文件 / 673 用例全过）+ `npm run build`（tsc 无错、vite 构建成功）+ `vite preview` 冒烟（首页 / sw.js / manifest 均 200）。

---

## 一、审查结论：现状 / 缺口 / 优先级

### 1. 合集完整性（现状：✅ 达标）

- **31 款齐全**：动作深度 5 款（花园守卫、海底大胃王、绿芽保卫战、彩虹跑跑、水果切切乐）、经典 4 款（弹弹小鸟、糖果秋千、泡泡瞄准手、五子棋）、休闲/对战/学习/动手 22 款。
- **99 关体系齐全**：22 款走 `src/games/level99.ts` 通用框架（选关地图 + 章节页签 + 三星 + 失败只重试本关）；动作 5 款各有独立 99 关九主题战役；经典 4 款各有 99 关六主题；五子棋是 99 道残局（`puzzles.test.ts` 断言 `PUZZLES.length === 99` 且逐关可解性验证）。
- **学习类答错只鼓励**：`quiz99.ts` 答错文案是「没关系，再想一想～」等，失败结算文案「这一关的题目有点调皮，我们休息一下再来一次！」，无任何批评措辞。✅
- 缺口：**99×31 ≈ 3069 关没有任何人工抽验记录**。大量关卡由 seed 参数化生成，中后期关卡是否只是数值渐变、有没有「明显坏关」（不可通关 / UI 溢出 / 难度跳崖）完全未验证。**优先级：高**（分给 04/05/06 三步按包抽验）。

### 2. 首页 / 壳层（现状：🟡 基本达标，有适龄性缺口）

- 现状好的部分：粉彩渐变背景 + 漂浮装饰、大圆角卡片（radius 30px）、emoji 页签、`prefers-reduced-motion` 支持、420px 窄屏断点、按钮热区普遍 ≥50px。
- 缺口：
  - **正文对比度不达标**：`--ink-soft: #9c8794` 配白底约 3.4:1，卡片副标题 14px、页脚 14px 均低于 WCAG AA（4.5:1）。**优先级：高**。
  - 「全部」页签一次铺 31 张卡片，6–7 岁孩子找游戏困难；无「最近玩过」「继续上次」分区。**优先级：中**。
  - `level99.ts` 地图 `max-width:480px`，桌面大屏下游戏区两侧大量留白。**优先级：中**。
  - 键盘焦点样式（`:focus-visible`）缺失。**优先级：低**。

### 3. 三个游戏包的玩法深度（现状：🟡 结构好，手感未验证）

- 动作 5 款：每款有独立 logic.ts（648–1073 行）、九主题、BOSS、道具，深度足够；但触控手感、HUD 在窄屏是否溢出未验证。
- 经典 4 款：弹鸟自写弹弓物理、糖果秋千自写绳物理、泡泡瞄准 simulateShot 保证「指哪打哪」、五子棋三档 AI+禁手，结构优秀。
- 休闲学习 22 款：共用 level99 框架，体验统一；风险是**关卡重复感**（很多游戏 99 关只靠 seed 与参数渐变区分）与**文案适龄**（一年级识字量有限，部分提示语偏长）。
- **学习类没有语音朗读**：一年级孩子识字量约 300–800 字，题干引导语纯文字。加 Web Speech API 朗读是最高性价比的教育升级。**优先级：高**（放在 06 步）。

### 4. 平台能力（现状：✅ 良好，有小缺口）

- 存档：`save.ts` 健壮（sanitize、隐私模式内存降级、订阅通知）；level99 每关星级独立存档。✅
- 音效：Web Audio 全合成 7 种音效，无外部资源；首页有开关。缺口：无背景音乐、游戏内无音效开关入口。**优先级：低**。
- 家长门：乘法题（3–9 × 3–9）+ 双击确认清空进度。缺口：答错可无限立即重试，可被孩子暴力尝试。**优先级：低**。
- PWA：manifest / SW 预缓存 17 项 / autoUpdate 齐全。缺口：manifest 无 `id` 字段、无 screenshots；无存档导出/导入。**优先级：低**。
- Electron：contextIsolation + sandbox + 禁外链弹窗，安全设置到位。✅

### 5. 测试 / 类型 / 包体（现状：🟡）

- `npm test` 673 用例全过、`tsc --noEmit` 无错。✅ 但 UI 壳层（home/gameShell/dialogs/parentGate）零测试。**优先级：低**。
- **单 chunk 618.83 kB（gzip 208.33 kB），超过 vite 500 kB 警戒线**。根因：`loader.ts` 用 `import.meta.glob(..., { eager: true })` 把 31 款游戏全部打进主 chunk。低端安卓机首屏解析压力大。改为按需动态加载即可拆分。**优先级：高**（03 步）。

### 6. 安装包与 CI（现状：🔴 最大缺口）

- **仓库没有 `.github/`，零 CI**：没有测试守门，没有任何自动出包流水线。
- **Mac 安装包完全出不来**：`package.json` 的 electron-builder 配置没有 `mac` 目标；dmg 只能在 macOS runner 上打，Linux 打不出。
- Windows portable 可在 Linux 交叉打包，NSIS 需 wine；Android 需 JDK17 + SDK。
- 需要一条 GitHub Actions 流水线：`ubuntu`（test/build/AppImage/win-portable/APK）+ `macos`（dmg）。产物走 Actions artifacts / Release，**绝不进 git**。**优先级：最高**（08 步）。

### 7. README / 家长说明（现状：🔴 严重过时）

- README 写「当前合集 **27** 款」，缺五子棋、糖果秋千、泡泡瞄准手、弹弹小鸟四款；完全没提 99 关战役体系、选关地图、三星；分类表与实际 meta 不一致（弹弹小鸟等现归 action）。**优先级：最高**（01 步）。
- 家长面板五条说明尚可，但没有「怎么玩某一款」「99 关进度在哪看」的指引。

### 8. 无障碍 / 性能 / destroy 泄漏（现状：🟡）

- 抽查了全部 31 款的全局监听器（`window/document.addEventListener`）与 `setInterval`：均有配对清理（多用 `Set<timer>` 统一 clear），`gameShell`/`level99` 对 destroy 有 try-catch 兜底。未发现明显泄漏。✅
- 对比度问题见第 2 条；`index.html` 的 `user-scalable=no` 对低视力用户不友好（儿童游戏可接受，暂不改）。
- 缺系统性走查记录：每款进入→玩一关→退出→再进的内存/监听器回归。**优先级：中**（并入 04/05/06 验收）。

### 9. 法律（现状：✅ 基本干净，1 处措辞）

- 全库无商业商标角色名（无「愤怒的小鸟 / 植物大战僵尸 / 水果忍者」等字样，角色全为原创：糯糯/云云/墩墩/闪闪、绿绿豆、啾啾）。
- 仅 `src/games/candy-swing/index.ts` 第 1 行注释含「割绳子类物理益智」——「割绳子」是 ZeptoLab 中文商标名，建议改为「划绳物理益智」。**优先级：低**（01 步顺手改）。

### 10. 分支与 PR 治理（现状：🟡 需要声明纪律）

- draft PR [#1](https://github.com/songkang688/game/pull/1)–[#6](https://github.com/songkang688/game/pull/6) 已 MERGED；[#7](https://github.com/songkang688/game/pull/7)–[#16](https://github.com/songkang688/game/pull/16) 仍 OPEN，但其内容已全部经 `cursor/yiduo-final-merge-9229` 一次性进入 main（`fed7137`）。
- **纪律：这 10 个 OPEN 的分路 PR 一律不要再单独合并**，否则会造成重复合并冲突。main 只走一条线。后续每一步直接做在 main。

---

## 二、最严重的 5 个缺口（按优先级）

1. **零 CI、零安装包流水线**——Windows/Mac/Android 三端都没有可复现的出包方式，Mac 包在现有配置下根本打不出来。（08 步）
2. **README 与产品实态严重脱节**——写 27 款、没有 99 关体系与新玩法说明，家长按文档找不到 4 款游戏。（01 步）
3. **31 款游戏全量打进 618.83 kB 单 chunk**——低端安卓/弱网首屏慢，改按需加载即可解决。（03 步）
4. **适龄性硬伤**——正文对比度 3.4:1 低于 WCAG AA；学习类无语音朗读，一年级识字量不足以独立读题。（02/06 步）
5. **≈3069 个关卡零人工抽验**——参数化生成的中后期关卡重复感与坏关风险完全未知。（04/05/06 步）

---

## 三、升级路线：共 8 步

> 切成 8 步的理由：每步 = 一个云端子代理在一个 VM 内可完成的量；文件所有权互不重叠；按顺序合 main 可以完全避免冲突。不切 30 步碎任务，也不把「CI」和「游戏打磨」混在一个 VM 里。

| 步 | 文件 | 主题 | 优先级 | 文件所有权（独占） |
| --- | --- | --- | --- | --- |
| 01 | `01-main-verify-and-docs.md` | main 基线全量验证 + README/LICENSE/文案与法律清理 | 最高 | `README.md`、`LICENSE`、`docs/`、candy-swing 首行注释 |
| 02 | `02-shell-cuteness-a11y.md` | 首页/壳层卡通化二期：对比度、最近玩过、响应式、焦点样式 | 高 | `src/ui/*`、`src/styles.css`、`index.html` |
| 03 | `03-bundle-split-performance.md` | 游戏按需加载拆 chunk + PWA manifest 完善 | 高 | `src/engine/loader.ts`、`src/ui/app.ts`（路由异步点）、`vite.config.ts`、`src/main.ts` |
| 04 | `04-action-pack-polish.md` | 动作 5 款抽验与打磨（不重写关卡表） | 高 | `src/games/{garden-guard,ocean-munch,sprout-defense,rainbow-run,fruit-slice}/` |
| 05 | `05-classics-pack-polish.md` | 经典 4 款抽验与打磨（弹鸟/糖果秋千/泡泡/五子棋） | 中 | `src/games/{sling-birds,candy-swing,bubble-aim,gomoku}/` |
| 06 | `06-casual-edu-polish-tts.md` | 休闲对战学习 22 款文案适龄 + 学习类语音朗读 | 高 | 其余 22 款游戏目录 + `src/games/level99.ts` + `src/games/quiz99.ts` |
| 07 | `07-platform-audio-save-gate.md` | 平台能力：BGM/音效、存档导出、家长门加固、PWA 细节 | 中 | `src/engine/audio.ts`、`src/engine/save.ts`、`src/ui/parentGate.ts` |
| 08 | `08-ci-installers-release.md` | CI 三平台安装包（Windows+Mac+Android）+ 发布说明与走查证据 | 最高 | `.github/`、`package.json`（build 段与 scripts）、`scripts/`、README 安装章节 |

### 执行顺序与合并纪律（每个子代理必须遵守）

1. **串行执行**：01 → 02 → 03 → 04 → 05 → 06 → 07 → 08。每步开始先 `git fetch origin main`，从**最新 main** 拉工作分支，做完直接 merge 回 main 并 push。这是避免冲突的唯一规则来源。
2. 04/05/06 三步文件所有权完全不相交，如需并行可以并行，但**合 main 必须逐个串行**（后合者先 `git pull origin main` 再 merge）。
3. 只碰自己那一行「文件所有权」列出的路径；要动别人的文件，宁可在 PR 描述/最终回复里留言，不要动手。
4. 一律 `git push origin main`，**禁止 force push**；若 main 被保护推不上去，push 自己的 `cursor/*` 分支并在回复里写明原因和 SHA。

---

## 四、不要做什么（全体子代理适用）

- ❌ 不要合并 OPEN 状态的旧 PR [#7](https://github.com/songkang688/game/pull/7)–[#16](https://github.com/songkang688/game/pull/16)，它们的内容已在 main 里；也不要用 `gh` 开新 PR（`gh` 只读）。
- ❌ 不要重写任何游戏的 99 关关卡表（`levels.ts` / `puzzles.ts` / logic 里的关卡计划），只修「明显坏关」并附修复理由；坏关修复以最小 diff 为限。
- ❌ 不要把安装包、`release/`、`dist/`、APK、图片走查证据等大二进制提交进 git。
- ❌ 不要引入任何商业 IP、商标、角色名（包括注释里的商标词）。
- ❌ 不要引入外部运行时依赖（游戏必须离线可玩：无 CDN 字体、无外链音源、无统计 SDK）。
- ❌ 不要改动游戏模块约定（`meta`/`mount`/`destroy` 接口）与存档 key（`yiduo-yixing.save.v1`、`yiduo-yixing.l99.*`），老玩家进度不能丢。
- ❌ 不要删除或降低现有 673 个测试；每步的验收都包含 `npm test` 与 `npm run build` 全绿。
