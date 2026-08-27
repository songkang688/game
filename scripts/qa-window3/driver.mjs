/**
 * 窗口 3 验收 · 测试员自建的浏览器走查驱动(不属于玩法代码)。
 *
 * 只做两件事:把页面开起来、往里发真实的键鼠事件,然后读 DOM 取证。
 * 不 import 任何 src/ 下的东西,也不改页面里的游戏逻辑。
 *
 * 用法:npm run build && npx vite preview --port 4173,再 node scripts/qa-window3/run.mjs
 */
import puppeteer from "puppeteer-core";

export const BASE = process.env.QA_BASE ?? "http://127.0.0.1:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 朵朵 WASD+F/G/V,星星 方向键+L/K/J,外加通用键 */
export const DUO_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyV"];
export const STAR_KEYS = ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", "KeyL", "KeyK", "KeyJ"];
export const COMMON_KEYS = ["Space", "Enter", "KeyB", "Tab"];

export async function launch({ width = 900, height = 1200 } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--mute-audio",
      "--disable-gpu",
      `--window-size=${width},${height}`,
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  return { browser, page };
}

/** 挂错误收集器,返回 {errors, reset()} */
export function collectErrors(page) {
  const state = { errors: [] };
  page.on("pageerror", (err) => state.errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") state.errors.push(`console.error: ${msg.text()}`.slice(0, 300));
  });
  state.reset = () => {
    state.errors = [];
  };
  return state;
}

/**
 * 预置「188 关全通关」存档,好让第 100 / 188 关点得开。
 * 大部分款走平台的 `yiduo-yixing.l99.<id>`;下面五款自带存档,格式各不相同,
 * 所以一并写上(只写测试环境的 localStorage,不改任何产品代码)。
 */
export async function seedProgress(page, ids, levels = 188) {
  await page.evaluate(
    (gameIds, total) => {
      const full = new Array(total).fill(3);
      for (const id of gameIds) {
        localStorage.setItem(`yiduo-yixing.l99.${id}`, JSON.stringify(full));
      }
      if (gameIds.includes("garden-guard")) {
        localStorage.setItem("yiduo-yixing.garden-guard.campaign.v2", JSON.stringify(full));
      }
      if (gameIds.includes("sprout-defense")) {
        localStorage.setItem("yiduo-yixing.sprout-defense.campaign.v2", JSON.stringify(full));
      }
      if (gameIds.includes("candy-swing")) {
        localStorage.setItem("yiduo-yixing.candy-swing.campaign.v2", JSON.stringify({ stars: full }));
      }
      if (gameIds.includes("sling-birds")) {
        const stars = {};
        for (let i = 1; i <= total; i++) stars[String(i)] = 3;
        localStorage.setItem(
          "yiduo-yixing.sling-birds.v2",
          JSON.stringify({ stars, resume: null, chapter: 0 })
        );
      }
    },
    ids,
    levels
  );
}

export async function clearStorage(page) {
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* 隐私模式 */
    }
  });
}

/** 从首页按标题点进游戏。返回 "ok" / "no-card" / "no-stage" */
export async function openFromHome(page, { id, title }) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await sleep(350);
  const clicked = await page.evaluate((t) => {
    const cards = [...document.querySelectorAll(".game-card, a[href*='#/game/'], [data-game-id]")];
    const hit = cards.find((el) => (el.textContent ?? "").includes(t));
    if (!hit) return false;
    hit.scrollIntoView({ block: "center" });
    hit.click();
    return true;
  }, title);
  if (!clicked) return { entry: "no-card", hash: await page.evaluate(() => location.hash) };
  await sleep(1100);
  const hash = await page.evaluate(() => location.hash);
  const stage = await stageState(page);
  return { entry: stage === "ok" ? "ok" : stage, hash };
}

export async function gotoGame(page, id) {
  await page.evaluate((gid) => {
    location.hash = `#/game/${gid}`;
  }, id);
  await sleep(1200);
  return stageState(page);
}

export async function goHome(page) {
  await page.evaluate(() => {
    location.hash = "";
  });
  await sleep(500);
}

