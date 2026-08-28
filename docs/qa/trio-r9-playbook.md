# 三人组第 9 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r9-learn-notes.md`（基线 `game-1.3 = 6a9f42d0`，全部条目带实测数字与截图核验）。
> **对账要点（先读这条再动手）**：测试员 A 第 2 轮（`d451c32d`）已合入——**S-1 / S-2 / S-3 / S-4(l99 侧) / L-1 / C-1(含 ak-bar=N-28) / 竞技场留白 / garden-guard 节点图 / N-24 全部 ✅ 销账**，r7/r8 playbook 相应条目已加对账标注，谁也别再修一遍。**B 的在途分支 `cursor/casual-duo-fit-r5-b-4683`（未合入）覆盖 N-1 / C-2 C-3 C-5 C-6 C-7 / N-11…N-15 N-19 / N-16 N-17 N-18**——这些项动手前必须先 `git fetch` 看 B 是否已合入，撞车取先合版。
> **只列仍未落地的 🔧**。不要重抄已销账的 S-1/S-2/S-3/S-4(l99)/L-1/C-1。新发现 **N-39** + 并行补测 **N-40…N-42**。
> 分工：**A = 壳层 + 闯关学习**，**B = 休闲对战动手**。配方 A–J 见 r4–r8；**K 接线、L 手势面 vs 工具条见 r9 learn-notes**。
> **B 在途再加**：`cursor/trio-r9-tester-b-65de`（N-25/31/1/30/26/27/32）交卷时尚未进 `game-1.3`——动手前 fetch。

## 通用纪律（与 r4–r8 一字不差的红线）

- **不改存档 key**：`yiduo-yixing.l99.<id>` / `yiduo-yixing.l99skip.<id>` / `yiduo-yixing.root.v1` / 平台钱包 key、`meta.id` 一个字符不动。
- **不动题库/判定/关卡生成**：`levels.ts` 数据、seed 链路、win/lose 判定零触碰。
- **测试只增不减**：进场先 `npm test` 记水位（`6a9f42d0` = **1095 文件 / 19288 用例**全绿）；每条修复配 1 份小测试；交卷水位 ≥ 进场。
- **kit 冻结**：`src/art/kit/` 已有文件只 import 不改（stickers.ts 扩容例外）。
- **宽屏零回归**：钳高改动在 412×915 与 1280×800 复测「修前修后一致」。
- 收尾：fetch → rebase → `npm test` / `npm run build` 全绿 → 普通 push，禁 force。

## 测试步骤备忘

- 本地起服：`npm run build && npx vite preview --port 4173`；无头验证 puppeteer-core + `/usr/local/bin/google-chrome`。
- 视口五档：360×640 / 390×844 / 412×915 / **915×412（重灾主档）** / 1024×768；宽屏对照 1280×800。
- **管理员直达**：家长面板 → 管理员权限 → 密码 `kangkang`；脚本里可直接种 `yiduo-yixing.root.v1 = {"expiresAt":9999999999999,"mode":"permanent"}`。深关两条路（root 点格子 / 种 `yiduo-yixing.l99.<id>` 进度）各量一遍，口径见 r8 模式 J。
- **本轮追加工装红线**：凡「开/关对照」（root 态、显隐开关、进度深浅），**每档独立 incognito context 或先 `localStorage.clear()`**——同 profile 连跑两档，前档种子会漏进后档把基线量花（r9 亲测踩坑）。
- 量法口径沿用：stage 裁切 → 自滚 → 逐模式 → 开关打开再量 → 弹窗口径 → 深关关型 → 调用路径×默认参数（K）→ **手势面 vs 工具条分层（L）**。

---

## 壳层（给 A）

### N-33 壳层结算弹窗矮横屏「再玩一次/回首页」折叠在弹窗内滚线下 🔧（连续两轮最重，走配方 I）

- r8 原文有效，源码零提交复证（`styles.css:926` 无 sticky、`dialogs.ts` 零提交、A 的 +222 行全是首页规则）。**口径修正**：915×412 命中的是 `styles.css:1774` `@media (max-height:560px)` 档的 `max-height:92dvh`（可视 ≈379px），不是 86dvh 基础档——机理与修法不变，验收数字按 92dvh 算。
- **正面样板就在库里**：攻略抽屉 sheet 态（`guide.ts` + `.guide-foot`）就是「读的滚（`.guide-body` 内滚）、按的钉（footer 常驻）」，本轮三档实测全绿——`.dialog-buttons` 照这个结构做 sticky 即可，别发明新方案。
- 改哪/验收照 r8 playbook 原文。

### N-38 关内直达小字永久态显示分钟数 🔧（一行级，先做拉绿）

- r8 原文有效；**行号漂移**：`rootJumpNote` 现在 `level99.ts:469`（A 在同文件加了星级 SVG 与 fitPane）。本轮截图再实锤：种永久态后显示「管理员权限还剩 136867925 分钟」。改法照 r8（走 `rootStatusLine` 或加 isPermanent 分支）。

### S-4 扩容 `.qz-jump-input` + 收藏册热区两条 🔧（半小时级凑一批）

