import { chromium } from "playwright";
const BASE = "http://localhost:5173";
const LV = Number(process.argv[2] ?? 139);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, reducedMotion: "reduce" });
await ctx.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = `*,*::before,*::after{animation:none!important;transition:none!important;}`;
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", String(e)));
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE", m.text()));

await page.goto(BASE, { waitUntil: "load" });
await page.evaluate((lv) => {
  const stars = Array.from({ length: 188 }, (_, i) => (i < lv ? 3 : 0));
  localStorage.setItem("yiduo-yixing.l99.color-fun", JSON.stringify(stars));
}, LV);
await page.goto(`${BASE}/?t=${Date.now()}#/game/color-fun`, { waitUntil: "load" });
await page.waitForSelector(".l99-grid");
const tabs = page.locator(".l99-tab");
for (let i = 0; i < (await tabs.count()); i++) {
  await tabs.nth(i).click({ force: true });
  await page.waitForTimeout(80);
  const node = page.locator(`.l99-node[aria-label^="第 ${LV + 1} 关"]:not(.l99-node-lock)`);
  if (await node.count()) { await node.first().click({ force: true }); break; }
}
await page.waitForTimeout(1500);

const cfg = await page.evaluate(async (lv) => {
  const mod = await import("/src/games/color-fun/levels.ts");
  const c = mod.LEVELS[lv];
  const mixFor = {};
  for (const [k, v] of Object.entries(mod.MIX_TABLE)) mixFor[v] = k.split("+");
  return { mode: c.mode, order: c.order, budget: c.budget, tasks: c.tasks, needMix: c.needMix, palette: c.palette, mixFor, given: c.given };
}, LV);
console.log("CFG", JSON.stringify(cfg, null, 1).slice(0, 1500));
console.log("regions in DOM:", await page.locator(".cf-region").count());
console.log("swatches:", await page.locator(".cf-swatch").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))));

const unlocked = new Set(cfg.palette);
for (const task of cfg.tasks) {
  if (await page.locator(".l99-ov-title").count()) { console.log("OVERLAY", await page.locator(".l99-ov-title").textContent()); break; }
  if (!unlocked.has(task.color)) {
    const pair = cfg.mixFor[task.color];
    console.log("mixing", task.color, pair);
    if (!pair) { console.log("CANNOT MIX", task.color); break; }
    for (const p of pair) { await page.locator(`.cf-mix-primary[aria-label="倒入${p}"]`).first().click({ force: true }); await page.waitForTimeout(250); }
    await page.waitForTimeout(700);
    unlocked.add(task.color);
  }
  const sw = page.locator(`.cf-swatch[aria-label="${task.color}"]`);
  console.log("task", task.region, task.color, "swatchCount=", await sw.count());
  if (!(await sw.count())) { console.log("NO SWATCH for", task.color); break; }
  await sw.first().click({ force: true });
  await page.waitForTimeout(150);
  await page.locator(`.cf-region[data-id="${task.region}"]`).first().click({ force: true });
  await page.waitForTimeout(300);
  console.log("   msg:", await page.locator(".cf-msg").textContent(), "| prog:", await page.locator(".cf-progress").textContent());
}
await page.waitForTimeout(1500);
console.log("overlay?", await page.locator(".l99-ov-title").count(), await page.locator(".l99-ov-title").textContent().catch(() => ""));
await browser.close();
