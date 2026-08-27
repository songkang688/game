/**
 * 矿洞里跳出来的那几句话（纯函数，好断言）。
 *
 * 单独抽一份是为了守分级红线：**无血无伤**。
 * 地鼠被钩上来是「哎呀被逮住啦」，它自己也在笑，不是受伤；
 * 炸药是卡通「砰」的一把彩纸，不是炸伤谁。这两条靠 `copy.test.ts` 钉着，
 * 以后谁顺手改文案改出「炸飞 / 打死 / 受伤」，测试会先拦下来。
 */
import type { OreKind } from "./logic";

/** 一律不许出现的字眼 */
export const BANNED = ["血", "死", "杀", "尸", "伤", "痛", "炸伤", "爆炸", "打爆", "轰"];

export function isClean(line: string): boolean {
  return !BANNED.some((w) => line.includes(w));
}

/** 钩上来一颗东西时说什么 */
export function haulLine(kind: OreKind, label: string, emoji: string, coins: number, treasure: boolean): string {
  if (kind === "mole") return `🐹 哎呀被逮住啦!小地鼠笑嘻嘻地交出 ${coins} 金币`;
  if (kind === "muddy") return `${emoji} ${label}稳稳拉上来 +${coins} 金币`;
  if (!treasure) return `${emoji} ${label} 只值 ${coins} 金币…`;
  return `${emoji} ${label} +${coins} 金币`;
}

/** 双层晶两段各自的话 */
export function twinLine(coins: number, taken: boolean): string {
  return taken ? `🔷 双层晶到手 +${coins} 金币!` : `🔷 外壳裂开啦 +${coins} 金币,里面的晶芯再钩一次!`;
}

/**
 * 用炸药时说什么。
 * 泥泥矿是把泥震掉（固定住），其余是「砰」的一把彩纸把东西送走。
 */
export function bombLine(kind: OreKind): string {
  if (kind === "muddy") return "💥 砰!彩纸一撒,泥被震掉了,这颗泥泥矿不会再滑";
  return "💥 砰!一把彩纸撒开,钩子空了,收得飞快";
}

/** 泥泥矿打滑 */
export function slipLine(): string {
  return "🟤 泥泥矿滑掉啦!它掉回坑里了,先用炸药把它固定住";
}

/** 这一款会往画面上跳的全部句子（测试遍历用） */
export function allLines(): string[] {
  return [
    haulLine("mole", "小地鼠", "🐹", 95, true),
    haulLine("muddy", "泥泥矿", "🟤", 120, true),
    haulLine("gem", "钻石", "💎", 380, true),
    haulLine("boulder", "大石头", "🗿", 16, false),
    twinLine(150, false),
    twinLine(150, true),
    bombLine("muddy"),
    bombLine("boulder"),
    slipLine(),
  ];
}
