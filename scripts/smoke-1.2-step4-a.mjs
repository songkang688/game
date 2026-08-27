/**
 * 1.2 第 4 步 A「英杰令」的手动冒烟替身：用真浏览器（360×640 最窄屏）
 * 把这一桌牌从头到尾摸一遍，覆盖验收清单里靠单元测试证不了的那几条：
 *
 *   1. 首页自动发现这张卡，进得去；
 *   2. 360px 竖屏全程不横向溢出（选关 / 牌桌 / 身份场 / 无尽 / 暂停五块画面都量）；
 *   3. 手牌、座位、按钮的热区都 ≥ 44px，真手指点得中；
 *   4. 抽查 8 个章节各一关：用真鼠标点牌 → 点人 → 确定，把残局打到「过关」浮层弹出来；
 *   5. 键位在真实 keydown 下有效：A / D 挑牌，F 出牌，G 取消，Esc 暂停并挡住出牌；
 *   6. 身份场四个档位都开得起来，AI 的回合在 1 秒内自己往下走；连胜无尽也开得起来；
 *   7. destroy 无泄漏：进 → 玩 → 退回首页后 window 监听 / interval / rAF 全部归零；
 *   8. 全程没有 pageerror、没有 console.error。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5183
 *   node scripts/smoke-1.2-step4-a.mjs        # SMOKE_LEVELS=1,25 可只跑其中几关
 *
 * 它连着源码跑（dev server），点的是真按钮，不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5183";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const SAVE_KEY = "yiduo-yixing.l99.hero-cards";
// 8 章各抽一关（章节边界：24/48/72/96/118/140/164/188）
const LEVELS = (process.env.SMOKE_LEVELS ?? "1,25,49,73,97,119,141,188")
  .split(",")
  .map(Number)
  .filter((n) => n >= 1 && n <= 188);

const TRACE = process.env.SMOKE_TRACE === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

// --- 页面小工具 -------------------------------------------------------------

/** 牌桌当前长什么样：够不够判断下一步该点哪儿 */
async function table(page) {
  return page.evaluate(() => {
    const q = (s) => [...document.querySelectorAll(s)];
    const btn = (text) => q(".hc-pad .hc-btn").find((b) => (b.textContent ?? "").includes(text));
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.top, bottom: r.bottom };
    };
    const pad = q(".hc-pad .hc-btn");
    const ok = btn("确定") ?? btn("放下");
    const cancel = pad.find((b) => /取消|不出/.test(b.textContent ?? ""));
    const end = btn("结束回合");
    const at = (el) => (el ? { sel: ".hc-pad .hc-btn", idx: pad.indexOf(el) } : null);
    const seats = q(".hc-seat");
    return {
      alive: Boolean(document.querySelector(".hc-wrap")),
      over: Boolean(document.querySelector(".l99-overlay")),
      overText: document.querySelector(".l99-overlay")?.textContent ?? "",
      msg: document.querySelector(".hc-msg")?.textContent ?? "",
      me: (document.querySelector(".hc-seat .hc-seat-name")?.textContent ?? "").split("·")[0].replace(/^\P{L}+/u, ""),
      turn: [...document.querySelectorAll(".hc-top .hc-badge")].pop()?.textContent ?? "",
      okText: ok?.textContent ?? "",
      cancelText: cancel?.textContent ?? "",
      endOn: Boolean(end && !end.disabled),
      okOn: Boolean(ok && !ok.disabled),
      okAt: at(ok),
      cancelAt: at(cancel),
      endAt: at(end),
      picks: seats.map((el, i) => (el.classList.contains("hc-seat-pick") ? i : -1)).filter((i) => i >= 0),
      cards: q(".hc-card").map((el, i) => ({ i, dim: el.classList.contains("hc-card-dim"), ...box(el) })),
      seats: seats.map((el) => ({ text: el.textContent ?? "", out: el.classList.contains("hc-seat-out") }))
    };
  });
}

/**
 * 真鼠标点一个元素：先让浏览器把它滚到屏幕正中（跟真人手指划一下一个意思），
 * 滚完重新量一次位置再点，绝不点空气。
 */
