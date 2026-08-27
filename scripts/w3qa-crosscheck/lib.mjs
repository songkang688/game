/**
 * 窗口3 走查工具库：从首页进入 → 实玩 → 判定真实胜负。
 * 不进 git 的探路版；稳定后再落到 scripts/smoke-w3-*.mjs。
 */
import puppeteer from "puppeteer-core";

export const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
export const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const TITLES = {
  "duo-rush": "朵星双人冲刺",
  "duo-arena": "朵星擂台",
  "duo-vs-star": "朵朵大战星星",
  "sling-birds": "弹弹小鸟",
  "candy-swing": "糖果秋千",
  "gold-hook": "金矿钩钩",
  "garden-guard": "花园守卫",
  "sprout-defense": "绿芽保卫战",
  "monster-crisis": "小怪物危机",
  "shoot-range": "星星射击场",
  "sky-squad": "飞机小队",
  "tank-battle": "铁皮坦克大战",
  "bomb-buddies": "泡泡炸弹人",
  "snow-fight": "雪球大作战",
  "bumper-cars": "碰碰车大乱斗",
  "bowling-lane": "保龄球小馆",
  "ice-fire-forest": "冰冰火火森林",
  "puff-bros": "噗噗兄弟",
  "prince-princess": "王子公主大冒险"
};

export async function launch(viewport = { width: 900, height: 1200 }) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"]
  });
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console.error: " + m.text());
  });
  return { browser, page, errors };
}

/** 从首页卡片点进游戏（不用 #/game/ 直链） */
export async function enterFromHome(page, id) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await sleep(350);
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll(".game-card")].find(
      (c) => c.querySelector(".card-title")?.textContent === t
    );
    if (!el) return false;
    el.click();
    return true;
  }, TITLES[id]);
  await sleep(1300);
  return ok;
}

export async function seed(page, kv) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate((o) => {
    for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v);
  }, kv);
}

export async function clearStore(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
}

/** 结算判定：类名优先，其次文案 */
export const SETTLE_FN = `(() => {
  const stage = document.querySelector(".game-stage");
  const scopes = [stage, document.body].filter(Boolean);
  const seen = [];
  for (const sc of scopes) {
    for (const el of sc.querySelectorAll(
      ".l99-overlay,.dialog--win,.dialog--lose,[class*='-over'],[class*='-result'],[class*='-settle'],[class*='-final'],[class*='-end-'],[class*='-gameover'],.overlay"
    )) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cls = el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || "");
      const txt = (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 220);
      if (!txt) continue;
      // 暂停 / 规则 / 攻略 / 收藏册这些覆盖层不是结算
      if (/先歇一会儿|继续玩|怎么玩|点我看规则|键位|收藏册|攻略|暂停/.test(txt)) continue;
      seen.push({ cls, txt });
    }
  }
  if (!seen.length) return null;
  const joined = seen.map((s) => s.cls + " :: " + s.txt).join(" || ");
  let verdict = "unknown";
  if (/dialog--win/.test(joined)) verdict = "win";
  else if (/dialog--lose/.test(joined)) verdict = "lose";
  else if (/过关|你赢|赢了|胜利|冠军|通关|全清|守住了|成功|达标|第一名|漂亮|干得漂亮/.test(joined)) verdict = "win";
  else if (/就差一点点|输了|失败|没守住|被追上|再试一次|下次一定|差一点|时间到|没打完/.test(joined)) verdict = "lose";
  else if (/平局|打平/.test(joined)) verdict = "draw";
  return { verdict, text: joined.slice(0, 400) };
})()`;

export async function settle(page) {
  return page.evaluate(SETTLE_FN);
}

/**
 * 存档指纹：画布内结算（糖果秋千这类）看不到 DOM，
 * 就用「这一款的本地存档里星星总数 / 关卡号有没有涨」当真实过关的证据。
 */
