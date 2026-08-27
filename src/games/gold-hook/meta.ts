/**
 * 纯数据 meta:首页 eager 收集本文件渲染卡片,玩法代码留在 index.ts 按需加载。
 * 这里不许 import 任何玩法代码,内容要和 index.ts / levels.ts 的实现保持一致。
 */
export const meta = {
  id: "gold-hook",
  title: "金矿钩钩",
  emoji: "⛏️",
  category: "action" as const,
  color: "#FFECD2",
  blurb: "钩子在矿洞顶来回摆,看准角度放绳!金块钻石宝箱都能钩,还有会打滑的泥泥矿和要连钩两次的双层晶;无尽矿井越深越暗,每五层给一次补给。",
  // 1.2:手感常量(下钩加速、抓到 60–90ms 顿感、空钩快收)、三层视差纵深、
  // 关内商店价钱随章节走、两种新矿、无尽照明圈与补给点,详见 depth12.ts。
  // 对战没做:回合式抓矿同屏对战一个人钩另一个人干等,节奏太慢,不如把纵深做厚。
  modes: ["campaign", "endless"] as const,
  // 实测:键鼠有空格 / ↓ / Enter 放绳、B 用炸药、Esc 暂停;
  // 触屏点画面任意处就放绳,底部一行按钮热区 44px。两边都能完整玩。
  platform: "both" as const,
  levels: 188,
};
