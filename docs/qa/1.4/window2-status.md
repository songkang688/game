# 1.4 · 窗口 2 状态表（闯关动作 17 款）

> 窗口分支 `game-1.4-window2`（从 `origin/game-1.4` @ `10926b9b` 砍出）。工人模型 `claude-opus-5-5-xhigh-fast`，`subagent_type=generalPurpose`，`environment=cloud`，`cloud_base_branch=game-1.4-window2`。
> 状态五种：`未派` / `在跑` / `待验` / `已验收` / `打回`。格式：`工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注`。
> 本窗所有权：17 款 `src/games/<id>/`（含测试）、`docs/qa/1.4/<id>-*.md`、`docs/qa/1.4/window2-*.md`；`src/art/kit/` 只许新增 `<id>-*.ts`。共享文件一律写需求单（第三节）。

## 〇、水位

| 项 | 值 |
| --- | --- |
| 基线 | `origin/game-1.4` @ `10926b9b` |
| 用例水位 | 基线 1255 个 `*.test.ts` / 约 19.5k 用例（r19 实测 19489）；每张工单验收后按工人回复更新 |
| 并发 | 6 槽，云端独立工作区；本机无 Node，窗口本体不跑测试，全量以工人回复 + 主管合并前复跑为准 |
| 闸门 | `w1-infra-feel` 合进 `origin/game-1.4` 之前，本窗 t2 只做 E/F（开 `t2a`），D 待接 |

## 一、工单状态（17 款 × t1 / t2）

LOC > 6000 的 9 款（garden-guard candy-swing prince-princess ocean-munch sprout-defense sky-squad brave-path ice-fire-forest bomb-buddies）t2 拆 `t2a`（D+E）→ `t2b`（F）串行。

| 工单 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w2-garden-guard-t1 | 未派 | | | | 波 1；塔防经济模拟；BOSS 多段 |
| w2-garden-guard-t2a / t2b | 未派 | | | | |
| w2-candy-swing-t1 | 未派 | | | | 波 1；绳长 / 锚点 / 啾啾几何可达 |
| w2-candy-swing-t2a / t2b | 未派 | | | | |
| w2-prince-princess-t1 | 未派 | | | | 波 1；双人横版各自可过；840 档只加 `min-height:621` 轻钳 |
| w2-prince-princess-t2a / t2b | 未派 | | | | |
| w2-ocean-munch-t1 | 未派 | | | | 波 1；成长曲线；画布内菜单（P-7） |
| w2-ocean-munch-t2a / t2b | 未派 | | | | t2 需改 DOM 覆盖层或暴露可测状态 |
| w2-sprout-defense-t1 | 未派 | | | | 波 1；阳光经济与波次模拟；画布内菜单（P-7） |
| w2-sprout-defense-t2a / t2b | 未派 | | | | t2 需改 DOM 覆盖层或暴露可测状态 |
| w2-box-hamster-t1 | 未派 | | | | 波 1；每关 BFS 可解（冰面 / 传送门 / 双鼠）；D-pad U-10 勿回退 |
| w2-box-hamster-t2 | 未派 | | | | |
| w2-sky-squad-t1 | 未派 | | | | 波 2；弹幕 BOSS 安全走位采样；`SKY_H` 禁改；D-pad U-19 |
| w2-sky-squad-t2a / t2b | 未派 | | | | 模式键 ≥44 |
| w2-brave-path-t1 | 未派 | | | | 波 2；五系克制 + 装备曲线；无尽每 10 层不指数失控 |
| w2-brave-path-t2a / t2b | 未派 | | | | |
| w2-ice-fire-forest-t1 | 未派 | | | | 波 2；双机器人合作模拟；机关顺序可解 |
| w2-ice-fire-forest-t2a / t2b | 未派 | | | | A/B 剪影 / 主色 / 配饰三层不同 |
| w2-bomb-buddies-t1 | 未派 | | | | 波 2；审计测试控制在 CI 180 s 内；合作 / 对战两套模拟 |
| w2-bomb-buddies-t2a / t2b | 未派 | | | | |
| w2-monster-crisis-t1 | 未派 | | | | 波 2；路障 / 炮台 / 颜料弹资源与波次模拟 |
| w2-monster-crisis-t2 | 未派 | | | | |
| w2-tank-battle-t1 | 未派 | | | | 波 2；地形下基地可守（路径模拟）；双人 D-pad U-7 勿回退 |
| w2-tank-battle-t2 | 未派 | | | | |
| w2-adventure-king-t1 | 未派 | | | | 波 3；神器可集齐、首领门可达（图搜索）；BOSS 仪式 |
| w2-adventure-king-t2 | 未派 | | | | |
| w2-dot-maze-t1 | 未派 | | | | 波 3；起点 / 豆子 / 出口连通；幽灵不围死出生点 |
| w2-dot-maze-t2 | 未派 | | | | |
| w2-fruit-slice-t1 | 未派 | | | | 波 3；指令果 / 硬壳果频率下目标可达；画布内菜单（P-7） |
| w2-fruit-slice-t2 | 未派 | | | | t2 需改 DOM 覆盖层或暴露可测状态 |
| w2-orb-arena-t1 | 未派 | | | | 波 3；分身 / 刺球密度存活率模拟；`OA_SHORT_PANE_H=200` 守门不动 |
| w2-orb-arena-t2 | 未派 | | | | |
| w2-snake-royale-t1 | 未派 | | | | 波 3；对手 AI 不开局围杀 |
| w2-snake-royale-t2 | 未派 | | | | |

## 二、验收三轮（全部 t1 + t2 已验收后才派；每轮 tester → learner + fixer，三轮串行）

| 格 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- |
| w2-r1-tester | 未派 | | | | |
| w2-r1-learner | 未派 | | | | |
| w2-r1-fixer | 未派 | | | | |
| w2-r2-tester | 未派 | | | | |
| w2-r2-learner | 未派 | | | | |
| w2-r2-fixer | 未派 | | | | |
| w2-r3-tester | 未派 | | | | |
| w2-r3-learner | 未派 | | | | |
| w2-r3-fixer | 未派 | | | | |

## 三、需求单

### 给窗口 1（`src/ui/**`、`styles.css`、`level99.ts`、`src/engine/**`、`src/art/kit/index.ts`、顶层守门测试）

（暂无）

### 给窗口 5（`src/art/runner/**`、`src/engine/view25d.ts`）

（暂无）

## 四、事故与打回记录

（暂无）

## 五、日志

| 时间 | 事件 |
| --- | --- |
| 2026-11-07 15:30 | 从 `origin/game-1.4` @ `10926b9b` 砍出 `game-1.4-window2`，建本表 |
