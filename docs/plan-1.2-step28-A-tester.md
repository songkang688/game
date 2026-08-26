# 1.2 第 28 步 · A 档 —— 验收三人组 **第 2 轮** · 测试员（换样本 + 深度手感）

请通过 Task 工具派生一或多个云端子代理执行本任务。
指定模型 slug：`claude-opus-5-thinking-high-fast`。
请在独立功能分支上进行修改，叫 game-1.2 持续优化。后续都用这个。不要直接修改主分支。
完成后说明修改了哪些文件、测试结果，以及实际使用的模型 slug

【读到这段话的你，就是被派发的那个云端子代理。上面那句「请通过 Task 派生」是写给派发方看的。你就是执行者，禁止再派生任何云端子代理，必须自己动手把活干完。只推 `game-1.2`，不要改 `main`，不要 force。】

仓库 `https://github.com/songkang688/game`，产品「一朵一星」。
这是 **1.2 第 28 步（共 29 步）· A 档 —— 验收三人组第 2 轮（共 3 轮）的测试员**。
本步三人：A 测试员、B 学习优化员、C 监督修复员。**别人的报告文件你一个字都不许碰。**

## 一、分支纪律

- `git fetch origin game-1.2`，工作分支建立在 `origin/game-1.2` 之上。
- **动代码前先提交一条「A 档 · 第 2 轮测试员 · 走查计划」的 commit**。
- 收尾 fetch → rebase → `npm test` 与 `npm run build` 全绿 → 普通 push。**禁止 force、不改 `main`、不用 `gh` 开 PR。**
- 报告写到 `docs/qa/1.2-round2-tester.md`。
- **开工先读第 1 轮的三份报告 `docs/qa/1.2-round1-*.md`**，第 1 轮遗留的一般 / 建议级问题，本轮要逐条复测确认是否已被处理。

## 二、开工前必须认的基线

- 1.2 的盘子：**新游戏 21 款 + 升级 55 款 = 76 款**。起点水位 **142 个测试文件 / 3918 个用例**，**只增不减**。
- 平台共用件：`level99.ts`、`quiz99.ts`、`speech.ts`、`collection.ts`、`parentAuth.ts`、`save.ts`、`level188Contract.ts`。
- 存档 key 前缀 `yiduo-yixing.`；公共 key：`save.v1`、`l99.<id>`、`l99skip.<id>`、`collection.v1`、`fav.v1`、`recent.v1`。

## 三、全量跑

`npm test` / `npm run build` / `vite preview` 冒烟。记录用例总数（对比第 1 轮收尾水位，只增不减）、主 chunk 体积、构建耗时。

## 四、实玩走查：本轮换一批，抽 **26 款**

**与第 1 轮尽量不重复**（第 1 轮覆盖的是 21 款新游戏 + 5 款点名升级款；本轮转向升级款）。抽样要覆盖第 9–26 步各类：

- 对战 / 双人类（`duo-rush` / `duo-arena` / `duo-vs-star` / 红蓝三款 / `ice-fire-forest` / `prince-princess` 中抽）；
- 物理弹射与塔防（`sling-birds` / `candy-swing` / `gold-hook` / `garden-guard` / `sprout-defense` / `monster-crisis` 中抽）；
- 射击与派对（`shoot-range` / `sky-squad` / `tank-battle` / `bomb-buddies` / `snow-fight` / `bumper-cars` / `bowling-lane` 中抽）；
- 泡泡 / 水果 / 记忆拼图 / 牌桌（`bubble-pop` / `bubble-aim` / `balloon-pop` / `fruit-catch` / `fruit-slice` / `snake-snack` / `lianliankan` / `puzzle-tiles` / `memory-cards` / `landlord-cards` / `fishing-star` 中抽）；
- 学习与创作养成（`clock-house` / `math-farm` / `pinyin-train` / `word-garden` / `shape-kingdom` / `find-diff` / `color-fun` / `music-stars` / `kitty-care` 中**至少抽 5 款**）。

