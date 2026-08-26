# 一朵一星 1.2 · 主管文档（A 档）

> 你正在读的是 1.2 的**统筹主管文档**。本文件规定谁派、按什么顺序派、文件归谁、怎样才算过关、三家提示词文档最后如何收成一份可派发总脚本。
> 本档作者只写提示词 Markdown，**禁止实现任何游戏代码**，禁止再派生云端子代理去写代码 / 玩游戏实现。
> 目录：[`00-index.md`](./00-index.md) · id 对照：[`00-id-map.md`](./00-id-map.md) · 规划清单：[`00-catalog.md`](./00-catalog.md) · 基线：[`../upgrade-prompts/12-game-1.2-baseline.md`](../upgrade-prompts/12-game-1.2-baseline.md) · 第 1 步：[`step-01.md`](./step-01.md)
>
> **收口（B/C 已合入）：** 已落地 **36** 个派发步（1 + 10–16 + 30–57）。规划稿里的 38 步 / catalog 21 个 id 仍保留作别名；**新建目录听 B 档施工 id**，见 `00-id-map.md` 与 `00-index.md`。

---

## 〇、一句话

1.2 全部工作推到 **`game-1.2`**。后续 1.2 全部用这个分支。不要改 `main`，不要 merge 进 `main`。每步同时派 3 个云端子代理（A/B/C），文件所有权互不相交；上一步三人的提交都在 `origin/game-1.2` 上且 `npm test` / `npm run build` 全绿，才允许派下一步。

执行子代理的模型 slug **只写进提示词正文**：`claude-opus-5-thinking-high-fast`（不要带方括号）。主管 / 编排员自己 inherit 父模型，不要把自己的 Task 模型设成这个 slug。

---

## 一、主管职责

主管（本档的「你」，以及以后按本档派发的人）只做编排，不写游戏实现。

1. **按步串行派发。** 顺序是派发步号，不是文件名里的数字空隙。完整顺序见第三节总表。禁止跳步、禁止跨步并发。
2. **每步同时派 3 个云端子代理。** 复制该步文档里对应的 A/B/C 完整提示词（或复制该步文档全文，末尾加一行「你是 A」/「你是 B」/「你是 C」）。三人并行，因为独占文件互不相交。
3. **检查三人都推上了 `game-1.2`。** 每人收尾必须 `git fetch origin game-1.2` → `git rebase origin/game-1.2` → 重跑测试构建 → `git push origin HEAD:game-1.2`。被拒就再 fetch+rebase，**禁止 `--force`**。
4. **`npm test` / `npm run build` 全绿才下一步。** 基线见 `12-game-1.2-baseline.md`（142 文件 / 3918 用例）。只许加测试，不许删测试、不许调低断言。
5. **文件所有权冲突仲裁。** 两人改了同一路径：以「该步文档里写明的独占者」为准，另一方必须 revert 自己的越界 diff。公共契约文件（内容逐字相同）rebase 时会自动跳过，不算冲突。
6. **商标扫描。** 每步合入后至少 `rg` 一遍黑名单（见 `00-catalog.md` 第五节 + 下文法律红线）。命中则打回，不准进入下一步。
7. **步间 rebase。** 主管在派下一步之前，确认 `origin/game-1.2` 已包含上一步三人的全部提交。若 `bumper-cars` 仍不在 1.2，**在派第 1 步之前**先把 `origin/game-1.1` 的 `src/games/bumper-cars/**` rebase / cherry-pick 进来（这是 1.1 已完成库存，不是 1.2 新游戏）。
8. **不写游戏代码、不套娃。** 主管自己若被当成云端子代理，禁止再用 Task 派生执行者；派发方才用 Task。

---

## 二、派发方式

### 2.1 给派发方看的口令

每步对三个子代理各发一段。指定模型 slug：`claude-opus-5-thinking-high-fast`。工作必须落在 `game-1.2` 持续优化线上。

每段执行提示词的**开头必须逐字**是：

```
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug
```

紧接着必须写清：

> 【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的，你必须自己动手完成，禁止再用 Task 派生任何云端子代理。全部推 `game-1.2`，不回 `main`。】

### 2.2 收尾 rebase 口令（每步、每人）

```bash
git fetch origin game-1.2
git rebase origin/game-1.2        # 有冲突就解冲突，绝不 force
npm test && npm run build         # rebase 后必须重跑，必须全绿
git push origin HEAD:game-1.2     # 普通推送；被拒就再 fetch+rebase 重来
```

