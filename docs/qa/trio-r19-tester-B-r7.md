# 三人组 r19 · 测试员 B 第 7 轮（本机）

基线：`origin/game-1.3` @ `e866f02a`。无头 Chrome 915×412 / 390×844。未 seed root。

## 抽验仍绿（不重做）

sky-squad N-110、fight-king N-111、chess-garden N-112 抽验 OK。N-105 零 hunk。

## 本轮

| 号 | 款 | 修前 915 | 修法 | 修后 |
| --- | --- | --- | --- | --- |
| **N-113** | music-stars 听音壳 | `.mst-chip`「🔊 有声音」**408~452** 几乎出屏（N-73 只收视奏 `.mst-scoreplay`） | 500×640 档非视奏 `.mst-tools` **fixed 钉底**；不写 `.mst-chip` 选择器 | 工具钮 **362~406 h=44 全 IN** |

390：芯片 646~740 IN。N-73 `scoreKeys.r14` 仍绿。

## 书面降级（滚得到，不开号）

memory-cards 末卡切 7px、lianliankan / mine-garden 末排（台账已有）。

## 测试只增

`src/games/music-stars/toolsLand.n113.test.ts`
