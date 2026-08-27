/**
 * 窗口 1 · 第 1 轮验收走查(监督修复员自查用的真浏览器替身)。
 *
 * 一次跑完窗口 1 全部产物的「进得去、玩得动、退得干净」:
 *
 *   A. 平台层
 *      A1 root 门:密码 kangkang、电话 18438037080、1 小时过期、可手动关、
 *         **密码不落盘**(localStorage / sessionStorage / cookie / URL 全搜一遍)、直达第 N 关;
 *      A2 家长算术门原样还在(两道门各走各的);
 *      A3 首页手游 / 端游 / 全部三颗芯片能筛出东西且计数自洽;
 *      A4 首页搜索:每款都能用标题原文和**拼音首字母**搜到;
 *      A5 360×640 首页不横向溢出。
 *   B. 12 款逐个:从首页卡片真点进去 → 舞台画出东西 → 四种模式入口 →
 *      360px 不溢出 → 退回首页后 window 监听 / interval / timeout / rAF 全部归零。
 *   C. 全程 pageerror / console.error 一律记账。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   node scripts/smoke-1.2-window1-round1.mjs          # ONLY=orb-arena,merge-2048 可只跑几款
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };

const GAMES = [
  ["orb-arena", "圆圆大作战"],
  ["snake-royale", "长蛇争霸"],
  ["block-drop", "方块叠叠乐"],
  ["combo-clash", "连招对决"],
  ["mahjong-bloom", "花开麻将"],
  ["star-estate", "朵星地产"],
  ["hero-cards", "英杰令"],
  ["weiqi-garden", "围子花园"],
  ["flight-chess", "飞行棋乐园"],
  ["merge-2048", "星星合成"],
  ["mine-garden", "扫雷花园"],
  ["sudoku-petal", "数独花田"]
];

const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const targets = only.length ? GAMES.filter(([id]) => only.includes(id)) : GAMES;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

/** 在页面里装上监听 / 定时器 / rAF 的计数器,用来量 destroy 有没有漏 */
const INSTALL_COUNTERS = () => {
  const w = window;
  if (w.__leak) return;
  const leak = { listeners: new Map(), intervals: new Set(), timeouts: new Set(), rafs: new Set() };
  w.__leak = leak;
  for (const target of [window, document]) {
    const name = target === window ? "window" : "document";
    const add = target.addEventListener.bind(target);
    const rm = target.removeEventListener.bind(target);
    target.addEventListener = function (type, fn, opts) {
      const key = `${name}:${type}`;
      leak.listeners.set(key, (leak.listeners.get(key) ?? 0) + 1);
      return add(type, fn, opts);
    };
    target.removeEventListener = function (type, fn, opts) {
      const key = `${name}:${type}`;
      leak.listeners.set(key, (leak.listeners.get(key) ?? 0) - 1);
      return rm(type, fn, opts);
    };
  }
  const si = w.setInterval.bind(w);
  const ci = w.clearInterval.bind(w);
  w.setInterval = function (...a) {
    const id = si(...a);
    leak.intervals.add(id);
    return id;
  };
  w.clearInterval = function (id) {
    leak.intervals.delete(id);
    return ci(id);
  };
  const st = w.setTimeout.bind(w);
  const ct = w.clearTimeout.bind(w);
  w.setTimeout = function (fn, ms, ...rest) {
    let id;
    const wrapped = typeof fn === "function" ? (...args) => { leak.timeouts.delete(id); return fn(...args); } : fn;
    id = st(wrapped, ms, ...rest);
    leak.timeouts.add(id);
    return id;
  };
  w.clearTimeout = function (id) {
    leak.timeouts.delete(id);
    return ct(id);
  };
  const rq = w.requestAnimationFrame.bind(w);
  const cq = w.cancelAnimationFrame.bind(w);
  w.requestAnimationFrame = function (fn) {
    let id;
    id = rq((...args) => { leak.rafs.delete(id); return fn(...args); });
    leak.rafs.add(id);
    return id;
  };
  w.cancelAnimationFrame = function (id) {
    leak.rafs.delete(id);
    return cq(id);
  };
};