export async function stageState(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return "no-stage";
    if (stage.querySelector(".empty-state")) return "error-state";
    if (stage.querySelector(".game-loading")) return "still-loading";
    return stage.children.length > 0 ? "ok" : "empty";
  });
}

/** 舞台里所有可见按钮的文字(拿来认模式条) */
export async function stageButtons(page) {
  return page.evaluate(() => {
    const stage = document.querySelector(".game-stage");
    if (!stage) return [];
    return [...stage.querySelectorAll("button")]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
      })
      .map((b) => (b.textContent ?? "").trim().replace(/\s+/g, " "))
      .filter(Boolean);
  });
}

/** 按文字点舞台里的按钮(部分匹配),返回是否点到 */
export async function clickButtonByText(page, text, { exact = false } = {}) {
  const ok = await page.evaluate(
    (t, isExact) => {
      const stage = document.querySelector(".game-stage") ?? document.body;
      const btns = [...stage.querySelectorAll("button, [role='button']")];
      const hit = btns.find((b) => {
        const s = (b.textContent ?? "").trim().replace(/\s+/g, " ");
        return isExact ? s === t : s.includes(t);
      });
      if (!hit) return false;
      hit.scrollIntoView({ block: "center" });
      hit.click();
      return true;
    },
    text,
    exact
  );
  if (ok) await sleep(650);
  return ok;
}

/**
 * 结算面板有三层来源,都要认:
 *  1. 平台 onWin/onLose -> `.result-buddies--win` / `--lose`;
 *  2. 188 关框架 level99.ts -> `.l99-overlay`,标题「第 N 关过关！」/「就差一点点！」;
 *  3. 各游戏自己的模式结算面板 -> 舞台内 class 里带 overlay/result/settle/over 的块。
 */
export const WIN_WORDS = ["过关", "获胜", "赢", "胜出", "通关", "冠军", "成功", "达标", "守住", "全部消灭"];
export const LOSE_WORDS = ["就差一点点", "失败", "输", "再试", "没守住", "被追上", "时间到", "没能"];

