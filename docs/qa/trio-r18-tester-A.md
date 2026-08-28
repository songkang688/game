# 三人组第 18 轮 · 测试修复员 A(壳层 + 闯关学习)

战役:trio-r18 / UX-99 wave1。分支 `cursor/trio-r18-tester-a-5c27`,目标 `game-1.3`。
基线:`origin/game-1.3` @ `10022068`(含 r17 全部:N-89 壳标题、r15 B N-75…N-85、r16 摘合 N-77/N-87/N-88/N-47)。

## 实施计划(进场先写)

1. **进场水位**:`npx vitest run` = **1193 files / 19489 tests**,其中 **2 files / 5 tests 红**(主干进场即红,见下);`npm run build` 未验前不结案。
2. **主干红灯抢修(最高优先)**:r15 B `81b228c2` 在 `@media (max-height:500px)` 里把
   `combo-clash .cc-info`、`mahjong-bloom .mj-goal` 压到 **14px** 且给 `.mj-goal` 加了
   `white-space:nowrap`,撞了 16px 正文红线守门(`mobileText.test.ts` ×3 +
   `window1-mobile-text.test.ts` ×2)。红线是项目钉死的(level99.ts 注释:「说明文字的
   16px 红线矮屏也算数」),守门是对的,修源码:删媒体块里的 font-size 覆盖(回落基准
   16px)、去 nowrap,单行预算按 16px 收。**不碰**牌宽 44 / fixed 手牌 / 三键钉底等
   N-75/N-76 主体。守门测试即回归测试(5 红 → 绿),不另立第二套。
3. **管理员门亲手测**(root12Contract,密码 `kangkang`):开/关、1h/永久各独立
   context;默认时长 1 小时;开着时选关地图全开 + 关内直达;关着/过期回落星级解锁;
   localStorage 只有 `{expiresAt,mode}`,密码字符串不落盘。
4. **已合项只回归**:N-77 相册(390+915)、N-63/C-6/N-37/N-68/N-73(915),禁第二套。
5. **壳层走查**(390×844 / 915×412 主档 / 360×800 / 768×1024):首页筛选+收藏、家长门
   时长 UI、选关地图滚动与当前关居中、结算弹窗、`.pause` overlay 套娃。
6. **闯关学习抽验**:root 开着直达第 60/100/150/188 关(word-garden quiz 族、
   pinyin-train、clock-house、find-diff、math-farm、shape-kingdom、color-fun、
   music-stars),看直达条是否把答题区顶出屏。
7. **发现不合理立刻修**:热区 ≥44、选关可滚完全部关、竖屏不裁主舞台;每条配小测试,
   只动独占文件(styles.css、ui/{home,parentAuth,collection,dialogs}、level99 相关、
   闯关学习游戏目录)。
8. **收尾**:fetch → rebase → `npm test`/`npm run build` 全绿(水位 ≥ 1193/19489)→
   push 功能分支 + 尽量 `HEAD:game-1.3`(撞车取先合版)→ 本报告补每条视口数字。

红线复述:不改存档 key / `meta.id` / 题库 / seed / 胜负判定;测试只增不减;
`src/art/kit/` 只 import 不改;禁 force push;深关用 root 直达不写星级存档。

(以下按完成顺序补记)
