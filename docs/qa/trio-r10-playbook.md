# 三人组第 10 轮 · 测试修复员 A/B 任务清单（playbook）

> 依据：`trio-r10-learn-notes.md`（基线 `game-1.3 = 4b3a4cab`）。
> **先读**：r9 笔记已合入。S-1/S-2/S-3/S-4(l99)/C-1/N-28/竞技场留白/garden-guard/find-diff+shape 答题 L-1 **不要重做**。
> **在途先收再开新坑**（未合入不算销账）：
> - A：`cursor/trio-r9-tester-a-7779` = N-33/34/35/36/37/38/30/收藏册 44px；`cursor/tester-a-r7-fixes-def4` = N-27/N-32/L-2（与 r9-A **双改 N-30，取先合版**）。
> - B：`cursor/casual-duo-fit-r5-b-4683` = N-1/C 组/N-2…/配方 F/N-16…18；守门测试必须并进 `modebarHidden.guard.test.ts`。
> **只列仍未落地的 🔧**。已合入的不抄。新伤 **N-40…N-42**。A = 壳层+闯关学习，B = 休闲对战动手。
> 配方 A–C r4、D–F r5、G/H r6、I/J r8、K r9；本轮只补 J/I/H 笔，不新开字母。

## 通用纪律

- 不改存档 key：`yiduo-yixing.l99.<id>` / skip / `yiduo-yixing.root.v1` / 钱包 / `meta.id`。
- 不动题库/判定/seed。kit 已有文件只 import。
- 测试只增不减。进场记 `npm test`（主干水位约 1095/19288；偶发 2 红超时/五子棋随机，**不要为变绿改那些用例**）。
- 宽屏 412×915 / 1280×800 零回归。禁 force。
- 开/关对照每档隔离 incognito 或先 `localStorage.clear()`（r9 工装红线）。

## 测试步骤备忘

- `npm run build && npx vite preview --port 4173`；puppeteer-core + `/usr/local/bin/google-chrome`。
- 主档 915×412。color-fun 关号（0-index 进度格数 = 关号）：mix 34、number 51、memory 84、shade 99、rule 121、legend 143、limited 166。math-farm 竖式用第 100 关族。shape 作图 = 第 102 关族。gold-hook 商店：**先点闯关矿洞 → 进关 → 🛒**，模式选单上没有商店。

---

## 壳层（给 A）

### 在途批次合入后只需复测、不要重写（除非主干仍无 sticky）

- **N-33** 结算 `.dialog-buttons` sticky（配方 I）。r9-A 声称已做；**对 `origin/game-1.3` 的 `styles.css` 仍无 sticky**。先 rebase 那条分支，没有再按 r8/r9 playbook 做。正面样板 = 攻略 drawer footer。
- **N-38** `rootJumpNote` 永久文案。同上，主干 `level99.ts:469` 仍无永久分支。
- **收藏册 40/36px**：主干仍是 40/36；r9-A 声称改 44。合入则销账。
- **S-4 扩容 `.qz-jump-input`**：主干 `quiz99.ts:153` 仍 38px，**r9-A 明确没动** → 本轮仍要做。min-height 38→44，管理员面。

### N-39 l99 蓝本地图首次进图/回地图不聚焦 🔧（r9 新号，主干+ r9-A 都没动）

- 照 `trio-r9-playbook.md` 原文：`showMap(true)` 四处（初次进图 + 三处回地图），切章那处保持 false。验收样本 hop-pads。配方 K。

### N-37 合入后补测 🔧

- r9-A 用 `:has(.l99-jump)` 收抬头。合入后按 r9 加重档验收：**root × pinyin-train 第 135 关** 三票须在 915×412 不滚可点。未覆盖就补，别新开号。

---

## 闯关学习（给 A）

### N-40 color-fun 全关型矮横屏色盘/调色锅线下 🔧（配方 G/J）

- **现象**：915×412 七关型交互件全线下（limited 最重：10 控 top 508–655，wrap 自滚 352）。画布在屏，撤销/重做/色票/调色锅都不滚点不到。
- **改哪**：`src/games/color-fun/index.ts`（皮肤 CSS）。矮横屏：画布钳高 **或** 双栏（画布左、色盘+锅右 sticky）；`.clf-scrolly` 不要把操作排卷进去。判定/线稿/混色表零触碰。
- **验收矩阵**：7 关型 × 915×412；memory/limited 再跑 390×844 / 412×915 / 1024×768。第 1 关 guide 回归。补布局断言（色盘 top < 视口高）。

### N-41 math-farm 竖式插图关答案钮线下 🔧（扩 L-1 紧凑档）

- **现象**：不开 root、第 100 关族 915×412：竖式题看得见，三枚 `.qz-choice` top 481 整排线下；第 1 关同视口全绿。
- **改哪**：`math-farm/illustrate.ts` 或 runner 插图宿主矮屏 `max-height`；**或** `quiz99.ts` 紧凑档选择器从 `.qz-prompt svg` 扩到农场插图根节点。题目数据/对错零触碰。
- **验收**：有 `kind:vertical` 的关 915×412 三钮不滚可点；第 1 关数字不劣化；root 开关各一档（N-37 合入后）。

### N-36 / N-34 / N-35 / N-30

- 主干未动。优先合入 r9-A；冲突时与 `tester-a-r7` 的古堡补丁 **取先合版再补验收**，不要第三份双栏。

### L-2 / L-3

- L-2：`tester-a-r7` 在途有 `faceLift` 序列化补丁（真机 `</line>`）；合入后真机复验第 1 关针。L-3 贴纸仍开，照 r7。

---

## 休闲对战动手（给 B）

### 第一件事：rebase `casual-duo-fit-r5-b-4683` 到最新 game-1.3

- `[hidden]` 与 A 已合入行撞车 → 弃自己的重复行。
- 守门测试两文件 → 只留 `src/games/modebarHidden.guard.test.ts`。

### N-42 gold-hook 关内商店 veil 必点钮线下 🔧（配方 I）

- **现象**：915×412 进关点🛒：veil 内滚 230，「接着挖 ▶」top 513 整钮线下，第三件 buy 钮 top 416 线下；底栏 HUD 压住下沿。
- **改哪**：`src/games/gold-hook/style.ts`（`.gdh-veil`）+ `index.ts` 结构。把「接着挖」钉在 veil footer（sticky + 不透明底），货架 `.gdh-shoplist` 单独 overflow；`padding-bottom` 让出 HUD 高。买卖逻辑、关内金币、`SHOP` 表零触碰。
- **验收**：915×412 不滚能点「接着挖」与至少首屏买钮；390×844 / 1280×800 零回归；暂停 veil 不劣化。

### 仍开且在途未声明覆盖的（合入 B 后再对账删）

- **N-25** fight-king 塔、**N-31** 训练场触屏键。
- **N-15** bomb-buddies：本轮确认 **390×844 双人干净、915×412 对战六键全线下**。B 若只钳了闯关 canvas，补 **对战态 × 915**。
- **N-26 / N-29 / N-23**（自建地图 focusCurrent，与 N-39 姊妹、文件不同家）。
- C-8 菜单组、N-2/3/4：以 B 分支提交说明为准，合入后销。

---

## 完成定义

1. 在途分支合入或书面记录「未合 / 冲突取谁」。
2. `npm test` / `npm run build` 水位只增不减；全库一份 modebar 守门。
3. N-40 七关型、N-41 竖式关、N-42 商店 915×412 留数字；N-37×限时 135 若 A 已合则复测。
4. 报告对账 r9/r10 编号；撞车先合版。
