/**
 * 窗口 1 · 第 1 轮测试员的走查脚本(只读取证,不改玩法代码)。
 *
 * 用真浏览器(360×640 最窄屏)把窗口 1 的产物从首页走一遍:
 *
 *   A. 首页清点:12 款新游戏的卡片靠 import.meta.glob 自己冒出来,点得进去;
 *   B. 平台专项:
 *      A1 root 管理员门 —— 密码 kangkang、电话 18438037080、连错 3 次锁 120 秒、
 *         只写 yiduo-yixing.root.v1 = { expiresAt }、密码不落盘、可手动关、1 小时过期(假时钟);
 *      A2 直达第 N 关 —— 门关着连控件都没有,门开着能直达 1 / 100 / 188,越界自动夹;
 *      A3 家长算术门原样保留;
 *      B1 手游 / 端游筛选与分类、玩法、搜索四条件叠加,缺省 platform 当 both;
 *      C1 view25d 是自己写的透视数学,页面里没有 three.js;
 *   C. 12 款逐款:战役第 1 / 100 / 188 关、真实胜负各一次、对战 / 无尽 / 双人各玩到结算、
 *      双人键位(朵朵 WASD+F+G,星星 方向键+L+K)、360px 不溢出、退出再进不泄漏。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core
 *   npx vite --port 5185
 *   node scripts/smoke-1.2-window1-r1-tester.mjs
 *
 * 只跑其中一段:PART=A|B|C,只跑某几款:IDS=orb-arena,block-drop
 * PART=W 是「补过关证据」专场:只拿通用假人反复打第 1 关,预算给足(WIN_MS / WIN_ROUNDS 可调)
 * 它连着 dev server 跑源码,点的是真按钮、按的是真键盘,不走任何测试后门。
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://127.0.0.1:5185";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const VIEWPORT = { width: 360, height: 640 };
const PARTS = (process.env.PART ?? "ABC").toUpperCase();
const ROOT_KEY = "yiduo-yixing.root.v1";
const PASSWORD = "kangkang";
const PHONE = "18438037080";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

// ---------------------------------------------------------------------------
// 12 款的操作配方:每款怎么按、怎么点,才算真在玩
// ---------------------------------------------------------------------------

/** duo = 同屏双人;有的款没有双人(英杰令是身份场,两个人挤一屏会互相看光牌) */
const GAMES = [
  {
    id: "orb-arena",
    title: "圆圆大作战",
    p: "oa",
    modes: ["🤝 圆圆混战", "♾️ 缩圈无尽", "👫 双人同屏"],
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".oa-btn"],
    canvas: true
  },
  {
    id: "snake-royale",
    title: "长蛇争霸",
    p: "sr",
    modes: ["🤝 原野混战", "♾️ 缩圈无尽", "👫 双人同屏"],
    keys: ["KeyW", "KeyD", "KeyS", "KeyA", "KeyF", "KeyG"],
    clicks: [".sr-btn"],
    canvas: true
  },
  {
    id: "block-drop",
    title: "方块叠叠乐",
    p: "bd",
    modes: ["🤝 对战发行", "♾️ 马拉松 / 竞速", "👫 双人同屏"],
    keys: ["KeyA", "KeyD", "KeyW", "KeyS", "KeyF", "KeyG"],
    clicks: [".bd-btn"],
    canvas: true
  },
  {
    id: "combo-clash",
    title: "连招对决",
    p: "cc",
    modes: ["🤝 人机对战", "♾️ 连胜无尽", "👫 双人同屏", "🎯 训练场"],
    keys: ["KeyD", "KeyF", "KeyG", "KeyW", "KeyA", "KeyF", "KeyF"],
    clicks: [".cc-btn"],
    canvas: true
  },
  {
    id: "mahjong-bloom",
    title: "花开麻将",
    p: "mj",
    modes: ["🀄 对战一桌", "♾️ 快棋无尽", "👫 双人同桌"],
    keys: ["KeyA", "KeyD", "KeyF"],
    clicks: [".mj-tile", ".mj-btn:not(.mj-ghost)"],
    tier: true
  },
  {
    id: "star-estate",
    title: "朵星地产",
    p: "se",
    modes: ["🤝 对战 1v3", "♾️ 短盘连胜", "👫 双人同屏"],
    keys: ["KeyF", "KeyG", "KeyD"],
    clicks: [".se-btn"],
    tier: true
  },
  {
    id: "hero-cards",
    title: "英杰令",
    p: "hc",
    modes: ["🤝 身份场 1v4", "♾️ 连胜无尽"],
    keys: ["KeyA", "KeyD", "KeyF", "KeyG"],
    clicks: [".hc-card", ".hc-seat", ".hc-btn"],
    tier: true
  },
  {
    id: "weiqi-garden",
    title: "围子花园",
    p: "wq",
    modes: ["🤖 自由对战", "🔥 连胜无尽", "👫 双人同屏"],
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [],
    canvas: true,
    tier: true
  },
  {
    id: "flight-chess",
    title: "飞行棋乐园",
    p: "fc",
    modes: ["🤝 四人对战", "♾️ 连胜无尽", "👫 双人同屏"],
    keys: ["KeyF", "KeyD"],
    clicks: [".fc-btn-go", ".fc-pick", ".fc-token"],
    tier: true
  },
  {
    id: "merge-2048",
    title: "星星合成",
    p: "mg",
    modes: ["🤝 对战竞速", "♾️ 马拉松", "👫 双人同屏"],
    keys: ["KeyA", "KeyW", "KeyD", "KeyS"],
    clicks: [],
    boardSel: ".mg-board"
  },
  {
    id: "mine-garden",
    title: "扫雷花园",
    p: "mn",
    modes: ["🤖 竞速对战", "🔥 连续清盘", "👫 双人同屏"],
    keys: ["KeyD", "KeyS", "KeyF"],
    clicks: [".mn-cell"],
    tier: true
  },
  {
    id: "sudoku-petal",
    title: "数独花田",
    p: "sp",
    modes: ["🤝 对战竞速", "♾️ 花田马拉松", "👫 双人同屏"],
    keys: ["KeyD", "KeyS", "Digit1", "Digit2", "Digit3", "KeyF"],
    clicks: [".sp-cell", ".sp-key"],
    tier: true
  }
];

