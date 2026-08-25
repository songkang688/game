import { makePinyinQuestion, type PinyinQuestion } from "./logic";

export const meta = {
  id: "pinyin-train",
  title: "拼音小火车",
  emoji: "🚂",
  category: "edu" as const,
  color: "#74c0fc",
  blurb: "认声母韵母，答对一题小火车就多一节车厢！",
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
const CAR_COLORS = ["#ff8787", "#ffd43b", "#69db7c", "#b197fc", "#ffa94d"];
const PRAISES = ["答对啦！呜呜——出发！", "真棒！又多了一节车厢！", "好厉害！火车更长啦！", "太棒了，继续开！"];
const CHEERS = ["没关系，再想一想～", "再看看，你一定可以！", "别着急，慢慢来～"];

const CSS = `
.pt-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#d0ebff 0 60%,#e9d8a6 60% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.pt-title{font-size:20px;font-weight:700;color:#1864ab;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.pt-track{width:100%;max-width:520px;display:flex;align-items:flex-end;gap:4px;min-height:84px;overflow:hidden;
  border-bottom:6px solid #86633a;padding-bottom:2px;}
.pt-engine{font-size:56px;line-height:1;position:relative;}
.pt-engine .pt-cab{position:absolute;top:2px;left:12px;font-size:22px;font-weight:900;color:#fff;
  background:#1971c2;border-radius:8px;padding:0 6px;min-width:18px;text-align:center;}
.pt-car{width:52px;height:40px;border-radius:10px 10px 6px 6px;display:flex;align-items:center;justify-content:center;
  font-size:24px;font-weight:900;color:#fff;box-shadow:0 3px 0 #0002;animation:pt-in .5s;}
@keyframes pt-in{0%{transform:translateX(40px) scale(.5);opacity:0}100%{transform:none;opacity:1}}
.pt-prompt{font-size:26px;font-weight:800;color:#343a40;}
.pt-msg{min-height:28px;font-size:20px;font-weight:700;color:#e8590c;}
.pt-btns{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.pt-btn{min-width:96px;min-height:88px;font-size:46px;font-weight:800;color:#1864ab;border:none;cursor:pointer;
  border-radius:26px;background:#fff;box-shadow:0 6px 0 #a5d8ff;transition:transform .12s,opacity .2s;
  font-family:inherit;}
.pt-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #a5d8ff;}
.pt-btn.pt-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:pt-pop .45s;}
.pt-btn.pt-wrong{opacity:.4;animation:pt-shake .4s;}
@keyframes pt-pop{0%{transform:scale(1)}50%{transform:scale(1.15)}100%{transform:scale(1)}}
@keyframes pt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
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
  wrap.className = "pt-wrap";
  wrap.innerHTML = `
    <div class="pt-title"></div>
    <div class="pt-track">
      <div class="pt-engine">🚂<span class="pt-cab"></span></div>
    </div>
    <div class="pt-prompt"></div>
    <div class="pt-btns"></div>
    <div class="pt-msg">小火车要出发啦，答对题目帮它挂车厢！</div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".pt-title") as HTMLElement;
  const trackEl = wrap.querySelector(".pt-track") as HTMLElement;
  const cabEl = wrap.querySelector(".pt-cab") as HTMLElement;
  const promptEl = wrap.querySelector(".pt-prompt") as HTMLElement;
  const btnsEl = wrap.querySelector(".pt-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".pt-msg") as HTMLElement;

  let correct = 0;
  let wrong = 0;
  let locked = false;
  let question: PinyinQuestion;

  function updateTitle() {
    titleEl.textContent = `车厢 ${correct} / ${GOAL} 节`;
  }

  function nextQuestion() {
    question = makePinyinQuestion();
    promptEl.textContent = question.prompt;
    cabEl.textContent = question.display;
    cabEl.style.display = question.display ? "" : "none";
    btnsEl.innerHTML = "";
    question.choices.forEach((letter, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pt-btn";
      btn.textContent = letter;
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
      btn.classList.add("pt-right");
      msgEl.textContent = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      const car = document.createElement("div");
      car.className = "pt-car";
      car.style.background = CAR_COLORS[(correct - 1) % CAR_COLORS.length];
      car.textContent = question.choices[question.answerIndex];
      trackEl.appendChild(car);
      updateTitle();
      later(() => {
        if (correct >= GOAL) {
          play("jump");
          msgEl.textContent = "呜呜——到站啦！🎉";
          const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
          later(() => onWin(stars, "拼音小火车满载到站，你真棒！"), 600);
        } else {
          nextQuestion();
        }
      }, 900);
    } else {
      wrong++;
      play("oops");
      btn.classList.add("pt-wrong");
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
