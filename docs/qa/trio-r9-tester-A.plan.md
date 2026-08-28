# trio-r9 测试修复员 A · 工作计划

- 分支：`cursor/trio-r9-tester-a-65de`
- 基线：`origin/game-1.3` = **a74e4868**（父监督 10 轮计划已合入；代码含 `6a9f42d0`/`d451c32d` 已销 S-1/S-2/S-3/S-4/L-1/C-1）
- 进场 `npm test`：本 commit 时全量仍在跑；水位以紧随的实测数字写入 `docs/qa/trio-r9-tester-A.md`（不用文档过期的 1090/19248）
- 范围：壳层 + 闯关学习。B 独占目录零触碰。存档 key / levels 判定 / kit 已有文件零触碰。

## 本轮优先

1. N-33 `.dialog-buttons` sticky 底栏
2. N-38 `rootJumpNote` 永久态走 `ROOT_PERMANENT_NOTE`
3. N-37 root 开 + 915×412 关内抬头收成一行
4. 收藏册 `.collection-close` 40→44、`.card-btn` 36→44
5. S-4 扩容 `.qz-jump-input` 38→44
6. N-36 word-garden 描红 pad 高度尺
7. N-34/N-35 pinyin-train 拼写 + 全选矮横屏双栏/缩画布带
8. 余力：L-2 已有 `faceLift` 接线（`clockSVG` 被 SHA 钉死不改函数体）；L-3 贴纸视时间

## 已销账（禁止重做）

S-1 / S-2 / S-3 / S-4 `.l99-jump-input` / L-1 / C-1 / orb-arena·snake-royale 留白 / garden-guard 节点图
