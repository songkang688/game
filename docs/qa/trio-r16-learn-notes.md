# 三人组第 16 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`origin/game-1.3 = 121ea896`（含 r14 笔记+N-86、r15 笔记 N-75…N-85、B r14 `d78c9e50`、r13 B `40a9aa3f`）。
> **不覆盖** `trio-r14*` / `trio-r15*`。
> **编号**：grep 全部 trio playbook 最大号 = **N-86**。本工位从 **N-87** 续编。
> 避开已量：结算弹窗、color-fun、金钩商店、分屏 N-52…57 复测、收藏、三图/简谱/麻将对局/连招/相册/射击双人/王子两人/仓鼠闯关/贪吃无尽/泡泡海/五子闯关/坦克雪仗闯关。
> 换面：未抽 1.3 窗口闯关、root×钓鱼/花园守卫、格斗双人选人、duo-rush 菜单、组字深关。主档 **915×412**。`src/**` 一行未动。
> 基线 commit `3e5e4795`。工装 `/tmp/trio-r16-measure.mjs` `/tmp/trio-r16-shots/` 不进库。

## 一、抽验方式

- 独立 worktree：`npm test`；`npx tsc --noEmit` 绿；`npx vite build && npx vite preview --port 4187`。
- puppeteer-core + `/usr/local/bin/google-chrome`。每案独立 `createBrowserContext()`。
- 量法同 r4–r15。进场水位：**1168 文件 / 19441 用例全绿**（本环境无 5s 超时红）。

## 二、对账（已合入 → ✅，勿再做）

| 批次 | SHA | 结论 |
| --- | --- | --- |
| 壳 A r12 | `e195ff19` | N-48/58/59 ✅ |
| B r12 | `9648a8ac` | N-60/61/62 **源码**已合；本轮 915 仍 **贴线切 28–32px**（见残余，不换号、不按 436 重写） |
| B r14 | `d78c9e50` | N-69…74、N-49/50/54、N-2/3/4 dvh 钳 **源码已合** |
| r13 B | `40a9aa3f` | N-64…67 源码已合 |
| 本轮 915 | — | **N-2** flight-chess 闯关折叠 0；**N-4** hero-cards 折叠 0；**N-64** junqi 双人折叠 0；**N-67** 五子设置页折叠 0 → 浏览器 ✅。**N-3** 地格 13px@429 仍切。**N-86** 大厅卡仍切。 |

**A 仍未合（r15 口径）**：N-63、C-6 121、N-37、N-68、N-73、N-77。

## 三、新抽验（915×412）

**干净（这些 id/态下轮不必再量）**：

- **garden-guard / rainbow-run / fruit-slice / fishing-star / gold-hook 闯关（非商店）**：crop ≤2，折叠 0。
- **root×fishing-star L1**：crop 2，永久文案「管理员权限已永久开启」，折叠 0。
- **root×garden-guard L1**：crop 0，折叠 0。
- **word-garden 第 1 关 + 组字深关 172 族**：crop 0，折叠 0。
- **puff-bros 闯关 / hop-pads 闯关 / red-blue-tap 闯关**：折叠 0（红蓝点 22px 为棋子观察）。
- **N-2 / N-4 / N-64 / N-67** 见上。
- **失败只鼓励**：`FAIL_LINE` / level99 失败池未改；clock-house 仍不弹整关失败层。
- **商标**：排除 `.cursor/skills`、`*.test.ts`、`qaAudit` 词表后，孩子可见文案无计划黑名单。

**旧号复证（不换号）**：

| # | 对象 | 本轮 |
| --- | --- | --- |
| N-12 | pool-stars | 击球 425、暂停 482，crop 340 |
| N-10 | weiqi-garden 闯关 | 工具行 450，canvas 出屏 43 |
| N-60/61 | orb / snake 闯关技能 | top **398** 切底（与 r14/r15 贴线残余同） |
| N-62 | merge-2048 四向 | top **394** 切底 |
| N-86 | brave-path 大厅 | `.bvp-mode` top **337** h=116 仍切 |
| N-3 | star-estate | 地格 13×13 top **429** |
| C-8 | balloon-pop **闯关** | 气球 455（无尽是 N-82，勿混账） |
| C-2 | brick-break | crop 172、折叠 0 |
| N-7 族 | balloon 闯关 | 见 C-8 |

**新发现（N-87 起）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-87 | **duo-rush 模式菜单**「怎么玩 / 收藏册」线下（≠ N-40 赛道工具条） | 未进赛道：怎么玩 top **450** h=43、收藏册 **505**，crop 234 | 🔧 菜单 CTA 钉进 412；赛道 sticky 勿回退 |
| N-88 | **fight-king 双人对战选人壳「开打 ▶」**（≠ N-57 训练场） | 开打 top **455**。角色卡在屏 | 🔧 与 N-57 同构：选人壳 sticky 底；勿改已绿的训练关内垫 |

**观察**：duo-rush 本轮停在菜单，未复测赛道 N-40。tap-tiles crop 66 贴线。fruit-catch 闯关 crop 159 无键线下。fk 双人若先 scroll 再开打未测关内。

## 四、skills

`frontend-design`：对战选人「开打」是唯一 CTA，与训练场 N-57 同一句。`frontend-design`：休闲菜单「怎么玩」不能排在 412 线下。`canvas-design`：花园守卫/彩虹跑/切水果本轮画布已满屏，钳高别误伤。

## 五、已收口

第二节浏览器 ✅；花园守卫/彩虹/切水果/钓鱼/金钩闯关/组字；root×钓鱼/守卫；失败文案与商标扫描。不要覆盖 r14/r15 原文。不要把 N-87 写成 N-40。不要把 N-88 写成 N-57。
