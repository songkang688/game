/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不 import 任何玩法代码,改动请同步 index.ts 里的实际内容。
 */
export const meta = {
  id: "box-hamster",
  title: "推箱小仓鼠",
  emoji: "🐹",
  category: "action" as const,
  color: "#FBEFD6",
  blurb: "188 关推箱子!帮小仓鼠把箱子推到脚印上,撤销随便按不扣星,推到墙角还会提醒你;后面有冰面、传送门和双鼠搭档。",
  // levels.ts 七章合计 188 关;index.ts 模式条另有无尽「仓库大挑战」
  modes: ["campaign", "endless"] as const,
  // 十字方向键 44px 热区,手指玩顺;键盘 WASD / 方向键也全套 —— 两边都能玩
  platform: "both" as const,
  levels: 188,
};
