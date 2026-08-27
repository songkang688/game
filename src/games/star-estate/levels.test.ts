import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOTAL_LEVELS, assertTotal, chapterOf, totalSize } from "../level99";
import { meta } from "./meta";
import guide from "./guide";
import {
  CHAPTERS,
  chapterIndexOf,
  chapterStartOf,
  endlessConfig,
  goalLine,
  goalReached,
  levelConfig,
  rulesLine,
  solveLevel,
  starsFor,
  startingDeeds,
  startingNetWorth,
  versusConfig
} from "./levels";
import { BANK, deedsOf, netWorth } from "./rent";
import { tileAt } from "./board";
import { advanceTurn, grantTile, playTurn, type Policy } from "./economy";
import { buildContext, buildState } from "./ai";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILES = [
  "meta.ts",
  "index.ts",
  "board.ts",
  "rent.ts",
  "economy.ts",
  "cards.ts",
  "auction.ts",
  "ai.ts",
  "levels.ts",
  "guide.ts"
];
const src = (f: string): string => readFileSync(join(HERE, f), "utf8");
const SOURCES = FILES.map((f) => ({ f, text: src(f) }));

/**
 * 全站商标黑名单直接从 copy.test.ts 的源码里抠出来。
 * 不能 import 它：那会把整份 copy.test 的用例挂到本文件名下重跑一遍，
 * 别人游戏挂了会算到 star-estate 头上。读文本就只拿到清单本身。
 */
