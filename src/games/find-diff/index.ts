import { DIFFS, sceneMarkup, VIEW_H, VIEW_W } from "./scene";

export const meta = {
  id: "find-diff",
  title: "找不同",
  emoji: "🔍",
  category: "edu" as const,
  color: "#63e6be",
  blurb: "两幅小画里藏着 3 处不同，睁大眼睛找出来！",
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

const CSS = `
.fd-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#d3f9d8,#96f2d7);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.fd-title{font-size:20px;font-weight:700;color:#087f5b;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.fd-msg{min-height:28px;font-size:20px;font-weight:700;color:#e8590c;text-align:center;}
.fd-pics{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.fd-pic{background:#fff;border-radius:14px;box-shadow:0 4px 0 #0001;padding:6px;}
.fd-pic svg{display:block;border-radius:10px;max-width:100%;height:auto;}
.fd-spot{fill:transparent;cursor:pointer;}
.fd-found{fill:none;stroke:#ff5d8f;stroke-width:5;stroke-dasharray:10 7;pointer-events:none;}
.fd-badges{display:flex;gap:10px;font-size:30px;min-height:40px;}
.fd-badge{filter:grayscale(1) opacity(.4);transition:filter .3s,transform .3s;}
.fd-badge.fd-on{filter:none;transform:scale(1.2);}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, onWin } = api;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "fd-wrap";
  wrap.innerHTML = `
    <div class="fd-title">两幅画里有 3 处不一样，点一点找出来吧！</div>
    <div class="fd-badges">${DIFFS.map(() => `<span class="fd-badge">✅</span>`).join("")}</div>
    <div class="fd-pics"></div>
    <div class="fd-msg">左边和右边，哪里不一样呢？</div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".fd-title") as HTMLElement;
  const picsEl = wrap.querySelector(".fd-pics") as HTMLElement;
  const msgEl = wrap.querySelector(".fd-msg") as HTMLElement;
  const badges = [...wrap.querySelectorAll(".fd-badge")] as HTMLElement[];

  const found = new Set<string>();
  let wrongTaps = 0;
  let finished = false;
  const svgs: SVGSVGElement[] = [];

  function updateTitle() {
    titleEl.textContent = `已找到 ${found.size} / ${DIFFS.length} 处不同`;
  }

  function markFound(id: string) {
    for (const svg of svgs) {
      const spot = DIFFS.find((d) => d.id === id);
      if (!spot) continue;
      const ring = document.createElementNS(SVG_NS, "circle");
      ring.setAttribute("cx", String(spot.x));
      ring.setAttribute("cy", String(spot.y));
      ring.setAttribute("r", String(spot.r - 6));
      ring.setAttribute("class", "fd-found");
      svg.appendChild(ring);
    }
  }

  function onSpotTap(id: string) {
    if (finished || found.has(id)) return;
    found.add(id);
    play("coin");
    markFound(id);
    badges[found.size - 1].classList.add("fd-on");
    const spot = DIFFS.find((d) => d.id === id);
    msgEl.textContent = `找到啦！${spot ? spot.label : "这里"}不一样！`;
    updateTitle();
    if (found.size >= DIFFS.length) {
      finished = true;
      later(() => {
        const stars: 1 | 2 | 3 = wrongTaps <= 1 ? 3 : wrongTaps <= 3 ? 2 : 1;
        onWin(stars, "三处不同全被你找到啦，眼睛真亮！");
      }, 900);
    }
  }

  function onMissTap() {
    if (finished) return;
    wrongTaps++;
    play("tap");
    msgEl.textContent = "这里两边是一样的哦，再仔细看看～";
  }

  for (const side of ["left", "right"] as const) {
    const box = document.createElement("div");
    box.className = "fd-pic";
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute("width", "330");
    svg.setAttribute("height", String(Math.round((330 / VIEW_W) * VIEW_H)));
    svg.innerHTML = sceneMarkup(side);
    svg.addEventListener("click", onMissTap);
    for (const d of DIFFS) {
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

  updateTitle();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
