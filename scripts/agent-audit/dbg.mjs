import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
});
for (const game of ["snake-royale", "orb-arena"]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`http://127.0.0.1:5173/#/game/${game}`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => document.querySelector(".l99-node:not(.l99-node-lock)")?.click());
  await new Promise((r) => setTimeout(r, 1800));
  const cls = game === "snake-royale" ? ".sr-modebar" : ".oa-modebar";
  const visible = await page.evaluate((c) => {
    const el = document.querySelector(c);
    return el ? getComputedStyle(el).display : "missing";
  }, cls);
  await page.screenshot({ path: `/tmp/shots/verify/${game}-enter-level.png` });
  console.log(game, "modebar display:", visible);
  await page.close();
}
await browser.close();
