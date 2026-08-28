# 三人组第 29 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `206d0522`。
> 前文：PR #98 r28（N-144…N-146）、#97 r27 … #90 r22、#87 r21；**PR #94** A、**PR #96** B。
> 本轮 `src/**` 零改动。三视口 390×844 / 915×412 / 1024×768。
> **编号从 N-147 起**。撞车取主干先合版。

## 一、抽验方式

- 读 r22–r28。对账已占号，不改义。
- 主干 grep：`*-back` 无 `min-height` 且未接 `touchUpliftCss`；`cursor:pointer` 且 padding≤8px 的局内钮。
- 未开无头浏览器。

## 二、号段（先合版）

N-100…N-109 主干（**N-108 = 拼图无尽画廊**）；N-110…116 跳过；N-117…146 在途 PR #87/#90–#98 已占。本轮 **N-147 起**。

并号：N-94/101 dvs；N-104 ld-back；N-141 ld-btn；N-142 fk-mode；N-144 fk-ch；N-133 rbe-back；N-134 shr；N-135 四款返回；N-139 mole/rbv-foe；N-140 sp-key；N-145 bowling `.bl-btn` + bumper 入口。仓鼠 `.bh-btn` → N-47。`.bba-swap` / balloon·brick 的 kit 抬升 → **N-132**。fruit-catch `.frc-open`/`.frc-back` → **N-121**（PR #96 在途）。`.hh-back*` 是牌背装饰，豁免 N-136。

## 三、对账

- 主干无新 SHA。N-105 / N-12 族 / C-8（禁改 `SKY_H`）/ N-90 只回归。
- alien-seek `.as-back` 基础规则无高度，但同文件 `.as-open,.as-back{min-height:44px}`，**不开号**。
- duo-rush/duo-arena `.dr-back`/`.dua-back` 只是配色类，高度在父 `button{min-height:44}`，不开号。
- N-146 扫「缺 min-height」；本轮 N-149 专扫 **`*-open`**，勿并号。

## 四、新抽验（N-147 起）

### N-147 🔧 B · 未走 kit 的返回：snake-snack / puzzle-tiles

N-135 四款、N-104/134/139 之外，主干仍有 **padding 7px、无 min-height、也没 `touchUpliftCss`** 的返回：

| 款 | 选择器 | 行号约 |
| --- | --- | --- |
| snake-snack | `.sn-back` | ~117 |
| puzzle-tiles | `.pz-back` | ~110 |

N-108 是无尽画廊 **拼块滚不到**，不是这颗「回选关」。balloon/brick 已接 kit（40），并 N-132。fruit-catch 并 N-121。

修法：补 `min-height:44px`。390/915。勿改蛇逻辑 / 拼图题库。

### N-148 🔧 B · hue-hand 接牌 + duo-vs 选档芯片

| 款 | 选择器 | 行号约 | 现状 |
| --- | --- | --- | --- |
| hue-hand | `.hh-catch` | ~183 | padding **4px 9px**，无高度（接牌 CTA；`.hh-btn`/`.hh-open` 已 44） |
| duo-vs-star | `.dvs-pick` | ~187 | padding **6px 11px**，无高度（选人/档芯片） |

≠ N-94（`.dvs-back`/开打）≠ N-101（数字垫 40）。抬到 44；915 横排不挡牌桌/选人卡。勿改花色规则 / 对战胜负。

### N-149 🔧 A · `*-open` / 模式胶囊无 44 静态巡检

N-136 只扫 `*-back`。本号扫 **`.xxx-open` / `.xxx-mode`（button）** 必须 `min-height`≥44，或紧随 kit `touchUpliftCss`。首例：`sky-squad` `.sks-mode` ~L163（`padding:8px 13px`，无高度；`.sks-back` 已 44）。豁免：非按钮装饰、已由 N-121 点名的三款（合入前勿双修）。N-147 修完 `.pz-open` 也可纳入（同款入口 padding 9px）。

## 五、r22–r28 只派不换号

A：N-149；N-146/143/138/140/136/137/132；PR #94。  
B：N-147/148；N-144/145/141/142/139；N-135 三款；N-133/134；N-125/126/129；N-108；N-121 对账 #96。

## 六、纪律

只交本文 + `trio-r29-playbook.md`。下一空号 **N-150**。
