# 1.2 升级第 49 步 / 共 57 步 —— 识字 · 涂色 · 音乐
> 每代理 1 款。派发整段提示词，末尾标明你是 A/B/C。新游戏暂定 id 以主管 catalog 为准。

---

## A —— `word-garden` 识字小花园

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 49 步 / 共 57 步，角色 **A**，独占 `word-garden`「识字小花园」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/word-garden/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 形近、成语、偏旁。字体必须系统字体可显示。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 选字、组词。攻略不给标准答案字。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 抢认。 |
| 无尽 | 字流。 |

- 开花动画
- 形近字并排对比

**2.5D / 3D 决策：** 2D。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 汉字 ≥ 22px
- 对比度

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/word-garden/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 题库边界
- 不泄题

不要做什么：
- 繁简混用导致错误教学

与邻接游戏的冲突点：
- 与 pinyin 入口相邻

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## B —— `color-fun` 涂色小屋

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 49 步 / 共 57 步，角色 **B**，独占 `color-fun`「涂色小屋」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/color-fun/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 渐变、互补、限色。油漆桶误点。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 区域填充、调色。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 不适合。 |
| 无尽 | 限色挑战流。 |

- 填充扩散动画（洪水填充可视化短）
- 撤销

**2.5D / 3D 决策：** 2D 填色。不要 3D 绘画软件。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 调色盘横滑
- 色块带名称

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/color-fun/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 填充边界
- 限色判定

不要做什么：
- 不要外链图片

与邻接游戏的冲突点：
- canvas 全局合成模式 restore

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~

---

## C —— `music-stars` 音乐星星

~~~~text
请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你就是被派发的执行者。禁止再用 Task 派生云端子代理。只推 game-1.2，禁止 force，禁止改 main。】

仓库 https://github.com/songkang688/game ，产品「一朵一星」，1.2 升级第 49 步 / 共 57 步，角色 **C**，独占 `music-stars`「音乐星星」。

## 分支纪律
- `git fetch origin game-1.2`，工作分支建在 `origin/game-1.2` 上。
- 开工先提交一条 git 记录（角色 + 本款计划），再改代码。
- 收尾：fetch → rebase `origin/game-1.2` → `npm test && npm run build` 全绿 → 普通 push。
- 模型 slug 必须是提示词里的 `claude-opus-5-thinking-high-fast`；完成后在回复里写实际 slug。

## 1. 现状审查（先读源码 / 第一版，再动手）

通读 `src/games/music-stars/`（`meta.ts` `index.ts` `logic.ts`/`levels.ts`/`engine.ts` 及测试、`guide.ts`）。对照 1.1 派发与计划文档，以**仓库真实代码**为准。

1. 音程、双声部、简谱。判定窗口。WebAudio 只用平台音或自合成，无外链 mp3。

## 2. 通行规则对照（检索后的要点，必须进实现）

- 落键判定 perfect/good。

结构参考：可参考同类开源的纯逻辑拆分，不引入运行时依赖、不带商标素材。

## 3. 玩法升级

| 模式 | 决策 |
| --- | --- |
| 闯关 | 188。 |
| 对战 | 对谱。 |
| 无尽 | 节奏流。 |

- 音符下落时间线（不能瞬到判定线）
- 无尽 BPM 缓升封顶

**2.5D / 3D 决策：** 2D 谱面。不要 3D 演唱会。

## 4. 视觉 / 建模 / 动效（含手机）

- 360px 轨道 4 条可玩
- 判定线粗

- 360px 不溢出：字号 ≥ 14px，正文对比度 ≥ 4.5:1，触控热区 ≥ 44px。`prefers-reduced-motion` 下降动画时长。
- 面向约小学六年级，粉彩萌系，失败只鼓励。禁止商标 / 官方角色名（注释也不许）。

## 5. 跳关 / 解锁（游戏侧）

本游戏若走 `level99.ts`：验证选关地图与关内菜单的 skip 可用；**补上** mount 带 `initialLevel` 时直接 `startLevel(N-1)`。
自建地图则实现 `openCampaignLevel`。不要自己做密码门。

## 6. 文件所有权

只许碰 `src/games/music-stars/` 与该游戏测试。公共框架（`level99.ts`、`src/ui/*`、`src/engine/*`、`src/styles.css`、`index.html`、`home.ts`）**只读**。
邻接游戏目录一个字都不要动。

## 7. 测试与验收 / 不要做什么 / 邻接冲突

新增测试只增不减。`npm test` 与 `npm run build` 必须绿。

- 判定窗口
- reduced-motion 仍可玩

不要做什么：
- 禁止商业歌名歌词

与邻接游戏的冲突点：
- 音效与 BGM 开关走平台，不要第二套静音

完成后回复：改了哪些文件、模式对照、测试结果、**实际使用的模型 slug**。
~~~~
