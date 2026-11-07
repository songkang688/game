# gamedev · vendored 游戏设计 / 手感 / UI / 关卡 skills

本目录是继 [`1.3-visual/`](../1.3-visual/README.md) 之后第二组 vendored skills，覆盖**玩法层**：
打击感、HUD/菜单适配、程序化关卡、关卡节奏、设计理论。全部从公开仓库**复制文件**进来
（不带上游 git 历史），做法与 1.3 完全一致：只在设计期读，一个字节都不进 `dist/`。

## 选型依据（对照「12 个游戏开发 skill」榜单）

本项目的画像：76 款原创小游戏、188 关战役、Canvas 2D 矢量 + 原生 TypeScript 自研引擎、
离线 PWA / Electron / 安卓、无联网、无内购、粉彩 Q 版不用位图。按这几条硬约束筛榜单：

| 榜单项 | 结论 | 原因 |
| --- | --- | --- |
| 07 `game-feel` | **装** | 21 款闯关 + 23 款对战，`art/kit/juice.ts`、`fx.ts`、92 处 shake 已有实现但缺统一方法论（重要度分档、trauma 衰减、hit-stop 还原） |
| 08 `game-ui-ux` | **装** | 近 50 轮 QA 全在修 1024×768 / 矮横屏 / 菜单可滚 / 键排钉底，正是这套「锚点 + 安全区 + 屏幕栈 + 焦点导航」要解决的 |
| 12 `procedural-level-design` | **装**（拆成两件） | 榜单上没有同名 skill；用同一仓库的 `procedural-gen`（seed 确定性、网格生成、连通性校验）+ `level-design`（188 关锯齿难度、教→练→考节奏）合起来覆盖 |
| 06 `game-design-theory` | **装** | 「你的游戏太难了」「先教后考」「不让玩家卡死」正是面向小学生的难度与攻略侧栏原则 |
| 02 `game-engine` | 不装 | github/awesome-copilot 的入门向 Canvas/Phaser/Three 模板；本项目引擎（`src/engine/`）已成型，边际价值低 |
| 05 `game-ui-design` | 不装 | 屏幕目录偏商业化（battle pass / gacha / 广告位），本产品无内购无广告；工程侧由 `game-ui-ux` 覆盖 |
| 10 `develop-web-game` | 不装 | 上游 `openai/skills` 已标记 deprecated，main 上该 skill 已移除（迁入 `openai/plugins` 的 game-studio），且硬编码 `$CODEX_HOME` 路径 |
| 01 `higgsfield-game-generation` | 不装 | 依赖 Higgsfield 云端 CLI + 账号登录，产出位图/音频素材并部署到其平台；违反离线、零外部依赖、不提交位图三条红线 |
| 03 `multiplayer-game` | 不装 | 本产品只有双人同屏，没有联网 |
| 04 `game-developer` | 不装 | Unity / Unreal 向（ECS、Profiler、联机压测） |
| 09 `threejs-game-ui-designer` | 不装 | 不用 Three.js（全仓只有 1 处 WebGL，108 处 Canvas 2D） |
| 11 `pixel-art-game-assets` | 不装 | 1.3 视觉宪法是粉彩矢量，不用像素风也不提交位图 |

落选时还排除了两个同名但许可证不合规的 `game-design-theory` 来源：
`pluginagentmarketplace/custom-plugin-game-developer`（自定义 All Rights Reserved 许可）、
`fcsouza/agent-skills`（GPL-3.0，与本仓库 MIT + Apache-2.0 组合不搭）。

## 来源与许可证

