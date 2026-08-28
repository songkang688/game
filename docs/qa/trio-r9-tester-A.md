# 三人组 R1 / trio-r9 · 测试修复员 A 记录

基线:进场 `origin/game-1.3` 先为 **a74e4868**,中途 rebase 到 **4b3a4cab**(r9 学习笔记与父监督 15min 对账,docs only)。
分支:`cursor/trio-r9-tester-a-65de`,目标合入 `game-1.3`。
角色:壳层 + 闯关学习。B 独占目录(`fight-king` / `fruit-catch` / `duo-vs-star` / `dot-maze` / `adventure-king` / `brave-path` / `bubble-aim` / `candy-swing` / `sling-birds`)零触碰。

## 水位

- 进场 `npm test`(基线 a74e4868,改代码前): **1095 文件 / 19288 用例**,其中 3 条既有超时红(xiangqi 两步杀 / snake-snack 无尽 / bomb-buddies AI,均 5000ms,非本范围)。与 A2 交卷登记 1095/19288 一致。
- 交卷:新增 5 个测试文件 + quiz99 既有文件加 1 条;用例只增不减。`npm run build` 见收尾。

## 已销账(进场 git log 复核,禁止重做)

`6a9f42d0` / `d451c32d`:S-1 首页、S-2 星级 SVG、S-3 parentAuth hashchange、S-4 `.l99-jump-input` 44px、L-1 quiz 矮屏+find-diff 并排、C-1 四款 hidden、orb-arena/snake-royale 留白、garden-guard 节点图。本轮未重做。

## 修了什么

### N-33 结算弹窗矮横屏按钮贴底 ✅

- **坏在哪**:`.dialog{max-height:86dvh/92dvh;overflow-y:auto}`,结算内容(吉祥物+标题+星+文案+按钮)高于可视段,「🔁 再玩一次 / 🏠 回首页」top 落在弹窗底边以下。
- **改法**:`src/styles.css` `.dialog-buttons` 加 `position:sticky;bottom:0`、不透明 `#ffffff` 底、上缘白影。`dialogs.ts` 按钮语义 / `isGuardedClick` / 焦点陷阱零触碰。
- 测试:`src/ui/dialogButtonsSticky.test.ts`。

### N-38 永久态直达小字 ✅

- **坏在哪**:`rootJumpNote` 无永久分支,`rootRemainMinutes` 把远未来戳算成上亿分钟。
- **改法**:永久会话走 `ROOT_PERMANENT_NOTE`("管理员权限已永久开启");限时仍报「还剩 N 分钟」。纯展示。
- 测试:`src/games/level99.adminCompact.test.ts`。

### N-37 root 抬头挤压 quiz 族 ✅

- **坏在哪**:root 开着关内多「跳过(管理员)」+「直达」两行 ≈100px,915×412 答案钮下线。
- **改法**:仅当 `rootJumpVisible()` 时把跳过+直达收进 `.l99-admin-row`;矮屏 `max-height:500px` nowrap,小字折进 input title / sr-only。root 关不生成该行,跳过仍直挂 tools,布局与修前一致。判定零触碰。
- 测试:同上 adminCompact。

### 收藏册热区 + S-4 扩容 `.qz-jump-input` ✅

- `.collection-close` 40→44,`.card-btn` min-height 36→44;`.qz-jump-input` 38→44。
- 测试:`collectionHotspot.test.ts`、`quiz99.test.ts` 追加。

### N-36 word-garden 描红 pad 高度尺 ✅

- **坏在哪**:`.wgd-pad{width:min(72vw,300px)}` 只按宽,915×412 格子底出屏 38px,且 `touch-action:none` 不能滚着描。
- **改法**:导出 `clampTracePadPx`;运行时量裁切余量减花园/提示后写入 `--wgd-pad-room`。余量 < 240 保底走滚动。笔顺/容差零触碰。
- 测试:`tracePadClamp.test.ts`。验收进度路:`localStorage.setItem("yiduo-yixing.l99.word-garden", JSON.stringify(Array(101).fill(1)))`(第 102 关)。

### N-34 + N-35 pinyin-train 拼写 / 全选 ✅

- 矮横屏(`max-height:500px`)双栏:火车画布左、车厢槽/票/开车钮右;共享 `.pyt-scene` 高 132→72。`judgePickAll` / `spell()` 判定零触碰。限时关(135)仍走 quiz 壳(L-1 已销)+画布缩高。
- 测试:`shortLandscapeFit.test.ts`。深关进度:`Array(100).fill(1)` 拼写、`Array(102).fill(1)` 全选。

### N-39 蓝本地图首次进图不聚焦当前关 ✅(r9 playbook 一行级)

- 初次 `showMap()`、过关/失败「回地图」、关内「选关」改为 `showMap(true)`。切章节页签仍 `showMap()`(看章头)。

## 余力未做 / 降级

- **L-2 clock-house**:`clockSVG` 被 `LEGACY_DIGEST` SHA 钉死,不能改函数体。库里已有 `faceLift.ts` + `runner.ts` `mountFaceLift` 消费端换装(胖橙时针/细青分针/hub),本轮不重做 clockSVG。
- **L-3 find-diff 贴纸 4–10 章**:stickers 扩容工作量大,本轮优先高伤交互面,未扩图集。
- **N-37 加重档(root × pinyin 限时 135)**:画布缩高 + root 行合并应减轻;未做独立 quiz 宿主再钳一刀。若仍挤票,下一轮在 pinyin quiz 宿主上把计时条算进 room。

## 撞车明细

- 工作区曾被并行 learner / tester-B checkout 冲掉未提交改动一次;以 `/tmp` 暂存后回到本分支提交 `9bce387d`。
- rebase 时 `game-1.3` 只进了 r9 docs(`0845a060`/`3c9902cb`/`4b3a4cab`),无 `src/**` 撞车。B 独占目录本轮零 diff。
- 未改存档 key、`levels.ts`、kit 已有文件。

## 方法

视口:360×640 / 390×844 / 412×915 / **915×412** / 1024×768;对照 1280×800。管理员密码 `kangkang`。
