import {
  COLOR_NAMES,
  COLOR_VALUES,
  makeRoundForLevel,
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
  blurb: "五座城门闯关：认形状、认颜色、比大小、数边数，最后国王混合挑战！",
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

const ROUNDS_PER_LEVEL = 5;
const LEVELS = [
  { name: "形状门", emoji: "🔷", desc: "认一认它是什么形状" },
  { name: "颜色门", emoji: "🌈", desc: "认一认它是什么颜色" },
  { name: "大小塔", emoji: "📏", desc: "比一比谁大谁小" },
  { name: "数边桥", emoji: "🔢", desc: "数一数它有几条边" },
  { name: "国王挑战", emoji: "👑", desc: "什么题都可能出现哦" },
];
const PRAISES = ["送对啦，图形宝宝回家喽！", "真棒！城堡欢迎它！", "好厉害，又送对一个！", "太棒了！"];
const CHEERS = ["没关系，再看看它的样子～", "再想一想，你可以的！", "换扇门试试看～"];

function shapeSvg(kind: ShapeKind, fill: string, size = 100): string {
  const inner =
    kind === "circle"
      ? `<circle cx="50" cy="50" r="40" fill="${fill}"/>`
      : kind === "square"
        ? `<rect x="12" y="12" width="76" height="76" rx="10" fill="${fill}"/>`
        : kind === "rectangle"
          ? `<rect x="6" y="26" width="88" height="48" rx="8" fill="${fill}"/>`
          : kind === "star"
            ? `<polygon points="50,5 61,38 95,38 67,59 78,92 50,72 22,92 33,59 5,38 39,38" fill="${fill}"/>`
            : kind === "heart"
              ? `<path d="M50,32 C50,16 28,8 18,22 C8,36 22,52 50,76 C78,52 92,36 82,22 C72,8 50,16 50,32 Z" fill="${fill}"/>`
              : kind === "diamond"
                ? `<polygon points="50,6 92,50 50,94 8,50" fill="${fill}"/>`
                : kind === "pentagon"
                  ? `<polygon points="50,6 93,38 76,90 24,90 7,38" fill="${fill}"/>`
                  : `<polygon points="50,10 92,88 8,88" fill="${fill}"/>`;
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
}

const CSS = `
.sk-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;box-sizing:border-box;background:linear-gradient(#e5dbff 0 55%,#d0bfff 55% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;position:relative;}
.sk-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}
.sk-badge{font-size:15px;font-weight:800;color:#5f3dc4;background:#ffffffcc;border-radius:999px;padding:5px 14px;}
.sk-badge.sk-streak{color:#ae3ec9;}
.sk-prompt{font-size:22px;font-weight:800;color:#41297a;text-align:center;}
.sk-shape{height:104px;display:flex;align-items:center;justify-content:center;
  filter:drop-shadow(0 4px 4px #0002);transition:transform .4s,opacity .4s;}
.sk-shape.sk-go{transform:translateY(70px) scale(.3);opacity:0;}
.sk-msg{min-height:26px;font-size:18px;font-weight:700;color:#e8590c;text-align:center;}
.sk-doors{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:flex-end;}
.sk-door{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:104px;min-height:120px;
  padding:12px 10px;border:none;cursor:pointer;border-radius:18px 18px 8px 8px;background:#fff;
  box-shadow:0 6px 0 #9775fa;font-family:inherit;transition:transform .12s,opacity .2s;}
.sk-door:active{transform:translateY(4px);box-shadow:0 2px 0 #9775fa;}
.sk-door .sk-door-label{font-size:20px;font-weight:800;color:#5f3dc4;}
.sk-door.sk-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:sk-pop .45s;}
.sk-door.sk-wrong{opacity:.4;animation:sk-shake .4s;}
@keyframes sk-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes sk-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.sk-overlay{position:absolute;inset:0;background:#f3f0ffde;display:flex;flex-direction:column;gap:14px;
  align-items:center;justify-content:center;border-radius:20px;z-index:10;text-align:center;padding:20px;box-sizing:border-box;}
.sk-ov-title{font-size:26px;font-weight:900;color:#5f3dc4;}
.sk-ov-sub{font-size:17px;font-weight:700;color:#868e96;line-height:1.6;}
.sk-ov-btn{min-height:60px;padding:0 34px;font-size:22px;font-weight:900;color:#fff;border:none;cursor:pointer;
  border-radius:999px;background:linear-gradient(135deg,#9775fa,#7048e8);box-shadow:0 6px 0 #5f3dc4;font-family:inherit;}
.sk-ov-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #5f3dc4;}
`;

export function mount(api: GameApi): { destroy: () => void } {
  const { root, play, addStars, onWin } = api;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (fn: () => void, ms: number) => {
    timers.push(setTimeout(fn, ms));
  };

  root.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  const wrap = document.createElement("div");
  wrap.className = "sk-wrap";
  wrap.innerHTML = `
    <div class="sk-top">
      <div class="sk-badge sk-level"></div>
      <div class="sk-badge sk-progress"></div>
      <div class="sk-badge sk-streak"></div>
    </div>
    <div class="sk-prompt"></div>
    <div class="sk-shape"></div>
    <div class="sk-doors"></div>
    <div class="sk-msg">看清楚小图形，点一点它该进哪扇门～</div>
  `;
  root.append(style, wrap);

  const levelEl = wrap.querySelector(".sk-level") as HTMLElement;
  const progressEl = wrap.querySelector(".sk-progress") as HTMLElement;
  const streakEl = wrap.querySelector(".sk-streak") as HTMLElement;
  const promptEl = wrap.querySelector(".sk-prompt") as HTMLElement;
  const shapeEl = wrap.querySelector(".sk-shape") as HTMLElement;
  const doorsEl = wrap.querySelector(".sk-doors") as HTMLElement;
  const msgEl = wrap.querySelector(".sk-msg") as HTMLElement;

  let levelIdx = 0;
  let doneInLevel = 0;
  let wrongTotal = 0;
  let streak = 0;
  let locked = false;
  let round: ShapeRound;

  function updateHud() {
    const lv = LEVELS[levelIdx];
    levelEl.textContent = `${lv.emoji} 第${levelIdx + 1}关·${lv.name}`;
    progressEl.textContent = `🏰 ${doneInLevel}/${ROUNDS_PER_LEVEL}`;
    streakEl.textContent = `🔥 连对 ${streak}`;
  }

  function nextRound() {
    round = makeRoundForLevel((levelIdx + 1) as 1 | 2 | 3 | 4 | 5);
    shapeEl.classList.remove("sk-go");
    doorsEl.innerHTML = "";

    if (round.mode === "size") {
      promptEl.textContent = round.goal === "big" ? "哪一个最大？点一点它！" : "哪一个最小？点一点它！";
      shapeEl.innerHTML = "";
      shapeEl.style.display = "none";
      round.bins.forEach((bin, i) => {
        const door = document.createElement("button");
        door.type = "button";
        door.className = "sk-door";
        door.innerHTML = `${shapeSvg(round.shape, COLOR_VALUES[round.color], Number(bin))}`;
        door.addEventListener("click", () => onDoor(door, i));
        doorsEl.appendChild(door);
      });
    } else {
      shapeEl.style.display = "";
      shapeEl.innerHTML = shapeSvg(round.shape, COLOR_VALUES[round.color]);
      if (round.mode === "shape") {
        promptEl.textContent = "它是什么形状？送它进对的门！";
      } else if (round.mode === "color") {
        promptEl.textContent = "它是什么颜色？送它进对的门！";
      } else {
        promptEl.textContent = `数一数：${SHAPE_NAMES[round.shape]}有几条边？`;
      }
      round.bins.forEach((bin, i) => {
        const door = document.createElement("button");
        door.type = "button";
        door.className = "sk-door";
        if (round.mode === "shape") {
          const kind = bin as ShapeKind;
          door.innerHTML = `${shapeSvg(kind, "#868e96", 56)}<span class="sk-door-label">${SHAPE_NAMES[kind]}</span>`;
        } else if (round.mode === "color") {
          const color = bin as ShapeColor;
          door.innerHTML = `${shapeSvg("circle", COLOR_VALUES[color], 56)}<span class="sk-door-label">${COLOR_NAMES[color]}</span>`;
        } else {
          door.innerHTML = `<span class="sk-door-label" style="font-size:38px">${bin}</span><span class="sk-door-label">条边</span>`;
        }
        door.addEventListener("click", () => onDoor(door, i));
        doorsEl.appendChild(door);
      });
    }
    locked = false;
    updateHud();
  }

  function showOverlay(title: string, sub: string, btnText: string, onNext: () => void) {
    const ov = document.createElement("div");
    ov.className = "sk-overlay";
    const t = document.createElement("div");
    t.className = "sk-ov-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "sk-ov-sub";
    s.textContent = sub;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sk-ov-btn";
    b.textContent = btnText;
    b.addEventListener("click", () => {
      play("tap");
      ov.remove();
      onNext();
    });
    ov.append(t, s, b);
    wrap.appendChild(ov);
  }

  function levelDone() {
    play("coin");
    if (levelIdx < LEVELS.length - 1) {
      const next = LEVELS[levelIdx + 1];
      showOverlay(
        `🎉 通过${LEVELS[levelIdx].name}！`,
        `下一关是「${next.name}」：${next.desc}，继续闯关！`,
        `去${next.name} ${next.emoji}`,
        () => {
          levelIdx++;
          doneInLevel = 0;
          nextRound();
        }
      );
    } else {
      const stars: 1 | 2 | 3 = wrongTotal === 0 ? 3 : wrongTotal <= 5 ? 2 : 1;
      onWin(stars, "五座城门全部通过，形状国王为你戴上王冠！");
    }
  }

  function onDoor(door: HTMLButtonElement, index: number) {
    if (locked) return;
    play("tap");
    if (index === round.answerIndex) {
      locked = true;
      doneInLevel++;
      streak++;
      play("jump");
      door.classList.add("sk-right");
      shapeEl.classList.add("sk-go");
      let praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      if (streak > 0 && streak % 5 === 0) {
        addStars(1);
        praise = `🔥 连对 ${streak} 题，国王奖励一颗小星星！`;
      }
      msgEl.textContent = praise;
      updateHud();
      later(() => {
        if (doneInLevel >= ROUNDS_PER_LEVEL) levelDone();
        else nextRound();
      }, 800);
    } else {
      wrongTotal++;
      streak = 0;
      play("oops");
      door.classList.add("sk-wrong");
      door.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      updateHud();
    }
  }

  updateHud();
  nextRound();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