export async function fingerprint(page, id) {
  return page.evaluate((gid) => {
    let sum = 0;
    const hits = {};
    let stars = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      // 只认这一款自己的关卡进度 key；平台钱包 save.v1 里也有游戏 id，
      // 它每次挂载都会 +1 次游玩记录，拿它当过关证据会误判
      if (!k || !k.includes(gid)) continue;
      if (!/(campaign\.v2|l99\.|\.v2$)/.test(k)) continue;
      const v = localStorage.getItem(k) ?? "";
      hits[k] = v.slice(0, 120);
      for (const m of v.match(/\d+/g) ?? []) sum += Number(m);
      // 每关星级数组：只有某一关的星数真的变大才算过关
      const m = v.match(/\[[\d,\s]*\]/);
      if (m && !stars) stars = m[0].slice(1, -1).split(",").map((x) => Number(x) || 0);
    }
    const badge = document.querySelector(".cs-level,.slb-level,.l99-stagetitle,[class$='-level']");
    return { sum, stars, badge: (badge?.textContent || "").trim().slice(0, 40), hits };
  }, id);
}

/** 关掉结算层，回到可继续操作的状态 */
export async function dismissSettle(page, label) {
  await page.evaluate((lab) => {
    const btns = [
      ...document.querySelectorAll(".l99-ov-btn,.overlay button,[class*='-over'] button,[class*='-result'] button")
    ];
    const hit = lab ? btns.find((b) => (b.textContent || "").includes(lab)) : null;
    (hit ?? btns[0])?.click();
  }, label);
  await sleep(700);
}

/** 点第一个文本命中的按钮 */
export async function clickText(page, re, scope = ".game-stage") {
  const r = await page.evaluate(
    (src, sc) => {
      const rx = new RegExp(src);
      const root = document.querySelector(sc) ?? document.body;
      const b = [...root.querySelectorAll("button,[role='button'],.l99-node,.slb-cell,.cs-lv")].find(
        (x) => rx.test((x.textContent || "").replace(/\s+/g, " ")) && !x.disabled
      );
      if (!b) return false;
      b.click();
      return true;
    },
    re.source ?? re,
    scope
  );
  await sleep(650);
  return r;
}

/** 按钮可能还没渲染出来，重试几次再放弃 */
export async function clickTextRetry(page, re, tries = 6, gap = 600) {
  for (let i = 0; i < tries; i++) {
    if (await clickText(page, re)) return true;
    await sleep(gap);
  }
  return false;
}

/** 还停在选关地图 / 模式菜单上就说明没真的进模式 */
export async function stillOnMenu(page) {
  return page.evaluate(() => {
    const st = document.querySelector(".game-stage");
    if (!st) return true;
    return Boolean(
      st.querySelector(".l99-continue") ||
        st.querySelector(".l99-map") ||
        st.querySelector(".dvs-modes") ||
        st.querySelector(".dr-start") ||
        st.querySelector(".dua-start")
    );
  });
}

/** 误触家长门就原地关掉，别把一整轮时间耗在算术题上 */
export async function dismissParentGate(page) {
  return page.evaluate(() => {
    const ov = [...document.querySelectorAll(".overlay")].find((o) =>
      /需要家长确认|家长做主/.test(o.textContent || "")
    );
    if (!ov) return false;
    const btn = [...ov.querySelectorAll("button")].find((b) => /不同意|取消|关闭/.test(b.textContent || ""));
    (btn ?? ov.querySelector("button"))?.click();
    return true;
  });
}

export async function clickSel(page, sel, idx = 0) {
  const r = await page.evaluate(
    (s, i) => {
      const list = [...document.querySelectorAll(s)].filter((x) => !x.disabled);
      const el = i < 0 ? list[list.length + i] : list[i];
      if (!el) return false;
      el.click();
      return true;
    },
    sel,
    idx
  );
  await sleep(650);
  return r;
}

export async function stageBox(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".game-stage");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