| 子目录 | 上游仓库 | 上游路径 | 上游 commit | 许可证 |
| --- | --- | --- | --- | --- |
| `game-feel/` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | `skills/disciplines/game-feel` | `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9` | Apache-2.0（随目录附 `LICENSE.txt` + `NOTICE.txt`） |
| `game-ui-ux/` | 同上 | `skills/disciplines/game-ui-ux` | 同上 | Apache-2.0（同上） |
| `procedural-gen/` | 同上 | `skills/disciplines/procedural-gen` | 同上 | Apache-2.0（同上） |
| `level-design/` | 同上 | `skills/disciplines/level-design` | 同上 | Apache-2.0（同上） |
| `game-design-theory/` | [jarrodmedrano/jarrod-claude-skills](https://github.com/jarrodmedrano/jarrod-claude-skills) | `.claude/skills/game-design-theory` | `b983228e831a9cbc8f6209e4adb73842d55f7f76` | MIT（上游无独立 LICENSE 文件，由 `package.json` 与 README 声明；目录内 `LICENSE.txt` 已注明出处） |

## 复制时做了什么调整（为什么）

| 调整 | 原因 |
| --- | --- |
| `game-design-theory/` 的五份参考文档（`design-principles.md` 等）从上游的 skill 根目录移入 `references/` | 上游 `SKILL.md` 内链接写的是 `references/xxx.md`，但文件实际放在根目录，链接是断的；只挪位置，文件内容一字未改 |
| 其余文件（含 Apache 目录的 `LICENSE.txt` / `NOTICE.txt`）原样复制 | — |

上游代码示例使用 GDScript / C# / Python（Godot、Unity）。这些是**方法论载体**，本项目落地一律用
TypeScript + Canvas 2D 重写，不要照抄 API。

## 每个 skill 干什么、谁在什么时候读

| skill | 它教什么 | 本项目对应处 | 谁读、何时读 |
| --- | --- | --- | --- |
| `game-feel/` | 反馈分层叠加、按重要度分 small / medium / large 档；trauma² 衰减式 screen shake 只动相机不动本体；hit-stop 用真实时间还原、新调用覆盖旧调用；squash & stretch 用 back / elastic 缓动；必须提供「减少晃动 / 闪烁」开关 | `art/kit/juice.ts`、`fx.ts`、`ui/motion.ts`；格斗王、连招对决、朵朵大战星星、彩虹跑跑、飞机小队等所有有命中 / 落地 / 拾取事件的游戏 | 给某款游戏加或调手感前通读；验收员对照「Pitfalls」逐条查 |
| `game-ui-ux/` | 锚点 + 容器而非绝对坐标；参考分辨率缩放 + 多宽高比策略；安全区内缩；每个屏幕必有初始焦点与焦点邻居；屏幕栈 push / pop 替代布尔旗；HUD 事件驱动不逐帧轮询；字号下限与 200% 放大 | `ui/gameShell.ts`、`home.ts`、`dialogs.ts`、`viewportHeight.ts`、`mobileText.ts`；各游戏的 `*Fit.ts` / `mapFit.ts` | 做任何壳层 / 盘面适配、修 QA 单（N-xxx 类）前必读；`references/layout-and-flow.md` 有完整屏幕栈与焦点导航范式 |
| `procedural-gen/` | 一个 seeded RNG 实例贯穿全程、绝不碰全局随机；先生成到纯数据网格再绘制；出图前校验连通 / 可达 / 出生点安全；fixed seed 调参再 sweep seed 看分布；版本更新后 seed 不漂（自带 PRNG 并 pin 首输出） | 扫雷花园、数独花田、豆豆迷宫、泡泡布阵、无尽模式（彩虹跑跑、双人冲刺、圆圆大作战、长蛇争霸）、188 关中按 seed 派生的关卡 | 新写或重写任何按 seed 出关卡 / 出盘面的逻辑前必读；`references/dungeon-generation.md` 有 BSP / 随机游走 / WFC / 连通性校验 |
| `level-design/` | 先定玩家度量（跳高 / 跳远 / 速度）再排几何；难度走锯齿不走直线；每个机制「安全处教 → 练 → 压力下考」；节奏当数据写成 intensity 时间线；用 key / ability 图校验关键路径不软锁 | 各游戏 `campaign.ts` 的 188 关表、章节选关地图、三星评级门槛、家长跳关 | 规划或重排某款游戏的 188 关曲线前必读；`references/pacing-and-flow.md` 有 introduce→develop→twist→test 教学环 |
| `game-design-theory/` | 玩家为何玩（挑战 / 社交 / 独处 / 炫耀 / 情绪 / 幻想）、玩家期待什么（一致世界、不卡死、公平机会、做而不是看）；「你的游戏太难了」；「先玩后教」；试玩方法 | 攻略侧栏「只讲方法不给答案」、学习类「答错只鼓励」、低年级从第 1 关起步的分层目标、家长门 | 立项新游戏、评审玩法、处理「不好玩 / 太难 / 看不懂」类反馈时读；`references/playtesting.md` 给试玩流程 |

## 使用边界（必须遵守，与 1.3 相同）

1. **只在「设计期」读**：这些是方法论，**一个字节都不进 `dist/`**，不 import 进 `src/**`，
   不作为运行时依赖。离线 PWA 的运行时零外部依赖不变。
2. 上游示例代码是 GDScript / C# / Python，只借思路；落地一律 TypeScript + Canvas 2D + CSS，
   不引入 Godot / Unity / Phaser / 噪声库等任何新依赖。`procedural-gen` 提到「用现成噪声库」，
   本项目若需噪声则自写小实现并写 pin 首输出的测试。
3. 上游文档里出现的第三方引擎 / 游戏名属于**上游原文**，保持原样不改；
   商标扫描继续加 `--glob '!.cursor/skills/**'` 排除本目录，我们自己的代码与文案照旧 0 容忍。
4. 四个 Apache-2.0 目录各自保留 `LICENSE.txt` 与 `NOTICE.txt`；`game-design-theory/` 保留 MIT `LICENSE.txt`。
   若日后修改 vendored 文件（不建议），Apache 目录须在被改文件头部注明改动（Apache-2.0 §4(b)）。
5. 本仓库自身是 MIT；Apache-2.0 与 MIT 材料并存只需保留各自许可证文本与出处，已满足。

## 同仓库里值得日后按需再取的（本轮未装）

`gamedev-skills/awesome-gamedev-agent-skills` 的 discipline 组还有几件与本项目相关：
`performance-optimization`（帧预算、对象池、GC —— 低端安卓机卡顿时）、
`input-systems`（动作映射、多设备 —— 双人同屏双键位零交集的架构化）、
`game-ai`（FSM / 行为树 / 寻路 —— 象棋 / 五子棋 / 幽灵的人机档）、
`audio-design`（混音与 ducking —— Web Audio 合成音效的层次）。取法同上：sparse clone、复制目录、附 LICENSE + NOTICE、补本表。
