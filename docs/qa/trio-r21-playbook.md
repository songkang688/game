# 三人组第 21 轮 · 测试修复 Playbook（给测试员 A / B）

> 基线 `origin/game-1.3` @ `6982da7e`。编号以主干为准，撞车取先合版。
> 必测三视口：**390×844 竖屏、915×412 矮横屏、1024×768 平板横屏**（第三档已升必测，救济一律用 max-height 中间档）。
> 配套增量笔记：`trio-r21-learn-notes.md`（含主干 N-100…N-107 终版语义表与旧号作废映射）。

## 〇、进场对账（先读，防撞车防重做）

1. **N-105 主干红灯禁止第四版修复**。5c27 / 9fc4 / 4e78 三个在途分支各带一份「14px→16px + 解 nowrap」：先合者生效，后合者交卷前必须 rebase 并 drop 自己那份 hunk。交卷标准：`npx vitest run` 回全绿（参考水位 1193 files / 19489 tests），不许砍 `mobileText.test.ts` / `window1-mobile-text.test.ts` 守门。
2. 本工位 r19/r20 在途文档里的 **N-103…N-116 一律作废**，语义查 learn-notes §2 映射（r20 N-108…113 = 主干 N-100…105 同义）。
3. tester A 4e78 已修：当前关可见不误滚、关内 stagebar 横滚收 116px、竖屏 `.l99-stage` 可滚、矮横屏钳高只限地图态；tester2 9ad5 已修 l99 胜负弹层。**这些只做回归验收，别重做**。
4. `c2a21b4c` 把 pinyin-train 车厢伤叫成 N-94（主干 N-94=duo-vs-star 选人屏）：合并者收录时**改新号**，两义都别再扩散。

## 一、P0（先做）

| # | 文件/组件 | 改什么 | 验收 |
| --- | --- | --- | --- |
| N-105 | `src/games/combo-clash/index.ts`、`src/games/mahjong-bloom/index.ts` | 监督三在途版先合其一；红灯清零 | vitest 全绿；360px 下 `.cc-info`/`.mj-goal` ≥16px、不 nowrap 截断 |
| N-100 残余 + **N-117** | `src/games/level99.ts` L557 `.l99-tabs`、L544 头部；`src/ui/rootUnlock.ts` | 页签 emoji 徽章收纳：非当前章仅显 emoji（约 44×44），当前章 emoji+名；锁标独立 `<span class="l99-tab-lockmark">` 供 rootUnlock 摘除；**不用 overflow-x:auto**（守门 `window6.r3.qa.test.ts` L132） | 390×844：8 章款 tabs 单行 ≤52px 高；915×412：word-garden 进场 `.l99-continue` top ≥0 全可见（N-100 卷顶不复发）；1024×768：tabs 单行；`rootUnlock.test.ts` 绿 |
| N-101 | `src/games/duo-vs-star/`（赛中键柱） | 迁 1.2 window「fixed 钉视口底」配方（N-75 前例），双列键收进 412 高 | 915×412：14 键 bottom ≤412 全 IN；画布不遮键；390×844 不回退 |
| N-107 | `src/games/fruit-stack/` | 同上配方 H：六键 fixed 钉底或画布钳高让位 | 915×412：`.fs-key` 全 IN；双画布仍 ≥高 180 可玩 |

## 二、P1

| # | 文件/组件 | 改什么 | 验收 |
| --- | --- | --- | --- |
| **N-118** | `src/games/level99.ts` L642、L723/L901 | `.l99-wrap` `calc(100dvh - 136px)` 改按实际壳高（约 96px）或删钳交给 flex；顺手 `mapColumns` 改传容器宽 | 915×412：地图底部盲区消失，触摸能滚到最后一行（含 iOS 模拟 touch 滚，非仅滚轮）；三视口无双滚动条 |
| **N-120** | `src/games/level99.ts` `.l99-view` | 补 `touch-action:pan-y; overscroll-behavior:contain`（竖屏 auto 兜底 4e78 已做，勿重复） | 915×412 触摸拖动地图不被 canvas/手势劫持；页面不整体橡皮筋 |
| N-102 / N-103 / N-106 | bumper-cars / ice-fire-forest / monster-crisis | 「改显示不改世界」：钳显示画布进屏，root 工具行计入高度预算（N-103 root×188 档） | 各款 915×412 画布与键 bottom ≤412；1024×768 刹车键 ≤768；390×844 不回退 |
| N-104 | `src/games/landlord-cards/` `.ld-back` | h 33→≥44（padding 抬，勿动布局） | 两态（开局/出牌）均 ≥44 |
| **N-121** | fruit-catch / balloon-pop / duo-rush 模式键 | 统一抬到 min-height:44 | 三款模式键 ≥44，三视口不裁切 |

## 三、P2

| # | 内容 | 验收 |
| --- | --- | --- |
| **N-119** | 地图观感：章节主题色渐变节点、三星金边、页签选中态加重（纯 CSS，跟 N-117 同 PR 顺手做） | 三视口截图对比；不改 DOM 语义、admin 测试不红 |
| **N-122** | duo-rush 390×844 竖屏 CTA 先量后修（疑似线下） | 量得 top/bottom 上账再修 |
| **N-123** | `src/ui/home.ts` hero 区 1024×768 横向留白收敛 | 平板首屏卡片列 ≥3 |
| **N-124** | **平板断点空洞**（新）：33 款只有 500 档救济（名单见 learn-notes §4.2）。本轮先抽验代表款：word-garden、sudoku-petal、merge-2048、shoot-range，量 1024×768 触区/密度，救济统一 `@media (max-height:820px) and (pointer:coarse)` 中间档 | 抽验款触控键 ≥44、无悬停依赖；不动 500 档既有规则 |

## 四、不要动什么

1. `window6.r3.qa.test.ts` L132 守门：`.l99-tabs` 不许 `overflow-x:auto`（N-117 用徽章收纳绕开）。
2. mobileText 守门测试与 16px/14px 红线：只许改实现迁就测试，不许反向。
3. 4e78 / 9ad5 已修面（误滚、stagebar、l99-overlay、矮横屏钳高）：只回归，不重写。
4. `mapColumns` 断点数值与 N-39 聚焦行为、N-75/76 键排、C-8 `SKY_H` 世界尺寸：不回退。
5. 文档轮红线照旧：学习员不改 `src/**`；测试员改动须带三视口数字上账。

## 五、完成定义

- 每单交卷附三视口实测 top/bottom 数字（工装 `/tmp/` 不进库）；
- `npx vitest run` 全绿 + `npm run build` 绿；
- 交卷文档写明基于哪个主干 SHA、drop 了哪些重复 hunk；
- 新伤一律从 **N-125** 起编（N-117…N-124 本轮已占，N-108…N-116 永久跳过）。
