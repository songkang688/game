import { makeQuestionForLevel, type MathLevel, type MathQuestion } from "./logic";

export const meta = {
  id: "math-farm",
  title: "算数小农场",
  emoji: "🐮",
  category: "edu" as const,
  color: "#8ce99a",
  blurb: "三块农场十五道题！连对有奖励，还能挑战进位退位！",
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

interface FarmLevel {
  level: MathLevel;
  name: string;
  desc: string;
  bg: string;
  animals: Array<{ emoji: string; name: string; food: string }>;
}

const FARM_LEVELS: FarmLevel[] = [
  {
    level: 1, name: "青青牧场", desc: "10 以内加减法",
    bg: "linear-gradient(#c9ecff 0 45%,#b7e8a4 45% 100%)",
    animals: [
      { emoji: "🐮", name: "小牛", food: "🌿" },
      { emoji: "🐑", name: "小羊", food: "🍀" },
      { emoji: "🐷", name: "小猪", food: "🍎" },
    ],
  },
  {
    level: 2, name: "甜甜果园", desc: "20 以内不进位不退位",
    bg: "linear-gradient(#ffe9c7 0 45%,#c9e8a4 45% 100%)",
    animals: [
      { emoji: "🐰", name: "小兔", food: "🥕" },
      { emoji: "🐔", name: "小鸡", food: "🌽" },
      { emoji: "🐿️", name: "小松鼠", food: "🌰" },
    ],
  },
  {
    level: 3, name: "叮咚池塘", desc: "进位 · 退位挑战",
    bg: "linear-gradient(#c5f0ff 0 45%,#a4d8e8 45% 100%)",
    animals: [
      { emoji: "🦆", name: "小鸭", food: "🐌" },
      { emoji: "🐱", name: "小猫", food: "🐟" },
      { emoji: "🐸", name: "小青蛙", food: "🪰" },
    ],
  },
];

const QUESTIONS_PER_LEVEL = 5;
const PRAISES = ["答对啦！真棒！", "好厉害呀！", "算得又快又准！", "你真是算数小能手！", "太棒了！"];
const CHEERS = ["没关系，再想一想～", "差一点点，你可以的！", "别着急，慢慢算～"];

const CSS = `
.mf-wrap{height:100%;min-height:460px;display:flex;flex-direction:column;align-items:center;gap:12px;
  padding:16px;box-sizing:border-box;
  border-radius:20px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  user-select:none;-webkit-user-select:none;touch-action:manipulation;transition:background .5s;}
.mf-topbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;}
.mf-progress{font-size:17px;font-weight:700;color:#2b6a2f;background:#ffffffcc;border-radius:999px;padding:6px 14px;}
.mf-streak{font-size:17px;font-weight:800;color:#e8590c;background:#ffffffcc;border-radius:999px;padding:6px 14px;}
.mf-toggle{font-size:15px;font-weight:800;border:none;border-radius:999px;padding:8px 14px;cursor:pointer;
  background:#ffffffcc;color:#5f3dc4;box-shadow:0 3px 0 #0002;font-family:inherit;}
.mf-toggle:active{transform:translateY(2px);box-shadow:0 1px 0 #0002;}
.mf-bar{width:min(90%,360px);height:12px;background:#ffffffcc;border-radius:8px;overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,.1);}
.mf-fill{height:100%;width:0%;background:linear-gradient(90deg,#8ce99a,#40c057);border-radius:8px;transition:width .3s;}
.mf-animal{font-size:76px;line-height:1;transition:transform .3s;filter:drop-shadow(0 4px 4px #0002);}
.mf-animal.mf-happy{animation:mf-bounce .5s;}
@keyframes mf-bounce{0%{transform:scale(1)}40%{transform:scale(1.25) rotate(-6deg)}100%{transform:scale(1)}}
.mf-bubble{background:#fff;border-radius:24px;padding:10px 26px;font-size:38px;font-weight:800;color:#374151;
  box-shadow:0 4px 0 #0001;letter-spacing:2px;}
.mf-msg{min-height:30px;font-size:20px;font-weight:700;color:#e8590c;text-align:center;}
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
.mf-levelup{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:12px;background:#fff9e6ee;z-index:30;animation:mfFade .4s ease;text-align:center;padding:16px;}
@keyframes mfFade{from{opacity:0}to{opacity:1}}
.mf-lv-big{font-size:52px;}
.mf-lv-title{font-size:26px;font-weight:900;color:#e8590c;}
.mf-lv-sub{font-size:18px;font-weight:800;color:#b06a1f;line-height:1.6;}
.mf-lv-btn{border:none;border-radius:20px;padding:14px 40px;font-size:20px;font-weight:900;color:#fff;
  background:#40c057;cursor:pointer;box-shadow:0 5px 0 #2b8a3e;font-family:inherit;}
.mf-lv-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #2b8a3e;}
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
  wrap.className = "mf-wrap";
  wrap.innerHTML = `
    <div class="mf-topbar">
      <div class="mf-progress"></div>
      <div class="mf-streak">🔥 连对 0</div>
      <button class="mf-toggle" type="button">🎓 进退位挑战：开</button>
    </div>
    <div class="mf-bar"><div class="mf-fill"></div></div>
    <div class="mf-stage">
      <div class="mf-animal"></div>
      <div class="mf-bubble"></div>
    </div>
    <div class="mf-msg">帮小动物算一算，答对就能喂它吃东西哦～</div>
    <div class="mf-btns"></div>
  `;
  root.append(style, wrap);

  const progressEl = wrap.querySelector(".mf-progress") as HTMLElement;
  const streakEl = wrap.querySelector(".mf-streak") as HTMLElement;
  const toggleBtn = wrap.querySelector(".mf-toggle") as HTMLButtonElement;
  const fillEl = wrap.querySelector(".mf-fill") as HTMLElement;
  const animalEl = wrap.querySelector(".mf-animal") as HTMLElement;
  const bubbleEl = wrap.querySelector(".mf-bubble") as HTMLElement;
  const msgEl = wrap.querySelector(".mf-msg") as HTMLElement;
  const btnsEl = wrap.querySelector(".mf-btns") as HTMLElement;
  const stageEl = wrap.querySelector(".mf-stage") as HTMLElement;

  let levelIdx = 0;
  let correctInLevel = 0;
  let totalCorrect = 0;
  let wrong = 0;
  let streak = 0;
  let locked = false;
  let carryEnabled = true;
  let question: MathQuestion;
  /** 错题本：本关答错的题，最后再练一遍 */
  let retryQueue: MathQuestion[] = [];
  let inRetryMode = false;
  let animal = FARM_LEVELS[0].animals[0];

  function farm(): FarmLevel {
    return FARM_LEVELS[levelIdx];
  }

  function updateTop() {
    const total = FARM_LEVELS.length * QUESTIONS_PER_LEVEL;
    progressEl.textContent = `${farm().name} · ${correctInLevel}/${QUESTIONS_PER_LEVEL} 题${inRetryMode ? "（错题再练）" : ""}`;
    streakEl.textContent = `🔥 连对 ${streak}`;
    fillEl.style.width = `${(totalCorrect / total) * 100}%`;
    wrap.style.background = farm().bg;
  }

  function askQuestion(q: MathQuestion) {
    question = q;
    animal = farm().animals[(correctInLevel + retryQueue.length) % farm().animals.length];
    animalEl.textContent = animal.emoji;
    bubbleEl.textContent = `${q.a} ${q.op} ${q.b} = ?`;
    btnsEl.innerHTML = "";
    for (const c of q.choices) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mf-btn";
      btn.textContent = String(c);
      btn.addEventListener("click", () => onChoice(btn, c));
      btnsEl.appendChild(btn);
    }
    locked = false;
  }

  function nextQuestion() {
    if (inRetryMode && retryQueue.length > 0) {
      askQuestion(retryQueue[0]);
      msgEl.textContent = "错题再练一遍，这次一定行！";
      return;
    }
    askQuestion(makeQuestionForLevel(farm().level, carryEnabled));
  }

  function showLevelUp(final: boolean) {
    const ov = document.createElement("div");
    ov.className = "mf-levelup";
    if (final) {
      ov.innerHTML = `
        <div class="mf-lv-big">🏆</div>
        <div class="mf-lv-title">三块农场全部喂饱啦！</div>
        <div class="mf-lv-sub">十五道题都难不倒你！</div>`;
      wrap.appendChild(ov);
      const stars: 1 | 2 | 3 = wrong === 0 ? 3 : wrong <= 3 ? 2 : 1;
      later(() => onWin(stars, "小动物们都吃得饱饱的，算数小能手就是你！"), 1200);
    } else {
      const next = FARM_LEVELS[levelIdx + 1];
      ov.innerHTML = `
        <div class="mf-lv-big">🎉</div>
        <div class="mf-lv-title">${farm().name}的小动物都吃饱啦！</div>
        <div class="mf-lv-sub">下一站：${next.name}<br>（${next.desc}）</div>
        <button class="mf-lv-btn" type="button">出发 ▶</button>`;
      wrap.appendChild(ov);
      (ov.querySelector(".mf-lv-btn") as HTMLButtonElement).addEventListener("click", () => {
        play("jump");
        ov.remove();
        levelIdx++;
        correctInLevel = 0;
        retryQueue = [];
        inRetryMode = false;
        updateTop();
        nextQuestion();
      });
    }
  }

  function levelDone() {
    if (retryQueue.length > 0 && !inRetryMode) {
      inRetryMode = true;
      play("meow");
      msgEl.textContent = `还有 ${retryQueue.length} 道错题，我们再练一遍！`;
      updateTop();
      later(() => nextQuestion(), 900);
      return;
    }
    play("win");
    showLevelUp(levelIdx >= FARM_LEVELS.length - 1);
  }

  function onChoice(btn: HTMLButtonElement, value: number) {
    if (locked) return;
    play("tap");
    if (value === question.answer) {
      locked = true;
      play("coin");
      if (animal.emoji === "🐱") play("meow");
      if (inRetryMode) {
        retryQueue.shift();
      } else {
        correctInLevel++;
        totalCorrect++;
      }
      streak++;
      let praise = PRAISES[Math.floor(Math.random() * PRAISES.length)];
      if (streak > 0 && streak % 3 === 0) {
        api.addStars(1);
        praise = `🔥 连对 ${streak} 题，奖励一颗小星星！`;
      }
      msgEl.textContent = `${praise} ${animal.name}吃到${animal.food}啦！`;
      animalEl.classList.add("mf-happy");
      const food = document.createElement("div");
      food.className = "mf-food";
      food.textContent = animal.food;
      stageEl.appendChild(food);
      updateTop();
      later(() => {
        animalEl.classList.remove("mf-happy");
        food.remove();
        if (inRetryMode && retryQueue.length === 0) {
          levelDone();
        } else if (!inRetryMode && correctInLevel >= QUESTIONS_PER_LEVEL) {
          levelDone();
        } else {
          nextQuestion();
        }
      }, 900);
    } else {
      wrong++;
      streak = 0;
      play("oops");
      btn.classList.add("mf-wrong");
      btn.disabled = true;
      msgEl.textContent = CHEERS[Math.floor(Math.random() * CHEERS.length)];
      updateTop();
      // 记进错题本（同一题只记一次）
      if (!inRetryMode && !retryQueue.includes(question)) {
        retryQueue.push(question);
      }
    }
  }

  toggleBtn.addEventListener("click", () => {
    play("tap");
    carryEnabled = !carryEnabled;
    toggleBtn.textContent = `🎓 进退位挑战：${carryEnabled ? "开" : "关"}`;
    msgEl.textContent = carryEnabled
      ? "第三关会出现进位、退位挑战题哦！"
      : "第三关也用简单题，慢慢来～";
  });

  updateTop();
  nextQuestion();

  return {
    destroy() {
      timers.forEach(clearTimeout);
      root.innerHTML = "";
    },
  };
}
