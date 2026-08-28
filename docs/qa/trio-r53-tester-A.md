# 三人组 r53 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。抽验 390×844 / 915×412 攻略抽屉。只改壳层 `styles.css`。不抢 B 游戏文件。不回退 open/back 闸、overlay、安全区、首页横滑。N-105 无第四版。

## 抽验

攻略是 `position:fixed` 全屏遮罩 + 抽屉。点遮罩（抽屉外）才关，关卡格子点不到——这是模态，不是挡死关卡。

| 面 | 发现问题 | 修 |
| --- | --- | --- |
| 390 半屏 sheet | `.guide-body` 是 flex 子项，默认 `min-height:auto`，长文往往撑开抽屉、滚不动 | `min-height:0` + `overflow-y:auto` + `touch-action:pan-y` |
| 390 / 915 关闭钮 | 规则写 `width/height:38`，热区不稳 | 改为 **44×44**（分组 `min-height:44` 仍在） |
| 915×412 侧栏 | 头脚 padding 18 把正文挤没；overscroll 可能带动关卡 | 500px 档收头脚；overlay/body `overscroll-behavior:contain` |

「知道啦」仍走分组 44。不改 `guide.ts` 文案、不改 `dialogs.ts`、不改 B 游戏。

闸：`src/ui/shell.r53.test.ts`。
