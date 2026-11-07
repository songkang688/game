# 1.4 · 单款游戏全科工序规格（工人通用；窗口派工时整份粘贴，替换 `{{ID}}` / `{{WINDOW}}` / `{{BRANCH}}` / `{{TICKET}}`）

> 你是被派到 **`{{ID}}`** 的执行工人，工单 **{{TICKET}}**（`t1` = 工序 A+B+C；`t2` = 工序 D+E+F；`t2a` / `t2b` 为拆分版）。
> 总纲与红线：`docs/plan-1.4-supervisor.md`（第五节逐条生效）。工作分支 **`{{BRANCH}}`**，只推它。你就是执行者，禁止再派生任何子代理。

## 〇、开工（先做完再动代码）

1. `node -v`（需 ≥ 22；没有就装 Node 22 LTS）→ `npm ci`。
2. `git fetch origin game-1.4 {{BRANCH}}` → `git checkout -B {{BRANCH}} origin/{{BRANCH}}`（远端没有则 `origin/game-1.4`）→ `git rebase origin/game-1.4`。
3. 先交一条只含计划的 commit：`docs/qa/1.4/{{ID}}-plan.md`（工单、打算动的文件、预计新增测试）。
4. 必读（动笔前读完，回复里写明参考了哪几条）：
   - `docs/plan-1.4-supervisor.md` 第一、二、五节；`docs/plan-1.3-visual-bible.md` 二至七节；`docs/ux-iteration-playbook.md` 第〇、八、十四节（滚动容器权属、l99 内 sticky 失效、高度反推钳、`min-height:501` 阶梯）。
   - `.cursor/skills/gamedev/`：`game-feel/SKILL.md`、`game-ui-ux/SKILL.md`、`level-design/SKILL.md`、`procedural-gen/SKILL.md`、`game-design-theory/SKILL.md`（只借方法，代码全部 TypeScript + Canvas 2D 自己写）。
   - `src/games/{{ID}}/` 全部源码与现有测试；`src/games/level99.ts`（若该款走 188 框架）；`src/games/__tests__/campaignSim.ts`、`canvasDom.ts`。
   - `rg -n "{{ID}}" docs/qa | head -80`：历史 QA 对该款开过的号（N- / U- / C- 系列）与降级台账，已结案的不重做、不加第二套垫。
5. 跑一遍现状：`npx vitest run src/games/{{ID}}` 必须先绿；`npm run build` 后 `npx vite preview --port 4173`，用无头 Chrome（`puppeteer-core` 临时装，`--no-save`）在 **五视口** 390×844 / 768×1024 / 1024×768 / 1180×820 / 915×412 打开 `#/game/{{ID}}`，截图留 `/tmp`。要进深关：首页 🔑 密码门只走 UI（口令见 `docs/qa/trio-r19-learn-notes.md`），**不种 storage**。

## 一、工序 A · 全科体检（只写报告，不改代码）→ `docs/qa/1.4/{{ID}}-audit.md`

按下表逐项给出**有编号、有证据（文件:行 或 视口数字 或 复现步骤）、有优先级**的发现，≥ 12 条；没有问题的项也要写「查过，无」。

| 维度 | 必查点 | 优先级口径 |
| --- | --- | --- |
| 跳不过去 / 卡死 | L1、每章首关、第 99 → 100 关、L188、无尽 / 对战首局：能否开始、能否结束、能否失败后重试、能否返回；是否有关卡目标在时限 / 资源内数学上不可达 | **P0** |
| Bug | 控制台报错、`destroy()` 后定时器 / 监听残留、暂停后恢复、窗口 resize、双人同屏键位互抢、音效重复、存档读写异常、`?level=` 直开、root 直达 | P0 崩溃 / P1 其他 |
| 不合理 | 规则前后不一致、反馈缺失导致不知道为什么输、随机导致无解（抽牌 / 布雷 / 洗牌）、AI 档位倒挂、三星门槛与一星门槛颠倒 | P1 |
| 手感（game-feel） | 命中 / 落地 / 拾取 / 死亡 / 胜利 / 按钮各自有几层反馈；是否线性 tween；shake 是否动了实体坐标；hit-stop 是否有、是否能还原；reduced-motion 是否尊重 | P2 |
| UI/UX（game-ui-ux） | 唯一 CTA 首屏可见；屏幕栈（菜单 → 关内 → 暂停 → 结算）是否布尔旗；初始焦点与键盘导航；五视口 HARD-OUT；热区 44；正文 16 / HUD 14；画布内菜单是否 DOM 不可测 | P2（HARD-OUT 为 P0） |
| 关卡曲线（level-design） | 参数随关号是否锯齿上升而非直线 / 倒挂；新机制是否「安全处教 → 练 → 考」；第 99/100 拼接处跳变；章节首关是否比上章末关难太多 | P3 |
| 程序化（procedural-gen） | 是否单一 seeded RNG 贯穿、有无全局 `Math.random` 混入生成；生成后有无校验（可解 / 连通 / 出生安全）；版本更新 seed 是否漂 | P3（无解为 P0） |
| 建模 / 视觉（宪法） | 火柴人 / 色块金币 / 1px 障碍 / 无体积角色 / 缺呼吸眨眼 / 缺受伤胜利表情 / BOSS 无仪式 / 双人 A/B 不可分 / 共享角色没走 kit | P4 |
| 纵深定级 | 给出 精 2D / 2.5D / 伪 3D 的建议与一句理由（判据：纵深会不会改变玩家判断） | 建议项 |

