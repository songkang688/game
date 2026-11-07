# 一朵一星 1.4 · 派发登记表（主管维护；窗口不改本表，只改各自 `docs/qa/1.4/window<N>-status.md`）

> 总纲：[`plan-1.4-supervisor.md`](./plan-1.4-supervisor.md)。状态五种：`未派` / `在跑` / `待验` / `已验收` / `打回`。
> 工单：`t1` = 工序 A+B+C（体检 / 188 关审计 / bug）；`t2` = D+E+F（手感 / UI / 建模，可拆 2a/2b）；`t3` = G（纵深，仅窗口 5）。
> 每格「同一款游戏同一时刻只有一个工人」。窗口状态文件格式：一行一工单 `w<N>-<id>-t<k> | 状态 | 派发时间 | SHA | 用例水位 | 备注`。

## 〇、当前水位

| 项 | 值 | 记录 |
| --- | --- | --- |
| 基线 | `game-1.4` ← `origin/game-1.3` @ `3ebc4228`（1.3.4） | 2026-11-07 |
| 用例水位（r19 实测） | 1193 文件 / 19489 用例（含当时 5 红，已在 1.3.4 修绿）；本机现有 1255 个 `*.test.ts` | 2026-11-07 |
| 窗口分支 | `game-1.4-window1…5`（窗口自己从 `origin/game-1.4` 砍并推） | — |
| 工人模型 | `claude-opus-5-5-xhigh-fast` | — |

## 一、依赖闸门

| 闸门 | 规则 |
| --- | --- |
| `w1-infra-feel` | 合进 `game-1.4` 之前，任何窗口不开 `t2`（或开 `t2` 时只做 E/F，D 留待） |
| `w1-infra-frame` | 合进 `game-1.4` 之后，各窗口 `t2` 的五视口测量统一用 `scripts/qa/measure-viewports.mjs` |
| `w5-infra-runner` | 合进 `game-1.4-window5` 之前不开任何 `t3`；合进 `game-1.4` 之前其他窗口不接 runner |
| 每窗三轮验收 | 本窗全部 `t1`/`t2`（/`t3`）已验收后才派；三轮严格串行 |

## 二、基建与验收格

| 格 | 窗口 | 状态 | 派发时间 | SHA | 用例水位 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| `w1-infra-feel` | 1 | 未派 | | | | 第一波必派 |
| `w1-infra-frame` | 1 | 未派 | | | | 第一波必派 |
| `w5-infra-runner` | 5 | 未派 | | | | 第一波必派 |
| `w1-r1/r2/r3` 验收 | 1 | 未派 | | | | |
| `w2-r1/r2/r3` 验收 | 2 | 未派 | | | | |
| `w3-r1/r2/r3` 验收 | 3 | 未派 | | | | |
| `w4-r1/r2/r3` 验收 | 4 | 未派 | | | | |
| `w5-r1/r2/r3` 验收 | 5 | 未派 | | | | |
| 收官：release-notes / README / 版本号 | 主管 + 窗口 1 | 未派 | | | | 五窗三轮全绿后 |

## 三、游戏格（76 款）

### 窗口 1（9）

| id | t1 | t2 | 备注 |
| --- | --- | --- | --- |
| clock-house | 未派 | 未派 | quiz99 款 |
| find-diff | 未派 | 未派 | |
| math-farm | 未派 | 未派 | `runner.ts` 禁盲拷 500 档 |
| pinyin-train | 未派 | 未派 | `scene.ts` / `timed.ts` 禁盲拷 |
| shape-kingdom | 未派 | 未派 | |
| sudoku-petal | 未派 | 未派 | 唯一解校验 |
| word-garden | 未派 | 未派 | `tracing.ts` 第二处花园 |
| color-fun | 未派 | 未派 | |
| music-stars | 未派 | 未派 | 音砖工具排 N-113 已修勿回退 |

### 窗口 2（17）

| id | t1 | t2 | 备注 |
| --- | --- | --- | --- |
| adventure-king | 未派 | 未派 | |
| bomb-buddies | 未派 | 未派 | CI 慢用例注意 timeout |
| box-hamster | 未派 | 未派 | D-pad U-10 已修 |
| brave-path | 未派 | 未派 | 轻 RPG，无尽深渊 |
| candy-swing | 未派 | 未派 | 物理 |
| dot-maze | 未派 | 未派 | 四幽灵 AI |
| fruit-slice | 未派 | 未派 | 画布内菜单（P-7） |
| garden-guard | 未派 | 未派 | 塔防 BOSS |
| ice-fire-forest | 未派 | 未派 | 双人合作 A/B |
| monster-crisis | 未派 | 未派 | |
| ocean-munch | 未派 | 未派 | 画布内菜单（P-7） |
| orb-arena | 未派 | 未派 | `OA_SHORT_PANE_H=200` 守门 |
| prince-princess | 未派 | 未派 | 双人 |
| sky-squad | 未派 | 未派 | `SKY_H` 禁改；D-pad U-19 |
| snake-royale | 未派 | 未派 | |
| sprout-defense | 未派 | 未派 | 画布内菜单（P-7） |
| tank-battle | 未派 | 未派 | 双人 D-pad U-7 已修 |

