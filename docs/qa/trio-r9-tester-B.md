# 三人组 r9 · 测试修复员 B 工作计划 / 进场水位

> 分支：`cursor/trio-r9-tester-b-65de`  
> 基线：`origin/game-1.3` = `a74e4868`（`git fetch` 后开枝）  
> 角色：休闲 / 对战 / 动手。A 独占文件不碰（`src/styles.css`、`src/ui/collection.ts`、`src/games/level99.ts`、`quiz99.ts`、`word-garden/**`、`pinyin-train/**`、`clock-house/**`、`find-diff/**`、`parentAuth.ts`）。

## 进场 npm test

```
Test Files  1095 passed (1095)
Tests       19288 passed (19288)
```

（以本轮 `a74e4868` 实测为准，不用过期 1090/19248。）

## 本轮顺序（先啃最重）

1. **N-25** fight-king 格斗塔：矮横屏折叠出战八宫格；触屏键 sticky 置底。护栏：人机/双人对战、无尽连胜不扩大。
2. **N-31** fight-king 训练场：触屏开时键排 sticky / 侧置；教学面板限高自滚。不改 `FIGHT_MIN_H`、帧数、判定。
3. **N-1** fruit-catch：画布显示高按可视余量钳；物理 `W/H` 与接果坐标不动。
4. **N-30** adventure-king 无尽古堡（`advk-`）：D-pad 右侧、工具钮 sticky、房间格钳可视余量。走廊三态（N-16）只验收、不与古堡混修。
5. **N-26** duo-vs-star 闯关：配方 G 双栏；`.dvs-back` `min-height:40`。五兄弟模式轻伤只回归。
6. **N-27** dot-maze 四模式横屏双栏，一次修四态。
7. **N-32** brave-path 无尽战斗三钮 sticky（配方 E）；闯关 l99 勿扩大。余力 N-2/3/4、N-29/N-23、C-2…C-8。

## 红线

- 不改存档 key / `meta.id`；不动题库/判定/关卡生成。
- 测试只增不减；每条修复配小测试。
- kit 冻结；宽屏零回归。
- C-1 `[hidden]` 已落地，不重做。

## 收尾

fetch → rebase `origin/game-1.3` → `npm test && npm run build` 全绿 → `git push -u origin HEAD` 且 `git push origin HEAD:game-1.3`（禁 force）。
