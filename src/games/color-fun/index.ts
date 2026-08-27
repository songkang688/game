import { meta } from "./meta";
export { meta };

import {
  chapterOf,
  furthestPlayable,
  loadSkips,
  loadStars,
  mountLevelGame,
  rateBelow,
  TOTAL_LEVELS,
  type GameApi,
  type PlayCtx,
  type PlayHandle,
} from "../level99";
import guide from "./guide";
import {
  ALL_PAINTS,
  CHAPTERS,
  DEFAULT_POT_INPUTS,
  LEVELS,
  PICTURES,
  paintSymbol,
  ruleText,
  type ColorLevel,
} from "./levels";
import { mixName, mixWhy, stirColor } from "./mix";
import { PaintHistory } from "./history";
import { openSandbox } from "./sandboxUi";
import { openLevelOnMap, parseLevelParam, resolveInitialLevel } from "./runtime";
import {
  CLF_CSS,
  STIR_MS,
  confetti,
  makeChip,
  makePrimary,
  makeSwatch,
  fitColoringStage,
  pictureSvgBody,
  pinCanvas,
  prefersReducedMotion,
} from "./ui";

const THEME_BG = [
  "linear-gradient(#fff9db,#ffec99)",
  "linear-gradient(#e9fac8,#d3f9d8)",
  "linear-gradient(#d0f4ff,#a5d8ff)",
  "linear-gradient(#c8c3f0,#e5dbff)",
  "linear-gradient(#fff3bf,#ffe8cc)",
  "linear-gradient(#ffdeeb,#fcc2d7)",
  "linear-gradient(#ffe3e3,#ffc9c9)",
  "linear-gradient(#e6fcf5,#c3fae8)",
  "linear-gradient(#f8f0fc,#eebefa)",
  "linear-gradient(#edf2ff,#dbe4ff)",
];

/** 双指最多放大到几倍（窄屏上窗户那种小块靠它才点得准） */
const MAX_ZOOM = 2.5;

/** 开场白：每种玩法一句，说清这一关要干什么 */
export function introFor(cfg: ColorLevel): string {
  switch (cfg.mode) {
    case "number":
      return "看画上的数字，用同号颜色涂它～";
    case "shade":
      return "同一种颜色分深浅，按 1、2、3 由浅到深涂～";
    case "rule":
      return "已经涂好的那几块是参照，按规则推出颜色～";
    case "legend":
      return "对着上面的图例，把每个符号涂成对应的颜色～";
    case "limited":
      return "只剩三原色啦，白和黑只能进锅调色，不直接涂～";
    case "memory":
      return "先记住每个地方的颜色，等一下凭记忆涂～";
    default:
      return cfg.needMix.length > 0 ? "有些颜色要用调色锅调出来哦～" : "先点一个颜色，再点画上想涂的地方～";
  }
}

