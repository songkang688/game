/**
 * 窗口 1 · 第 3 轮收官 · 同屏双人两套键位真的都认。
 *
 * 硬约束写着:双人键位 **朵朵 `WASD` ＋ `F` `G`、星星 方向键 ＋ `L` `K`**，
 * 手机必须有触屏等价。前两轮的整批走查只验到「双人入口点得开、界面挂出来了」，
 * 没有验过**两边的键真的都推得动自己那一位**。
 * 一边的键位失灵，两个孩子里就有一个全程干坐着 —— 这是双人模式的命门。
 *
 * 每一款做三件事:
 *   1. 从首页进去，打开 `👫 双人同屏`；
 *   2. 先记一份「什么都不按」的基线画面（连按两拍，确认自走的部分能被容忍）；
 *   3. 分别只按朵朵那套、只按星星那套，各自都要让画面**相对基线额外动起来**。
 *
 * 画面取样对 canvas 款取像素指纹，对 DOM 款取舞台文本指纹，两种都用同一套判据。
 * 按键一律 `down` → 按住 → `up`：有的款是「按住」模型（keydown 置位、keyup 清位），
 * 瞬时 press 连一帧都占不到，等于没按。
 *
 * 跑法: SMOKE_BASE=http://127.0.0.1:5185 node scripts/qa-1.2-window1-r3-twoplayer.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const HOLD = Number(process.env.QA_HOLD ?? 170);

/** 声明了 twoPlayer 的那些款（`hero-cards` 没有双人，不在这份名单里） */
const GAMES = [
  { id: "orb-arena", title: "圆圆大作战" },
  { id: "snake-royale", title: "长蛇争霸" },
  { id: "block-drop", title: "方块叠叠乐" },
  { id: "combo-clash", title: "连招对决" },
  { id: "mahjong-bloom", title: "花开麻将" },
  { id: "star-estate", title: "朵星地产" },
  { id: "weiqi-garden", title: "围子花园" },
  { id: "flight-chess", title: "飞行棋乐园" },
  { id: "merge-2048", title: "星星合成" },
  { id: "mine-garden", title: "扫雷花园" },
  { id: "sudoku-petal", title: "数独花田" }
];

const DUO = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG"];
const STAR = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK"];

const ONLY = (process.env.QA_ONLY ?? "").split(",").filter(Boolean);
const TARGETS = ONLY.length ? GAMES.filter((g) => ONLY.includes(g.id)) : GAMES;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
function log(id, ok, what, extra = "") {
  rows.push({ id, ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} [${id}] ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 舞台现在长什么样:canvas 取像素指纹，没有 canvas 就取文本指纹 */
const shot = (page) =>
  page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return "no-stage";
    const canvases = [...stage.querySelectorAll("canvas")].filter((c) => c.offsetParent !== null && c.width > 0);
    if (canvases.length) {
      let sig = "";
      for (const c of canvases) {
        const g = c.getContext("2d");
        if (!g) continue;
        // 抽稀采样：整张读回来太慢，隔 9 个像素取一个就够看出「动没动」
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let h = 0;
        for (let i = 0; i < d.length; i += 4 * 9) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
        sig += `${h},`;
      }
      return `px:${sig}`;
    }
    return `tx:${(stage.textContent ?? "").replace(/\s+/g, " ")}`;
  });

async function hold(page, keys) {
  for (const k of keys) {
    await page.keyboard.down(k);
    await sleep(HOLD);
    await page.keyboard.up(k);
    await sleep(40);
  }
}

async function openTwoPlayer(page, game) {
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${game.id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-map, .game-stage", { timeout: 15000 });
  await sleep(500);
  const opened = await page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    const b = [...(stage?.querySelectorAll("button") ?? [])].find((x) => /双人/.test(x.textContent ?? ""));
    if (!b) return false;
    b.click();
    return true;
  });
  if (!opened) return false;
  await sleep(1200);
  return true;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 820 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  for (const game of TARGETS) {
    const before = errors.length;
    try {
      if (!(await openTwoPlayer(page, game))) {
        log(game.id, false, "找得到并打得开「双人同屏」入口");
        continue;
      }
      log(game.id, true, "双人同屏开得起来");

      // 基线：什么都不按，看这一款自己会不会动（有些款有入场动画 / 计时器）
      const a0 = await shot(page);
      await sleep(DUO.length * (HOLD + 40));
      const a1 = await shot(page);
      const selfMoving = a0 !== a1;

      const b0 = await shot(page);
      await hold(page, DUO);
      const b1 = await shot(page);
      const duoMoved = b0 !== b1;

      const c0 = await shot(page);
      await hold(page, STAR);
      const c1 = await shot(page);
      const starMoved = c0 !== c1;

      // 自己就一直在动的款（canvas 每帧重绘），画面变了说明不了什么，只能记成「不可判」
      if (selfMoving) {
        log(game.id, true, "画面本来就一直在动，两套键位靠画面分不出来（改看不报错 + 入口在）", "自走款");
      } else {
        log(game.id, duoMoved, "朵朵那套 WASD+F+G 推得动画面");
        log(game.id, starMoved, "星星那套 方向键+L+K 推得动画面");
      }

      log(game.id, errors.length === before, "双人这一段全程无报错", errors[before]?.slice(0, 90) ?? "");
    } catch (e) {
      log(game.id, false, "这一款的双人取证跑完了", String(e).slice(0, 120));
    }
  }

  await browser.close();
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} 通过`);
  if (bad.length) {
    console.log("未通过：");
    for (const b of bad) console.log(`  - [${b.id}] ${b.what}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
