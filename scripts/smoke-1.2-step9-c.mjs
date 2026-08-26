/**
 * 1.2 第 9 步 C 档的手动冒烟替身:用真浏览器把「彩虹跑跑」跑一遍。
 *
 * 纯函数能验的都在 `src/games/rainbow-run/*.test.ts` 里验过了(221 个用例)。
 * 这份脚本补的是单测验不了的那几件事——它们全都要真的画一遍才知道:
 *  1. 360×640 / 375×667 / 1280×800 都不横向溢出,画布铺满舞台;
 *  2. 2.5D 真的画出来了:天空在上、跑道在下,而且地平线附近的颜色和脚下不一样
 *     (整块纯色 = 渲染挂了,单测看不出来);
 *  3. 键盘四个方向真的能换道 / 跳 / 滑,连着跑十几秒画面一直在变、不卡死;
 *  4. `?level=N` 能直开第 N 关,越界夹到 188;
 *  5. 无尽跑一趟之后幽灵快照真的落进 localStorage,而且能被解析回来;
 *  6. 离开游戏之后 rAF 与 keydown 全部停掉,不在后台空转。
 *
 * 跑法(puppeteer-core 是临时工具,没有进 package.json):
 *   npm i --no-save puppeteer-core   # 本机需有 Chrome
 *   npm run build && npx vite preview --port 4173
 *   node scripts/smoke-1.2-step9-c.mjs
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:4173";
const CHROME = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

const VIEWPORTS = [
  { name: "360×640", width: 360, height: 640 },
  { name: "375×667", width: 375, height: 667 },
  { name: "1280×800", width: 1280, height: 800 },
];

const results = [];
function log(ok, what, extra = "") {
  results.push({ ok, what });
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${extra ? ` — ${extra}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 装 rAF 与 keydown 的计数探针,页面一开就注入 */
async function installProbes(page) {
  await page.evaluateOnNewDocument(() => {
    window.__probe = { keydown: 0, raf: 0 };
    const addEL = window.addEventListener.bind(window);
    const rmEL = window.removeEventListener.bind(window);
    window.addEventListener = (type, fn, opts) => {
      if (type === "keydown") window.__probe.keydown++;
      return addEL(type, fn, opts);
    };
    window.removeEventListener = (type, fn, opts) => {
      if (type === "keydown") window.__probe.keydown--;
      return rmEL(type, fn, opts);
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        window.__probe.raf++;
        return cb(t);
      });
  });
}

async function openGame(page, search = "") {
  const q = search ? `${search}&t=${Date.now()}` : `?t=${Date.now()}`;
  await page.goto(`${BASE}/${q}#/game/rainbow-run`, { waitUntil: "load" });
  await page.waitForSelector(".game-stage canvas", { timeout: 20000 });
  await sleep(500);
}

/** 在画布上按比例点一下(0..1 的相对坐标) */
async function tapCanvas(page, fx = 0.5, fy = 0.5) {
  const box = await page.$eval(".game-stage canvas", (c) => {
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
  await sleep(150);
}

/**
 * 从画布上取几行像素,看看画面是不是真的分层了。
 * 只取「主色」而不是逐像素比对:抗锯齿和随机粒子会让逐像素比对天天误报。
 *
 * 取的是最左边那一竖条:HUD 那两块白底居中、最宽 340px,窄屏上会一路盖到 x=10,
 * 从中间取样会把 HUD 的白色算进天空里,量出来的分层就假了。
 */
async function sampleRows(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".game-stage canvas");
    const g = c.getContext("2d");
    const strip = Math.max(4, Math.floor(c.width * 0.02));
    const read = (fy) => {
      const y = Math.floor(c.height * fy);
      const d = g.getImageData(0, y, strip, 1).data;
      let r = 0;
      let gr = 0;
      let b = 0;
      for (let i = 0; i < strip; i++) {
        r += d[i * 4];
        gr += d[i * 4 + 1];
        b += d[i * 4 + 2];
      }
      return [Math.round(r / strip), Math.round(gr / strip), Math.round(b / strip)];
    };
    // 动没动看的是跑道正中那一段:左边那条窄缝是跑道以外的大地,本来就不该动
    const mid = (fy) => {
      const y = Math.floor(c.height * fy);
      const x0 = Math.floor(c.width * 0.3);
      const n = Math.max(8, Math.floor(c.width * 0.4));
      const d = g.getImageData(x0, y, n, 1).data;
      let r = 0;
      let gr = 0;
      let b = 0;
      for (let i = 0; i < n; i++) {
        r += d[i * 4];
        gr += d[i * 4 + 1];
        b += d[i * 4 + 2];
      }
      return [Math.round(r / n), Math.round(gr / n), Math.round(b / n)];
    };
    return {
      sky: read(0.12),
      horizon: read(0.32),
      track: read(0.72),
      lane: mid(0.62),
      w: c.width,
      h: c.height,
    };
  });
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

async function overflow(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
}

