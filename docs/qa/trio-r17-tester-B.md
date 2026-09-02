> **监督摘记（后合）**：本报告对应延迟交卷分支 `cursor/tester-b-r17-fixes-3c67`。源码与主干 r18/r19 B（含 PR #78、`80830f9e`）重叠冲突，**未合入源码**，避免覆盖后合布局。下列实测数字作历史记录。

# 三人组第 17 轮 · 测试修复员 B

基线：最新 `origin/game-1.3`（`30cc10ab`，已含 N-86/N-87 等先合项）。代码 **`45b75fab`**，分支 `cursor/tester-b-r17-fixes-3c67`，PR base = `game-1.3`。
范围：r16 playbook 仍开的休闲/对战/动手项（N-75/76/78/79/80/81/82/83/84/85 + 回归 N-53/N-55）。`src/ui/**`、闯关/学习一律未碰；存档 key 未动。

## 水位

- 进场对账：主干新合的 N-87 把 duo-rush 首屏 CTA 从「钉底」改「提顶」，老守门 `casualFit.r10b` 断言过时打红——先把守门对齐先合版再开工（`8ad4da39`），不属回归。
- Chrome 915×412：`setViewport` + `getBoundingClientRect` 全量复测（下表数字），390×844 / 1024×768 抽查达标。
- `npx vitest run`：**19498 全绿 + 1 skip**（1192 files）；`vite build` 绿。

## 本轮已关（矮横屏统一走 `@media (min-width:640px) and (max-height:500px)`）

| 编号 | 款 · 处 | 坏在哪（915×412 实测） | 怎么修（修后实测） |
|---|---|---|---|
| **N-80** | box-hamster 闯关 | 方向键 ⬆579/◀⬇▶637，舞台 322 裁切线外 | 「棋盘左、方向盘右」两列；⬆312/◀⬇▶362..406 |
| **N-84** | tank-battle 闯关 | ▲💥464/方向 513 出屏 | 单人档「战场左、摇杆右」（双人 `tkb-wrap-two` 零触碰）；键 255..350 |
| **N-85/N-55** | snow-fight 闯关+双人 | 搓雪键 462/514、十二键 481/531 | 操作牌横排 + 画布宽 480 上限；闯关 327..373、双人 340..386 |
| **N-83** | gomoku 闯关 | 画布 510 底出屏、悔棋行 259 起被裁 | 对局态「盘左、座位+工具右」`:has(.gmk-start)` 反选；画布 175..389、工具 259..365 |
| **N-79** | prince-princess 两人一起 | 双 D-pad 540/578 | 「朵朵键左、画布中、星星键右」三列；键 280..362 |
| **N-78** | shoot-range 双人 | 开火键 539..679 | 「键左、靶场中、键右」，靶场等比 310×192；键/靶 185..377 |
| **N-76** | combo-clash 双人/训练 | 轻重必杀 440..666 | 「摇杆左、擂台中、三键右」，出招表限高可滚；键 217..353 |
| **N-75** | mahjong-bloom 对局 | 手牌 514..678、状态行 712 | 紧凑桌两列、牌河限高可滚、手牌横滚不换行；手牌 270..374、状态 388..412 |
| **N-81** | snake-snack 无尽花园 | 画布 656 高（底 881）、方向键 913..1015 | 「画布左、徽章+方向键右」，方形画布 `min(320px,100dvh-190px)` 钳边长；画布底 407、键 271..369。另修 1024×768：画布钳 344、键 615..717（原 999..1101 不可达） |
| **N-82** | bubble-pop 无尽泡泡海 | 12 行泡泡排到 1134、底行摸不到 | 12 行×44px 数学上装不进 412 高：改「盘左、抬头右」+ 盘面限宽保 44px 泡径 + **盘内滚动**（涨潮线 sticky 钉顶、消息钉底、开局自动停在海面）；底行 299..345。1024×768 同套钳宽后底行 499..546 |

### 顺手挖出的老坑（N-81/N-82 桌面档的真凶）

`.l99-host{display:flex;overflow:hidden}`（N-63 架构）有两笔连带账：
1. **hidden 失效**——`display:flex` 压过 `[hidden]` 的 UA `display:none`，进无尽后地图宿主其实还占着 flex 份额，此前只是被溢出内容「挤成 0 高」碰巧看不见；
2. **溢出即失联**——无尽内容高过舞台时没有任何滚动条能救。
只在 snake/bubble 自己的挂载里修：`levelHost`/`modeHost` 挂类，`.xx-levelhost[hidden]{display:none}` 真让位、`.xx-modehost{overflow-y:auto}` 兜底可滚。`level99.ts` 一个字未动。

## 书面降级（不追）

- box-hamster 矮横屏提示行限高 36px 截断（纯提示文案）；
- combo-clash 训练场出招表 44px 限高内滚动查看；
- snake 矮横屏右栏消息行贴视口底,长文案首行以外需滚存档区(纯提示);
- bubble 泡泡海矮横屏为保 44px 泡径必须盘内滚动——12 行×44px=528px 是几何下限,412 高视口无解。

## 中途打红又修绿

- N-84 注释里的 💥 触发 `visualScan13` 码点水位——去 emoji（`35831c94`）;
- combo/mahjong 矮横屏小字号触发 `window1-mobile-text`/`mobileText` 16px 红线——`.cc-msg/.cc-info/.cc-name` 回 16px、`.cc-combo/.mj-msg` 撤销覆盖沿用基础字号（`45b75fab`），修后 915×412 布局复测仍全部进屏。

## 测试（只增，共 8 个新文件；唯一改动的老断言是对齐主干 N-87 的 `casualFit.r10b`）

`box-hamster/levelPad.r17` · `tank-battle/levelPad.r17` · `snow-fight/levelDuoPads.r17` · `gomoku/levelTools.r17` · `prince-princess/duoPads.r17` · `shoot-range/duoPads.r17` · `combo-clash/duoKeys.r17` · `mahjong-bloom/tableFit.r17` · `snake-snack/endlessFit.r17` · `bubble-pop/seaFit.r17`

## 护栏

不改存档 key / meta.id / 判定与胜负逻辑 / seed；触屏热区 ≥44px、字号红线 14/16px 全数达标；禁 force；`src/ui/**` 零改动。
