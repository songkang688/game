/**
 * 1.1 第 2 步 B 的手动冒烟替身：用真浏览器把四款学习游戏的第 100/140/188 关
 * 一路点到真实胜负，并检查窄屏不溢出、老存档不丢。
 * 跑法（playwright 是临时工具，没有进 package.json）：
 *   npm i -D playwright --no-save && npx playwright install chromium --with-deps
 *   npx vite --port 5173
 *   node scripts/smoke188.mjs            # 也可以 SMOKE_ONLY=color-fun 只跑一款
 * 它必须连着源码跑（dev server），因为要 import 关卡模块反推正确答案再点真实 UI。
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:5173";
const LEVELS = [99, 139, 187]; // 0 基：第 100 / 140 / 188 关
const VIEWPORT = { width: 375, height: 667 };

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 把存档写成「前 target 关都拿过 3 星」，好让 target 关解锁 */
async function seedProgress(page, gameId, target) {
  await page.evaluate(
    ([id, n]) => {
      const stars = Array.from({ length: 188 }, (_, i) => (i < n ? 3 : 0));
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(stars));
    },
    [gameId, target]
  );
}

async function openLevel(page, gameId, level) {
  // 带上时间戳，保证每次都是整页重载（同一个 hash 不会触发导航）
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${gameId}`, { waitUntil: "load" });
  await page.waitForSelector(".l99-grid", { timeout: 15000 });
  // 先切到该关所在的章节页，再点开那一关
  const tabs = page.locator(".l99-tab");
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    await tabs.nth(i).click({ force: true });
    await page.waitForTimeout(120);
    const node = page.locator(`.l99-node[aria-label^="第 ${level + 1} 关"]:not(.l99-node-lock)`);
    if ((await node.count()) > 0) {
      await node.first().click({ force: true });
      await page.waitForTimeout(500);
      return true;
    }
  }
  return false;
}

/** 等到过关 / 失败浮层出现，返回标题文字 */
async function waitOutcome(page, timeout = 90000) {
  await page.waitForSelector(".l99-ov-title", { timeout });
  return (await page.locator(".l99-ov-title").first().textContent())?.trim() ?? "";
}

/** 页面里没有横向溢出（窄屏可玩） */
async function checkNoOverflow(page, label) {
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  log(over.scroll <= over.client + 2, `${label} 窄屏无横向溢出`, `${over.scroll}/${over.client}`);
}

// --------------------------------------------------------------------------
// 各游戏的自动玩家：都靠 import 源码算出正确答案，再点真实 UI
// --------------------------------------------------------------------------

async function playQuizLike(page, gameId, level) {
  // 拼音小火车 / 识字小花园：普通问答、挑拣车厢、组字工坊三种界面
  const plan = await page.evaluate(
    async ([id, lv]) => {
      const mod = await import(`/src/games/${id}/levels.ts`);
      if (id === "pinyin-train" && mod.isPickAllLevel(lv)) {
        const t = mod.buildPickAll(lv);
        return { kind: "pickAll", correct: t.correct };
      }
      if (id === "word-garden" && mod.isBuildCharLevel(lv)) {
        const t = mod.buildCharTask(lv);
        return { kind: "buildChar", rounds: t.rounds.map((r) => ({ radical: r.radical, part: r.part })) };
      }
      return { kind: "quiz", correct: mod.buildQuestions(lv).map((q) => q.correct) };
    },
    [gameId, level]
  );

  if (plan.kind === "quiz") {
    await page.waitForSelector(".qz-choices button", { timeout: 15000 });
    // 答题是异步推进的，必须盯着进度条走，不能照着题号盲点
    for (let guard = 0; guard < plan.correct.length * 4; guard++) {
      if ((await page.locator(".l99-ov-title").count()) > 0) break;
      const text = (await page.locator(".qz-progress").first().textContent()) ?? "";
      const at = Number(/第\s*(\d+)/.exec(text)?.[1] ?? 0) - 1;
      if (at < 0 || at >= plan.correct.length) break;
      await page.locator(".qz-choices button").nth(plan.correct[at]).click({ force: true });
      await page
        .waitForFunction(
          (was) => {
            if (document.querySelector(".l99-ov-title")) return true;
            const p = document.querySelector(".qz-progress");
            return !!p && p.textContent !== was;
          },
          text,
          { timeout: 20000 }
        )
        .catch(() => {});
    }
  } else if (plan.kind === "pickAll") {
    await page.waitForSelector(".pk-chip", { timeout: 15000 });
    for (const text of plan.correct) {
      await page.locator(".pk-chip", { hasText: new RegExp(`^${text}$`) }).first().click({ force: true });
      await page.waitForTimeout(120);
    }
    await page.locator(".pk-go").click({ force: true });
  } else {
    await page.waitForSelector(".bc-pick", { timeout: 15000 });
    // 同样盯着「第几个字 / 第几步」走，两步之间有渲染延迟
    for (let guard = 0; guard < plan.rounds.length * 6; guard++) {
      if ((await page.locator(".l99-ov-title").count()) > 0) break;
      const prog = (await page.locator(".bc-progress").first().textContent()) ?? "";
      const step = (await page.locator(".bc-step").first().textContent()) ?? "";
      const at = Number(/第\s*(\d+)/.exec(prog)?.[1] ?? 0) - 1;
      if (at < 0 || at >= plan.rounds.length) break;
      const want = step.includes("第一步") ? plan.rounds[at].radical : plan.rounds[at].part;
      await page.locator(".bc-pick", { hasText: new RegExp(`^${want}$`) }).first().click({ force: true });
      await page
        .waitForFunction(
          ([p, s]) => {
            if (document.querySelector(".l99-ov-title")) return true;
            const np = document.querySelector(".bc-progress")?.textContent;
            const ns = document.querySelector(".bc-step")?.textContent;
            return np !== p || ns !== s;
          },
          [prog, step],
          { timeout: 20000 }
        )
        .catch(() => {});
    }
  }
  return waitOutcome(page);
}

/**
 * 线稿是层层叠的（窗户压在墙上），正中心未必点得到这一块。
 * 像真人那样在这块露在外面的地方点一下。
 */
async function clickRegion(page, id) {
  const pt = await page.evaluate((rid) => {
    const el = document.querySelector(`.cf-region[data-id="${rid}"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    for (let gy = 1; gy <= 9; gy++) {
      for (let gx = 1; gx <= 9; gx++) {
        const x = b.left + (b.width * gx) / 10;
        const y = b.top + (b.height * gy) / 10;
        if (document.elementFromPoint(x, y) === el) return { x, y };
      }
    }
    return null;
  }, id);
  if (!pt) throw new Error(`第 ${id} 块被完全盖住了，点不到`);
  await page.mouse.click(pt.x, pt.y);
}