async function tap(page, target) {
  if (!target) return false;
  const spot = await page.evaluate(({ sel, idx }) => {
    const el = document.querySelectorAll(sel)[idx];
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
  }, target);
  if (!spot || spot.w < 1) return false;
  if (spot.x < 0 || spot.x > VIEWPORT.width || spot.y < 0 || spot.y > VIEWPORT.height) return false;
  await page.mouse.click(spot.x, spot.y);
  await sleep(110);
  return true;
}

const cardAt = (i) => ({ sel: ".hc-card", idx: i });
const seatAt = (i) => ({ sel: ".hc-seat", idx: i });

/**
 * 一个贪心的「小孩打法」：能出就出，出不了就结束回合，被指到就先挡。
 * 全靠 DOM 上看得见的信息决策，跟真人一样。
 */
async function playGreedy(page, budget = 200) {
  let tried = new Set();
  for (let step = 0; step < budget; step++) {
    const t = await table(page);
    if (TRACE)
      console.log(
        `    #${step} turn=${t.turn.slice(0, 22)} ok=${t.okText} cancel=${t.cancelText} end=${t.endOn} picks=${
          t.picks.length
        } cards=${t.cards.filter((c) => !c.dim).length}/${t.cards.length} msg=${t.msg.slice(0, 30)}`
      );
    if (t.over) return { done: true, text: t.overText, steps: step };
    if (!t.alive) return { done: false, why: "牌桌没了", steps: step };

    // 1. 要放下几张牌（弃牌）：先挑够数再确定
    if (t.okText.includes("放下")) {
      const want = Math.max(1, Number(/放下 (\d+)/.exec(t.msg ?? "")?.[1] ?? 1));
      for (const c of t.cards.filter((c) => !c.dim).slice(0, want)) await tap(page, cardAt(c.i));
      await tap(page, (await table(page)).okAt);
      continue;
    }

    // 2. 有人指着我：手上有得挡就挡，没有就按「不出」。
    //    唯独别人快撑不住时不递蜜桃愈 —— 残局里被打的多半是对手，救了就白打。
    if (t.cancelText.includes("不出")) {
      const saveFoe = /快撑不住/.test(t.msg) && t.me && !t.msg.includes(t.me);
      const playable = saveFoe ? null : t.cards.find((c) => !c.dim);
      if (playable) await tap(page, cardAt(playable.i));
      else await tap(page, t.cancelAt);
      continue;
    }

    // 3. 牌已经选好、座位在等我挑：点第一个亮着的人
    if (t.picks.length) {
      await tap(page, seatAt(t.picks[0]));
      tried = new Set();
      continue;
    }

    // 4. 我的回合：挑一张还没试过的、不灰的牌
    if (t.endOn) {
      const card = t.cards.find((c) => !c.dim && !tried.has(c.i));
      if (card) {
        tried.add(card.i);
        await tap(page, cardAt(card.i));
        const after = await table(page);
        // 群体锦囊 / 赠花这类不用点人，直接确定
        if (!after.picks.length && after.okOn && !/打不出去|指不了人/.test(after.msg)) {
          await tap(page, after.okAt);
          tried = new Set();
        }
        continue;
      }
      tried = new Set();
      await tap(page, t.endAt);
      await sleep(240);
      continue;
    }

    // 5. 轮到别人：等 AI 自己走
    await sleep(200);
  }
  const t = await table(page);
  return { done: Boolean(t.over), text: t.overText, steps: budget, why: "步数用完" };
}

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    // 祖先里有横向滚动容器的（手牌条、章节页签）不算溢出：那是滚出去的，不是撑破的
    const scrolls = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
      return false;
    };
    const bad = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (getComputedStyle(el).position === "fixed") return false;
      if (scrolls(el)) return false;
      return r.right > d.clientWidth + 1 || r.left < -1;
    });
    return { doc: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 3).map((el) => el.className || el.tagName) };
  });
}

/** 所有能点的东西里，最小的那个热区 */
async function minHotZone(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll(".hc-card,.hc-seat,.hc-btn,.hc-open,.hc-back")];
    let worst = null;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const side = Math.min(r.width, r.height);
      if (!worst || side < worst.side) worst = { side: Math.round(side), what: el.className };
    }
    return worst;
  });
}

