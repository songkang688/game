# 三人组第 12 轮 · 学习优化员抽验笔记（本轮只学习、只记录，零代码改动）

> 基线：`origin/game-1.3 = f10ad799`（含 r9–r11 A/B 大包 + `6a73fc2b` 编号统一）。工作树 `/tmp/trio-r12-learner-c`，**`src/**` 一行未动**。
> 分支：`cursor/trio-r12-learner-c14c`。工装：`/usr/local/bin/google-chrome` + puppeteer-core；脚本 `/tmp/trio-r12-audit.mjs` `/tmp/trio-r12-audit2.mjs`，截图 `/tmp/r12-shots/`、JSON `/tmp/trio-r12-audit.json` **不进库**。主档 **915×412**。每案独立 `browser.createBrowserContext()`。密码 `kangkang`。root 加重档：`yiduo-yixing.root.v1 = {mode:"permanent",expiresAt:9999-01-01}`，只在同源 `#/game/...` 页写入。
> **编号红线**：N-39 地图聚焦；N-40 赛道；N-41 麻将；N-42 **只=puff 热区**；N-43 color-fun；N-44 竖式；N-45 金钩商店；N-46 sky 六键；N-47 菜单芯片；N-48 **收藏册 overlay 跨路由**；N-49 数独对战；N-50 block-drop；N-52…N-57 双人包；N-58 暂停套跳关门。空号 **N-51 勿回收**。新伤从 **N-59** 续——**本轮未立新号**。
> 抓手（换面）：失败结算、1.3 窗口新画风操作排、横屏+root 深关未覆盖者。不重测 hop-pads/gold-hook 关内旧账、红蓝同屏、攻略 sheet。

## 一、抽验方式

- `npm run build && npx vite preview --host 127.0.0.1 --port 4182`（不占用工作区 :4173）。
- 量法同 r4–r11：`.game-stage` 裁切；`rect.top ≥ 412` 为折叠线下；canvas `bottom−412`；弹窗套娃数 `.dialog--pause` + `.dialog--gate`；热区 h<44。
- 进关必须点 **`.l99-continue`**（文案「继续 第N关」用正则「继续」容易漏点，第一遍若干案停在地图，第二遍已纠正）。

## 二、对账：主干已合 vs 在途（先合版，勿第三份）

对照 `f10ad799` 的 `src` + 本轮 915×412。已 ✅ 禁止重做。r12 A 在修壳层剩余；r12 B 在修 N-52…N-57——playbook 标 **在途**，勿派第三份同文件。

### 壳 / 学习（多属 A）

| # | 状态 | 证据 |
| --- | --- | --- |
| S-1 / S-2 / S-3 / S-4（`.l99-jump-input` 44） | ✅ | 源码 + 本轮 clock/pinyin root 关内框 **44×** |
| S-4 `.qz-jump-input` 38→44 | ✅ 框 / 🔧 钮 | `quiz99.ts:153` 已 `min-height:44px`，`quiz99.s4.test.ts` 钉死。本轮 clock-house / pinyin-train **root 关内** `.qz-jump-input` **h=44**；**`.qz-jump-go`「🎫 直达这题」仍 h=32**（padding 8px、无 min-height）。r11 已把 32 并进 S-4，**不换号** |
| N-24 / N-33 / N-38 / 收藏册 44 / N-37 抬头 | ✅ | N-37 本轮 **root×拼音续关**：crop **6**、三票 top **352–400 全在屏**（r9 加重档 608 已消）。find-diff 80+root crop **6** |
| N-34 / N-35 / N-36 / N-30 古堡 | ✅ | 勿重写 |
| L-1 shape+find-diff 答题 / L-2 faceLift / L-3 贴纸 4–10 章 | ✅ | `boardArt.ts` 头注已写第 4–10 章补齐；勿再改 clockSVG |
| N-39 `showMap(true)` | ✅ | 初次+回地图已接线（`level99.ts` `:1130/:1015/:1046/:1075`；切章 `:884` 仍 `showMap()`）。本轮 hop-pads 首图 `.l99-node-cur` **200–279 在屏**（旧账 426–502 **已消**） |
| N-43 color-fun | ✅ | r11 `b9a3aa8b` / `16e55f2a`。本轮 L1 色盘 top **240** 在屏；166+root 撤销/色盘 **178–309 在屏**（`.clf-scrolly` 不再把锅卷没）。勿第三份双栏 |
| N-44 math-farm 竖式 | ✅ | r11 已扩 `.mtf-vert` 选择器。本轮未再抽竖式关 |
| N-16 走廊 `.ak-pad` sticky | ✅ | `corridorFit.test.ts` + `index.ts:128` |
| **N-48** 收藏册 overlay 跨路由 | ❌ | `src/ui/collection.ts` **无 `hashchange`**。本轮：首页 🎁 打开 overlay=1；`hash=#/game/clock-house` 后舞台已 mount，**overlay 仍=1**。热区 44 是另一账。S-3 只修了家长门。**绝不用 N-42** |
| **N-58** 暂停套跳关门 | ❌ | 关内点壳层 ⏸ 后再 DOM 点「跳过」：`.dialog--pause` 与 `.dialog--gate` **同时存在**。暂停五钮 108–376 在屏；门「确认/不同意」276–376 在屏。`gameShell` 用 `pauseDialog` 挡第二层暂停，**gate 不是 pause**。Esc/焦点陷阱套娃 |

