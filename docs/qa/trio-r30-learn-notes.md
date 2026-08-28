# 三人组第 30 轮 · 学习笔记（学习员 C / 1cd5，仅增量）

> 基线：`origin/game-1.3` @ `206d0522`。
> 前文：PR #100 r29（N-147…N-149）、#98 r28 … #90 r22；**PR #94** A、**PR #96** B；**PR #99** 另开 N-99/100/97 源码。
> 本轮 `src/**` 零改动。三视口 390×844 / 915×412 / 1024×768。
> **编号从 N-150 起**。撞车取主干先合版。

## 一、抽验方式

- 读 r22–r29。对账已占号，不改义。
- 主干 grep：局内 `*-btn`/`*-act`/`*-veil-btn` 无 `min-height`，且未接 kit / `TOUCH_MIN`。
- 未开无头浏览器。

## 二、号段（先合版）

N-100…N-109 主干（**N-108 = 拼图无尽画廊**）；N-110…116 跳过；N-117…149 在途 PR #87/#90–#100 已占。本轮 **N-150 起**。

并号：N-94/101 dvs；N-104/141 地主；N-142/144 fight-king；N-133/134；N-135 四款返回；N-145 bowling/bumper；N-147 snake/puzzle **返回**；N-148 hh-catch / dvs-pick；N-149 `*-open`/模式胶囊。仓鼠 `.bh-btn`/菜单 → N-47。kit 40 → N-132。fruit-catch 开/返回 → N-121。`.se-deed` 36 曾作 G-3 地格豁免依据，**本轮不新开**（地契行保持信息入口口径）。王子 `.pcp-btn` 已写 `min-height:44`，不开号。

## 三、对账

- 主干无新 SHA。N-105 / N-12 族 / C-8（禁改 `SKY_H`）/ N-90 只回归。
- **PR #99** 在途修 N-99/100/97：A **勿第二套** 数独滚动 / 进图 CTA / 农场裁切。
- `.pzt-eye` 不是 N-108（画廊）也不是 N-147（`.pz-back`）。
- N-149 扫 open/mode；本轮 N-152 扫 **veil 结算钮**，勿并。

## 四、新抽验（N-150 起）

### N-150 🔧 B · brave-path 顶栏 / 技能钮无 min-height

`brave-path/index.ts`：

| 选择器 | 行号约 | 现状 |
| --- | --- | --- |
| `.bvp-btn` | ~160 | padding 9px 15px，无高度（回退/开打等） |
| `.bvp-btn-sm` | ~169 | 再收到 padding 6px 11px |
| `.bvp-act` | ~218 | 技能格 padding 11px 8px，无高度（说明行 11px，915 收行后可能 <44） |

`.bvp-mode` 大厅卡 padding 15px，先量再决定是否钉 44（可并本号，勿另开）。勿改战斗公式 / 关卡表。

### N-151 🔧 B · 拼图工具眼/撤销 + 王子结算 `.pcp-act`

| 款 | 选择器 | 行号约 | 现状 |
| --- | --- | --- | --- |
| puzzle-tiles | `.pzt-eye, .pzt-undo` | ~119 | padding 8px 12px，无高度（窥底图 / 撤销） |
| prince-princess | `.pcp-act` | ~255 | 结算 overlay CTA，padding 9px 18px，无高度（`.pcp-btn` 已 44） |

N-147 只修 `.pz-back`。390/915。勿改拼图题库 / 王子关卡。

### N-152 🔧 A · `*-veil-btn` 结算钮静态巡检

多款复制同一套 overlay 钮：`padding:10px 20px`、字 15px、**没有** `min-height`（`ph-veil-btn` / `pfb-veil-btn` / `pcp-veil-btn` / `sks-veil-btn` / `shr-veil-btn`；仓鼠 `.bh-veil-btn` 并 N-47）。10+15+10 在部分 UA 上会落到 40 上下。

本号：凡 `.\w+-veil-btn{` 且 `cursor:pointer`，必须 `min-height`≥44。B 可顺手修抽到的款，但测试归 A。

## 五、r22–r29 只派不换号

A：N-152；N-149/146/143/138；PR #94/#99 回归。  
B：N-150/151；N-147/148/144/145/141/142；N-135 三款；N-125/126/129；N-108。

## 六、纪律

只交本文 + `trio-r30-playbook.md`。下一空号 **N-153**。
