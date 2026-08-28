# 三人组第 10 轮 · 测试修复员 A 记录

基线:进场 `origin/game-1.3`（已含 r9-A：N-33/36/37/38/34/35/30 + 收藏册热区）。
分支:`cursor/trio-r10-tester-a-7779`，目标合入 `game-1.3`。
执行依据:用户本轮派单优先于 `trio-r10-playbook.md`（那份把 N-40/41 写成 A，**本轮 A 不接**，交给 B）。r9 已合入项 **零重做**。休闲对战动手目录未提交。

水位:进场主干约 1095+/19288+。本轮只增测试（`level99.n39` / `quiz99.s4` / `corridorFit` + faceLift 真机序列化 + boardArt 十章 + stickers 查不到改 🤷）。交卷 `npm test` = **1112 文件 / 19339 用例全绿**；`npm run build` 全绿。代码提交 `928aa663` 已由 `406ca902` 合入 `game-1.3`；本分支 rebase 后只补本记录。

## 修了什么

### N-39 l99 蓝本地图首次进图/回地图聚焦 ✅（配方 K）

- **坏在哪**:`showMap(focusCurrent = false)` 只在直达/跳过传 true；初次进图与三处「回地图」默认 false。915×412 hop-pads 当前关 426–502 整格线下。
- **怎么修**:初次 `showMap(true)`；过关/失败 overlay「回地图」、关内「选关」三处同样 true。切章 `viewChapter = ci; showMap();` **保持 false**。聚焦仍是 `.l99-node-cur` + `scrollIntoView({block:"center"})`。
- **测试桩**:无 `HTMLElement` 的用例（如 xiangqi smoke）不能 `instanceof HTMLElement`——有全局才 instanceof，否则鸭子调用。
- **测试**:`src/games/level99.n39.test.ts`（四路径 true / 切章 false / 视口尺子：426–502 在 412 高为假，居中格为真）。

### S-4 扩容 `.qz-jump-input` 38→44 ✅

- 管理员面。`quiz99.ts` `min-height:44px`。`quiz99.s4.test.ts` 取反 38。

### N-16 adventure-king 走廊引擎三态 ✅（勿混 N-30）

- **坏在哪**:`clamp(cssW×0.9, 250, 430)` 在 915 宽给出 430，键排整排线下。闯关 / 无尽遗迹 / 计时速通共用 `createRunner`。
- **怎么修**:抽出 `corridorWantH` / `corridorCanvasCssH` / `measureClipRoomPx`（量不到裁切祖先则原样 want）。矮横屏 `.ak-pad` sticky、收 `.ak-tip`。古堡仍只 `advk-shell`，走廊不挂。
- **测试**:`corridorFit.test.ts`：915 宽 want=430，room 300 / below 108 → 188；`createRunner` 接线；古堡类名未混。

### N-37 加重档（root × pinyin-train 限时 135）✅ 收紧一档

- r9 `:has(.l99-jump)` 抬头仍在。本轮加：`.l99-stage-wrap:has(.l99-jump) .tm-bar` 再收、`.pyt-scene` 72→**44**；`timed.ts` 矮屏条本身也收。无 root 无 `.l99-jump`，72px 基线不动。
- **测试**:`level99.r9.test.ts` 补两条 CSS 钉子。浏览器 915×412 三票数字交卷时若环境被切走则书面：规则按余量让票，判定/题库零触碰。

### L-2 clock-house 钟面 ✅（真机 `</line>`）

- `clockSVG` 仍被 LEGACY_DIGEST 钉死，继续 faceLift。本轮让 `liftFaceBody` 吃属性乱序 + `></line>` / `></circle>`。`levels.ts` 角度/`data-h`/`data-q` 零触碰。
- **测试**:faceLift 新增真机序列化例。

### L-3 find-diff 第 4–10 章贴纸 ✅

- `stickers.ts` 扩容（kit 例外）+ `boardArt.ts` 只改头注。门控逻辑、`levels.ts` SHA 零触碰。`READY_THEMES` 扩到十章。查不到用例从 🚀 改为 🤷（火箭已入图集）。

## 跳过 / 未关

| 编号 | 状态 |
|------|------|
| N-33/36/37 抬头/38/34/35/30/收藏册 | r9 已合入，**禁止重做** |
| N-40/41/42 | 用户点名 **B**，本分支未动 duo-rush / math-farm 竖式 / gold-hook 商店 |
| 休闲对战动手目录 | 未提交（B 在修） |
| N-16 浏览器 915 六键 top | 纯函数 + CSS 守门；无头 Chrome 复证若被并行切分支则未留截图 |

## 红线

- 存档 key、题库、判定未改。
- 测试只增不减。
- 禁 force。视口主档 915×412。管理员 `kangkang`。