每款仍要玩到真实胜负，试第 1 / 100 / 188 关与各模式。在报告里写清抽了哪 26 款、为什么这么抽。

## 五、本轮的 5 个深度专项

| 专项 | 怎么做 |
| --- | --- |
| **难度曲线** | 抽 10 款有 188 关的，记录第 90–110 关与第 170–188 关的实际通关耗时与失败次数。判断有没有「难度跳崖」，也判断后期是不是**只是数值加大**的重复感。全部量化写进报告。 |
| **手感与延迟** | 跑酷 / 格斗 / 平台跳跃三类各抽一款，测输入延迟、土狼时间、输入缓冲是否生效；在 60fps 与 30fps（用 CPU 降频模拟）下手感是否一致；有物理的确认时间步长是固定步长而非按帧。 |
| **竞态与压力** | 快速连点、快速切游戏、快速切页签、暂停 / 恢复 20 次、后台切前台、连续进出同一款 20 次。找崩溃与状态错乱。 |
| **教育正确性** | 学习类 6 款（`clock-house` / `math-farm` / `pinyin-train` / `word-garden` / `shape-kingdom` / `find-diff`）逐款抽 20 道题**人工核对答案是否正确**——拼音声调标注、几何面积周长与展开图、字库有无错别字、数学解法。**教育内容出错一律按「严重」级起步。** 同时确认攻略只讲方法不给答案。 |
| **1.2 新增无尽模式横评** | 1.2 给很多款补了 `endless`。把所有声明了 `endless` 的款列出来，逐款确认：能一直玩下去、难度单调上升、有明确的结算、`recordEndlessBest` 写入且退出重进还在、`meta.modes` 与实际一致。**声明了但玩不了的按「严重」级记。** |

## 六、共用框架回归（本轮重点）

76 款共用一套框架，一处坏就是几十款坏。逐条验并给证据：

- `level99.ts` 188 关框架：选关地图翻页、章节切分、星级、`initialLevel` / `?level=` 直开；
- `parentAuth.ts`：basic 与 high 两级门、跳关记录、清空进度、导出 / 导入；
- `collection.ts` 收藏册与 1.2 新款的接线；
- `quiz99.ts` / `speech.ts`：无中文语音包时的降级；
- `save.ts`：老存档（1.0 长度 99 数组 / 1.1 存档）升级后进度不丢；存档损坏自愈；隐私模式可玩；
- 首页：筛选 / 搜索 / 收藏 / 最近玩过 / 分类计数与 76 款对得上。

## 七、报告要求

产出 `docs/qa/1.2-round2-tester.md`，格式同第 1 轮：每条问题写清 **「复现步骤 / 期望 / 实际 / 严重度 / 建议责任文件」**，问题必须量化。另外：

- 开头给一节「第 1 轮遗留问题复测结果」，逐条标 已修 / 未修 / 无法复现；
- 末尾给「26 款走查结果表」与「无尽模式横评表」。

## 八、你的权限边界

**只写报告与补 `*.test.ts`，不改玩法代码。**

## 九、本轮验收标准（三人共同）

- `npm test` 全绿且用例只增不减；`npm run build` 全绿；preview 冒烟全绿。
- 阻断与严重问题 0 残留；**第 1 轮遗留问题全部有结论**（修复 / 明确关闭）。
- 性能有可量化的改进记录（B 档负责）；三方合并态复验全绿并写明 SHA（C 档负责）。
- 不改存档 key；无外部运行时依赖；**无任何商业商标或官方角色名**；文案面向约小学六年级、不过于低幼、保持中文粉彩萌系。

## 十、分级红线与回复

全库分级红线：无血、无伤害、无死亡描写；失败只鼓励；无广告、无内购、无抽卡、无联网上报；攻略不泄题。完成后回复：你是 A 档第 2 轮测试员；第 1 轮遗留复测结论；走查了哪 26 款；5 个深度专项的量化结果（尤其是难度曲线与教育正确性）；无尽横评结论；发现问题的分级统计；报告路径；`npm test` / `npm run build` 结果与用例总数；提交 SHA；**实际使用的模型 slug**。