报告末尾给「工单 1 修复清单」（P0/P1 全部 + 能顺手的 P2）与「工单 2 清单」（P2–P4）。

## 二、工序 B · 188 关可通关审计（必做，先红后绿）→ `src/games/{{ID}}/levels.audit.test.ts`

1. **能模拟的就模拟**：用 `src/games/__tests__/campaignSim.ts` 的 `runCampaign`，写一个「固定策略机器人」`play(idx, rng)`——只用玩家确实能做的操作、普通小学生的反应速度（点击间隔 ≥ 250 ms、反应延迟 ≥ 200 ms、不预判），跑全部 188 关 × 种子 `[1, 2, 3]`（`mode: "any"`：任一种子能赢即通过；**P0 判定用 `"all"` 跑一遍并把差异写进报告**）。`expect(report.failures, formatReport(report)).toEqual([])`。
2. **不好模拟的做可行域静态校验**（答题 / 棋类 / 养成）：对 `levels.ts`（或 `quiz99.ts` 出题器）每一关断言：时限 × 可达操作频率 ≥ 目标；出题范围与年龄段一致；题库在该关参数下至少能出 ≥ 3 道不重复题；棋类残局 / 人机档位：AI 可在步数上限内结束、残局有解（用现有引擎自对弈 / 求解器验证）。
3. **程序化盘面必校验**：扫雷首点安全 + 可推理（或至少布雷不堵死）、数独唯一解、连连看至少一条可消路径且不会中途死局（或有洗牌保底）、翻牌配对为偶数且图案成对、拼图可还原、2048 / 合成目标在步数预算内可达、迷宫起终点连通、泡泡 / 砖块关卡可清空。
4. **曲线断言**：核心难度参数对关号的「锯齿上升」——相邻关最多回落一档、章首不得比上章末跳 >1.5×、第 100 关不得比第 99 关跳 >1.3×（数字写成常量放测试顶部并注释依据）。
5. 发现失败：**改 `levels.ts` 数值或生成器**使其通过，提交信息写「fix(levels): {{ID}} 第 N 关 … 失败清单 k → 0」，并在 audit.md 附前后对比；前 99 关的改动单独列。不许靠放宽机器人能力或删断言「修」测试。

## 三、工序 C · Bug 与不合理修复

按 audit 的 P0 → P1 顺序，**每修一处一个 commit**，每处配一个回归测试（复现 → 修复 → 测试绿）。常见修法：
- `destroy()` 必须清掉 rAF / `setInterval` / `addEventListener(window|document)` / `matchMedia` 监听 / 音频节点；写「挂载 → 销毁 → 无残留」测试。
- 暂停：游戏时钟与真实时钟分离，恢复时不吞输入、不补帧爆发。
- 双人键位：A 用 `WASD`+`J/K`，B 用方向键+数字小键盘或 `,./`；按下集合零交集；写键位冲突测试（已有 `window1-keyrepeat.test.ts` 可参照）。
- 随机无解：生成后校验不过就重生成（计数上限）或修复（补一对 / 换一子），seed 依旧确定。
- 「不知道为什么输」：失败面板写明原因（孩子能懂的一句话 + 鼓励），不批评。

## 四、工序 D · 手感（需 `src/art/kit/feel.ts` 已在 `origin/game-1.4`；没有就先做 E/F，并在回复里写明）

