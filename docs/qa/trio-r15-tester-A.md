# 三人组第 15 轮 · 测试修复员 A 记录

角色：壳层 + 闯关学习。分支 `cursor/trio-r15-tester-a-c14c`。  
进场：`origin/game-1.3`（含 r15 笔记；rebase 后带上 r13 B 的 N-64…67）。  
**编号红线**：N-58≠2048；N-77≠诊所、≠N-59；N-68≠L-1 第 1 关；N-73≠沙盒。未碰 mahjong / combo-clash / shoot-range / 双人盘面 B 范围。

**禁止只交测试**：未 cherry-pick `6d0af886`（仅 n68/n73 测试）。N-68/N-73 取自 r14 A（布局源码+测试）。

preview `:4185` + puppeteer-core + Chrome，视口 **915×412**。判定看 `getBoundingClientRect` vs 412。

## 本轮落地

### N-68 find-diff 三图关下图 play 格

- 第 100 关族 `triple`：矮横屏 `tripleLandscape` 另开 `fdf-panels-triple`（参考图左、可点下图右栏吃高）。
- `rowLayout = !triple && wideShort` 保持 L-1。判定仍格子盒子；`regrow` 只放大。
- 915：`.fdf-cell-play` **250–277 / 281–308 / 312–339 在屏**（旧 471/501/531）。crop 6。
- 测试：`tripleLandscape.n68.test.ts`。

### N-73 music-stars 简谱视奏琴键

- 仅视奏壳 `mst-wrap-score` 右栏琴键。沙盒/芯片 44 未改。
- 915：哆 **283–348 在屏**（旧 404 切）。crop 0。
- 测试：`scoreKeys.n73.test.ts`。

### N-77 kitty-care 小屋相册换装 CTA

- 只挂 `.ktc-album`：卡片横条、说明隐藏，第一排「换回来」进 412。
- 915：「⭐ 换回来」**66–110 / 197–241 在屏**（旧第一排 375 切）。
- 测试：`albumLandscape.n77.test.ts`。

### C-6 推理关 121 D-pad

- r15 旧数 root×121：◀✓▶ **675**、▼ **724**。sticky 钉在自滚舞台、父级 auto 高时 `max-height:100%` 钳不住。
- 现：`as-land`；`maxHeight = vh - wrapTop - 4`；D-pad `position:absolute;bottom:0` 钉在 wrap 底。
- 915：▲ **212–256**、◀✓▶ **261–305**、▼ **310–354**、⏸ **364–408 全在屏**。判定/seed 未动。
- 测试：`deduceLand.c6.test.ts` + r11 守门去掉 sticky。

### N-37 shape-kingdom root×深关

- 只收 `.shk-round` / `.shk-quizhost`。公共 quiz 选项高未改。
- 915：三张 `.qz-choice` **321–367 在屏**（旧 453）。
- 测试：`deepRoot.n37.test.ts`。

## 未做

- N-63 保龄模式条（本工位优先 N-77/68/73/C-6）。
- N-75…N-85 属 B 或禁碰目录。

## 红线

存档 key / `meta.id` / 题库 / seed / 胜负未改。测试只增不减。禁 force。

## SHA

`318b4877`（C-6 余高钳 + D-pad 钉底）。本文件随后一笔只改文档。
