import { hourHandAngle, makeClockQuestion, minuteHandAngle, type ClockQuestion } from "./logic";

export const meta = {
  id: "clock-house",
  title: "时钟小屋",
  emoji: "🕒",
  category: "edu" as const,
  color: "#ffa94d",
  blurb: "看看小屋里的钟，认一认整点和半点！",
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

const GOAL = 5;
const PRAISES = ["看得真准！", "答对啦，好厉害！", "你会认时间啦！", "太棒了！"];
const CHEERS = ["再看看短针指着几～", "长针指 12 是整点，指 6 是半点哦～", "别着急，再看一眼～"];

const CX = 110;
const CY = 155;

function polar(cx: number, cy: number, radius: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

function clockMarkup(q: ClockQuestion): string {
  let numbers = "";
  for (let h = 1; h <= 12; h++) {
    const p = polar(CX, CY, 60, h * 30);
    numbers += `<text x="${p.x.toFixed(1)}" y="${(p.y + 7).toFixed(1)}" font-size="19" font-weight="800" fill="#495057" text-anchor="middle">${h}</text>`;
  }
  let ticks = "";
  for (let h = 1; h <= 12; h++) {
    const p1 = polar(CX, CY, 74, h * 30);
    const p2 = polar(CX, CY, 79, h * 30);
    ticks += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#adb5bd" stroke-width="3" stroke-linecap="round"/>`;
  }
  const hourEnd = polar(CX, CY, 40, hourHandAngle(q.hour, q.half));
  const minEnd = polar(CX, CY, 58, minuteHandAngle(q.half));
  return `
    <polygon points="8,62 212,62 110,2" fill="#ff9f7a" stroke="#c66a4a" stroke-width="3"/>
    <rect x="20" y="62" width="180" height="186" rx="8" fill="#ffe8cc" stroke="#c9a86b" stroke-width="3"/>
    <circle cx="${CX}" cy="${CY}" r="82" fill="#ffffff" stroke="#845ef7" stroke-width="6"/>
    ${ticks}
    ${numbers}
    <line x1="${CX}" y1="${CY}" x2="${hourEnd.x.toFixed(1)}" y2="${hourEnd.y.toFixed(1)}" stroke="#e8590c" stroke-width="9" stroke-linecap="round"/>
    <line x1="${CX}" y1="${CY}" x2="${minEnd.x.toFixed(1)}" y2="${minEnd.y.toFixed(1)}" stroke="#1971c2" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="7" fill="#495057"/>
  `;
}

const CSS = `
.ch-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#fff4e6,#ffd8a8);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.ch-title{font-size:20px;font-weight:700;color:#d9480f;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.ch-prompt{font-size:22px;font-weight:800;color:#5f3dc4;}
.ch-clock{filter:drop-shadow(0 4px 4px #0002);}
.ch-msg{min-height:26px;font-size:19px;font-weight:700;color:#e8590c;text-align:center;}
.ch-btns{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;}
.ch-btn{min-width:118px;min-height:70px;font-size:28px;font-weight:800;color:#5f3dc4;border:none;cursor:pointer;
  border-radius:22px;background:#fff;box-shadow:0 6px 0 #e5dbff;transition:transform .12s,opacity .2s;
  font-family:inherit;}
.ch-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #e5dbff;}
.ch-btn.ch-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:ch-pop .45s;}
.ch-btn.ch-wrong{opacity:.4;animation:ch-shake .4s;}
@keyframes ch-pop{0%{transform:scale(1)}50%{transform:scale(1.12)}100%{transform:scale(1)}}
@keyframes ch-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
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
  wrap.className = "ch-wrap";
  wrap.innerHTML = `
    <div class="ch-title"></div>
    <div class="ch-prompt">小钟指着几点呀？</div>
    <svg class="ch-clock" viewBox="0 0 220 260" width="220" height="260" role="img" aria-label="时钟"></svg>
    <div class="ch-btns"></div>
    <div class="ch-msg">短针是时针，长针是分针，看仔细哦～</div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".ch-title") as HTMLElement;
  const clockEl = wrap.querySelector(".ch-clock") as unknown as SVGSVGElement;
  const btnsEl = wrap.querySelector(".ch-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".ch-msg") as HTMLElement;

  let correct = 0;
  let wrong = 0;
  let locked = false;
  let question: ClockQuestion;

  function updateTitle() {
    titleEl.textContent = `答对 ${correct} / ${GOAL} 个时间`;
  }

  function nextQuestion() {
    question = makeClockQuestion();
    clockEl.innerHTML = clockMarkup(question);
    btnsEl.innerHTML = "";
    question.choices.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ch-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => onChoice(btn, i));
      btnsEl.appendChild(btn);
    });
    locked = false;
  }

  function onChoice(btn: HTMLButtonElement, index: number) {
    if (locked) return;
    play("tap");
    if (index === question.answerIndex) {
      locked = true;
      correct++;
      play("coin");
      btn.classList.add("ch-right");
      msgEl.textContent = `${PRAISES[Math.floor(Math.random() * PRAISES.length)]}现在是 ${question.label}！`;
      updateTitle();
      later(() => {
        if (correct >= GOAL) {
          const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
          onWin(stars, "你学会看整点和半点啦，真了不起！");
        } else {
          nextQuestion();
        }
      }, 1000);
    } else {
      wrong++;
      play("oops");
      btn.classList.add("ch-wrong");
      btn.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    }
  }

  updateTitle();
  nextQuestion();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