1. 列事件表：本款所有离散事件（命中 / 被击 / 落地 / 拾取 / 过关 / 失败 / 连击 / BOSS 登场 / 按钮）→ 分档 `small` / `medium` / `large`（脚步与普通点击不配 shake、不配 hit-stop）。
2. 每个事件一次 `feedback(tier, io)`：音效走 `api.play`（已有 7 个合成音，别加音频文件）、粒子走 `art/kit/fx.ts` 的 `makeCollectBurst` / `drawSparkle` 或本款已有粒子、shake 走 `Trauma` + `applyCameraShake`（**只动相机变换**）、hit-stop 走 `HitStop`（游戏循环按 `step(realDt)` 的 timeScale 缩放游戏 dt）。
3. 所有缩放 / 位移 / HUD 数字变化走缓动（`ease.outBack` 弹、`ease.outCubic` 收），禁止线性；计分 +N 用 `drawPlusOne`。
4. reduced-motion：`prefersReducedMotion()` 为真时 `feedback` 自动降级，另加一处可见反馈（颜色 / 文案）不丢信息。
5. 契约测试 ≥ 6 例：事件触发 → `trauma.value > 0`；`reduced=true` → `offset` 全 0 且 `hitStop.active=false`；同一事件连触发不叠加到 >1；按钮点击触发 `popElement`。

## 五、工序 E · UI/UX

1. **屏幕栈**：菜单 / 关内 / 暂停 / 结算用显式状态 + 栈（push/pop），不再用多个布尔旗；返回键 / Esc 弹栈；每个屏幕打开时设初始焦点（第一颗 CTA），Tab / 方向键可遍历，`:focus-visible` 可见。
2. **五视口**：用 `scripts/qa/measure-viewports.mjs`（窗口 1 固化后在 `origin/game-1.4`；没有就临时写等价脚本放 `/tmp`）量所有可交互元素，口径 = `getBoundingClientRect` + 裁切祖先链 + `scrollIntoView` 后 reach。HARD-OUT 必修；修法只许军规两条路：**钳内容高（高度反推钳：`max-width:min(100%, calc((100dvh - CHROME) * 列 / 行))`）** 或 **l99 内 `position:fixed` 钉视口底**；新加媒体档一律 `(max-height:840px) and (min-height:501px)` / `(max-height:900px) and (min-height:841px)` 阶梯，**不改 500 档原文**。
3. 热区 ≥ 44×44（盘面观察格豁免，盘外按钮不豁免）、正文 ≥ 16px、HUD ≥ 14px、对比度 ≥ 4.5:1、`env(safe-area-inset-*)`。
4. HUD 事件驱动：分数 / 生命 / 倒计时由事件更新，不在 rAF 里每帧写 DOM。
5. **画布内菜单款**（开始菜单画在 canvas 里）：改为 DOM 覆盖层按钮，或至少暴露 `data-menu-state` + 键盘 / 点击命中的纯函数并写测试，让 QA 量得到。
6. 守门测试：新增媒体档存在性 + 热区 min-height 断言；先 `rg` 该款已有 `*.test.ts` 里对 CSS 原文的 `toContain`，不破坏它们。

## 六、工序 F · 建模 / 视觉

1. 对照宪法第二至四节逐实体过：主角 / 敌人 / BOSS / 收集物 / 障碍 / 背景层——火柴人、色块金币、1px 障碍、无体积角色**清零**；三阶光影（底色 + 暗部 + 高光）；收集反馈；BOSS 出场仪式（横幅 + 一次 medium shake + 元气条展开）。
2. 角色动画底线：待机呼吸（≤ 4%）+ 眨眼 + 朝向翻转（配饰方向对）+ 受伤表情（眩晕圈）+ 胜利表情（笑 + 跳 / 撒花）。朵朵 / 星星必须 `import` `src/art/kit/chars.ts`，不自画。
3. 画面密度：中景装饰 + 近景反馈，HUD ≤ 3 组。双人款 A/B 剪影 + 主色 + 配饰三层不同。
4. 素材契约测试新增 ≥ 8 例（`FakeCtx2D` 记账：绘制调用 > 0、色值合法、A/B 主色不等、reduced 分支无粒子）。
5. 360px 宽实机缩放下主体 ≥ 32px 高且五官可辨。

## 七、收尾（每张工单）

```bash
git fetch origin {{BRANCH}} game-1.4
git rebase origin/{{BRANCH}}        # 冲突保留本窗口文件版本；禁止 force
npm test -- --testTimeout=180000 && npm run build
rg -i "<黑名单>" src/ README.md --glob '!.cursor/skills/**'   # 0 命中
git push origin HEAD:{{BRANCH}}
```

回复按总纲第 6.3 节格式；`docs/qa/1.4/{{ID}}-audit.md` 末尾追加「工单 {{TICKET}} 完成记录」：改了什么、测试数前后、五视口数字、未做项与需求单。
