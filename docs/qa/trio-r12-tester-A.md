# 三人组第 12 轮 · 测试修复员 A 交卷

角色：壳层 + 闯关学习。分支 `cursor/trio-r12-tester-a-65de`。  
进场主干：`a12c157b`（`docs(qa): 测试员A交r11剩余后派r12壳层N-59/48/58`）。

并行：`origin/cursor/trio-r12-tester-a-c14c` 含 N-48 hashchange（以及已合主干的 S-4/C-6）。本轮 **未抢 c14c 分支**；N-48 按同一 S-3 口径落地。N-59 收藏矮屏 CSS **c14c 未做**，本 PR 只加一份 `@media (max-height:500px)`，没有第三套收藏布局。

## 禁止重做

未改 N-39 / N-43 / N-44 / S-4 / C-6 推理关双栏 / N-47 / L-2 / L-3。未碰 B 的 `orb-arena` / `snake-royale` / `merge-2048`。未重写 `corridorFit`。

## 本轮落地

### N-59 收藏册 915 双栏

- `collection.ts`：`.collection-tab` / `.collection-done` **min-height:44**；关闭 `.collection-close` **44×44 未动**。
- `@media (max-height:500px)`：预览改横条、`max-height:108px`、画布 72×84，页签/脚栏不缩，grid `min-height:0` 让升级/试穿进第一屏。
- 宽屏仍双栏（未改成 `max-width:640` 那档纵排）。
- 测试：`collection.n59.test.ts` + `collection.test.ts` 注入 CSS 含矮屏档。

915×412：本环境无稳定 CDP 点按；源码钉子 = 页签/知道啦 44、预览限高 108。关闭 extra 仍 44×44。

### N-48 overlay 跨路由

- 打开时 `window` + `Document` 挂 `hashchange → close`；`close` 里摘监听。对照 S-3。
- 测试：`collection.n48.test.ts` + `collection.test.ts` 行为：`doc.fire("hashchange")` 后 overlay 个数 0。
- 试穿 canvas / 钱包 key 未动。

### N-58 暂停 + 跳关门

- `gameShell.ts`：`requestSkip` 先 `releaseShellPause`（`closePause` + `tellGame("resume")`）再开家长高权限门。
- 已暂停再点跳关：屏幕只留一层 `.dialog--gate`；Esc 一次关家长门回游戏。
- `dialogs.ts` 按钮语义 / `CLICK_GUARD_MS` 未改。测试：`gameShell.n58.test.ts`。

### N-16

只复读 `corridorFit.test.ts` 源码守门（`ak-pad` sticky、三态不挂 `advk-shell`）。**未改 corridorFit**。本环境未做浏览器进关。

## 红线

未改存档 key / `meta.id` / 题库 / seed。kit 只 import。测试只增不减。

## 水位

进场未单跑全库（主干刚含 r11 A `6a013600`）。收尾 `npm test && npm run build` 数字写在交卷 SHA 说明。
