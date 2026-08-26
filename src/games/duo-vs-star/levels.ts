/**
 * 朵朵大战星星 · 188 关闯关表（10 个主题章节）。
 *
 * 每章对应一张场地，关卡按「对手人数 → 对手档次 → 特殊规则」三条线往上走：
 * 前几关是一对一慢慢练手，中段开始出现三人乱斗、限时守擂、无道具硬碰硬，
 * 章末是本章的「守场大将」。第 10 章把所有机关凑到一张图上收尾。
 */
import type { AiTier } from "./ai";
import type { Chapter } from "../level99";
import { ROSTER, fighterAt } from "./roster";
import { STAGES } from "./stages";

export interface LevelFoe {
  charId: string;
  tier: AiTier;
  /** 挥击力度加成 */
  powerBonus?: number;
  /** 这一位的上场机会 */
  stocks?: number;
}

export interface DuoLevel {
  stageId: string;
  /** 对手（1..3 位） */
  foes: LevelFoe[];
  /** 队友（0 或 1 位，2v2 组队关才有） */
  allies: LevelFoe[];
  /** 你的上场机会 */
  playerStocks: number;
  /** 限时（秒），0 = 不限时 */
  timeLimit: number;
  /** 道具间隔（秒），0 = 本关没有道具 */
  itemEvery: number;
  /** 限定道具池 */
  itemPool?: string[];
  /** 规则短标签，显示在关卡头部 */
  ruleTag: string;
  /** 规则一句话说明 */
  rule: string;
}

export const CHAPTERS: Chapter[] = [
  {
    name: "云朵广场",
    emoji: "☁️",
    color: "#E4F1FF",
    desc: "平平整整的练手场：先摸清挥击、跳跃和「击退值越高飞越远」。",
    size: 19,
  },
  {
    name: "摇摇浮岛",
    emoji: "🏝️",
    color: "#F2ECFF",
    desc: "浮岛站久了会散开，学会随时换地方站。",
    size: 19,
  },
  {
    name: "传送带工厂",
    emoji: "🏭",
    color: "#E2F0FF",
    desc: "地板一直往边上送，得一边逆着跑一边打。",
    size: 19,
  },
  {
    name: "弹簧糖果地",
    emoji: "🍬",
    color: "#FFE8F2",
    desc: "落地就被弹起来，空中对拼成了主旋律。",
    size: 19,
  },
  {
    name: "咕嘟糖浆池",
    emoji: "🍯",
    color: "#FFF0DC",
    desc: "糖浆一点点涨上来，越往后越要往高处抢位置。",
    size: 19,
  },
  {
    name: "呼呼风车原",
    emoji: "🌬️",
    color: "#E6FAF0",
    desc: "空中一直刮风，跳出去之前先算好风把你吹到哪。",
    size: 19,
  },
  {
    name: "滑滑冰湖",
    emoji: "⛸️",
    color: "#E8F6FF",
    desc: "冰面刹不住车，提前松手才是本章的功课。",
    size: 19,
  },
  {
    name: "星光升降台",
    emoji: "🛗",
    color: "#EFE6FF",
    desc: "台子上上下下，追人要挑台子最低的那一刻。",
    size: 19,
  },
  {
    name: "夜空跳台",
    emoji: "🌙",
    color: "#E9E6FF",
    desc: "落脚点很小，被撞出去还能靠二段跳飘回来。",
    size: 19,
  },
  {
    name: "全明星决战场",
    emoji: "🏟️",
    color: "#FFE6EE",
    desc: "机关全开、弹飞线又近，十二位好朋友轮番上阵。",
    size: 17,
  },
];

/** 十种关卡花样，按章节内序号轮着来 */
const RULE_CYCLE = [
  { tag: "标准赛", rule: "常规规则：把对手撞出场外，撑到最后就赢。" },
  { tag: "道具场", rule: "道具掉得特别勤，抢到锤子就是你的机会。" },
  { tag: "素手赛", rule: "本关没有道具，纯靠走位和挥击的时机。" },
  { tag: "限时赛", rule: "时间一到就按剩余上场机会算成绩，别拖。" },
  { tag: "一击定", rule: "双方都只有一次上场机会，掉一次就结束。" },
  { tag: "三人乱斗", rule: "场上三个人各打各的，别被人捡了便宜。" },
  { tag: "守擂赛", rule: "对手上场机会更多，你得稳扎稳打。" },
  { tag: "轻道具", rule: "只掉锤子、护盾泡泡和加速羽毛这三样。" },
  { tag: "组队赛", rule: "和队友组成两人小队，一起把对面两位请出场。" },
  { tag: "大将战", rule: "本章守场大将登场，力气比前面的对手更大。" },
];

const LIGHT_POOL = ["hammer", "shield", "feather"];

function tierFor(ci: number, t: number): AiTier {
  const score = ci * 2 + t / 6;
  if (score >= 13) return "hard";
  if (score >= 5) return "normal";
  return "easy";
}