const READ_LEAK = () => {
  const leak = window.__leak;
  const listeners = {};
  for (const [k, v] of leak.listeners) if (v !== 0) listeners[k] = v;
  return {
    listeners,
    intervals: leak.intervals.size,
    timeouts: leak.timeouts.size,
    rafs: leak.rafs.size
  };
};

/**
 * 横向溢出:有没有元素伸出 360px 之外。
 * 横滑条(章节页签、芯片排)是故意能横滑的,它们的孩子伸出去不算病 ——
 * 只要祖先里有一个 overflow-x 是 auto/scroll 就跳过。
 */
const OVERFLOW = () => {
  const w = document.documentElement.clientWidth;
  const scrollable = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= w + 1 && r.left >= -1) continue;
    if (scrollable(el)) continue;
    bad.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}@${Math.round(r.left)}..${Math.round(r.right)}`);
  }
  return {
    docWidth: w,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScroll: document.body.scrollWidth,
    bad: bad.slice(0, 6)
  };
};

/** 正文字号下限:说明类文字 ≥ 16px,按钮 / 格子数字放到 14px */
const SMALL_TEXT = () => {
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.children.length > 0) continue;
    const t = (el.textContent ?? "").trim();
    if (t.length < 6) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    const size = parseFloat(st.fontSize);
    const isButton = el.closest("button") !== null;
    if (size < (isButton ? 14 : 16) - 0.01) {
      bad.push(`${(el.className || el.tagName).toString().split(" ")[0]}=${size}px "${t.slice(0, 12)}"`);
    }
  }
  return bad.slice(0, 6);
};

async function newPage(browser, errors) {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text().slice(0, 200)}`);
  });
  await page.evaluateOnNewDocument(INSTALL_COUNTERS);
  return page;
}

async function gotoHome(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".game-card", { timeout: 20000 });
  await sleep(250);
}

/** 按标题点开首页那张卡(真鼠标点,不走任何测试后门) */
async function openCardByTitle(page, title) {
  const clicked = await page.evaluate((t) => {
    const cards = [...document.querySelectorAll(".game-card")];
    const hit = cards.find((c) => c.querySelector(".card-title")?.textContent?.trim() === t);
    if (!hit) return false;
    hit.scrollIntoView({ block: "center" });
    return true;
  }, title);
  if (!clicked) return false;
  await sleep(120);
  const box = await page.evaluate((t) => {
    const cards = [...document.querySelectorAll(".game-card")];
    const hit = cards.find((c) => c.querySelector(".card-title")?.textContent?.trim() === t);
    const r = hit.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + Math.min(28, r.height / 2) };
  }, title);
  await page.mouse.click(box.x, box.y);
  await sleep(900);
  return true;
}

async function backHome(page) {
  await page.evaluate(() => {
    const b = document.querySelector(".btn--back");
    if (b) b.click();
  });
  await sleep(700);
  // 有的游戏退出时会弹确认
  await page.evaluate(() => {
    for (const b of document.querySelectorAll(".dialog button, .dialog-btn")) {
      if (/回首页|确定|退出|好的/.test(b.textContent ?? "")) { b.click(); return; }
    }
  });
  await sleep(600);
}

// ---------------------------------------------------------------------------