/** 涂上了不对的颜色时说的话：只提醒，不批评，也不算失败 */
export function nudgeFor(cfg: ColorLevel): string {
  switch (cfg.mode) {
    case "memory":
      return "先涂着，想起来了随时改～";
    case "rule":
      return "回到色环想一想这两种颜色的关系，再改也来得及～";
    case "legend":
      return "对照图例再看一眼这块的符号，改一下就好～";
    default:
      return "这块和提示上的色名对一下，改个颜色就行～";
  }
}

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const doc = stage.ownerDocument;
  const cfg: ColorLevel = LEVELS[ctx.level];
  const pic = PICTURES[cfg.pic];
  const potInputs = cfg.potInputs ?? DEFAULT_POT_INPUTS;
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  const softMotion = prefersReducedMotion();

  let destroyed = false;
  let ended = false;
  /** 手误次数：只影响星级，永远不会判负 */
  let slips = 0;
  /** 往调色锅里添了几把柴（预算烧完还能续，续了少一颗星） */
  let refills = 0;
  let picked: string | null = null;
  let previewing = cfg.mode === "memory";

  const want = new Map<string, string>(cfg.tasks.map((k) => [k.region, k.color]));
  const history = new PaintHistory();
  const unlocked: string[] = [...cfg.palette];
  let mixA: string | null = null;
  let mixLeft = cfg.budget ?? Number.POSITIVE_INFINITY;
  let zoom = 1;

  /** 数字涂色用编号、图例大画布用符号：颜色 → 贴在画上的标记 */
  const markOf = new Map<string, string>();
  if (cfg.mode === "number") cfg.palette.forEach((c, i) => markOf.set(c, String(i + 1)));
  if (cfg.mode === "legend") for (const item of cfg.legend ?? []) markOf.set(item.color, item.symbol);
  const regionName = (id: string): string => pic.regions.find((r) => r.id === id)?.name ?? id;

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  /** 重钳一次（`fitColoringStage` 装好之前先是个空壳，渲染顺序决定了它必须晚绑） */
  let refit: () => void = () => {};

  const wrap = doc.createElement("div");
  wrap.className = "clf-wrap";
  wrap.style.background = THEME_BG[ctx.chapterIndex] ?? THEME_BG[0];
  wrap.innerHTML = `
    <style>${CLF_CSS}</style>
    <div class="clf-top">
      <span class="clf-badge">${pic.emoji} ${pic.name}</span>
      <span class="clf-badge clf-progress">🖌️ 0/${cfg.tasks.length}</span>
      <span class="clf-badge clf-slips">✨ 一次没改过</span>
      ${cfg.budget !== undefined ? `<span class="clf-badge clf-budget">🥣 还能开锅 ${cfg.budget} 次</span>` : ""}
    </div>
    ${cfg.mode === "memory" ? `<div class="clf-preview">👀 记住每个地方的颜色…</div>` : ""}
    ${cfg.legend ? `<div class="clf-legend"></div>` : ""}
    <div class="clf-stage">
      <svg class="clf-canvas" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="待涂色的线稿"></svg>
      <button type="button" class="clf-zoom" aria-label="把画放大看清楚">🔍</button>
    </div>
    <div class="clf-chips"></div>
    <div class="clf-tools">
      <button type="button" class="clf-tool clf-undo">↩️ 撤销</button>
      <button type="button" class="clf-tool clf-redo">↪️ 重做</button>
    </div>
    ${cfg.needMix.length > 0 ? `
    <div class="clf-mixer">
      <span class="clf-mix-label">🥣 调色锅</span>
      <span class="clf-pot"><span class="clf-pot-soup"></span><span class="clf-pot-text">空</span></span>
      <span class="clf-mix-label clf-mix-tip">倒两样进去试试</span>
      <span class="clf-primaries"></span>
    </div>` : ""}
    <div class="clf-palette"></div>
    <div class="clf-msg"></div>
  `;
  stage.appendChild(wrap);

  const svg = wrap.querySelector(".clf-canvas") as unknown as SVGSVGElement;
  const stageBox = wrap.querySelector(".clf-stage") as HTMLElement;
  const zoomBtn = wrap.querySelector(".clf-zoom") as HTMLButtonElement;
  const progressEl = wrap.querySelector(".clf-progress") as HTMLElement;
  const slipsEl = wrap.querySelector(".clf-slips") as HTMLElement;
  const budgetEl = wrap.querySelector(".clf-budget") as HTMLElement | null;
  const legendEl = wrap.querySelector(".clf-legend") as HTMLElement | null;
  const chipsEl = wrap.querySelector(".clf-chips") as HTMLElement;
  const paletteEl = wrap.querySelector(".clf-palette") as HTMLElement;
  const msgEl = wrap.querySelector(".clf-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".clf-preview") as HTMLElement | null;
  const undoBtn = wrap.querySelector(".clf-undo") as HTMLButtonElement;
  const redoBtn = wrap.querySelector(".clf-redo") as HTMLButtonElement;
  const potEl = wrap.querySelector(".clf-pot") as HTMLElement | null;
  const potSoup = wrap.querySelector(".clf-pot-soup") as HTMLElement | null;
  const potText = wrap.querySelector(".clf-pot-text") as HTMLElement | null;
  const mixTip = wrap.querySelector(".clf-mix-tip") as HTMLElement | null;
  const primariesEl = wrap.querySelector(".clf-primaries") as HTMLElement | null;

  // --- 画布 ---
  svg.innerHTML = pictureSvgBody(pic);
  const regionEls = new Map<string, SVGElement>();
  svg.querySelectorAll<SVGElement>(".clf-region").forEach((el) => {
    const id = el.getAttribute("data-id") ?? "";
    regionEls.set(id, el);
    el.addEventListener("click", () => onRegion(id));
  });

  // 数字涂色贴编号、图例大画布贴符号
  const markEls = new Map<string, SVGTextElement>();
  if (cfg.mode === "number" || cfg.mode === "legend") {
    for (const task of cfg.tasks) {
      const r = pic.regions.find((x) => x.id === task.region);
      if (!r) continue;
      const txt = doc.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", String(r.lx));
      txt.setAttribute("y", String(r.ly));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("font-size", "18");
      txt.setAttribute("fill", "#495057");
      txt.setAttribute("class", "clf-mark");
      txt.textContent = markOf.get(task.color) ?? "?";
      svg.appendChild(txt);
      markEls.set(task.region, txt);
    }
  }

  // 配色规则关：参照色开局就涂好，孩子照着它推
  for (const g of cfg.given ?? []) {
    regionEls.get(g.region)?.setAttribute("fill", ALL_PAINTS[g.color]);
  }

  // 图例：符号 = 色名 = 色块，三样一起给，色盲的孩子也认得出
  if (legendEl && cfg.legend) {
    for (const it of cfg.legend) {
      legendEl.appendChild(makeChip(doc, `${it.symbol} = ${it.color}`, it.color));
    }
  }

  /** 这一块现在是什么颜色 */
  function fillOf(id: string): string | null {
    return history.replay()[id] ?? null;
  }

  /** 已经涂对了几块 */
  function doneCount(): number {
    const fills = history.replay();
    return cfg.tasks.filter((k) => fills[k.region] === k.color).length;
  }

  function updateHud(): void {
    progressEl.textContent = `🖌️ ${doneCount()}/${cfg.tasks.length}`;
    slipsEl.textContent = slips === 0 ? "✨ 一次没改过" : `✨ 改过 ${slips} 次，没关系`;
    if (budgetEl) budgetEl.textContent = `🥣 还能开锅 ${Math.max(0, mixLeft)} 次`;
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
  }

  /** 渐变关下一块该涂谁（按组由浅到深） */
  function nextInOrder(): string | null {
    if (!cfg.order) return null;
    const fills = history.replay();
    for (const task of cfg.tasks) {
      if (fills[task.region] !== task.color) return task.region;
    }
    return null;
  }

  function renderChips(): void {
    chipsEl.innerHTML = "";
    if (cfg.mode === "number" || cfg.mode === "memory" || cfg.mode === "legend") return;
    const fills = history.replay();
    const order = cfg.order ? cfg.tasks.map((k) => k.region) : [];
    for (const task of cfg.tasks) {
      const ok = fills[task.region] === task.color;
      let chip: HTMLElement;
      if (cfg.mode === "rule") {
        // 只报规则，不报颜色：孩子要自己在色环上推
        const rule = cfg.rules?.find((x) => x.region === task.region);
        chip = makeChip(
          doc,
          rule
            ? `${regionName(task.region)} → ${ruleText(rule.kind, regionName(rule.refRegion))}`
            : `${regionName(task.region)} → ${task.color}`
        );
      } else {
        const step = cfg.order ? `${order.indexOf(task.region) + 1}. ` : "";
        chip = makeChip(doc, `${step}${regionName(task.region)} → ${task.color}`, task.color);
      }
      if (ok) chip.classList.add("clf-chip-done");
      chipsEl.appendChild(chip);
    }
    refit();
  }

  function renderPalette(): void {
    paletteEl.innerHTML = "";
    for (const name of unlocked) {
      const btn = makeSwatch(doc, name, { mark: markOf.get(name) });
      if (name === picked) btn.classList.add("clf-picked");
      btn.addEventListener("click", () => {
        if (ended || previewing) return;
        ctx.sfx("tap");
        picked = name;
        renderPalette();
        msgEl.textContent = `选好${name}啦，去涂吧！`;
      });
      paletteEl.appendChild(btn);
    }
    refit();
  }

  function finish(): void {
    if (ended) return;
    ended = true;
    svg.classList.add("clf-done");
    confetti(wrap, (fn, ms) => {
      const t = setTimeout(() => {
        timeouts.delete(t);
        if (!destroyed) fn();
      }, ms);
      timeouts.add(t);
    });
    // 手误只扣星，绝不判负；添柴续命按两次手误算
    const got = rateBelow(slips + refills * 2, 0, 2);
    ctx.win(got, slips === 0 ? `${pic.name}一笔都没改过，真是小画家！` : `${pic.name}涂得五彩缤纷，真好看！`);
  }

  /** 真正落笔：不管对不对都涂上去，孩子随时能改 */
  function applyPaint(id: string, color: string): void {
    const before = fillOf(id);
    if (before === color) return;
    history.push({ region: id, from: before, to: color });
    repaint();
  }

  /** 按操作栈把整幅画重铺一遍（撤销 / 重做 / 落笔都走它，状态只有一处） */
  function repaint(): void {
    const fills = history.replay();
    for (const r of pic.regions) {
      const el = regionEls.get(r.id);
      if (!el) continue;
      const given = (cfg.given ?? []).find((g) => g.region === r.id);
      const color = fills[r.id] ?? given?.color;
      el.setAttribute("fill", color ? ALL_PAINTS[color] : "#ffffff");
    }
    for (const [region, el] of markEls) {
      el.style.display = fills[region] === want.get(region) ? "none" : "";
    }
    updateHud();
    renderChips();
    if (!ended && cfg.tasks.every((k) => fills[k.region] === k.color)) {
      later(() => finish(), 480);
    }
  }

  function onRegion(id: string): void {
    if (ended || previewing) return;
    if (!regionEls.has(id)) return;
    const target = want.get(id);
    if (target === undefined) {
      msgEl.textContent = "这里不用涂哦，看看还差哪里～";
      return;
    }
    if (!picked) {
      msgEl.textContent = "先在下面选一个颜色～";
      return;
    }
    if (cfg.order) {
      // 渐变关必须由浅到深：顺序不对只提醒，既不涂上去也不扣什么
      const next = nextInOrder();
      if (next && next !== id) {
        msgEl.textContent = `先涂${regionName(next)}，顺着由浅到深来～`;
        return;
      }
    }
    const wasRight = fillOf(id) === target;
    applyPaint(id, picked);
    if (picked === target) {
      ctx.sfx("pop");
      msgEl.textContent = `${regionName(id)}涂上${picked}，真好看！`;
    } else {
      if (!wasRight) slips++;
      ctx.sfx("tap");
      msgEl.textContent = nudgeFor(cfg);
      updateHud();
    }
  }

  undoBtn.addEventListener("click", () => {
    if (ended || previewing) return;
    if (!history.undo()) return;
    ctx.sfx("tap");
    repaint();
    msgEl.textContent = "退回一步啦，接着涂～";
  });
  redoBtn.addEventListener("click", () => {
    if (ended || previewing) return;
    if (!history.redo()) return;
    ctx.sfx("tap");
    repaint();
    msgEl.textContent = "又涂回来啦～";
  });

  // --- 双指放大：窄屏上小块点不准，放大到 2.5× 就好点了 ---
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStart = 0;
  let zoomStart = 1;

  function applyZoom(next: number): void {
    zoom = Math.max(1, Math.min(MAX_ZOOM, next));
    svg.style.transform = `scale(${zoom.toFixed(2)})`;
    zoomBtn.textContent = zoom > 1.05 ? "🔍➖" : "🔍";
    zoomBtn.setAttribute("aria-label", zoom > 1.05 ? "把画缩回原来大小" : "把画放大看清楚");
  }

  function spread(): number {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  const onPointerDown = (e: PointerEvent): void => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      pinchStart = spread();
      zoomStart = zoom;
    }
  };
  const onPointerMove = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size !== 2 || pinchStart <= 0) return;
    e.preventDefault();
    applyZoom((zoomStart * spread()) / pinchStart);
  };
  const onPointerUp = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
  };
  stageBox.addEventListener("pointerdown", onPointerDown);
  stageBox.addEventListener("pointermove", onPointerMove);
  stageBox.addEventListener("pointerup", onPointerUp);
  stageBox.addEventListener("pointercancel", onPointerUp);
  zoomBtn.addEventListener("click", () => {
    ctx.sfx("tap");
    applyZoom(zoom > 1.05 ? 1 : MAX_ZOOM);
  });

  // --- 调色锅 ---
  if (primariesEl) {
    for (const p of potInputs) {
      const btn = makePrimary(doc, p);
      btn.addEventListener("click", () => onPour(p));
      primariesEl.appendChild(btn);
    }
  }

  function resetPot(): void {
    mixA = null;
    if (potSoup) potSoup.style.background = "transparent";
    if (potText) potText.textContent = "空";
    if (mixTip) mixTip.textContent = "倒两样进去试试";
  }

  /** 预算烧完了还差颜色：加一把柴接着调，不判负，只少一颗星 */
  function offerRefill(): void {
    if (!mixTip) return;
    const stillNeed = cfg.tasks.some((k) => !unlocked.includes(k.color));
    if (mixLeft > 0 || !stillNeed || ended) return;
    mixTip.textContent = "柴火烧完啦";
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "clf-tool clf-refill";
    btn.textContent = "🔥 再添一把柴";
    btn.addEventListener("click", () => {
      ctx.sfx("tap");
      refills++;
      mixLeft += 2;
      btn.remove();
      resetPot();
      updateHud();
      msgEl.textContent = "又能开两次锅啦～先想好要哪两样再倒。";
    });
    mixTip.parentElement?.appendChild(btn);
  }

  function onPour(p: string): void {
    if (ended || previewing) return;
    if (mixLeft <= 0) {
      msgEl.textContent = "调色锅的柴火烧完啦，按「再添一把柴」就能接着调～";
      offerRefill();
      return;
    }
    ctx.sfx("tap");
    if (!mixA) {
      mixA = p;
      if (potSoup) potSoup.style.background = ALL_PAINTS[p];
      if (potText) potText.textContent = "";
      if (mixTip) mixTip.textContent = `倒进了${p}，再倒一样`;
      return;
    }
    const a = mixA;
    const result = mixName(a, p);
    mixLeft -= 1;
    updateHud();
    if (potEl && !softMotion) potEl.classList.add("clf-stirring");
    // 搅拌途中锅里的颜色是「减色叠色 → 查表结果」的受控插值，看得见蓝一路走向绿
    const steps = softMotion ? 1 : 6;
    for (let i = 1; i <= steps; i++) {
      later(() => {
        if (potSoup) potSoup.style.background = stirColor(a, p, i / steps);
      }, (STIR_MS / steps) * i);
    }
    later(() => {
      potEl?.classList.remove("clf-stirring");
      if (result && cfg.needMix.includes(result)) {
        if (!unlocked.includes(result)) {
          unlocked.push(result);
          ctx.sfx("coin");
          msgEl.textContent = `🥣 ${mixWhy(a, p) ?? `${a}加${p}`}，变出了${result}！`;
          picked = result;
          renderPalette();
          (paletteEl.lastElementChild as HTMLElement | null)?.classList.add("clf-fresh");
          popStar();
        } else {
          ctx.sfx("pop");
          picked = result;
          renderPalette();
          msgEl.textContent = `又调出一锅${result}，接着涂吧～`;
        }
      } else if (result) {
        ctx.sfx("pop");
        msgEl.textContent = `调出了${result}，不过这一关用不到它～`;
      } else {
        ctx.sfx("oops");
        msgEl.textContent = `${a}和${p}调不出新颜色，换个搭配试试～`;
      }
      resetPot();
      offerRefill();
    }, STIR_MS);
  }

  /** 出色的时候锅口冒一颗小星 */
  function popStar(): void {
    if (!potEl || softMotion) return;
    const star = doc.createElement("span");
    star.className = "clf-pot-star";
    star.textContent = "⭐";
    potEl.appendChild(star);
    later(() => star.remove(), 800);
  }

  // --- 记忆模式：先展示答案再擦掉 ---
  if (cfg.mode === "memory") {
    for (const task of cfg.tasks) {
      regionEls.get(task.region)?.setAttribute("fill", ALL_PAINTS[task.color]);
    }
    let leftMs = cfg.previewMs;
    const step = 100;
    const tick = (): void => {
      leftMs -= step;
      if (previewEl) previewEl.textContent = `👀 记住每个地方的颜色… ${(leftMs / 1000).toFixed(1)}s`;
      if (leftMs > 0) {
        later(tick, step);
        return;
      }
      previewing = false;
      previewEl?.remove();
      for (const task of cfg.tasks) {
        regionEls.get(task.region)?.setAttribute("fill", "#ffffff");
      }
      msgEl.textContent = "开始凭记忆涂色吧！";
    };
    later(tick, step);
  } else {
    msgEl.textContent = introFor(cfg);
  }

  // 限色章额外给一排「色名 + 符号」图例，颜色本身认不出也能对上号
  if (cfg.mode === "limited" && legendEl === null) {
    const strip = doc.createElement("div");
    strip.className = "clf-legend";
    for (const name of [...potInputs, ...cfg.needMix]) {
      strip.appendChild(makeChip(doc, `${paintSymbol(name)} ${name}`, name));
    }
    chipsEl.parentElement?.insertBefore(strip, chipsEl);
  }

  updateHud();
  renderChips();
  renderPalette();
  applyZoom(1);
  // 先钳进舞台看得见的那一段，再钉画布：pinCanvas 要把钳出来的滚动容器也算进监听名单
  const fit = fitColoringStage(wrap, stageBox);
  const unpin = pinCanvas(wrap, stageBox);
  // 指令条与调色盘会随着涂色变高变矮（做完一条划掉、开出新颜色多一颗），每次都重钳
  refit = () => fit.relayout();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      fit.dispose();
      unpin();
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      stageBox.removeEventListener("pointerdown", onPointerDown);
      stageBox.removeEventListener("pointermove", onPointerMove);
      stageBox.removeEventListener("pointerup", onPointerUp);
      stageBox.removeEventListener("pointercancel", onPointerUp);
      pointers.clear();
      history.clear();
      regionEls.clear();
      markEls.clear();
      wrap.remove();
    },
  };
}