禁止：`git push --force`、`git push --force-with-lease`、改 `main`、merge 进 `main`、用 `gh` 开/改/合 PR。

### 2.3 开工 git 记录

每个执行子代理开工前：从 `origin/game-1.2` 拉工作分支 → **先提交一条「工作计划 / 基线」commit** → 再改代码。

---

## 三、1.2 总步数与阶段

「33 步」只是例子。规划稿按 55+21=76 款算过 38 步（含首页 60 与三轮 QA）。**B/C 交卷后按实际文件收口为 36 步：**

```
平台     1     step-01.md
新游戏   7     new-games/step-10.md … 16.md
升级    25     upgrades/step-30.md … 54.md
冲突     1     upgrades/step-55.md
验收     2     upgrades/step-56.md … 57.md
合计    36
```

编号空隙 02–09、17–29 故意留空。没有 `step-60`–`63.md`：首页筛选在第 1 步 B，冲突/接线在第 55 步，验收两轮在 56–57。需要第三轮 QA 时再补文档。

**1.2 当前一共分 36 个派发步。** 人类目录与每步 A/B/C 以 [`00-index.md`](./00-index.md) 为准。

### 3.1 阶段

| 阶段 | 派发步 | 文档谁写 | 干什么 |
| --- | --- | --- | --- |
| 平台 | 1（预留 02–09） | A 档已写 `step-01.md` | root 门 + 手游/端游筛选 + 手机文字 + 模式/2.5D 基建 |
| 21 新游戏接入 | 10–16 | B 档 `docs/game-1.2/new-games/` | 每步 3 款，每款一个子代理；**id 以 B 文档为准** |
| 精细化升级 | 30–54 | C 档 `docs/game-1.2/upgrades/` | 每步 3 款；新游戏 id 先对照 `00-id-map.md` |
| 冲突 / 串味 | 55 | C 档 `upgrades/step-55.md` | 存档、CSS、快捷键、root API、destroy |
| 验收三人组 | 56–57 | C 档 `upgrades/step-56.md`–`57.md` | 测 / 学 / 修 × 2 轮 |

### 3.2 派发总表（36 步）

| 派发步 | 主题 | A 独占 | B 独占 | C 独占 | 提示词文档 |
| --- | --- | --- | --- | --- | --- |
| 1 | 平台基建 | `src/ui/rootGate.ts` + `rootGate.test.ts`；`src/games/level99.ts` + `level99.test.ts`；`src/games/quiz99.ts` + `quiz99.test.ts` | `src/engine/types.ts`；`src/ui/homeFilters.ts` + `homeFilters.test.ts`；`src/ui/home.ts`；`src/ui/mobileText.ts` + `mobileText.test.ts`；`src/styles.css`；`index.html`（仅 viewport / 安全区 meta） | `src/engine/playModes.ts` + `playModes.test.ts`；`src/engine/view25d.ts` + `view25d.test.ts` | [`step-01.md`](./step-01.md) |
| 10–16 | 新游戏 × 21 | 见 `00-index.md`（施工 id） | 同左 | 同左 | B：`new-games/step-1X.md` |
| 30–54 | 升级 | 见 `upgrades/README.md` 对照表 | 同左 | 同左 | C：`upgrades/step-XX.md` |
| 55 | 冲突 / 串味 / 回归 | 见该步文档 A 段 | 见该步文档 B 段 | 见该步文档 C 段 | C：`upgrades/step-55.md` |
| 56 | QA 第 1 轮 | 测试员 | 学习优化员 | 监督修复员 | C：`upgrades/step-56.md` |
| 57 | QA 第 2 轮 | 测试员 | 学习优化员 | 监督修复员 | C：`upgrades/step-57.md` |

步 1 三人还必须**逐字同建**公共契约 `src/ui/root12Contract.ts`（内容见 `step-01.md`）。内容完全相同的新文件 rebase 时自动跳过。

步 55 与步 1 都可能碰到 `home.ts` / `styles.css`：两步**串行**，不并行。步 1 先落地筛选与 root；步 55 只做冲突/接线/destroy 审计。

---

## 四、与 1.1 的差异

