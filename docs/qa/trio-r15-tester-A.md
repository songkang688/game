# 三人组第 15 轮 · 测试修复员 A 记录

角色：壳层 + 闯关学习。分支 `cursor/trio-r15-tester-a-c14c`。  
进场：`origin/game-1.3`（含 r15 笔记 `9176155d` 一带；rebase 后带上 r13 B 的 N-64…67 文档/源码）。  
**编号红线**：N-58≠2048；N-77≠诊所、≠N-59；N-68≠L-1 第 1 关；N-73≠沙盒。未碰 mahjong / combo-clash / shoot-range / 双人盘面 B 范围。

**禁止只交测试**：未 cherry-pick `cursor/trio-r14-tester-b-c14c` 的 `6d0af886`（仅 n68/n73 测试）。N-68/N-73 取自 r14 A `aa9ac7b6`（布局源码+测试）。

## 本轮落地

### N-68 find-diff 三图关下图 play 格

- 第 100 关族 `triple`：矮横屏 `tripleLandscape` 另开 `fdf-panels-triple`（参考图左组、可点下图右栏吃高）。
- `rowLayout = !triple && wideShort` 保持 L-1。判定仍 `getBoundingClientRect`；`regrowCellPx(..., true)` 只放大。
- 测试：`tripleLandscape.n68.test.ts`。

### N-73 music-stars 简谱视奏琴键

- 仅视奏壳 `mst-wrap-score` 在 915×412 走右栏琴键。沙盒/跟弹/芯片 `min-height:44` 未改。
- 测试：`scoreKeys.n73.test.ts`。

### N-77 kitty-care 小屋相册换装 CTA

- `@media (max-height:500px) and (min-width:600px)` 只挂 `.ktc-album`：卡片横条、缩略图 44 高、说明隐藏，第一屏露出「换回来」。
- 诊所 `.ktc-nook` / 收藏 overlay 未动。兑换钮仍 44。
- 测试：`albumLandscape.n77.test.ts`。

### C-6 推理关 121 D-pad

- r15 数字（root×121：◀✓▶ **675**、▼ **724**）是双栏 sticky 钉在自滚 `.game-stage` 里。
- 矮横屏：`.game-stage:has(.as-wrap){overflow-y:hidden}`；JS 挂 `as-land` 右栏 D-pad `align-self:end`；画布钳 `vh-148` 给 root 抬头。
- `isDeduceLevel` / seed / 判定零触碰。测试：补 `deduceLand.c6.test.ts`，更新 r11 守门（去掉 sticky 断言）。

### N-37 shape-kingdom root×深关

- 只收本款 `.shk-round` / `.shk-quizhost`（提示条与题面限高）。公共 `quiz99` 选项 64/46 未改。
- 测试：`deepRoot.n37.test.ts`。clock/成语/偏旁/多音未扩打。

## 未做 / 留给 B 或书面降级

- N-63 保龄模式条（playbook 壳层，本工位优先 N-77/68/73）。
- N-75…N-85、N-69…74 属 B 或禁碰目录。

## 红线

- 存档 key / `meta.id` / 题库 / seed / 胜负未改。
- 测试只增不减。禁 force。视口主档 915×412。管理员 `kangkang`。
- preview 约定 `:4185`。无头 Chrome 进关数字见交卷 SHA 当时环境；源码钉子为硬验收。

## SHA

交卷 SHA `dd188df4`。