async function platformChecks(page, errors) {
  console.log("\n=== A. 平台层 ===");
  await gotoHome(page);

  // A5 首页 360px 不溢出
  const ov = await page.evaluate(OVERFLOW);
  log(ov.bad.length === 0 && ov.scrollWidth <= ov.docWidth + 1, "A5-1 首页 360px 不横向溢出",
    ov.bad.length ? ov.bad.join(", ") : `scrollWidth=${ov.scrollWidth}`);
  const homeSmall = await page.evaluate(SMALL_TEXT);
  log(homeSmall.length === 0, "A5-2 首页 360px 正文 ≥16px / 按钮 ≥14px", homeSmall.join(", "));

  // A3 平台芯片
  const chips = await page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="设备筛选"]');
    if (!bar) return null;
    return [...bar.querySelectorAll("button")].map((b) => b.textContent.trim());
  });
  log(!!chips && chips.length === 3, "A3-1 首页有三颗设备筛选芯片", JSON.stringify(chips));

  const counts = {};
  for (const label of ["全部", "手游", "端游"]) {
    await page.evaluate((l) => {
      const bar = document.querySelector('nav[aria-label="设备筛选"]');
      [...bar.querySelectorAll("button")].find((b) => b.textContent.includes(l))?.click();
    }, label);
    await sleep(350);
    counts[label] = await page.evaluate(() => document.querySelectorAll(".game-card").length);
  }
  log(counts["手游"] > 0 && counts["端游"] > 0, "A3-2 手游 / 端游都能筛出游戏", JSON.stringify(counts));
  log(counts["手游"] <= counts["全部"] && counts["端游"] <= counts["全部"],
    "A3-3 筛出来的不多于全部", JSON.stringify(counts));

  // A4 搜索:标题原文 + 拼音首字母
  // 上面那个循环最后停在「端游」上,得先扳回「全部」再搜 ——
  // 12 款原来清一色 platform:"both",端游筛选下也全在,所以这个漏子一直没露头;
  // 芯片真能区分设备之后(7 款是手游独占),留着端游去搜手游款,搜不到才是对的。
  await page.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="设备筛选"]');
    [...bar.querySelectorAll("button")].find((b) => b.textContent.includes("全部"))?.click();
  });
  await sleep(350);
  const allCount = await page.evaluate(() => document.querySelectorAll(".game-card").length);
  log(allCount === counts["全部"], "A4-0 搜索前已经扳回「全部」芯片", `${allCount} 张卡`);

  for (const [id, title] of targets) {
    for (const kind of ["title", "pinyin"]) {
      const term = kind === "title" ? title : await page.evaluate(async (t) => {
        const mod = await import("/src/ui/homeFilters.ts");
        return mod.pinyinInitials(t);
      }, title);
      const found = await page.evaluate(async (t, q) => {
        const input = document.querySelector(".home-search-input");
        input.value = q;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise((r) => setTimeout(r, 260));
        return [...document.querySelectorAll(".card-title")].some((c) => c.textContent.trim() === t);
      }, title, term);
      log(found, `A4 搜「${term || "(空)"}」能搜到 ${title}`, kind === "pinyin" ? `拼音首字母="${term}"` : "");
    }
  }
  await page.evaluate(() => {
    const input = document.querySelector(".home-search-input");
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(250);

  // A2 家长算术门还在
  const parentOk = await page.evaluate(async () => {
    document.querySelector('[aria-label="家长说明"]')?.click();
    await new Promise((r) => setTimeout(r, 400));
    const text = document.body.innerText;
    const has = /家长/.test(text);
    for (const b of document.querySelectorAll("button")) {
      if (/关闭|好的|知道/.test(b.textContent ?? "")) { b.click(); break; }
    }
    await new Promise((r) => setTimeout(r, 300));
    return has;
  });
  log(parentOk, "A2-1 家长面板还能打开");

  const arith = await page.evaluate(async () => {
    const mod = await import("/src/ui/parentAuth.ts");
    return { keys: Object.keys(mod), src: typeof mod.requestParentAuth };
  });
  log(arith.src === "function", "A2-2 算术家长门 requestParentAuth 原样还在", JSON.stringify(arith.keys));

  // A1 root 门
  console.log("--- A1 root 管理员门");
  const adminBtn = await page.evaluate(() => !!document.querySelector('[aria-label="管理员权限"]'));
  log(adminBtn, "A1-1 首页有管理员权限入口");

  await page.evaluate(() => document.querySelector('[aria-label="管理员权限"]').click());
  await sleep(450);
  const dlg = await page.evaluate(() => {
    const t = document.body.innerText;
    const input = document.querySelector(".rootgate-input");
    return {
      phone: t.includes("要打开请联系管理员 18438037080"),
      type: input?.type,
      buttons: [...document.querySelectorAll(".rootgate-btn")].map((b) => b.textContent.trim())
    };
  });
  log(dlg.phone, "A1-2 弹窗有原话「要打开请联系管理员 18438037080」");
  log(dlg.type === "password", "A1-3 输入框 type=password", String(dlg.type));

  // 错一次
  await page.evaluate(() => {
    const i = document.querySelector(".rootgate-input");
    i.value = "wrong";
  });
  await page.evaluate(() => [...document.querySelectorAll(".rootgate-btn")].find((b) => b.textContent.trim() === "打开").click());
  await sleep(300);
  const stillClosed = await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    return !c.isRootOpen();
  });
  log(stillClosed, "A1-4 密码错不开门");

  // 对的密码
  await page.evaluate(() => { document.querySelector(".rootgate-input").value = "kangkang"; });
  await page.evaluate(() => [...document.querySelectorAll(".rootgate-btn")].find((b) => b.textContent.trim() === "打开").click());
  await sleep(500);
  const opened = await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    return { open: c.isRootOpen(), remain: c.rootRemainMs() };
  });
  log(opened.open, "A1-5 密码 kangkang 能开门");
  log(opened.remain > 59 * 60 * 1000 && opened.remain <= 60 * 60 * 1000,
    "A1-6 有效期就是 1 小时", `remain=${Math.round(opened.remain / 1000)}s`);

  // 密码不落盘:localStorage / sessionStorage / cookie / URL 全搜
  const leakPw = await page.evaluate(() => {
    const hay = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      hay.push(k, localStorage.getItem(k) ?? "");
    }
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      hay.push(k, sessionStorage.getItem(k) ?? "");
    }
    hay.push(document.cookie, location.href, document.documentElement.outerHTML);
    return { hit: hay.some((s) => String(s).includes("kangkang")), keys: Object.keys(localStorage) };
  });
  log(!leakPw.hit, "A1-7 密码 kangkang 不落盘(localStorage/session/cookie/URL/DOM 全搜)",
    JSON.stringify(leakPw.keys));

  const stored = await page.evaluate(() => localStorage.getItem("yiduo-yixing.root.v1"));
  log(!!stored && /^\{"expiresAt":\d+\}$/.test(stored), "A1-8 存档里只有 expiresAt", String(stored));

  // 1 小时过期(改存档里的 expiresAt,不真等)
  const expired = await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    const before = c.isRootOpen();
    const after = c.isRootOpen(Date.now() + 60 * 60 * 1000 + 1);
    return { before, after, cleared: localStorage.getItem("yiduo-yixing.root.v1") };
  });
  log(expired.before && !expired.after, "A1-9 推进 1 小时后自动关闭");
  log(expired.cleared === null, "A1-10 过期后存档记录被清掉", String(expired.cleared));

  // 手动关
  const manual = await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    c.getRoot12Extras().closeRoot?.();
    return c.isRootOpen();
  });
  log(!manual, "A1-11 可以手动关闭管理员权限");

  return { counts };
}