export async function readResult(page) {
  return page.evaluate(
    (winWords, loseWords) => {
      const clean = (s) => (s ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
      // 1. 平台结算
      if (document.querySelector(".result-buddies--win")) {
        return { kind: "win", src: "platform", text: clean(document.querySelector(".result-content")?.textContent) };
      }
      if (document.querySelector(".result-buddies--lose")) {
        return { kind: "lose", src: "platform", text: clean(document.querySelector(".result-content")?.textContent) };
      }
      // 2. 188 关框架
      const l99 = document.querySelector(".l99-overlay");
      if (l99) {
        const t = clean(l99.querySelector(".l99-ov-title")?.textContent);
        const sub = clean(l99.textContent);
        if (t.includes("过关") || t.includes("通关")) return { kind: "win", src: "l99", text: sub };
        if (t.includes("就差")) return { kind: "lose", src: "l99", text: sub };
        return { kind: "unknown", src: "l99", text: sub };
      }
      // 3. 游戏自带结算
      const stage = document.querySelector(".game-stage");
      if (!stage) return null;
      const cands = [...stage.querySelectorAll("*")].filter((el) => {
        const c = typeof el.className === "string" ? el.className : "";
        if (!/overlay|result|settle|gameover|over-|-over|final|score-panel|panel-end/i.test(c)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 60 && r.height > 40;
      });
      for (const el of cands) {
        const s = clean(el.textContent);
        if (!s) continue;
        if (winWords.some((w) => s.includes(w))) return { kind: "win", src: "game", text: s };
        if (loseWords.some((w) => s.includes(w))) return { kind: "lose", src: "game", text: s };
      }
      // 4. 兜底:任何带「再玩 / 下一关 / 回地图 / 再试 / 换一局」按钮的可见面板,
      //    就是这一局的结算面板 —— 各游戏 class 名不统一,只能按语义认。
      const replayRe = /再玩一次|再来一局|再打一局|下一关|回地图|再试|换一局|返回选择|回模式|重开/;
      for (const btn of stage.querySelectorAll("button")) {
        const bt = clean(btn.textContent);
        if (!bt || !replayRe.test(bt)) continue;
        const r = btn.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        let panel = btn.parentElement;
        for (let i = 0; i < 4 && panel; i++) {
          const pr = panel.getBoundingClientRect();
          if (pr.width > 120 && pr.height > 80) break;
          panel = panel.parentElement;
        }
        const s = clean(panel?.textContent);
        if (!s) continue;
        if (loseWords.some((w) => s.includes(w))) return { kind: "lose", src: "panel", text: s };
        if (winWords.some((w) => s.includes(w))) return { kind: "win", src: "panel", text: s };
        return { kind: "unknown", src: "panel", text: s };
      }
      return null;
    },
    WIN_WORDS,
    LOSE_WORDS
  );
}

/** 关掉结算面板:l99 有 700ms 冷静期,所以先等再点「回地图」;别的用 Esc */
export async function dismissResult(page) {
  const hasL99 = await page.$(".l99-overlay");
  if (hasL99) {
    await sleep(750);
    const back = await page.evaluate(() => {
      const btns = [...document.querySelectorAll(".l99-ov-btn")];
      const hit = btns.find((b) => (b.textContent ?? "").includes("回地图")) ?? btns[0];
      if (!hit) return false;
      hit.click();
      return true;
    });
    if (back) {
      await sleep(500);
      return;
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
  await sleep(300);
}

/** l99 结算后点「下一关」,拿来连打好几关 */
export async function l99Next(page) {
  const has = await page.$(".l99-overlay");
  if (!has) return false;
  await sleep(750);
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll(".l99-ov-btn")];
    const hit = btns.find((b) => (b.textContent ?? "").includes("下一关"))
      ?? btns.find((b) => (b.textContent ?? "").includes("再试"))
      ?? btns.find((b) => (b.textContent ?? "").includes("再玩"));
    if (!hit) return false;
    hit.click();
    return true;
  });
}

async function stageBox(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".game-stage");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
}

/**
 * 往游戏里灌真实输入,直到出结算面板或超时。
 * 收集出现过的 win / lose(可能出现多次)。
 */
export async function play(page, opts = {}) {
  const {
    ms = 12000,
    keys = [...DUO_KEYS, ...STAR_KEYS, ...COMMON_KEYS],
    pointer = true,
    drag = false,
    stopOnResult = true,
    seed = 1,
    replayOnResult = false,
    /** 只在关卡里驱动:一旦 .l99-stage 没了(被弹回地图)就收手,免得乱点污染存档 */
    stayInLevel = false,
    /** 摆烂模式:一个输入都不发,专门看这一关有没有真的失败分支 */
    idle = false,
  } = opts;
  const out = { win: 0, lose: 0, samples: [], ticks: 0 };
  let a = seed >>> 0 || 1;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const box = await stageBox(page);
  const deadline = Date.now() + ms;
  const held = new Set();

  while (Date.now() < deadline) {
    out.ticks++;
    if (stayInLevel) {
      const inLevel = await page.evaluate(() => !!document.querySelector(".l99-stage"));
      if (!inLevel) {
        out.leftLevel = true;
        break;
      }
    }
    // 键盘:随机按住 / 松开
    if (!idle) {
      for (let i = 0; i < 3; i++) {
        const k = keys[Math.floor(rnd() * keys.length)];
        if (held.has(k)) {
          await page.keyboard.up(k).catch(() => {});
          held.delete(k);
        } else {
          await page.keyboard.down(k).catch(() => {});
          held.add(k);
        }
      }
    }
    // 指针:舞台内随机点 / 拖
    if (!idle && pointer && box && box.w > 20) {
      const x1 = box.x + box.w * (0.12 + 0.76 * rnd());
      const y1 = box.y + box.h * (0.12 + 0.76 * rnd());
      if (drag) {
        const x2 = box.x + box.w * (0.12 + 0.76 * rnd());
        const y2 = box.y + box.h * (0.12 + 0.76 * rnd());
        await page.mouse.move(x1, y1).catch(() => {});
        await page.mouse.down().catch(() => {});
        await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 }).catch(() => {});
        await page.mouse.move(x2, y2, { steps: 4 }).catch(() => {});
        await page.mouse.up().catch(() => {});
      } else {
        await page.mouse.click(x1, y1).catch(() => {});
      }
    }
    await sleep(idle ? 240 : 90);

    const res = await readResult(page);
    if (res && res.kind !== "unknown") {
      out[res.kind]++;
      if (out.samples.length < 4) out.samples.push(res);
      if (stopOnResult) break;
      if (replayOnResult) {
        const replayed = await clickButtonByText(page, "再玩", {});
        if (!replayed) await dismissResult(page);
      } else {
        await dismissResult(page);
      }
    }
  }
  for (const k of held) await page.keyboard.up(k).catch(() => {});
  return out;
}

