# 三人组 r12 测试修复员 B

基线：`origin/game-1.3` @ `51803a4b`（含 `ce14c0a5` / PR #68 N-45/C-8/N-10）。
分支：`cursor/trio-r12-tester-b-c14c`。
范围：r11 playbook 双人新伤 N-52…N-57。未改 quiz99 / color-fun / math-farm / level99。未重做 N-45/40/41/42/25/31/1/2/3/4。测试只增。

配方：L=手势面 vs 壳；G=侧栏/钳。离线=`top≥412` 或 `bottom>412`。预览 `http://127.0.0.1:4182/`。视口 915×412 时浏览器窗口须同尺寸，否则 `max-height:500px` 媒体不命中。

## 新增测试

- `src/games/duo-arena/shortLandscape.r12.test.ts`
- `src/games/tank-battle/landscapePads.r12.test.ts`
- `src/games/hop-pads/duoPane.r12.test.ts`
- `src/games/snow-fight/landscapePads.r12.test.ts`
- `src/games/sky-squad/hit.r12.test.ts`
- `src/games/fight-king/selectShell.r12.test.ts`

## N-52 duo-arena 915 菜单开擂 + 对局下半场

菜单账 ≠ 对局账。配方 L + 分屏。

- CSS：`.dua-setup-foot` 粘底；对局 `.dua-play` 双栏 + `.dua-btns` 粘底。`match.ts` 未改。
- 915×412：怎么玩 290–336；开擂 342–398；菜单裁切 131。对局两场 171–339；垫 44 全在屏；暂停 349–395。
- 390×844：开擂 543 在 844 内。1280×800：场上下叠、在屏。

## N-53 tank-battle 双人对战

两套 D-pad+开火全线下 + 32px。配方 G。单人态勿扩大化。

- 仅 `:has(.tkb-pads-two)` 走横屏栅格。`.tkb-choose` 一行；HUD nowrap `max-height:44`；暂停 row1 col2；棋盘+垫 row2。
- 915×412：方向/开火 242–337；暂停 175–219 h=44；返回 78–122 h=44；棋盘 223–392。

## N-54 hop-pads 双人同屏画布出屏 208

手势面。单人 r9 已绿勿回退。

- `duoPaneHeightPx` + 视口半高封顶；`StageOpts.height` 可为 getter；延迟 `layout()`。
- 915×412 双人：画布 140–248 / 252–360 h=108；裁切 1。单人地图裁切约 142（r9 未回退关内 0）。

## N-55 snow-fight 双人十二键线下

- `:has(.snf-pad-duo)` 横屏垫旁棋盘；`shortLandscapePads()`。
- 915×412：十二键约 131–285，全在 412 内。

## N-56 sky-squad 双人合作

暂停 33 / 开关 31 / 摇杆 36 → 热区 44。勿重钳已在屏画布。顺带 N-46 单人六键切半（`--k:44`）。

- `.sks-hud`/`.sks-top` sticky。画布仍约 360 高，未再钳。
- 915×412：暂停/开关 78–122 h=44；摇杆 330–374 44×44。

## N-57 fight-king 训练场选人壳「开打 ▶」

N-31 关内已绿，只改选人壳。

- `.fk-select-shell` + `.fk-select-foot` sticky；`.fk-btn`/`.fk-ch` min-height 44。
- 915×412：开打 344–388 h=44；木桩 258–302 h=44。关内 pad 倒计时可为 0×0，未动 `.fk-train-shell`。

## 未改

A 包地图；`match.ts`；训练场对打垫位。
