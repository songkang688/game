import {
  COLOR_NAMES,
  COLOR_VALUES,
  makeShapeRound,
  SHAPE_NAMES,
  type ShapeColor,
  type ShapeKind,
  type ShapeRound,
} from "./logic";

export const meta = {
  id: "shape-kingdom",
  title: "形状王国",
  emoji: "🏰",
  category: "edu" as const,
  color: "#b197fc",
  blurb: "认形状、认颜色，把小图形送回自己的城堡门！",
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

const GOAL = 8;
const PRAISES = ["送对啦，图形宝宝回家喽！", "真棒！城堡欢迎它！", "好厉害，又送对一个！", "太棒了！"];
const CHEERS = ["没关系，再看看它的样子～", "再想一想，你可以的！", "换扇门试试看～"];

function shapeSvg(kind: ShapeKind, fill: string, size = 100): string {
  const inner =
    kind === "circle"
      ? `<circle cx="50" cy="50" r="40" fill="${fill}"/>`
      : kind === "square"
        ? `<rect x="12" y="12" width="76" height="76" rx="10" fill="${fill}"/>`
        : `<polygon points="50,10 92,88 8,88" fill="${fill}"/>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}

const CSS = `
.sk-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#e5dbff 0 55%,#d0bfff 55% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.sk-title{font-size:20px;font-weight:700;color:#5f3dc4;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.sk-prompt{font-size:24px;font-weight:800;color:#41297a;}
.sk-shape{height:110px;display:flex;align-items:center;justify-content:center;
  filter:drop-shadow(0 4px 4px #0002);transition:transform .4s,opacity .4s;}
.sk-shape.sk-go{transform:translateY(70px) scale(.3);opacity:0;}
.sk-msg{min-height:28px;font-size:20px;font-weight:700;color:#e8590c;}
.sk-doors{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.sk-door{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:104px;min-height:120px;
  padding:12px 10px;border:none;cursor:pointer;border-radius:18px 18px 8px 8px;background:#fff;
  box-shadow:0 6px 0 #9775fa;font-family:inherit;transition:transform .12s,opacity .2s;}
.sk-door:active{transform:translateY(4px);box-shadow:0 2px 0 #9775fa;}
.sk-door .sk-door-label{font-size:22px;font-weight:800;color:#5f3dc4;}
.sk-door.sk-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:sk-pop .45s;}
.sk-door.sk-wrong{opacity:.4;animation:sk-shake .4s;}
@keyframes sk-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
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
  wrap.className = "sk-wrap";
  wrap.innerHTML = `
    <div class="sk-title"></div>
    <div class="sk-prompt"></div>
    <div class="sk-shape"></div>
    <div class="sk-doors"></div>
    <div class="sk-msg">看清楚小图形，点一点它该进哪扇门～</div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".sk-title") as HTMLElement;
  const promptEl = wrap.querySelector(".sk-prompt") as HTMLElement;
  const shapeEl = wrap.querySelector(".sk-shape") as HTMLElement;
  const doorsEl = wrap.querySelector(".sk-doors") as HTMLElement;
  const msgEl = wrap.querySelector(".sk-msg") as HTMLElement;

  let done = 0;
  let wrong = 0;
  let locked = false;
  let round: ShapeRound;

  function updateTitle() {
    titleEl.textContent = `已送回家 ${done} / ${GOAL} 个图形`;
  }

  function nextRound() {
    // 交替出「按形状」和「按颜色」两种分类题
    round = makeShapeRound(Math.random, done % 2 === 0 ? "shape" : "color");
    promptEl.textContent =
      round.mode === "shape" ? "它是什么形状？送它进对的门！" : "它是什么颜色？送它进对的门！";
    shapeEl.classList.remove("sk-go");
    shapeEl.innerHTML = shapeSvg(round.shape, COLOR_VALUES[round.color]);
    doorsEl.innerHTML = "";
    round.bins.forEach((bin, i) => {
      const door = document.createElement("button");
      door.type = "button";
      door.className = "sk-door";
      if (round.mode === "shape") {
        const kind = bin as ShapeKind;
        door.innerHTML = `${shapeSvg(kind, "#868e96", 56)}<span class="sk-door-label">${SHAPE_NAMES[kind]}</span>`;
      } else {
        const color = bin as ShapeColor;
        door.innerHTML = `${shapeSvg("circle", COLOR_VALUES[color], 56)}<span class="sk-door-label">${COLOR_NAMES[color]}</span>`;
      }
      door.addEventListener("click", () => onDoor(door, i));
      doorsEl.appendChild(door);
    });
    locked = false;
  }

  function onDoor(door: HTMLButtonElement, index: number) {
    if (locked) return;
    play("tap");
    if (index === round.answerIndex) {
      locked = true;
      done++;
      play("jump");
      door.classList.add("sk-right");
      shapeEl.classList.add("sk-go");
      msgEl.textContent = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      updateTitle();
      later(() => {
        if (done >= GOAL) {
          play("coin");
          const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 3 ? 2 : 1;
          onWin(stars, "图形宝宝们都回家啦，形状王国谢谢你！");
        } else {
          nextRound();
        }
      }, 800);
    } else {
      wrong++;
      play("oops");
      door.classList.add("sk-wrong");
      door.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    }
  }

  updateTitle();
  nextRound();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