| | 1.1 | 1.2 |
| --- | --- | --- |
| 持续优化分支 | `game-1.1` | **`game-1.2`** |
| 派发脚本形态 | 一份 `11-game-1.1-dispatch-prompts.md` 含 15 步 | 先分三家写（本档 + B `new-games/` + C `upgrades/`），收口再拼成 `13-game-1.2-dispatch-prompts.md` |
| 步数 | 15（框架 1 + 老游戏加深 2–5 + 2.5D 6 + 新游戏 7–11 + 首页 12 + QA 13–15） | **36**（平台 1 + 新游戏 7 + 升级 25 + 冲突 1 + QA 2） |
| 游戏数 | 规划 55；仓库当时 54 | 规划 76 |
| 家长门 | 算术题 `parentAuth`（basic/high，5 分钟，内存） | **保留算术门**，另加 **root 密码门**（1 小时，可关，直达任意关） |
| 首页筛选 | 分类 + 玩法芯片（闯关/对战/无尽/双人） | 再加 **手游 / 端游**（`meta.platform`） |
| 视觉 | 第 6 步跑酷 2.5D | 共享 `view25d` 基建，升级步按游戏选用 2.5D/伪 3D |
| 新游戏 | 约 21 款（斗地主、钩钩、碰碰车…） | **另外 21 款**（IO 圆圆/长蛇、方块、连招擂台、麻将、富翁、卡牌杀、围子、飞行棋 + 12 款补位） |
| 老游戏 | 99→188 关 | 不再扩关数；做**精细化**（下落动画、人机多档、无尽、2.5D…） |
| slug 写法 | 1.1 原文带了方括号 | **不要方括号** |

1.1 的模块约定、存档 key、离线、商标、键位、失败只鼓励，1.2 **全部继承**，见基线第四节。

---

## 五、法律红线（违反即打回）

- 面向孩子的任何可见文案（`title` / `blurb` / 章节名 / 角色名 / 提示语 / 攻略 / README）以及**代码注释**，禁止商业商标与官方角色名。完整黑名单见 `00-catalog.md` 第五节。
- 内部研究原作玩法允许；研究结论只许体现为玩法结构。
- 无血、无伤、无死亡描写。体力条叫「元气」，威力不叫伤害。`petal-scout` 不写雷、不写爆炸。`poop-hero` 保持干净不恶心。
- 无广告、无内购、无账号、无联网上报。IO 游戏用人机本地模拟，禁止 Socket 服务器。
- 不引入外部运行时依赖，**禁止 three.js**。
- 不把 `dist/`、`release/`、安装包、APK、大图或视频提交进 git。

---

## 六、root 高权限门（产品说明）

这是给**家里管理员**用的，不是给孩子闯关用的。1.1 的算术家长门继续用于「跳过当前关」；root 门用于「我就是管理员，我要随便玩第 XX 关」。

| 项 | 规定 |
| --- | --- |
| 默认密码 | `kangkang`（写进代码常量，本地全家桶，不联网） |
| 要打开请联系 | 管理员 `18438037080`（弹窗必须展示这句话） |
| 打开后能做什么 | 任意跳关；选关地图出现「直达第 N 关」；可直接玩第 XX 关（绕过三星解锁） |
| 可关闭 | 弹窗与家长面板都有「关闭管理员权限」 |
| 默认过期 | **打开后 1 小时自动关闭**（`expiresAt = now + 3600000`） |
| 存档 | 只写 `yiduo-yixing.root.v1` = `{ expiresAt: number }`，**绝不写密码** |
| 与算术门关系 | `parentAuth` 原样保留。root 开着时，跳关 / 直达关 **不必再做算术题**；root 关着时走原来的 `requestSkip` → `requestParentAuth("high")` |
| 防暴力 | 密码错 3 次锁 120 秒；输入用 `type=password` |
| 孩子界面 | 首页不放显眼的「root」字样。入口放在**已有家长面板内部**（「管理员权限」折叠段）。关卡地图仅在 `isRootOpen()` 时显示直达控件 |

第 1 步 A 实现门本身与 `level99` / `quiz99` 接线；B 在家长面板旁的首页入口用动态 import 调用，避免静态环。

---

## 七、全局技术约定（执行提示词必须重申）

1. `meta.ts` 纯数据，不 import 玩法；`index.ts` 懒加载。
2. 存档 key 不改语义（基线第四节）。
3. 离线可玩。
4. 禁止商标文案。
5. 朵朵 `WASD+F/G`，星星 `方向键+L/K`。
6. 失败只鼓励。
7. 每款游戏都要能回答：能闯关吗？能对战吗？能无尽吗？不适用的在 `meta` 注释或 guide 里写明理由，并正确填写 `modes`。
8. 新游戏 `platform` 必填；老游戏第 1 步缺省当 `both`，升级步改准。

---

## 八、提示词工程的三档分工（你现在所处的阶段）

在「派 38 步去改游戏」之前，先有三档人把提示词写完：