/** 横向溢出像素:>0 就是溢出 */
export async function overflowPx(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const body = document.body;
    const doc = Math.max(de.scrollWidth, body.scrollWidth) - de.clientWidth;
    let worst = 0;
    let worstSel = "";
    const stage = document.querySelector(".game-stage");
    if (stage) {
      for (const el of [stage, ...stage.querySelectorAll("*")]) {
        const r = el.getBoundingClientRect();
        const over = Math.round(r.right - de.clientWidth);
        if (over > worst) {
          worst = over;
          worstSel = el.className && typeof el.className === "string" ? el.className.slice(0, 60) : el.tagName;
        }
      }
    }
    return { doc: Math.round(doc), worst, worstSel };
  });
}

/** 188 关地图:点开第 n 关(1 起),返回关卡是否真挂起来 */
export async function openLevel(page, n) {
  const found = await page.evaluate((lv) => {
    const nodes = [...document.querySelectorAll(".l99-node")];
    if (nodes.length === 0) return "no-map";
    const hit = nodes.find((el) => (el.getAttribute("aria-label") ?? "").startsWith(`第 ${lv} 关`));
    if (!hit) return "not-on-page";
    if (hit.classList.contains("l99-node-lock")) return "locked";
    hit.scrollIntoView({ block: "center" });
    hit.click();
    return "clicked";
  }, n);
  if (found !== "clicked") return { open: found, stage: "-" };
  await sleep(1300);
  const st = await page.evaluate(() => {
    const s = document.querySelector(".l99-stage");
    if (!s) return "no-l99-stage";
    return s.children.length > 0 ? "ok" : "empty";
  });
  return { open: "clicked", stage: st };
}

/**
 * 有几款进游戏先落在「模式选择」屏,得先点「闯关 / 战役 / 一个人玩」才看得到选关地图。
 * 返回点到的那颗按钮的文字,没找到返回 null。
 */
export const CAMPAIGN_RE = /闯关|战役|冒险|188|关卡地图|一个人玩|合作\s*188|独自|单人闯/;
export async function enterCampaign(page) {
  const already = await page.evaluate(
    () => document.querySelectorAll(".l99-tab").length > 0 || document.querySelectorAll(".l99-node").length > 0
  );
  if (already) return "已在地图";
  const hit = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    const stage = document.querySelector(".game-stage");
    if (!stage) return null;
    for (const b of stage.querySelectorAll("button")) {
      const t = (b.textContent ?? "").trim().replace(/\s+/g, " ");
      if (!t || !re.test(t)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      b.click();
      return t;
    }
    return null;
  }, CAMPAIGN_RE.source);
  if (hit) await sleep(900);
  return hit;
}

/**
 * 自带选关地图的几款(不走 level99.ts):选择器各不相同,这里统一收口。
 * 返回 null 表示这一款走平台的 l99 地图。
 */
export const CUSTOM_MAP = {
  "sling-birds": { tab: ".slb-tab", cell: ".slb-cell" },
  // 糖果秋千把 188 关一次全铺在一页上,没有需要翻的章节页签
  "candy-swing": { tab: ".cs-chapter-nope", cell: ".cs-lv" },
};

