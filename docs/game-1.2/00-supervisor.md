# 一朵一星 1.2 · 主管工作计划 / 基线（A 档开工记录）

> 本文件后续会扩成完整主管文档。本 commit 只登记开工计划与盘点结论，不写游戏代码。

- 角色：**A 档 · 主管 / 编排员**（只写提示词 Markdown，禁止实现游戏代码，禁止再派生云端子代理去写代码）
- 持续优化分支：`game-1.2`（不回 `main`、不合 `main`）
- 工作分支：`cursor/game-1.2-supervisor-docs-7715`，从 `origin/game-1.2` 拉出
- 基线 SHA：`origin/game-1.2` = `71eb519d6bd8884bf77e7bd6350a356c35736a37`
- 对照：`origin/game-1.1` = `88e3effac229150267c94862170526ec99d705d8`；`origin/main` = `f5af78942e298a095317d6a21b30689eab53dfd1`
- 指定执行模型 slug（只写进提示词正文，本主管自己 inherit）：`claude-opus-5-thinking-high-fast`

## 真实点清（`src/games/*/meta.ts`）

| 数据源 | 款数 | 备注 |
| --- | --- | --- |
| `origin/main`（1.0） | 34 | 见 `docs/upgrade-prompts/10-game-1.1-baseline.md` |
| `origin/game-1.1` | **54** | 有 `bumper-cars`，**无** `bowling-lane` |
| `origin/game-1.2`（当前） | **53** | 比 1.1 少 `bumper-cars`（1.2 尚未 rebase 进 step7/C） |
| 1.1 派发规划第 7–11 步 | 21 款新游戏 | 含 `bowling-lane`（规划有、两分支都未落地） |

**1.2 规划按「1.1 做完 = 55 款」计算**：34 + 21，含 `bumper-cars` 与 `bowling-lane`。执行升级步前主管必须先把 `origin/game-1.1` 的 `bumper-cars` rebase 进 `game-1.2`；`bowling-lane` 若仍缺，由升级步里分到该 id 的子代理按 1.1 第 7 步 C 规格先落地再做 1.2 精细化，**不占 21 款新游戏名额**。

## 步数公式（不硬套 33）

```
N_1_1          = 55
N_new          = 21
N_total        = 55 + 21 = 76
N_platform     = 1          # 派发步 1；文档 step-01.md
N_new_steps    = 21 / 3 = 7 # 派发步 10–16
N_upgrade      = ceil(76/3) = 26  # 派发步 30–55（末步 remainder 1）
N_home         = 1          # 派发步 60 首页/冲突
N_qa           = 3          # 派发步 61–63 验收三人组
N_dispatch     = 1 + 7 + 26 + 1 + 3 = 38
```

编号规则：平台 01–09，新游戏从 10 连续，升级从 30 连续，首页 60，QA 61–63。

## 本档独占文件（写完这些就停）

- `docs/game-1.2/00-supervisor.md`（本文件，扩成完整主管文档）
- `docs/game-1.2/00-index.md`
- `docs/game-1.2/00-catalog.md`（21 款 id 定稿）
- `docs/upgrade-prompts/12-game-1.2-baseline.md`
- `docs/game-1.2/step-01.md`（平台第 1 步 A/B/C 完整可复制提示词）

禁止写 `docs/game-1.2/new-games/` 与 `docs/game-1.2/upgrades/`（B/C 档）。

## 下一步

1. 联网排行补满 21 款并在 `00-catalog.md` 定稿 id。
2. 写出主管 / 目录 / 基线 / 第 1 步派发提示词。
3. rebase 到最新 `origin/game-1.2` 后 push，对 `game-1.2` 开 draft PR。
