/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 内容要与游戏实现保持一致,不要在这里 import 任何玩法代码。
 */
export const meta = {
  id: "sky-squad",
  title: "飞机小队",
  emoji: "✈️",
  category: "action" as const,
  color: "#dbeaff",
  blurb: "188 关八片天空,机翼下三层云海各飘各的!八种看得懂的弹幕图案,判定点只有中间一小丁点,每章一位三段大 Boss。",
  // index.ts 的四个入口:188 关战役 / 云海远征(无尽)/ 双人合作合流波 / 双人同屏各飞各的
  modes: ["campaign", "endless", "coop", "twoPlayer"] as const,
  levels: 188,
  // 实测:手机 360px 拖着飞(飞机停在手指上方 40px),桌面键盘双人同屏,两边都能玩
  platform: "both" as const,
};
