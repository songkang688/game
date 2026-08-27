/**
 * S1 定因:360px 下首页那 24px 横向溢出到底是谁撑的。
 *
 * 前三轮把这 24px 记在 `bowling-lane` 头上,是因为走查流程量它的时候
 * 已经退回首页了。这一份直接量首页,并做一次因果验证:
 * 把嫌疑元素临时 `display:none`,看溢出会不会归零。
 *
 * 只读页面、只在浏览器内存里改内联样式,不碰任何产品代码。
 *
 * 用法:node scripts/qa-window3/homeoverflow.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import * as D from "./driver.mjs";

const main = async () => {
  const { browser, page } = await D.launch({ width: 360, height: 720 });
  const errs = D.collectErrors(page);
  await page.goto(`${D.BASE}/`, { waitUntil: "networkidle0" });
  await D.sleep(1200);

  const out = await page.evaluate(() => {
    const de = document.documentElement;
    // 横向能自己滚 / 自己裁的祖先会把超出部分吃掉,撑不宽文档。
    // 只有一路到 body 都是 visible 的,才是真正把 scrollWidth 顶开的那个。
    const escapes = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden") return false;
      }
      return true;
    };
    const escaping = [];
    const caught = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      const past = Math.round(r.right - de.clientWidth);
      if (past <= 0 || r.width < 8 || r.height < 8) continue;
      const rec = {
        past,
        left: Math.round(r.left),
        w: Math.round(r.width),
        cls: (typeof el.className === "string" && el.className) || el.tagName,
      };
      (escapes(el) ? escaping : caught).push(rec);
    }
    escaping.sort((a, b) => b.past - a.past);
    caught.sort((a, b) => b.past - a.past);

    const btn = document.querySelector(".home-search-clear");
    const box = document.querySelector(".home-search");
    const toolbar = document.querySelector(".home-toolbar");
    const before = {
      docOverflow: de.scrollWidth - de.clientWidth,
      htmlOverflowX: getComputedStyle(de).overflowX,
      searchBoxW: Math.round(box.getBoundingClientRect().width),
      toolbarW: Math.round(toolbar.getBoundingClientRect().width),
      // 代码里写了 clearBtn.hidden = true,但 class 规则的 display 把 UA 的 [hidden] 顶掉了
      clearBtnHiddenProp: btn.hidden,
      clearBtnComputedDisplay: getComputedStyle(btn).display,
      clearBtnW: Math.round(btn.getBoundingClientRect().width),
      clearBtnRight: Math.round(btn.getBoundingClientRect().right),
      searchQuery: document.querySelector(".home-search-input").value,
    };
    btn.style.display = "none";
    void de.offsetWidth;
    const after = {
      docOverflow: de.scrollWidth - de.clientWidth,
      searchBoxW: Math.round(box.getBoundingClientRect().width),
    };
    btn.style.display = "";
    return { before, after, escaping: escaping.slice(0, 8), caught: caught.slice(0, 8) };
  });

  console.log(`首页 360px:横向溢出 ${out.before.docOverflow}px,html{overflow-x}=${out.before.htmlOverflowX}`);
  console.log(`真正撑宽文档的(没有可滚祖先接住):`);
  for (const e of out.escaping) console.log(`  ✗ 超出 ${e.past}px <${e.cls}> left=${e.left} w=${e.w}`);
  console.log(`被可滚祖先接住、不撑宽文档的(仅对照):`);
  for (const e of out.caught.slice(0, 4)) console.log(`  · 超出 ${e.past}px <${e.cls}>`);
  console.log(
    `\n.home-toolbar 宽 ${out.before.toolbarW}px,里面的 .home-search 却是 ${out.before.searchBoxW}px` +
      `(搜索框是空的:query=${JSON.stringify(out.before.searchQuery)})`
  );
  console.log(
    `.home-search-clear:代码里 hidden=${out.before.clearBtnHiddenProp},` +
      `但算出来 display=${out.before.clearBtnComputedDisplay}、宽 ${out.before.clearBtnW}px、右边到 ${out.before.clearBtnRight}px`
  );
  console.log(
    `因果验证:把它临时 display:none → .home-search ${out.before.searchBoxW}px → ${out.after.searchBoxW}px,` +
      `文档溢出 ${out.before.docOverflow}px → ${out.after.docOverflow}px`
  );
  console.log(`console 报错 ${errs.errors.length} 条`);

  mkdirSync("docs/qa/_evidence", { recursive: true });
  writeFileSync(
    "docs/qa/_evidence/window3-round3-homeoverflow.json",
    JSON.stringify({ ...out, consoleErrors: errs.errors.length }, null, 2)
  );
  console.log("证据落盘:docs/qa/_evidence/window3-round3-homeoverflow.json");
  await browser.close();
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
