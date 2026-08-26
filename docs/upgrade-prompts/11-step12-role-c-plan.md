# 1.1 第 12 步 · 角色 C 开工记录(无障碍 + 壳层)

- 分支基线:`origin/game-1.1` @ `213bf39`,工作分支 `cursor/step12-c-a11y-shell-5500`,最终推回 `game-1.1`。
- 独占文件:`src/styles.css`(尽量只追加)、`src/ui/dialogs.ts`、`src/ui/gameShell.ts`、
  `index.html`、新建 `src/ui/contrast.ts` 与 `src/ui/a11y.test.ts`。
- 明确不碰:`src/ui/home.ts` / `recent.ts` / `src/engine/types.ts` / 各游戏 `meta.ts`(归 A)、
  各游戏 `index.ts` 文案与 `guide.ts`(归 B)、任何游戏的 `logic.ts` / `levels.ts`。
  `src/games/level99.ts` 的函数体不动;选关地图热区只在 CSS 类名或 `L99_CSS` 里改尺寸数值。

## 七件事

1. **对比度**:正文与次要文字对白底 / 卡片底 ≥ 4.5:1,大字号 ≥ 3:1。
   `--ink-soft` 一类偏浅的变量该加深就加深,关键色对写进单测。
   计算放纯函数模块 `src/ui/contrast.ts`(sRGB → 相对亮度 → 对比度)。
2. **键盘可达**:首页卡片 / 页签 / 筛选芯片 / 搜索框 / 游戏内按钮 / 选关地图格子 /
   攻略抽屉 / 家长门全部 Tab 可达,统一 `:focus-visible` 描边;
   弹窗焦点陷阱 + `Esc` 关闭,关闭后焦点回到触发元素。
3. **语义**:`role` / `aria-label` / `aria-pressed` / `aria-modal` / `aria-live`
   (分数与胜负要播报);`index.html` 的 `lang="zh-CN"` 与 `meta description` 校订。
4. **响应式**:320 / 375×667 / 768 / 1280×800 四个断点不溢出、无横向滚动;
   选关地图触控热区 ≥ 44px。
5. **`prefers-reduced-motion`**:关掉位移 / 抖动 / 闪烁类动画。
6. **暂停面板统一**:继续 / 重玩 / 攻略 / 音效 / 回首页,`Esc` 统一暂停;
   `getLevelExtras().mountGuide` 没注册时隐藏攻略按钮。
7. **测试**:新建 `src/ui/a11y.test.ts`,用例 ≥ 20。

## 验收

- `npm test` 全绿且用例只增不减;`npm run build` 全绿。
- 不出现任何商业商标 / 官方角色名;文案约小学六年级水平,粉彩萌系。
