# 三人组第 18 轮 · 测试修复员 B（休闲 / 对战 / 动手）

> 父监督战役 trio-r18 / UX-99 wave1。基线 `origin/game-1.3` @ `10022068`（含 r17 A N-89 壳标题收高）。
> 范围：休闲 / 对战 / 动手独占目录。**不碰** `src/styles.css`、`src/ui/home*`、level99/quiz99 学习款（A 的地盘），不碰 r17 B 在途的 tap-tiles / fruit-catch（N-90/N-91）。
> 红线：不改存档 key / `meta.id` / 题库 / seed / 胜负；测试只增不减；禁 force。

## 计划（进场先写）

主验收 915×412 `getBoundingClientRect`；每项另抽 390×844 竖屏（能划到底、CTA 不裁、触区 ≥44）；再抽 360×800。
管理员门密码 `kangkang`(默认 1 小时)开/关各独立 context 验证解锁差异。

1. **N-87 duo-rush 模式菜单 CTA**：已合 `30cc10ab` → 只回归 390+915。赛道 `.dr-btns` sticky 禁止回退。
2. **N-88 fight-king 双人选人「开打 ▶」**：已合 `30cc10ab` → 只回归。必须点「双人对战」后量，不拿训练场结案。
3. **N-86 brave-path 大厅模式卡**：已合 `7a2d560b` → 只回归（≠ N-32 无尽战斗三钮）。
4. **N-75…N-85**：源码已合 PR #78。逐款 915 实测留数字；r15 未稳定进局的 N-79/81/82 与降级的 N-83 确认行本轮补进局实测,未绿则修。
5. **N-60/61/62** orb/snake-royale/merge-2048 贴线（再垫 ~28px,禁改 `*_SHORT_PANE_H=200` 守门）；**N-12** pool-stars 矮横屏无媒体;**N-10** weiqi-garden 工具列;**N-3** star-estate 地格;**N-55** snow-fight 对战十二键。
6. 全面横扫：分屏双人、暂停套娃、横屏按钮出屏、竖屏划不动。

完成定义：`npm run build && npx vite preview --port 4173` + chrome + puppeteer-core;水位只增不减(进场以主干最新为准);每条留数字;报告本文件;PR → game-1.3。

## 进场水位

（待补：npm test / build 结果）

## 915×412 实测

（待补）

## 390×844 / 360×800 抽验

（待补）

## 本轮已关

（待补）
