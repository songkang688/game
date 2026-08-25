import { makeWordQuestion, type WordQuestion } from "./logic";

export const meta = {
  id: "word-garden",
  title: "识字小花园",
  emoji: "🌸",
  category: "edu" as const,
  color: "#faa2c1",
  blurb: "看图认汉字，答对一个就种下一朵小花！",
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
const FLOWERS = ["🌷", "🌸", "🌻", "🌼", "🌺"];
const PRAISES = ["认对啦，真聪明！", "好棒呀！", "你认识的字真多！", "太厉害了！"];
const CHEERS = ["没关系，再看看图片提示～", "再想一想，你一定行！", "慢慢来，加油哦～"];

const CSS = `
.wg-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#e3fafc 0 55%,#d3f9d8 55% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.wg-title{font-size:20px;font-weight:700;color:#0b7285;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.wg-pic{font-size:72px;line-height:1.1;filter:drop-shadow(0 4px 4px #0002);}
.wg-hint{font-size:24px;font-weight:800;color:#495057;}
.wg-hint .wg-py{color:#e64980;font-size:30px;margin-left:8px;}
.wg-msg{min-height:28px;font-size:20px;font-weight:700;color:#e8590c;}
.wg-btns{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.wg-btn{min-width:92px;min-height:92px;font-size:52px;font-weight:800;color:#343a40;border:none;cursor:pointer;
  border-radius:26px;background:#fff;box-shadow:0 6px 0 #d0bfff;transition:transform .12s,opacity .2s;
  font-family:inherit;}
.wg-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #d0bfff;}
.wg-btn.wg-right{background:#d3f9d8;box-shadow:0 6px 0 #69db7c;animation:wg-pop .45s;}
.wg-btn.wg-wrong{opacity:.4;animation:wg-shake .4s;}
@keyframes wg-pop{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes wg-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.wg-garden{display:flex;gap:10px;font-size:40px;min-height:52px;align-items:flex-end;
  background:#96f2d7aa;border-radius:16px;padding:6px 18px;}
.wg-plot{width:44px;text-align:center;transition:transform .3s;}
.wg-plot.wg-new{animation:wg-grow .6s;}
@keyframes wg-grow{0%{transform:scale(0)}70%{transform:scale(1.25)}100%{transform:scale(1)}}
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
  wrap.className = "wg-wrap";
  wrap.innerHTML = `
    <div class="wg-title"></div>
    <div class="wg-pic"></div>
    <div class="wg-hint"></div>
    <div class="wg-btns"></div>
    <div class="wg-msg">看看图片，找出正确的汉字吧～</div>
    <div class="wg-garden"></div>
  `;
  root.append(style, wrap);

  const titleEl = wrap.querySelector(".wg-title") as HTMLElement;
  const picEl = wrap.querySelector(".wg-pic") as HTMLElement;
  const hintEl = wrap.querySelector(".wg-hint") as HTMLElement;
  const btnsEl = wrap.querySelector(".wg-btns") as HTMLElement;
  const msgEl = wrap.querySelector(".wg-msg") as HTMLElement;
  const gardenEl = wrap.querySelector(".wg-garden") as HTMLElement;

  let correct = 0;
  let wrong = 0;
  let locked = false;
  let question: WordQuestion;
  const used: string[] = [];

  // 花园里预置空土坑
  for (let i = 0; i < GOAL; i++) {
    const plot = document.createElement("div");
    plot.className = "wg-plot";
    plot.textContent = "🟫";
    gardenEl.appendChild(plot);
  }

  function updateTitle() {
    titleEl.textContent = `已种下 ${correct} / ${GOAL} 朵小花`;
  }

  function nextQuestion() {
    question = makeWordQuestion(Math.random, used);
    used.push(question.target.char);
    picEl.textContent = question.target.emoji;
    hintEl.innerHTML = `这是「${question.target.word}」<span class="wg-py">${question.target.pinyin}</span>`;
    btnsEl.innerHTML = "";
    question.choices.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wg-btn";
      btn.textContent = card.char;
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
      play("pop");
      btn.classList.add("wg-right");
      msgEl.textContent = `${PRAISES[Math.floor(Math.random() * PRAISES.length)]}「${question.target.char}」就是${question.target.word}的${question.target.char}！`;
      const plot = gardenEl.children[correct - 1] as HTMLElement;
      plot.textContent = FLOWERS[(correct - 1) % FLOWERS.length];
      plot.classList.add("wg-new");
      updateTitle();
      later(() => {
        if (correct >= GOAL) {
          play("coin");
          const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
          onWin(stars, "小花园开满花啦，你认识了好多字！");
        } else {
          nextQuestion();
        }
      }, 1100);
    } else {
      wrong++;
      play("oops");
      btn.classList.add("wg-wrong");
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
