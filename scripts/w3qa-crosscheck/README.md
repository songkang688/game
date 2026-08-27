# `scripts/w3qa-crosscheck/` — 窗口 3 补派测试员的**独立**走查驱动

这一套跟 `scripts/qa-window3/` 是**两套互不相干的实现**，故意不共享任何代码。

存在的意义只有一个：**交叉验证**。窗口 3 三轮验收的发布判定压在
「摆烂通关」（B1 `sky-squad` / B2 `prince-princess` / B3 `duo-vs-star` / S5 `bumper-cars`）
这几条上，而这几条全部是由 `scripts/qa-window3/` 一套工具测出来的。
一套工具测出来的结论，万一是工具自己的 bug（第 3 轮报告 §6 就自己抓出过三处工具偏差），
就会把整个发布判定带偏。所以补派测试员用另一套独立实现重跑了一遍，看结论对不对得上。

结论：**对得上，而且有两处比原报告更严重。** 详见
`docs/qa/1.2-window3-round3-tester.md` 的「附录 A · 补派测试员独立复核」。

## 跟 `scripts/qa-window3/` 的实现差异

| | `scripts/qa-window3/` | 本目录 |
| --- | --- | --- |
| 进游戏 | 自己的 driver | 等首页 `.game-card` 渲染后按标题匹配点击 |
| 判胜负 | 自己的一套 | 扫全部浮层文本，先滤掉暂停 / 规则 / 收藏册层，再按词表分胜负 |
| 画布内结算 | — | 存档指纹：只看 `campaign.v2` / `l99.*` 星级键，**逐位**比对星级数组 |
| 深关落点 | 自己的选关 | 预置存档把前 N-1 关种成已通关，再点地图上的「继续 第 N 关 ▶」 |
| 落点校验 | 「地图还看得见就不算进关」 | 进关后现场读 `.l99-stagetitle` / `.cs-level`，把关名关号打进日志 |

## 用法

先 `npm run build && npx vite preview`（默认 `http://localhost:4173`），然后：

```bash
# 摆烂复核：进关后一个键不按、一下不点，只等结算
node scripts/w3qa-crosscheck/idlewin.mjs sky-squad 1,60,133,188 70000
node scripts/w3qa-crosscheck/idlewin.mjs duo-vs-star 1,134,145,157 70000

# 深关：第 1 / 100 / 188 关（参数是 0-based）
node scripts/w3qa-crosscheck/deep.mjs gold-hook,shoot-range 0,99,187 90000

# 一款走全套：赢 / 输 / 模式 / 360px
node scripts/w3qa-crosscheck/run.mjs tank-battle win,lose,modes,narrow
```

环境变量：`SMOKE_BASE`（默认 `http://localhost:4173`）、`CHROME_PATH`（默认 `/usr/local/bin/google-chrome`）。

不参与 `npm test`，也不参与 `npm run build`，纯离线取证脚本。