/** 壳层给的 `initialLevel`（1 基），没有就看地址栏的 `?level=N` */
function wantedLevel(api: GameApi): unknown {
  const given = (api as { initialLevel?: unknown }).initialLevel;
  if (given !== undefined && given !== null) return given;
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return undefined;
  return parseLevelParam(loc.search ?? "") ?? parseLevelParam(loc.hash ?? "") ?? undefined;
}

export function mount(api: GameApi): { destroy: () => void } {
  const doc = api.root.ownerDocument;
  const host = doc.createElement("div");
  host.style.position = "relative";
  api.root.appendChild(host);

  // 关卡外的一个按钮：自由涂色画室。不产星、不写进度，纯粹给孩子画着玩
  const bar = doc.createElement("div");
  bar.className = "clf-tools";
  bar.style.margin = "0 0 8px";
  const style = doc.createElement("style");
  style.textContent = CLF_CSS;
  const sandboxBtn = doc.createElement("button");
  sandboxBtn.type = "button";
  sandboxBtn.className = "clf-tool clf-sandbox-open";
  sandboxBtn.textContent = "🎨 自由涂色（不计分）";
  bar.append(style, sandboxBtn);
  host.appendChild(bar);

  let sandbox: { destroy: () => void } | null = null;
  const closeSandbox = (): void => {
    sandbox?.destroy();
    sandbox = null;
  };
  sandboxBtn.addEventListener("click", () => {
    api.play("tap");
    if (sandbox) {
      closeSandbox();
      return;
    }
    sandbox = openSandbox(host, { sfx: (n) => api.play(n), onClose: closeSandbox });
  });

  const inner = doc.createElement("div");
  host.appendChild(inner);

  const game = mountLevelGame(
    { ...api, root: inner },
    {
      id: meta.id,
      chapters: CHAPTERS,
      mapHint: "十六幅线稿轮着上，画完还能进画室随便涂～",
      grandMessage: "188 关全部涂完，你是五彩缤纷的小画家！",
      guide,
      playLevel,
    }
  );

  // 壳层或地址栏点名了某一关就直接开进去，不用孩子在 188 个格子里自己找
  const target = resolveInitialLevel(
    wantedLevel(api),
    furthestPlayable(loadStars(meta.id), loadSkips(meta.id), TOTAL_LEVELS),
    TOTAL_LEVELS
  );
  if (target !== null) {
    try {
      openLevelOnMap(inner, target, chapterOf(CHAPTERS, target));
    } catch (err) {
      console.warn("[一朵一星] color-fun 直开关卡失败，停在地图上:", err);
    }
  }

  return {
    destroy() {
      closeSandbox();
      game.destroy();
      host.remove();
    },
  };
}