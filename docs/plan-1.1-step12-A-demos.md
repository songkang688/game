# 1.1 step12 · A 号任务：发行版演示片

目标：给 1.1.0 发行版补 2～3 条关键演示短片，放进仓库 `docs/demos/`，并在根 README 增加「演示」一节。

## 要拍的片子

| 文件 | 内容 | 时长目标 |
| ---- | ---- | ---- |
| `docs/demos/demo-home.mp4` | 首页：55 款 / 188 关气泡、分类页签、玩法芯片、搜索、点进一张卡片 | 15～40 秒 |
| `docs/demos/demo-rainbow-run.mp4` | 彩虹跑跑 2.5D 三车道：跳跃 / 换道 / 透视跑酷 | 15～40 秒 |
| `docs/demos/demo-duo.mp4` | 双人玩法：朵星双人冲刺 2.5D 分屏 或 冰冰火火森林双人同屏 | 15～40 秒 |

## 做法

1. `npm run build` 出 `dist/`，再 `npm run preview` 起本地服务，贴近发行版真实表现。
2. 用无头 Chromium 驱动页面（脚本化点击 / 键盘），录制原始视频。
3. `ffmpeg` 转 H.264 + yuv420p（`faststart`），每条压到 < 15MB，三条合计 < 40MB。
4. README 在开篇引用块之后、「🎮 游戏清单」之前插入「## 演示」一节，相对链接指向三个文件，各配一句中文说明。

## 边界

- 只动 `docs/demos/`、`docs/DEMOS.md`、`docs/plan-1.1-step12-A-demos.md`，以及 README 新增的「演示」一节。
- 不碰 `src/`、`package.json`、`.github/`、`scripts/`、`electron/`、`android/`、`vite.config.ts`、`index.html`。
- `release/`、`dist/` 绝不进 git。
- 不打 tag、不改 CI、不合并回 main。