/** 自带地图:翻到含第 n 关的那一章并点开它 */
export async function openCustomLevel(page, id, n) {
  const sel = CUSTOM_MAP[id];
  if (!sel) return null;
  const tabs = await page.evaluate((s) => document.querySelectorAll(s).length, sel.tab);
  const tryHere = () =>
    page.evaluate(
      (cellSel, lv) => {
        const cells = [...document.querySelectorAll(cellSel)];
        const hit = cells.find((el) => {
          const label = el.getAttribute("aria-label") ?? el.textContent ?? "";
          return new RegExp(`(^|\\D)${lv}(\\D|$)`).test(label.trim());
        });
        if (!hit) return "not-here";
        if (hit.disabled || (hit.textContent ?? "").includes("🔒")) return "locked";
        hit.scrollIntoView({ block: "center" });
        hit.click();
        return "clicked";
      },
      sel.cell,
      n
    );

  for (let i = 0; i <= tabs; i++) {
    const res = await tryHere();
    if (res === "clicked") {
      await sleep(1300);
      const stage = await page.evaluate(
        () => (document.querySelector(".game-stage")?.children.length ?? 0) > 0
      );
      return { open: "clicked", stage: stage ? "ok" : "empty" };
    }
    if (res === "locked") return { open: "locked", stage: "-" };
    if (i >= tabs) break;
    const more = await page.evaluate(
      (tabSel, idx) => {
        const tabs2 = [...document.querySelectorAll(tabSel)];
        if (!tabs2[idx]) return false;
        tabs2[idx].click();
        return true;
      },
      sel.tab,
      i
    );
    if (!more) break;
    await sleep(320);
  }
  return { open: "not-found", stage: "-" };
}

/** 188 关地图翻章:逐个点 `.l99-tab`,直到含第 n 关的那一章出现 */
export async function gotoChapterOf(page, n) {
  const tabCount = await page.evaluate(() => document.querySelectorAll(".l99-tab").length);
  if (tabCount === 0) return false;
  for (let i = 0; i < tabCount; i++) {
    const has = await page.evaluate((lv) => {
      const nodes = [...document.querySelectorAll(".l99-node")];
      return nodes.some((el) => (el.getAttribute("aria-label") ?? "").startsWith(`第 ${lv} 关`));
    }, n);
    if (has) return true;
    const ok = await page.evaluate((idx) => {
      const tabs = [...document.querySelectorAll(".l99-tab")];
      if (!tabs[idx]) return false;
      tabs[idx].click();
      return true;
    }, i);
    if (!ok) return false;
    await sleep(280);
  }
  return page.evaluate((lv) => {
    const nodes = [...document.querySelectorAll(".l99-node")];
    return nodes.some((el) => (el.getAttribute("aria-label") ?? "").startsWith(`第 ${lv} 关`));
  }, n);
}

/** 模式卡点开之后往往还有一颗「开擂 / 开始 / 出发」才真正开局 */
export const START_RE = /^(开擂|开始|开打|开球|出发|上场|开跑|开工|GO|开局|准备好了|来吧|下潜|发车|起飞|走起)/;
export async function clickStart(page) {
  const hit = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc);
    const stage = document.querySelector(".game-stage");
    if (!stage) return null;
    for (const b of stage.querySelectorAll("button")) {
      const t = (b.textContent ?? "").trim().replace(/\s+/g, " ").replace(/[▶►\s]+$/, "");
      if (!t || !re.test(t)) continue;
      const r = b.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      b.click();
      return t;
    }
    return null;
  }, START_RE.source);
  if (hit) await sleep(700);
  return hit;
}

export async function chapterTabs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".l99-tab")].map((b) => (b.textContent ?? "").trim()).filter(Boolean)
  );
}

/** 回到 188 关地图 */
export async function backToMap(page) {
  await page.evaluate(() => {
    const back = [...document.querySelectorAll("button")].find((b) =>
      (b.className ?? "").toString().includes("l99-back")
    );
    if (back) back.click();
  });
  await sleep(500);
}
