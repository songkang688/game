/**
 * 窗口 2 第 3 轮走查共用小工具。
 *
 * 走查脚本本身留在仓库里当回归网：商标 / 红线扫描、360px 热区量尺、
 * 各款的胜负与模式走查，都是能反复跑的断言，不是一次性取证脚本。
 */
import { appendFileSync, readFileSync } from "node:fs";

/**
 * 把证据落到流水账里（vitest 默认不回显 console.log）。
 * 只在显式给了 `R3_EVIDENCE=<路径>` 时写盘，平时跑测试不留副作用。
 */
export function dump(title: string, lines: readonly string[]): void {
  const to = process.env.R3_EVIDENCE;
  if (!to) return;
  appendFileSync(to, `\n===== ${title} =====\n${lines.join("\n")}\n`);
}

/** 派发提示词点名的商标黑名单 + 仓库 copy.test.ts 里的常见项 */
export const BRAND_WORDS: readonly string[] = [
  "愤怒的小鸟",
  "愤怒小鸟",
  "植物大战僵尸",
  "水果忍者",
  "地铁跑酷",
  "森林冰火人",
  "屁王兄弟",
  "拳皇",
  "街霸",
  "超级玛丽",
  "马里奥",
  "马力欧",
  "割绳子",
  "俄罗斯方块",
  "tetris",
  "贪吃蛇大作战",
  "球球大作战",
  "我的世界",
  "minecraft",
  "三国杀",
  "大富翁",
  "斗地主",
  "pac-man",
  "pacman",
  "吃豆人",
  "宝可梦",
  "皮卡丘",
  "奥特曼",
  "喜羊羊",
  "蛋仔",
  "原神",
  "王者荣耀",
  "开心消消乐",
  "candy crush",
  "suika",
  "pokemon",
  "zelda",
  "sonic",
  "disney",
  "roblox",
];

/** 面向孩子的红线词（无血无死亡 / 无广告内购上报） */
export const RED_WORDS: readonly string[] = [
  "流血",
  "死亡",
  "杀死",
  "广告",
  "内购",
  "充值",
  "抽卡",
  "上报",
  "登录账号",
];

/** 扫一个游戏目录里的产品代码（跳过 *.test.ts 与 PLAN.md） */
export function scanGame(id: string, files: readonly string[], base: URL): string[] {
  const hits: string[] = [];
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(new URL(`../games/${id}/${f}`, base), "utf8");
    } catch {
      continue;
    }
    const low = text.toLowerCase();
    for (const w of BRAND_WORDS) if (low.includes(w.toLowerCase())) hits.push(`${f}:商标「${w}」`);
    for (const w of RED_WORDS) if (text.includes(w)) hits.push(`${f}:红线「${w}」`);
  }
  return hits;
}

/** 一条 CSS 规则体算下来能点多高：显式 (min-)height 优先，否则 padding×2 + 字号×1.2 */
export function bodyHeight(body: string): number {
  const explicit = /(?:^|;)\s*(?:min-)?height:\s*([\d.]+)px/.exec(body);
  if (explicit) return Number(explicit[1]);
  const pad = /(?:^|;)\s*padding:\s*([\d.]+)px/.exec(body);
  const font = /(?:^|;)\s*font-size:\s*([\d.]+)px/.exec(body);
  if (!pad || !font) return Number.NaN;
  return Number(pad[1]) * 2 + Number(font[1]) * 1.2;
}

/**
 * 同一个选择器写了好几遍时按真实层叠算：后面的声明覆盖前面的**同名声明**，
 * 没有重写的声明（比如窄屏那段只改了 padding、没动 min-height）仍旧生效。
 * 这比「最后一条规则整体说了算」更接近浏览器，也不会把只改字号的媒体查询误判成缩小热区。
 */
export function lastHitHeight(sheet: string, selector: string): number {
  const re = new RegExp(`\\${selector}\\{([^}]*)\\}`, "g");
  const decl: Record<string, string> = {};
  let hit = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sheet)) !== null) {
    hit = true;
    for (const part of m[1].split(";")) {
      const at = part.indexOf(":");
      if (at < 0) continue;
      decl[part.slice(0, at).trim()] = part.slice(at + 1).trim();
    }
  }
  if (!hit) return Number.NaN;
  const merged = Object.entries(decl)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return bodyHeight(`;${merged}`);
}

/** 收集选择器列表的最终热区高度，返回 `sel=NNpx` 的可读串 */
export function heightReport(sheet: string, selectors: readonly string[]): string {
  return selectors.map((s) => `${s}=${lastHitHeight(sheet, s).toFixed(1)}px`).join(" ");
}
