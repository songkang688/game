# 三人组第 17 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`origin/game-1.3 = 30cc10ab`（含 r16 摘合 N-77/N-87/N-88/N-47 芯片、`7a2d560b` N-86 大厅、r13 A `215958e`、r14 A `87c5aff`/`44d9e50`、B r14 `d78c9e50`）。
> **不覆盖** `trio-r15*` / `trio-r16*`。
> **编号**：grep 全部 trio 文档最大号 = **N-88**。本工位从 **N-89** 续编，收在 **N-93**。
> 避开已量：r16 的花园守卫/彩虹跑/切水果/钓鱼/金钩/组字/泡泡兄弟/跳跳垫/红蓝点、r15 的 N-75…N-85 在途款、r13/r14 棋类分屏与三图/简谱。
> 换面：本轮抽 **r16 后未量过的 19 款菜单 + 14 个进阶态**（双人/对战/关内/root×深关）。主档 **915×412**。`src/**` 一行未动。
> 工装 `/tmp/trio-r17-measure.mjs` `/tmp/trio-r17-shots/` 不进库。

## 一、抽验方式

- `npm install` 后 `npx tsc --noEmit` 绿；`npx vite build` 绿；`npx vite preview --port 4173`。
- puppeteer-core + `/usr/local/bin/google-chrome`，每案独立 `createBrowserContext()`，`page.setViewport 915×412`，`getBoundingClientRect` 留数。
- root 面：写 `yiduo-yixing.root.v1 = {expiresAt:9999 远期, mode:"permanent"}` 后重挂 hash（密码门口径 = `ROOT_DEFAULT_PASSWORD`，密码本身不落任何存储，r16 已验）。
- **进场水位注意**：`npm test` = **1182 文件 / 19477 用例，1 红**（`casualFit.r10b`，见 N-93）。红在主干、非本工位所改。

## 二、对账（r16 已落地 → ✅，勿再做）

| 批次 | SHA | 结论 |
| --- | --- | --- |
| r16 摘合 | `30cc10ab` | **N-77** 小屋相册、**N-87** 冲刺菜单 CTA、**N-88** 格斗双人开打、**N-47 残留**（mole-pop/box-hamster/收藏星芯片）**源码已合**，本轮 915 复测全绿（数字见下） |
| r16 B | `7a2d560b` | **N-86** brave-path 大厅 `.bvp-lobby` **源码已合**，915 复测绿 |
| 旧批次 | `215958e` / `87c5aff` / `44d9e50` / `d78c9e50` / `40a9aa3f` | N-63/C-6/N-37/N-68/N-73/N-69…74/N-64…67 维持 r16 对账结论，本轮未重测 |

**915 复测数字（✅ 六案）**：

| # | 对象 | 本轮实测 | 结论 |
| --- | --- | --- | --- |
| N-77 | kitty-care 小屋相册 | 首排「⭐8…16 换回来」整排在屏（底 ~310）；第 2 排起 406/537/668 在 `.ktc-grid` 自身卷轴内（crop 447）可滚可点；无 <44 芯片 | ✅ |
| N-87 | duo-rush 模式菜单 | 怎么玩/收藏册/开跑 `.dr-menu-cta` 钉顶，线下 CTA = 0；让分开关 400–448 在 stage 卷轴（crop 126）内可达 | ✅ |
| N-40 守门 | duo-rush 赛道态 | 暂停/再来一局/换玩法 sticky 底 **351** 在屏，画布 90–385 满屏 | 未回退 ✅ |
| N-88 | fight-king 双人选人 | 「开打 ▶」钉在返回行（top ~104），below/cut 0，crop 0 | ✅ |
| N-86 | brave-path 大厅 | 四模式卡 below/cut 0，stage crop 21 | ✅ |
| N-47 残留 | mole-pop / box-hamster / alien-seek / 收藏星 | 三款菜单与 box-hamster 关内撤销/重来/提示（top 229）均 ≥44；`.collection-stars` `.as-open` 源码 44 | ✅ |

## 三、新抽验（915×412）

**干净（这些 id/态下轮不必再量）**：