export async function canvasBox(page) {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll(".game-stage canvas")]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 40 && r.height > 40)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    if (!cs.length) return null;
    const r = cs[0];
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

export async function tap(page, x, y) {
  await page.mouse.move(x, y).catch(() => {});
  await page.mouse.down().catch(() => {});
  await sleep(35);
  await page.mouse.up().catch(() => {});
}

export async function drag(page, x1, y1, x2, y2, steps = 12, hold = 60) {
  await page.mouse.move(x1, y1).catch(() => {});
  await page.mouse.down().catch(() => {});
  await sleep(hold);
  await page.mouse.move(x2, y2, { steps }).catch(() => {});
  await sleep(hold);
  await page.mouse.up().catch(() => {});
}

export async function holdKey(page, key, ms) {
  await page.keyboard.down(key).catch(() => {});
  await sleep(ms);
  await page.keyboard.up(key).catch(() => {});
}

/**
 * 通用机器人：在 budget 毫秒内混合输入，边打边看结算。
 * plan(page, t, box) 每一拍调一次；不给就用默认混合输入。
 */
export async function bot(page, { budget = 25000, tick = 260, plan, keys = [], taps = true, fpId = null } = {}) {
  const box = (await canvasBox(page)) ?? (await stageBox(page));
  const fp0 = fpId ? await fingerprint(page, fpId) : null;
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < budget) {
    const s = await settle(page);
    if (s && s.verdict !== "unknown") return { ...s, ms: Date.now() - t0 };
    if (fp0) {
      const fp = await fingerprint(page, fpId);
      const up =
        fp.stars && fp0.stars
          ? fp.stars.findIndex((v, k) => v > (fp0.stars[k] ?? 0))
          : fp.sum > fp0.sum
            ? -2
            : -1;
      if (up >= 0 || up === -2 || (fp.badge && fp0.badge && fp.badge !== fp0.badge)) {
        return {
          verdict: "win",
          text: `存档进度前进：${fp0.badge}→${fp.badge}${up >= 0 ? ` 第${up + 1}关星级 ${fp0.stars[up] ?? 0}→${fp.stars[up]}` : ""}`,
          ms: Date.now() - t0
        };
      }
    }
    if (plan) await plan(page, i, box);
    else {
      if (keys.length) {
        const k = keys[i % keys.length];
        await holdKey(page, k, 90);
      }
      if (taps && box) {
        const gx = box.x + box.w * (0.2 + 0.6 * (((i * 7) % 5) / 4));
        const gy = box.y + box.h * (0.25 + 0.5 * (((i * 3) % 4) / 3));
        await tap(page, gx, gy);
      }
    }
    await sleep(tick);
    i++;
  }
  const s = await settle(page);
  return s ? { ...s, ms: Date.now() - t0, timeout: true } : { verdict: "none", text: "", ms: Date.now() - t0 };
}

/**
 * 画布“看图找目标”：把主画布按 cell 网格采样，算出与背景色差最大的格子。
 * 返回按显眼程度排序的屏幕坐标，用来给瞄准型玩法当准星。
 */