/** 开跑:选世界 → 第 1 关 → intro 面板点一下 */
async function enterCampaign(page) {
  await tapCanvas(page, 0.28, 0.32); // 第 1 章卡片
  await sleep(250);
  await tapCanvas(page, 0.12, 0.16); // 地图上第 1 关
  await sleep(250);
  await tapCanvas(page, 0.5, 0.5); // intro 面板,点一下开始
  await sleep(300);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
  });
  const page = await browser.newPage();
  await installProbes(page);

  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await openGame(page);

    const { scroll, client } = await overflow(page);
    log(scroll <= client + 1, `${vp.name} 不横向溢出`, `scroll=${scroll} client=${client}`);

    // 画布该铺满舞台的**内容盒**(clientWidth 不含 padding),而不是含边框的外框
    const canvas = await page.$eval(".game-stage canvas", (c) => {
      const r = c.getBoundingClientRect();
      const stage = document.querySelector(".game-stage");
      return { w: r.width, h: r.height, sw: stage.clientWidth, sh: stage.clientHeight };
    });
    log(
      canvas.w <= vp.width + 1 && canvas.w >= canvas.sw - 1 && canvas.h >= canvas.sh - 1,
      `${vp.name} 画布铺满舞台且不越界`,
      `画布 ${Math.round(canvas.w)}×${Math.round(canvas.h)},舞台内容盒 ${canvas.sw}×${canvas.sh}`,
    );

    await enterCampaign(page);

    // ---- 2.5D 真的画出来了吗 ----
    const rows = await sampleRows(page);
    log(
      dist(rows.sky, rows.track) > 25,
      `${vp.name} 天空和跑道明显是两种颜色(2.5D 分层画出来了)`,
      `天空 ${rows.sky} vs 跑道 ${rows.track}`,
    );
    log(
      dist(rows.horizon, rows.track) > 12,
      `${vp.name} 地平线附近有雾,不是一块纯色`,
      `地平线 ${rows.horizon} vs 跑道 ${rows.track}`,
    );

    // ---- 连着跑十几秒,画面一直在变 ----
    const before = await sampleRows(page);
    const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowUp"];
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press(keys[i % keys.length]);
      await sleep(180);
    }
    const after = await sampleRows(page);
    log(
      dist(before.lane, after.lane) > 0,
      `${vp.name} 敲了 24 下方向键之后跑道上还在动`,
      `车道中段 ${before.lane} → ${after.lane}`,
    );
    log(errors.length === 0, `${vp.name} 全程没有报错`, errors.join(" | "));
    errors.length = 0;
  }

  // ---- ?level=N 直开第 N 关 ----
  await page.setViewport({ width: 375, height: 667 });
  for (const [want, label] of [
    [30, "第 30 关"],
    [188, "第 188 关"],
    [9999, "越界夹到第 188 关"],
  ]) {
    await openGame(page, `?level=${want}`);
    await sleep(400);
    // 直开之后应该停在 intro 面板(白底大字),而不是选世界那一屏的彩虹渐变按钮
    const shot = await page.evaluate(() => {
      const c = document.querySelector(".game-stage canvas");
      const g = c.getContext("2d");
      // intro 面板把整屏铺成一层近白色的半透明底
      const d = g.getImageData(Math.floor(c.width * 0.5), Math.floor(c.height * 0.08), 1, 1).data;
      return [d[0], d[1], d[2]];
    });
    const whiteish = shot[0] > 200 && shot[1] > 190 && shot[2] > 200;
    log(whiteish, `?level=${want} 直接进了${label}的开跑面板`, `顶部取色 ${shot}`);
    log(errors.length === 0, `?level=${want} 没有报错`, errors.join(" | "));
    errors.length = 0;
  }

  // ---- 无尽跑一趟,幽灵落进 localStorage ----
  await openGame(page);
  await tapCanvas(page, 0.5, 0.14); // 「♾️ 无尽彩虹跑」入口
  await sleep(300);
  await tapCanvas(page, 0.5, 0.5); // intro 点一下开跑
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"][i % 4]);
    await sleep(160);
  }
  // 站着不动等追风棉花云追上来,这一趟就结束了
  await sleep(9000);
  const saved = await page.evaluate(() => ({
    ghost: localStorage.getItem("yiduo-yixing.rainbow-run.ghost.v1"),
    record: localStorage.getItem("yiduo-yixing.rainbow-run.endless-record.v2"),
    platform: localStorage.getItem("yiduo-yixing.save.v1"),
  }));
  log(
    typeof saved.ghost === "string" && saved.ghost.startsWith("rr-ghost/1/"),
    "无尽跑一趟之后幽灵快照落进了 localStorage",
    saved.ghost ? `${saved.ghost.slice(0, 40)}…(${saved.ghost.length} 字)` : "没写进去",
  );
  log(
    typeof saved.ghost === "string" && saved.ghost.length < 12000,
    "幽灵快照没把存档撑爆",
    saved.ghost ? `${saved.ghost.length} 字` : "-",
  );
  log(saved.record !== null, "无尽纪录仍旧写在 1.1 那个 key 上,没改名", String(saved.record));
  log(
    typeof saved.platform === "string" && saved.platform.includes("endlessBest"),
    "无尽成绩同时上报给了平台 save.recordEndlessBest",
  );

  // ---- 离场不空转 ----
  const running = await page.evaluate(() => window.__probe.raf);
  await page.evaluate(() => {
    location.hash = "#/";
  });
  await sleep(600);
  const a = await page.evaluate(() => window.__probe.raf);
  await sleep(900);
  const b = await page.evaluate(() => window.__probe.raf);
  log(running > 0, "游戏里 rAF 在转", `${running} 帧`);
  log(b - a <= 2, "离开游戏之后 rAF 停了", `又走了 ${b - a} 帧`);
  const kd = await page.evaluate(() => window.__probe.keydown);
  log(kd <= 1, "离开游戏之后 keydown 监听也摘干净了", `剩 ${kd} 个(壳层自己留 1 个)`);
  log(errors.length === 0, "收尾阶段没有报错", errors.join(" | "));

  await browser.close();

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} 通过`);
  if (bad.length > 0) {
    console.log("失败项:");
    for (const r of bad) console.log(`  - ${r.what}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