- **菜单面全绿（锁定关卡砖都在 `l99-view` 自身卷轴内，非缺陷）**：adventure-king、bomb-buddies、bumper-cars、ice-fire-forest、landlord-cards、math-farm、ocean-munch、pinyin-train、poop-hero、puzzle-tiles、snake-royale、sprout-defense、red-blue-race、red-blue-tug、monster-crisis、dot-maze、xiangqi（菜单）、duo-arena（crop 122 无切）、duo-vs-star（菜单态 crop 140 无切）。
- **进阶态绿**：bumper-cars 双人对战（冲撞/刹车/暂停在屏）；landlord-cards 对战叫分（17 张手牌 + 不叫/1/2/3 分 top 247、暂停 298）与闯关 L1；ice-fire-forest L1 双 D-pad（265–361）；dot-maze 双人追逃/抢豆对战（键 237/291，crop 5）；duo-arena 开擂（双 D-pad + 暂停/规则/退出 311）；ocean-munch 对战三档鱼页；math-farm L1（选项 293）；pinyin-train L1（n/ü/r 300）；poop-hero L1（⬆💨 230、◀⬇▶🧹 292）；adventure-king L1（◀▶⤴🪃🪝⏸ 338）。
- **跳关家长门**（box-hamster 跳过第 1 关触发）：算术题 + 确认/不同意完整入屏，均可点。
- **root 面**：math-farm root 永久会话生效，「直达」两行输入（130/236）在屏（root×深关选项另见 N-92）。

**旧号复证（不换号）**：

| # | 对象 | 本轮 |
| --- | --- | --- |
| N-80 | box-hamster 闯关 D-pad | ⬆ **579**、◀⬇▶ **637**，无可滚祖先（关内芯片行 229 已绿，勿混账） |
| N-47 残留新面 | bumper-cars 模式芯片 **34** / AI 档 **32**；puzzle-tiles「♾️无尽画廊」**38**；landlord-cards 对战「◀回选关」**33** | <44 触控残留，按 N-47/N-16 口径顺手抬，勿开新号 |

**新发现（N-89 起）**：

| # | 对象 | 实测 | 性质 |
| --- | --- | --- | --- |
| N-89 | **duo-vs-star 双人对战选人屏**（≠ N-88 fight-king） | 「两人就位，开打 ▶」top **451** h49（stage crop 162 可滚但首屏无 CTA）、「◀回模式选择」506；场地卡 top 409 h30 切；角色/场地芯片 h **30** | 🔧 开打钉进 412（同 N-88 句式）；芯片顺手抬 44 |
| N-90 | **xiangqi 自由对战设置屏**（≠ N-67 gomoku 已修） | 「⭐星海棋神」409 切、「👫朵朵VS星星」464、红棋 **599**、黑棋 **654**、「开始下棋 ▶」**713**；`xq-wrap` overflow hidden、`l99-host` hidden crop 443、doc crop 0，**滚轮后 713 不动 → 完全够不到** | 🔧 本轮最重：面板收进 412 或给独立卷轴；残局连胜入口在屏勿动 |
| N-91 | **bomb-buddies 双人对战棋盘** | 画布 top 178 底 **475**（h297），底 63px 出屏且 stage crop 0 不可滚；拍破钮底 412 贴底；放泡/踢泡/拍破在屏 | 🔧 钳画布高进 412；闯关/合作同构未量，修时一起看 |
| N-92 | **math-farm root×深关答题选项**（N-37 族新面，≠ shape-kingdom） | 深关（末章末关）选项芯片 4/3/1 top **416** h46 线下，`mtf-farm-host` 自滚 crop 146；L1 选项 293 在屏不受影响 | 🔧 深关收顶部农田行高，让首屏见选项 |
| N-93 | **主干守门测试红**（`casualFit.r10b.test.ts:30`） | 期望 `.dr-start { position: sticky; bottom: 0` 仍在 duo-rush/index.ts；`30cc10ab` 的 N-87 把它改成 `.dr-menu-cta` 钉顶后该句落空 → `npm test` **1 红** | 🔧 守门句式换成 `.dr-menu-cta` sticky top（**勿回退 N-87/N-40 源码**） |

**观察（不开号）**：snake-royale 双人同屏无输入约 2 秒即结算，「🔁再来一局」底 **415** 切 3px 贴线（≤4px 观察）；ice-fire-forest L1 画布元素底 483 出屏但棋盘绘制区完整在屏（勿误修）；bumper-cars 月牙圆台画布 140 宽为关卡造型非缺陷。

## 四、skills

`frontend-design`：「开打/开始下棋」是对战设置屏唯一 CTA，必须首屏可点——N-88 修了 fight-king，本轮 duo-vs-star（N-89）、xiangqi（N-90）同句式复发，同构款要一次扫完。`frontend-design`：overflow hidden 容器里的纵向表单（N-90）在矮横屏是死区，收高优先于加卷轴。`canvas-design`：对战棋盘画布要按 412 钳高（N-91），别按竖屏默认高铺。

## 五、已收口

r16 六案 ✅ 复测留数；19 款菜单 + 14 进阶态换面抽验；新伤 N-89…N-93；N-80 复证不换号；N-47/N-16 残留新面按旧口径。不要覆盖 r15/r16 原文。不要把 N-89 写成 N-88、N-90 写成 N-67、N-92 写成 N-37。N-93 是测试对账伤，修守门句式不是回退源码。