const WANT_IDS = process.env.IDS ? process.env.IDS.split(",") : null;
const PICKED = WANT_IDS ? GAMES.filter((g) => WANT_IDS.includes(g.id)) : GAMES;

// ---------------------------------------------------------------------------
// 页面小工具
// ---------------------------------------------------------------------------

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const bad = [...document.querySelectorAll("body *")].filter(
      (el) => el.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(el).position !== "fixed"
    );
    return { doc: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 3).map((el) => el.className || el.tagName) };
  });
}

/**
 * 舞台上有没有结算浮层:战役走 `.l99-ov-title`,模式页走 `.<前缀>-over-t`。
 * 进模式时框架只是把选关那一层 `hidden` 起来、DOM 还留着,
 * 所以藏起来的浮层一律不算数,免得把上一局的战果当成这一局的。
 */
async function verdict(page, p) {
  return page.evaluate((prefix) => {
    const shown = (el) => el && !el.closest("[hidden]") && el.getClientRects().length > 0;
    const sels = [".l99-ov-title", `.${prefix}-over-t`, "[class*='over-t']", "[class*='-ov-title']"];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (!shown(el)) continue;
        const t = el.textContent?.trim() ?? "";
        if (t) return t;
      }
    }
    return "";
  }, p);
}

/** 舞台指纹:DOM 结构 + canvas 像素,用来判断游戏还在不在动 */
async function fingerprint(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".game-stage") ?? document.querySelector("#app");
    let out = String(stage?.innerHTML?.length ?? 0) + "|" + (stage?.textContent ?? "").replace(/\s+/g, " ");
    for (const c of document.querySelectorAll("canvas")) {
      try {
        const url = c.toDataURL();
        out += "|" + url.length + ":" + url.slice(-48);
      } catch {
        out += "|x";
      }
    }
    return out;
  });
}

/**
 * 模式页的开局流程都是同一套:选档 / 选盘面 / 选目标,一层层的 `.<前缀>-open`,
 * 点到没得选为止就是真盘面了。
 */
async function pickThrough(page, prefix, maxDepth = 4) {
  let picked = 0;
  for (let i = 0; i < maxDepth; i++) {
    const hit = await page.evaluate((p) => {
      // 「← 回闯关」也顶着 .<前缀>-open 这个类,点下去会一路退回选关页,要躲开
      const back = /回闯关|返回|选关|攻略|暂停|←/;
      const btns = [...document.querySelectorAll(`.${p}-open`)].filter(
        (b) =>
          !b.closest("[hidden]") &&
          b.getClientRects().length > 0 &&
          !b.disabled &&
          !back.test(b.textContent ?? "")
      );
      if (btns.length === 0) return false;
      // 有「开始 ▶」就直接开局,难度那一排通常已经有默认选中
      const go = btns.find((b) => /开始|开局|▶/.test(b.textContent ?? ""));
      (go ?? btns[0]).click();
      return true;
    }, prefix);
    if (!hit) break;
    picked += 1;
    await sleep(600);
  }
  return picked;
}

