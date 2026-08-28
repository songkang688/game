# 三人组 r49 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。`.l99-*` 只给 A。不改 B 游戏文件。不回退 N-202 矮横屏暂停收边、首页 `pan-x pan-y`、`.btn` 58、安全区 / `--vv-h` / CTA 回卷 / 平板 760。N-105 无第四版。

## 1024×768 完整闯关（时钟小屋）

路径：首页 → 选关 → 进关 → 暂停 → 结算 overlay（过关 / 未过关都量过）。

| 面 | 滚动 / CTA | 热区 |
| --- | --- | --- |
| 首页 | `pan-x pan-y` 仍在；页签排得下不必横滑；首卡 top=538 露在首屏 | 顶栏 ≥44 |
| 地图 | wrap **760**（h≥600）。继续 top=114 不被裁；本章 room=0 末格不裁 | 继续 / 工具 44 |
| 暂停 | 500px 收边不命中，说明仍显示；五钮 **58** 全在窗内 | — |
| 结算 overlay | 过关三钮 / 未过关两钮均在 wrap 内，h=48（源码 44，styles 48） | 修后 overlay `overflow-y:auto`，钮列 `flex:0 0 auto` |

## 本拍（N-203）

1024×768 量出来 overlay CTA **尚未被裁**。舞台 `.game-stage--l99` 是 `overflow-y:hidden`，overlay 以前 `overflow:visible`，内容一旦高于 wrap，下一关/回地图会被裁死。只给 `.l99-overlay` 加竖滚，不改 `showOverlay` / 冷静期 / 星级。

闸：`src/ui/shell.r49.test.ts`。