/** 直达第 N 关:root 开着时选关地图上要有控件,能直接进第 100 / 188 关 */
async function rootJumpChecks(page, id, title) {
  await gotoHome(page);
  await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    c.writeRootSession(Date.now() + 60 * 60 * 1000);
  });
  await gotoHome(page);
  if (!(await openCardByTitle(page, title))) return log(false, `A1-12 ${title} 进不去,没法验直达`);

  const has = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type="number"]')];
    const jump = inputs.find((i) => i.max === "188");
    return { found: !!jump, count: inputs.length };
  });
  log(has.found, `A1-12 ${title} root 开着时选关地图有「直达第 N 关」控件`, JSON.stringify(has));

  if (has.found) {
    for (const target of [100, 188]) {
      const got = await page.evaluate(async (n) => {
        const input = [...document.querySelectorAll('input[type="number"]')].find((i) => i.max === "188");
        input.value = String(n);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const btn = [...document.querySelectorAll("button")].find((b) => /直达/.test(b.textContent ?? ""));
        btn?.click();
        await new Promise((r) => setTimeout(r, 900));
        return document.body.innerText.includes(`第 ${n} 关`) || document.body.innerText.includes(`${n}/188`);
      }, target);
      log(got, `A1-13 ${title} 能直达第 ${target} 关`);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) => /选关|关卡地图|返回选关/.test(x.textContent ?? ""));
        b?.click();
      });
      await sleep(500);
    }
  }

  // 直达不篡改星级
  const stars = await page.evaluate((gid) => localStorage.getItem(`yiduo-yixing.l99.${gid}`), id);
  const dirty = stars ? JSON.parse(stars).some?.((s, i) => i >= 99 && s > 0) : false;
  log(!dirty, `A1-14 ${title} 直达没有偷偷写星级`, String(stars).slice(0, 80));

  await backHome(page);
  await page.evaluate(async () => {
    const c = await import("/src/ui/root12Contract.ts");
    c.clearRootSession();
  });
}

