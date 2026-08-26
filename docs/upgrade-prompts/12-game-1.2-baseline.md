# 一朵一星 1.2 基线记录（分支 `game-1.2`）

> 本文件是 1.2 版本开发的**起点快照**。所有 1.2 的工作都做在分支 `game-1.2` 上。
> 主管文档见 `docs/game-1.2/00-supervisor.md`；21 款新游戏定稿见 `docs/game-1.2/00-catalog.md`。
> 第 1 步派发提示词见 `docs/game-1.2/step-01.md`。
> 1.1 对照：`docs/upgrade-prompts/10-game-1.1-baseline.md` 与唯一派发脚本 `11-game-1.1-dispatch-prompts.md`。

## 一、基线

| 项 | 值 |
| --- | --- |
| 1.0 发布分支 | `origin/main` @ `f5af78942e298a095317d6a21b30689eab53dfd1` |
| 1.1 开发分支 | `origin/game-1.1` @ `88e3effac229150267c94862170526ec99d705d8` |
| 1.2 开发分支 | `game-1.2`（持续优化；**不回 main**） |
| 本档记录时 `origin/game-1.2` SHA | `71eb519d6bd8884bf77e7bd6350a356c35736a37` |
| 建库方式 | `git fetch origin game-1.2` → 工作分支建立在 `origin/game-1.2` 之上 |
| 执行模型 slug（只写进派发提示词） | `claude-opus-5-thinking-high-fast` |

## 二、基线验证（本机实跑，全绿）

记录于 `origin/game-1.2` @ `71eb519` 工作区（尚未 rebase 进 `bumper-cars`）：

- `npm ci`：成功。
- `npm test`：**142 个测试文件 / 3918 个用例全部通过**（vitest 4.1.11）。
- `npm run build`：**成功**（tsc 无错 + vite 构建 + PWA precache **133 项 / 2750.06 KiB**）。
- 主包 `index-*.js` **83.61 kB**（gzip **29.28 kB**）。游戏按 chunk 拆包。
- 构建提示：`src/ui/parentAuth.ts` 被 `gameShell.ts` 动态 import、又被 `parentGate.ts` 静态 import，动态拆包无效。1.2 **不要为了消这条警告去改拆包策略**；平台步只许加测试、不许删测试。

> 1.2 每一步结束后的门槛：`npm test` 与 `npm run build` 必须全绿，**总用例数只增不减**（相对本文件记录的 3918，以及后续每步推上 `origin/game-1.2` 后的新高水位）。

## 三、现有游戏真实清单（点清，不猜）

按 `src/games/<id>/meta.ts` 统计。

| 数据源 | `meta.ts` 数 | 与规划的差 |
| --- | ---: | --- |
| `origin/main`（1.0） | 34 | 见 1.1 基线 |
| `origin/game-1.1` | **54** | 有 `bumper-cars`；**无** `bowling-lane` |
| `origin/game-1.2`（本基线） | **53** | 比 1.1 少 `bumper-cars` |

`origin/game-1.1` 比 `origin/game-1.2` 多出的目录：`src/games/bumper-cars/`（碰碰车大乱斗）。
两分支都没有：`src/games/bowling-lane/`（1.1 第 7 步 C 规划的「保龄球小馆」）。

**1.2 规划库存按「1.1 做完 = 55 款」计算**（34 + 21，含 `bumper-cars` 与 `bowling-lane`）。理由：用户要求假设 1.1 第 7–11 步规划的新游戏都已存在。执行阶段：

1. 派第 1 步之前，主管把 `origin/game-1.1` 的 `bumper-cars` rebase 进 `game-1.2`。
2. `bowling-lane` 若升级步开始时仍缺，由分到该 id 的升级子代理按 1.1 第 7 步 C 规格先落地再做 1.2 精细化，**不占 21 款新游戏名额**。

全量 id / 中文名 / 升级分组见 `docs/game-1.2/00-catalog.md`。

## 四、1.2 必须继承的 1.1 约定

1. 游戏模块：`src/games/<id>/meta.ts`（纯数据，首页 eager 收集）+ `index.ts`（顶部 `export { meta } from "./meta"`，导出 `mount(api): { destroy }`，懒加载 chunk）。
2. 存档 key **不许改语义**：
   - 平台钱包 `yiduo-yixing.save.v1`
   - 每关星级 `yiduo-yixing.l99.<id>`（188 长；老 99 数组后面补 0）
   - 跳关标记 `yiduo-yixing.l99skip.<id>`
   - 收藏册 `yiduo-yixing.collection.v1`
   - 首页收藏 `yiduo-yixing.fav.v1`
   - 最近玩过 `yiduo-yixing.recent.v1`
   - 1.2 新增 root 门会话只许用新 key `yiduo-yixing.root.v1`（只存 `{ expiresAt }`，**绝不存密码**）
3. 通用 188 关框架在 `src/games/level99.ts`；学习答题壳 `src/games/quiz99.ts`；朗读 `src/games/speech.ts`；家长算术门 `src/ui/parentAuth.ts`（5 分钟、内存、不落盘）**继续保留**，1.2 的 root 门是另一套，不要拆掉算术门。
4. 离线可玩：不引入任何外部运行时依赖（无 CDN 字体 / 外链音源 / 统计 SDK / **无 three.js**）。2.5D / 伪 3D 只用 Canvas + 数学，或 CSS transform。
5. 面向孩子的文案、注释、章节名 **禁止任何商业商标或官方角色名**。角色只用本作原创：朵朵、星星、糯糯、云云、墩墩、闪闪、绿绿豆、啾啾。
6. 双人键位：**朵朵 = `W A S D` + `F`（动作）+ `G`（副动作）**；**星星 = `↑ ← ↓ →` + `L`（动作）+ `K`（副动作）**；`Esc` 暂停。手机/平板必须有等价触屏控件。
7. 失败文案永远只鼓励、不批评。
8. 不删除、不降低既有测试断言。本基线水位：**3918**。
9. 音效只用 `api.play("tap"|"win"|"oops"|"coin"|"pop"|"meow"|"jump")`。
10. `destroy` 必须清干净：`window/document` 监听、`setInterval`/`setTimeout`、`requestAnimationFrame`、`AudioContext` 节点。

## 五、1.2 相对 1.1 的产品增量（本基线尚未实现，只登记需求）

1. 再加 **21 款**经典 / 排行榜向游戏（id 已在 `00-catalog.md` 定稿）。大人也爱玩。
2. 加完之后对 **76 款**每一款做审查 + 精细化升级（规则、模式兼容、2.5D/3D、建模、视觉、手感、手机文字、可参考的开源项目）。
3. 平台能力（第 1 步落地）：
   - **root 高权限门**：打开后可任意跳关 / 直达第 XX 关；默认密码 `kangkang`；要打开请联系管理员 `18438037080`；可关闭；**一小时后默认关闭**。
   - 手机版文字：字号、换行、对比度、安全区、**360px** 宽不断字、不溢出。
   - 首页可筛选 **手游 / 端游**；`GameMeta.platform` 表达 `"mobile" | "desktop" | "both"`。
4. 每步 3 个子代理，文件所有权互不相交。

## 六、不要做什么

- 不要改 `main`，不要 merge 进 `main`。
- 不要 force push。
- 不要用 `gh` 开 / 改 / 合 PR。
- 不要实现游戏代码（本基线文档的作者是提示词主管；执行者另见各步派发提示词）。
- 不要再套娃派生云端子代理去写代码。
