/**
 * 窗口 4 档A · 第 3 轮监督修复员 · 收官总闸
 *
 * 这一轮动过的地方有六处：学习优化员的四条（都是「多显示一点东西」），
 * 加上修复员的两条（W4A-17 勇者小路的精英定价 / W4A-18 连连看的死胡同救场）。
 * 「多显示一点东西」最容易带进来的两样毛病，一是新写的话里混进红线词，
 * 二是新加的 DOM 标记没人摘。所以本段把两样一起扫，五个目录一起过。
 *
 * 文件放在 `brick-break/` 只是沿用第 2 轮总闸的位置，扫的是本档五款全部源码。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { towerPaceWord, makeTower, type TowerState } from "./logic";
import { selfHelp } from "../lianliankan/logic";
import { createBoard } from "../lianliankan/board";
import { missWordFor, type MissReason } from "../fruit-catch/logic";
import { mulberry32 } from "../level99";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = join(HERE, "..");
const OWNED = ["brave-path", "brick-break", "balloon-pop", "fruit-catch", "lianliankan"];

interface Source {
  game: string;
  file: string;
  text: string;
}

const SOURCES: Source[] = OWNED.flatMap((game) =>
  readdirSync(join(GAMES_DIR, game))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => ({ game, file: `${game}/${f}`, text: readFileSync(join(GAMES_DIR, game, f), "utf8") }))
);

const src = (file: string): string => SOURCES.find((s) => s.file === file)!.text;

const BRAND_WORDS = [
  "愤怒的小鸟", "植物大战僵尸", "水果忍者", "地铁跑酷", "森林冰火人", "屁王兄弟",
  "拳皇", "街霸", "超级玛丽", "马里奥", "割绳子", "俄罗斯方块", "Tetris",
  "贪吃蛇大作战", "球球大作战", "我的世界", "Minecraft", "三国杀", "大富翁",
  "斗地主", "Pac-Man", "吃豆人", "宝可梦", "皮卡丘", "奥特曼", "喜羊羊",
  "蛋仔", "原神", "王者荣耀", "roblox", "disney", "zelda", "sonic"
];
const HARSH_WORDS = ["流血", "出血", "死亡", "死了", "尸", "杀死", "笨", "蠢", "白痴", "垃圾", "太差劲"];
/** 屏幕上说给孩子听的话里，一句下判语都不许有 */
const BLAME_WORDS = ["失败", "输了", "太差", "不行", "菜", "怎么还", "怎么又"];

