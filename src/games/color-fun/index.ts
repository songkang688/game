import { meta } from "./meta";
export { meta };

import { mountLevelGame, rateBelow, type GameApi, type PlayCtx, type PlayHandle } from "../level99";
import { ALL_PAINTS, CHAPTERS, LEVELS, MIX_TABLE, PICTURES, type ColorLevel } from "./levels";

const THEME_BG = [
  "linear-gradient(#fff9db,#ffec99)",
  "linear-gradient(#e9fac8,#d3f9d8)",
  "linear-gradient(#d0f4ff,#a5d8ff)",
  "linear-gradient(#c8c3f0,#e5dbff)",
  "linear-gradient(#fff3bf,#ffe8cc)",
  "linear-gradient(#ffdeeb,#fcc2d7)",
];

const CSS = `
.cf-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;box-sizing:border-box;
  border-radius:16px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.cf-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cf-badge{font-size:14px;font-weight:800;color:#7a5a20;background:#ffffffd9;border-radius:999px;padding:5px 12px;
  box-shadow:0 2px 6px rgba(150,130,80,.2);}
.cf-msg{min-height:22px;font-size:15px;font-weight:800;color:#e8590c;text-align:center;}
.cf-canvas{background:#fff;border-radius:14px;box-shadow:0 4px 0 #0001;max-width:100%;height:auto;}
.cf-canvas .cf-region{cursor:pointer;stroke:#495057;stroke-width:3;stroke-linejoin:round;transition:fill .2s;}
.cf-canvas .cf-region.cf-shake{animation:cfShake .35s;}
@keyframes cfShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.cf-canvas .cf-num{font-weight:900;pointer-events:none;}
.cf-chips{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:400px;}
.cf-chip{display:flex;align-items:center;gap:5px;background:#ffffffd9;border-radius:999px;padding:4px 10px;
  font-size:13px;font-weight:800;color:#5c4a30;box-shadow:0 2px 5px rgba(150,130,80,.18);}
.cf-chip-dot{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 2px #0003;}
.cf-palette{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.cf-swatch{width:46px;height:46px;border-radius:50%;border:4px solid #fff;cursor:pointer;position:relative;
  box-shadow:0 3px 0 #0002;transition:transform .15s;padding:0;}
.cf-swatch:active{transform:scale(.92);}
.cf-swatch.cf-picked{transform:scale(1.18);border-color:#343a40;}
.cf-swatch.cf-unlock{animation:cfUnlock .6s;}
@keyframes cfUnlock{0%{transform:scale(0)}70%{transform:scale(1.3)}100%{transform:scale(1)}}
.cf-swatch .cf-swatch-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:900;color:#fff;text-shadow:0 1px 3px #0008;}
.cf-mixer{display:flex;gap:8px;align-items:center;background:#ffffffd9;border-radius:14px;padding:6px 12px;
  flex-wrap:wrap;justify-content:center;}
.cf-mix-label{font-size:14px;font-weight:800;color:#e67700;}
.cf-mix-slot{width:34px;height:34px;border-radius:50%;border:3px dashed #ced4da;background:#fff;
  display:flex;align-items:center;justify-content:center;font-size:16px;}
.cf-mix-primary{width:34px;height:34px;border-radius:50%;border:3px solid #fff;cursor:pointer;
  box-shadow:0 2px 0 #0002;padding:0;}
.cf-mix-primary:active{transform:scale(.9);}
.cf-preview{font-size:15px;font-weight:900;color:#6741d9;background:#ffffffd9;border-radius:999px;padding:6px 14px;}
`;