export async function hotSpots(page, { cells = 24, top = 12, skipTop = 0.0, skipBottom = 0.0 } = {}) {
  return page.evaluate(
    (cells, top, skipTop, skipBottom) => {
      const cs = [...document.querySelectorAll(".game-stage canvas")]
        .filter((c) => c.width > 60 && c.height > 60)
        .sort((a, b) => b.width * b.height - a.width * a.height);
      const c = cs[0];
      if (!c) return [];
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];
      let img;
      try {
        img = ctx.getImageData(0, 0, c.width, c.height);
      } catch {
        return [];
      }
      const { data, width, height } = img;
      const cw = Math.max(1, Math.floor(width / cells));
      const ch = Math.max(1, Math.floor(height / cells));
      const counts = new Map();
      const key = (r, g, b) => ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      for (let y = 0; y < height; y += 3) {
        for (let x = 0; x < width; x += 3) {
          const i = (y * width + x) * 4;
          const k = key(data[i], data[i + 1], data[i + 2]);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
      // 背景 = 出现最多的三种量化色
      const bg = new Set(
        [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0])
      );
      const out = [];
      const y0 = Math.floor(height * skipTop);
      const y1 = Math.floor(height * (1 - skipBottom));
      for (let gy = 0; gy < cells; gy++) {
        for (let gx = 0; gx < cells; gx++) {
          let score = 0;
          let n = 0;
          for (let y = gy * ch; y < Math.min((gy + 1) * ch, height); y += 2) {
            if (y < y0 || y > y1) continue;
            for (let x = gx * cw; x < Math.min((gx + 1) * cw, width); x += 2) {
              const i = (y * width + x) * 4;
              if (data[i + 3] < 40) continue;
              n++;
              if (!bg.has(key(data[i], data[i + 1], data[i + 2]))) score++;
            }
          }
          if (n > 0 && score / n > 0.25) {
            out.push({ gx, gy, r: score / n });
          }
        }
      }
      out.sort((a, b) => b.r - a.r);
      const rect = c.getBoundingClientRect();
      const sx = rect.width / width;
      const sy = rect.height / height;
      return out.slice(0, top).map((o) => ({
        x: rect.x + (o.gx + 0.5) * cw * sx,
        y: rect.y + (o.gy + 0.5) * ch * sy,
        r: Number(o.r.toFixed(2))
      }));
    },
    cells,
    top,
    skipTop,
    skipBottom
  );
}

/** 主画布像素的粗哈希（用来判断“点下去有没有换画面”） */
export async function canvasHash(page) {
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll(".game-stage canvas")]
      .filter((c) => c.width > 60 && c.height > 60)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const c = cs[0];
    if (!c) return null;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    let d;
    try {
      d = ctx.getImageData(0, 0, c.width, c.height).data;
    } catch {
      return null;
    }
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 997) {
      h ^= d[i];
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  });
}

/** 全画布菜单的盲点进入：细网格逐点，画面一变就停 */
export async function blindEnter(page, { cols = 6, rows = 12, wait = 450, useSpots = true } = {}) {
  const box = (await canvasBox(page)) ?? (await stageBox(page));
  if (!box) return { ok: false };
  const h0 = await canvasHash(page);
  if (useSpots) {
    const spots = await hotSpots(page, { cells: 20, top: 14 });
    for (const s of spots) {
      await tap(page, s.x, s.y);
      await sleep(wait);
      const h = await canvasHash(page);
      if (h !== null && h0 !== null && h !== h0) return { ok: true, at: { x: s.x, y: s.y, via: "spot" } };
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = box.x + (box.w * (c + 0.5)) / cols;
      const y = box.y + (box.h * (r + 0.5)) / rows;
      await tap(page, x, y);
      await sleep(wait);
      const h = await canvasHash(page);
      if (h !== null && h0 !== null && h !== h0) return { ok: true, at: { c, r, x, y } };
    }
  }
  return { ok: false };
}

