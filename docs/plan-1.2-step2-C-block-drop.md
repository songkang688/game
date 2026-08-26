# 1.2 第 2 步 · C 档 —— `block-drop`「方块叠叠乐」

> 短计划：独占新建 `src/games/block-drop/`。本步另两档是 `orb-arena`、`snake-royale`，一个字都别碰。
> 必须做出 SRS、7-bag、Hold、Ghost、消行动画。注释和 UI **禁止**写那款苏联方块游戏的中文俗称与英文名。

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理；必须自己动手把活干完。只推 `game-1.2`，不要改 main、不要 force。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，这是 **1.2 版本第 2 步 / 共 7 步新游戏接入** 的 **C 档**：新建 `block-drop`「方块叠叠乐」。假设 1.1 的 55 款已全部做完。

## 分支纪律
- `git fetch origin game-1.2`，从其上拉工作分支，开工前提交计划 commit。
- 只推 `game-1.2`。收尾 fetch → rebase → 测试构建 → 普通 push。禁止 force。不要改 main，不要用 gh 写 PR。

## 新游戏统一约定（对接更新后的 1.1）
- `meta.ts` 纯数据 + `index.ts` 懒加载 `export { meta } from "./meta"` + `mount(api): { destroy }`。首页 glob 自动收集，**不要改 `src/ui/home.ts`**。
- 闯关走 `level99.ts` **188** 关，`assertTotal(chapters, 188)`。存档 key `yiduo-yixing.l99.block-drop`。
- `destroy` 清 rAF/监听/定时器。内置音效 only。无外部依赖。
- 键位（全局约定朵朵 WASD + F/G、星星方向键 + L/K；本款 Guideline 映射）：
  - 朵朵 WASD：`A/D` 左右、`S` 软降、`W` 或 `F` 顺时针旋转、`G` 逆时针、`Space` 硬降、`Shift` 暂存（Hold）。
  - 双人：星星方向键左右/软降、`L` 顺时针、`K` 逆时针、`Enter` 硬降、`M` Hold。
  - 手机：左/右/旋/硬降/Hold 五个大钮，360px 仍可点（热区 ≥ 44px）。
- **收藏只读**：`luckMul` 可微调 7-bag 之后的「好心」预览（不要破坏 7-bag 频率单测）；禁止改 collection 源文件与 key。暂停可 `openCollection("block-drop")`。
- 禁止商标名（含注释）。失败只鼓励。360px：Next 只显示 3 个；按钮在场地下方，字 ≥ 13px。验证 360 / 375 / 1280。
- 不要改 supervisor / step1 / step9+ / 1.1 文件。

## 你只做这一款

### meta
```
id: "block-drop"
title: "方块叠叠乐"
emoji: "🧱"
category: "casual"
color: "#FFE6C8"
blurb: "七种小积木从天上落下来。转一转、留一张、看准影子，一次消掉四行使你最开心。"
modes: ["campaign", "versus", "endless", "twoPlayer"]
levels: 188
```
端：双端。

### 完整规则（Guideline 核心，必须写对）

场地：**10 列 × 20 可见行 + 2 隐藏出生行**。隐藏行有块且锁定后仍露出 = 顶出，判负。

#### 七种积木（不要用商标名，内部用 I O T S Z J L）
标准形状与出生朝向按 SRS：I 横在 21–22 行中间；O 在中间；其余以 SRS spawn 为准。

#### 7-bag
一个袋子装 I O T S Z J L 各一，洗匀后发完再新袋子。禁止纯 Math.random 连续同一种。单测：连续 700 块每种正好 100，且任意窗口 7 块是一个 bag 的排列。

#### SRS 旋转 + 踢墙
- 基本旋转：绕 SRS 中心转 90°。
- 若重叠：按 **SRS wall-kick 表** 依次试偏移（JLSTZ 一套，I 一套，O 无踢或全 0）。五次都失败则旋转取消。
- 必须带 **0→R、R→2、2→L、L→0** 及反向表。单测至少：I 贴墙可踢成竖；T 贴地可做 T-spin 位移（哪怕闯关前期不加分，函数要在）。

#### Hold
- `Hold` 把当前块与暂存互换；若暂存空，当前进暂存并发下一块。
- **同一块落地前只能 Hold 一次**（locking 后刷新）。单测这条。

#### Ghost
- 当前块按硬降位置画半透明影子。影子必须与 `hardDropY` 一致。

#### 锁定与 DAS
- 落地后 **lock delay**（约 500ms）内仍可左右移动/旋转重置锁定（移动重置次数封顶，防无限拖）。
- DAS/ARR：按住左右先延迟再连移，用自己的定时器，**不要用操作系统键盘重复**。

#### 消行（禁止瞬变）
1. 满行标记；
2. 闪光 120–200ms（reduced-motion 则缩短为变色一帧）；
3. 上方砖块 **下落 tween** 80–160ms；
4. 再生成下一块。
分数在动画开始时就算，但视觉必须走完。**禁止「满行直接 splice 下一帧已是新堆」。**

