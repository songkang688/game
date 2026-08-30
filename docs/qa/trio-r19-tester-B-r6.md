# 三人组 r19 · 测试员 B 第 6 轮（本机，云额度耗尽）

基线：`origin/game-1.3` @ `a024b86`（A 第 8 轮文档之上）。
无头 Chrome 915×412 / 390×844。未 seed root。未改 `src/styles.css` / A 目录。

## 回归

N-110 飞机小队键 362~406 仍 IN（本轮未动该文件）。N-105 零 hunk。N-66 双人 `DUO_SHORT_CSS` 原文不动。

## 本轮

| 号 | 款 | 修前 | 修法 | 修后 |
| --- | --- | --- | --- | --- |
| **N-112** | chess-garden 闯关 | 末排 `.cg-sq` 初见 **396~426** 切 14px；格高 30 | wrap 矮横屏 `overflow:auto`（host hidden）。**不砍格宽** | 格高仍 **30**；`scrollIntoView` 后末排 **320~350 IN**。390 末排 632~676 仍 IN |

## 书面降级

- **match-stars** 末行 405~435：`.mst-boardwrap` 已 `overflow-y:auto`（r38），属滚得到，不立项。
- mine-garden 末排 / lianliankan 密格 / 让分芯片：沿用 playbook 降级台账。

## 测试只增

`src/games/chess-garden/shortLand.n112.test.ts`