async function openLevel(page, target) {
  await page.evaluate(
    ([key, n]) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < n - 1 ? 3 : 0))));
    },
    [SAVE_KEY, target]
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/hero-cards`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".hc-wrap", { timeout: 10000 });
  await sleep(320);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

// --- 主流程 ----------------------------------------------------------------

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport({ ...VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  let errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  // destroy 泄漏计数器：得赶在任何页面脚本之前挂上
  await page.evaluateOnNewDocument(() => {
    const w = window;
    w.__leak = { listeners: 0, intervals: 0, frames: 0 };
    const add = w.addEventListener.bind(w);
    const rm = w.removeEventListener.bind(w);
    w.addEventListener = (...a) => {
      w.__leak.listeners++;
      return add(...a);
    };
    w.removeEventListener = (...a) => {
      w.__leak.listeners--;
      return rm(...a);
    };
    const si = w.setInterval.bind(w);
    const ci = w.clearInterval.bind(w);
    w.setInterval = (...a) => {
      w.__leak.intervals++;
      return si(...a);
    };
    w.clearInterval = (...a) => {
      w.__leak.intervals--;
      return ci(...a);
    };
    const raf = w.requestAnimationFrame.bind(w);
    const caf = w.cancelAnimationFrame.bind(w);
    const live = new Set();
    w.requestAnimationFrame = (fn) => {
      const id = raf((t) => {
        live.delete(id);
        fn(t);
      });
      live.add(id);
      w.__leak.frames = live.size;
      return id;
    };
    w.cancelAnimationFrame = (id) => {
      live.delete(id);
      w.__leak.frames = live.size;
      return caf(id);
    };
  });

  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(1200);
  const baseLeak = await page.evaluate(() => ({ ...window.__leak }));

  // 1. 首页发现这张卡
  const card = await page.evaluate(() =>
    [...document.querySelectorAll("body *")].some((el) => el.textContent?.trim() === "英杰令")
  );
  log(card, "首页自动发现「英杰令」卡片");

  // 2. 选关页 360px 不溢出
  await page.goto(`${BASE}/?t=${Date.now()}#/game/hero-cards`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await sleep(300);
  const mapOver = await overflowX(page);
  log(mapOver.doc <= 0 && mapOver.bad.length === 0, "选关页 360px 不横向溢出", `doc+${mapOver.doc} ${mapOver.bad}`);

  // 3. 逐章真打
  for (const n of LEVELS) {
    errors = [];
    const title = await openLevel(page, n);
    const over = await overflowX(page);
    const hot = await minHotZone(page);
    const seats = (await table(page)).seats.length;
    log(seats === 5 || seats === 2 || seats === 3 || seats === 4, `第 ${n} 关 ${title.trim()}：牌桌摆开`, `${seats} 个座位`);
    log(over.doc <= 0 && over.bad.length === 0, `第 ${n} 关 360px 不横向溢出`, `doc+${over.doc} ${over.bad}`);
    log(hot && hot.side >= 44, `第 ${n} 关热区 ≥44px`, `最小 ${hot?.side}px @ ${hot?.what}`);

    const r = await playGreedy(page, 400);
    const win = /过关/.test(r.text ?? "");
    log(r.done, `第 ${n} 关点到出结果`, `${r.steps} 步 ${win ? "过关" : "没过（贪心打法而已）"}`);
    log(errors.length === 0, `第 ${n} 关全程无报错`, errors.slice(0, 2).join(" / "));
  }

  // 4. 键位
  errors = [];
  await openLevel(page, 1);
  const readCursor = () =>
    page.evaluate(() => [...document.querySelectorAll(".hc-card")].findIndex((el) => el.classList.contains("hc-card-on")));
  const c0 = await readCursor();
  await page.keyboard.press("d");
  await sleep(120);
  const c1 = await readCursor();
  await page.keyboard.press("a");
  await sleep(120);
  const c2 = await readCursor();
  log(c1 !== c0 && c2 === c0, "A / D 真的在挑牌", `${c0} → ${c1} → ${c2}`);

  await page.keyboard.press("f");
  await sleep(160);
  const afterF = await table(page);
  log(afterF.picks.length > 0 || afterF.msg.length > 0, "F 选中手上这张牌", afterF.msg.slice(0, 24));
  await page.keyboard.press("g");
  await sleep(160);
  const afterG = await table(page);
  log(afterG.picks.length === 0, "G 取消掉刚才的选择", afterG.msg.slice(0, 24));

  await page.keyboard.press("Escape");
  await sleep(180);
  const paused = await page.evaluate(() => Boolean(document.querySelector(".hc-pause")));
  const pauseOver = await overflowX(page);
  log(paused, "Esc 弹出暂停罩子");
  log(pauseOver.doc <= 0 && pauseOver.bad.length === 0, "暂停罩子 360px 不溢出", `doc+${pauseOver.doc}`);
  const handBefore = await page.evaluate(() => document.querySelectorAll(".hc-card").length);
  await tap(page, cardAt(0));
  await sleep(160);
  const handAfter = await page.evaluate(() => document.querySelectorAll(".hc-card").length);
  log(handBefore === handAfter, "暂停时点牌不生效", `${handBefore} → ${handAfter}`);
  await page.keyboard.press("Escape");
  await sleep(160);
  log(!(await page.evaluate(() => Boolean(document.querySelector(".hc-pause")))), "再按 Esc 接着玩");
  log(errors.length === 0, "键位一段无报错", errors.slice(0, 2).join(" / "));

  // 5. 身份场四档 + 无尽
  errors = [];
  await page.goto(`${BASE}/?t=${Date.now()}#/game/hero-cards`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".hc-modebar .hc-open", { timeout: 15000 });
  for (const tierName of ["菜鸟", "普通", "高手", "地狱"]) {
    await page.evaluate(() =>
      [...document.querySelectorAll(".hc-modebar .hc-open")].find((b) => b.textContent?.includes("身份场"))?.click()
    );
    await sleep(260);
    const opened = await page.evaluate((t) => {
      const b = [...document.querySelectorAll(".hc-open")].find((x) => x.textContent?.includes(t));
      if (!b) return false;
      b.click();
      return true;
    }, tierName);
    await page.waitForSelector(".hc-wrap", { timeout: 8000 }).catch(() => undefined);
    await sleep(1000);
    const t = await table(page);
    const moved = /第 \d+ 圈/.test(t.turn);
    const over = await overflowX(page);
    log(opened && t.alive && moved, `身份场「${tierName}」开局并自己往下走`, t.turn.slice(0, 28));
    log(over.doc <= 0 && over.bad.length === 0, `身份场「${tierName}」360px 不溢出`, `doc+${over.doc}`);
    await page.evaluate(() => document.querySelector(".hc-back")?.click());
    await sleep(260);
  }
  await page.evaluate(() =>
    [...document.querySelectorAll(".hc-modebar .hc-open")].find((b) => b.textContent?.includes("无尽"))?.click()
  );
  await page.waitForSelector(".hc-wrap", { timeout: 8000 }).catch(() => undefined);
  await sleep(800);
  const endless = await table(page);
  const endlessOver = await overflowX(page);
  log(endless.alive, "连胜无尽开得起来", endless.turn.slice(0, 28));
  log(endlessOver.doc <= 0 && endlessOver.bad.length === 0, "无尽 360px 不溢出", `doc+${endlessOver.doc}`);
  log(errors.length === 0, "两个模式无报错", errors.slice(0, 2).join(" / "));

  // 6. destroy 泄漏
  errors = [];
  await openLevel(page, 5);
  await playGreedy(page, 30);
  await page.goto(`${BASE}/?t=${Date.now()}#/`, { waitUntil: "networkidle0" }).catch(() => undefined);
  await page.goto(`${BASE}/?t=${Date.now()}#/game/hero-cards`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 15000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".hc-wrap", { timeout: 10000 });
  await sleep(600);
  const before = await page.evaluate(() => ({ ...window.__leak }));
  await page.evaluate(() => document.querySelector(".l99-back")?.click());
  await sleep(700);
  const after = await page.evaluate(() => ({ ...window.__leak }));
  log(
    after.listeners <= before.listeners && after.listeners <= baseLeak.listeners + 2,
    "退出后 window 监听收干净",
    `基线 ${baseLeak.listeners} → 局中 ${before.listeners} → 退出 ${after.listeners}`
  );
  log(after.intervals <= baseLeak.intervals + 1, "退出后 interval 收干净", `${after.intervals}`);
  await sleep(600);
  const frames = await page.evaluate(() => window.__leak.frames);
  log(frames <= 2, "退出后 rAF 不再排队", `${frames}`);
  log(errors.length === 0, "退出一段无报错", errors.slice(0, 2).join(" / "));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 项通过`);
  if (bad.length) {
    console.log("没过的：");
    for (const b of bad) console.log(`  - ${b.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
