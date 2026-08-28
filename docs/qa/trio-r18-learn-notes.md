# 三人组 99 轮战役 · 第 1 轮（trio-r18）· 学习优化员抽验笔记

> 状态：**工作计划已立，抽验进行中**（本节先行提交，交卷时补齐数字）。
> 基线：`origin/game-1.3 = e58ccceb`（含 r17 学习员笔记、r17 A 的 N-89 壳标题收高 `10022068`、UX-99 监督派发表）。
> 模型：`claude-fable-5-thinking-xhigh`。分支 `cursor/trio-r18-learner-c337`。
> **编号**：grep 全部 trio 文档最大号 = **N-91**（r17 学习员）。本工位从 **N-92** 续编。
> 红线：零改 `src/**`；不覆盖 `trio-r14*`/`r15*`/`r16*`/`r17*`；工装 `/tmp` 不进库。

## 工作计划（r18 学习员）

1. 读 `.cursor/skills/1.3-visual/{frontend-design,canvas-design,algorithmic-art,theme-factory,character-sprite-maker}/SKILL.md`、`docs/plan-1.3-visual-bible.md`、`docs/qa/1.3-window*` 与 `1.2-window*` 可迁移配方。
2. 对账：r15–r17 已合项列 ✅ 表，不重派。
3. 无头 puppeteer 抽验 ≥ 8 个**近期 playbook 未测**画面，换抓手：
   - 手机竖屏 **390×844**：关卡地图滚动 / 格子大小 / 底部 CTA 是否被裁；
   - 平板横屏 **1024×768** 与短横 **915×412**；
   - 未覆盖游戏 × 模式 × 视口 × root 开/关 × 覆盖层。
   - 避开已量死面：结算弹窗、N-77 相册、N-87/88、root×钓鱼/花园守卫、r17 三号（tap-tiles / fruit-catch / balloon-pop）。
4. 产出 `trio-r18-playbook.md` 给下一轮测试修复员 A（壳+学习）/ B（休闲对战），写清独占文件、禁止重做、验收视口、完成定义。
5. 收尾：`npm test` 不降水位（文档轮不改测试），rebase `origin/game-1.3` 后 `git push origin HEAD:game-1.3`，草稿 PR base=`game-1.3`。

（下文交卷时补齐：对账表、新发现表 N-92 起、skills 摘记、水位。）
