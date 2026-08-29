# 三人组 r50 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。不改 B 游戏文件。不回退 overlay 竖滚、N-202 暂停收边、首页横滑、`.btn` 58、CTA 回卷、平板 760。N-105 无第四版。

## 390×844 结算 overlay

过关 / 未过关都打开过。`overflow-y:auto`。内容贴合（`scrollH=clientH`），不必滚。

| 钮 | 高 | 可点（elementFromPoint） | 裁切 |
| --- | --- | --- | --- |
| 下一关 / 再玩一次 / 回地图 | 48 | 是 | 否 |
| 再试本关 / 回地图 | 48 | 是 | 否 |

点「回地图」能回到 `.l99-continue`（闸外实机复测）。

## 915×412

过关 overlay 修前 `scrollH` 326 / `clientH` 320，三钮贴白卡底。未裁但只剩 6px，影子会被 overlay 滚动盒吃掉。

**N-204：** `max-height:500px` 收 overlay padding / 头像，`justify-content:flex-start` + `.l99-ov-btns{margin-top:auto}` 把 CTA 钉底；`.l99-overlay{touch-action:pan-y}`。不改 `ov-btn` 44/48、`showOverlay`、冷静期。

闸：`src/ui/shell.r50.test.ts`。
