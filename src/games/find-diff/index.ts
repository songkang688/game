import { SCENES, VIEW_H, VIEW_W, type Scene } from "./scene";

export const meta = {
  id: "find-diff",
  title: "找不同",
  emoji: "🔍",
  category: "edu" as const,
  color: "#63e6be",
  blurb: "五组小画每组藏着 5 处不同，还有放大镜提示帮忙，睁大眼睛找！",
};

type SoundName = "tap" | "win" | "oops" | "coin" | "pop" | "meow" | "jump";

export type GameApi = {
  root: HTMLElement;
  play: (name: SoundName) => void;
  addStars: (n: number) => number;
  getStars: () => number;
  onWin: (stars: 1 | 2 | 3, message?: string) => void;
  onLose: (message?: string) => void;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const TOTAL_HINTS = 3;

const CSS = `
.fd-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;box-sizing:border-box;background:linear-gradient(#d3f9d8,#96f2d7);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.fd-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center;}
.fd-badge-pill{font-size:15px;font-weight:800;color:#087f5b;background:#ffffffcc;border-radius:999px;padding:5px 14px;}
.fd-msg{min-height:26px;font-size:18px;font-weight:700;color:#e8590c;text-align:center;}
.fd-pics{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.fd-pic{background:#fff;border-radius:14px;box-shadow:0 4px 0 #0001;padding:6px;}
.fd-pic svg{display:block;border-radius:10px;max-width:100%;height:auto;}
.fd-spot{fill:transparent;cursor:pointer;}
.fd-found{fill:none;stroke:#ff5d8f;stroke-width:5;stroke-dasharray:10 7;pointer-events:none;}
.fd-hint-ring{fill:none;stroke:#f59f00;stroke-width:5;pointer-events:none;animation:fd-pulse .8s infinite;}
@keyframes fd-pulse{0%,100%{opacity:.25}50%{opacity:1}}
.fd-badges{display:flex;gap:10px;font-size:26px;min-height:36px;}
.fd-badge{filter:grayscale(1) opacity(.4);transition:filter .3s,transform .3s;}
.fd-badge.fd-on{filter:none;transform:scale(1.2);}
.fd-hint-btn{min-height:48px;padding:0 22px;font-size:18px;font-weight:800;color:#856000;border:none;cursor:pointer;
  border-radius:999px;background:#ffe066;box-shadow:0 4px 0 #d9b800;font-family:inherit;transition:transform .12s,opacity .2s;}
.fd-hint-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #d9b800;}
.fd-hint-btn:disabled{opacity:.4;}
.fd-overlay{position:absolute;inset:0;background:#e6fcf5de;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;border-radius:20px;z-index:10;text-align:center;padding:20px;box-sizing:border-box;}
.fd-ov-title{font-size:26px;font-weight:900;color:#087f5b;}
.fd-ov-sub{font-size:17px;font-weight:700;color:#868e96;line-height:1.6;}
.fd-ov-btn{min-height:60px;padding:0 34px;font-size:22px;font-weight:900;color:#fff;border:none;cursor:pointer;
  border-radius:999px;background:linear-gradient(135deg,#38d9a9,#0ca678);box-shadow:0 6px 0 #087f5b;font-family:inherit;}
.fd-ov-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #087f5b;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "fd-wrap";
  wrap.innerHTML = `
    <div class="fd-top">
      <div class="fd-badge-pill fd-scene"></div>
      <div class="fd-badge-pill fd-count"></div>
      <button type="button" class="fd-hint-btn"></button>
    </div>
    <div class="fd-badges"></div>
    <div class="fd-pics"></div>
    <div class="fd-msg">左边和右边，哪里不一样呢？</div>
  `;
  root.append(style, wrap);

  const sceneEl = wrap.querySelector(".fd-scene") as HTMLElement;
  const countEl = wrap.querySelector(".fd-count") as HTMLElement;
  const hintBtn = wrap.querySelector(".fd-hint-btn") as HTMLButtonElement;
  const badgesEl = wrap.querySelector(".fd-badges") as HTMLElement;
  const picsEl = wrap.querySelector(".fd-pics") as HTMLElement;
  const msgEl = wrap.querySelector(".fd-msg") as HTMLElement;

  let sceneIdx = 0;
  let scene: Scene = SCENES[0];
  let found = new Set<string>();
  let wrongTaps = 0;
  let hintsLeft = TOTAL_HINTS;
  let finished = false;
  let svgs: SVGSVGElement[] = [];

  function updateHud() {
    sceneEl.textContent = `${scene.emoji} 第${sceneIdx + 1}/${SCENES.length}幅·${scene.name}`;
    countEl.textContent = `🔍 找到 ${found.size}/${scene.diffs.length}`;
    hintBtn.textContent = `💡 提示 x${hintsLeft}`;
    hintBtn.disabled = hintsLeft <= 0 || finished;
  }

  function markFound(id: string) {
    const spot = scene.diffs.find((d) => d.id === id);
    if (!spot) return;
    for (const svg of svgs) {
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", String(spot.x));
      ring.setAttribute("cy", String(spot.y));
      ring.setAttribute("r", String(Math.max(14, spot.r - 6)));
      ring.setAttribute("class", "fd-found");
      svg.appendChild(ring);
    }
  }

  function showHint() {
    if (hintsLeft <= 0 || finished) return;
    const unfound = scene.diffs.filter((d) => !found.has(d.id));
    if (unfound.length === 0) return;
    hintsLeft--;
    play("pop");
    const spot = unfound[Math.floor(Math.random() * unfound.length)];
    msgEl.textContent = "💡 放大镜提示：看一看一闪一闪的圈圈里～";
    const rings: SVGElement[] = [];
    for (const svg of svgs) {
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", String(spot.x));
      ring.setAttribute("cy", String(spot.y));
      ring.setAttribute("r", String(spot.r));
      ring.setAttribute("class", "fd-hint-ring");
      svg.appendChild(ring);
      rings.push(ring);
    }
    later(() => rings.forEach((r) => r.remove()), 2400);
    updateHud();
  }

  function onSpotTap(id: string) {
    if (finished || found.has(id)) return;
    found.add(id);
    play("coin");
    markFound(id);
    const badge = badgesEl.children[found.size - 1] as HTMLElement | undefined;
    if (badge) badge.classList.add("fd-on");
    const spot = scene.diffs.find((d) => d.id === id);
    msgEl.textContent = `找到啦！${spot ? spot.label : "这里"}不一样！`;
    updateHud();
    if (found.size >= scene.diffs.length) {
      finished = true;
      later(() => sceneDone(), 900);
    }
  }

  function onMissTap() {
    if (finished) return;
    wrongTaps++;
    play("tap");
    msgEl.textContent = "这里两边是一样的哦，再仔细看看～";
  }

  function renderScene() {
    scene = SCENES[sceneIdx];
    found = new Set();
    finished = false;
    svgs = [];
    picsEl.innerHTML = "";
    badgesEl.innerHTML = scene.diffs.map(() => `<span class="fd-badge">✅</span>`).join("");

    for (const side of ["left", "right"] as const) {
      const box = document.createElement("div");
      box.className = "fd-pic";
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
      svg.setAttribute("width", "330");
      svg.setAttribute("height", String(Math.round((330 / VIEW_W) * VIEW_H)));
      svg.innerHTML = scene.markup(side);
      svg.addEventListener("click", onMissTap);
      for (const d of scene.diffs) {
        const spot = document.createElementNS(SVG_NS, "circle");
        spot.setAttribute("cx", String(d.x));
        spot.setAttribute("cy", String(d.y));
        spot.setAttribute("r", String(d.r));
        spot.setAttribute("class", "fd-spot");
        spot.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onSpotTap(d.id);
        });
        svg.appendChild(spot);
      }
      box.appendChild(svg);
      picsEl.appendChild(box);
      svgs.push(svg);
    }
    updateHud();
  }

  function showOverlay(title: string, sub: string, btnText: string, onNext: () => void) {
    const ov = document.createElement("div");
    ov.className = "fd-overlay";
    const t = document.createElement("div");
    t.className = "fd-ov-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "fd-ov-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fd-ov-btn";
    b.textContent = btnText;
    b.addEventListener("click", () => {
      play("tap");
      ov.remove();
      onNext();
    });
    ov.append(t, s, b);
    wrap.appendChild(ov);
  }

  function sceneDone() {
    if (sceneIdx < SCENES.length - 1) {
      const next = SCENES[sceneIdx + 1];
      showOverlay(
        `🎉 ${scene.name}全找到啦！`,
        `下一幅是「${next.name}」，又藏了 ${next.diffs.length} 处不同哦～`,
        `看下一幅 ${next.emoji}`,
        () => {
          sceneIdx++;
          renderScene();
          msgEl.textContent = "新的两幅画来啦，哪里不一样呢？";
        }
      );
    } else {
      const stars: 1 | 2 | 3 = wrongTaps <= 3 ? 3 : wrongTaps <= 8 ? 2 : 1;
      onWin(stars, "五组画共 25 处不同全被你找到啦，眼睛真亮！");
    }
  }

  hintBtn.addEventListener("click", showHint);
  renderScene();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
