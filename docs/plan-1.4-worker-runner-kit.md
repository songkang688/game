# 1.4 · 窗口 5 基建工单 · 跑道 / 透视统一 `src/art/runner/` + `src/engine/view25d.ts`（整份粘贴给工人）

> 你是窗口 5 的基建工人（工单 `w5-infra-runner`）。工作分支 **`game-1.4-window5`**，只推它。你就是执行者，禁止再派生任何子代理。
> 总纲红线：`docs/plan-1.4-supervisor.md` 第五节；宪法第五节「禁止 three.js、禁止第二套透视数学」。

## 现状（主管实测）

- `src/art/runner/`（`track.ts` / `sky.ts` / `sprites.ts` / `speedfx.ts`，1.3 第 1 步 C 产出）**没有任何游戏 import**。
- 四套私有透视：`rainbow-run/view3d.ts`（9.4 KB，`scale = camDepth/(camDepth+depth)`）、`duo-rush/view25d.ts`（8 KB）、`gold-hook/depth12.ts`（15.7 KB）、`sling-birds/depth12.ts`（18.4 KB）。
- `engine/view25d.ts` 已有：`defaultCamera / project / scaleAtDepth / horizonY / roadQuad / fogAlpha / groundGridDepths / respectReducedMotion / prefersReducedMotion / installView25dCss`。

## 目标

全仓只剩 **一套** 透视数学（`engine/view25d.ts`）与 **一套** 观感层（`art/runner/`）。四款私有实现改成薄适配层；玩法坐标一个数不动；`rainbow-run/logic.test.ts` 的 `runCampaign`、`duo-rush` / `gold-hook` / `sling-birds` 的现有逻辑测试全绿不改——这是「可通关性零漂移」的证据。

## 独占文件

`src/engine/view25d.ts`（只加不删；旧导出签名不变）、`src/engine/view25d.test.ts`、`src/art/runner/**`（含新建 `camera.ts` / `adapter.ts` / 各 `*.test.ts`）、以及四款游戏里**仅限**：`rainbow-run/view3d.ts`、`duo-rush/view25d.ts`、`gold-hook/depth12.ts`、`sling-birds/depth12.ts` 及它们的直接测试文件。这四款的 `index.ts` / `logic.ts` / `levels.ts` 本工单**不碰**（它们的工单 1/2/3 另派）。`docs/qa/1.4/infra-runner.md`。

## 要做的

1. **盘点差异**：四套私有实现各自的相机模型（地平线比例、相机距离、最大 / 最小缩放、车道展宽、雾化曲线、阴影压扁）列成表，写进 `docs/qa/1.4/infra-runner.md`；找出 `view25d` 缺的能力（例如 rainbow-run 的「玩家身后负深度放大」、gold-hook 的「钩绳沿深度的透视折线」、sling-birds 的「抛物线落点深度」）。
2. **补能力到共享层**（`engine/view25d.ts` 只加函数 / 可选参数；`art/runner/camera.ts` 新建）：统一 `Camera` 结构（兼容旧 `View25dCamera`）、`projectPoint(cam, x, y, z)`、`negativeDepthScale`、`laneX`、`depthShadow`、`fogTint` 等；每个新函数 ≥ 3 例测试（边界、单调性、reduced）。
3. **适配层替换**：四个私有文件改为调用共享层的薄包装（保留原导出名与签名，内部转发），删除重复数学；文件头注释写明「1.4 起转发到 engine/view25d + art/runner」。每替换一款：`npx vitest run src/games/<id>` 全绿、无头 Chrome 对比替换前后同一帧截图（`/tmp`，像素差 < 2% 或说明合理差异）。
4. **套件补齐伪 3D 观感四件套 + 两件**：透视跑道（`drawTrack`，支持 1–4 车道与直线 / 弯道）、深度缩放精灵（`drawAtDepth` + 阴影）、分层视差天空（`drawSky`）、雾化（`fogAlpha`）；加 **地面网格滚动**（`groundGridDepths` 已有，补 `drawGroundGrid`）与 **镜头微倾 / 落地抖**（`cameraNudge` 已有，接 `feel.ts` 的 `Trauma` 若已合入）。全部 `reduced` 降级：无视差漂移、无网格滚动、无抖。
5. **接入指南**（`docs/qa/1.4/infra-runner.md` 第二节，≤ 80 行）：非跑酷款怎么只用「深度精灵 + 雾化」两件（投掷 / 球道 / 跳台），跑酷款怎么用全套；给 `red-blue-race` / `bumper-cars` / `bowling-lane` / `poop-hero` / `hop-pads` / `snow-fight` 各写 5 行「建议接法」。

## 测试

- `view25d.test.ts` 与 `art/runner/*.test.ts` 新增合计 ≥ 40 例（记账 ctx，不碰真 DOM）。
- 四款游戏现有测试文件一条断言不改、全绿。
- 守门：新增一条源码扫描测试 `src/art/runner/noPrivatePerspective.test.ts`：`src/games/**` 非测试文件里不得再出现 `camDepth / (camDepth +` 或 `horizonY + (` 这类私有透视公式（白名单仅四个适配文件且其内容必须 import 共享层）。

## 收尾

```bash
git fetch origin game-1.4-window5 game-1.4 && git rebase origin/game-1.4-window5
npm test -- --testTimeout=180000 && npm run build
git push origin HEAD:game-1.4-window5
```

回复按总纲 6.3 格式，附四款替换前后截图像素差与 `runCampaign` 报告摘要。