function playLevel(stage: HTMLElement, ctx: PlayCtx): PlayHandle {
  const cfg: ColorLevel = LEVELS[ctx.level];
  const pic = PICTURES[cfg.pic];
  const timeouts = new Set<ReturnType<typeof setTimeout>>();
  let destroyed = false;
  let ended = false;
  let wrong = 0;
  let picked: string | null = null;
  let previewing = cfg.mode === "memory";
  const pending = new Map<string, string>(cfg.tasks.map((k) => [k.region, k.color]));
  const unlocked: string[] = [...cfg.palette];
  let mixA: string | null = null;
  /** 数字涂色：颜色 → 编号（按调色盘顺序） */
  const numberOf = new Map<string, number>(cfg.palette.map((c, i) => [c, i + 1]));

  function later(fn: () => void, ms: number): void {
    const t = setTimeout(() => {
      timeouts.delete(t);
      if (!destroyed && !ended) fn();
    }, ms);
    timeouts.add(t);
  }

  const wrap = document.createElement("div");
  wrap.className = "cf-wrap";
  wrap.style.background = THEME_BG[cfg.pic];
  wrap.innerHTML = `
    <style>${CSS}</style>
    <div class="cf-top">
      <span class="cf-badge">${pic.emoji} ${pic.name}</span>
      <span class="cf-badge cf-progress">🖌️ 0/${cfg.tasks.length}</span>
      <span class="cf-badge cf-miss">💗 ${"❤".repeat(cfg.maxWrong + 1)}</span>
    </div>
    ${cfg.mode === "memory" ? `<div class="cf-preview">👀 记住每个地方的颜色…</div>` : ""}
    <svg class="cf-canvas" viewBox="0 0 400 300" width="400" height="300" role="img" aria-label="待涂色的线稿"></svg>
    <div class="cf-chips"></div>
    ${cfg.needMix.length > 0 ? `
    <div class="cf-mixer">
      <span class="cf-mix-label">🥣 调色锅：</span>
      <span class="cf-mix-slot cf-slot-a">?</span>
      <span class="cf-mix-label">+</span>
      <span class="cf-mix-slot cf-slot-b">?</span>
      <span class="cf-mix-label cf-mix-tip">→ 倒两种原色试试</span>
      <span class="cf-mix-primaries"></span>
    </div>` : ""}
    <div class="cf-palette"></div>
    <div class="cf-msg"></div>
  `;
  stage.appendChild(wrap);

  const svg = wrap.querySelector(".cf-canvas") as unknown as SVGSVGElement;
  const progressEl = wrap.querySelector(".cf-progress") as HTMLElement;
  const missEl = wrap.querySelector(".cf-miss") as HTMLElement;
  const chipsEl = wrap.querySelector(".cf-chips") as HTMLElement;
  const paletteEl = wrap.querySelector(".cf-palette") as HTMLElement;
  const msgEl = wrap.querySelector(".cf-msg") as HTMLElement;
  const previewEl = wrap.querySelector(".cf-preview") as HTMLElement | null;
  const slotA = wrap.querySelector(".cf-slot-a") as HTMLElement | null;
  const slotB = wrap.querySelector(".cf-slot-b") as HTMLElement | null;
  const mixTip = wrap.querySelector(".cf-mix-tip") as HTMLElement | null;
  const primariesEl = wrap.querySelector(".cf-mix-primaries") as HTMLElement | null;

  // --- 画布 ---
  svg.innerHTML = pic.regions
    .map((r) => r.svg.replace(/\/>$/, ` class="cf-region" data-id="${r.id}" fill="#ffffff"/>`))
    .join("");
  const regionEls = new Map<string, SVGElement>();
  svg.querySelectorAll<SVGElement>(".cf-region").forEach((el) => {
    const id = el.getAttribute("data-id") ?? "";
    regionEls.set(id, el);
    el.addEventListener("click", () => onRegion(id));
  });

  // 数字涂色：给每个任务区域贴编号
  const numEls = new Map<string, SVGTextElement>();
  if (cfg.mode === "number") {
    for (const task of cfg.tasks) {
      const r = pic.regions.find((x) => x.id === task.region);
      if (!r) continue;
      const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("x", String(r.lx));
      txt.setAttribute("y", String(r.ly));
      txt.setAttribute("text-anchor", "middle");
      txt.setAttribute("font-size", "18");
      txt.setAttribute("fill", "#495057");
      txt.setAttribute("class", "cf-num");
      txt.textContent = String(numberOf.get(task.color) ?? "?");
      svg.appendChild(txt);
      numEls.set(task.region, txt);
    }
  }

  function updateHud(): void {
    progressEl.textContent = `🖌️ ${cfg.tasks.length - pending.size}/${cfg.tasks.length}`;
    missEl.textContent = `💗 ${"❤".repeat(Math.max(0, cfg.maxWrong + 1 - wrong))}${"🤍".repeat(Math.min(wrong, cfg.maxWrong + 1))}`;
  }

  function renderChips(): void {
    if (cfg.mode === "number" || cfg.mode === "memory") {
      chipsEl.innerHTML = "";
      return;
    }
    chipsEl.innerHTML = "";
    for (const task of cfg.tasks) {
      if (!pending.has(task.region)) continue;
      const r = pic.regions.find((x) => x.id === task.region);
      const chip = document.createElement("span");
      chip.className = "cf-chip";
      chip.innerHTML = `<span class="cf-chip-dot" style="background:${ALL_PAINTS[task.color]}"></span>${r?.name ?? task.region}→${task.color}`;
      chipsEl.appendChild(chip);
    }
  }

  function renderPalette(): void {
    paletteEl.innerHTML = "";
    for (const name of unlocked) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cf-swatch" + (name === picked ? " cf-picked" : "");
      btn.style.background = ALL_PAINTS[name];
      btn.title = name;
      btn.setAttribute("aria-label", name);
      if (cfg.mode === "number" && numberOf.has(name)) {
        btn.innerHTML = `<span class="cf-swatch-num">${numberOf.get(name)}</span>`;
      }
      btn.addEventListener("click", () => {
        if (ended || previewing) return;
        ctx.sfx("tap");
        picked = name;
        renderPalette();
        msgEl.textContent = `选好${name}啦，去涂吧！`;
      });
      paletteEl.appendChild(btn);
    }
  }

  function finish(): void {
    ended = true;
    const got = rateBelow(wrong, 0, 2);
    ctx.win(got, wrong === 0 ? `${pic.name}一笔都没涂错，真是小画家！` : `${pic.name}涂得五彩缤纷，真好看！`);
  }

  function onRegion(id: string): void {
    if (ended || previewing) return;
    const el = regionEls.get(id);
    if (!el) return;
    const want = pending.get(id);
    if (want === undefined) {
      msgEl.textContent = "这里不用涂哦，看看还差哪里～";
      return;
    }
    if (!picked) {
      msgEl.textContent = "先在下面选一个颜色～";
      return;
    }
    if (picked === want) {
      el.setAttribute("fill", ALL_PAINTS[want]);
      pending.delete(id);
      numEls.get(id)?.remove();
      ctx.sfx("pop");
      const r = pic.regions.find((x) => x.id === id);
      msgEl.textContent = `${r?.name ?? "这里"}涂上${want}，真好看！`;
      updateHud();
      renderChips();
      if (pending.size === 0) later(() => finish(), 500);
    } else {
      wrong++;
      ctx.sfx("oops");
      el.classList.add("cf-shake");
      later(() => el.classList.remove("cf-shake"), 400);
      msgEl.textContent = cfg.mode === "memory" ? "想一想刚才这里是什么颜色～" : "颜色不对哦，看看提示再试试～";
      updateHud();
      if (wrong > cfg.maxWrong) {
        ended = true;
        ctx.lose("颜料有点调皮，我们休息一下再画一次！");
      }
    }
  }

  // --- 调色锅 ---
  if (primariesEl && slotA && slotB && mixTip) {
    for (const p of ["红色", "黄色", "蓝色"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cf-mix-primary";
      btn.style.background = ALL_PAINTS[p];
      btn.title = `倒入${p}`;
      btn.setAttribute("aria-label", `倒入${p}`);
      btn.addEventListener("click", () => onPour(p));
      primariesEl.appendChild(btn);
    }
  }

  function resetPot(): void {
    mixA = null;
    if (slotA) { slotA.style.background = "#fff"; slotA.textContent = "?"; }
    if (slotB) { slotB.style.background = "#fff"; slotB.textContent = "?"; }
    if (mixTip) mixTip.textContent = "→ 倒两种原色试试";
  }

  function onPour(p: string): void {
    if (ended || previewing) return;
    ctx.sfx("tap");
    if (!mixA) {
      mixA = p;
      if (slotA) { slotA.style.background = ALL_PAINTS[p]; slotA.textContent = ""; }
      if (mixTip) mixTip.textContent = "→ 再倒一种原色";
      return;
    }
    const key = [mixA, p].sort().join("+");
    if (slotB) { slotB.style.background = ALL_PAINTS[p]; slotB.textContent = ""; }
    const result = MIX_TABLE[key];
    later(() => {
      if (result && cfg.needMix.includes(result)) {
        if (!unlocked.includes(result)) {
          unlocked.push(result);
          ctx.sfx("coin");
          msgEl.textContent = `🥣 ${key.replace("+", " 加 ")}变出了${result}！`;
          picked = result;
          renderPalette();
          (paletteEl.lastElementChild as HTMLElement | null)?.classList.add("cf-unlock");
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
        msgEl.textContent = "这两种颜色调不出新颜色，换个搭配试试～";
      }
      resetPot();
    }, 320);
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
    msgEl.textContent =
      cfg.mode === "number"
        ? "看画上的数字，用同号颜色涂它～"
        : cfg.needMix.length > 0
          ? "有些颜色要用调色锅调出来哦～"
          : "先点一个颜色，再点画上想涂的地方～";
  }

  updateHud();
  renderChips();
  renderPalette();

  return {
    destroy() {
      destroyed = true;
      ended = true;
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
      wrap.remove();
    }
  };
}

export function mount(api: GameApi): { destroy: () => void } {
  return mountLevelGame(api, {
    id: meta.id,
    chapters: CHAPTERS,
    mapHint: "六个村镇六幅画，每关的颜色搭配都不一样～",
    grandMessage: "99 关全部涂完，你是五彩缤纷的小画家！",
    playLevel,
  });
}
