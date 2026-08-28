# 三人组 r38 测试员 A

> 同分支 `cursor/trio-r21-p0-n117-1cd5`。远程无 `trio-r38-playbook`。不回退 N-117…N-173 巡检闸。不改 B 游戏文件。N-105 无第四版。

## 本拍

| # | 做了什么 |
| --- | --- |
| N-119 | 选关地图纯 CSS：可玩节点叠章节色高光、三星 `:has` 金边 `#F2C14A`、当前页签加厚投影。不改 DOM / `showMap` / `mapColumns` / tabs overflow。 |
| N-123 | `styles.css` `@media (min-width:980px) and (min-height:600px)`：平板横屏 hero 拉满宽、气泡左对齐；网格 `minmax(210px,1fr)`。不命中 915×412。S-1 矮屏档不动。 |

## Chrome 实测（preview `:4188`，puppeteer-core）

首页（文档可滚：`documentElement.scrollHeight` ≫ `clientHeight`；首卡 top 均在视口内）：

| 视口 | 首行列数 | 首卡 top | hero 宽 | 气泡 text-align | 文档高/视口高 |
| --- | --- | --- | --- | --- | --- |
| 390×844 | 2 | 496 | 359 | center | 12860 / 844 |
| 915×412 | 4 | 304 | 851 | center（S-1 矮屏档，不命中 N-123） | 6914 / 412 |
| 1024×768 | **4**（≥3） | 538 | 960 | **left** | 7239 / 768 |

选关地图（时钟小屋，第 1 关灌 3 星）：

| 视口 | 三星节点 box-shadow | 锁节点 | `.l99-view` | 可滚 |
| --- | --- | --- | --- | --- |
| 390×844 | `0 0 0 3px rgb(242,193,74)` | none | overflow-y:auto; touch-action:pan-y | 本页地图贴合（scrollH=clientH=730） |
| 915×412 | 同上 | none | 同上 | 是（550 > 334） |
| 1024×768 | 同上 | none | 同上 | 本页贴合（654=654） |

当前章页签实测投影：`0 4px 0` + `0 8px 16px`。未改 `.l99-node` 热区、未改 N-105。
