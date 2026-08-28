# 三人组第 17 轮 · 测试修复员 A

角色：壳层 + 闯关学习（第 4/10 轮）。分支 `cursor/trio-r17-tester-a-bd04`。
基线：`origin/game-1.3` @ `30cc10ab`（r16 摘合已在树：N-77 / N-87 / N-88 / N-47 仓鼠地鼠芯片）。
依据：`trio-r16-playbook.md`（无 r17 playbook）。

## 对账（本轮零重做）

A 范围 playbook 项**源码全部已合**，本轮只做 915 回归 + 水位守门：

| # | 合入批次 | 本轮动作 |
| --- | --- | --- |
| N-77 小屋相册 | r16 摘合 `30cc10ab`（`kitty-care/styles.ts` + n77 测试） | 只回归 |
| N-63 / N-47 残留 / N-16 | r13 A `215958e` | 只回归（playbook 点名补测保龄地图） |
| C-6 推理 121 / N-37 shape 深关 | r13 A + r14 A 补笔 | 只回归 |
| N-68 三图 / N-73 视奏 | r14 A `87c5aff` / `44d9e50` | 只回归 |

N-87/N-88/N-86/N-75…N-85/N-60…62/N-12/N-10/N-3/N-55 全部属 B（休闲对战），未碰。

## 本轮唯一源码改动：主干红灯抢修（测试文件，非玩法）

进场跑全量即红：`src/games/casualFit.r10b.test.ts:30` 仍钉着旧字符串
`.dr-start { position: sticky; bottom: 0`，而 r16 摘合 N-87 已把 duo-rush 菜单开跑钮升级成
「怎么玩 / 收藏册 / 开跑」整排 `.dr-menu-cta` sticky 顶（`30cc10ab` 有意为之，n87 测试守着新方案）。
守门**意图**（矮横屏菜单态开跑钮钉首屏 + 赛道 `match.ts` 无布局串）没变，只把断言换钉到
`.dr-menu-cta { … position: sticky; top: 0` 与 `.dr-menu-cta .dr-softbtn, .dr-menu-cta .dr-start`。
用例数不减（1 it → 1 it），未碰 `duo-rush/index.ts` 等任何休闲对战源码目录，不是第二套 N-87。

## 915×412 回归数字（preview 4173，puppeteer-core + google-chrome，每案独立 context；深关先写 `yiduo-yixing.l99.<id>` 再换 hash 重挂）

| # | 数字 | 结论 |
| --- | --- | --- |
| N-77 相册 | 首排「⭐ 8 换回来」top **275–319**（h=44）IN；整屏可点 CTA **5** 颗；`.ktc-cardnote` display **none**；卡片格自滚（旧 375 切 / 592+ 线下） | ✅ |
| N-63 保龄地图 | `.bl-open` 三钮 **82–126 IN**（双人对战/人机/无尽）；舞台 scrollTop **0**；`.l99-node-cur` **252–330 IN** | ✅ |
| N-63 hop-pads | `.l99-node-cur` **232–310 IN**；无尽/双人钮 **92–136 IN**；scrollTop **0** | ✅ |
| N-68 三图第 100 关 | `.fdf-panels-triple` 真横排三栏；play 格 top min **250**、末格底 **336 IN**（=r14 口径） | ✅ |
| N-73 视奏第 167 关 | `.mst-scoreplay` 在；哆 **346–411 IN**；5 键全在屏 | ✅ |
| C-6 推理关（存档 121 后续关） | `.as-deduce` 在；scrollTop **0**；◀✓▶ **301–345**、▼ **350–394 IN** | ✅ |
| N-37 root×shape 100 | root 永久档、`.l99-jump` 在；三张 `.qz-choice`（28/12/22 厘米）**302–348 IN**；scrollTop **0** | ✅ |
| N-47 芯片 | `.as-open`（无尽/双人）h **44**；`.mp-open` h **44**；`.bh-mode` h **44** | ✅ |
| N-16 | 无尽赛道 `.ak-back`「◀ 回选关」h **44**、**136–180 IN** | ✅ |

### 其余视口抽验

| 视口 | 数字 | 结论 |
| --- | --- | --- |
| 390×844 相册 | 首排 CTA **460–504 IN**（h=44）；竖屏 `.ktc-cardnote` 恢复 block、缩略图 ≥100 未误伤 | ✅ |
| 390×844 保龄/kitty 地图 | 模式钮 **100–144 / 148–192 IN**；`.l99-node-cur` 在屏 | ✅ |
| 1024×768 相册 | 首排 CTA **385–429 IN**；默认布局（媒体查询不生效，符合预期） | ✅ |
| 1024×768 保龄 | `.bl-open` 三钮 **100–144 IN** | ✅ |
| 1024×768 三图 100 / 视奏 167 | 末格底 **420 IN**；5 键全在屏 | ✅ |

## 水位与纪律

- `npx vitest run`：**1182 files / 19477 tests**（19476 passed + 1 skipped 为历史既有）＞ 要求的 1174/19455。进场时同一基线是 **1 file 红**（上文守门断言过期），修后全绿。
- `npm run build` 绿（PWA precache 200 entries）。
- 存档 key / `meta.id` / 题库 / seed / 胜负零触碰；root 档独立 context（写 `yiduo-yixing.root.v1` 永久档，密码流未改）；工装 `/tmp/trio-r17-measure*.mjs` 不进库。
- 未覆盖 r14/r15/r16 文档；未碰 `duo-rush`/`fight-king` 等休闲对战源码目录。

## 留给下轮

- B 面仍开：N-86 大厅卡（r16 复测仍 337 切）、N-75…N-85、N-60/61/62 贴线、N-12/N-10/N-3/N-55；A 面 playbook 项全部合入且本轮 915 复测通过,无新伤上账。