async function playColorFun(page, level) {
  const cfg = await page.evaluate(async (lv) => {
    const mod = await import("/src/games/color-fun/levels.ts");
    const c = mod.LEVELS[lv];
    const mixFor = {};
    for (const [k, v] of Object.entries(mod.MIX_TABLE)) mixFor[v] = k.split("+");
    return { tasks: c.tasks, needMix: c.needMix, palette: c.palette, mixFor };
  }, level);

  await page.waitForSelector(".cf-region", { timeout: 15000 });
  await page.waitForTimeout(2600); // 记忆关会先亮一遍答案

  const unlocked = new Set(cfg.palette);
  for (const task of cfg.tasks) {
    if ((await page.locator(".l99-ov-title").count()) > 0) break;
    if (!unlocked.has(task.color)) {
      const pair = cfg.mixFor[task.color];
      if (!pair) throw new Error(`调不出 ${task.color}`);
      for (const p of pair) {
        await page.locator(`.cf-mix-primary[aria-label="倒入${p}"]`).first().click({ force: true });
        await page.waitForTimeout(220);
      }
      await page.waitForTimeout(600);
      unlocked.add(task.color);
    }
    await page.locator(`.cf-swatch[aria-label="${task.color}"]`).first().click({ force: true });
    await page.waitForTimeout(120);
    await clickRegion(page, task.region);
    await page.waitForTimeout(220);
  }
  return waitOutcome(page);
}