### 窗口 3（21）

| id | t1 | t2 | 备注 |
| --- | --- | --- | --- |
| alien-seek | 未派 | 未派 | C-6 pads |
| balloon-pop | 未派 | 未派 | `SKY_H=420` 禁改（降级台账） |
| block-drop | 未派 | 未派 | |
| brick-break | 未派 | 未派 | L1 画布底切（台账） |
| bubble-aim | 未派 | 未派 | |
| bubble-pop | 未派 | 未派 | |
| fishing-star | 未派 | 未派 | 已有 runCampaign |
| fruit-catch | 未派 | 未派 | `canvasDisplayCapPx` 配方源 |
| fruit-stack | 未派 | 未派 | |
| kitty-care | 未派 | 未派 | 养成 |
| lianliankan | 未派 | 未派 | 密格豁免（台账） |
| match-stars | 未派 | 未派 | 末行可滚（台账） |
| memory-cards | 未派 | 未派 | N-115 已修 |
| merge-2048 | 未派 | 未派 | |
| mine-garden | 未派 | 未派 | 末排（台账）；首点安全 |
| mole-pop | 未派 | 未派 | 洞 ≥56px 守门 |
| pool-stars | 未派 | 未派 | `MAX_VERTICAL_PX` |
| puzzle-tiles | 未派 | 未派 | N-108 已修 |
| shoot-range | 未派 | 未派 | |
| snake-snack | 未派 | 未派 | `SR_SHORT_PANE_H=200` |
| tap-tiles | 未派 | 未派 | 隐藏键盘禁盲拷 |

### 窗口 4（19）

| id | t1 | t2 | 备注 |
| --- | --- | --- | --- |
| chess-garden | 未派 | 未派 | N-112 已修 |
| combo-clash | 未派 | 未派 | N-105 16px 已修 |
| dark-chess | 未派 | 未派 | |
| duo-arena | 未派 | 未派 | 无战役：对战 / 无尽模拟 |
| duo-vs-star | 未派 | 未派 | |
| fight-king | 未派 | 未派 | N-111 菜单可滚 |
| flight-chess | 未派 | 未派 | U-14 |
| gomoku | 未派 | 未派 | 算杀档 |
| hero-cards | 未派 | 未派 | U-15 |
| hue-hand | 未派 | 未派 | |
| junqi-camp | 未派 | 未派 | |
| landlord-cards | 未派 | 未派 | 三人斗地主 AI |
| mahjong-bloom | 未派 | 未派 | N-105 已修 |
| puff-bros | 未派 | 未派 | A/B 可分 |
| red-blue-tap | 未派 | 未派 | `SHORT_LANDSCAPE_PX=420` 禁改 |
| red-blue-tug | 未派 | 未派 | |
| star-estate | 未派 | 未派 | N-3 / U-1 |
| weiqi-garden | 未派 | 未派 | N-10 残余（台账） |
| xiangqi | 未派 | 未派 | |

### 窗口 5（10）

| id | t1 | t2 | t3 | 备注 |
| --- | --- | --- | --- | --- |
| rainbow-run | 未派 | 未派 | 未派 | 已有 runCampaign；`view3d.ts` 适配 |
| duo-rush | 未派 | 未派 | 未派 | 无战役；让分芯片（台账） |
| red-blue-race | 未派 | 未派 | 未派 | |
| bumper-cars | 未派 | 未派 | 未派 | |
| bowling-lane | 未派 | 未派 | 未派 | U-13 |
| poop-hero | 未派 | 未派 | 未派 | 俯冲段 |
| hop-pads | 未派 | 未派 | 未派 | |
| gold-hook | 未派 | 未派 | 未派 | `depth12.ts` 适配 |
| sling-birds | 未派 | 未派 | 未派 | `depth12.ts` 适配 |
| snow-fight | 未派 | 未派 | 未派 | N-55 已修 |

## 四、事故处理

沿用 1.3 登记表第五节；另加：

| 情况 | 怎么办 |
| --- | --- |
| 工人靠放宽机器人 / 删断言让审计「变绿」 | 打回，revert，重派并在工单备注记一次 |
| 工人在 `.l99-host` 链里新加 `position:sticky` 底键 | 打回（playbook 第八节军规） |
| 两个窗口同时改同一 `src/games/<id>/` | 后推者 revert；机动帮忙前必须 fetch 五个窗口分支再决定 |
| 工人推了 `game-1.3` / `main` | 严重事故，立刻通知主管 revert |