async function gameChecks(page, id, title) {
  console.log(`\n=== B. ${title} (${id}) ===`);
  await gotoHome(page);

  const before = await page.evaluate(READ_LEAK);

  if (!(await openCardByTitle(page, title))) {
    return log(false, `B-1 ${title} 首页找不到卡片`);
  }
  const entered = await page.evaluate(() => ({
    stage: !!document.querySelector(".game-stage"),
    title: document.querySelector(".game-title-text")?.textContent?.trim(),
    painted: (document.querySelector(".game-stage")?.innerHTML ?? "").length
  }));
  log(entered.stage && entered.title === title, `B-1 ${title} 从首页卡片进得去`, JSON.stringify(entered).slice(0, 120));
  log(entered.painted > 200, `B-2 ${title} 舞台真画出东西`, `stageHTML=${entered.painted}`);

  const ov = await page.evaluate(OVERFLOW);
  log(ov.bad.length === 0, `B-3 ${title} 360px 不横向溢出`, ov.bad.join(", "));

  const small = await page.evaluate(SMALL_TEXT);
  log(small.length === 0, `B-3b ${title} 360px 正文 ≥16px / 按钮 ≥14px`, small.join(", "));

  // 四种模式入口:按 meta.modes 声明的口径逐条对 DOM
  const modes = await page.evaluate(async (gid) => {
    const meta = (await import(`/src/games/${gid}/meta.ts`)).meta;
    const stage = document.querySelector(".game-stage");
    const text = stage?.innerText ?? "";
    const btns = [...stage.querySelectorAll("button")].map((b) => b.textContent.trim());
    const hit = (re) => btns.some((b) => re.test(b));
    return {
      declared: [...(meta.modes ?? [])],
      campaign: !!stage.querySelector(".l99-tab, .l99-continue") || /关$|\/188/.test(text),
      // 各款自己起的名字五花八门(「短盘连胜」「身份场 1v4」),
      // 但表情前缀是统一的:🤝 对战、♾️ 无尽、👫 双人同屏
      versus: hit(/^🤝|混战|对战|挑战|比赛|竞速|对决|争霸|擂台/),
      endless: hit(/^♾️|^🔥|无尽|马拉松|连胜|连续|不停/),
      duo: hit(/^👫|双人|同屏|两个人/)
    };
  }, id);
  const need = { campaign: "campaign", versus: "versus", endless: "endless", duo: "twoPlayer" };
  const missing = Object.entries(need)
    .filter(([k, m]) => modes.declared.includes(m) && !modes[k])
    .map(([k]) => k);
  log(missing.length === 0, `B-4 ${title} meta 声明的模式都有入口`,
    `declared=${modes.declared.join("/")} missing=${missing.join(",") || "无"}`);

  await backHome(page);
  await sleep(500);
  const after = await page.evaluate(READ_LEAK);
  const dl = {};
  for (const k of new Set([...Object.keys(before.listeners), ...Object.keys(after.listeners)])) {
    const d = (after.listeners[k] ?? 0) - (before.listeners[k] ?? 0);
    if (d !== 0) dl[k] = d;
  }
  const leaked = Object.keys(dl).length > 0 || after.intervals > before.intervals || after.rafs > before.rafs;
  log(!leaked, `B-5 ${title} destroy 无泄漏`,
    JSON.stringify({ listeners: dl, intervals: [before.intervals, after.intervals], rafs: [before.rafs, after.rafs] }));
}

// ---------------------------------------------------------------------------

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"]
});
try {
  const page = await newPage(browser, errors);
  await platformChecks(page, errors);
  await rootJumpChecks(page, targets[0][0], targets[0][1]);
  for (const [id, title] of targets) await gameChecks(page, id, title);
} finally {
  await browser.close();
}

console.log("\n=== C. 控制台 ===");
const uniq = [...new Set(errors)];
log(uniq.length === 0, "C 全程无 pageerror / console.error", uniq.slice(0, 8).join(" | "));

const bad = results.filter((r) => !r.ok);
console.log(`\n合计 ${results.length} 项,失败 ${bad.length} 项`);
for (const b of bad) console.log(`  FAIL ${b.what}`);
process.exit(bad.length ? 1 : 0);
