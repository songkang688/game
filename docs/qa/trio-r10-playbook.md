# 三人组第 10 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r10-learn-notes.md`（含并行学习员 N-43…N-45 + **R2 补测 §八**）。抽验时点 `game-1.3` 已含 A `39d61b50` + B `b2c07a6e`（merge `323ac8cc`）。
> **禁止重做（已在主干 ✅）**：S-1/S-2/S-3/S-4(l99)/L-1(shape 答题+find-diff)/C-1/N-28/竞技场留白/garden-guard 节点图/N-24；**N-33 sticky、N-38 永久文案、收藏册 44、N-34/N-35/N-36、N-30 古堡**；**N-25 塔、N-1 果篮、N-32 无尽战斗、N-26/C-9、N-27、N-29、N-23 地图聚焦**。动手前 `git fetch origin game-1.3` 再对账，别写第三份双栏/sticky。
> **只列仍 🔧**。A = 壳层+闯关学习；B = 休闲对战。配方 A–C r4、D–F r5、G/H r6、I/J r8、K/L r9。
> 水位进场：本学习员实测 **1109 文件 / 19330 用例** 全绿。测试只增不减。

## 通用纪律

- 不改存档 key / `meta.id`；不动题库、seed、win/lose。
- kit 已有文件只 import。宽屏 412×915 与 1280×800 零回归。禁 force。
- 开/关对照每档隔离 context 或先 `localStorage.clear()`。
- `casual-duo-fit-r5-b-4683` 若仍未合：rebase 到最新主干，`[hidden]` 与守门测试取 A 先合版、只留一份 `modebarHidden.guard.test.ts`。合入后把下列与该分支重叠的 C/N 销账，勿双修。

## 测试步骤备忘

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。主档 **915×412**。
- color-fun 关号、math-farm 竖式、gold-hook 商店路径见原 r10 笔记第一节 / 原 playbook（N-43…N-45 不改口径）。
- 坦克裁切：`.game-stage` 可能为 0，必须扫 `.tkb-root` 自滚（N-19）。

---

## 壳层（给 A）

### S-4 扩容 `.qz-jump-input` 🔧

- `quiz99.ts:153` 仍 `min-height:38px` → 44。r9-A 明确没动。管理员面；限时关 root 态里它还容易沉线下，一次带走。

### N-39 l99 蓝本地图首次进图/回地图不聚焦 🔧（配方 K）

- 主干仍 `showMap(focusCurrent = false)`；初次进图与三处「回地图」未传 true。R2 复证 hop-pads 当前关 **426–502 整格线下**。
- 改哪/验收照 r9 playbook：四处补 `showMap(true)`；切章那处保持 false。验收样本 hop-pads。

### N-33 / N-38 / 收藏册 ✅ 勿动

- R2 浏览器：结算两钮在屏、sticky 计算值为 `sticky`；永久文案正确；收藏 44px 在源码。不要重写 sticky。

---

## 闯关学习（给 A）

### N-43 color-fun 全关型矮横屏色盘/调色锅线下 🔧（配方 G/J）

- 照本文原 playbook / learn-notes 第三节。七关型 × 915×412。

### N-44 math-farm 竖式插图关答案钮线下 🔧

- 照原文。R2 另测 **root × 第 81 关**（非竖式）：三枚 `.qz-choice` top 381 切底——验收时连 root 开/关各一档，别只修竖式却把普通题切掉。

### N-37 合入后补测（不新开号）

- r9-A `:has(.l99-jump)` 已在主干。仍须 **root × pinyin-train 135** 三票在屏。clock-house L1 × root 本轮已绿。

### L-2 / L-3 🔧

- L-2 钟面、L-3 贴纸补章。照 r7。`tester-a-r7-fixes-def4` 若有 `faceLift` 先 fetch，撞车取先合版。

### N-34 / N-35 / N-36 / N-30 ✅ 勿再做第三份

---

## 休闲对战动手（给 B）

### N-46 sky-squad 关内六键切半 + 双人 36px 🔧（新，配方 G）

- **现象**：915×412 闯关 `.sks-key` top 397、h=42，底边出屏；暂停 33px。双人同屏键 **36×36**。r5「HUD 换行干净」不管键排。
- **改哪**：`src/games/sky-squad/index.ts` 矮横屏键排贴底或再让画布；`min-width/min-height:44`。飞行判定/合流波零触碰。
- **验收**：闯关+双人同屏 915×412 六键不滚可点且 ≥44；390×844 / 1280×800 零回归。

### N-47 模式菜单芯片热区 <44 🔧（新，开关态）

- bowling 菜单 34px / 王子公主模式钮 37px / 坦克模式条 38px。只改菜单层 `min-height:44`，关内判定不动。
- 验收：三款菜单 915×412 芯片 getBoundingClientRect ≥44；进关后模式条仍 `[hidden]`。

### N-45 gold-hook 关内商店 veil 🔧（配方 I）

- 照原 r10 playbook。进关点🛒，钉「接着挖」。

### N-10 棋类三款横屏 🔧（复证仍开，不换号）

- 915×412：xiangqi 裁 437 / 出屏 245 / 钮 top 687；gomoku 331/216；weiqi-garden 188/43。照 r5。

### N-40 duo-rush 赛道工具条线下 🔧（配方 L）

- 暂停/再来/换玩法 top 462，crop 175，画布在屏。sticky 底或双栏，勿重钳画布。

### N-31 训练场 🔧（B 已合源码，915 未绿）

- 假人三钮 top 447、开打 531、高 38px。补 915×412 真机，不要再发明第二套壳。

### 配方 F / C-8 旧号仍开（合入 casual-duo 分支后先对账再改）

- **N-11** bowling 关内四钮 top 587 / 裁 237；暂停 34px 一并抬到 44。
- **N-15** bomb-buddies **双人**六键 top 498–600（必须 915 对战/合作态）。
- **N-19** tank-battle D-pad 503–552；暂停 32→44。量 `.tkb-root`。
- **N-22** combo-clash 轻/重/必杀 top 451 / 裁 131。
- **C-8** snow-fight 闯关+双人键排线下；shoot-range 键 560+ canvas 出屏 90；hue-hand 三钮 416 / 裁 335；ice-fire-forest / puff-bros 菜单热区走 N-42+C-8 原文。
- **N-13 fruit-stack / N-14 bumper-cars / N-16 走廊 / N-17 王子关内 / N-41 麻将牌宽 / N-42 puff 暂停 34**：r9 数字仍有效，本轮未换号重测麻将/puff。
- **N-2/N-3/N-4、N-5…N-9+N-20、N-21、C-2…C-7、C-4**：r4/r5 原文；B 在途覆盖的合入后销。

### N-25 / N-1 / N-26 / N-27 / N-29 / N-23 / N-32 ✅ 勿重写

---

## 完成定义（两人共用）

1. 上表 🔧 关账或书面降级（BL-W6-03 格式）。已 ✅ 项零重做。
2. `npm test` / `npm run build` 全绿，水位 ≥ **1109 / 19330**；每条修复有小测试。全库一份 modebar 守门。
3. 新伤 N-46/N-47 与 N-10/N-40/N-15/N-19 在 915×412 留数字；N-43…N-45 按原矩阵。
4. 撞车取先合版。报告写清 fetch 后的 `game-1.3` SHA。
