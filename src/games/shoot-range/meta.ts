/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "shoot-range",
  title: "星星射击场",
  emoji: "🎯",
  category: "casual" as const,
  color: "#ffe0ec",
  blurb: "188 关嘉年华靶场!气球飞碟分裂靶护盾靶彩虹靶,连击加成拼命中率;笑脸靶和花朵靶可别打。",
  // 1.2 起四种模式各走各的路,都能打到结算:
  // campaign = 188 关十大靶场;endless = 打不完的靶场(靶子连续上场,跑掉 5 个收工);
  // versus = 双人同屏比分数;twoPlayer = 双人同屏合力够目标分。
  modes: ["campaign", "versus", "endless", "twoPlayer"] as const,
  // 实测:键鼠 WASD/方向键微调准星、F/L 发射、G/K 装星星、Esc 暂停,鼠标指哪打哪;
  // 触屏默认「按下预览 + 抬起发射」,准星画在手指上方 24px,双人两根手指分左右半屏同时玩。
  platform: "both" as const,
  levels: 188,
};