### 休闲对战动手（多属 B）

| # | 状态 | 证据 |
| --- | --- | --- |
| N-25 / N-31 关内 / N-1 / N-32 / N-26 / N-27 / N-29 / N-23 | ✅ | r9-B 批次。candy-swing 本轮关内 canvas 底 **672 出屏 260** → 仍挂 **N-29**，不换号 |
| N-40 `.dr-btns` sticky / N-41 `.mj-tile` 44 / N-42 puff `TOUCH_MIN` | ✅ | r10-B `d8697ac3`。N-42 **永远是 puff**，不是收藏册 |
| N-45 金钩商店 footer | ✅ | r11-B `0f47addc` `.gdh-shopfoot`。本轮 `.l99-continue` 未打进矿洞（该款模式选单≠蓝本继续），**不重开号**；r13 若复测走「闯关→进关→🛒」 |
| N-2/3/4 配方 E | ✅ | r10-B |
| N-10 象棋工具行 | ✅ 补 | r11-B sticky；其它棋类若仍裁切挂旧 N-10 原文 |
| **N-46** sky-squad 六键/开关 | ❌ | 本轮闯关：`.sks-key` **42×42** top 330 在屏但 <44；暂停 **33**、判定点/手指上方 **31**；`--k:42` / 双人 `--k:36` 源码仍在。r12 B **未声称修此号** |
| **N-47** 模式菜单芯片 | ❌ | bowling 菜单双人/人机/无尽 **h=34**、AI 三档 **h=32**（top 负值=菜单在舞台上方裁切区，热区仍短）；prince 三人模式钮 **h=37**。tank 菜单容器已有 44 地板，以真机为准 |
| **N-49** 数独对战竞速 | ❌ | 「🤝 对战竞速」crop **1046**，数字键从 top **475** 起整排线下（本轮 belowCount **93**）。C-1 藏条 ≠ 玩法态 |
| **N-50** block-drop 七键 | 🔶 复测 | r10 曾 **top 419**。本轮 **闯关 `.l99-continue` 进关**：七键 ◀▶↻↺▼⤓📦 **top 310–356 全在屏**、h=46；stage 仍 crop **159**。可能只绿了战役壳。r13 **必须再量模式选单进关**；未复绿勿销号 |
| **N-52…N-57** | 🔧 **r12 B 在途** | 本轮复证 N-52：菜单 **「开擂 ▶」sticky 后 top 344 在屏**（`max-height:500px` 已有 sticky），**「怎么玩」仍 top 471 线下**；开打后下半场 ▲▼◀▶ 419–494、暂停/规则/退出 **549** 全线下，crop 232。与 r11 对局账一致。N-53…57 **本轮不再量**，避免与 r12 B 撞车 |
| N-15 / N-11 / N-17 / N-19 / N-22 / C-2…C-8 | 仍开或观察 | 本轮 snake-snack 方向键 top **707+** = **C-3**；lianliankan 底排格 446+ = **N-6 族**；bubble-pop 泡 436+ = **N-7 族**。勿新开号 |
| `casual-duo-fit-r5-b-4683` | 仍在途 | `[hidden]` 与守门只留 `modebarHidden.guard.test.ts` |

## 三、新抽验结论（915×412）

**干净、本轮结案（下轮不要再量这一态）：**

- **失败结算（fruit-catch 闯关）**：约 22s 后出 `.l99-overlay`，「🔁 再试本关 / 🗺️ 回地图」**并排 top 239 h=48 全在屏**（比 r10 的 360–408 更松，N-33 sticky 仍绿）。quiz 点错（clock-house）仍不弹层、选项 top 307 在屏——配方 I 补笔有效，不为失败结算新开号。
- **N-39 hop-pads 首图**：当前关 **200–279**。
- **N-37 × pinyin 续关 + root**：crop 6、票在屏。
- **find-diff 第 81 关族 + root**：crop 6。
- **color-fun L1 / 166+root 操作排**：色盘在屏（N-43 复证关账）。
- **tap-tiles 闯关**：crop 66、折叠 0、canvas 出屏 0（r6 观察级，不立项）。
- **ocean-munch 进关**：crop 0、canvas 出屏 0。
- **clock-house root**：题面+三选项+管理员直达框在屏；只有 `.qz-jump-go` 32px。

