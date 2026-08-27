# 1.3 八窗口派发说明（发给谁、复制哪一段）

主管同时开 **8 个窗口**。每个窗口是统筹，**必须用 Task 转发**画师和验收三人，禁止自己画。本窗口清单做完后，有空的窗口去帮还没做完的窗口（仍然转发，推到被帮窗口的分支）。

全局第 27–29 步**不要单独派**。每个窗口在自己的实现格之后加 1 包：三轮 × 测试员 / 学习优化员 / 监督修复员，只验本窗口游戏。

## 怎么发送（你对着 8 个窗口做）

1. 确认 `origin/game-1.3` 已是 1.2.2 代码 + 全套 `docs/plan-1.3-step*` + `.cursor/skills/1.3-visual/`。
2. 开 **8 个** Cursor 云端 Agent（8 个独立对话 / 8 个窗口）。模型一律选 **claude-fable-5-thinking-xhigh**。
3. 仓库选本仓库，基线 / 起始分支选 **`game-1.3`**（不要选 `game-1.2`、`main`、`1.2-kk`）。
4. 每个窗口粘贴对应文件里**从「请通过 Task 工具派生」一直到文末**的全文。标题和引用块可以带上，不要拆开，不要再套一层摘要。

| 窗口 | 复制这个文件 | 本职分支 | 实现步 | 实现格 | 游戏 | +1 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | [`plan-1.3-window1.md`](./plan-1.3-window1.md) | `game-1.3-window1` | 1–4（含 kit） | 12 | 9 | 本窗三轮验收 |
| 2 | [`plan-1.3-window2.md`](./plan-1.3-window2.md) | `game-1.3-window2` | 5–7 | 9 | 9 | 本窗三轮验收 |
| 3 | [`plan-1.3-window3.md`](./plan-1.3-window3.md) | `game-1.3-window3` | 8–10 | 9 | 9 | 本窗三轮验收 |
| 4 | [`plan-1.3-window4.md`](./plan-1.3-window4.md) | `game-1.3-window4` | 11–13 | 9 | 9 | 本窗三轮验收 |
| 5 | [`plan-1.3-window5.md`](./plan-1.3-window5.md) | `game-1.3-window5` | 14–16 | 9 | 10（15-C 两款） | 本窗三轮验收 |
| 6 | [`plan-1.3-window6.md`](./plan-1.3-window6.md) | `game-1.3-window6` | 17–19 | 9 | 9 | 本窗三轮验收 |
| 7 | [`plan-1.3-window7.md`](./plan-1.3-window7.md) | `game-1.3-window7` | 20–22 | 9 | 9 | 本窗三轮验收 |
| 8 | [`plan-1.3-window8.md`](./plan-1.3-window8.md) | `game-1.3-window8` | 23–26 | 12 | 12 | 本窗三轮验收 |

5. 窗口自己会 `checkout -B game-1.3-windowN origin/game-1.3`，然后 **Task 转发**。你当主管：谁交卷就看测试是否全绿、有没有改别人的目录、商标扫描过不过。不要让他们去领全局 27–29。有人空了会自动去帮别人。

合计实现格 12+9+9+9+9+9+9+12 = **78 格**（第 1–26 步），外加 8 个窗口各自的验收包。

窗口往下转发时用的五种角色模板在 [`plan-1.3-roles.md`](./plan-1.3-roles.md)。每份窗口提示词里已经内嵌了同一套头，窗口丢了 roles 文件也能转。

## 模型不要搞混

| 谁 | slug（不要方括号） |
| --- | --- |
| 你发给的 8 个窗口统筹 | `claude-fable-5-thinking-xhigh` |
| 窗口转发出去的画师（实现格） | `claude-fable-5-thinking-xhigh` |
| 窗口转发出去的测试员 / 学习优化员 / 监督修复员 | `claude-fable-5-thinking-xhigh` |