const BRAND_WORDS: string[] = (() => {
  const text = readFileSync(join(HERE, "..", "copy.test.ts"), "utf8");
  const block = /export const BRAND_WORDS[^[]*\[([\s\S]*?)\n\];/.exec(text);
  if (!block) throw new Error("没在 copy.test.ts 里找到 BRAND_WORDS");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
})();

/** 规格额外点名的地产桌游黑名单：官方名与官方街道名一个都不许出现 */
const ESTATE_BRANDS = [
  "大富翁",
  "地产大亨",
  "monopoly",
  "Monopoly",
  "波罗的海",
  "地中海",
  "木板路",
  "公园地",
  "牛津街",
  "梅菲尔",
  "帕克兄弟"
];

/**
 * 「懒人」回放：照样掷骰过回合，但一块地都不买、拍卖一律不跟。
 * 用来钉住 W1-R3-01：只领工资绕圈不能算过关。
 */
function passiveRun(level: number): { won: boolean; peak: number; bought: number } {
  const cfg = levelConfig(level);
  const state = buildState({ seed: cfg.seed, tiers: cfg.tiers, cashes: cfg.cashes, preset: cfg.preset });
  const ctx = buildContext(state, {
    seed: cfg.seed,
    tiers: cfg.tiers,
    rules: cfg.rules,
    scriptedDice: cfg.scriptedDice
  });
  const inner = ctx.policyOf;
  const lazy: Policy = {
    ...inner(0),
    wantBuy: () => false,
    bidLimit: () => 0,
    buildPlan: () => [],
    financePlan: () => []
  };
  ctx.policyOf = (id) => (id === 0 ? lazy : inner(id));

  const base = deedsOf(state, 0).length;
  let peak = netWorth(state, 0);
  let guard = 0;
  while (!state.over && state.round <= cfg.rounds && guard < cfg.rounds * cfg.seats + 8) {
    guard++;
    playTurn(state, state.turn, ctx);
    peak = Math.max(peak, netWorth(state, 0));
    if (state.players[0].bankrupt || goalReached(cfg, state) || state.over) break;
    advanceTurn(state);
  }
  return { won: goalReached(cfg, state), peak, bought: Math.max(0, deedsOf(state, 0).length - base) };
}

describe("star-estate · meta 与章节", () => {
  it("meta 按规格落地", () => {
    expect(meta.id).toBe("star-estate");
    expect(meta.title).toBe("朵星地产");
    expect(meta.emoji).toBe("🏦");
    expect(meta.category).toBe("party");
    expect(meta.color).toBe("#FFF0D6");
    expect(meta.levels).toBe(188);
    expect(meta.platform).toBe("mobile");
    expect([...meta.modes]).toEqual(["campaign", "versus", "endless", "twoPlayer"]);
  });

  it("八章，章节大小之和恒等于 188", () => {
    expect(CHAPTERS.length).toBe(8);
    expect(totalSize(CHAPTERS)).toBe(TOTAL_LEVELS);
    expect(assertTotal(CHAPTERS, 188)).toBe(true);
    expect(CHAPTERS.map((c) => c.size)).toEqual([24, 24, 24, 24, 22, 22, 24, 24]);
  });

  it("chapterIndexOf 和框架的 chapterOf 口径一致", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      expect(chapterIndexOf(lv)).toBe(chapterOf(CHAPTERS, lv));
    }
    expect(chapterStartOf(0)).toBe(0);
    expect(chapterStartOf(4)).toBe(96);
  });

  it("每一章按规格逐步解锁机制", () => {
    const at = (ci: number): ReturnType<typeof levelConfig> => levelConfig(chapterStartOf(ci));
    expect(at(0).rules.build).toBe(false);
    expect(at(0).rules.fullSetDouble).toBe(false);
    expect(at(1).rules.fullSetDouble).toBe(true);
    expect(at(1).rules.build).toBe(false);
    expect(at(2).rules.build).toBe(true);
    expect(at(2).rules.cards).toBe(false);
    expect(at(3).rules.cards).toBe(true);
    expect(at(3).rules.jail).toBe(false);
    expect(at(4).rules.jail).toBe(true);
    expect(at(4).rules.mortgage).toBe(false);
    expect(at(5).rules.mortgage).toBe(true);
    expect(at(5).rules.auction).toBe(false);
    expect(at(6).rules.auction).toBe(true);
    expect(at(7).goal.kind).toBe("bankrupt");
  });

  it("每一关都有固定 seed、合法座位数和写得出来的目标", () => {
    const seeds = new Set<number>();
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const cfg = levelConfig(lv);
      expect(cfg.level).toBe(lv);
      expect(cfg.seats).toBeGreaterThanOrEqual(2);
      expect(cfg.seats).toBeLessThanOrEqual(4);
      expect(cfg.tiers.length).toBe(cfg.seats);
      expect(cfg.cashes.length).toBe(cfg.seats);
      expect(cfg.rounds).toBeGreaterThan(8);
      seeds.add(cfg.seed);
      expect(goalLine(cfg).length).toBeGreaterThan(6);
      expect(rulesLine(cfg)).toContain("买地收租");
      if (cfg.goal.kind === "netWorth") expect(cfg.goal.target).toBeGreaterThan(startingNetWorth(cfg));
    }
    expect(seeds.size).toBe(TOTAL_LEVELS);
  });

  it("预置局面里的地块合法，没有一块地被两个人同时占着", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const cfg = levelConfig(lv);
      const seen = new Set<number>();
      for (const d of cfg.preset) {
        expect(d.tile).toBeGreaterThanOrEqual(0);
        expect(d.tile).toBeLessThan(40);
        expect(d.owner).toBeGreaterThanOrEqual(0);
        expect(d.owner).toBeLessThan(cfg.seats);
        expect(seen.has(d.tile), `第 ${lv + 1} 关第 ${d.tile} 格重复预置`).toBe(false);
        seen.add(d.tile);
      }
      const state = buildState({ seed: cfg.seed, tiers: cfg.tiers, cashes: cfg.cashes, preset: cfg.preset });
      expect(netWorth(state, 0)).toBeGreaterThan(0);
    }
  });

  it("188 关全部可解：参考解法逐关回放都能在限定回合内达标", () => {
    const bad: string[] = [];
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const run = solveLevel(lv);
      if (!run.win) bad.push(`第 ${lv + 1} 关（第 ${chapterIndexOf(lv) + 1} 章）：${run.note}`);
    }
    expect(bad, `这些关没打通：\n${bad.slice(0, 12).join("\n")}`).toEqual([]);
  });

  it("每一关都要求手里真的攥住地，而且比开局送的多", () => {
    for (let lv = 0; lv < TOTAL_LEVELS; lv++) {
      const cfg = levelConfig(lv);
      const base = startingDeeds(cfg);
      expect(cfg.goal.minDeeds, `第 ${lv + 1} 关没设产业门槛`).toBeGreaterThan(base);
      expect(cfg.goal.minDeeds - base).toBeLessThanOrEqual(2);
      expect(goalLine(cfg)).toContain(`攥住 ${cfg.goal.minDeeds} 处产业`);
    }
  });

  it("钱到线但地不够不算过关；地够了才算", () => {
    const cfg = levelConfig(11);
    const state = buildState({ seed: cfg.seed, tiers: cfg.tiers, cashes: cfg.cashes, preset: cfg.preset });
    const target = cfg.goal.kind === "netWorth" ? cfg.goal.target : 0;
    state.players[0].cash = target * 3;
    expect(netWorth(state, 0)).toBeGreaterThanOrEqual(target);
    expect(goalReached(cfg, state)).toBe(false);

    let free = 0;
    for (let pos = 0; pos < state.tiles.length && deedsOf(state, 0).length < cfg.goal.minDeeds; pos++) {
      if (state.tiles[pos].owner === BANK && (tileAt(pos).price ?? 0) > 0) {
        grantTile(state, pos, 0);
        free++;
      }
    }
    expect(free).toBeGreaterThan(0);
    expect(goalReached(cfg, state)).toBe(true);
  });

  it("只掷骰不买地：钱能蹭到线，但过不了关（W1-R3-01）", () => {
    // 棋盘 40 格、过起点白拿 200 星币，光绕圈就能把净资产目标蹭过去。
    // 这一款教的是买地，所以「钱够了」不能单独算赢。
    let moneyEnough = 0;
    for (const lv of [11, 30, 59, 108]) {
      const cfg = levelConfig(lv);
      const r = passiveRun(lv);
      expect(r.bought, `第 ${lv + 1} 关的懒人竟然买了地`).toBe(0);
      expect(r.won, `第 ${lv + 1} 关只掷骰就过关了`).toBe(false);
      if (cfg.goal.kind === "netWorth" && r.peak >= cfg.goal.target) moneyEnough++;
    }
    expect(moneyEnough, "样本里应当有关卡是「钱够了但地不够」").toBeGreaterThan(0);
  });

  it("第 8 章残局：对手不再一两个回合就把自己付破产", () => {
    for (let lv = 164; lv < TOTAL_LEVELS; lv++) {
      const cfg = levelConfig(lv);
      expect(cfg.goal.kind).toBe("bankrupt");
      for (let i = 1; i < cfg.seats; i++) expect(cfg.cashes[i]).toBeGreaterThanOrEqual(320);
      expect(solveLevel(lv).rounds).toBeGreaterThanOrEqual(2);
    }
  });

  it("回放是确定性的：同一关跑两次结果一致", () => {
    for (const lv of [0, 45, 99, 150, 187]) {
      const a = solveLevel(lv);
      const b = solveLevel(lv);
      expect(a).toEqual(b);
    }
  });

  it("三星判定：达标一星，又快又富才三星", () => {
    const cfg = levelConfig(30);
    expect(starsFor(cfg, { win: false, rounds: 1, netWorth: 99999 })).toBe(1);
    expect(starsFor(cfg, { win: true, rounds: cfg.rounds, netWorth: 0 })).toBe(1);
    expect(starsFor(cfg, { win: true, rounds: 1, netWorth: 0 })).toBe(2);
    const target = cfg.goal.kind === "netWorth" ? cfg.goal.target : 0;
    expect(starsFor(cfg, { win: true, rounds: 1, netWorth: Math.ceil(target * 1.2) })).toBe(3);
  });

  it("无尽越连胜对手越强、盘越短；对战是 1 人 + 3 个对手、80 回合封顶", () => {
    expect(endlessConfig(0).tiers[1]).toBe("rookie");
    expect(endlessConfig(3).tiers[1]).toBe("normal");
    expect(endlessConfig(6).tiers[1]).toBe("pro");
    expect(endlessConfig(12).tiers[1]).toBe("hell");
    expect(endlessConfig(12).rounds).toBeLessThan(endlessConfig(0).rounds);

    const v = versusConfig("hell", 1);
    expect(v.seats).toBe(4);
    expect(v.tiers.filter((t) => t === "hell").length).toBe(3);
    expect(v.rules.maxRounds).toBe(80);
  });
});

