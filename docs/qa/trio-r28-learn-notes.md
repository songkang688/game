# 三人组第 28 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `206d0522`。
> 前文：PR #97 r27（N-141…N-143）、#95 r26 … #90 r22、#87 r21；**PR #94** A、**PR #96** B。
> 本轮 `src/**` 零改动。三视口 390×844 / 915×412 / 1024×768。
> **编号从 N-144 起**。撞车取主干先合版。

## 一、抽验方式

- 读 r22–r27 笔记/playbook。对账 A/B 在途号，不改义。
- 在 `origin/game-1.3` 上 grep：`min-height:3[0-9]|4[0-3]px`、`cursor:pointer` 且无 `min-height` 的 button 块。
- 未开无头浏览器。新伤给选择器 + 行号，A/B 补 rect。

## 二、号段（先合版）

| 段 | 权威 |
| --- | --- |
| N-100…N-109 | 主干 r18/r19；**N-108 = puzzle-tiles 无尽** |
| N-110…N-116 | 永久跳过 |
| N-117…N-124 | PR #87；A #94、B #96 在途 |
| N-125…N-128 | PR #90 r22 |
| N-129…N-131 | PR #91 r23 |
| N-132…N-134 | PR #92 r24 |
| N-135…N-137 | PR #93 r25 |
| N-138…N-140 | PR #95 r26 |
| N-141…N-143 | PR #97 r27 |
| **N-144 起** | 本轮 |

并号勿新开：`.dvs-back`/`.dvs-pad` → N-94/N-101；`.ld-back` → N-104；`.ld-btn` 42 → **N-141**；`.fk-mode` → **N-142**；`.rbe-back` → N-133；`.shr-back`/`.shr-toggle` → N-134；四款返回 → N-135；mole/rbv-foe → N-139；`.sp-key` → N-140。仓鼠 `.bh-btn` 并 **N-47**（PR #79 在途），不新开。`.bba-swap` 源码 34 + kit 抬到 40，并 **N-132**（kit 到 44 即绿），不新开。

## 三、对账

- 主干无新 SHA。N-105 / N-12 族 / C-8（禁改 `SKY_H`）/ N-90 只回归。
- **PR #94** 合入则 N-117/118/120 只回归。**PR #96** 合入则 N-121/122/124 只回归。
- N-143 扫写死 40/42；本轮 N-146 扫 **完全没写 min-height** 的可点块，两号并列勿并。
- 五子/象棋返回走 `MIN_HIT_PX=44` 父选择器，不开号。
- 棋盘格 `.cg-sq` 40、数独盘格：不当按钮抬到 44。

## 四、新抽验（N-144 起）

### N-144 🔧 B · fight-king 选人格 `.fk-ch` 无 min-height

`fight-king/index.ts` ~L203：`.fk-ch{padding:7px 2px;cursor:pointer}`，**没有** `min-height`。四列宫格 + 头像 `.fk-ch-a` 28px，390 上格子高很容易 <44。

≠ N-142（模式大卡 `.fk-mode`）≠ N-88（开打 CTA，已合）。抬 `min-height:44px`；390/915 选人屏。勿改 `battle` / 角色表。

### N-145 🔧 B · bowling `.bl-btn` + bumper `.bc-open`/`.bc-pick` 无高度

N-135 只钉返回。这两款入口/局内钮仍靠 padding：

| 款 | 选择器 | 行号约 | 现状 |
| --- | --- | --- | --- |
| bowling-lane | `.bl-btn` | ~108 | padding 6px 13px，无 min-height（暂停/ghost；`.bl-roll`/`.bl-pick` 已 44） |
| bumper-cars | `.bc-open` | ~148 | padding 8px 14px，无 min-height（对战/人机/无尽入口） |
| bumper-cars | `.bc-pick` | ~155 | padding 7px 13px，无 min-height（选车） |

补 `min-height:44px`。bumper `.bc-back`/`.bc-btn` 已 44，勿回退。勿改球道物理 / 碰碰车碰撞。

### N-146 🔧 A · 可点元素 **缺** min-height 静态巡检

N-136 只扫 `*-back`；N-143 只扫写死 `40|42`。本号：游戏 CSS 里 `button` / `cursor:pointer` 块若无 `min-height`（且无 `height:` ≥44、无父选择器 `MIN_HIT_PX`/`TOUCH_MIN`），测试失败。

豁免：非交互容器、棋盘/牌面格、`pointer-events:none`、padding≥14 的大卡（修完 N-142 后 `.fk-mode` 仍建议钉 44 以免空态）。N-144/145 修完后应变绿。

## 五、r22–r27 只派不换号

A：N-146 新巡检；N-143/138/140/136/137/132；N-135 的 block-drop；PR #94 回归。  
B：N-144/145；N-141/142；N-139；N-135 三款；N-133/134；N-125/126/129；N-108。

## 六、纪律

只交本文 + `trio-r28-playbook.md`。下一空号 **N-147**。