- **S-4 主体（l99 侧）已由 A 修掉 ✅**，只剩扩容：`quiz99.ts:153` `.qz-jump-input` 仍 `min-height:38px` → 44px（管理员面，限时关 root 态里它还沉在线下,一次带走）。
- 收藏册：`collection.ts:351` `.collection-close` 40×40 → 44×44；`:381` `.card-btn` 36px → 44px（孩子面红线;面板布局两档实测干净别动）。
- 验收：三处 `getBoundingClientRect ≥ 44`,取反断言各一条。

### N-37 管理员开启态挤压 quiz 族关内 🔧（验收矩阵本轮扩容）

- r8 原文有效（root 抬头 ≈100px、quiz 宿主不让位;math-farm 整排线下/pinyin 首关切半）。**本轮加重档**：root 永久 + 915×412 进 pinyin-train **限时关 135**——crop 6→294,三张答案票 `pyt-ticket` 整排线下（top 608）,比首关切半重一档（root 抬头 + 计时条 + 火车画布带三层叠加）。
- 改哪照 r8（矮横屏 root 行并一行或折叠;quiz 宿主高度把 root 行算进去）。**验收矩阵扩成：4 quiz 皮肤 × root 开/关 + 深关限时档（pinyin 135 关族）**;工装按「每档隔离 context」红线执行。

> S-1 / S-2 / S-3 ✅ 已由 A 第 2 轮销账（复证数字见 r9 learn-notes 第二节），从本清单除名。

---

## 闯关学习（给 A）

### N-39 l99 蓝本地图首次进图/回地图不聚焦当前关 🔧（新,一行级 × 4 处,全部 l99 款受益,走配方 K）

- **现象**：915×412 首次进图,当前关格子整格线下：hop-pads 426–502 / red-blue-race 412–488 / poop-hero 412–488;math-farm / clock-house / word-garden / pinyin-train 408–484、tap-tiles 410–486 切半（抽 8 中 8）;1024×768 全在屏。首屏被章节页签 + 模式页签 + 图例提示吃满,孩子第一眼看不到能点的关。
- **机理**：`level99.ts:782` `showMap(focusCurrent = false)` 默认不聚焦;聚焦机制现成（`:921` `scrollIntoView({block:"center"}) + focus`）但只有直达（`:820`）与跳过（`:824/:1054`）传 true;初次进图（`:1085`）与三处「回地图」（`:978/:1009/:1038`）走默认 false。
- **改哪**：`src/games/level99.ts` 上述 4 个调用点补 `showMap(true)`（行为与直达路径完全一致,零新机制）。地图渲染、章节切换（`:851` 保持 false,切章就该看章头）、存档零触碰。
- **验收**：915×412 首次进 hop-pads / red-blue-race / poop-hero 不滚可见可点当前关;过关 → 回地图同样;切章节页签仍回章头（`:851` 别误改）;1024×768 与竖屏零回归;补一条「初次 showMap 后 `.l99-node-cur` 在视口内」断言。**验收样本用 hop-pads**（头部最高,最严)。
- **别与 N-23 补充版混账**：N-23 是 bubble-aim/candy-swing/sling-birds 三款自建地图没这机制（仍开账,B 侧）,N-39 是蓝本有机制没接线。

### N-36 word-garden 描红关矮横屏米字格出屏 🔧

- r8 原文原样有效（`tracing.ts:75` `.wgd-pad` 仍 `min(72vw,300px)` + `touch-action:none`,零提交复证）。照 r8 playbook 执行。

### L-2（续）clock-house 题面钟 / L-3（续）find-diff 贴纸补章 🔧

- r7 原文原样有效（`levels.ts:78` / `boardArt.ts` 头注零提交复证）。照 r7 playbook 执行。
- **L-1 已由 A 修掉 ✅**（shape-kingdom / find-diff 本轮浏览器复证过）,从本清单除名。

---

## 休闲对战动手（给 B）

> **第一件事：收自己的在途分支**。`cursor/casual-duo-fit-r5-b-4683` 基于 A 合入前的基线，rebase 到最新 `game-1.3` 时：
> 1. box-hamster / prince-princess / sudoku-petal / adventure-king 的 `[hidden]` 行与 A 已合入版重叠——**取 A 版（先合版）**,弃自己的重复行;
> 2. 守门测试撞车：你的 `src/games/__tests__/modebar-hidden-guard.test.ts` 与 A 已合入的 `src/games/modebarHidden.guard.test.ts` 同职能——**二合一**,保 A 版口径、把你新增的提名（sr-skins/sp-hintbox/tt-sum-bar）并进去,库里只留一份守门;
> 3. 合入后 N-1 / C-2 C-3 C-5 C-6 C-7 / N-11…N-15 N-19 / N-16 N-17 N-18 按你交卷报告销账,量化数字记进报告。

### N-25（续）fight-king 格斗塔 🔧（连续四轮最重未动）+ N-31 训练场

- r6/r7 原文原样有效（fight-king 目录零提交复证）。915×412 裁 498 / 五钮全线下。照 r7 playbook,可与 N-31 同 PR。