/** 屏幕上的触屏方向键 / 动作键（手机等价控件），按住一段时间 */
export async function pads(page) {
  return page.evaluate(() => {
    const out = [];
    const st = document.querySelector(".game-stage");
    if (!st) return out;
    for (const b of st.querySelectorAll("button")) {
      const t = (b.textContent || "").trim();
      if (t.length > 4) continue;
      if (!/[▲▼◀▶←→↑↓✋💨💥🌟🧺💠💣🔥❄️🎈⬆️⬇️🅰🅱]/.test(t)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      out.push({ t, x: r.x + r.width / 2, y: r.y + r.height / 2 });
    }
    return out;
  });
}

export async function holdPad(page, p, ms) {
  await page.mouse.move(p.x, p.y).catch(() => {});
  await page.mouse.down().catch(() => {});
  await sleep(ms);
  await page.mouse.up().catch(() => {});
}

/**
 * 混合机器人：键盘 + 屏幕方向键 + 画布点击 + 拖拽，边打边看结算。
 */
export async function mixBot(page, { budget = 45000, keys = ["w", "a", "s", "d", "f", "g", " "], useP = true, useTap = true, useDrag = false } = {}) {
  const box = (await canvasBox(page)) ?? (await stageBox(page));
  let padList = await pads(page);
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < budget) {
    const s = await settle(page);
    if (s && s.verdict !== "unknown") return { ...s, ms: Date.now() - t0 };
    if (i % 12 === 0) padList = await pads(page);
    if (keys.length) await holdKey(page, keys[i % keys.length], 110);
    if (useP && padList.length) {
      const p = padList[(i * 3) % padList.length];
      await holdPad(page, p, 150);
    }
    if (useTap && box) {
      const gx = box.x + box.w * (0.15 + 0.7 * (((i * 5) % 7) / 6));
      const gy = box.y + box.h * (0.2 + 0.6 * (((i * 3) % 5) / 4));
      await tap(page, gx, gy);
    }
    if (useDrag && box) {
      await drag(
        page,
        box.x + box.w * 0.3,
        box.y + box.h * 0.6,
        box.x + box.w * (0.15 + 0.1 * (i % 5)),
        box.y + box.h * (0.7 + 0.05 * (i % 4)),
        8,
        50
      );
    }
    i++;
  }
  const s = await settle(page);
  return s ? { ...s, ms: Date.now() - t0, timeout: true } : { verdict: "none", text: "", ms: Date.now() - t0 };
}

/** 先开个头（有些关要点一下才开波），再彻底撒手不管，看会不会判负 */
export async function warmIdle(page, plan, { warm = 4500, budget = 70000 } = {}) {
  const box = (await canvasBox(page)) ?? (await stageBox(page));
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < warm) {
    const s = await settle(page);
    if (s && s.verdict !== "unknown") return { ...s, ms: Date.now() - t0, phase: "warm" };
    if (plan) await plan(page, i++, box);
    else await tap(page, box.x + box.w * 0.5, box.y + box.h * 0.5);
    await sleep(200);
  }
  while (Date.now() - t0 < budget) {
    const s = await settle(page);
    if (s && s.verdict !== "unknown") return { ...s, ms: Date.now() - t0 };
    await sleep(600);
  }
  const s = await settle(page);
  return s ? { ...s, ms: Date.now() - t0, timeout: true } : { verdict: "none", text: "", ms: Date.now() - t0 };
}

/** 静置：不给任何输入，看是否会判负（超时/被对手打赢） */
export async function idle(page, budget = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budget) {
    const s = await settle(page);
    if (s && s.verdict !== "unknown") return { ...s, ms: Date.now() - t0 };
    await sleep(500);
  }
  const s = await settle(page);
  return s ? { ...s, ms: Date.now() - t0, timeout: true } : { verdict: "none", text: "", ms: Date.now() - t0 };
}

/** 360px 横向溢出量 */
export async function overflow360(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const scrollable = (el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
        if (p.classList.contains("game-stage")) return false;
      }
      return false;
    };
    const worst = [];
    for (const el of document.querySelectorAll(".game-stage *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = Math.max(0, Math.round(r.right - doc.clientWidth), Math.round(-r.left));
      // 横滑容器里的 chip 条是设计如此，不算溢出
      if (over > 1 && !scrollable(el)) worst.push({ cls: String(el.className || "").slice(0, 40), over });
    }
    worst.sort((a, b) => b.over - a.over);
    const stage = document.querySelector(".game-stage");
    return {
      scrollW: doc.scrollWidth,
      clientW: doc.clientWidth,
      docOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      stageOverflow: stage ? Math.max(0, stage.scrollWidth - stage.clientWidth) : -1,
      worst: worst.slice(0, 5)
    };
  });
}