#### 计分（Guideline 简化）
- 单/双/三/四消：100 / 300 / 500 / 800 × (level+1)
- 软降 +1/格，硬降 +2/格
- 连消（back-to-back 四消）× 1.5（可选，要单测）
- T-spin 识别可选，若做：T 最后一次踢墙成功且三角占用 ≥ 3 算 T-spin。
- 升级：每 10 行 level+1，重力表必须单调变快，level 0 约 1G/48 帧，后期封顶。

#### 顶出 / 胜利
- 无尽：顶出结束，记分 `save.recordEndlessBest("block-drop", score)`。
- 闯关：目标行数 / 目标分数 / 限定块数内清掉垃圾行。
- 对战：双方场地，消 2/3/4 行给对手送 1/2/4 行垃圾（左侧有洞的垃圾行），先顶出者负。

### 系统表
| 系统 | 函数 |
| --- | --- |
| 形状+朝向 | `cellsOf(type, rot)` |
| 7-bag | `Bag.next()` |
| 重叠 | `fits(board, piece)` |
| SRS 踢 | `rotateSRS(board, piece, dir)` |
| 硬降 | `ghostY` / `hardDrop` |
| Hold | `hold(state)` |
| 消行+动画状态机 | `markClear` → `flash` → `collapse` |
| 计分 | `scoreLines(kind, level)` |
| 重力 | `gravityMs(level)` |
| 对战垃圾 | `garbageRows(cleared)` |

### 模式
| 模式 | 做 | 为什么 |
| --- | --- | --- |
| 闯关 188 | 做 | 逐步教 SRS、Hold、四消、T-spin、垃圾行 |
| 无尽 | 做 | 经典马拉松 |
| 对战 | 做 | 送垃圾，人机或双人 |
| 双人 | 做 | 左右分场（窄屏上下） |

### 关卡切分（188，8 章）
| # | 章节 | 关数 | 新机制 |
| --- | --- | --- | --- |
| 1 | 积木入门 | 24 | 只给 I 和 O，教消一行 |
| 2 | 七色袋子 | 24 | 7-bag 全开，教 Hold |
| 3 | 影子对齐 | 24 | 必须看 ghost 才能塞进窄缝 |
| 4 | 旋转学堂 | 24 | SRS 踢墙关（贴墙转 I） |
| 5 | 四行花火 | 24 | 目标一次消四行 |
| 6 | 垃圾雨 | 22 | 预置垃圾行 / 对战垃圾 |
| 7 | 高速车间 | 22 | 高 gravity + lock delay 利用 |
| 8 | 叠叠杯 | 24 | 综合：限块数、T-spin 教学、双人镜像 |

24×5 + 22×2 + 24 = 120+44+24 = 188。

### 前端建模与动画
- Canvas 画场地砖（圆角方块、粉彩七色），DOM 画 Next×5、Hold、分数、等级。
- 消行：**闪光 → 碎成小块下落或整行闪白再塌陷**，伴 `api.play("pop")` / `"coin"`（四消）。
- 不要用外部字体文件。不要 three.js / pixi / howler。

### AI 档位（对战）
| 档 | 行为 |
| --- | --- |
| 菜鸟 | 几乎不旋转，丢在最左空洞 |
| 普通 | 启发式：高度+洞+bumpiness |
| 高手 | 会 Hold、会四消 |
| 地狱 | 会送垃圾、会挡你的四消节奏（落子更快） |

### 可参考 GitHub（结构 only，禁止运行时依赖）
- https://github.com/sen-ltd/tetris （SRS 踢墙表、7-bag、逻辑与渲染分离）
- https://github.com/MehmetMHY/tetris （Hold / ghost / lock delay 分层）

### 独占文件
只许 `src/games/block-drop/**`，可选 `scripts/smoke-step2-c.mjs`。
禁止碰 A/B 目录、`home.ts`、collection 源文件、supervisor / step1 / step9+。

### 测试 ≥ 30（硬性 ≥ 15）
7-bag 频率、SRS I 墙踢、Hold 同块一次、ghost=hardDrop、消行后塌陷高度、计分表、顶出判定、重力单调、垃圾行有洞、188 章和、DAS 不是 os repeat（可用逻辑时钟测）。

### 不要做什么
- 不要消行瞬变。
- 不要 Math.random 直接抽块。
- 不要在注释里写商标名。
- 不要引入 howler / pixi / three。

### 验收 checkbox
- [ ] SRS + 7-bag + Hold + ghost + 消行动画
- [ ] 188 + 无尽 + 对战送垃圾 + 双人
- [ ] 360px 可操作
- [ ] `npm test` `npm run build` 绿；destroy 干净
- [ ] 收藏只读

### 测试命令
```
npm test
npm run build
npx vite preview
```

完成后回复：你是 C、文件列表、用例数、SHA、实际模型 slug（派发指定 `claude-opus-5-thinking-high-fast`）。
