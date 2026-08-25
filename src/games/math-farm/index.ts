import { makeMathQuestion, type MathQuestion } from "./logic";

export const meta = {
  id: "math-farm",
  title: "算数小农场",
  emoji: "🐮",
  category: "edu" as const,
  color: "#8ce99a",
  blurb: "算对 10 以内加减法，喂饱农场里的小动物！",
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

const ANIMALS = [
  { emoji: "🐮", name: "小牛", food: "🌿" },
  { emoji: "🐷", name: "小猪", food: "🍎" },
  { emoji: "🐰", name: "小兔", food: "🥕" },
  { emoji: "🐔", name: "小鸡", food: "🌽" },
  { emoji: "🐱", name: "小猫", food: "🐟" },
];

const PRAISES = ["答对啦！真棒！", "好厉害呀！", "算得又快又准！", "你真是算数小能手！", "太棒了！"];
const CHEERS = ["没关系，再想一想～", "差一点点，你可以的！", "别着急，慢慢算～"];

const GOAL = 5;

const CSS = `
.mf-wrap{height:100%;min-height:420px;display:flex;flex-direction:column;align-items:center;gap:14px;
  padding:16px;box-sizing:border-box;background:linear-gradient(#c9ecff 0 45%,#b7e8a4 45% 100%);
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;}
.mf-progress{font-size:20px;font-weight:700;color:#2b6a2f;background:#ffffffcc;border-radius:999px;padding:6px 18px;}
.mf-animal{font-size:76px;line-height:1;transition:transform .3s;filter:drop-shadow(0 4px 4px #0002);}
.mf-animal.mf-happy{animation:mf-bounce .5s;}
@keyframes mf-bounce{0%{transform:scale(1)}40%{transform:scale(1.25) rotate(-6deg)}100%{transform:scale(1)}}
.mf-bubble{background:#fff;border-radius:24px;padding:10px 26px;font-size:40px;font-weight:800;color:#374151;
  box-shadow:0 4px 0 #0001;letter-spacing:2px;}
.mf-msg{min-height:30px;font-size:22px;font-weight:700;color:#e8590c;}
.mf-btns{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;}
.mf-btn{min-width:96px;min-height:80px;font-size:38px;font-weight:800;color:#fff;border:none;cursor:pointer;
  border-radius:24px;background:linear-gradient(#ffa94d,#ff922b);box-shadow:0 6px 0 #e8790c;
  transition:transform .12s,opacity .2s;font-family:inherit;}
.mf-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #e8790c;}
.mf-btn.mf-wrong{opacity:.45;background:#adb5bd;box-shadow:0 6px 0 #868e96;animation:mf-shake .4s;}
@keyframes mf-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.mf-food{position:absolute;font-size:44px;pointer-events:none;animation:mf-fly .8s forwards;}
@keyframes mf-fly{0%{transform:translateY(60px) scale(.6);opacity:0}50%{opacity:1}100%{transform:translateY(-10px) scale(1.15);opacity:0}}
.mf-stage{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;}
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
  wrap.className = "mf-wrap";
  wrap.innerHTML = `
    <div class="mf-progress"></div>
    <div class="mf-stage">
      <div class="mf-animal"></div>
      <div class="mf-bubble"></div>
    </div>
    <div class="mf-msg">帮小动物算一算，答对就能喂它吃东西哦～</div>
    <div class="mf-btns"></div>
  `;
  root.append(style, wrap);

  const progressEl = wrap.querySelector(".mf-progress") as HTMLElement;
  const animalEl = wrap.querySelector(".mf-animal") as HTMLElement;
  const bubbleEl = wrap.querySelector(".mf-bubble") as HTMLElement;
  const msgEl = wrap.querySelector(".mf-msg") as HTMLElement;
  const btnsEl = wrap.querySelector(".mf-btns") as HTMLElement;
  const stageEl = wrap.querySelector(".mf-stage") as HTMLElement;

  let correct = 0;
  let wrong = 0;
  let locked = false;
  let question: MathQuestion;
  let animal = ANIMALS[0];

  function updateProgress() {
    progressEl.textContent = `已喂饱 ${correct} / ${GOAL} 只小动物`;
  }

  function nextQuestion() {
    question = makeMathQuestion();
    animal = ANIMALS[correct % ANIMALS.length];
    animalEl.textContent = animal.emoji;
    bubbleEl.textContent = `${question.a} ${question.op} ${question.b} = ?`;
    btnsEl.innerHTML = "";
    for (const c of question.choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mf-btn";
      btn.textContent = String(c);
      btn.addEventListener("click", () => onChoice(btn, c));
      btnsEl.appendChild(btn);
    }
    locked = false;
  }

  function onChoice(btn: HTMLButtonElement, value: number) {
    if (locked) return;
    play("tap");
    if (value === question.answer) {
      locked = true;
      correct++;
      play("coin");
      if (animal.emoji === "🐱") play("meow");
      msgEl.textContent = `${PRAISES[Math.floor(Math.random() * PRAISES.length)]} ${animal.name}吃到${animal.food}啦！`;
      animalEl.classList.add("mf-happy");
      const food = document.createElement("div");
      food.className = "mf-food";
      food.textContent = animal.food;
      stageEl.appendChild(food);
      updateProgress();
      later(() => {
        animalEl.classList.remove("mf-happy");
        food.remove();
        if (correct >= GOAL) {
          const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
          onWin(stars, "小动物们都吃饱啦，谢谢你！");
        } else {
          nextQuestion();
        }
      }, 900);
    } else {
      wrong++;
      play("oops");
      btn.classList.add("mf-wrong");
      btn.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
    }
  }

  updateProgress();
  nextQuestion();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