**仍开（旧号，本轮数字）：** 见第二节 ❌ / 🔶。N-48 / N-58 / N-49 / N-46 / N-47 / N-52 对局半场 **数字与 r10/r11 同构或更准**。

**本轮未立 N-59。** 新画风操作排能归旧号的全部归旧号（candy-swing→N-29，snake-snack→C-3）。若 r13 把 `.qz-jump-go` 32 从 S-4 拆开，**下一个空号才是 N-59**，不要占用 N-42/N-51。

**工位污染警告（给 r12 A/B 看，不是本笔记改 src）：** 并行工作区曾出现 `src/ui/collection.n58.test.ts`（把 **N-48 收藏册**写成 N-58）。**N-58 只=暂停套跳关门**。合入时若测试文件叫 n58 却断言 hashchange，必须改名/改号，否则编号红线再撞。

## 四、系统性模式提炼（不新开字母）

r4 A–C、r5 D–F、r6 G/H、r8 I/J、r9 K/L 仍有效。

### 配方 I 补笔 · 套娃门

- 「一层弹窗」验收不能只数暂停：`requestSkip` → `requestParentAuth` → `.dialog--gate` 不走 `pauseDialog` 哨兵。修 N-58：开 gate 前先 `pauseDialog.close()`，或 `showDialog` 全局互斥。对照 S-3 / 目标中的 N-48：都是「第二层 UI 不知道第一层还在」。

### 配方 L 补笔 · sticky 只救 CTA

- duo-arena `.dua-start{position:sticky;bottom:0}` 已把「开擂」钉进 412，**「怎么玩」仍 471**。验收必须列菜单 **每一个** 必点链，不能只报开打钮绿了。对局下半场仍是第二套垫，sticky 菜单救不了。

### 配方 H 补笔 · 战役进关 ≠ 模式选单进关

- block-drop 本轮战役七键在屏、r10 模式进关曾 419。销 N-50 必须两态都量。gold-hook 商店同理：没有 `.l99-continue` 的款要用自己的闯关 CTA。

## 五、skills 增量

| skill | 本轮 | 落点 |
| --- | --- | --- |
| `frontend-design` | overlay/dialog 绑路由或互斥：收藏册学 S-3 `hashchange→close`；暂停学「已有 dialog 则拒绝第二门」 | N-48 / N-58 |
| `theme-factory` | 输入框抬到 44 后，旁边那颗「直达」按钮若只靠 padding 会停在 32。几何地板要写在 **整行** | S-4 收尾 |
| `frontend-design` | 菜单芯片 34/37px 与关内键 42px 是两层；N-47 只改菜单，N-46 只改键排，不要互相当结案 | N-46 / N-47 |
| `canvas-design` | candy-swing 关内画布仍掉出 412，与 N-29 发射台同句 | N-29 |

## 六、已收口（下一轮不要重复做）

1. 第二节所有 ✅（含 N-39 首图、N-43 色盘复证、S-4 **输入框**、N-37×拼音、N-16、L-2/L-3、N-40/41/42/45 源码）。
2. fruit-catch 失败 overlay 两钮在屏；clock 点错不弹层。
3. tap-tiles / ocean-munch 本态；hop-pads 地图当前关。
4. 不要把 r12 B 未合入的 duo-arena 对局修补当成主干已绿（菜单开擂 sticky 已在主干，对局下半场没有）。
5. 不要把 `casual-duo-fit-r5-b-4683` 当主干。

## 七、给 r13 A/B 的优先级（与 playbook 一致）

1. **先 fetch `game-1.3` + r12 A/B 分支**：N-48/N-58/S-4-go 若 A 已合则销；N-52…57 若 B 已合则销，禁止第三份。
2. A：**N-48** hashchange；**N-58** 弹窗互斥；**S-4 收尾** `.qz-jump-go` 32→44（框已 44 勿再改 38）。
3. B：**N-49** 数独对战；**N-46 / N-47**；**N-50** 两态复测；r12 B 未完成的 **N-52 对局半场 / N-53…57**。
4. 旧号顺手：N-15 915 对战、C-3 snake-snack、N-29 candy-swing 关内画布。
5. 新号从 **N-59** 起，避开 N-42 与 N-51。