### N-34 拼写关 + N-35 全选关 🔧（同款一个 PR,走配方 G/J)

- r8 原文原样有效（`spell.ts` / `pickAll.ts` 零提交复证）。915×412 拼写裁 450 十一票线下 / 全选裁 179 全票线下。照 r8 playbook;验收矩阵 2 关型 × 4 视口;**限时关基线本轮四档复证干净,回归别劣化**。

### N-30 adventure-king 无尽古堡 🔧（先对账 B 在途分支）

- r7 原文有效,但 **B 的在途分支已动古堡盘宽（`b7d180d9`「古堡盘按余量收+方向盘让右翼」）**——动手前先看该分支是否已合入/覆盖到 13 控件账;已覆盖就只补验收,未覆盖再按 r7 配方 G 做。撞车取先合版。

### N-26（续）duo-vs-star 七键 / N-27（续）dot-maze 四模式 / N-29（续）bubble-aim + N-23（补充版）/ N-32（续）brave-path 🔧

- 全部零提交复证,r6/r7 原文照旧。N-23 补充版（三款自建地图 focusCurrent）与 A 侧 N-39 是姊妹账——修法口径统一（`scrollIntoView({block:"center"})`）,两边各自验收。


### N-40 duo-rush 赛道态工具条线下 🔧（给 B，走配方 L；不要重钳已在屏的画布）

- **现象**：915×412 电脑对手开跑后 `.dr-canvas` 90–385 在屏，半屏 `.dur-padbtn` ✨/📣 333–377、44×44 在屏；暂停 / 再来一局 / 换玩法 top 462 整排线下，crop 175。另三档赛道态干净。
- **机理**：工具条排在 `touch-action:none` 画布下的纵向流；核心手势可玩 ≠ 每局必点可点。与 C-8 菜单层开跑钮分账。
- **改哪**：`src/games/duo-rush/index.ts` 的 `.dr-btns` sticky 底或矮横屏双栏。`match.ts` / 赛道数学 / 存档零触碰。
- **验收**：915×412 不滚能点暂停与再来；圆钮与画布不劣于修前；390×844 / 1280×800 零回归。

### N-10 棋类三款横屏 🔧（复证仍开）

- 915×412：xiangqi 319/183；gomoku 331/216；weiqi 188/43。竖屏与 1024×768 干净。改哪照 r5 playbook。

### N-13 fruit-stack / N-14 bumper-cars 🔧（数字加重，给 B）

- fruit-stack 915×412 裁 307 / 出屏 118；390×844 已绿；1024×768 裁 252。touch-action:none。
- bumper 对战 915×412 裁 226 / 出屏 56；暂停 31px、回选关 30px 一并抬到 44。竖屏 390 干净。配方 F。

### N-41 mahjong-bloom 手牌宽 34px 🔧（给 B）

- 牌在屏（crop 56），`.mj-tile` 46×34 紧贴。min-width 44 或加缝，别把牌挤出屏。

### N-42 puff-bros 暂停 34px + 模式钮 37px 🔧（与 C-8 六键同 PR）

- 关内暂停 34×68；菜单钮高 37。C-8 方向键 crop 91 原账照 r4。

### C-8 ice-fire-forest 双垫 🔧（复证 crop 248）

- 两套操作钮 top 502+ 全线下；竖屏干净。

### r4–r5 未动项重申

- **B 在途覆盖的**（N-1、C 组、N-11…N-19、N-16…N-18，以及 `trio-r9-tester-b-65de` 声称的 N-25/31/30/26/27/32）：先 fetch 销账。
- **仍开不重抄原文的**：N-2/N-3/N-4、N-5…N-9 + N-20、N-21/N-22、C-4、C-9。
- 护栏：hop-pads/gold-hook/红蓝三款/junqi/landlord 关内 915×412、攻略抽屉两形态、组字/限时基线——见 learn-notes。

---

## 完成定义（两人共用）

1. 全部 🔧 关账或书面降级（降级写数学/物理理由,照 BL-W6-03 格式）。
2. `npm test` / `npm run build` 全绿,用例水位只增不减（进场 = **1095 文件 / 19288 用例**）;每条修复有配套测试或取反断言;**B 合入后全库只留一份 modebar 守门测试**。
3. 本轮新伤 N-39…N-42 与 N-10/N-13/N-14 刷新数字在 915×412 留档；N-40 不要把已在屏的圆钮修掉；开/关对照每档隔离 context。
4. 报告续档，撞车取先合版。

---

## r10 对账标注

并行续抽见 `trio-r10-learn-notes.md` / `trio-r10-playbook.md`。N-33…N-38 / N-30 已由测试员 A 第 9 轮合入 `game-1.3`；N-25/31/1/32/26/27/29+N-23 已由测试员 B 第 9 轮合入。**编号：** 主干 r9 补测占用 N-40 duo-rush / N-41 麻将 / N-42 puff；本会话学习员抽到的 color-fun / math-farm 竖式 / gold-hook 商店改号为 **N-43 / N-44 / N-45**，勿与 r9 的 40–42 混账。
