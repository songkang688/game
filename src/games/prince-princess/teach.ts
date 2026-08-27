/**
 * 王子公主大冒险 · 教学关(纯数据 + 纯函数)。
 *
 * 每一章的第 1 关(第 1 / 29 / 56 / 83 / 110 / 137 / 163 关)是**无风险教学关**:
 *
 *  - 无风险 = 碰到什么都只是「戴上小护盾闪一下」,一颗心都不掉,也不限时。
 *    站着不动一整天都不会输 —— 孩子可以把这一屏看个够再动手。
 *  - 开场 **3 秒**内给一串**图形**提示:两三个表情 + 一行 ≤ 12 个字的短句,
 *    绝不写长句子。看不完还能在攻略抽屉里翻到同一份图例。
 *  - 教的只有**本章的新机制**,不夹带别的。
 *
 * 注意:前 99 关的碰撞数据一个字节都不许改,所以「无风险」是**规则层**的开关
 * (受伤不掉心),不是把怪和尖刺删掉 —— 地形、怪、机关的坐标原封不动。
 */
import { CHAPTERS, indexInChapterOf } from "./levels";
import { ELEMENT_SPECS, type ElementRole } from "./elements";

/** 图形提示亮多久(秒) */
export const TEACH_CUE_SECONDS = 3;
/** 一行提示最多几个字(手机 360px 上不折行) */
export const TEACH_LINE_MAX = 12;

export interface TeachCue {
  /** 章序号 */
  chapterIndex: number;
  /** 图形:两三个表情,先图后字 */
  icons: string[];
  /** 一行短句,≤ TEACH_LINE_MAX 个字 */
  line: string;
  /** 这一章要认的元素角色,照规范表高亮 */
  roles: ElementRole[];
}

/** 一章一条,和 CHAPTERS 一一对应 */
const CUES: Array<Omit<TeachCue, "chapterIndex">> = [
  { icons: ["⚔️", "⭐"], line: "王子挥剑 公主放星", roles: ["hazard", "reward"] },
  { icons: ["🦇", "⭐"], line: "飞得高 交给公主", roles: ["hazard", "stand"] },
  { icons: ["🛡️", "⚔️"], line: "亮壳只有剑打得动", roles: ["hazard", "reward"] },
  { icons: ["☁️", "🪶"], line: "空中按住跳键滑翔", roles: ["stand", "reward"] },
  { icons: ["⚠️", "🦶"], line: "红三角别踩 跳过去", roles: ["hazard", "stand"] },
  { icons: ["❄️", "👻"], line: "地板滑 幽灵吃星星", roles: ["hazard", "checkpoint"] },
  { icons: ["📦", "🔁"], line: "重箱子只有王子推", roles: ["push", "exit"] },
];

/** 这一关(0 基关号)是不是教学关 */
export function isTeachLevel(level: number): boolean {
  return indexInChapterOf(level) === 0;
}

/** 全部教学关的关号(0 基,升序) */
export function teachLevels(): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const ch of CHAPTERS) {
    out.push(acc);
    acc += ch.size;
  }
  return out;
}

/** 这一章的图形提示 */
export function teachCue(chapterIndex: number): TeachCue {
  const ci = Math.max(0, Math.min(CUES.length - 1, chapterIndex));
  return { chapterIndex: ci, ...CUES[ci] };
}

/** 开场 3 秒内亮着 */
export function cueVisible(elapsedSeconds: number): boolean {
  return elapsedSeconds >= 0 && elapsedSeconds < TEACH_CUE_SECONDS;
}

/** 图形提示配套的一行图例(照规范表来,和攻略抽屉是同一份) */
export function cueLegend(cue: TeachCue): string[] {
  return cue.roles.map((role) => `${ELEMENT_SPECS[role].icon} ${ELEMENT_SPECS[role].label}`);
}

/** 教学关顶上那一行小字 */
export function teachBadge(): string {
  return "🎓 练习关 · 不掉心";
}
