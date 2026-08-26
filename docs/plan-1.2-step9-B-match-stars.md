# 1.2 第 9 步 / 共 37 步 · B 档 —— `match-stars`「星星消消乐」

> 本文件是 **C 档升级提示词**（一步一档一文件）。只升级这一款。禁止实现范围外的游戏，禁止再派生云端子代理写代码。
> 同一步另外两档：见 `docs/plan-1.2-step9-*.md`。步号从 9 连续到 34 为升级，35–37 为三角色验证。不要改 `docs/game-1.2/00-*`、`step-01.md`、`new-games/`。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`，禁止 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，**1.2 升级第 9 步 / 升级共 26 步（总派发到第 37 步）**，角色 **B**，独占 `match-stars` ⭐「星星消消乐」。

## 分支纪律（先做）
- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- 开工前先提交一条 git 记录（角色 + 本款工作计划），再改代码。
- 全部工作在 `game-1.2` 线上。**不要改 main、不要合并回 main、不要用 gh 开或改或合 PR。**
- 收尾：`git fetch origin game-1.2` → `git rebase origin/game-1.2`（有冲突就解，绝不 force）→ 重跑 `npm test` 与 `npm run build` → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase。**禁止 `--force`。**
- 源码对照：先 `git fetch origin game-1.1`，以 `origin/game-1.1` @ `8867138` 的 55 款实现为 **1.1 已做完** 的事实；1.2 第 1 步平台（root / 手游端游筛选 / `playModes` / `view25d`）与 B 档 21 款接入视为已合入 `game-1.2`。不要假设 188 关、2.5D 跑酷、`collection`、`parentAuth`、`guide.ts` 还不存在。
- 模型 slug 只出现在上面四行正文：`claude-opus-5-thinking-high-fast`（无方括号）。回复里写**实际**使用的 slug。

## 现状审查（先读 1.1 更新后的源码，再动手）
1.1 已完成库存，对照 `origin/game-1.1` @ `8867138`。
必须通读：`src/games/match-stars/` 下 `engine.ts` `levels.ts` `levels.test.ts` `levels188.test.ts` `index.ts` `meta.ts` `guide.ts`。对照 `meta.ts` 的 `modes` / `levels` / `blurb` 与真实玩法是否一致。
1.1 已把匹配/重力/机关抽成纯函数，战役已是 **188 关**。用户点名的硬伤仍在源码里：
`resolveCascade` 流程是 `clearCells` → `render(boomSet)` 等 220ms → `applyGravity` → **立刻 `render()` 全盘重绘**。没有「方块从旧格滑到新格」的位移，也没有「新块从顶外掉入」。传送带 `runBelts` 同样瞬移整行。非法交换没有回弹。
**本步第一优先级：消除→重力下落→补块必须有时间线，不能瞬变。**

当前 1.1 登记模式：仅 campaign（188 关十一主题）。
本步模式目标：versus（双方清目标）+ endless（步数耗尽前无限新订单）。
建议 `meta.platform`：`mobile`（第 1 步缺省 both，本步改准）。

## 通行规则（可联网搜，结论写成纯函数）
1. 先用你的检索能力核对这款玩法的**当代通行规则**（竞赛规则 / 街机手感 / HTML5 常青实现），把判定、胜负、非法操作写成纯函数，禁止只写在文案里。
2. 面向孩子的 UI / 攻略 / 注释 **禁止商业商标与官方角色名**。内部研究可用类型词。黑名单至少包括：球球大作战、贪吃蛇大作战、俄罗斯方块、Tetris、拳皇、KOF、三国杀、大富翁、Monopoly、Agar、Slither、Among Us、羊了个羊、合成大西瓜、跳一跳、地铁跑酷、开心消消乐、愤怒的小鸟、植物大战僵尸、水果忍者、超级玛丽、QQ、微信、腾讯、网易。
3. 无血、无伤、无死亡描写。体力条叫「元气」，威力不叫伤害。失败只鼓励。约小学六年级文案，粉彩萌系，不要低幼叠词。
4. 离线可玩。音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。禁止外部运行时依赖，**禁止 three.js**。
5. 键位：朵朵 `WASD`+`F`/`G`，星星 方向键+`L`/`K`，`Esc` 暂停；触屏必须有等价热区 ≥ 44px。
6. 存档 key 语义不改：`yiduo-yixing.l99.<id>`、`yiduo-yixing.l99skip.<id>`、`yiduo-yixing.save.v1`、`yiduo-yixing.collection.v1`。新进度只增新 key 或在本游戏目录内迁移旧私有 key。
7. `prefers-reduced-motion` 下降级位移/抖动/闪烁，但消消乐类仍须「经过中间格」。
8. 只增测试、不删测试、不调低断言。

## 玩法升级（闯关 / 对战 / 无尽）
每款都要能回答：能闯关吗？能对战吗？能无尽吗？不适用的在 `meta` 注释或 `guide.ts` 写明理由，并正确填写 `modes`。
| 模式 | 做不做 | 说明 |
| --- | --- | --- |
| 闯关 | 必须保持 188 | 前 99 关生成参数不许改；后段机关可加强手感但不改可解性契约。 |
| 对战 | 必须新增 | 双方各一块棋盘、同一套目标；先完成者胜。可用人机（会故意留 combo 的三档）。 |
| 无尽 | 必须新增 | 步数池 + 不断刷新订单；失败只鼓励。写入 `meta.modes`。 |

### 下落动画（硬性，消消类必须有过程）
1. 增加 `planGravity(prev, next): FallTween[]`：**不改规则**，只输出每颗方块 from→to 的格坐标与像素插值。
2. 表现层按 tween 播放 180–280ms（可用步进，但必须经过中间格）。新块从棋盘顶外落入。
3. `prefers-reduced-motion` 可改为短位移（≤80ms），**仍要经过中间格**，禁止瞬移补位。
4. 交换失败：换过去再弹回。传送带按格滑动，不要整行 teleport。
5. 单测：同一 `prev/next` 的 tween 列表快照；禁止「applyGravity 后格子集合变了但没有任何 duration>0 的 tween」。
走 `level99.ts` 的保持 **188** 且 `assertTotal(chapters, 188)`；前 99 关生成参数不许改（只许末尾主题已存在的基础上打磨手感）。纯对战不要硬凑 188。

## 2.5D / 3D 决策
保持 **2D**。不要全局 3D，禁止 three.js。最多两层视差或短缩放。
跑酷类在 1.1 第 6 步基础上继续；大鱼吃小鱼加无尽；不要全局 3D。

## 视觉动画
保持 2D 格子。消除有爆点/星星粒子（reduced-motion 关掉粒子保留下落）。360px：8×8 emoji 格子 ≥ 22px；目标条与步数不得把最底行挤出可视区（可折叠订单，棋盘优先）。字号 ≥ 13px，热区 ≥ 44px。
原创建模用 Canvas/CSS，禁止外链大图。命中/消除/移动只要「发生了空间变化」就必须有过程。

## 手机文字
360px 宽：正文 ≥ 13px，对比度 ≥ 4.5:1，热区 ≥ 44px，安全区留白。HUD 可折叠，不能挡主操作。桌面 1280×800 同样可玩。接入 `mobileText` 工具若第 1 步已提供则用之，不要另起一套全局字号 CSS。

## root 跳关（游戏侧只接线，不做密码门）
密码门（`kangkang` / 管理员 `18438037080` / 1 小时过期）是 **1.2 第 1 步 A** 的事，**禁止**在本游戏里做密码框。
你只接已经存在的 1.1 / 第 1 步 API：

1. `getLevelExtras().requestSkip(gameId, level)`（1.1 `parentAuth` high 档算术门）。没注册就隐藏按钮。
2. `getRoot12Extras().isRootOpen()`：root 开着时跳关/直达 **不必再做算术题**；关着时走 `requestSkip`。
3. 走 `level99.ts` 的：mount 若带 `initialLevel`（1 基）或 hash `?level=N`，直接 `startLevel(N-1)`，不要先甩选关图挡住。越界 clamp。
4. 自建战役/残局地图的：实现 `openCampaignLevel(n)`（或同等），写入 skip 数组 `yiduo-yixing.l99skip.<id>`，本关星记 0 但解锁下一关。
5. 纯对战/无尽、没有关卡表的：把 `level` 映射到人机档或残局序号，映射表写进注释与测试。
6. 孩子界面不要出现显眼的「root」字样。

## GitHub 结构参考
开源三消的 `gravity + refill + cascade timeline`（只学结构，不搬素材）
只学结构 / 状态机 / 测试切法。不抄商标素材、不引入运行时依赖、不搬协议代码。

## 独占该游戏目录
只许修改 `src/games/match-stars/**`（含测试）。`meta.ts` 可改以符合事实。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、其他游戏）**只读**。不要改 `docs/game-1.2/00-*`、`new-games/`、旧 `upgrades/`、第 1 步文档。

## 测试验收
- `npm test` 与 `npm run build` 全绿；只增不删不调弱。
- 新增用例 ≥ 30（tween 计划、回弹、传送带滑动、对战胜负、无尽终止、188 回归）。冒烟：消一组看下落、对战一局、无尽死亡、第 1/100/188 关。
- 冒烟：`npm run build && npx vite preview` —— 进入 → 真实胜负（赢一次输一次）→ 退出再进；有战役则 1 / 100 / 188；有对战/无尽则各试；375×667 与 1280×800。
- `destroy` 清 listener / timer / rAF / AudioContext。
- 商标扫描 0 命中（含注释）。

## 游戏间冲突
不要改 `gomoku` / `rainbow-run` / 全局 `.cell` 样式。不要把 `music-stars` 改成音游。不要引入三消引擎 npm 包。
同一步另外两款目录一个字都别动。快捷键不要全局 preventDefault 抢走壳层 `Esc` 暂停。不要写全局标签选择器样式。存档 key 不要跟别的游戏撞。

## 不要做什么
- 不要再派生云端子代理；不要改 main；不要 force；不要用 gh 写 PR。
- 不要做 root 密码门；不要加广告内购账号联网上报。
- 不要把 dist/release/APK/大图视频提交进 git。

完成后回复：角色 B、改了哪些文件、模式与 2.5D 决策、用例增量、测试构建结果、跳关映射、**实际模型 slug**。