describe("star-estate · 攻略", () => {
  it("八章攻略齐全，区间正好铺满 188 关", () => {
    expect(guide.gameId).toBe("star-estate");
    expect(guide.entries.length).toBe(8);
    let from = 1;
    guide.entries.forEach((e, i) => {
      expect(e.from).toBe(from);
      expect(e.to).toBe(from + CHAPTERS[i].size - 1);
      expect(e.tips.length).toBeGreaterThanOrEqual(3);
      from += CHAPTERS[i].size;
    });
    expect(from - 1).toBe(TOTAL_LEVELS);
  });

  it("总纲把垄断、平均建、抵押、拍卖四件事都讲到了", () => {
    const text = guide.general.join("");
    for (const key of ["垄断", "平均", "抵押", "拍卖"]) expect(text).toContain(key);
  });
});

describe("star-estate · 产品红线", () => {
  it("全部源码扫不出任何商标", () => {
    // 清单是从源码里抠的，先确认真抠出来了，别让正则失手变成空扫描
    expect(BRAND_WORDS.length).toBeGreaterThanOrEqual(30);
    expect(BRAND_WORDS).toContain("王者荣耀");
    expect(BRAND_WORDS).toContain("愤怒的小鸟");
    for (const { f, text } of SOURCES) {
      for (const brand of BRAND_WORDS) {
        expect(`${f}:${text.toLowerCase().includes(brand.toLowerCase())}`).toBe(`${f}:false`);
      }
    }
  });

  it("不出现任何地产桌游的官方名与官方街道名", () => {
    const all = SOURCES.map((s) => s.text).join("\n") + JSON.stringify(guide) + JSON.stringify(CHAPTERS);
    for (const word of ESTATE_BRANDS) {
      expect(`${word}:${all.toLowerCase().includes(word.toLowerCase())}`).toBe(`${word}:false`);
    }
  });

  it("无血无死亡，破产文案只鼓励", () => {
    const text = JSON.stringify(guide) + JSON.stringify(CHAPTERS) + src("index.ts");
    for (const bad of ["死", "血", "尸", "杀", "赌", "高利贷"]) expect(text).not.toContain(bad);
    expect(src("index.ts")).toContain("钱包空啦，去朵朵公园歇一会儿");
  });

  it("货币只是游戏内数字：没有真实货币、内购、广告", () => {
    const all = SOURCES.map((s) => s.text).join("\n");
    for (const bad of ["人民币", "内购", "广告", "充值", "支付", "元宝", "钻石"]) expect(all).not.toContain(bad);
    expect(all).toContain("星币");
  });

  it("离线可玩：不引 three.js、不连网、不开 socket", () => {
    for (const { f, text } of SOURCES) {
      expect(`${f}:${/three|Socket|WebSocket|fetch\(|XMLHttpRequest|https?:\/\//.test(text)}`).toBe(`${f}:false`);
    }
  });

  it("音效只走 api.play，不自己造 AudioContext", () => {
    const index = src("index.ts");
    expect(index).not.toContain("new AudioContext");
    expect(index).not.toContain("new Audio(");
    for (const m of index.matchAll(/api\.play\("([a-z]+)"\)/g)) {
      expect(["tap", "win", "oops", "coin", "pop", "meow", "jump"]).toContain(m[1]);
    }
  });

  it("meta.ts 是纯数据，不 import 任何玩法", () => {
    expect(/^\s*import\s/m.test(src("meta.ts"))).toBe(false);
    expect(src("board.ts")).not.toContain('from "./economy"');
    expect(src("board.ts")).not.toContain('from "./index"');
  });

  it("index.ts 顶部就把 meta 透出来，并导出 mount", () => {
    expect(src("index.ts").slice(0, 200)).toContain("export { meta }");
    expect(src("index.ts")).toContain("export function mount(");
    expect(src("index.ts")).toContain("mountLevelGame(");
  });

  it("destroy 会把监听和定时器全清掉", () => {
    const index = src("index.ts");
    const adds = (index.match(/addEventListener\?\.\(/g) ?? []).length;
    const removes = (index.match(/removeEventListener\?\.\(/g) ?? []).length;
    expect(adds).toBeGreaterThan(0);
    expect(removes).toBe(adds);
    expect(index).toContain("clearTimeout(t)");
    expect(index).toContain("timers.clear()");
    expect(index).toContain("destroyed = true");
    // 每一个 setTimeout 都进 timers 集合，destroy 时一次清光
    expect((index.match(/setTimeout\(/g) ?? []).length).toBe(1);
  });

  it("键位按规格：F 掷骰、G 购买 / 建屋，星星 方向键 + L/K，Esc 暂停", () => {
    const index = src("index.ts");
    for (const key of ['"f"', '"g"', '"l"', '"k"', '"w"', '"a"', '"s"', '"d"', "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", '"Escape"']) {
      expect(index, `键位 ${key} 没接`).toContain(key);
    }
  });

  it("手机三大钮热区不小于 44px", () => {
    const index = src("index.ts");
    expect(index).toContain("🎲 掷骰 F");
    expect(index).toContain("🏠 购买 G");
    expect(index).toContain("⏭️ 结束回合");
    const heights = [...index.matchAll(/min-height:(\d+)px/g)].map((m) => Number(m[1]));
    expect(heights.length).toBeGreaterThan(2);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });

  it("360px 窄屏有兜底，写死的字号一律不小于 13px", () => {
    const index = src("index.ts");
    expect(index).toContain("@media (max-width:360px)");
    expect(index).toContain("overflow-wrap:anywhere");
    const sizes = [...index.matchAll(/font-size:(\d+)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(4);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(13);
    // clamp() 的下限就是窄屏上的实际字号，真机量出来过 9px，这里一并钉死
    const clampFloors = [...index.matchAll(/font-size:clamp\((\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(clampFloors.length).toBeGreaterThan(3);
    expect(Math.min(...clampFloors)).toBeGreaterThanOrEqual(13);
    // 棋盘缩到整屏 + 当前格放大预览
    expect(index).toContain("aspect-ratio:1");
    expect(index).toContain("se-preview");
  });

  it("走子不瞬移，收租有金币飞行，破产是彩纸不是沮丧", () => {
    const index = src("index.ts");
    expect(index).toContain("HOP_MS");
    expect(index).toContain("coinFly");
    expect(index).toContain("confetti");
    expect(index).toContain("prefers-reduced-motion");
  });

  it("存档只用本款自己的进度，不碰平台那几个 key", () => {
    const index = src("index.ts");
    expect(index).toContain("save.getGameProgress(meta.id)");
    expect(index).toContain("save.recordEndlessBest(meta.id");
    expect(index).not.toContain("fav.v1");
    expect(index).not.toContain("collection.v1");
    expect(index).not.toContain("yiduo-yixing.save");
  });
});