async function playMusicStars(page, level) {
  const plan = await page.evaluate(async (lv) => {
    const mod = await import("/src/games/music-stars/levels.ts");
    const cfg = mod.LEVELS[lv];
    if (cfg.mode === "rhythm") return { mode: "rhythm", rounds: mod.buildRhythms(lv), cfg };
    if (cfg.mode === "interval") return { mode: "interval", rounds: mod.buildIntervals(lv), cfg };
    if (cfg.mode === "duet") return { mode: "duet", rounds: mod.buildDuets(lv), cfg };
    if (cfg.mode === "score") return { mode: "score", rounds: mod.buildScores(lv), cfg };
    return { mode: "melody", rounds: mod.buildMelodies(lv), cfg };
  }, level);

  await page.waitForSelector(".ma-wrap, .ms-wrap", { timeout: 15000 });

  /** 范奏放完之前不许点，等提示语变成「轮到你」 */
  async function waitTurn() {
    await page.waitForFunction(
      () => {
        const m = document.querySelector(".ma-msg");
        return !!m && /轮到你|是怎么走的/.test(m.textContent ?? "");
      },
      undefined,
      { timeout: 60000 }
    );
  }

  for (const round of plan.rounds) {
    if ((await page.locator(".l99-ov-title").count()) > 0) break;
    if (plan.mode === "rhythm") {
      await waitTurn();
      for (const long of round) {
        await page.locator(".ma-drum").nth(long === 1 ? 1 : 0).click({ force: true });
        await page.waitForTimeout(140);
      }
    } else if (plan.mode === "interval") {
      await waitTurn();
      await page.locator(".ma-choice").nth(round.correct).click({ force: true });
    } else if (plan.mode === "duet") {
      await waitTurn();
      for (const chord of round) {
        for (const n of chord) {
          await page.locator(".ma-star").nth(n).click({ force: true });
          await page.waitForTimeout(130);
        }
      }
    } else if (plan.mode === "score") {
      await page.waitForSelector(".ma-score", { timeout: 15000 });
      for (const n of round) {
        await page.locator(".ma-star").nth(n).click({ force: true });
        await page.waitForTimeout(130);
      }
    } else {
      await page.waitForTimeout(1200);
      for (const n of round) {
        await page.locator(".ms-star").nth(n).click({ force: true });
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(900);
  }
  return waitOutcome(page);
}

const ALL_GAMES = [
  { id: "pinyin-train", name: "拼音小火车", play: (p, lv) => playQuizLike(p, "pinyin-train", lv) },
  { id: "word-garden", name: "识字小花园", play: (p, lv) => playQuizLike(p, "word-garden", lv) },
  { id: "color-fun", name: "涂色小屋", play: (p, lv) => playColorFun(p, lv) },
  { id: "music-stars", name: "音乐星星", play: (p, lv) => playMusicStars(p, lv) },
];
// SMOKE_ONLY=color-fun 只跑一款，便于定位问题
const GAMES = process.env.SMOKE_ONLY
  ? ALL_GAMES.filter((g) => process.env.SMOKE_ONLY.split(",").includes(g.id))
  : ALL_GAMES;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: "reduce" });
  // 关掉动画，不然一直「element is not stable」点不动
  await ctx.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `*,*::before,*::after{animation:none!important;transition:none!important;}`;
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // 先开一次首页，好让 localStorage 有域可写
  await page.goto(BASE, { waitUntil: "load" });

  for (const g of GAMES) {
    console.log(`\n=== ${g.name} (${g.id}) ===`);
    for (const lv of LEVELS) {
      await seedProgress(page, g.id, lv);
      const opened = await openLevel(page, g.id, lv);
      if (!opened) {
        log(false, `${g.name} 第 ${lv + 1} 关能打开`);
        continue;
      }
      let outcome = "";
      try {
        outcome = await g.play(page, lv);
      } catch (e) {
        log(false, `${g.name} 第 ${lv + 1} 关玩到真实胜负`, String(e).slice(0, 160));
        continue;
      }
      log(/过关/.test(outcome), `${g.name} 第 ${lv + 1} 关玩到真实通关`, outcome);
      await checkNoOverflow(page, `${g.name} 第 ${lv + 1} 关`);
    }
  }

  // --- 老存档不丢：写一个 1.0 时代长度 99 的存档，前 99 关星级要原样显示 ---
  console.log("\n=== 老存档兼容 ===");
  for (const g of GAMES) {
    await page.goto(BASE, { waitUntil: "load" });
    await page.evaluate((id) => {
      const legacy = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
      localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(legacy));
    }, g.id);
    await page.goto(`${BASE}/?t=${Date.now()}#/game/${g.id}`, { waitUntil: "load" });
    await page.waitForSelector(".l99-grid", { timeout: 15000 });

    // 老存档是惰性补 0 的：不主动改写 localStorage，读出来才是 188 长
    const raw = await page.evaluate((id) => localStorage.getItem(`yiduo-yixing.l99.${id}`), g.id);
    log(JSON.parse(raw ?? "[]").length === 99, `${g.name} 老存档原封不动没被改写`, `len=${JSON.parse(raw ?? "[]").length}`);
    const migrated = await page.evaluate(async (id) => {
      const mod = await import("/src/games/level99.ts");
      return mod.loadStars(id);
    }, g.id);
    const head = Array.from({ length: 99 }, (_, i) => (i % 3) + 1);
    const kept = migrated.length === 188
      && head.every((v, i) => migrated[i] === v)
      && migrated.slice(99).every((v) => v === 0);
    log(kept, `${g.name} 读出来补到 188 且前 99 关星级原样`, `len=${migrated.length}`);

    // 逐章翻地图，把前 99 关的星级和老存档逐关对一遍
    const shown = await page.evaluate(() => {
      const out = {};
      const tabs = [...document.querySelectorAll(".l99-tab")];
      for (const tab of tabs) {
        tab.click();
        for (const n of document.querySelectorAll(".l99-node")) {
          const label = n.getAttribute("aria-label") ?? "";
          const m = /^第 (\d+) 关，(.+)$/.exec(label);
          if (m) out[m[1]] = m[2];
        }
      }
      return out;
    });
    const allMatch = head.every((v, i) => shown[String(i + 1)] === `已通关 ${v} 星`);
    log(allMatch, `${g.name} 地图上前 99 关星级逐关原样显示`, `第99关=${shown["99"] ?? "未找到"}`);
    log(shown["100"] === "还没通关", `${g.name} 第 100 关随老存档自然解锁`, shown["100"] ?? "未找到");
  }

  log(errors.length === 0, "全程没有页面报错", errors.slice(0, 3).join(" | "));

  await browser.close();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n合计 ${results.length} 项，通过 ${results.length - bad.length}，失败 ${bad.length}`);
  process.exit(bad.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