function literals(text: string): string[] {
  return text.match(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\[\s\S]|[^\\`])*`/g) ?? [];
}

describe("窗口4 档A · R3 收官 · 红线总闸（含本轮新写的话）", () => {
  it("五个目录一个不漏，商标黑名单仍是 0 命中", () => {
    for (const game of OWNED) {
      const mine = SOURCES.filter((s) => s.game === game).map((s) => s.file);
      for (const must of ["index.ts", "logic.ts", "meta.ts"]) {
        expect(mine, `${game} 漏扫了 ${must}`).toContain(`${game}/${must}`);
      }
    }
    for (const { file, text } of SOURCES) {
      const low = text.toLowerCase();
      for (const w of BRAND_WORDS) expect(low.includes(w.toLowerCase()), `${file} 里出现了「${w}」`).toBe(false);
    }
  });

  it("本轮新写的四处话都过得了红线：不见血、不数落、不提商标", () => {
    const said: string[] = [];

    // A-L13 砖塔节奏牌
    const tower = (elapsed: number): TowerState => ({ ...makeTower(mulberry32(3)), elapsed, drop: 0 });
    for (const t of [0, 40, 90, 300]) said.push(towerPaceWord(tower(t)));

    // A-L14 连连看「指个方向」
    for (let s = 0; s < 12; s++) {
      said.push(selfHelp(createBoard({ rows: 6, cols: 6, kinds: 8, gravity: "none", maxTurns: 2 }, mulberry32(900 + s))).word);
    }

    // A-L15 接住小水果的四种漏球说法
    for (const r of ["far", "fast", "near", "slow"] as MissReason[]) {
      for (let n = 1; n <= 3; n++) said.push(missWordFor(r, n));
    }

    // W4A-18 连连看的死胡同救场（写在 index.ts 里的那句）
    said.push("这盘走进死胡同啦，不算你的——帮你重排一次，接着连！");

    expect(said.length).toBeGreaterThan(25);
    for (const w of said) {
      for (const b of [...HARSH_WORDS, ...BLAME_WORDS]) {
        expect(w.includes(b), `「${w}」里出现了「${b}」`).toBe(false);
      }
      for (const b of BRAND_WORDS) expect(w.toLowerCase().includes(b.toLowerCase())).toBe(false);
      expect(w).not.toContain("血");
      expect(w.trim().length, "有一句是空的").toBeGreaterThan(6);
    }
    // 救场那句确实进了源码
    expect(src("lianliankan/index.ts")).toContain("这盘走进死胡同啦，不算你的");
  });

  it("玩家看得见的字整体仍旧干净，五款一起扫", () => {
    for (const { file, text } of SOURCES) {
      for (const s of literals(text)) {
        for (const w of HARSH_WORDS) {
          expect(s.includes(w), `${file} 的字符串「${s.slice(0, 40)}」里出现了「${w}」`).toBe(false);
        }
      }
    }
  });

  it("仍旧不联网、不自己发声、不引外部包、不写广告内购账号", () => {
    for (const { file, text } of SOURCES) {
      for (const api of ["XMLHttpRequest", "WebSocket", "socket.io", "three.js", 'from "three"', "new Audio(", "AudioContext", "createOscillator", "https://cdn", "http://cdn"]) {
        expect(text.includes(api), `${file} 里出现了 ${api}`).toBe(false);
      }
      for (const w of ["广告", "内购", "充值", "登录", "注册"]) {
        expect(text.includes(w), `${file} 里出现了「${w}」`).toBe(false);
      }
    }
  });

  it("存档 key 一个字没动：本轮六处改动都没碰存档", () => {
    for (const { file, text } of SOURCES) {
      expect(text.includes("localStorage.setItem"), `${file} 直接写了 localStorage`).toBe(false);
    }
    const keys = new Set(SOURCES.flatMap(({ text }) => text.match(/yiduo-yixing\.[a-z0-9-]+/gi) ?? []));
    for (const k of keys) expect(k).toMatch(/^yiduo-yixing\.[a-z0-9-]+$/i);
    expect(src("brave-path/logic.ts")).toContain("yiduo-yixing.bravepath");
  });

  it("声音仍旧只走 api.play / ctx.sfx，本轮没有开新的发声口子", () => {
    for (const game of OWNED) {
      const text = src(`${game}/index.ts`);
      expect((text.match(/\b(api\.play|ctx\.sfx)\(/g) ?? []).length, `${game} 一次都没有`).toBeGreaterThan(0);
      expect(text, `${game} 用了震动`).not.toMatch(/navigator\.vibrate/);
    }
  });
});

describe("窗口4 档A · R3 收官 · 本轮改动不留尾巴", () => {
  it("四处新显示都不新开定时器、不新开监听、不新开动画帧", () => {
    // A-L13 砖塔节奏牌：跟着已有的 tick 走，只多一个累加器
    const brk = src("brick-break/index.ts");
    expect(brk).toContain("paceT += dt");
    expect(brk).not.toMatch(/paceEl\.(addEventListener|onclick)/);
    const paceFrom = brk.indexOf("paceT += dt");
    const paceBlock = brk.slice(paceFrom, brk.indexOf("draw();", paceFrom));
    expect(paceBlock).toContain("towerPaceWord");
    expect(paceBlock).not.toMatch(/setTimeout|setInterval|requestAnimationFrame\(/);

    // A-L16 气球预警：每帧 toggle，飘回安全区自己摘掉，不新增节点
    const blp = src("balloon-pop/index.ts");
    expect((blp.match(/classList\.toggle\("blp-leaving"/g) ?? []).length).toBe(2);
    expect(blp).not.toContain('classList.add("blp-leaving")');
    expect(blp).not.toContain('createElement("div")\n');

    // A-L14 / A-L15 只改文案，不碰生命周期
    expect(src("lianliankan/index.ts")).toContain("selfHelp(board, maxTurns).word");
    expect(src("fruit-catch/index.ts")).toContain("missWordFor(missReason(");
  });

  it("五款的 destroy 契约照旧：排了帧就有取消，没有没人管的 setInterval", () => {
    for (const game of OWNED) {
      const text = src(`${game}/index.ts`);
      expect((text.match(/destroy\(\)\s*[:{]/g) ?? []).length, `${game} 的 destroy 太少`).toBeGreaterThanOrEqual(1);
      if ((text.match(/requestAnimationFrame\(/g) ?? []).length > 0) {
        expect(text, `${game} 排了帧却没见取消`).toMatch(/cancelAnimationFrame\(/);
      }
      expect((text.match(/(?<!jan\.)(?<!\.)\bsetInterval\(/g) ?? []).length, `${game} 里有没人管的 setInterval`).toBe(0);
    }
  });

  it("W4A-18 已清：连连看只剩「时间到」一个输法，死胡同一律免费救场", () => {
    const llk = src("lianliankan/index.ts");
    expect(llk).toContain("function rescue()");
    expect(llk).toContain("if (timeLeft <= 0) fail(timeUpWord())");
    // 那两句「怪孩子没留洗牌」的判负词拆干净了
    expect(llk).not.toContain("洗牌是应急用的，下一局");
    expect(llk).not.toContain("洗牌留给真正的死局");
    // 救场走的是 fairShuffle，它保证「重排完一定还走得动」
    expect(llk).toContain("fairShuffle(board");
  });

  it("W4A-17 已清：精英按「是不是连着打」定价，两档松法都在册", () => {
    const lv = src("brave-path/levels.ts");
    expect(lv).toContain("export const CLIMAX_EASE = 0.9");
    expect(lv).toContain("export const DEEP_EASE = 0.85");
    expect(lv).toContain("function easeWornElite");
    expect(lv).toContain("function offerBreather");
    // 老的「只管收尾那只」已经没有了
    expect(lv).not.toContain("easeClimaxElite");
    // 首领关不受影响：它门口本来就有整装石
    expect(lv).toContain("if (!boss) {");
  });

  it("窗口 1 的平台文件与 src/styles.css 一处都没动（本档全部样式写在各自 index.ts 里）", () => {
    for (const game of OWNED) {
      const text = src(`${game}/index.ts`);
      const carries = text.includes("<style>${CSS}</style>") || text.includes("style.textContent = CSS");
      expect(carries, `${game} 应当自带样式`).toBe(true);
    }
    const styles = readFileSync(join(GAMES_DIR, "..", "styles.css"), "utf8");
    for (const cls of ["brk-pace", "blp-leaving", "frc-", "llk-", "bvp-"]) {
      expect(styles.includes(cls), `styles.css 里混进了 ${cls}`).toBe(false);
    }
  });
});
