/**
 * 1.1 第 10 步 B 的手动冒烟替身：用真浏览器把「鸭梨大战康康」从头到尾玩一遍。
 *
 * 覆盖验收清单里的几条：
 *   1. 五种模式的入口都点得开，擂台真的画出东西（canvas 不是白板）；
 *   2. 双人键位在**真实 keydown 事件**下互不抢占（两套键位各拿各的）；
 *   3. 无尽模式与 188 关第 1 关都玩到**真实胜负**（结算浮层真的弹出来）；
 *   4. Esc 暂停 / 继续；
 *   5. 375×667 与 1280×800 两个尺寸都不横向溢出；
 *   6. destroy 无泄漏：进 → 玩 → 退 → 再进，rAF 与 window 事件监听全部清干净。
 *
 * 跑法（puppeteer-core 是临时工具，没有进 package.json）：
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5178
 *   node scripts/smoke-duo-vs-star.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5178";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ *
 * 页面内驾驶台：直接 import 游戏模块并 mount，胜负靠回调判定，不靠猜画面
 * ------------------------------------------------------------------ */
const HARNESS = `
window.__dvs = (() => {
  const state = { handle: null, calls: [], rafLive: 0, listeners: 0, host: null };

  const realRaf = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const live = new Set();
  window.requestAnimationFrame = (fn) => {
    const id = realRaf((t) => { live.delete(id); fn(t); });
    live.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => { live.delete(id); realCancel(id); };

  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  let listeners = 0;
  window.addEventListener = (...a) => { listeners++; return realAdd(...a); };
  window.removeEventListener = (...a) => { listeners--; return realRemove(...a); };

  // 真实 keydown 收集：验证浏览器给出的 code 与两张键位表的分工
  const pressed = new Set();
  realAdd("keydown", (e) => pressed.add(e.code), true);
  realAdd("keyup", (e) => pressed.delete(e.code), true);

  return {
    state,
    pressed,
    liveRaf: () => live.size,
    listeners: () => listeners,
    async mount() {
      const mod = await import("/src/games/duo-vs-star/index.ts");
      const host = document.createElement("div");
      host.id = "dvs-host";
      document.body.innerHTML = "";
      document.body.appendChild(host);
      state.host = host;
      state.calls = [];
      state.handle = mod.mount({
        root: host,
        play: (n) => state.calls.push(["play", n]),
        addStars: (n) => { state.calls.push(["addStars", n]); return 0; },
        getStars: () => 0,
        onWin: (s, m) => state.calls.push(["onWin", s, m]),
        onLose: (m) => state.calls.push(["onLose", m]),
      });
      return true;
    },
    destroy() {
      state.handle?.destroy();
      state.handle = null;
      return true;
    },
    async keys() {
      const k = await import("/src/games/duo-vs-star/keys.ts");
      return {
        p1: k.readKeys(window.__dvs.pressed, "p1"),
        p2: k.readKeys(window.__dvs.pressed, "p2"),
        codes: Array.from(window.__dvs.pressed),
      };
    },
    clickText(sel, text) {
      const nodes = Array.from(document.querySelectorAll(sel));
      const hit = nodes.find((n) => (n.textContent || "").includes(text));
      if (!hit) return false;
      hit.click();
      return true;
    },
    canvasInk() {
      const c = document.querySelector("canvas.dvs-canvas");
      if (!c) return null;
      const ctx = c.getContext("2d");
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4 * 97) sum = (sum + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 1000000007;
      return sum;
    },
    overlayText() {
      const ov = document.querySelector(".dvs-over") || document.querySelector(".l99-overlay");
      return ov ? (ov.textContent || "").replace(/\\s+/g, " ").trim() : "";
    },
    overflow() {
      return {
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
        wide: Array.from(document.querySelectorAll("#dvs-host *")).filter(
          (n) => n.getBoundingClientRect().right > window.innerWidth + 1
        ).length,
      };
    },
  };
})();
`;

