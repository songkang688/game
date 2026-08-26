/**
 * 地鼠嘭嘭的纯逻辑：提示语、爱心规则、月光圈范围、评星与结算文案。
 * 全是纯函数，不碰 DOM，方便单测直接调。
 */
import type { MoleLevel } from "./levels";

/** 一轮结束时交给外面的战报 */
export interface RoundResult {
  won: boolean;
  score: number;
  mistakes: number;
  timeLeft: number;
  bestCombo: number;
}

/** 本关的玩法提示：有哪些机关就说哪几句 */
export function levelTips(cfg: MoleLevel): string {
  const tips: string[] = [];
  if (cfg.quizChance) tips.push("🧮 只拍得数对得上的那只");
  if (cfg.sleepyChance > 0) tips.push("😴 瞌睡鼠待得久");
  if (cfg.goldChance > 0) tips.push("🌟 金地鼠一只顶两只");
  if (cfg.shieldChance) tips.push("🪖 铁盔鼠要连打两下");
  if (cfg.comboTarget) tips.push(`🔥 连拍 ${cfg.comboTarget} 只进入嘭嘭时间`);
  if (cfg.night) tips.push("🔦 跟着月光圈找地鼠");
  if (cfg.bunnyChance > 0) tips.push("🐰 小兔子不能拍");
  return tips.length > 0 ? tips.join("；") + "！" : "地鼠冒头就拍它！";
}

/** 本关是否要显示爱心（会扣心的关才显示） */
export function usesHearts(cfg: MoleLevel): boolean {
  return cfg.bunnyChance > 0 || (cfg.quizChance ?? 0) > 0;
}

/** 夜视关的月光圈：中心洞 + 上下左右，3×3 棋盘上一共照亮 3~5 个洞 */
export function torchHoles(center: number): number[] {
  const c = ((Math.round(center) % 9) + 9) % 9;
  const r = Math.floor(c / 3);
  const col = c % 3;
  const out = [c];
  if (r > 0) out.push(c - 3);
  if (r < 2) out.push(c + 3);
  if (col > 0) out.push(c - 1);
  if (col < 2) out.push(c + 1);
  return out.sort((a, b) => a - b);
}

/** 过关星级：不失误又留下余裕给 3 星 */
export function roundStars(result: RoundResult, duration: number): 1 | 2 | 3 {
  const frac = duration > 0 ? result.timeLeft / duration : 0;
  if (result.mistakes === 0 && frac >= 0.12) return 3;
  if (result.mistakes <= 1) return 2;
  return 1;
}

/** 过关时的一句夸奖 */
export function winLine(cfg: MoleLevel, result: RoundResult): string {
  if (cfg.quizChance) return `${cfg.target} 分算式全拍中，脑子和手一样快！`;
  if (cfg.shieldChance) return `铁盔鼠也挡不住你，还剩 ${result.timeLeft} 秒！`;
  if (cfg.night) return `摸黑也能拍准，${result.timeLeft} 秒就收工啦！`;
  if (cfg.comboTarget) return `拍中 ${cfg.target} 分，最长连拍 ${result.bestCombo} 只！`;
  return `拍中 ${cfg.target} 分，还剩 ${result.timeLeft} 秒，好快的手！`;
}

/** 没过关时的一句话（只鼓励，不批评） */
export function loseLine(cfg: MoleLevel, result: RoundResult): string {
  if (result.mistakes >= 3) {
    if (cfg.quizChance) return "算式有点绕，慢半拍先算清楚再出手，就稳了～";
    return "小兔子被拍到三次啦，下次看清楚再出手～";
  }
  return `时间到，拍到了 ${result.score} 分，再快一点点就赢了！`;
}