| 档 | 谁 | 独占路径 | 产出 |
| --- | --- | --- | --- |
| A 主管 | 本文件作者 | `docs/game-1.2/00-*.md`、`docs/game-1.2/step-01.md`、`docs/upgrade-prompts/12-game-1.2-baseline.md` | 职责、步数、21 id 定稿、第 1 步完整派发词 |
| B 新游戏 | 另一档 | **只许** `docs/game-1.2/new-games/` | 步 10–16 每步一份，内含 A/B/C 三段完整可复制提示词 |
| C 升级 | 另一档 | **只许** `docs/game-1.2/upgrades/` | 步 30–57 每步一份，同样三段完整提示词 |

A **不要写** `new-games/` 与 `upgrades/`。B/C **不要改** A 的五个文件（收口提交可改 `00-*`）。B 与 catalog 的 id 分叉已记在 `00-id-map.md`，执行时 **施工听 B**。

---

## 九、全部写完后如何收成一份可派发总脚本

目标文件：`docs/upgrade-prompts/13-game-1.2-dispatch-prompts.md`（仿 `11-game-1.1-dispatch-prompts.md`）。由主管在 B/C 都 push 到 `game-1.2` 之后做一次收口提交（仍只改文档）。

检查清单（逐条打勾才算收口完成）：

- [x] B 的 `new-games/step-10.md` … `step-16.md` 七份都在，每份有三段完整提示词。
- [x] C 的 `upgrades/step-30.md` … `step-57.md` 都在（无 60–63，冲突/验收收在 55–57）。
- [x] 三套新 id 已写成 [`00-id-map.md`](./00-id-map.md)；**施工听 B**，catalog 作别名。
- [ ] 若要一份仿 1.1 的巨型总脚本 `13-game-1.2-dispatch-prompts.md`：按 `00-index.md` 顺序把各步文档链过去即可，不必把 36 份再复制进一个文件。
- [x] 链接能点：从 `00-index.md` 能跳到每一步已落地文档。
- [ ] 每步合入代码时仍走第十节监督清单（测试构建、商标、独占文件）。

收口时不要改游戏代码。若发现 B/C 正文缺验收或越界，打回 B/C 补文档，不要主管代写他们的目录。

---

## 十、监督清单（每步合入时用）

打印或复制：

```
步号：____    日期：____
[ ] 三人回复都写了角色、文件列表、用例增量、SHA、模型 slug = claude-opus-5-thinking-high-fast
[ ] origin/game-1.2 含三人提交
[ ] npm test 全绿，用例 ≥ 上一步水位
[ ] npm run build 全绿
[ ] 无人 force push、无人改 main
[ ] rg 商标黑名单 0 命中（含注释）
[ ] 无人改存档 key 语义
[ ] 无人引入外部运行时依赖
[ ] 独占文件无越界（git diff --name-only 对照本步表格）
[ ] 新游戏（若有）meta.ts 不 import 玩法；index.ts 懒加载
[ ] root 门若本步有关：1 小时过期、可关、电话文案在、密码不写进 localStorage
```

冲突处理：

1. 同一步两人改同一文件 → 非独占者 revert。
2. 公共契约内容不一致 → 以 `step-01.md` 里的逐字版本为准，三人重写成一样。
3. rebase 冲突 → 先合独占者的 hunk，再跑全量测试。
4. 测试红在别人的文件 → 写进回复让下一步处理，本步不得越界去改。除非是你自己引入的类型错误波及别人（尽量用契约避免）。

验收门（整次 1.2 收官，步 63）：

- 库存老游戏 + B 档 21 款都能进、能玩到真实胜负、destroy 后再进不报错。
- 首页手游 / 端游筛选可用。
- root 门：密码对 → 直达关；一小时后关；可手动关；电话文案在。
- 360px 宽：抽 10 款 + 首页，文字不溢出、对比度 ≥ 4.5:1、安全区留白。
- `npm test` / `npm run build` 全绿；PWA 离线可玩。
- 商标 0 命中。

---

## 十一、本档独占文件（A 档提示词工程）

只许新建 / 修改：

- `docs/game-1.2/00-supervisor.md`（本文件）
- `docs/game-1.2/00-index.md`
- `docs/game-1.2/00-id-map.md`
- `docs/game-1.2/00-catalog.md`
- `docs/upgrade-prompts/12-game-1.2-baseline.md`
- `docs/game-1.2/step-01.md`

平台不拆第 2 步：用户指定的三件平台能力（root 门、手游/端游 + 手机文字、模式与 2.5D 基建）正好分给步 1 的 A/B/C，文件已经互不相交。