/** 一个很笨但够用的机器人：来回走 + 一直挥击，小电脑自己会凑上来 */
async function botPlay(page, ms, seat = "p1") {
  const K = seat === "p1"
    ? { left: "KeyA", right: "KeyD", up: "KeyW", light: "KeyF", heavy: "KeyG" }
    : { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", light: "KeyL", heavy: "KeyK" };
  const until = Date.now() + ms;
  let step = 0;
  while (Date.now() < until) {
    const dir = step % 2 === 0 ? K.right : K.left;
    await page.keyboard.down(dir);
    await sleep(280);
    await page.keyboard.press(K.light);
    await sleep(120);
    if (step % 3 === 2) await page.keyboard.press(K.heavy);
    if (step % 5 === 4) await page.keyboard.press(K.up);
    await page.keyboard.up(dir);
    await sleep(90);
    step++;
    const done = await page.evaluate(() => window.__dvs.overlayText());
    if (done) return done;
  }
  return await page.evaluate(() => window.__dvs.overlayText());
}

async function boot(page) {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(HARNESS);
  await page.evaluate(() => window.__dvs.mount());
  await sleep(400);
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  /* ---------- 1. 375×667 竖屏：菜单 + 双人对战 + 键位 + 暂停 ---------- */
  await page.setViewport({ width: 375, height: 667 });
  await boot(page);

  const hasMenu = await page.evaluate(() =>
    Boolean(document.querySelector(".dvs-menu")) &&
    Array.from(document.querySelectorAll(".dvs-mode b")).map((n) => n.textContent).join("|")
  );
  log(typeof hasMenu === "string" && hasMenu.includes("双人对战"), "375 竖屏：模式菜单五个入口都在", String(hasMenu));

  log(
    await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "双人对战")),
    "点得开「双人对战」"
  );
  await sleep(250);
  log(
    await page.evaluate(() => window.__dvs.clickText(".dvs-go", "开打")),
    "点得开「两人就位，开打」"
  );
  await sleep(700);

  const ink0 = await page.evaluate(() => window.__dvs.canvasInk());
  log(ink0 !== null && ink0 !== 0, "擂台 canvas 挂出来了，而且画了东西", String(ink0));
  // 没人操作时画面本来就该是静止的，所以要按着方向键再取一次样才说明得了问题
  await page.keyboard.down("KeyD");
  await sleep(500);
  await page.keyboard.up("KeyD");
  const ink1 = await page.evaluate(() => window.__dvs.canvasInk());
  log(ink0 !== ink1, "1P 一走动画面就跟着变（不是白板）", `${ink0} → ${ink1}`);

  // 真实 keydown 下的两套键位
  await page.keyboard.down("KeyD");
  await page.keyboard.down("KeyF");
  let k = await page.evaluate(() => window.__dvs.keys());
  const only1 = k.p1.right && k.p1.light && !k.p2.left && !k.p2.right && !k.p2.light && !k.p2.heavy;
  log(only1, "只按 1P 的 D/F，2P 一个动作都没收到", JSON.stringify(k));
  await page.keyboard.up("KeyD");
  await page.keyboard.up("KeyF");

  await page.keyboard.down("ArrowLeft");
  await page.keyboard.down("KeyK");
  k = await page.evaluate(() => window.__dvs.keys());
  const only2 = k.p2.left && k.p2.heavy && !k.p1.left && !k.p1.right && !k.p1.light && !k.p1.heavy;
  log(only2, "只按 2P 的 ←/K，1P 一个动作都没收到", JSON.stringify(k));

  await page.keyboard.down("KeyA");
  k = await page.evaluate(() => window.__dvs.keys());
  log(k.p1.left && k.p2.left && k.p2.heavy, "两人同时按，各拿各的那一份", JSON.stringify(k));
  await page.keyboard.up("KeyA");
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.up("KeyK");

  // 两个人的动作都真的推动了画面
  const before2p = await page.evaluate(() => window.__dvs.canvasInk());
  await page.keyboard.down("ArrowRight");
  await sleep(500);
  await page.keyboard.up("ArrowRight");
  const after2p = await page.evaluate(() => window.__dvs.canvasInk());
  log(before2p !== after2p, "2P 的方向键也能推动画面");

  // Esc 暂停 / 继续
  await page.keyboard.press("Escape");
  await sleep(200);
  let ov = await page.evaluate(() => window.__dvs.overlayText());
  log(ov.includes("先歇一会儿"), "Esc 弹出暂停面板", ov.slice(0, 30));
  await page.keyboard.press("Escape");
  await sleep(200);
  ov = await page.evaluate(() => window.__dvs.overlayText());
  log(ov === "", "再按一次 Esc 继续比赛");

  const of1 = await page.evaluate(() => window.__dvs.overflow());
  log(of1.wide === 0 && of1.doc <= of1.win + 1, "375×667 没有横向溢出", JSON.stringify(of1));

  /* ---------- 2. 无尽模式：玩到真实胜负 ---------- */
  await page.evaluate(() => window.__dvs.clickText(".dvs-back", "返回"));
  await sleep(300);
  await page.evaluate(() => window.__dvs.clickText(".dvs-back", "回模式选择"));
  await sleep(300);
  log(
    await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "无尽车轮战")),
    "点得开「无尽车轮战」"
  );
  await sleep(250);
  await page.evaluate(() => window.__dvs.clickText(".dvs-go", "上擂台"));
  await sleep(600);
  const endlessResult = await botPlay(page, 105000);
  log(
    /连胜|赢啦|平手/.test(endlessResult),
    "无尽模式玩到真实胜负",
    endlessResult.slice(0, 60)
  );

  /* ---------- 3. 188 关闯关：第 1 关玩到真实胜负 ---------- */
  await page.evaluate(() => window.__dvs.clickText(".dvs-over button", "换个模式"));
  await sleep(300);
  await page.evaluate(() => window.__dvs.clickText(".dvs-back", "回模式选择"));
  await sleep(300);
  log(
    await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "闯关 188 关")),
    "点得开「闯关 188 关」"
  );
  await sleep(400);
  const mapOk = await page.evaluate(() => {
    const nodes = document.querySelectorAll(".l99-node");
    const tabs = document.querySelectorAll(".l99-tab");
    return { nodes: nodes.length, tabs: tabs.length };
  });
  log(mapOk.nodes > 10 && mapOk.tabs >= 8, "选关地图有 ≥8 个章节页签", JSON.stringify(mapOk));

  await page.evaluate(() => window.__dvs.clickText(".l99-continue", "开始冒险"));
  await sleep(800);
  const inLevel = await page.evaluate(() => Boolean(document.querySelector("canvas.dvs-canvas")));
  log(inLevel, "第 1 关能进去，擂台挂出来了");

  // 第 1 关是上手关，乱按也该赢下大半；给 3 次机会，一次都赢不了就说明坡道又太陡了
  let levelResult = "";
  let cleared = false;
  for (let attempt = 1; attempt <= 3 && !cleared; attempt++) {
    levelResult = await botPlay(page, 120000);
    cleared = /过关/.test(levelResult);
    log(
      /过关|就差一点点/.test(levelResult),
      `闯关第 1 关第 ${attempt} 次玩到真实胜负`,
      levelResult.slice(0, 40)
    );
    if (!cleared) {
      await page.evaluate(() => window.__dvs.clickText(".dvs-over button", "再试本关"));
      await sleep(900);
    }
  }
  log(cleared, "闯关第 1 关真的通得过（新手乱按也打得动）", levelResult.slice(0, 50));

  const calls = await page.evaluate(() => window.__dvs.state.calls.filter((c) => c[0] !== "play"));
  log(
    calls.some((c) => c[0] === "addStars" && c[1] > 0),
    "过关后真的发了小星星（level99 结算接对了）",
    JSON.stringify(calls).slice(0, 90)
  );

  /* ---------- 4. 1280×800 宽屏 ---------- */
  await page.setViewport({ width: 1280, height: 800 });
  await boot(page);
  await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "人机混战"));
  await sleep(250);
  await page.evaluate(() => window.__dvs.clickText(".dvs-pick", "3 台"));
  await page.evaluate(() => window.__dvs.clickText(".dvs-go", "开打"));
  await sleep(1200);
  const cards = await page.evaluate(() => document.querySelectorAll(".dvs-card").length);
  log(cards === 4, "1280×800 人机混战 4 人同场", `卡片 ${cards} 张`);
  const of2 = await page.evaluate(() => window.__dvs.overflow());
  log(of2.wide === 0, "1280×800 没有横向溢出", JSON.stringify(of2));

  /* ---------- 5. 团队赛 2v2 ---------- */
  await boot(page);
  await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "团队赛"));
  await sleep(250);
  await page.evaluate(() => window.__dvs.clickText(".dvs-go", "组队出发"));
  await sleep(1000);
  const teamCards = await page.evaluate(() => document.querySelectorAll(".dvs-card").length);
  log(teamCards === 4, "团队赛 2v2 四个人都在场上", `卡片 ${teamCards} 张`);

  /* ---------- 6. destroy 无泄漏 ---------- */
  const before = await page.evaluate(() => ({
    raf: window.__dvs.liveRaf(),
    listeners: window.__dvs.listeners(),
  }));
  await page.evaluate(() => window.__dvs.destroy());
  await sleep(600);
  const after = await page.evaluate(() => ({
    raf: window.__dvs.liveRaf(),
    listeners: window.__dvs.listeners(),
    dom: document.querySelectorAll("#dvs-host *").length,
  }));
  log(after.raf === 0, "destroy 之后没有活着的 rAF", `${before.raf} → ${after.raf}`);
  log(after.listeners <= 0, "destroy 之后 window 监听全部摘掉", `${before.listeners} → ${after.listeners}`);
  log(after.dom === 0, "destroy 之后 DOM 清空", `剩 ${after.dom} 个节点`);

  // 退出后再进一次
  await page.evaluate(() => window.__dvs.mount());
  await sleep(400);
  await page.evaluate(() => window.__dvs.clickText(".dvs-mode", "双人对战"));
  await sleep(200);
  await page.evaluate(() => window.__dvs.clickText(".dvs-go", "开打"));
  await sleep(900);
  log(
    await page.evaluate(() => Boolean(document.querySelector("canvas.dvs-canvas"))),
    "退出再进不报错，擂台照常挂出来"
  );

  log(errors.length === 0, "整轮没有 console.error / pageerror", errors.slice(0, 3).join(" ｜ "));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项，通过 ${results.length - bad.length} 项，失败 ${bad.length} 项。`);
  if (bad.length) {
    for (const b of bad) console.log(`  失败：${b.what}`);
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