/** 把 188 关存档铺到第 n 关可玩,然后整页重载进这一关 */
async function openLevel(page, id, n) {
  await page.evaluate(
    ([key, target]) => {
      localStorage.setItem(key, JSON.stringify(Array.from({ length: 188 }, (_, i) => (i < target - 1 ? 3 : 0))));
    },
    [`yiduo-yixing.l99.${id}`, n]
  );
  await page.goto(`${BASE}/?t=${Date.now()}#/game/${id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".l99-continue", { timeout: 20000 });
  await page.click(".l99-continue");
  await page.waitForSelector(".l99-stagetitle", { timeout: 15000 });
  await sleep(700);
  return page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
}

/** 回合制的款开局本来就静止:按几下方向键,看盘面动不动,用来代替「画面在不在动」 */
async function pokeMoves(page, g) {
  const before = await fingerprint(page);
  for (const k of g.keys.slice(0, 4)) {
    await page.keyboard.press(k).catch(() => {});
    await sleep(180);
  }
  return (await fingerprint(page)) !== before;
}

/**
 * 「玩一会儿」:按配方按键 + 点舞台里能点的东西,直到结算浮层出现或预算用完。
 * mode="idle" 时一根手指都不动,专门用来看这一关会不会自己判输。
 */
async function drive(page, g, { budgetMs = 26000, mode = "play" } = {}) {
  const t0 = Date.now();
  let acts = 0;
  let k = 0;
  while (Date.now() - t0 < budgetMs) {
    const v = await verdict(page, g.p);
    if (v) return { v, acts, ms: Date.now() - t0 };
    if (mode === "idle") {
      await sleep(700);
      continue;
    }
    // 键盘
    const key = g.keys[k % g.keys.length];
    k += 1;
    await page.keyboard.press(key).catch(() => {});
    acts += 1;
    // 点一个舞台里能点的东西(躲开返回 / 选关 / 模式入口 / 暂停 / 攻略)
    if (g.clicks.length > 0) {
      await page
        .evaluate(
          ([sels, prefix, seed]) => {
            const bad = /返回|选关|攻略|暂停|跳过|🎵|模式|Esc/;
            const pool = [];
            for (const s of sels) {
              for (const el of document.querySelectorAll(s)) {
                if (el.disabled) continue;
                if (el.className && String(el.className).includes(`${prefix}-open`)) continue;
                if (bad.test(el.textContent ?? "")) continue;
                const r = el.getBoundingClientRect();
                if (r.width < 4 || r.height < 4) continue;
                pool.push(el);
              }
            }
            if (pool.length === 0) return false;
            pool[seed % pool.length].click();
            return true;
          },
          [g.clicks, g.p, acts * 7 + 3]
        )
        .catch(() => {});
    }
    // 画布类的:在盘面上真点一下 / 划一下
    if (g.canvas || g.boardSel) {
      const sel = g.boardSel ?? "canvas";
      const box = await page.$eval(sel, (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }).catch(() => null);
      if (box && box.w > 8) {
        const fx = ((acts * 37) % 80) / 100 + 0.1;
        const fy = ((acts * 53) % 80) / 100 + 0.1;
        await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy).catch(() => {});
        await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy).catch(() => {});
      }
    }
    await sleep(140);
  }
  return { v: await verdict(page, g.p), acts, ms: Date.now() - t0 };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

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

  // 泄漏计数器:任何页面脚本之前挂上
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
  await sleep(1300);

  // =========================================================================
  // A. 首页清点
  // =========================================================================
  if (PARTS.includes("A")) {
    console.log("\n===== A. 首页清点 =====");
    const titles = await page.evaluate(() =>
      [...document.querySelectorAll(".card-title")].map((e) => e.textContent?.trim() ?? "")
    );
    for (const g of PICKED) {
      log(titles.includes(g.title), `首页自动发现「${g.title}」卡片`);
    }
    log(titles.length >= 67, `首页一共列出 ${titles.length} 张卡片(1.1 的 55 款 + 窗口们的新款)`);

    const chips = await page.evaluate(() =>
      [...document.querySelectorAll(".platform-chips .tab")].map((e) => e.textContent?.trim() ?? "")
    );
    log(
      chips.length === 3 && chips.some((c) => c.includes("全部")) && chips.some((c) => c.includes("手游")) && chips.some((c) => c.includes("端游")),
      "平台芯片「全部 / 手游 / 端游」三颗都在",
      chips.join(" ")
    );
    const flow = await overflowX(page);
    log(flow.doc <= 1, "首页 360px 不横向溢出", `doc+${flow.doc} ${flow.bad}`);
  }

  // =========================================================================
  // B. 平台专项
  // =========================================================================
  if (PARTS.includes("B")) {
    console.log("\n===== B. 平台专项 =====");

    // ---- B1 手游 / 端游筛选 ----
    const chipCounts = async () => {
      const out = {};
      for (const [key, label] of [["all", "全部"], ["mobile", "手游"], ["desktop", "端游"]]) {
        await page.evaluate((t) => {
          const b = [...document.querySelectorAll(".platform-chips .tab")].find((x) => (x.textContent ?? "").includes(t));
          b?.click();
        }, label);
        await sleep(320);
        out[key] = await page.$$eval(".card-title", (e) => e.length);
      }
      return out;
    };
    const counts = await chipCounts();
    log(
      counts.all > 0 && counts.mobile > 0 && counts.desktop > 0,
      "三颗平台芯片都能筛出游戏",
      `全部 ${counts.all} / 手游 ${counts.mobile} / 端游 ${counts.desktop}`
    );
    log(
      counts.mobile === counts.all && counts.desktop === counts.all,
      "全库 platform 目前都是 both,所以手游 / 端游各自都能看到全部游戏(缺省当 both 的口径)",
      `全部 ${counts.all} / 手游 ${counts.mobile} / 端游 ${counts.desktop}`
    );

    // 缺省 platform 当 both:用纯函数直接对没写 platform 的 meta 求证
    const defaults = await page.evaluate(async () => {
      const F = await import("/src/ui/homeFilters.ts");
      const cases = [{}, { platform: "both" }, { platform: "什么鬼" }, { platform: undefined }];
      return cases.map((m) => [F.matchesPlatformChip(m, "mobile"), F.matchesPlatformChip(m, "desktop")]);
    });
    log(
      defaults.every(([a, b]) => a && b),
      "meta 不写 platform / 写 both / 写脏值,一律当两边都顺手",
      JSON.stringify(defaults)
    );
    const onlyOne = await page.evaluate(async () => {
      const F = await import("/src/ui/homeFilters.ts");
      return {
        mobile: [F.matchesPlatformChip({ platform: "mobile" }, "mobile"), F.matchesPlatformChip({ platform: "mobile" }, "desktop")],
        desktop: [F.matchesPlatformChip({ platform: "desktop" }, "mobile"), F.matchesPlatformChip({ platform: "desktop" }, "desktop")]
      };
    });
    log(
      onlyOne.mobile[0] && !onlyOne.mobile[1] && !onlyOne.desktop[0] && onlyOne.desktop[1],
      "只写 mobile / 只写 desktop 的 meta 只落到对应那一颗芯片上",
      JSON.stringify(onlyOne)
    );

    // 四条件叠加:分类 × 玩法 × 平台 × 搜索,页面结果与纯函数一致
    const combo = await page.evaluate(async () => {
      const L = await import("/src/engine/loader.ts");
      const F = await import("/src/ui/homeFilters.ts");
      const games = L.loadGames();
      const pick = (f) => F.filterGames(games, f).map((g) => g.meta.id);
      return {
        总数: games.length,
        对战手游: pick({ mode: "versus", platform: "mobile" }).length,
        休闲端游双人: pick({ tab: "casual", platform: "desktop", mode: "duo" }).length,
        搜索加平台: pick({ query: "数独", platform: "mobile" }),
        分类加玩法加平台加搜索: pick({ tab: "party", mode: "versus", platform: "desktop", query: "麻将" })
      };
    });
    log(
      combo.对战手游 > 0 && combo.休闲端游双人 > 0,
      "平台芯片可与分类页签、玩法芯片叠加",
      JSON.stringify({ 对战手游: combo.对战手游, 休闲端游双人: combo.休闲端游双人 })
    );
    log(
      combo.搜索加平台.includes("sudoku-petal") && combo.分类加玩法加平台加搜索.includes("mahjong-bloom"),
      "平台芯片可与搜索叠加,四条件一起也对得上",
      `${combo.搜索加平台.join(",")} / ${combo.分类加玩法加平台加搜索.join(",")}`
    );

    // 拼音首字母搜索:1.1 就有的能力,新游戏的标题用字要补进 PINYIN_INITIALS 才搜得到
    const pinyin = await page.evaluate(async (list) => {
      const F = await import("/src/ui/homeFilters.ts");
      return list.map(([id, title]) => ({
        id,
        title,
        initials: F.pinyinInitials(title),
        keys: F.searchKeys({ id, title })
      }));
    }, GAMES.map((g) => [g.id, g.title]));
    const broken = pinyin.filter((x) => x.initials.length < [...x.title].filter((c) => /[\u4e00-\u9fa5]/.test(c)).length);
    log(
      broken.length === 0,
      "12 款新游戏都能用拼音首字母搜到(标题用字都补进了 PINYIN_INITIALS)",
      broken.map((x) => `${x.title}→"${x.initials}"`).join(" ")
    );

    // 真点一遍:分类 party + 玩法 对战 + 平台 手游 + 搜索,页面上真的收窄
    await page.evaluate(() => {
      const hit = (sel, t) => [...document.querySelectorAll(sel)].find((x) => (x.textContent ?? "").includes(t))?.click();
      hit(".cat-tabs .tab", "聚会");
      hit(".mode-chips .tab", "对战");
      hit(".platform-chips .tab", "手游");
    });
    await sleep(350);
    const narrowed = await page.$$eval(".card-title", (e) => e.map((x) => x.textContent));
    await page.type(".home-search-input", "麻将");
    await sleep(400);
    const searched = await page.$$eval(".card-title", (e) => e.map((x) => x.textContent));
    log(
      narrowed.length > 0 && narrowed.length < combo.总数 && searched.length > 0 && searched.length < narrowed.length,
      "首页真点:聚会 + 对战 + 手游 + 搜索四条件一层层收窄",
      `${combo.总数} → ${narrowed.length} → ${searched.length}(${searched.join(",")})`
    );
    const flow1 = await overflowX(page);
    log(flow1.doc <= 1, "四条件筛完后 360px 仍不溢出", `doc+${flow1.doc}`);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await sleep(900);

    // ---- A1 root 管理员门 ----
    console.log("\n----- root 管理员门 -----");
    const openGate = async () => {
      await page.evaluate(() => document.querySelector(".icon-btn--admin")?.click());
      await page.waitForSelector(".rootgate", { timeout: 8000 });
      await sleep(220);
    };
    const gateText = () => page.$eval(".rootgate", (el) => el.textContent ?? "").catch(() => "");
    const closeGate = () =>
      page.evaluate(() => {
        const b = [...document.querySelectorAll(".rootgate-btn")].find((x) => x.textContent?.includes("不打开"));
        b?.click();
      });

    log(await page.evaluate(() => Boolean(document.querySelector(".icon-btn--admin"))), "首页有管理员入口 🔑");
    await openGate();
    const t = await gateText();
    log(t.includes(`要打开请联系管理员 ${PHONE}`), `弹窗原样出现「要打开请联系管理员 ${PHONE}」`);
    log(
      await page.$eval(".rootgate-input", (el) => el.type === "password"),
      "密码框是 password 类型(输进去看不见)"
    );

    // 连错 3 次 → 锁 120 秒
    for (let i = 0; i < 3; i++) {
      await page.click(".rootgate-input");
      await page.type(".rootgate-input", `wrong${i}`);
      await page.evaluate(() => {
        [...document.querySelectorAll(".rootgate-btn")].find((x) => x.textContent === "打开")?.click();
      });
      await sleep(220);
    }
    const locked = await page.evaluate(() => ({
      tip: document.querySelector(".rootgate-tip")?.textContent ?? "",
      inputOff: document.querySelector(".rootgate-input")?.disabled ?? false,
      okOff: [...document.querySelectorAll(".rootgate-btn")].find((x) => x.textContent === "打开")?.disabled ?? false
    }));
    const sec = Number(/歇 (\d+) 秒/.exec(locked.tip)?.[1] ?? 0);
    log(
      locked.inputOff && locked.okOff && sec >= 110 && sec <= 120,
      "连错 3 次锁 120 秒,输入框与「打开」都禁用",
      `${locked.tip} inputOff=${locked.inputOff} okOff=${locked.okOff}`
    );
    // 锁着的时候连正确密码也不吃
    const stillLocked = await page.evaluate(async (pw) => {
      const R = await import("/src/ui/rootGate.ts");
      const C = await import("/src/ui/root12Contract.ts");
      const a = R.submitRootPassword(pw, Date.now());
      return { ok: a.ok, locked: a.locked, open: C.isRootOpen(Date.now()) };
    }, PASSWORD);
    log(!stillLocked.ok && stillLocked.locked && !stillLocked.open, "锁定期内密码对了也不给开", JSON.stringify(stillLocked));
    // 假时钟推过 120 秒就解锁(不真等)
    const unlocked = await page.evaluate(async (pw) => {
      const R = await import("/src/ui/rootGate.ts");
      const C = await import("/src/ui/root12Contract.ts");
      const later = Date.now() + 121 * 1000;
      const a = R.submitRootPassword(pw, later);
      const open = C.isRootOpen(later);
      R.resetRootGate();
      return { ok: a.ok, open };
    }, PASSWORD);
    log(unlocked.ok && unlocked.open, "假时钟推过 120 秒后密码又能用了(不真等)", JSON.stringify(unlocked));
    await closeGate();
    await sleep(300);

    // 真在弹窗里打对密码
    await openGate();
    await page.click(".rootgate-input");
    await page.type(".rootgate-input", PASSWORD);
    await page.keyboard.press("Enter");
    await sleep(400);
    const store = await page.evaluate((key) => {
      const all = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        all[k] = localStorage.getItem(k);
      }
      const ss = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        ss[k] = sessionStorage.getItem(k);
      }
      return { all, ss, raw: localStorage.getItem(key), cookie: document.cookie, href: location.href };
    }, ROOT_KEY);
    let parsed = null;
    try {
      parsed = JSON.parse(store.raw ?? "null");
    } catch {
      parsed = null;
    }
    log(parsed !== null && typeof parsed.expiresAt === "number", `密码对了就开门,只写 ${ROOT_KEY}`, store.raw ?? "(空)");
    log(
      parsed !== null && Object.keys(parsed).length === 1,
      `${ROOT_KEY} 里只有 expiresAt 一个字段`,
      JSON.stringify(parsed)
    );
    const ttl = parsed ? parsed.expiresAt - Date.now() : 0;
    log(ttl > 59 * 60 * 1000 && ttl <= 60 * 60 * 1000 + 5000, "过期时间正好是一小时之后", `${Math.round(ttl / 60000)} 分钟`);
    const dump = JSON.stringify(store.all) + JSON.stringify(store.ss) + store.cookie + store.href;
    log(!dump.includes(PASSWORD), "密码绝不落盘:localStorage / sessionStorage / cookie / URL 里都搜不到");
    log(
      await page.evaluate(() => (document.querySelector(".rootgate-input")?.value ?? "") === ""),
      "弹窗关掉时输入框里的字符也抹干净了(DOM 里不留密码)"
    );

    // 1 小时过期:假时钟推过去
    const expired = await page.evaluate(async () => {
      const C = await import("/src/ui/root12Contract.ts");
      const now = Date.now();
      const beforeExpiry = C.isRootOpen(now + 59 * 60 * 1000);
      const afterExpiry = C.isRootOpen(now + 60 * 60 * 1000 + 1000);
      const cleaned = localStorage.getItem("yiduo-yixing.root.v1");
      return { beforeExpiry, afterExpiry, cleaned };
    });
    log(
      expired.beforeExpiry && !expired.afterExpiry && expired.cleaned === null,
      "假时钟推到 1 小时后自动关闭,过期的会话连存档也一并清掉",
      JSON.stringify(expired)
    );

    // 手动关
    await page.evaluate(async () => {
      const R = await import("/src/ui/rootGate.ts");
      R.submitRootPassword("kangkang", Date.now());
    });
    await openGate();
    const hasClose = await page.evaluate(() =>
      [...document.querySelectorAll(".rootgate-btn")].some((x) => x.textContent?.includes("关闭管理员权限"))
    );
    await page.evaluate(() => {
      [...document.querySelectorAll(".rootgate-btn")].find((x) => x.textContent?.includes("关闭管理员权限"))?.click();
    });
    await sleep(300);
    const afterClose = await page.evaluate((k) => localStorage.getItem(k), ROOT_KEY);
    log(hasClose && afterClose === null, "门开着时弹窗多一颗「关闭管理员权限」,按下去当场关掉", `残留=${afterClose}`);
    const flowGate = await overflowX(page);
    log(flowGate.doc <= 1, "管理员弹窗 360px 不溢出", `doc+${flowGate.doc}`);

    // ---- A2 直达第 N 关 ----
    console.log("\n----- 直达第 N 关 -----");
    await page.evaluate(() => localStorage.removeItem("yiduo-yixing.root.v1"));
    await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".l99-map", { timeout: 15000 });
    await sleep(400);
    const closedGate = await page.evaluate(() => ({
      jump: document.querySelectorAll(".l99-jump").length,
      skip: document.querySelector(".l99-tool-skip")?.textContent ?? ""
    }));
    log(closedGate.jump === 0, "管理员权限关着时,直达控件连 DOM 都不生成");
    log(
      closedGate.skip.includes("跳过") && !closedGate.skip.includes("管理员"),
      "管理员权限关着时,跳过按钮还是 1.1 那颗(要家长确认)",
      closedGate.skip
    );

    // 家长算术门原样保留
    const parent = await page.evaluate(async () => {
      const P = await import("/src/ui/parentAuth.ts");
      const basic = P.makeQuestion("basic", () => 0.42);
      const high = P.makeQuestion("high", () => 0.42);
      return {
        basic: basic.text,
        high: high.text,
        rightAnswerPasses: P.checkAnswer(basic, String(basic.answer)),
        wrongAnswerFails: !P.checkAnswer(basic, String(basic.answer + 1)),
        ttl: P.AUTH_TTL_MS,
        maxWrong: P.MAX_WRONG,
        lock: P.LOCK_MS,
        highNeed: P.HIGH_NEED_CORRECT
      };
    });
    log(
      /\d/.test(parent.basic) && parent.rightAnswerPasses && parent.wrongAnswerFails,
      "1.1 的家长算术门原样保留:还是出算术题,答对放行答错拦下",
      `${parent.basic} / ${parent.high}`
    );
    log(
      parent.ttl === 5 * 60000 && parent.maxWrong === 2 && parent.lock === 90000 && parent.highNeed === 2,
      "家长门的参数一个没动(5 分钟有效 / 错 2 次 / 锁 90 秒 / 高权限连答 2 题)",
      JSON.stringify(parent)
    );

    // 开门 → 直达 1 / 100 / 188
    await page.evaluate(async () => {
      const R = await import("/src/ui/rootGate.ts");
      R.submitRootPassword("kangkang", Date.now());
    });
    await page.goto(`${BASE}/?t=${Date.now()}#/game/sudoku-petal`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".l99-map", { timeout: 15000 });
    await sleep(400);
    const openGateUi = await page.evaluate(() => ({
      jump: document.querySelectorAll(".l99-jump").length,
      note: document.querySelector(".l99-jump-note")?.textContent ?? "",
      skip: document.querySelector(".l99-tool-skip")?.textContent ?? ""
    }));
    log(openGateUi.jump === 1, "管理员权限开着时,直达控件出现在选关页");
    log(/还剩\s*\d+\s*分钟/.test(openGateUi.note), "直达控件旁边报剩余分钟数", openGateUi.note);
    log(openGateUi.skip.includes("管理员"), "跳过按钮切成管理员版(不必再做算术题)", openGateUi.skip);

    for (const n of [1, 100, 188]) {
      await page.evaluate(() => {
        const b = document.querySelector(".l99-back");
        if (b) b.click();
      });
      await sleep(300);
      await page.waitForSelector(".l99-jump-input", { timeout: 8000 }).catch(() => {});
      await page.evaluate(
        (target) => {
          const input = document.querySelector(".l99-jump-input");
          input.value = String(target);
          [...document.querySelectorAll(".l99-jump .l99-tool")].find((b) => b.textContent?.includes("直达"))?.click();
        },
        n
      );
      await sleep(1000);
      const title = await page.$eval(".l99-stagetitle", (el) => el.textContent ?? "").catch(() => "");
      const drew = await page.$$eval(".sp-cell", (e) => e.length).catch(() => 0);
      log(new RegExp(`第\\s*${n}\\s*关|\\b${n}\\b`).test(title) && drew > 0, `直达第 ${n} 关,盘面真的画出来`, `${title} · ${drew} 格`);
    }
    // 星级一个字都不动:直达没打过的关不发星
    const stars = await page.evaluate(() => JSON.parse(localStorage.getItem("yiduo-yixing.l99.sudoku-petal") ?? "[]"));
    log(
      Array.isArray(stars) && (stars[187] ?? 0) === 0,
      "直达第 188 关不发星:没打过就是 0 星",
      `第188关星级=${stars[187] ?? 0}`
    );
    // 越界 / 乱输
    const clamp = await page.evaluate(async () => {
      const C = await import("/src/ui/root12Contract.ts");
      return {
        big: C.clampJumpTarget("999", 188),
        zero: C.clampJumpTarget("0", 188),
        neg: C.clampJumpTarget("-5", 188),
        abc: C.clampJumpTarget("abc", 188),
        empty: C.clampJumpTarget("   ", 188),
        exp: C.clampJumpTarget("1e9", 188),
        frac: C.clampJumpTarget("99.6", 188)
      };
    });
    log(
      clamp.big === 188 && clamp.zero === 1 && clamp.neg === 1 && clamp.abc === null && clamp.empty === null && clamp.exp === 188 && clamp.frac === 100,
      "直达输入越界 / 乱输一律夹到 1–188,读不出数字就不动",
      JSON.stringify(clamp)
    );

    // ---- C1 2.5D 基建 ----
    console.log("\n----- 2.5D 基建 -----");
    const noThree = await page.evaluate(() => ({
      global: Boolean(window.THREE),
      scripts: [...document.querySelectorAll("script[src]")].filter((s) => /three/i.test(s.src)).length,
      webgl: [...document.querySelectorAll("canvas")].filter((c) => {
        try {
          return Boolean(c.getContext("webgl") || c.getContext("webgl2"));
        } catch {
          return false;
        }
      }).length
    }));
    log(!noThree.global && noThree.scripts === 0, "页面里没有 three.js(没有全局 THREE,也没有 three 的 script)", JSON.stringify(noThree));
    const v25 = await page.evaluate(async () => {
      const V = await import("/src/engine/view25d.ts");
      const cam = V.defaultCamera("perspective");
      const near = V.project(cam, 0, 0, 1, 360, 640);
      const far = V.project(cam, 0, 0, 40, 360, 640);
      const flat = V.project(V.defaultCamera("flat"), 10, 0, 40, 360, 640);
      const nasty = [
        V.project(cam, 0, 0, NaN, 360, 640),
        V.project(cam, 0, 0, -999, 360, 640),
        V.project({ ...cam, fov: 0 }, 0, 0, 5, 0, 0),
        V.project({ ...cam, fov: 180, cameraZ: 0 }, NaN, NaN, NaN, NaN, NaN)
      ];
      return {
        nearScale: near.scale,
        farScale: far.scale,
        shrinks: near.scale > far.scale,
        behind: V.project(cam, 0, 0, -999, 360, 640).visible,
        flatScale: flat.scale,
        finite: nasty.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.scale)),
        horizon: V.horizonY(cam, 640)
      };
    });
    log(v25.shrinks, "自写透视:越远缩得越小", `z=1 → ${v25.nearScale.toFixed(3)},z=40 → ${v25.farScale.toFixed(3)}`);
    log(v25.flatScale === 1 && !v25.behind, "flat 档降级成正交(缩放恒 1),相机背后的点标成不可见");
    log(v25.horizon > 0 && v25.horizon < 640, "地平线落在画面里", `y=${v25.horizon}`);
    log(v25.finite, "极端输入(NaN / 负 z / 视场角 0 / 视口 0)一律给有限数,不炸不出 NaN");
  }

  // =========================================================================
  // C. 12 款逐款
  // =========================================================================
  if (PARTS.includes("C")) {
    console.log("\n===== C. 12 款逐款走查 =====");
    for (const g of PICKED) {
      console.log(`\n----- ${g.title}(${g.id}) -----`);
      errors = [];

      // 1) 从首页点卡片进去(不是敲 hash)
      await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "networkidle0" });
      await sleep(900);
      await page.evaluate(() => window.localStorage.removeItem("yiduo-yixing.root.v1"));
      const baseLeak = await page.evaluate(() => ({ ...window.__leak }));
      const entered = await page.evaluate((title) => {
        const card = [...document.querySelectorAll(".game-card")].find(
          (c) => c.querySelector(".card-title")?.textContent?.trim() === title
        );
        if (!card) return false;
        card.click();
        return true;
      }, g.title);
      const mounted = await page
        .waitForSelector(`.${g.p}-modebar, .${g.p}-wrap, .l99-wrap`, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      log(entered && mounted, "从首页点卡片就能进去");

      // 2) 模式条:对战 / 无尽 / 双人入口齐不齐
      const bar = await page.$$eval(`.${g.p}-modebar .${g.p}-open`, (els) =>
        els.map((e) => e.textContent?.trim() ?? "")
      ).catch(() => []);
      log(
        g.modes.every((m) => bar.includes(m)),
        `模式入口齐:${g.modes.join(" / ")}`,
        bar.join(" | ")
      );

      // 3) 战役第 1 / 100 / 188 关
      for (const n of [1, 100, 188]) {
        const title = await openLevel(page, g.id, n);
        const drew = await page.evaluate(
          (prefix) => {
            const stage = document.querySelector(".l99-stage");
            if (!stage) return 0;
            return stage.querySelectorAll(`canvas, [class^='${prefix}-'], [class*=' ${prefix}-']`).length;
          },
          g.p
        );
        const flow = await overflowX(page);
        log(
          new RegExp(`第\\s*${n}\\s*关|\\b${n}\\b`).test(title) && drew > 0 && flow.doc <= 1,
          `战役第 ${n} 关进得去、画得出、360px 不溢出`,
          `${title.trim()} · ${drew} 个节点 · doc+${flow.doc}${flow.doc > 1 ? " " + flow.bad : ""}`
        );
      }

      // 4) 真实胜负:一局一局真打,直到「过关」和「就差一点点」两种结算都亲眼见过。
      //    单数轮摆烂(什么都不按)专门逼输,双数轮认真玩去博一次过关。
      const seen = new Map();
      const playRounds = async (level, rounds, opts) => {
        await openLevel(page, g.id, level);
        for (let round = 0; round < rounds && seen.size < 2; round++) {
          const r = await drive(page, g, opts);
          if (r.v.includes("过关")) seen.set("win", `第 ${level} 关 ${r.v}(第 ${round + 1} 局 · ${r.acts} 次操作)`);
          else if (r.v.includes("就差")) seen.set("lose", `第 ${level} 关 ${r.v}(第 ${round + 1} 局 · ${r.acts} 次操作)`);
          const again = await page.evaluate(() => {
            const b = [...document.querySelectorAll(".l99-ov-btn")].find((x) =>
              /再试本关|再玩一次/.test(x.textContent ?? "")
            );
            if (!b) return false;
            b.click();
            return true;
          });
          if (!again) await openLevel(page, g.id, level);
          await sleep(800);
        }
      };
      // 赢:第 1 关认真玩;输:摆烂一局,再去最难的第 188 关碰一次
      await playRounds(1, 4, { budgetMs: 26000, mode: "play" });
      if (!seen.has("lose")) await playRounds(1, 1, { budgetMs: 16000, mode: "idle" });
      if (!seen.has("lose")) await playRounds(188, 2, { budgetMs: 24000, mode: "play" });
      if (!seen.has("win")) await playRounds(1, 3, { budgetMs: 26000, mode: "play" });
      log(seen.has("win"), "真打到过关(赢一次)", seen.get("win") ?? "多局之内没打出过关");
      log(seen.has("lose"), "真打到失败(输一次)", seen.get("lose") ?? "多局之内没打出失败");

      // 5) 每个额外模式都要开得起来并且玩得到结算
      for (const label of g.modes) {
        await page.goto(`${BASE}/?t=${Date.now()}#/game/${g.id}`, { waitUntil: "networkidle0" });
        await page.waitForSelector(`.${g.p}-modebar .${g.p}-open`, { timeout: 15000 });
        await page.evaluate(
          ([sel, t]) => {
            [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").includes(t))?.click();
          },
          [`.${g.p}-modebar .${g.p}-open`, label]
        );
        await sleep(600);
        // 选档 / 选盘面那几层都是同一颗 .<前缀>-open,一层层点到真盘面出来为止
        const picks = await pickThrough(page, g.p);
        await sleep(700);
        const drewMode = await page.evaluate(
          (prefix) => document.querySelectorAll(`canvas, [class^='${prefix}-'], [class*=' ${prefix}-']`).length,
          g.p
        );
        const flow = await overflowX(page);
        log(drewMode > 5 && flow.doc <= 1, `${label}:开得起来、画得出、360px 不溢出`, `选了 ${picks} 层 · ${drewMode} 个节点 · doc+${flow.doc}`);
        const res = await drive(page, g, { budgetMs: 55000, mode: "play" });
        log(res.v !== "", `${label}:玩到结算`, res.v ? `结算「${res.v}」· ${res.acts} 次操作` : `${res.acts} 次操作 / ${Math.round(res.ms / 1000)}s 内没等到结算`);
      }

      // 6) 双人键位:朵朵 WASD+F+G,星星 方向键+L+K
      const duoLabel = g.modes.find((m) => m.includes("双人"));
      if (duoLabel) {
        await page.goto(`${BASE}/?t=${Date.now()}#/game/${g.id}`, { waitUntil: "networkidle0" });
        await page.waitForSelector(`.${g.p}-modebar .${g.p}-open`, { timeout: 15000 });
        await page.evaluate(
          ([sel, t]) => {
            [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").includes(t))?.click();
          },
          [`.${g.p}-modebar .${g.p}-open`, duoLabel]
        );
        await sleep(600);
        await page.evaluate(() => {
          const go = [...document.querySelectorAll("button")].find((b) => /开始|开局|▶/.test(b.textContent ?? ""));
          go?.click();
        });
        await sleep(900);
        const before = await fingerprint(page);
        for (const k of ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG"]) {
          await page.keyboard.press(k);
          await sleep(120);
        }
        const midway = await fingerprint(page);
        for (const k of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK"]) {
          await page.keyboard.press(k);
          await sleep(120);
        }
        const after = await fingerprint(page);
        log(before !== midway, `${duoLabel}:朵朵 WASD+F+G 有反应`);
        log(midway !== after, `${duoLabel}:星星 方向键+L+K 有反应`);
        const flow = await overflowX(page);
        log(flow.doc <= 1, `${duoLabel}:360px 不溢出`, `doc+${flow.doc}${flow.doc > 1 ? " " + flow.bad : ""}`);
      } else {
        log(true, "这一款按 meta 就没有同屏双人(身份场两个人挤一屏会互相看光牌),跳过双人键位");
      }

      // 7) 退出再进 + destroy 不泄漏
      await page.evaluate(() => {
        location.hash = "";
      });
      await sleep(1500);
      const endLeak = await page.evaluate(() => ({ ...window.__leak }));
      const leak =
        endLeak.listeners - baseLeak.listeners > 0 ||
        endLeak.intervals - baseLeak.intervals > 0 ||
        endLeak.frames - baseLeak.frames > 0;
      log(!leak, "退出后监听 / 定时器 / rAF 都还回去了", `${JSON.stringify(baseLeak)} → ${JSON.stringify(endLeak)}`);
      const reenter = await page.evaluate((title) => {
        const card = [...document.querySelectorAll(".game-card")].find(
          (c) => c.querySelector(".card-title")?.textContent?.trim() === title
        );
        if (!card) return false;
        card.click();
        return true;
      }, g.title);
      const remount = await page
        .waitForSelector(`.${g.p}-modebar, .${g.p}-wrap, .l99-wrap`, { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      log(reenter && remount, "退出再进还能正常挂起来");

      log(errors.length === 0, "这一款全程没有 pageerror / console.error", errors.slice(0, 2).join(" ; "));
    }
  }

  // =========================================================================
  // W. 补过关证据:只反复打第 1 关,预算给足
  // =========================================================================
  if (PARTS.includes("W")) {
    const budget = Number(process.env.WIN_MS ?? 90000);
    const rounds = Number(process.env.WIN_ROUNDS ?? 6);
    console.log(`\n===== W. 补过关证据(每款最多 ${rounds} 局 × ${Math.round(budget / 1000)}s) =====`);
    for (const g of PICKED) {
      let got = "";
      await openLevel(page, g.id, 1);
      for (let round = 0; round < rounds && !got; round++) {
        const r = await drive(page, g, { budgetMs: budget, mode: "play" });
        if (r.v.includes("过关")) got = `${r.v}(第 ${round + 1} 局 · ${r.acts} 次操作 · ${Math.round(r.ms / 1000)}s)`;
        const again = await page.evaluate(() => {
          const b = [...document.querySelectorAll(".l99-ov-btn")].find((x) =>
            /再试本关|再玩一次/.test(x.textContent ?? "")
          );
          if (!b) return false;
          b.click();
          return true;
        });
        if (!again) await openLevel(page, g.id, 1);
        await sleep(700);
      }
      log(got !== "", `${g.title}:第 1 关真打到过关`, got || `${rounds} 局都没打出过关`);
    }
  }

  // =========================================================================
  // R. rebase 后复核:修复员 / 学习优化员落地的三件事,加上双人键位分边重测
  // =========================================================================
  if (PARTS.includes("R")) {
    console.log("\n===== R. rebase 后复核 =====");

    // ---- R1 W1-01:五款按两次 Esc 能不能接着玩 ----
    const escIds = ["orb-arena", "snake-royale", "block-drop", "combo-clash", "merge-2048"];
    for (const g of GAMES.filter((x) => escIds.includes(x.id))) {
      await openLevel(page, g.id, 1);
      await page.keyboard.press("KeyD").catch(() => {});
      await sleep(900);
      const a1 = await fingerprint(page);
      await sleep(900);
      const a2 = await fingerprint(page);
      // 回合制的款开局本来就是静止的,用「按方向键盘面会不会变」代替「画面会不会动」
      const liveBefore = a1 !== a2 || (await pokeMoves(page, g));
      await page.keyboard.press("Escape");
      await sleep(700);
      const shellPause = await page.evaluate(
        () => document.querySelectorAll(".dialog, .dlg, [class*='pause']").length > 0
      );
      const paused = await page.evaluate(() => {
        const t = document.querySelector(".game-stage")?.textContent ?? "";
        return /暂停|先歇/.test(t);
      });
      await page.keyboard.press("Escape");
      await sleep(900);
      const b1 = await fingerprint(page);
      await sleep(900);
      const b2 = await fingerprint(page);
      const liveAfter = b1 !== b2 || (await pokeMoves(page, g));
      log(
        liveBefore && paused && liveAfter,
        `W1-01 复核 · ${g.title}:Esc 暂停后再按一次能接着玩`,
        `开局在动=${liveBefore} · 暂停有提示=${paused}(壳层面板 ${shellPause ? "还在" : "没弹"}) · 恢复后在动=${liveAfter}`
      );
    }

    // ---- R2 W1-02:12 款的拼音首字母搜得到吗 ----
    const PINYIN = [
      ["orb-arena", "圆圆大作战", "yydzz"],
      ["snake-royale", "长蛇争霸", "cszb"],
      ["block-drop", "方块叠叠乐", "fkddl"],
      ["combo-clash", "连招对决", "lzdj"],
      ["mahjong-bloom", "花开麻将", "hkmj"],
      ["star-estate", "朵星地产", "dxdc"],
      ["hero-cards", "英杰令", "yjl"],
      ["weiqi-garden", "围子花园", "wzhy"],
      ["flight-chess", "飞行棋乐园", "fxqly"],
      ["merge-2048", "星星合成", "xxhc"],
      ["mine-garden", "扫雷花园", "slhy"],
      ["sudoku-petal", "数独花田", "sdht"]
    ];
    await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: "networkidle0" });
    await sleep(1000);
    for (const [, title, initials] of PINYIN) {
      const hit = await page.evaluate(
        async ([q, want]) => {
          const box = document.querySelector(".home-search-input");
          if (!box) return "没有搜索框";
          box.value = q;
          box.dispatchEvent(new Event("input", { bubbles: true }));
          await new Promise((r) => setTimeout(r, 260));
          const titles = [...document.querySelectorAll(".card-title")].map((e) => e.textContent?.trim() ?? "");
          return titles.includes(want) ? `${titles.length} 张里有它` : `${titles.length} 张里没有它`;
        },
        [initials, title]
      );
      log(hit.includes("有它"), `W1-02 复核 · 搜「${initials}」找得到「${title}」`, hit);
    }

    // ---- R3 mine-garden 双人:分边看光标与翻开数,不再靠整屏指纹 ----
    await page.goto(`${BASE}/?t=${Date.now()}#/game/mine-garden`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".mn-modebar .mn-open", { timeout: 15000 });
    await page.evaluate(() => {
      [...document.querySelectorAll(".mn-modebar .mn-open")].find((b) => (b.textContent ?? "").includes("双人"))?.click();
    });
    await sleep(700);
    await pickThrough(page, "mn");
    await sleep(900);
    const sides = async () =>
      page.evaluate(() =>
        [...document.querySelectorAll(".mn-duo > div")].map((side) => {
          const cells = [...side.querySelectorAll("[class*='mn-cell']")];
          return {
            cursor: cells.findIndex((c) => c.className.includes("mn-cursor")),
            opened: cells.filter((c) => /\bmn-lit\b/.test(c.className)).length,
            flags: side.textContent?.split("🚩").length ?? 0
          };
        })
      );
    const s0 = await sides();
    for (const k of ["KeyD", "KeyD", "KeyS", "KeyF", "KeyA", "KeyG"]) {
      await page.keyboard.press(k);
      await sleep(140);
    }
    const s1 = await sides();
    for (const k of ["ArrowRight", "ArrowRight", "ArrowDown", "KeyL", "ArrowLeft", "KeyK"]) {
      await page.keyboard.press(k);
      await sleep(140);
    }
    const s2 = await sides();
    const moved = (a, b) => a.cursor !== b.cursor || a.opened !== b.opened || a.flags !== b.flags;
    if (s0.length === 2) {
      log(moved(s0[0], s1[0]), "mine-garden 双人:朵朵 WASD+F+G 只动左边", JSON.stringify([s0[0], s1[0]]));
      log(!moved(s0[1], s1[1]), "mine-garden 双人:朵朵按键不会串到星星那边", JSON.stringify([s0[1], s1[1]]));
      log(moved(s1[1], s2[1]), "mine-garden 双人:星星 方向键+L+K 只动右边", JSON.stringify([s1[1], s2[1]]));
      log(!moved(s1[0], s2[0]), "mine-garden 双人:星星按键不会串到朵朵那边", JSON.stringify([s1[0], s2[0]]));
    } else {
      log(false, "mine-garden 双人:两块盘面都在", `找到 ${s0.length} 块`);
    }
  }

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n共 ${results.length} 项,通过 ${results.length - bad.length} 项。`);
  if (bad.length) {
    console.log("未通过:");
    for (const r of bad) console.log("  - " + r.what);
    process.exit(1);
  }
  console.log("全部通过 ✓");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
