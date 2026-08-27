// 单独把每款游戏首屏 + 战役地图上的所有可点按钮列出来，用于核对 meta.modes 是否都有入口。
import { launch, gotoGame, clearStorage, seedProgress, BASE } from './driver.mjs';

const IDS = process.argv.slice(2);

const listButtons = async (page) =>
  page.evaluate(() => {
    const stage = document.querySelector('.game-stage') || document.body;
    const seen = [];
    for (const el of stage.querySelectorAll('button, [role="button"], .l99-tab, a')) {
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const r = el.getBoundingClientRect();
      if (!t || r.width < 4 || r.height < 4) continue;
      seen.push({ t: t.slice(0, 40), cls: el.className?.toString?.().slice(0, 40) ?? '' });
    }
    return seen;
  });

const main = async () => {
  const { browser, page } = await launch();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  for (const id of IDS) {
    await clearStorage(page);
    await seedProgress(page, id, 188);
    await gotoGame(page, id);
    const first = await listButtons(page);
    console.log('==', id);
    console.log('  首屏:', first.map((b) => `${b.t}[${b.cls}]`).join(' | '));
  }
  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
