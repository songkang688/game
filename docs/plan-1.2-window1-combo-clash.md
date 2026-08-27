# 窗口 1 · 第 3 步 A 档 —— `combo-clash`「连招对决」工作计划

对着 `docs/plan-1.2-step3-A-combo-clash.md` 施工。本目录是本档的独占目录，
`src/games/fight-king/**` 只读不改（本款必须比它更深）。

## 一、模块切分

| 文件 | 职责 | 只放什么 |
| --- | --- | --- |
| `meta.ts` | 首页卡片纯数据 | id/title/emoji/category/color/blurb/modes/levels/platform，不 import 玩法 |
| `frames.ts` | 帧数据纯数据表 | 10 位原创角色 × 12 个招式槽的三段帧、取消窗口帧、无敌帧、护盾消耗 |
| `rules.ts` | 判定纯函数 | 判定框、上中下段、取消窗口、超级取消、跳入落地接、破防、对拼、起身、贴边、连段衰减、回合与 BO3 |
| `engine.ts` | 逐帧对局状态机 | 只调 `rules.ts`，不掷随机数，不碰 DOM |
| `ai.ts` | 四档人机 | 反应延迟 + 决策倾向，确定性随机 |
| `levels.ts` | 188 关战役配置 | 8 章 `CHAPTERS`、`levelConfig`、`levelWon`、`starsFor` |
| `guide.ts` | 攻略书 | 8 条章节攻略 + 通用心得 |
| `index.ts` | 挂载 | Canvas 舞台 + DOM HUD + 键鼠/触屏 + 五种模式 |

## 二、相对 `fight-king` 的加深清单（逐行落点）

| 系统 | 本款多出来的 | 落点 |
| --- | --- | --- |
| 跳入 | 空中命中后落地可接地面连；空中招算上段，必须站着挡 | `rules.landCancel` / `guardBeats` |
| 取消 | 只有 active 命中后的 `cancelLag` 帧内能取消；空振取消失败进收招 | `frames.Move.cancelLag` / `rules.inCancelWindow` |
| 超必 | 必杀命中帧内花槽取消成超必；LV1 槽 50、LV2 槽 100 | `rules.canSuperCancel` / `frames.SUPER_LV1_COST` |
| 槽位 | 元气 + 能量 + 护盾三槽，护盾打空即破防，硬直显著变长 | `rules.guardCrush` / `engine` 的 `guard` 字段 |
| 回合 | 三局两胜，每回合满元气；贴边加厚连段 | `rules.roundResult` / `matchResult` / `cornerClamp` |
| 起身 | 受身落地 / 原地起 / 后跳起三选一，起身前 4 帧投技无敌 | `rules.wakeupOptions` / `throwInvuln` |
| 对拼 | 同帧判定框重叠且优先级差 ≤ 1 → 火花互退 | `rules.clashOrHit` |
| 指令 | 「下 → 前 + 重」或一键出必杀；训练模式显示输入历史 | `rules.readCommand` / `index` 训练模式 |
| 连段 | 空中连状态、落地限制、连段计数 HUD、训练假人可设站立/跳/挡 | `rules.juggleScale` / `engine.comboHits` |
| 角色 | 10 位原创角色，帧数据全部重做，含体术 / 投射 / 抓投 / 蓄力四种型 | `frames.CHARACTERS` |

## 三、188 关切分

24 + 24 + 24 + 24 + 24 + 22 + 22 + 24 = **188**，`assertTotal(CHAPTERS, 188)` 钉死。
章节：轻击学堂 / 取消入门 / 跳入花园 / 破防工坊 / 超必剧场 / 贴边悬崖 / 起身猜拳 / 连招杯。

## 四、分级红线

无血、无伤口、无死亡；体力叫「元气」，招式只写「威力」；元气见底是「坐下休息，换下一回合」。
招式名全部原创粉彩系；失败文案只鼓励。`prefers-reduced-motion` 下顿帧 = 0、抖动关闭。

## 五、测试下限

新增 ≥ 40 个用例，覆盖：三段帧推进、判定框只在 active 生效、上中下段 × 站蹲挡四种组合、
取消窗口内外与空振、超级取消耗槽与 LV1/LV2 门槛、跳入落地接、破防硬直变长、对拼优先级差 ≤ 1、
起身三选一与投无敌帧、贴边连段、连段衰减与 8 段强制倒地、BO3 胜负与平局、`assertTotal`、
四档 AI 强度单调（固定 seed 地狱档打菜鸟档 30 局）、第 1/100/145/188 关能打到真实胜负、`destroy` 干净。