function buildLevel(ci: number, t: number, size: number): DuoLevel {
  const stageId = STAGES[ci % STAGES.length].id;
  const cycle = RULE_CYCLE[t % RULE_CYCLE.length];
  const isBoss = t === size - 1;
  const spec = isBoss ? RULE_CYCLE[9] : cycle;
  const baseTier = tierFor(ci, t);
  // 第一章是上手坡道：对手先让着点，力度从七成一路加回到十成
  const warmup = ci === 0 ? 0.7 + 0.3 * (t / Math.max(1, size - 1)) : 1;
  const bonus = (1 + ci * 0.018 + t * 0.004) * warmup;

  // 对手人数：章节越靠后越容易出现两三个人
  let foeCount = 1;
  if (spec.tag === "三人乱斗") foeCount = 2;
  else if (spec.tag === "组队赛") foeCount = 2;
  else if (ci >= 4 && t % 5 === 2) foeCount = 2;
  if (ci >= 7 && t % 9 === 7) foeCount = 3;
  if (isBoss) foeCount = ci >= 6 ? 2 : 1;

  const foes: LevelFoe[] = [];
  for (let k = 0; k < foeCount; k++) {
    const charId = fighterAt(ci * 3 + t + k * 5).id;
    const tier: AiTier = isBoss && k === 0 ? bossTier(baseTier) : baseTier;
    foes.push({
      charId,
      tier,
      powerBonus: Number((bonus * (isBoss && k === 0 ? 1.12 : 1)).toFixed(3)),
    });
  }

  const allies: LevelFoe[] =
    spec.tag === "组队赛"
      ? [{ charId: fighterAt(ci * 3 + t + 9).id, tier: baseTier, powerBonus: 1 }]
      : [];

  let playerStocks = 3;
  let foeStocks = 3;
  let timeLimit = 0;
  let itemEvery = 7.5 - ci * 0.25;
  let itemPool: string[] | undefined;

  switch (spec.tag) {
    case "道具场":
      itemEvery = 3.2;
      break;
    case "素手赛":
      itemEvery = 0;
      break;
    case "限时赛":
      timeLimit = 60;
      break;
    case "一击定":
      playerStocks = 1;
      foeStocks = 1;
      timeLimit = 70;
      break;
    case "三人乱斗":
      playerStocks = 3;
      foeStocks = 2;
      break;
    case "守擂赛":
      foeStocks = 4;
      break;
    case "轻道具":
      itemPool = LIGHT_POOL;
      itemEvery = 5;
      break;
    case "组队赛":
      playerStocks = 3;
      foeStocks = 3;
      break;
    case "大将战":
      foeStocks = ci >= 6 ? 3 : 4;
      itemEvery = 6;
      break;
    default:
      break;
  }
  // 越往后玩家的容错越少一点点，但至少留 2 条命（一击定关除外）
  if (playerStocks > 1 && ci >= 5 && t % 4 === 3) playerStocks = 2;
  // 第一章前几关再让一手：对手的上场机会比你少，先让新手尝到赢的滋味；
  // 连本章大将也不许比你多，免得第一个大将就把人劝退
  if (ci === 0 && foeStocks > 1) {
    foeStocks = Math.max(1, Math.min(playerStocks, foeStocks - (t < 4 ? 2 : t < 9 ? 1 : 0)));
  }

  for (const f of foes) f.stocks = foeStocks;
  for (const f of allies) f.stocks = playerStocks;

  return {
    stageId,
    foes,
    allies,
    playerStocks,
    timeLimit,
    itemEvery: Math.max(0, Number(itemEvery.toFixed(2))),
    itemPool,
    ruleTag: spec.tag,
    rule: spec.rule,
  };
}

function bossTier(t: AiTier): AiTier {
  if (t === "easy") return "normal";
  return "hard";
}

export const LEVELS: DuoLevel[] = (() => {
  const out: DuoLevel[] = [];
  CHAPTERS.forEach((ch, ci) => {
    for (let t = 0; t < ch.size; t++) out.push(buildLevel(ci, t, ch.size));
  });
  return out;
})();

/** 取第 level 关（0 基），越界自动夹住 */
export function levelAt(level: number): DuoLevel {
  const i = Math.max(0, Math.min(LEVELS.length - 1, Math.round(level)));
  return LEVELS[i];
}

/**
 * 本关的星级：没被撞出去过就是 3 星，掉一次 2 星，掉更多但还是赢了 1 星。
 * `lost` = 玩家这一关一共被撞出去几次。
 */
export function rateLevel(lost: number): 1 | 2 | 3 {
  if (lost <= 0) return 3;
  if (lost === 1) return 2;
  return 1;
}

/** 无尽车轮战：第 round 位对手（0 基）越来越强 */
export function endlessFoe(round: number): LevelFoe {
  const r = Math.max(0, Math.round(round));
  const tier: AiTier = r >= 12 ? "hard" : r >= 5 ? "normal" : "easy";
  return {
    charId: ROSTER[(r * 5 + 3) % ROSTER.length].id,
    tier,
    powerBonus: Number((1 + r * 0.035).toFixed(3)),
    stocks: 1,
  };
}

/**
 * 无尽车轮战的小星星奖励：每连胜 2 场给 1 颗，最多 6 颗。
 * 上限是故意压住的——闯关才是拿星星的主线，车轮战只是零花钱。
 */
export function endlessBonusStars(streak: number): number {
  if (!Number.isFinite(streak) || streak <= 0) return 0;
  return Math.min(6, Math.floor(Math.round(streak) / 2));
}

/** 无尽车轮战第 round 轮的场地 */
export function endlessStage(round: number): string {
  const r = Math.max(0, Math.round(round));
  return STAGES[r % STAGES.length].id;
}
